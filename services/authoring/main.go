// Command authoring is the Early Atlas authoring backend (ADR 0005): a small Go
// HTTP service that runs on the shared EC2 host, inside the VPC, and talks to the
// Postgres `authoring` schema with a normal connection (DATABASE_URL) — the same
// way the other DK apps connect. Deliberately tiny: one static binary, low memory.
package main

import (
	"context"
	"embed"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/earlyatlas/early-atlas/services/authoring/internal/api"
	"github.com/earlyatlas/early-atlas/services/authoring/internal/auth"
	gh "github.com/earlyatlas/early-atlas/services/authoring/internal/github"
	"github.com/earlyatlas/early-atlas/services/authoring/internal/store"
)

//go:embed all:migrations
var migrationsFS embed.FS

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Error("DATABASE_URL is required")
		os.Exit(1)
	}
	addr := ":" + envOr("PORT", "8080")

	ctx := context.Background()
	st, err := store.New(ctx, dsn)
	if err != nil {
		log.Error("db connect failed", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	if os.Getenv("RUN_MIGRATIONS") == "1" {
		sub, err := fs.Sub(migrationsFS, "migrations")
		if err != nil {
			log.Error("migrations fs", "err", err)
			os.Exit(1)
		}
		if err := st.Migrate(ctx, sub); err != nil {
			log.Error("migrations failed", "err", err)
			os.Exit(1)
		}
		log.Info("migrations applied")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := st.Ping(r.Context()); err != nil {
			http.Error(w, "db unavailable", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ready"))
	})

	// Proposal API — enabled only when Cognito identity is configured.
	issuer, clientID := os.Getenv("COGNITO_ISSUER"), os.Getenv("COGNITO_CLIENT_ID")
	if issuer != "" && clientID != "" {
		verifier, err := auth.NewVerifier(ctx, issuer, clientID)
		if err != nil {
			log.Error("oidc verifier init failed", "err", err)
			os.Exit(1)
		}
		githubCfg, githubOn := gh.ConfigFromEnv()
		handlers := &api.Handlers{Store: st, Log: log, GitHub: githubCfg, GitHubOn: githubOn}
		corsOrigins := strings.Split(os.Getenv("AUTHORING_CORS_ORIGINS"), ",")
		mux.Handle("/api/", api.CORS(corsOrigins, handlers.Routes(verifier)))
		log.Info("proposal API enabled", "cors_origins", len(corsOrigins),
			"materialization", githubOn, "github_app", githubCfg.IsApp())
	} else {
		log.Warn("proposal API disabled — set COGNITO_ISSUER and COGNITO_CLIENT_ID")
	}

	// Donations (Stripe Checkout) — public, independent of identity. The one
	// configured key's prefix decides test vs live mode (reported at /config).
	if stripeKey := os.Getenv("STRIPE_SECRET_KEY"); stripeKey != "" {
		corsOrigins := strings.Split(os.Getenv("AUTHORING_CORS_ORIGINS"), ",")
		dh := api.NewDonateHandlers(stripeKey, corsOrigins, envOr("DONATE_RETURN_URL", "https://earlyatlas.com"), log)
		mux.Handle("/api/donate", api.CORS(corsOrigins, dh.Routes()))
		mux.Handle("/api/donate/", api.CORS(corsOrigins, dh.Routes()))
		log.Info("donations enabled", "mode", api.StripeMode(stripeKey))
	} else {
		log.Warn("donations disabled — set STRIPE_SECRET_KEY")
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("authoring service listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

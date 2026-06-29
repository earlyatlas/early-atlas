// Package github fires a repository_dispatch to trigger the materialize-proposal
// workflow when an admin approves a proposal (ADR 0005 trust boundary). It can
// ONLY trigger the workflow — it never writes files or opens PRs. The actual git
// writes happen inside GitHub Actions, gated by `pnpm check`, onto a proposals/*
// branch; main stays branch-protected and a human merges.
//
// Auth: a GitHub App (preferred) — the service mints short-lived installation
// tokens from the app's private key — or a static token (fallback).
package github

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type Config struct {
	Repo  string   // owner/repo, e.g. earlyatlas/early-atlas
	Token string   // static token (fallback, e.g. a fine-grained PAT)
	app   *appAuth // GitHub App auth (preferred)
}

// ConfigFromEnv prefers GitHub App credentials (GITHUB_APP_ID +
// GITHUB_APP_INSTALLATION_ID + GITHUB_APP_PRIVATE_KEY) and falls back to a static
// GITHUB_TOKEN. Returns (cfg, enabled).
func ConfigFromEnv() (Config, bool) {
	c := Config{Repo: os.Getenv("GITHUB_REPO")}
	if c.Repo == "" {
		return c, false
	}
	appID, inst, key := os.Getenv("GITHUB_APP_ID"), os.Getenv("GITHUB_APP_INSTALLATION_ID"), os.Getenv("GITHUB_APP_PRIVATE_KEY")
	if appID != "" && inst != "" && key != "" {
		if pk, err := parsePrivateKey(key); err == nil {
			c.app = &appAuth{appID: appID, installationID: inst, key: pk}
			return c, true
		}
		// malformed key — fall through to a static token if one is set
	}
	c.Token = os.Getenv("GITHUB_TOKEN")
	return c, c.Token != ""
}

// IsApp reports whether auth is a GitHub App (vs a static token).
func (c Config) IsApp() bool { return c.app != nil }

// MaterializePayload is the client_payload the workflow receives.
type MaterializePayload struct {
	ProposalID  string          `json:"proposal_id"`
	Title       string          `json:"title"`
	Rationale   string          `json:"rationale"`
	AuthorEmail string          `json:"author_email"`
	AuthorSub   string          `json:"author_sub"`
	Changeset   json.RawMessage `json:"changeset"`
}

func Dispatch(ctx context.Context, cfg Config, p MaterializePayload) error {
	tok, err := cfg.bearer(ctx)
	if err != nil {
		return fmt.Errorf("github auth: %w", err)
	}
	body, err := json.Marshal(map[string]any{
		"event_type":     "materialize-proposal",
		"client_payload": p,
	})
	if err != nil {
		return err
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s/dispatches", cfg.Repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("authorization", "Bearer "+tok)
	req.Header.Set("accept", "application/vnd.github+json")
	req.Header.Set("x-github-api-version", "2022-11-28")

	res, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		return fmt.Errorf("github dispatch returned %d: %s", res.StatusCode, string(b))
	}
	return nil
}

func (c Config) bearer(ctx context.Context) (string, error) {
	if c.app != nil {
		return c.app.installationToken(ctx)
	}
	return c.Token, nil
}

// --- GitHub App installation-token minting ---

type appAuth struct {
	appID          string
	installationID string
	key            *rsa.PrivateKey

	mu      sync.Mutex
	token   string
	expires time.Time
}

func parsePrivateKey(s string) (*rsa.PrivateKey, error) {
	s = strings.TrimSpace(s)
	// Env files can't hold multi-line PEMs, so the key may be stored base64-encoded.
	if !strings.Contains(s, "BEGIN") {
		dec, err := base64.StdEncoding.DecodeString(s)
		if err != nil {
			return nil, fmt.Errorf("decode: %w", err)
		}
		s = string(dec)
	}
	block, _ := pem.Decode([]byte(s))
	if block == nil {
		return nil, fmt.Errorf("no PEM block")
	}
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse: %w", err)
	}
	rk, ok := k.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("not an RSA key")
	}
	return rk, nil
}

func b64url(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func (a *appAuth) jwt() (string, error) {
	now := time.Now()
	header := b64url([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claims := b64url([]byte(fmt.Sprintf(`{"iat":%d,"exp":%d,"iss":"%s"}`,
		now.Add(-30*time.Second).Unix(), now.Add(9*time.Minute).Unix(), a.appID)))
	signingInput := header + "." + claims
	sum := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, a.key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}
	return signingInput + "." + b64url(sig), nil
}

// installationToken returns a cached installation token, refreshing it when empty
// or within a minute of expiry. Safe for concurrent use.
func (a *appAuth) installationToken(ctx context.Context) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.token != "" && time.Until(a.expires) > time.Minute {
		return a.token, nil
	}
	jwt, err := a.jwt()
	if err != nil {
		return "", err
	}
	url := fmt.Sprintf("https://api.github.com/app/installations/%s/access_tokens", a.installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("authorization", "Bearer "+jwt)
	req.Header.Set("accept", "application/vnd.github+json")
	req.Header.Set("x-github-api-version", "2022-11-28")
	res, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = res.Body.Close() }()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
	if res.StatusCode/100 != 2 {
		return "", fmt.Errorf("installation token: %d: %s", res.StatusCode, string(raw))
	}
	var out struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	a.token, a.expires = out.Token, out.ExpiresAt
	return a.token, nil
}

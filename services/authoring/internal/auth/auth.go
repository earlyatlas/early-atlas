// Package auth verifies Cognito ID tokens (ADR 0005). The service does not run
// the OAuth login flow itself — it verifies tokens minted by the Cognito hosted
// UI (presented as a bearer token or the ea_session cookie) and extracts the
// caller's identity + group membership. Admin access = the `admins` group.
package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

const sessionCookie = "ea_session"
const adminGroup = "admins"

type User struct {
	Sub     string
	Email   string
	Groups  []string
	IsAdmin bool
}

type ctxKey struct{}

type Verifier struct {
	verifier *oidc.IDTokenVerifier
}

// NewVerifier discovers the Cognito OIDC config at the issuer and builds a
// verifier bound to the app client id (the ID token audience).
func NewVerifier(ctx context.Context, issuer, clientID string) (*Verifier, error) {
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, err
	}
	return &Verifier{verifier: provider.Verifier(&oidc.Config{ClientID: clientID})}, nil
}

// Verify validates a raw ID token and returns the caller. Rejects non-ID tokens.
func (v *Verifier) Verify(ctx context.Context, raw string) (*User, error) {
	tok, err := v.verifier.Verify(ctx, raw)
	if err != nil {
		return nil, err
	}
	var claims struct {
		Sub      string   `json:"sub"`
		Email    string   `json:"email"`
		Groups   []string `json:"cognito:groups"`
		TokenUse string   `json:"token_use"`
	}
	if err := tok.Claims(&claims); err != nil {
		return nil, err
	}
	if claims.TokenUse != "id" {
		return nil, errors.New("not an id token")
	}
	isAdmin := false
	for _, g := range claims.Groups {
		if g == adminGroup {
			isAdmin = true
			break
		}
	}
	return &User{Sub: claims.Sub, Email: claims.Email, Groups: claims.Groups, IsAdmin: isAdmin}, nil
}

// tokenFromRequest reads the bearer Authorization header, then the session cookie.
func tokenFromRequest(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[len("Bearer "):])
	}
	if c, err := r.Cookie(sessionCookie); err == nil {
		return c.Value
	}
	return ""
}

// Middleware verifies the token (if present) and stashes the user in the request
// context. It does not itself reject anonymous requests — handlers decide via
// FromContext / RequireUser / RequireAdmin.
func (v *Verifier) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if raw := tokenFromRequest(r); raw != "" {
			if u, err := v.Verify(r.Context(), raw); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, u))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func FromContext(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(ctxKey{}).(*User)
	return u, ok
}

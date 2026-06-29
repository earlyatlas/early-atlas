package api

import (
	"net/http"
	"strings"
)

// CORS lets the configured UI origins call the API cross-origin with a Bearer
// token. Credentials (cookies) are intentionally NOT allowed: cross-origin auth
// is bearer-only, so the browser never sends cookies to the API and there is no
// cross-origin cookie/CSRF surface. Only origins on the allowlist get an
// Access-Control-Allow-Origin header; everything else is blocked by the browser.
func CORS(allowedOrigins []string, next http.Handler) http.Handler {
	allow := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if o = strings.TrimSpace(o); o != "" {
			allow[o] = true
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allow[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		// Preflight: answer with the headers above (no ACAO for disallowed origins).
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	h := CORS([]string{"https://dev.earlyatlas.com", "http://localhost:4321"}, next)

	t.Run("allowed origin is echoed, no credentials", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/proposals", nil)
		r.Header.Set("Origin", "https://dev.earlyatlas.com")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://dev.earlyatlas.com" {
			t.Errorf("ACAO = %q, want the allowed origin", got)
		}
		// Credentials must never be allowed (bearer-only, no cross-origin cookies).
		if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "" {
			t.Errorf("ACA-Credentials = %q, want empty", got)
		}
	})

	t.Run("disallowed origin gets no ACAO", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/api/proposals", nil)
		r.Header.Set("Origin", "https://evil.com")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("ACAO = %q, want empty for a disallowed origin", got)
		}
	})

	t.Run("preflight short-circuits with 204", func(t *testing.T) {
		r := httptest.NewRequest("OPTIONS", "/api/proposals", nil)
		r.Header.Set("Origin", "http://localhost:4321")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != http.StatusNoContent {
			t.Errorf("preflight status = %d, want 204", w.Code)
		}
	})
}

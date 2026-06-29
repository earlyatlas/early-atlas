package api

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// DonateHandlers serves the public donation flow. It creates a Stripe Checkout
// Session server-side — the secret key never reaches the browser — and returns
// the hosted-checkout URL for the browser to redirect to. One-time payments only;
// dynamic payment methods (no payment_method_types) per Stripe best practice.
//
// The single backend holds exactly one Stripe key; its prefix (test vs live)
// decides the mode, which the UI reads from /api/donate/config. There is no
// client-supplied mode flag — that would be both confusing and unsafe.
type DonateHandlers struct {
	SecretKey   string          // sk_/rk_ test or live — prefix decides the mode
	AllowOrigin map[string]bool // origins permitted as checkout return targets
	DefaultURL  string          // fallback return origin (e.g. https://earlyatlas.com)
	Log         *slog.Logger
	HTTP        *http.Client
}

const (
	minDonationCents int64  = 100       // $1
	maxDonationCents int64  = 1_000_000 // $10,000 — abuse guard
	stripeAPIVersion string = "2026-06-24.dahlia"
)

// StripeMode reports "live" or "test" from the key prefix, so the UI can label
// the (single) backend without a separate config flag.
func StripeMode(key string) string {
	if strings.HasPrefix(key, "sk_live_") || strings.HasPrefix(key, "rk_live_") {
		return "live"
	}
	return "test"
}

func NewDonateHandlers(secretKey string, allowOrigins []string, defaultURL string, log *slog.Logger) *DonateHandlers {
	allow := make(map[string]bool, len(allowOrigins))
	for _, o := range allowOrigins {
		if o = strings.TrimSpace(o); o != "" {
			allow[o] = true
		}
	}
	return &DonateHandlers{
		SecretKey:   secretKey,
		AllowOrigin: allow,
		DefaultURL:  strings.TrimRight(defaultURL, "/"),
		Log:         log,
		HTTP:        &http.Client{Timeout: 15 * time.Second},
	}
}

func (h *DonateHandlers) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/donate", h.create)
	mux.HandleFunc("GET /api/donate/config", h.config)
	return mux
}

func (h *DonateHandlers) config(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":  true,
		"mode":     StripeMode(h.SecretKey),
		"currency": "usd",
	})
}

type donateReq struct {
	AmountCents  int64  `json:"amount_cents"`
	ReturnOrigin string `json:"return_origin"`
}

// returnOrigin only honours a caller-supplied origin if it is on the CORS
// allowlist, so the success/cancel URLs can't be turned into an open redirect.
func (h *DonateHandlers) returnOrigin(req string) string {
	req = strings.TrimRight(strings.TrimSpace(req), "/")
	if req != "" && h.AllowOrigin[req] {
		return req
	}
	return h.DefaultURL
}

func (h *DonateHandlers) create(w http.ResponseWriter, r *http.Request) {
	var body donateReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.AmountCents < minDonationCents || body.AmountCents > maxDonationCents {
		writeErr(w, http.StatusBadRequest, "amount must be between $1 and $10,000")
		return
	}
	origin := h.returnOrigin(body.ReturnOrigin)

	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("submit_type", "donate")
	form.Set("success_url", origin+"/contribute?donated=1")
	form.Set("cancel_url", origin+"/contribute?donated=0")
	form.Set("line_items[0][quantity]", "1")
	form.Set("line_items[0][price_data][currency]", "usd")
	form.Set("line_items[0][price_data][unit_amount]", strconv.FormatInt(body.AmountCents, 10))
	form.Set("line_items[0][price_data][product_data][name]", "Donation to Early Atlas")
	form.Set("line_items[0][price_data][product_data][description]",
		"Voluntary contribution supporting an open early-childhood curriculum.")
	// Deliberately NO payment_method_types — enables dynamic payment methods.

	sreq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not build checkout request")
		return
	}
	sreq.Header.Set("Authorization", "Bearer "+h.SecretKey)
	sreq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	sreq.Header.Set("Stripe-Version", stripeAPIVersion)
	sreq.Header.Set("Idempotency-Key", uuid.NewString())

	resp, err := h.HTTP.Do(sreq)
	if err != nil {
		h.Log.Error("stripe request failed", "err", err)
		writeErr(w, http.StatusBadGateway, "could not reach the payment processor")
		return
	}
	defer func() { _ = resp.Body.Close() }()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	var parsed struct {
		URL   string `json:"url"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &parsed)

	if resp.StatusCode/100 != 2 || parsed.URL == "" {
		// Never log the key or surface Stripe internals to the client.
		h.Log.Error("stripe checkout create failed", "status", resp.StatusCode, "message", parsed.Error.Message)
		writeErr(w, http.StatusBadGateway, "could not start checkout")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": parsed.URL})
}

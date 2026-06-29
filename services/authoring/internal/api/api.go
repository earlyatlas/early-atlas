// Package api exposes the proposal queue over HTTP (ADR 0005). Contributors and
// agents create proposals; admins list, read, and change status. Authoritative
// change-set validation runs in CI, not here.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/earlyatlas/early-atlas/services/authoring/internal/auth"
	gh "github.com/earlyatlas/early-atlas/services/authoring/internal/github"
	"github.com/earlyatlas/early-atlas/services/authoring/internal/store"
)

type Handlers struct {
	Store    *store.Store
	Log      *slog.Logger
	GitHub   gh.Config
	GitHubOn bool // whether approve dispatches the materialize-proposal workflow
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Routes returns the /api routes wrapped in the auth middleware (which populates
// the caller from the token but does not itself reject anonymous requests).
func (h *Handlers) Routes(v *auth.Verifier) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/proposals", h.create)
	mux.HandleFunc("GET /api/proposals", h.list)
	mux.HandleFunc("GET /api/proposals/{id}", h.get)
	mux.HandleFunc("POST /api/proposals/{id}/status", h.setStatus)
	return v.Middleware(mux)
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func requireUser(w http.ResponseWriter, r *http.Request) (*auth.User, bool) {
	u, ok := auth.FromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "authentication required")
		return nil, false
	}
	return u, true
}

func requireAdmin(w http.ResponseWriter, r *http.Request) (*auth.User, bool) {
	u, ok := requireUser(w, r)
	if !ok {
		return nil, false
	}
	if !u.IsAdmin {
		writeErr(w, http.StatusForbidden, "admin access required")
		return nil, false
	}
	return u, true
}

type createBody struct {
	Changeset  json.RawMessage `json:"changeset"`
	BaseCommit *string         `json:"base_commit"`
	Title      *string         `json:"title"`
	Rationale  *string         `json:"rationale"`
}

func (h *Handlers) create(w http.ResponseWriter, r *http.Request) {
	u, ok := requireUser(w, r)
	if !ok {
		return
	}
	var body createBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(body.Changeset) == 0 {
		writeErr(w, http.StatusBadRequest, "changeset is required")
		return
	}
	email := u.Email
	p, err := h.Store.CreateProposal(r.Context(), store.CreateProposalInput{
		Changeset:   body.Changeset,
		AuthorSub:   &u.Sub,
		AuthorEmail: &email,
		Title:       body.Title,
		Rationale:   body.Rationale,
		BaseCommit:  body.BaseCommit,
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create proposal")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *Handlers) list(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireAdmin(w, r); !ok {
		return
	}
	status := store.ProposalStatus(r.URL.Query().Get("status"))
	items, err := h.Store.ListProposals(r.Context(), status)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not list proposals")
		return
	}
	if items == nil {
		items = []store.Proposal{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handlers) get(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireAdmin(w, r); !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := h.Store.GetProposal(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not fetch proposal")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

type statusBody struct {
	Status store.ProposalStatus `json:"status"`
}

var validStatuses = map[store.ProposalStatus]bool{
	store.StatusDraft: true, store.StatusSubmitted: true, store.StatusApproved: true,
	store.StatusRejected: true, store.StatusMerged: true,
}

func (h *Handlers) setStatus(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireAdmin(w, r); !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body statusBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&body); err != nil || !validStatuses[body.Status] {
		writeErr(w, http.StatusBadRequest, "invalid status")
		return
	}
	p, err := h.Store.SetProposalStatus(r.Context(), id, body.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not update status")
		return
	}

	// On approval, trigger the materialize-proposal workflow (which opens the PR).
	// Best-effort: a failed dispatch leaves the proposal approved so an admin can
	// retry by approving again (the workflow is idempotent on the proposals/* branch).
	materialization := "skipped"
	if body.Status == store.StatusApproved && h.GitHubOn {
		err := gh.Dispatch(r.Context(), h.GitHub, gh.MaterializePayload{
			ProposalID:  p.ID.String(),
			Title:       deref(p.Title),
			Rationale:   deref(p.Rationale),
			AuthorEmail: deref(p.AuthorEmail),
			AuthorSub:   deref(p.AuthorSub),
			Changeset:   p.Changeset,
		})
		if err != nil {
			h.Log.Error("materialize dispatch failed", "proposal", p.ID, "err", err)
			materialization = "error: " + err.Error()
		} else {
			h.Log.Info("materialize dispatched", "proposal", p.ID)
			materialization = "dispatched"
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"proposal": p, "materialization": materialization})
}

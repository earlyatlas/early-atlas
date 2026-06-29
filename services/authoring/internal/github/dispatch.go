// Package github fires a repository_dispatch to trigger the materialize-proposal
// workflow when an admin approves a proposal (ADR 0005 trust boundary). It can
// ONLY trigger the workflow — it never writes files or opens PRs. The actual git
// writes happen inside GitHub Actions, gated by `pnpm check`, onto a proposals/*
// branch; main stays branch-protected and a human merges.
package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type Config struct {
	// Token: a GitHub App installation token (preferred) or a fine-grained PAT
	// scoped to contents:write on the repo. Only used to trigger the workflow.
	Token string
	Repo  string // owner/repo, e.g. earlyatlas/early-atlas
}

func ConfigFromEnv() (Config, bool) {
	c := Config{Token: os.Getenv("GITHUB_TOKEN"), Repo: os.Getenv("GITHUB_REPO")}
	return c, c.Token != "" && c.Repo != ""
}

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
	req.Header.Set("authorization", "Bearer "+cfg.Token)
	req.Header.Set("accept", "application/vnd.github+json")
	req.Header.Set("x-github-api-version", "2022-11-28")

	res, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		return fmt.Errorf("github dispatch returned %d: %s", res.StatusCode, string(b))
	}
	return nil
}

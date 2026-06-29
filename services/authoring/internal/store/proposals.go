package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ProposalStatus mirrors the authoring.proposals.status check constraint.
type ProposalStatus string

const (
	StatusDraft     ProposalStatus = "draft"
	StatusSubmitted ProposalStatus = "submitted"
	StatusApproved  ProposalStatus = "approved"
	StatusRejected  ProposalStatus = "rejected"
	StatusMerged    ProposalStatus = "merged"
)

// Proposal is one row of the authoring queue. Changeset/Validation/ReviewNotes
// are raw JSON (jsonb columns); the Go service stores and serves them without
// needing the curriculum schema — authoritative validation runs in CI (TS).
type Proposal struct {
	ID          uuid.UUID       `json:"id"`
	Status      ProposalStatus  `json:"status"`
	AuthorSub   *string         `json:"author_sub"`
	AuthorEmail *string         `json:"author_email"`
	Title       *string         `json:"title"`
	Rationale   *string         `json:"rationale"`
	Changeset   json.RawMessage `json:"changeset"`
	BaseCommit  *string         `json:"base_commit"`
	Validation  json.RawMessage `json:"validation,omitempty"`
	ReviewNotes json.RawMessage `json:"review_notes,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

const cols = `id, status, author_sub, author_email, title, rationale,
	changeset, base_commit, validation, review_notes, created_at, updated_at`

type CreateProposalInput struct {
	Changeset   json.RawMessage
	AuthorSub   *string
	AuthorEmail *string
	Title       *string
	Rationale   *string
	BaseCommit  *string
}

func (s *Store) CreateProposal(ctx context.Context, in CreateProposalInput) (*Proposal, error) {
	return scanProposal(s.pool.QueryRow(ctx,
		`insert into authoring.proposals
		   (id, author_sub, author_email, title, rationale, changeset, base_commit)
		 values ($1, $2, $3, $4, $5, $6, $7)
		 returning `+cols,
		uuid.New(), in.AuthorSub, in.AuthorEmail, in.Title, in.Rationale,
		in.Changeset, in.BaseCommit))
}

func (s *Store) GetProposal(ctx context.Context, id uuid.UUID) (*Proposal, error) {
	return scanProposal(s.pool.QueryRow(ctx,
		`select `+cols+` from authoring.proposals where id = $1`, id))
}

// ListProposals returns proposals newest-first, optionally filtered by status.
func (s *Store) ListProposals(ctx context.Context, status ProposalStatus) ([]Proposal, error) {
	q := `select ` + cols + ` from authoring.proposals`
	args := []any{}
	if status != "" {
		q += ` where status = $1`
		args = append(args, string(status))
	}
	q += ` order by created_at desc`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Proposal
	for rows.Next() {
		p, err := scanProposal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (s *Store) SetProposalStatus(ctx context.Context, id uuid.UUID, status ProposalStatus) (*Proposal, error) {
	return scanProposal(s.pool.QueryRow(ctx,
		`update authoring.proposals set status = $2, updated_at = now()
		 where id = $1 returning `+cols, id, string(status)))
}

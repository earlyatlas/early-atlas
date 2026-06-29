package store

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/google/uuid"
)

// Integration test against a real Postgres. Skipped unless DATABASE_URL is set
// (so CI stays hermetic); run locally against your own Postgres (e.g. via a tunnel).
func TestProposalRoundTrip(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	st, err := New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer st.Close()

	sub, email := "test-sub-"+uuid.NewString(), "tester@example.com"
	changeset := json.RawMessage(`{"id":"cs_test","title":"Test","operations":[{"op":"create_record","record":{"id":"ea.skill.test"}}]}`)

	created, err := st.CreateProposal(ctx, CreateProposalInput{
		Changeset: changeset, AuthorSub: &sub, AuthorEmail: &email,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() {
		_, _ = st.pool.Exec(ctx, `delete from authoring.proposals where id = $1`, created.ID)
	})

	if created.Status != StatusDraft {
		t.Errorf("new proposal status = %q, want draft", created.Status)
	}
	if created.AuthorSub == nil || *created.AuthorSub != sub {
		t.Errorf("author_sub not persisted")
	}

	got, err := st.GetProposal(ctx, created.ID)
	if err != nil || got == nil {
		t.Fatalf("get: %v", err)
	}
	var round map[string]any
	if err := json.Unmarshal(got.Changeset, &round); err != nil {
		t.Fatalf("changeset is not valid json round-trip: %v", err)
	}
	if round["id"] != "cs_test" {
		t.Errorf("changeset round-trip lost data: %v", round["id"])
	}

	subs, err := st.ListProposals(ctx, StatusSubmitted)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	for _, p := range subs {
		if p.ID == created.ID {
			t.Errorf("draft proposal showed up in submitted filter")
		}
	}

	updated, err := st.SetProposalStatus(ctx, created.ID, StatusSubmitted)
	if err != nil {
		t.Fatalf("setStatus: %v", err)
	}
	if updated.Status != StatusSubmitted {
		t.Errorf("status not updated: %q", updated.Status)
	}
}

// Package store is the Postgres data access for the authoring proposal queue
// (ADR 0005). Normal pgx connection pool against the `authoring` schema — no RDS
// Data API. The proposal queue is the trust boundary: untrusted change sets live
// here as inert rows until an admin approves one.
package store

import (
	"context"
	"fmt"
	"io/fs"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgxpool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close()                         { s.pool.Close() }
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// Migrate applies any SQL migrations in fsys (a filesystem rooted at the
// migrations dir) that have not yet been recorded. Idempotent.
func (s *Store) Migrate(ctx context.Context, fsys fs.FS) error {
	if _, err := s.pool.Exec(ctx, `create schema if not exists authoring`); err != nil {
		return err
	}
	if _, err := s.pool.Exec(ctx,
		`create table if not exists authoring._migrations (
			filename text primary key, applied_at timestamptz not null default now())`); err != nil {
		return err
	}

	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var exists bool
		if err := s.pool.QueryRow(ctx,
			`select exists(select 1 from authoring._migrations where filename = $1)`, name,
		).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sql, err := fs.ReadFile(fsys, name)
		if err != nil {
			return err
		}
		if _, err := s.pool.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := s.pool.Exec(ctx,
			`insert into authoring._migrations (filename) values ($1)`, name); err != nil {
			return err
		}
	}
	return nil
}

// helper used by repository methods to map a row.
func scanProposal(row pgx.Row) (*Proposal, error) {
	var p Proposal
	err := row.Scan(&p.ID, &p.Status, &p.AuthorSub, &p.AuthorEmail, &p.Title,
		&p.Rationale, &p.Changeset, &p.BaseCommit, &p.Validation, &p.ReviewNotes,
		&p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

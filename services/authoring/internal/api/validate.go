package api

import (
	"encoding/json"
	"fmt"
	"regexp"
)

// Server-side change-set validation, run on submit (ADR 0005). This is a
// STRUCTURAL gate — it rejects malformed change sets and operations the server
// cannot materialize, so garbage never reaches the review queue. The authoritative
// record-schema + graph validation still runs in CI (the schema lives in the TS
// curriculum-schema package); this layer is deliberately lighter and in Go.

var recordIDRe = regexp.MustCompile(`^ea\.[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]+)+$`)

// supportedOps are the operations the materializer can apply. add_edge is in the
// public schema but is NOT materialized yet, so it is rejected here.
var supportedOps = map[string]bool{
	"create_record":    true,
	"update_fields":    true,
	"replace_body":     true,
	"deprecate_record": true,
}

type parsedChangeset struct {
	ID         string            `json:"id"`
	Title      string            `json:"title"`
	Rationale  string            `json:"rationale"`
	Operations []json.RawMessage `json:"operations"`
}

// validateChangeset parses + structurally validates a change set. It returns the
// embedded title/rationale (so the API can fall back to them) and a list of
// human-readable errors (empty = valid).
func validateChangeset(raw json.RawMessage) (title, rationale string, errs []string) {
	var cs parsedChangeset
	if err := json.Unmarshal(raw, &cs); err != nil {
		return "", "", []string{"change set is not valid JSON"}
	}
	title, rationale = cs.Title, cs.Rationale
	if cs.ID == "" {
		errs = append(errs, "change set is missing an id")
	}
	if len(cs.Operations) == 0 {
		errs = append(errs, "a change set needs at least one operation")
	}
	for i, opRaw := range cs.Operations {
		var op struct {
			Op     string         `json:"op"`
			ID     string         `json:"id"`
			Record map[string]any `json:"record"`
			Fields map[string]any `json:"fields"`
			Body   *string        `json:"body"`
		}
		if err := json.Unmarshal(opRaw, &op); err != nil {
			errs = append(errs, fmt.Sprintf("operation %d is malformed", i+1))
			continue
		}
		if !supportedOps[op.Op] {
			errs = append(errs, fmt.Sprintf(
				"operation %d: unsupported op %q (supported: create_record, update_fields, replace_body, deprecate_record)", i+1, op.Op))
			continue
		}
		switch op.Op {
		case "create_record":
			id, _ := op.Record["id"].(string)
			if id == "" {
				errs = append(errs, fmt.Sprintf("operation %d: create_record needs a record with an id", i+1))
			} else if !recordIDRe.MatchString(id) {
				errs = append(errs, fmt.Sprintf("operation %d: invalid record id %q", i+1, id))
			}
		case "update_fields":
			if !recordIDRe.MatchString(op.ID) {
				errs = append(errs, fmt.Sprintf("operation %d: invalid or missing record id", i+1))
			}
			if len(op.Fields) == 0 {
				errs = append(errs, fmt.Sprintf("operation %d: update_fields needs at least one field", i+1))
			}
		case "replace_body":
			if !recordIDRe.MatchString(op.ID) {
				errs = append(errs, fmt.Sprintf("operation %d: invalid or missing record id", i+1))
			}
			if op.Body == nil {
				errs = append(errs, fmt.Sprintf("operation %d: replace_body needs a body", i+1))
			}
		case "deprecate_record":
			if !recordIDRe.MatchString(op.ID) {
				errs = append(errs, fmt.Sprintf("operation %d: invalid or missing record id", i+1))
			}
		}
	}
	return title, rationale, errs
}

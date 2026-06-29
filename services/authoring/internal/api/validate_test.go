package api

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateChangeset(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantErr   bool
		errSubstr string
		title     string
	}{
		{
			name:  "valid create_record",
			body:  `{"id":"cs1","title":"New skill: Counts","rationale":"why","operations":[{"op":"create_record","record":{"id":"ea.skill.math.counts"}}]}`,
			title: "New skill: Counts",
		},
		{
			name: "valid update_fields",
			body: `{"id":"cs1","operations":[{"op":"update_fields","id":"ea.skill.math.counts","fields":{"tags":["a"]}}]}`,
		},
		{name: "malformed json", body: `{not json`, wantErr: true, errSubstr: "valid JSON"},
		{name: "no operations", body: `{"id":"cs1","operations":[]}`, wantErr: true, errSubstr: "at least one operation"},
		{
			name:      "unsupported op (add_edge)",
			body:      `{"id":"cs1","operations":[{"op":"add_edge","from_id":"ea.skill.a.b","to_id":"ea.skill.c.d","type":"replaces"}]}`,
			wantErr:   true,
			errSubstr: "unsupported op",
		},
		{
			name:      "create_record missing id",
			body:      `{"id":"cs1","operations":[{"op":"create_record","record":{"title":"x"}}]}`,
			wantErr:   true,
			errSubstr: "needs a record with an id",
		},
		{
			name:      "update_fields bad id",
			body:      `{"id":"cs1","operations":[{"op":"update_fields","id":"not-an-id","fields":{"a":1}}]}`,
			wantErr:   true,
			errSubstr: "invalid or missing record id",
		},
		{
			name:      "update_fields no fields",
			body:      `{"id":"cs1","operations":[{"op":"update_fields","id":"ea.skill.a.b","fields":{}}]}`,
			wantErr:   true,
			errSubstr: "at least one field",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			title, _, errs := validateChangeset(json.RawMessage(c.body))
			if c.wantErr && len(errs) == 0 {
				t.Fatalf("expected errors, got none")
			}
			if !c.wantErr && len(errs) != 0 {
				t.Fatalf("expected no errors, got %v", errs)
			}
			if c.errSubstr != "" && !strings.Contains(strings.Join(errs, " | "), c.errSubstr) {
				t.Fatalf("errors %v do not contain %q", errs, c.errSubstr)
			}
			if c.title != "" && title != c.title {
				t.Fatalf("title = %q, want %q", title, c.title)
			}
		})
	}
}

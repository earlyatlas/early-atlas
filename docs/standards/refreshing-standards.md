# Refreshing standards (ELOF)

External standards (currently the Head Start **ELOF**) are stored as `standard`
records — see [content-model.md](content-model.md). They change rarely (ELOF is
revised roughly once a decade), so we keep a **verified, transcribed snapshot**
rather than a live feed, and regenerate it with one script when needed.

## How to refresh

```
python3 scripts/refresh-elof-standards.py --dry-run   # parse + report, write nothing
python3 scripts/refresh-elof-standards.py             # (re)generate the records
pnpm validate                                         # confirm 0 issues
```

The script wipes `curriculum/standards/elof/` and regenerates one
`ea.standard.elof.<code>` record per goal (both age bands, all domains), each with
its `domain_area`, `sub_domain`, verbatim `title`, age-graded `indicators`,
`source_url`, and public-domain `attribution`. Only the Python 3 standard library
is required. After running, skim the dry-run counts and spot-check a couple of
records against the live page.

## Why it sources from the Internet Archive (important)

HeadStart.gov serves the ELOF goals + indicators as **public-domain** pages, but
its CloudFront edge **hard-blocks automated/datacenter clients** — every headless
request (the fetch tool, `curl`, even headless Chrome) gets `403 "Request blocked"`.
That is an **IP/edge block, not a JavaScript challenge**, so a "real browser" from a
blocked network is blocked too; only a normal browser on an allowed (e.g.
residential) IP succeeds.

The same official pages are mirrored by the **Internet Archive**, which does not
IP-block. So the script reads each page from its latest Wayback **HTTP-200** capture
(found via the CDX index) using the raw `…id_/…` form, and transcribes the content
verbatim. This is the official content, just fetched via an accessible mirror — not
PDF parsing and not a secondary reproduction (a random "ELOF" PDF we tried once had
goals that aren't in the federal framework).

## Reliability rules

- `title` and every `indicator.text` are **verbatim** from the source; never
  paraphrase. Each record carries the `source_url` so it's checkable.
- The catalog is the source of truth for _what standards exist_; **skill→standard
  alignment** (`standard_ids` on skills) is curated separately, propose-then-review.
- To add another framework (a state's standards, Common Core-K), add its articles to
  `ARTICLES`/a sibling script and mind its license — ELOF is U.S. federal public
  domain; CCSS is reproducible only **with attribution**; state standards are
  per-state. Keep each record's `framework` and `attribution` accurate.

## What the script does not do

It does not invent or map. It transcribes the goal catalog. Aligning our skills to
these standards, and any UI for standards, are separate steps (standards are a
background data layer today — `pnpm coverage` reports coverage and gaps).

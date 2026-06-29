#!/usr/bin/env python3
"""Refresh the Head Start ELOF `standard` records from the authoritative source.

WHY THIS EXISTS
  HeadStart.gov serves the ELOF goals + developmental-progression indicators as
  public-domain web pages, but its CloudFront edge hard-blocks automated/datacenter
  clients (HTTP 403 "Request blocked") regardless of browser. The faithful pages are
  mirrored by the Internet Archive, which does not IP-block, so we read the official
  content from a Wayback snapshot and transcribe it VERBATIM into records.

WHAT IT DOES
  For each ELOF domain article (both age bands) it: finds the latest Wayback
  snapshot, fetches the raw archived HTML, parses every Goal (code, title, domain,
  sub-domain) and its indicators (mapped to age periods), and (re)writes one
  `curriculum/standards/elof/<code>/record.yaml` per goal. Idempotent.

USAGE
  python3 scripts/refresh-elof-standards.py --dry-run   # parse + report, write nothing
  python3 scripts/refresh-elof-standards.py             # (re)generate records
Only the Python 3 standard library is required.
"""
import json, os, re, sys, time, html, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "curriculum", "standards", "elof")
SOURCE_BASE = "https://headstart.gov/school-readiness/article"
ATTRIBUTION = (
    "Head Start Early Learning Outcomes Framework (ELOF), Office of Head Start "
    "— U.S. federal government work, public domain."
)

# The authoritative ELOF goal articles: (article-slug, age_band, domain_area).
# domain_area is the known ELOF domain for the article — used as a reliable
# fallback when a page omits the inline "Domain:" marker.
ARTICLES = [
    ("approaches-learning-preschool", "preschooler", "Approaches to Learning"),
    ("social-preschool", "preschooler", "Social and Emotional Development"),
    ("language-preschool", "preschooler", "Language and Communication"),
    ("literacy-preschool", "preschooler", "Literacy"),
    ("math-preschool", "preschooler", "Mathematics Development"),
    ("science-preschool", "preschooler", "Scientific Reasoning"),
    ("perceptual-preschool", "preschooler", "Perceptual, Motor, and Physical Development"),
    ("approaches-infant", "infant-toddler", "Approaches to Learning"),
    ("social-infant", "infant-toddler", "Social and Emotional Development"),
    ("language-infant", "infant-toddler", "Language and Communication"),
    ("cognition-infant", "infant-toddler", "Cognition"),
    ("perceptual-infant", "infant-toddler", "Perceptual, Motor, and Physical Development"),
]

UA = "Mozilla/5.0 (EarlyAtlas standards refresh; +https://earlyatlas.com)"


def _get(url, tries=4):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:  # transient archive.org timeouts/5xx — back off and retry
            last = e
            time.sleep(2 * (attempt + 1))
    raise last


def fetch_archived(slug):
    """Return the raw archived HTML of the latest Wayback snapshot for an article."""
    page = f"headstart.gov/school-readiness/article/{slug}"
    # CDX index is the reliable way to find the most-recent HTTP-200 capture.
    cdx = _get(
        "http://web.archive.org/cdx/search/cdx?url=" + page
        + "&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=-1"
    )
    rows = json.loads(cdx) if cdx.strip() else []
    data = [r for r in rows if r and r[0] != "timestamp"]
    if not data:
        raise RuntimeError(f"no Wayback 200 snapshot for {slug}")
    ts = data[-1][0]
    # `id_` returns the raw page without the Wayback toolbar/rewriting.
    return _get(f"https://web.archive.org/web/{ts}id_/https://{page}"), ts


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def extract_table(doc, start, end):
    """Parse the goal_chart table in doc[start:end] -> list[(age_period, text)]."""
    seg = doc[start:end]
    ts = seg.find("goal_chart")
    if ts < 0:
        return []
    tbeg = seg.rfind("<table", 0, ts)
    tend = seg.find("</table>", ts)
    body = re.search(r"<tbody>(.*?)</tbody>", seg[tbeg:tend], re.S)
    if not body:
        return []
    rows = re.findall(r"<tr>(.*?)</tr>", body.group(1), re.S)
    if len(rows) < 2:
        return []

    def cells(r):
        return re.findall(r'<t[dh][^>]*class="([^"]*)"[^>]*>(.*?)</t[dh]>', r, re.S)

    # Position-based: first tbody row holds the age-period labels (skip spacers);
    # subsequent rows hold indicator cells in the same column order.
    labels = [clean(v) for c, v in cells(rows[0]) if "spacer" not in c]
    out = []
    for r in rows[1:]:
        col = 0
        for c, v in cells(r):
            if "spacer" in c:
                continue
            ap = labels[col] if col < len(labels) else None
            lis = re.findall(r"<li[^>]*>(.*?)</li>", v, re.S)
            items = [clean(x) for x in lis] if lis else ([clean(v)] if clean(v) else [])
            for it in items:
                out.append((ap, it))
            col += 1
    return out


def parse_page(doc, slug, age_band, ts, domain_default=None):
    goals = []
    g_iter = list(re.finditer(r"Goal\s+((?:IT|P)-[A-Z]+\s+\d+)\.\s*([^<]+?)\s*<", doc))
    dom = [(m.start(), clean(m.group(1)))
           for m in re.finditer(r"(?<!Sub-)Domain:\s*(?:</[^>]+>\s*)*([^<]+?)\s*<", doc)]
    sub = [(m.start(), clean(m.group(1)))
           for m in re.finditer(r"Sub-Domain:\s*(?:</[^>]+>\s*)*([^<]+?)\s*<", doc)]

    def last_before(items, pos):
        v = None
        for p, val in items:
            if p < pos:
                v = val
            else:
                break
        return v

    for i, m in enumerate(g_iter):
        code = re.sub(r"\s+", " ", m.group(1)).strip()
        # ELOF marks some goals with a trailing footnote asterisk (cross-domain
        # reference); it isn't part of the goal statement.
        title = re.sub(r"\s*\*+\s*$", "", clean(m.group(2)))
        end = g_iter[i + 1].start() if i + 1 < len(g_iter) else len(doc)
        inds = extract_table(doc, m.start(), end)
        goals.append({
            "code": code,
            "title": title,
            "domain_area": last_before(dom, m.start()) or domain_default,
            "sub_domain": last_before(sub, m.start()),
            "age_band": age_band,
            "slug": slug,
            "indicators": inds,
        })
    # A goal code can appear more than once on a page (nav/intro list + the real
    # heading with its table). Keep one per code — the richest (most indicators).
    order, best = [], {}
    for g in goals:
        k = g["code"]
        if k not in best:
            order.append(k)
            best[k] = g
        elif len(g["indicators"]) > len(best[k]["indicators"]):
            best[k] = g
    return [best[k] for k in order]


def y(s):
    """A YAML double-quoted scalar (JSON encoding is valid YAML)."""
    return json.dumps(s, ensure_ascii=False)


def write_record(g):
    code_slug = g["code"].lower().replace(" ", "-")
    d = os.path.join(OUT_DIR, code_slug)
    os.makedirs(d, exist_ok=True)
    L = [
        f"id: ea.standard.elof.{code_slug}",
        "framework: elof",
        "framework_title: Head Start Early Learning Outcomes Framework",
        f"code: {y(g['code'])}",
        f"title: {y(g['title'])}",
    ]
    if g["domain_area"]:
        L.append(f"domain_area: {y(g['domain_area'])}")
    if g["sub_domain"]:
        L.append(f"sub_domain: {y(g['sub_domain'])}")
    L.append(f"age_band: {g['age_band']}")
    if g["indicators"]:
        L.append("indicators:")
        for ap, tx in g["indicators"]:
            L.append(f"  - age_period: {y(ap)}" if ap else "  - text: " + y(tx))
            if ap:
                L.append(f"    text: {y(tx)}")
    L.append(f"source_url: {SOURCE_BASE}/{g['slug']}")
    L.append(f"attribution: {y(ATTRIBUTION)}")
    L.append("status: accepted")
    L.append("locale: en-US")
    open(os.path.join(d, "record.yaml"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    return code_slug


def main():
    dry = "--dry-run" in sys.argv
    if not dry:
        # Regenerate authoritatively: clear the ELOF tree so a goal removed
        # upstream doesn't linger as an orphan record.
        import shutil
        shutil.rmtree(OUT_DIR, ignore_errors=True)
    total = 0
    for slug, age_band, domain_default in ARTICLES:
        doc, ts = fetch_archived(slug)
        goals = parse_page(doc, slug, age_band, ts, domain_default)
        empties = [g["code"] for g in goals if not g["indicators"]]
        print(f"{slug:32s} {age_band:14s} goals={len(goals):3d} "
              f"snapshot={ts}" + (f"  NO-INDICATORS={empties}" if empties else ""))
        if not goals:
            print(f"  !! parsed 0 goals for {slug} — check the page structure")
        if not dry:
            for g in goals:
                write_record(g)
        total += len(goals)
        time.sleep(0.4)  # be polite to archive.org
    print(f"\n{'DRY RUN — ' if dry else ''}total goals: {total}")


if __name__ == "__main__":
    main()

import type { APIRoute, GetStaticPaths } from "astro";
import { getCurriculum } from "../../lib/curriculum.js";

// One static /records/<id>.json per editable record, so the contributor form can
// prefill an edit on the static sites (no server). Only skills and activities are
// editable through the structured form, so only those are emitted.
export const prerender = true;

const EDITABLE = new Set(["skill", "activity"]);

export const getStaticPaths: GetStaticPaths = () =>
  [...getCurriculum().records.values()]
    .filter((r) => EDITABLE.has(r.kind))
    .map((r) => ({ params: { id: r.id } }));

export const GET: APIRoute = ({ params }) => {
  const rec = getCurriculum().records.get(params.id!);
  if (!rec || !EDITABLE.has(rec.kind)) {
    return new Response("Not found", { status: 404 });
  }
  // Public data only; the form maps these fields back onto its inputs.
  return new Response(JSON.stringify({ id: rec.id, kind: rec.kind, data: rec.data }), {
    headers: { "content-type": "application/json" },
  });
};

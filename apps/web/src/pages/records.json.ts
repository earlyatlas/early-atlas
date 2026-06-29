import type { APIRoute } from "astro";
import { getCurriculum } from "../lib/curriculum.js";

// Prerendered to a static /records.json — the contributor form's search-and-pick
// fields filter this client-side, so the picker works on the static sites without
// a server. Public data (ids/titles), regenerated on each build.
export const prerender = true;

export const GET: APIRoute = () => {
  const records = [...getCurriculum().records.values()].map((r) => ({
    id: r.id,
    title: (r.data.title as string) ?? r.id,
    kind: r.kind,
    // milestone (standard) codes give the picker a short, human label (e.g. "IT-SE 3")
    ...(r.data.code ? { code: r.data.code as string } : {}),
  }));
  return new Response(JSON.stringify(records), {
    headers: { "content-type": "application/json" },
  });
};

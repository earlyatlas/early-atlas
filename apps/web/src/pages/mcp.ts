import type { APIRoute } from "astro";
import { getCurriculum } from "../lib/curriculum.js";
import { handleBody } from "../lib/mcp/server.js";
import { drafts } from "../lib/mcp/context.js";

export const prerender = false;

/** Streamable HTTP (POST). Stateless: one request, one JSON response. */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const ctx = {
    store: getCurriculum(),
    drafts,
    baseUrl: new URL(request.url).origin,
  };

  const result = handleBody(body, ctx);

  // Notifications-only batches / a lone notification produce no response body.
  if (result === null || (Array.isArray(result) && result.length === 0)) {
    return new Response(null, { status: 202 });
  }
  return json(result, 200);
};

/** This server does not offer the optional server-initiated SSE stream. */
export const GET: APIRoute = () =>
  new Response("Method Not Allowed — POST JSON-RPC to this endpoint.", {
    status: 405,
    headers: { Allow: "POST" },
  });

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Client-side Cognito auth (OAuth 2.1 + PKCE) for the static UI surfaces. Runs in
// the browser: it obtains a Cognito ID token, keeps it per-tab in sessionStorage,
// and attaches it as a Bearer token to the one backend (api.earlyatlas.com). The
// redirect URI is derived from location.origin, so a single build works on
// localhost, dev.earlyatlas.com, and earlyatlas.com. All values here are
// non-secret (public OAuth client); the backend does the real token verification.

const ISSUER = import.meta.env.PUBLIC_COGNITO_ISSUER as string | undefined;
const CLIENT_ID = import.meta.env.PUBLIC_COGNITO_CLIENT_ID as string | undefined;
const DOMAIN = import.meta.env.PUBLIC_COGNITO_HOSTED_UI_DOMAIN as string | undefined;
const API_URL = (import.meta.env.PUBLIC_AUTHORING_API_URL as string | undefined) ?? "";
const SCOPES = "openid email profile authoring/propose";
const TOKEN_KEY = "ea_id_token";

export function isAuthConfigured(): boolean {
  return Boolean(ISSUER && CLIENT_ID && DOMAIN);
}

function redirectUri(): string {
  return `${location.origin}/auth/callback`;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomToken(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return base64url(a);
}
async function challenge(verifier: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(d));
}

/** Start the OAuth login, returning to `returnPath` afterwards. */
export async function login(
  returnPath: string = location.pathname + location.search,
): Promise<void> {
  const verifier = randomToken(32);
  const state = randomToken(16);
  sessionStorage.setItem("ea_pkce", verifier);
  sessionStorage.setItem("ea_state", state);
  sessionStorage.setItem("ea_return", returnPath.startsWith("/") ? returnPath : "/");
  const p = new URLSearchParams({
    client_id: CLIENT_ID!,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge: await challenge(verifier),
    code_challenge_method: "S256",
  });
  location.assign(`https://${DOMAIN}/oauth2/authorize?${p.toString()}`);
}

/** Exchange the code on the callback page; returns the path to return to. */
export async function handleCallback(): Promise<string> {
  const q = new URLSearchParams(location.search);
  const err = q.get("error");
  if (err) throw new Error(`Sign-in error: ${err}`);
  const code = q.get("code");
  const state = q.get("state");
  const expState = sessionStorage.getItem("ea_state");
  const verifier = sessionStorage.getItem("ea_pkce");
  const ret = sessionStorage.getItem("ea_return") || "/";
  sessionStorage.removeItem("ea_pkce");
  sessionStorage.removeItem("ea_state");
  sessionStorage.removeItem("ea_return");
  if (!code || !state || state !== expState || !verifier) {
    throw new Error("Invalid OAuth callback (state/PKCE mismatch).");
  }
  const res = await fetch(`https://${DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID!,
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}).`);
  const tokens = (await res.json()) as { id_token: string };
  sessionStorage.setItem(TOKEN_KEY, tokens.id_token);
  return ret.startsWith("/") ? ret : "/";
}

function decode(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

/** The current ID token, or null if absent/expired (client-side check only). */
export function getToken(): string | null {
  const t = sessionStorage.getItem(TOKEN_KEY);
  if (!t) return null;
  const p = decode(t);
  if (!p || (typeof p.exp === "number" && p.exp * 1000 < Date.now())) {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return t;
}

export interface BrowserUser {
  sub: string;
  email?: string;
  groups: string[];
  isAdmin: boolean;
}

/** Decode the ID token for UI display (the backend re-verifies on every call). */
export function getUser(): BrowserUser | null {
  const t = getToken();
  if (!t) return null;
  const p = decode(t);
  if (!p) return null;
  const groups = Array.isArray(p["cognito:groups"]) ? (p["cognito:groups"] as string[]) : [];
  return {
    sub: String(p.sub),
    email: typeof p.email === "string" ? p.email : undefined,
    groups,
    isAdmin: groups.includes("admins"),
  };
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  const p = new URLSearchParams({ client_id: CLIENT_ID!, logout_uri: `${location.origin}/` });
  location.assign(`https://${DOMAIN}/logout?${p.toString()}`);
}

/** Backend base URL (no trailing path). Empty when the API isn't configured. */
export const apiBase = API_URL;

/** True when a backend base URL is configured (donations, public endpoints). */
export function isApiConfigured(): boolean {
  return Boolean(API_URL);
}

/** Fetch the backend with the bearer token attached. */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const t = getToken();
  const headers = new Headers(init.headers);
  if (t) headers.set("authorization", `Bearer ${t}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

import { NextResponse, type NextRequest } from "next/server";

/**
 * Access gate for the deployed POC link. Everything requires a cookie
 * (coe_access) equal to APP_ACCESS_CODE, except a small allowlist.
 *
 * Runs on the edge runtime, so it reads process.env.APP_ACCESS_CODE directly
 * (with the same "letmein" default as lib/config.ts) rather than importing
 * lib/config, which pulls in zod / server-only Node deps.
 *
 * Allowed through without the cookie:
 *  - /access                         (the code-entry page itself)
 *  - /api/access                     (sets the cookie)
 *  - /api/runs/<id>/advance          (guarded by its own x-internal-secret)
 *  - /api/upload/token               (Vercel Blob signs + handleUpload verifies)
 *  - static assets / _next / favicon (excluded by the matcher below)
 */

const ACCESS_COOKIE = "coe_access";

function isExempt(pathname: string): boolean {
  if (pathname === "/access") return true;
  if (pathname === "/api/access") return true;
  if (pathname === "/api/upload/token") return true;
  // Internal advance chain authenticates with x-internal-secret, not the cookie.
  if (pathname.startsWith("/api/runs/") && pathname.endsWith("/advance")) return true;
  return false;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  if (isExempt(pathname)) return NextResponse.next();

  const expected = process.env.APP_ACCESS_CODE || "letmein";
  const provided = req.cookies.get(ACCESS_COOKIE)?.value;
  if (provided === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access code required" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/access";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, the favicon, and static asset file extensions. Every
  // other route flows through the gate.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|otf|css|js|map|txt|xml)$).*)",
  ],
};

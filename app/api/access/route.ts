import { NextResponse } from "next/server";

const ACCESS_COOKIE = "coe_access";

/**
 * POST /api/access — validate the access code and set the gate cookie.
 * Body: { code: string }. On success sets an httpOnly, sameSite=lax cookie
 * (secure in production) that the middleware checks on every other route.
 *
 * Reads process.env.APP_ACCESS_CODE directly (same "letmein" default as
 * lib/config.ts and middleware.ts) to keep the gate self-contained.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = body && typeof body.code === "string" ? body.code : "";
  const expected = process.env.APP_ACCESS_CODE || "letmein";

  if (!code || code !== expected) {
    return NextResponse.json({ error: "Incorrect access code" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

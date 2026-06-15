import { NextResponse } from "next/server";
import { createServerClient, setAuthCookies } from "@insforge/sdk/ssr";

// Sign-up. With email verification on (code method), no session is established
// until /api/auth/verify; if verification were off, we'd set cookies here.
export async function POST(request: Request) {
  const client = createServerClient();
  const { data, error } = await client.auth.signUp(await request.json());

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Sign up failed" },
      { status: error.statusCode ?? 400 }
    );
  }

  const d = data as { requireEmailVerification?: boolean; accessToken?: string; refreshToken?: string; user?: unknown };
  const response = NextResponse.json({
    requireEmailVerification: d?.requireEmailVerification ?? false,
    user: d?.user ?? null,
  });

  if (d?.accessToken) {
    setAuthCookies(response.cookies, { accessToken: d.accessToken, refreshToken: d.refreshToken! });
  }
  return response;
}

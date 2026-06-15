import { NextResponse } from "next/server";
import { createServerClient, setAuthCookies } from "@insforge/sdk/ssr";

// Sign-in runs server-side so the httpOnly refresh cookie can be written.
export async function POST(request: Request) {
  const client = createServerClient();
  const { data, error } = await client.auth.signInWithPassword(await request.json());

  if (error || !data?.accessToken) {
    return NextResponse.json(
      { error: error?.message ?? "Sign in failed" },
      { status: error?.statusCode ?? 401 }
    );
  }

  const response = NextResponse.json({ user: data.user });
  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return response;
}

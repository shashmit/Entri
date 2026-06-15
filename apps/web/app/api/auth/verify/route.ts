import { NextResponse } from "next/server";
import { createServerClient, setAuthCookies } from "@insforge/sdk/ssr";

// Verify the 6-digit email code; on success the user is signed in.
export async function POST(request: Request) {
  const client = createServerClient();
  const { data, error } = await client.auth.verifyEmail(await request.json());

  if (error || !data?.accessToken) {
    return NextResponse.json(
      { error: error?.message ?? "Verification failed" },
      { status: error?.statusCode ?? 400 }
    );
  }

  const response = NextResponse.json({ user: data.user });
  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return response;
}

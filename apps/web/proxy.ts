// Next.js 16 proxy (was middleware.ts). Refreshes the InsForge session so
// Server Components and browser cookies stay aligned.
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr";

type UpdateArgs = Parameters<typeof updateSession>[0];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  // Next's RequestCookies/ResponseCookies are structurally close but not equal
  // to the SDK's CookieStore type; cast to the helper's own param types.
  await updateSession({
    requestCookies: request.cookies as unknown as UpdateArgs["requestCookies"],
    responseCookies: response.cookies as unknown as UpdateArgs["responseCookies"],
  });
  return response;
}

export const config = {
  // Skip static assets; run on app routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

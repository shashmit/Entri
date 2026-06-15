import { createBrowserClient } from "@insforge/sdk/ssr";

// Browser SDK client. Reads the `insforge_access_token` cookie, authenticates
// SDK calls, and refreshes through /api/auth/refresh when the token is stale.
export const insforge = createBrowserClient();

import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

// Browser clients call this to mint a fresh access token from the httpOnly
// refresh cookie.
export const { POST } = createRefreshAuthRouter();

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @entri/types ships TS source (zod schemas) consumed directly from the
  // workspace — Next must transpile it rather than expect prebuilt JS.
  transpilePackages: ["@entri/types"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite and pg are native/wasm-backed server deps — keep them external to the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite and pg are native/wasm-backed server deps — keep them external to the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf"],
  // The demo route (and the pipeline it kicks off) reads the pre-loaded sample
  // ACFRs from ./samples at runtime via fs. Next's file tracing does not follow
  // dynamic fs reads, so include the PDFs explicitly with the demo function.
  outputFileTracingIncludes: {
    "/api/demo": ["./samples/**"],
  },
};

export default nextConfig;

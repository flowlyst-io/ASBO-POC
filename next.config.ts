import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite and pg are native/wasm-backed server deps — keep them external to the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf"],
  // The demo route (and the pipeline it kicks off) reads the pre-loaded sample
  // ACFRs from ./samples at runtime via fs. Next's file tracing does not follow
  // dynamic fs reads, so include the PDFs explicitly. Both key spellings are
  // listed because the route-key format differs across Next versions; the
  // wildcard is the belt-and-braces fallback (3 PDFs ≈ 7.6MB, well under
  // function size limits).
  outputFileTracingIncludes: {
    "/api/demo": ["./samples/**"],
    "/api/demo/route": ["./samples/**"],
    "/*": ["./samples/**"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML in out/, served by GitHub Pages (see .github/workflows/deploy.yml).
  // Cache Components is off: it can't be combined with a static export's
  // `dynamic = "force-static"` route handler. Revisit when the site needs a server.
  output: "export",
  // "/cmu-apartment" on a GitHub Pages project site; empty locally.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
};

export default nextConfig;

/** @type {import('next').NextConfig} */

// Amplify exposes console environment variables to the build, but not always to
// the Next.js SSR runtime. Inline the server-only RAG vars at build time so the
// /api/rag/* route handlers can read them at runtime. Only set when present, so
// local dev (var unset) still falls back to http://localhost:8000 in ragProxy.
const env = {};
if (process.env.RAG_API_URL) env.RAG_API_URL = process.env.RAG_API_URL;
if (process.env.RAG_API_KEY) env.RAG_API_KEY = process.env.RAG_API_KEY;

const nextConfig = { env };

export default nextConfig;

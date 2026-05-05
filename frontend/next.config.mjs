/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the production Docker
  // image can ship just `.next/standalone` + `.next/static` + `public`
  // (no node_modules in the runtime layer).
  output: "standalone",
};

export default nextConfig;

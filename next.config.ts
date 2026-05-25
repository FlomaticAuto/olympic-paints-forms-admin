import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No client bundle should ever contain the service role key.
  // Next.js strips server-only env vars automatically, but this
  // makes the intent explicit and catches accidental imports early.
  serverExternalPackages: [],

  // @azure/msal-browser is ESM-only. Without this, Next.js SSR
  // tries to require() it as CommonJS and throws at runtime.
  transpilePackages: ['@azure/msal-browser'],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Remove experimental.appDir - it's now stable in Next.js 16
  // Speed up dev server startup
  swcMinify: true, // Use SWC for faster builds
  
  // Add empty turbopack config to silence warning when using webpack
  turbopack: {},
  
  webpack: (config, { isServer, dev }) => {
    // Make AWS KMS SDK optional (only needed for cloud storage)
    // This prevents build errors when the package is not installed
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@aws-sdk/client-kms');
      } else {
        config.externals = [config.externals, '@aws-sdk/client-kms'];
      }
    }
    
    // Speed up dev builds
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;



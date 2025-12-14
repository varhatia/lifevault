/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    appDir: true
  },
  webpack: (config, { isServer }) => {
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
    return config;
  },
};

export default nextConfig;



/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow webpack to ignore optional dependencies
  webpack: (config, { isServer }) => {
    // Make AWS KMS SDK optional (only needed for cloud storage)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@aws-sdk/client-kms': 'commonjs @aws-sdk/client-kms',
      });
    }
    return config;
  },
};

module.exports = nextConfig;



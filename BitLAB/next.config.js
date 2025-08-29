/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    styledComponents: true,
  },
  transpilePackages: ['lucide-react'],
  // Configure allowed image domains
  images: {
    domains: [
      'cdn.sanity.io',
      'static2.finnhub.io',
      'blockworks.co',
      'www.tbstat.com',
      'cdn.coinidol.com',
      'static.cryptobriefing.com',
      'static1.makeuseofimages.com',
      'www.koreatimes.co.kr',
      'assets.bitcoin-crypto-mining.com',
      'coincodex.com',
      'bitcoinist.com',
      'www.bankofengland.co.uk',
      'www.arabianbusiness.com'
    ],
  },
  // Workaround for TypeScript issues with the Node.js module
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}

module.exports = nextConfig 
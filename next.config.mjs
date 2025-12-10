import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Image optimization (Requirements 2.1, 2.5)
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // React Compiler and package optimizations (Requirements 6.1, 6.2)
  experimental: {
    reactCompiler: true,
    optimizePackageImports: [
      '@tabler/icons-react',
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      'recharts',
    ],
  },
  
  // Production optimizations (Requirements 6.4, 6.5)
  compress: true,
  productionBrowserSourceMaps: false,
}

export default withBundleAnalyzer(nextConfig)

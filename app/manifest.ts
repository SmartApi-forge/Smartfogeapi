import { MetadataRoute } from 'next';

/**
 * Web App Manifest for SmartAPIForge
 * Enables PWA features and improves mobile experience
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SmartAPIForge - AI-Powered API Builder',
    short_name: 'SmartAPIForge',
    description: 'Transform ideas into production-ready APIs instantly with AI-powered no-code platform. Build REST APIs, generate documentation, and deploy in minutes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#6366f1',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/placeholder-logo.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/placeholder-logo.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['developer tools', 'productivity', 'business'],
    screenshots: [
      {
        src: '/ai-code-generation-interface.png',
        sizes: '1280x720',
        type: 'image/png',
      },
    ],
  };
}

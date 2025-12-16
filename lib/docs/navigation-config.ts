/**
 * Navigation Configuration
 * 
 * Defines the structure and content of the documentation navigation sidebar.
 */

import { NavigationConfig, DocumentationCategory } from './types';

export const navigationConfig: NavigationConfig = {
  sections: {
    gettingStarted: {
      id: 'getting-started',
      title: 'Getting Started',
      expanded: true,
      items: [
        {
          id: 'introduction',
          title: 'Introduction',
          href: '/docs/getting-started/introduction',
        },
        {
          id: 'installation',
          title: 'Installation',
          href: '/docs/getting-started/installation',
        },
        {
          id: 'quick-start',
          title: 'Quick Start',
          href: '/docs/getting-started/quick-start',
        },
        {
          id: 'prerequisites',
          title: 'Prerequisites',
          href: '/docs/getting-started/prerequisites',
        },
      ],
    },
    features: {
      id: 'features',
      title: 'Features',
      expanded: false,
      items: [
        {
          id: 'ai-generation',
          title: 'AI-Powered Generation',
          href: '/docs/features/ai-generation',
        },
        {
          id: 'sandbox-execution',
          title: 'Sandbox Execution',
          href: '/docs/features/sandbox-execution',
        },
        {
          id: 'github-integration',
          title: 'GitHub Integration',
          href: '/docs/features/github-integration',
        },
        {
          id: 'deployment',
          title: 'Deployment',
          href: '/docs/features/deployment',
        },
      ],
    },
    apiReference: {
      id: 'api-reference',
      title: 'API Reference',
      expanded: false,
      items: [
        {
          id: 'overview',
          title: 'Overview',
          href: '/docs/api-reference/overview',
        },
        {
          id: 'endpoints',
          title: 'Endpoints',
          href: '/docs/api-reference/endpoints',
        },
        {
          id: 'authentication',
          title: 'Authentication',
          href: '/docs/api-reference/authentication',
        },
      ],
    },
    guides: {
      id: 'guides',
      title: 'Guides',
      expanded: false,
      items: [
        {
          id: 'first-api',
          title: 'Your First API',
          href: '/docs/guides/first-api',
        },
        {
          id: 'advanced-usage',
          title: 'Advanced Usage',
          href: '/docs/guides/advanced-usage',
        },
      ],
    },
    deployment: {
      id: 'deployment',
      title: 'Deployment',
      expanded: false,
      items: [
        {
          id: 'vercel',
          title: 'Deploy to Vercel',
          href: '/docs/deployment/vercel',
        },
        {
          id: 'docker',
          title: 'Docker Deployment',
          href: '/docs/deployment/docker',
        },
      ],
    },
    troubleshooting: {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      expanded: false,
      items: [
        {
          id: 'common-issues',
          title: 'Common Issues',
          href: '/docs/troubleshooting/common-issues',
        },
        {
          id: 'faq',
          title: 'FAQ',
          href: '/docs/troubleshooting/faq',
        },
      ],
    },
  },
};

/**
 * Get all navigation items as a flat array
 */
export function getAllNavigationItems() {
  const allItems: Array<{ title: string; href: string; category: string }> = [];
  
  Object.entries(navigationConfig.sections).forEach(([key, section]) => {
    section.items.forEach((item) => {
      allItems.push({
        title: item.title,
        href: item.href,
        category: section.title,
      });
      
      // Add children if they exist
      if (item.children) {
        item.children.forEach((child) => {
          allItems.push({
            title: child.title,
            href: child.href,
            category: section.title,
          });
        });
      }
    });
  });
  
  return allItems;
}

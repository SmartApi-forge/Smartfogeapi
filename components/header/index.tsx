import Link from 'next/link';
import { Code2, Cpu, NotebookText, Rocket } from 'lucide-react';
import { Logo } from '@/components/logo';
import { MegaMenuClient } from './mega-menu-client';
import { MobileMenuWrapper } from './mobile-menu-wrapper';
import { HeaderActionsClient } from './header-actions-client';

// Static menu items data
const menuItems = [
  { name: 'Model Platform', key: 'features' },
  { name: 'Solutions', key: 'solutions' },
  { name: 'Developers', key: 'resources' },
  { name: 'Pricing', key: 'pricing' },
];

// Static panels data - icons are rendered in the client component
const panelsData = {
  features: [
    {
      title: 'Products',
      items: [
        { iconType: 'cpu', title: 'Serverless Inference', desc: 'Deploy AI at scale.', href: '#' },
        { iconType: 'rocket', title: 'Dedicated Endpoints', desc: 'Custom hardware.', href: '#' },
        { iconType: 'code', title: 'Fine‑Tuning', desc: 'Improve model quality.', href: '#' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { iconType: 'notebook', title: 'Docs', desc: 'API & guides.', href: '#' },
        { iconType: 'code', title: 'Sandbox', desc: 'Experiment quickly.', href: '#' },
      ],
    },
  ],
  solutions: [
    {
      title: 'By use case',
      items: [
        { iconType: 'code', title: 'Backend APIs', desc: 'REST & GraphQL.', href: '#' },
        { iconType: 'cpu', title: 'Microservices', desc: 'Compose services.', href: '#' },
      ],
    },
    {
      title: 'For teams',
      items: [
        { iconType: 'notebook', title: 'Documentation', desc: 'Auto‑generated.', href: '#' },
        { iconType: 'rocket', title: 'Deployment', desc: 'Ship faster.', href: '#' },
      ],
    },
  ],
  resources: [
    {
      title: 'Developers',
      items: [
        { iconType: 'notebook', title: 'Guides', desc: 'Step‑by‑step.', href: '#' },
        { iconType: 'code', title: 'Examples', desc: 'Copy & adapt.', href: '#' },
      ],
    },
  ],
  pricing: [
    {
      title: 'Plans',
      items: [
        { iconType: 'rocket', title: 'Starter', desc: 'Free forever.', href: '#pricing' },
        { iconType: 'rocket', title: 'Pro', desc: 'For teams.', href: '#pricing' },
        { iconType: 'rocket', title: 'Comparator', desc: 'Compare plans.', href: '/pricing-comparator' },
      ],
    },
  ],
};

// Icon mapping function for client-side rendering
function getIcon(iconType: string) {
  const iconClass = 'size-4 text-muted-foreground group-hover:text-accent-foreground';
  switch (iconType) {
    case 'cpu':
      return <Cpu className={iconClass} />;
    case 'rocket':
      return <Rocket className={iconClass} />;
    case 'code':
      return <Code2 className={iconClass} />;
    case 'notebook':
      return <NotebookText className={iconClass} />;
    default:
      return <Code2 className={iconClass} />;
  }
}

// Transform panels data to include React icons
function getPanelsWithIcons() {
  const result: Record<string, { title: string; items: { icon: React.ReactNode; title: string; desc: string; href: string }[] }[]> = {};
  
  for (const [key, columns] of Object.entries(panelsData)) {
    result[key] = columns.map((col) => ({
      title: col.title,
      items: col.items.map((item) => ({
        icon: getIcon(item.iconType),
        title: item.title,
        desc: item.desc,
        href: item.href,
      })),
    }));
  }
  
  return result;
}

export function HeroHeader() {
  const panels = getPanelsWithIcons();

  return (
    <header className="w-full sticky top-0 z-50 bg-background border-b border-border/20">
      <nav className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="relative flex items-center justify-between py-3 sm:py-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>

          {/* Desktop Navigation - Client Component Island */}
          <MegaMenuClient menuItems={menuItems} panels={panels} />

          {/* Desktop Actions - Client Component Island */}
          <HeaderActionsClient />

          {/* Mobile Menu - Client Component Island */}
          <MobileMenuWrapper menuItems={menuItems} />
        </div>
      </nav>
    </header>
  );
}

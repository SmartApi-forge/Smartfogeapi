import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MobileMenuWrapper } from './mobile-menu-wrapper';
import { HeaderActionsClient } from './header-actions-client';

const menuItems: { name: string; key: string }[] = [];

export function HeroHeader() {
  return (
    <header className="w-full sticky top-0 z-50 bg-background border-b border-border/20">
      <nav className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="relative flex items-center justify-between py-3 sm:py-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>

          <HeaderActionsClient />
          <MobileMenuWrapper menuItems={menuItems} />
        </div>
      </nav>
    </header>
  );
}

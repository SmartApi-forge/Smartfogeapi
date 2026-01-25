'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, X, ChevronRight, Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import { Logo } from '@/components/logo';
import { AnimatePresence, motion } from '@/components/motion-wrapper';

interface MenuItem {
  name: string;
  key: string;
}

interface MobileMenuClientProps {
  menuItems: MenuItem[];
  isLoggedIn: boolean;
}

export function MobileMenuClient({ menuItems, isLoggedIn }: MobileMenuClientProps) {
  const [menuState, setMenuState] = React.useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button onClick={() => setMenuState(!menuState)} className="lg:hidden p-2">
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {menuState && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="fixed inset-0 z-[9999] lg:hidden bg-background"
          >
            {/* Header with logo and close button */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuState(false)}
                className="h-10 w-10 rounded-full hover:bg-accent"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="flex flex-col h-full px-6 pb-6">
              {/* Navigation Links */}
              <nav className="space-y-1 py-4">
                {menuItems.map((item) => (
                  <Link
                    key={`m-${item.key}`}
                    href={item.key === 'pricing' ? '#pricing' : '#'}
                    onClick={() => setMenuState(false)}
                    className="flex items-center justify-between py-4 text-lg font-medium text-foreground hover:text-primary transition-colors border-b border-border/50 last:border-b-0"
                  >
                    {item.name}
                    <ChevronRight size={20} className="text-muted-foreground" />
                  </Link>
                ))}

                {/* Theme Section */}
                <div className="flex items-center justify-between py-4 border-b border-border/50">
                  <span className="text-lg font-medium text-foreground">Theme</span>
                  <ThemeSwitch
                    modes={['light', 'dark', 'system']}
                    icons={[
                      <Sun key="sun-icon-m" size={16} />,
                      <Moon key="moon-icon-m" size={16} />,
                      <Laptop key="laptop-icon-m" size={16} />,
                    ]}
                    showInactiveIcons="all"
                    variant="circle-blur"
                    start="bottom-left"
                    animationVariant="circle-blur"
                  />
                </div>
              </nav>

              {/* Bottom Actions */}
              <div className="space-y-3 mt-8">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full justify-center text-base h-12 border-border"
                >
                  <Link href={isLoggedIn ? '/ask' : '/?auth=login'} onClick={() => setMenuState(false)}>
                    {isLoggedIn ? 'Generate' : 'Log In'}
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

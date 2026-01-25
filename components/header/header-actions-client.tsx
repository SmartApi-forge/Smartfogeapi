'use client';

import React from 'react';
import Link from 'next/link';
import { Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import { authService } from '@/lib/auth';

export function HeaderActionsClient() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  // Check authentication status on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      const { session } = await authService.getCurrentSession();
      setIsLoggedIn(!!session?.user);
    };
    checkAuth();
  }, []);

  return (
    <div className="hidden lg:flex items-center space-x-3">
      <ThemeSwitch
        modes={['light', 'dark', 'system']}
        icons={[
          <Sun key="sun-icon" size={16} />,
          <Moon key="moon-icon" size={16} />,
          <Laptop key="laptop-icon" size={16} />,
        ]}
        showInactiveIcons="all"
        variant="icon-click"
      />
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
        <Link href={isLoggedIn ? '/ask' : '/login'}>{isLoggedIn ? 'Generate' : 'Log In'}</Link>
      </Button>
    </div>
  );
}

'use client';

import React from 'react';
import { authService } from '@/lib/auth';
import { MobileMenuClient } from './mobile-menu-client';

interface MenuItem {
  name: string;
  key: string;
}

interface MobileMenuWrapperProps {
  menuItems: MenuItem[];
}

export function MobileMenuWrapper({ menuItems }: MobileMenuWrapperProps) {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  // Check authentication status on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      const { session } = await authService.getCurrentSession();
      setIsLoggedIn(!!session?.user);
    };
    checkAuth();
  }, []);

  return <MobileMenuClient menuItems={menuItems} isLoggedIn={isLoggedIn} />;
}

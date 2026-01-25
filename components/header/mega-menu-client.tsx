'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from '@/components/motion-wrapper';

interface PanelItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}

interface PanelColumn {
  title: string;
  items: PanelItem[];
}

interface MenuItem {
  name: string;
  key: string;
}

interface MegaMenuClientProps {
  menuItems: MenuItem[];
  panels: Record<string, PanelColumn[]>;
}

export function MegaMenuClient({ menuItems, panels }: MegaMenuClientProps) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [panelStyle, setPanelStyle] = React.useState<{ left: number; width: number } | null>(null);
  const navRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({});

  const openPanel = (key: string) => {
    setOpenKey(key);
    requestAnimationFrame(() => {
      const nav = navRef.current;
      const trigger = triggerRefs.current[key];
      if (!nav || !trigger) return;
      const navRect = nav.getBoundingClientRect();
      const tRect = trigger.getBoundingClientRect();
      const width = Math.min(920, Math.max(560, tRect.width * 2.8));
      const center = tRect.left + tRect.width / 2;
      let left = center - width / 2 - navRect.left;
      left = Math.max(12, Math.min(left, navRect.width - width - 12));
      setPanelStyle({ left, width });
    });
  };

  const closePanel = () => setOpenKey(null);

  return (
    <div
      ref={navRef}
      className="hidden lg:flex items-center space-x-8 relative"
      onMouseLeave={() => setTimeout(closePanel, 120)}
    >
      {menuItems.map((item) => (
        <Link
          key={item.key}
          href="#"
          ref={(el) => {
            triggerRefs.current[item.key] = el;
          }}
          onMouseEnter={() => openPanel(item.key)}
          className="group flex items-center text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          {item.name}
          <ChevronDown className="ml-1 h-4 w-4 transition-transform duration-200 group-aria-expanded:rotate-180" />
        </Link>
      ))}

      {/* Mega Panel */}
      <AnimatePresence>
        {openKey && panelStyle && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.6 }}
            className="absolute left-0 right-0 top-full z-50"
            onMouseEnter={() => openKey && openPanel(openKey)}
            onMouseLeave={() => setTimeout(closePanel, 120)}
          >
            <div
              style={{ left: panelStyle.left, width: panelStyle.width }}
              className="relative mx-0 rounded-b-xl rounded-t-none border border-border bg-background text-foreground shadow-2xl overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                {panels[openKey]?.map((col, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">{col.title}</p>
                    <ul className="space-y-2">
                      {col.items.map((it, j) => (
                        <li key={j}>
                          <Link
                            href={it.href}
                            className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <span className="mt-0.5">{it.icon}</span>
                            <span>
                              <span className="block text-sm font-medium">{it.title}</span>
                              <span className="block text-xs text-muted-foreground group-hover:text-accent-foreground/90">
                                {it.desc}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { motion } from '@/components/motion-wrapper';
import { ReactNode } from 'react';

interface AnimatedSectionWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * Client component wrapper for sections that need scroll-triggered animations.
 * Uses viewport={{ once: true }} to prevent re-triggering animations.
 * 
 * Requirements: 8.5 - Use viewport={{ once: true }} to prevent re-triggering animations
 */
export function AnimatedSectionWrapper({ children, className }: AnimatedSectionWrapperProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Smaller animation variant for footer and similar sections.
 */
export function AnimatedFooterWrapper({ children, className }: AnimatedSectionWrapperProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

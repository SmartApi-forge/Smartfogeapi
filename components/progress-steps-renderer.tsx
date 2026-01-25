/**
 * Progress Steps Renderer Component
 * 
 * Displays step-by-step progress messages during code generation.
 * Uses TextShimmer animation for active steps instead of icons.
 * 
 * Requirements: 7.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 * - 7.6: Display progress steps inline in assistant message area
 * - 11.1-11.6: Show thinking, planning, folder, file:detail steps
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Progress step status
 */
export type StepStatus = 'pending' | 'active' | 'complete';

/**
 * Progress step definition
 */
export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

/**
 * Props for ProgressStepsRenderer
 */
export interface ProgressStepsRendererProps {
  steps: ProgressStep[];
  className?: string;
  /** Show completed steps with checkmark */
  showCompleted?: boolean;
  /** Animate steps as they appear */
  animate?: boolean;
}

/**
 * Single progress step item
 */
function ProgressStepItem({ 
  step, 
  animate = true 
}: { 
  step: ProgressStep; 
  animate?: boolean;
}) {
  const variants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  const content = (
    <div className={cn(
      'flex items-center gap-2 py-1',
      step.status === 'complete' && 'text-muted-foreground'
    )}>
      {/* Status indicator */}
      {step.status === 'complete' ? (
        <Check className="size-3.5 text-green-500 flex-shrink-0" />
      ) : step.status === 'active' ? (
        <span className="size-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
      )}
      
      {/* Step label with shimmer for active state */}
      {step.status === 'active' ? (
        <TextShimmer 
          className="text-sm font-medium"
          duration={1.5}
          spread={1.5}
        >
          {step.label}
        </TextShimmer>
      ) : (
        <span className={cn(
          'text-sm',
          step.status === 'complete' ? 'text-muted-foreground' : 'text-foreground/70'
        )}>
          {step.status === 'complete' ? `✓ ${step.label}` : step.label}
        </span>
      )}
      
      {/* Optional detail */}
      {step.detail && step.status === 'active' && (
        <span className="text-xs text-muted-foreground ml-1">
          {step.detail}
        </span>
      )}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        key={step.id}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2 }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

/**
 * Progress Steps Renderer
 * 
 * Displays a list of progress steps with animations.
 * Active steps show text shimmer effect.
 * Completed steps show checkmark.
 */
export function ProgressStepsRenderer({
  steps,
  className,
  showCompleted = true,
  animate = true,
}: ProgressStepsRendererProps) {
  // Filter steps based on showCompleted
  const visibleSteps = showCompleted 
    ? steps 
    : steps.filter(s => s.status !== 'complete');

  if (visibleSteps.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      <AnimatePresence mode="popLayout">
        {visibleSteps.map((step) => (
          <ProgressStepItem 
            key={step.id} 
            step={step} 
            animate={animate}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Predefined generation steps
 */
export const GENERATION_PROGRESS_STEPS = {
  thinking: { id: 'thinking', label: 'Thinking...' },
  analyzing: { id: 'analyzing', label: 'Analyzing request...' },
  planning: { id: 'planning', label: 'Planning structure...' },
  reading: { id: 'reading', label: 'Reading files...' },
  generating: { id: 'generating', label: 'Generating code...' },
  writing: { id: 'writing', label: 'Writing files...' },
  validating: { id: 'validating', label: 'Validating...' },
  complete: { id: 'complete', label: 'Complete!' },
} as const;

/**
 * Create progress steps from generation status
 */
export function createProgressSteps(
  currentStatus: string,
  filesModified: string[] = [],
  fileReadingCount: number = 0
): ProgressStep[] {
  const steps: ProgressStep[] = [];
  
  // Map status to step progression
  const statusOrder = [
    'thinking',
    'reading_files', 
    'generating',
    'complete',
  ];
  
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  // Thinking step
  steps.push({
    ...GENERATION_PROGRESS_STEPS.thinking,
    status: currentIndex > 0 ? 'complete' : currentIndex === 0 ? 'active' : 'pending',
  });
  
  // Reading files step (if applicable)
  if (fileReadingCount > 0 || currentStatus === 'reading_files') {
    steps.push({
      ...GENERATION_PROGRESS_STEPS.reading,
      status: currentIndex > 1 ? 'complete' : currentIndex === 1 ? 'active' : 'pending',
      detail: fileReadingCount > 0 ? `(${fileReadingCount} files)` : undefined,
    });
  }
  
  // Generating step
  steps.push({
    ...GENERATION_PROGRESS_STEPS.generating,
    status: currentIndex > 2 ? 'complete' : currentIndex === 2 ? 'active' : 'pending',
    detail: filesModified.length > 0 ? `(${filesModified.length} files)` : undefined,
  });
  
  // Complete step
  if (currentStatus === 'complete') {
    steps.push({
      ...GENERATION_PROGRESS_STEPS.complete,
      status: 'complete',
    });
  }
  
  return steps;
}

export default ProgressStepsRenderer;

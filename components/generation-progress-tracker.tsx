'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Circle, AlertCircle, FileCode, Server, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreamEvent } from '@/src/types/streaming';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  subLabel?: string;
  progress?: number;
}

interface GenerationProgressTrackerProps {
  currentStep?: string;
  status: 'idle' | 'initializing' | 'generating' | 'validating' | 'syncing' | 'complete' | 'error' | 'creating_api' | 'creating_folders';
  /** Current file being generated */
  currentFile?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Recent streaming events for detailed status */
  events?: StreamEvent[];
  /** Whether sandbox is syncing */
  isSyncing?: boolean;
  /** Whether server is restarting */
  isServerRestarting?: boolean;
  /** Error message if any */
  errorMessage?: string;
  /** Whether in lightweight API mode */
  isLightweightMode?: boolean;
  /** Folders created in lightweight mode */
  foldersCreated?: string[];
}

/**
 * Visual progress tracker showing the current stage of API generation
 * Displays: Planning → Generating → Validating → Syncing → Complete
 * 
 * Enhanced to support new streaming events:
 * - step:start, step:complete, step:progress
 * - file:generating, file:complete
 * - sandbox:sync:start, sandbox:sync:progress, sandbox:sync:complete
 * - server:restarting, server:ready
 * - preview:updating, preview:ready
 * 
 * Lightweight API mode events:
 * - api:started, api:analyzing, folder:created, api:complete
 * 
 * Requirements: 14.1, 14.2, 14.3
 * Lightweight API Requirements: 5.1, 5.2
 */
export function GenerationProgressTracker({
  currentStep,
  status,
  currentFile,
  progress,
  events = [],
  isSyncing,
  errorMessage,
  isLightweightMode = false,
  foldersCreated = [],
}: GenerationProgressTrackerProps) {
  // Derive detailed status from events
  // Extended to support lightweight API events
  const derivedStatus = useMemo(() => {
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return { subLabel: currentStep, progress };

    switch (lastEvent.type) {
      case 'step:start':
        return { subLabel: lastEvent.message, progress: undefined };
      case 'step:progress':
        return { subLabel: lastEvent.message, progress: lastEvent.progress };
      case 'file:generating':
        return { subLabel: `Generating ${lastEvent.filename}...`, progress: undefined };
      case 'code:chunk':
        return { subLabel: `Writing ${lastEvent.filename}...`, progress: lastEvent.progress };
      case 'file:complete':
        return { subLabel: `Completed ${lastEvent.filename}`, progress: 100 };
      case 'sandbox:sync:start':
        return { subLabel: `Syncing ${lastEvent.fileCount} files...`, progress: 0 };
      case 'sandbox:sync:progress':
        return { subLabel: `Syncing ${lastEvent.currentFile}...`, progress: lastEvent.progress };
      case 'server:restarting':
        return { subLabel: 'Restarting server...', progress: undefined };
      case 'server:ready':
        return { subLabel: 'Server ready', progress: 100 };
      case 'preview:updating':
        return { subLabel: 'Updating preview...', progress: undefined };
      case 'preview:ready':
        return { subLabel: 'Preview ready', progress: 100 };
      case 'validation:start':
        return { subLabel: `Validating: ${lastEvent.stage}`, progress: undefined };
      case 'validation:complete':
        return { subLabel: lastEvent.summary || 'Validation complete', progress: 100 };
      case 'info':
        return { subLabel: lastEvent.message, progress: undefined };
      // Lightweight API events
      // Requirements: 5.1, 5.2
      case 'api:started':
        return { subLabel: lastEvent.message || 'Creating API project...', progress: undefined };
      case 'api:analyzing':
        return { subLabel: lastEvent.message || 'Analyzing API requirements...', progress: undefined };
      case 'folder:created':
        return { subLabel: lastEvent.message || `Created ${lastEvent.path}/`, progress: undefined };
      case 'api:complete':
        return { subLabel: lastEvent.message || 'API project created!', progress: 100 };
      default:
        return { subLabel: currentStep, progress };
    }
  }, [events, currentStep, progress]);

  // Determine if we should show syncing step
  const showSyncingStep = isSyncing || status === 'syncing' || 
    events.some(e => e.type.startsWith('sandbox:sync') || e.type.startsWith('server:') || e.type.startsWith('preview:'));

  // Determine if we're in lightweight API mode based on status or prop
  const isInLightweightMode = isLightweightMode || status === 'creating_api' || status === 'creating_folders' ||
    events.some(e => e.type === 'api:started' || e.type === 'api:analyzing' || e.type === 'folder:created' || e.type === 'api:complete');

  // Build steps based on mode
  // Requirements: 5.1, 5.2 - Show "Creating API project..." instead of "Cloning template..."
  const steps: Step[] = isInLightweightMode ? [
    {
      id: 'creating_api',
      label: 'Creating API',
      status: getLightweightStepStatus('creating_api', status, showSyncingStep),
      subLabel: (status === 'creating_api' || status === 'initializing') ? derivedStatus.subLabel : undefined,
    },
    {
      id: 'creating_folders',
      label: 'Structure',
      status: getLightweightStepStatus('creating_folders', status, showSyncingStep),
      subLabel: status === 'creating_folders' ? (foldersCreated.length > 0 ? `${foldersCreated.length} folders` : derivedStatus.subLabel) : undefined,
      progress: status === 'creating_folders' ? derivedStatus.progress : undefined,
    },
    {
      id: 'generating',
      label: 'Generating',
      status: getLightweightStepStatus('generating', status, showSyncingStep),
      subLabel: status === 'generating' ? (currentFile || derivedStatus.subLabel) : undefined,
      progress: status === 'generating' ? derivedStatus.progress : undefined,
    },
    {
      id: 'complete',
      label: 'Complete',
      status: getLightweightStepStatus('complete', status, showSyncingStep),
    },
  ] : [
    {
      id: 'planning',
      label: 'Planning',
      status: getStepStatus('planning', status, showSyncingStep),
      subLabel: status === 'initializing' ? derivedStatus.subLabel : undefined,
    },
    {
      id: 'generating',
      label: 'Generating',
      status: getStepStatus('generating', status, showSyncingStep),
      subLabel: status === 'generating' ? (currentFile || derivedStatus.subLabel) : undefined,
      progress: status === 'generating' ? derivedStatus.progress : undefined,
    },
    {
      id: 'validating',
      label: 'Validating',
      status: getStepStatus('validating', status, showSyncingStep),
      subLabel: status === 'validating' ? derivedStatus.subLabel : undefined,
    },
    ...(showSyncingStep ? [{
      id: 'syncing',
      label: 'Syncing',
      status: getStepStatus('syncing', status, showSyncingStep),
      subLabel: (status === 'syncing' || isSyncing) ? derivedStatus.subLabel : undefined,
      progress: (status === 'syncing' || isSyncing) ? derivedStatus.progress : undefined,
    }] : []),
    {
      id: 'complete',
      label: 'Complete',
      status: getStepStatus('complete', status, showSyncingStep),
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-secondary" />

        {/* Active progress bar */}
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-primary"
          initial={{ width: '0%' }}
          animate={{ width: `${isInLightweightMode ? getLightweightProgressPercentage(status) : getProgressPercentage(status, showSyncingStep)}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col items-center min-w-0 flex-1">
              {/* Step circle */}
              <motion.div
                className={cn(
                  'w-10 h-10 rounded-full border-2 flex items-center justify-center bg-background relative',
                  step.status === 'complete' && 'border-primary bg-primary text-primary-foreground',
                  step.status === 'in-progress' && 'border-primary',
                  step.status === 'pending' && 'border-secondary',
                  step.status === 'error' && 'border-destructive bg-destructive text-destructive-foreground'
                )}
                initial={{ scale: 0.8 }}
                animate={{ scale: step.status === 'in-progress' ? [0.9, 1.1, 0.9] : 1 }}
                transition={{
                  duration: 1.5,
                  repeat: step.status === 'in-progress' ? Infinity : 0,
                }}
              >
                {step.status === 'complete' && <Check className="h-5 w-5" />}
                {step.status === 'in-progress' && getStepIcon(step.id)}
                {step.status === 'pending' && <Circle className="h-5 w-5" />}
                {step.status === 'error' && <AlertCircle className="h-5 w-5" />}
                
                {/* Progress ring for in-progress steps */}
                {step.status === 'in-progress' && step.progress !== undefined && (
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 40 40"
                  >
                    <circle
                      cx="20"
                      cy="20"
                      r="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${(step.progress / 100) * 113} 113`}
                      className="text-primary/30"
                    />
                  </svg>
                )}
              </motion.div>

              {/* Step label */}
              <div className="mt-2 text-center max-w-[80px] sm:max-w-none">
                <p
                  className={cn(
                    'text-sm font-medium truncate',
                    step.status === 'in-progress' && 'text-primary',
                    step.status === 'complete' && 'text-foreground',
                    step.status === 'pending' && 'text-muted-foreground',
                    step.status === 'error' && 'text-destructive'
                  )}
                >
                  {step.label}
                </p>

                {/* Show sub-step for in-progress */}
                <AnimatePresence mode="wait">
                  {step.status === 'in-progress' && step.subLabel && (
                    <motion.p
                      key={step.subLabel}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="text-xs text-muted-foreground mt-1 truncate max-w-[100px] sm:max-w-[150px]"
                      title={step.subLabel}
                    >
                      {step.subLabel}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Progress percentage */}
                {step.status === 'in-progress' && step.progress !== undefined && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-primary font-mono mt-0.5"
                  >
                    {Math.round(step.progress)}%
                  </motion.p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive text-center"
          >
            {errorMessage}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/**
 * Get the appropriate icon for each step
 * Extended to support lightweight API mode steps
 */
function getStepIcon(stepId: string) {
  switch (stepId) {
    case 'planning':
      return <Loader2 className="h-5 w-5 animate-spin" />;
    case 'generating':
      return <FileCode className="h-5 w-5 animate-pulse" />;
    case 'validating':
      return <Loader2 className="h-5 w-5 animate-spin" />;
    case 'syncing':
      return <Upload className="h-5 w-5 animate-bounce" />;
    case 'complete':
      return <Check className="h-5 w-5" />;
    // Lightweight API mode steps
    case 'creating_api':
      return <Server className="h-5 w-5 animate-pulse" />;
    case 'creating_folders':
      return <Upload className="h-5 w-5 animate-bounce" />;
    default:
      return <Loader2 className="h-5 w-5 animate-spin" />;
  }
}

/**
 * Determine the status of each step based on overall generation status
 */
function getStepStatus(
  stepId: string,
  overallStatus: GenerationProgressTrackerProps['status'],
  hasSyncingStep: boolean = false
): Step['status'] {
  const stepOrder = hasSyncingStep 
    ? ['planning', 'generating', 'validating', 'syncing', 'complete']
    : ['planning', 'generating', 'validating', 'complete'];
  
  const currentIndex = stepOrder.indexOf(
    overallStatus === 'initializing' ? 'planning' : overallStatus
  );
  const stepIndex = stepOrder.indexOf(stepId);

  if (overallStatus === 'error') {
    return stepIndex <= currentIndex ? 'error' : 'pending';
  }

  if (stepIndex < currentIndex) {
    return 'complete';
  } else if (stepIndex === currentIndex) {
    return 'in-progress';
  } else {
    return 'pending';
  }
}

/**
 * Calculate progress percentage based on status
 */
function getProgressPercentage(
  status: GenerationProgressTrackerProps['status'],
  hasSyncingStep: boolean = false
): number {
  if (hasSyncingStep) {
    switch (status) {
      case 'idle':
        return 0;
      case 'initializing':
        return 8;
      case 'generating':
        return 35;
      case 'validating':
        return 60;
      case 'syncing':
        return 85;
      case 'complete':
        return 100;
      case 'error':
        return 100;
      default:
        return 0;
    }
  }
  
  switch (status) {
    case 'idle':
      return 0;
    case 'initializing':
      return 10;
    case 'generating':
      return 50;
    case 'validating':
      return 80;
    case 'complete':
      return 100;
    case 'error':
      return 100;
    default:
      return 0;
  }
}

/**
 * Determine the status of each step for lightweight API mode
 * Requirements: 5.1, 5.2
 */
function getLightweightStepStatus(
  stepId: string,
  overallStatus: GenerationProgressTrackerProps['status'],
  _hasSyncingStep: boolean = false
): Step['status'] {
  const stepOrder = ['creating_api', 'creating_folders', 'generating', 'complete'];
  
  // Map overall status to step order position
  let currentStepId = overallStatus;
  if (overallStatus === 'initializing') {
    currentStepId = 'creating_api';
  }
  
  const currentIndex = stepOrder.indexOf(currentStepId);
  const stepIndex = stepOrder.indexOf(stepId);

  if (overallStatus === 'error') {
    return stepIndex <= currentIndex ? 'error' : 'pending';
  }

  if (stepIndex < currentIndex) {
    return 'complete';
  } else if (stepIndex === currentIndex) {
    return 'in-progress';
  } else {
    return 'pending';
  }
}

/**
 * Calculate progress percentage for lightweight API mode
 * Requirements: 5.1, 5.2
 */
function getLightweightProgressPercentage(
  status: GenerationProgressTrackerProps['status']
): number {
  switch (status) {
    case 'idle':
      return 0;
    case 'initializing':
    case 'creating_api':
      return 15;
    case 'creating_folders':
      return 40;
    case 'generating':
      return 70;
    case 'complete':
      return 100;
    case 'error':
      return 100;
    default:
      return 0;
  }
}


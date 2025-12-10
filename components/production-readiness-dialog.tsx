'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Readiness check result
 */
interface ReadinessCheck {
  name: string;
  passed: boolean;
  message: string;
  remediation?: string;
}

/**
 * Readiness report
 */
interface ReadinessReport {
  isReady: boolean;
  checks: ReadinessCheck[];
  summary: string;
}

interface ProductionReadinessDialogProps {
  projectId: string;
  /** Trigger element to open the dialog */
  trigger?: React.ReactNode;
  /** Callback when check completes */
  onCheckComplete?: (report: ReadinessReport) => void;
}

/**
 * Production Readiness Dialog
 * 
 * Displays production readiness check results with pass/fail status
 * and remediation steps for failing checks.
 * 
 * Requirements: 17.5
 */
export function ProductionReadinessDialog({
  projectId,
  trigger,
  onCheckComplete,
}: ProductionReadinessDialogProps) {
  const [open, setOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [copiedRemediation, setCopiedRemediation] = useState<string | null>(null);

  // Run check when dialog opens
  useEffect(() => {
    if (open && !report && !isChecking) {
      runCheck();
    }
  }, [open]);

  const runCheck = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/readiness-check`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run readiness check');
      }

      const data = await response.json();
      setReport(data.report);
      onCheckComplete?.(data.report);
      
      // Auto-expand failing checks
      const failingChecks = data.report.checks
        .filter((c: ReadinessCheck) => !c.passed)
        .map((c: ReadinessCheck) => c.name);
      setExpandedChecks(new Set(failingChecks));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run check');
    } finally {
      setIsChecking(false);
    }
  };

  const toggleCheck = (name: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const copyRemediation = async (remediation: string, checkName: string) => {
    try {
      await navigator.clipboard.writeText(remediation);
      setCopiedRemediation(checkName);
      setTimeout(() => setCopiedRemediation(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="size-5 text-green-500" />
    ) : (
      <XCircle className="size-5 text-red-500" />
    );
  };

  const passedCount = report?.checks.filter(c => c.passed).length ?? 0;
  const totalCount = report?.checks.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Shield className="size-4 mr-2" />
            Production Readiness
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Production Readiness Check
          </DialogTitle>
          <DialogDescription>
            Verify your project is ready for production deployment.
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Running production readiness checks...</p>
          </div>
        )}

        {/* Error state */}
        {error && !isChecking && (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="size-8 text-destructive mb-4" />
            <p className="text-destructive font-medium mb-2">Check Failed</p>
            <p className="text-muted-foreground text-sm text-center mb-4">{error}</p>
            <Button variant="outline" onClick={runCheck}>
              <RefreshCw className="size-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {/* Results */}
        {report && !isChecking && (
          <>
            {/* Summary banner */}
            <div
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border',
                report.isReady
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              )}
            >
              {report.isReady ? (
                <CheckCircle className="size-6 text-green-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="size-6 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    'font-medium',
                    report.isReady ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {report.isReady ? 'Ready for Production' : 'Not Ready for Production'}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {passedCount} of {totalCount} checks passed
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={runCheck}>
                <RefreshCw className="size-4" />
              </Button>
            </div>

            {/* Checks list */}
            <div className="flex-1 overflow-y-auto space-y-2 py-4 min-h-[200px] max-h-[400px]">
              <AnimatePresence mode="popLayout">
                {report.checks.map((check, index) => (
                  <motion.div
                    key={check.name}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Check header */}
                    <button
                      onClick={() => toggleCheck(check.name)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 text-left transition-colors',
                        'hover:bg-muted/50',
                        expandedChecks.has(check.name) && 'bg-muted/30'
                      )}
                    >
                      {getStatusIcon(check.passed)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{check.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {check.message}
                        </p>
                      </div>
                      <Badge
                        variant={check.passed ? 'default' : 'destructive'}
                        className="flex-shrink-0"
                      >
                        {check.passed ? 'Passed' : 'Failed'}
                      </Badge>
                      {check.remediation && (
                        expandedChecks.has(check.name) ? (
                          <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" />
                        )
                      )}
                    </button>

                    {/* Remediation details */}
                    <AnimatePresence>
                      {expandedChecks.has(check.name) && check.remediation && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 pt-0 border-t bg-muted/20">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-muted-foreground">
                                Remediation Steps:
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => copyRemediation(check.remediation!, check.name)}
                              >
                                {copiedRemediation === check.name ? (
                                  <>
                                    <Check className="size-3 mr-1" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto whitespace-pre-wrap font-mono">
                              {check.remediation}
                            </pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Summary */}
            <div className="text-sm text-muted-foreground border-t pt-4">
              {report.summary}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSandboxManagerProps {
  projectId: string;
  enabled: boolean; // Only run when preview is active
}

interface SandboxState {
  isAlive: boolean;
  isRestarting: boolean;
  lastKeepAlive: number | null;
  error: string | null;
}

/**
 * Custom hook to manage E2B sandbox lifecycle
 * - Keeps sandbox alive while user is viewing the project
 * - Automatically restarts sandbox if it times out
 * - Pings sandbox every 5 minutes to extend lifetime
 */
export function useSandboxManager({ projectId, enabled }: UseSandboxManagerProps) {
  const [state, setState] = useState<SandboxState>({
    isAlive: true,
    isRestarting: false,
    lastKeepAlive: null,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedRestart = useRef(false);

  /**
   * Keep sandbox alive by sending keepAlive request
   */
  const keepAlive = useCallback(async () => {
    if (!enabled || !projectId) return;

    try {
      const response = await fetch(`/api/sandbox/keepalive/${projectId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          isAlive: true,
          lastKeepAlive: Date.now(),
          error: null,
        }));
        console.log(`✅ Sandbox kept alive for project ${projectId}`);
      } else if (data.needsRestart && !hasAttemptedRestart.current) {
        // Sandbox timed out, try to restart it once
        console.log(`⚠️ Sandbox needs restart for project ${projectId}`);
        await restartSandbox();
      }
    } catch (error) {
      console.error('Failed to keep sandbox alive:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to maintain sandbox connection',
      }));
    }
  }, [projectId, enabled]);

  /**
   * Restart sandbox by creating a new one
   */
  const restartSandbox = useCallback(async () => {
    if (!enabled || !projectId || hasAttemptedRestart.current) return;

    hasAttemptedRestart.current = true;
    setState(prev => ({ ...prev, isRestarting: true }));

    try {
      console.log(`🔄 Restarting sandbox for project ${projectId}...`);
      const response = await fetch(`/api/sandbox/restart/${projectId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          isAlive: true,
          isRestarting: false,
          lastKeepAlive: Date.now(),
          error: null,
        }));
        console.log(`✅ Sandbox restarted successfully: ${data.sandboxUrl}`);
        
        // Reload the page to update sandbox URL
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to restart sandbox');
      }
    } catch (error: any) {
      console.error('Failed to restart sandbox:', error);
      setState(prev => ({
        ...prev,
        isRestarting: false,
        error: error.message || 'Failed to restart sandbox',
      }));
      hasAttemptedRestart.current = false; // Allow retry
    }
  }, [projectId, enabled]);

  /**
   * Check and restart sandbox on mount if needed
   */
  useEffect(() => {
    if (!enabled || !projectId) return;

    // Attempt initial keepAlive to check if sandbox is still alive
    keepAlive();

    // Set up interval to keep sandbox alive every 5 minutes
    intervalRef.current = setInterval(() => {
      keepAlive();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [projectId, enabled, keepAlive]);

  /**
   * Manual restart function exposed to components
   */
  const manualRestart = useCallback(async () => {
    hasAttemptedRestart.current = false; // Allow manual restart
    await restartSandbox();
  }, [restartSandbox]);

  return {
    ...state,
    manualRestart,
    keepAlive,
  };
}


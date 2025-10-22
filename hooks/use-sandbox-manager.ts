'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSandboxManagerProps {
  projectId: string;
  enabled: boolean; // Only run when preview is active
  onSandboxRestored?: (newUrl: string) => void; // Callback when sandbox is restored
}

interface SandboxState {
  isAlive: boolean;
  isRestarting: boolean;
  isResuming: boolean; // New: resuming from paused state
  lastKeepAlive: number | null;
  error: string | null;
  restoredUrl?: string; // New sandbox URL after restoration
  resumeMethod?: 'resume' | 'restart'; // How sandbox was restored
}

/**
 * Enhanced E2B sandbox lifecycle manager with automatic restoration
 * 
 * Features:
 * - Auto-checks sandbox on mount (handles page reload)
 * - Keeps sandbox alive while viewing (5min heartbeat)
 * - Auto-restarts expired sandboxes from GitHub repo
 * - Full restoration: clone → install → dev server
 * - No page reload needed
 */
export function useSandboxManager({ projectId, enabled, onSandboxRestored }: UseSandboxManagerProps) {
  const [state, setState] = useState<SandboxState>({
    isAlive: true,
    isRestarting: false,
    isResuming: false,
    lastKeepAlive: null,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAttemptedRestart = useRef(false);
  const isInitialCheck = useRef(true);

  /**
   * Keep sandbox alive by sending keepAlive request
   * If sandbox is not found, automatically triggers restoration
   */
  const keepAlive = useCallback(async () => {
    if (!enabled || !projectId) return { success: false, needsRestart: false };

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
        
        // Only log on subsequent checks, not initial
        if (!isInitialCheck.current) {
          console.log(`✅ Sandbox alive for project ${projectId}`);
        }
        
        return { success: true, needsRestart: false };
      } else if (data.needsRestart) {
        // Sandbox expired - needs restoration
        console.log(`⚠️ Sandbox expired for project ${projectId}, will auto-restore`);
        setState(prev => ({
          ...prev,
          isAlive: false,
        }));
        return { success: false, needsRestart: true };
      }
      
      return { success: false, needsRestart: false };
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to check sandbox status',
      }));
      return { success: false, needsRestart: false };
    }
  }, [projectId, enabled]);

  /**
   * Restart/restore sandbox by creating a new one from GitHub repo
   * Full restoration: creates sandbox, clones repo, installs deps, starts dev server
   * No page reload needed - returns new URL via callback
   */
  const restartSandbox = useCallback(async () => {
    if (!enabled || !projectId || hasAttemptedRestart.current) return;

    hasAttemptedRestart.current = true;
    setState(prev => ({ ...prev, isRestarting: true, error: null }));

    try {
      console.log(`🔄 Restoring sandbox for project ${projectId}...`);
      console.log(`📦 This will clone repo, install dependencies, and start dev server`);
      
      const response = await fetch(`/api/sandbox/restart/${projectId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success && data.sandboxUrl) {
        setState(prev => ({
          ...prev,
          isAlive: true,
          isRestarting: false,
          lastKeepAlive: Date.now(),
          error: null,
          restoredUrl: data.sandboxUrl,
        }));
        
        console.log(`✅ Sandbox restored successfully!`);
        console.log(`   Framework: ${data.framework || 'unknown'}`);
        console.log(`   URL: ${data.sandboxUrl}`);
        
        // Notify parent component of new URL (for iframe update)
        if (onSandboxRestored) {
          onSandboxRestored(data.sandboxUrl);
        }
        
        // Reset restart flag after successful restoration
        setTimeout(() => {
          hasAttemptedRestart.current = false;
        }, 2000);
        
      } else {
        throw new Error(data.error || 'Failed to restore sandbox');
      }
    } catch (error: any) {
      console.error('❌ Sandbox restoration failed:', error);
      setState(prev => ({
        ...prev,
        isRestarting: false,
        error: error.message || 'Failed to restore sandbox. Please try again.',
      }));
      
      // Allow retry after failure
      setTimeout(() => {
        hasAttemptedRestart.current = false;
      }, 5000);
    }
  }, [projectId, enabled, onSandboxRestored]);

  /**
   * Initialize: Check sandbox on mount and auto-restore if needed
   * This handles the case when user reloads the page after sandbox expires
   */
  useEffect(() => {
    if (!enabled || !projectId) return;

    let mounted = true;

    const initializeSandbox = async () => {
      // Check if sandbox is alive
      const status = await keepAlive();
      
      // Mark initial check complete
      isInitialCheck.current = false;
      
      // If sandbox needs restart, auto-restore it
      if (status.needsRestart && mounted) {
        console.log(`🔧 Auto-restoring sandbox on mount for project ${projectId}`);
        await restartSandbox();
      }
    };

    // Run initial check
    initializeSandbox();

    // Set up interval to keep sandbox alive every 5 minutes
    intervalRef.current = setInterval(async () => {
      const status = await keepAlive();
      
      // Auto-restart if sandbox expires during session
      if (status.needsRestart && mounted && !hasAttemptedRestart.current) {
        console.log(`🔧 Auto-restoring expired sandbox for project ${projectId}`);
        await restartSandbox();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [projectId, enabled, keepAlive, restartSandbox]);

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


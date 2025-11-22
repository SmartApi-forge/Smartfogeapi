/**
 * Sandbox Keep-Alive Hook (Cost-Effective)
 * 
 * Only keeps sandbox alive when user is ACTIVELY viewing the project page.
 * When user switches tabs or navigates away, sandbox will auto-stop after 30 minutes,
 * saving costs. When user returns, sandbox automatically restarts.
 * 
 * This approach is similar to v0.dev and Lovable.dev:
 * - Active user = running sandbox = costs incurred
 * - Inactive user = stopped sandbox = no costs
 * 
 * Usage:
 * ```tsx
 * function ProjectPage({ projectId }: { projectId: string }) {
 *   useSandboxKeepAlive(projectId);
 *   // ... rest of component
 * }
 * ```
 */

import { useEffect, useRef, useState } from 'react';

interface KeepAliveOptions {
  enabled?: boolean;        // Enable/disable keep-alive (default: true)
  intervalMs?: number;      // Ping interval when visible (default: 5 minutes)
  onSuccess?: () => void;   // Callback on successful ping
  onError?: (error: Error) => void; // Callback on ping error
  onVisibilityChange?: (visible: boolean) => void; // Callback when page visibility changes
}

export function useSandboxKeepAlive(
  projectId: string | null | undefined,
  options: KeepAliveOptions = {}
) {
  const {
    enabled = true,
    intervalMs = 5 * 60 * 1000, // 5 minutes
    onSuccess,
    onError,
    onVisibilityChange,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Function to send keep-alive ping
  const sendKeepAlive = async () => {
    try {
      const response = await fetch('/api/sandbox/keep-alive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to keep sandbox alive');
      }

      const data = await response.json();
      console.log('💓 Sandbox keep-alive (page visible):', data);
      onSuccess?.();
    } catch (error) {
      console.error('Keep-alive error:', error);
      onError?.(error as Error);
    }
  };

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      onVisibilityChange?.(visible);
      
      if (visible) {
        console.log('👁️ Page visible - keeping sandbox alive');
      } else {
        console.log('👁️ Page hidden - sandbox will auto-stop after 30min to save costs');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisibilityChange]);

  // Keep-alive interval (only when visible)
  useEffect(() => {
    // Don't start keep-alive if disabled, no project ID, or page not visible
    if (!enabled || !projectId || !isVisible) {
      // Clear existing interval if page becomes hidden
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send initial ping immediately when page becomes visible
    sendKeepAlive();

    // Set up interval for periodic pings (only while visible)
    intervalRef.current = setInterval(sendKeepAlive, intervalMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, enabled, intervalMs, isVisible]);

  return { isVisible };
}

/**
 * Manual keep-alive function (can be called from anywhere)
 */
export async function sendSandboxKeepAlive(projectId: string): Promise<void> {
  const response = await fetch('/api/sandbox/keep-alive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to keep sandbox alive');
  }
}

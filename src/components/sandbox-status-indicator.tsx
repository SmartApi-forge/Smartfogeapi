/**
 * Sandbox Status Indicator (Optional)
 * 
 * Shows users the current status of their sandbox:
 * - 🟢 Active (sandbox running, page visible)
 * - 🟡 Inactive (page hidden, will auto-stop soon)
 * - 🔴 Stopped (sandbox stopped, will restart on return)
 * 
 * Usage:
 * ```tsx
 * <SandboxStatusIndicator projectId={projectId} />
 * ```
 */

'use client';

import { useState } from 'react';
import { useSandboxKeepAlive } from '@/hooks/use-sandbox-keep-alive';

interface SandboxStatusIndicatorProps {
  projectId: string;
  showDetails?: boolean; // Show detailed status text
  className?: string;
}

export function SandboxStatusIndicator({
  projectId,
  showDetails = true,
  className = '',
}: SandboxStatusIndicatorProps) {
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const { isVisible } = useSandboxKeepAlive(projectId, {
    onSuccess: () => setLastPing(new Date()),
    onVisibilityChange: (visible) => {
      setStatus(visible ? 'active' : 'inactive');
    },
  });

  const statusConfig = {
    active: {
      icon: '🟢',
      text: 'Sandbox Active',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    inactive: {
      icon: '🟡',
      text: 'Sandbox Pausing',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}
    >
      <span className="text-sm">{config.icon}</span>
      {showDetails && (
        <div className="flex flex-col">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.text}
          </span>
          {lastPing && status === 'active' && (
            <span className="text-[10px] text-gray-500">
              Last ping: {lastPing.toLocaleTimeString()}
            </span>
          )}
          {status === 'inactive' && (
            <span className="text-[10px] text-gray-500">
              Will auto-stop after 30min
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Minimal version - just the status dot
 */
export function SandboxStatusDot({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  useSandboxKeepAlive(projectId, {
    onVisibilityChange: (visible) => {
      setStatus(visible ? 'active' : 'inactive');
    },
  });

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
        }`}
      />
      <span className="text-xs text-gray-600">
        {status === 'active' ? 'Active' : 'Pausing'}
      </span>
    </div>
  );
}

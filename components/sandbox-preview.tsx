'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, RefreshCw, ExternalLink, AlertCircle, Monitor, RotateCw, Eye, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSandboxManager } from '@/hooks/use-sandbox-manager';

interface SandboxPreviewProps {
  sandboxUrl: string;
  projectName?: string;
  projectId?: string;
  hideHeader?: boolean; // If true, don't render the internal header (parent will handle it)
  path?: string; // Path to render in the sandbox
  onRefresh?: () => void; // Callback to refresh
}

/**
 * Sandbox preview component for displaying live preview in an iframe
 * Similar to v0.app's preview functionality
 * Includes automatic sandbox keepAlive and restart capabilities
 */
export function SandboxPreview({ sandboxUrl, projectName, projectId, hideHeader = false, path: externalPath, onRefresh }: SandboxPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0); // For forcing iframe refresh
  const [internalPath, setInternalPath] = useState('/');
  const [currentSandboxUrl, setCurrentSandboxUrl] = useState(sandboxUrl);

  // Use external path if provided, otherwise use internal state
  const path = externalPath !== undefined ? externalPath : internalPath;

  // Handle sandbox restoration - update URL without page reload
  const handleSandboxRestored = useCallback((newUrl: string) => {
    console.log(`🔄 Updating sandbox URL from ${currentSandboxUrl} to ${newUrl}`);
    setCurrentSandboxUrl(newUrl);
    setIsLoading(true);
    setError(false);
    setKey(prev => prev + 1); // Force iframe reload with new URL
  }, [currentSandboxUrl]);

  // Update current URL when prop changes (initial load)
  useEffect(() => {
    if (sandboxUrl && sandboxUrl !== currentSandboxUrl) {
      setCurrentSandboxUrl(sandboxUrl);
    }
  }, [sandboxUrl]);

  // Manage sandbox lifecycle with auto-restoration
  const sandbox = useSandboxManager({
    projectId: projectId || '',
    enabled: !!projectId && !!sandboxUrl,
    onSandboxRestored: handleSandboxRestored,
  });

  const handleRefresh = () => {
    setIsLoading(true);
    setError(false);
    setKey(prev => prev + 1);
    onRefresh?.();
  };

  const handleOpenInNewTab = () => {
    const fullUrl = currentSandboxUrl + (path !== '/' ? path : '');
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newPath = e.target.value;
    // Ensure path starts with /
    if (!newPath.startsWith('/')) {
      newPath = '/' + newPath;
    }
    setInternalPath(newPath);
  };

  const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRefresh();
    }
  };

  const currentUrl = currentSandboxUrl + (path !== '/' ? path : '');

  if (!currentSandboxUrl || currentSandboxUrl === 'undefined') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/30 dark:bg-[#1D1D1D]">
        <div className="text-center space-y-3">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
          <p className="text-sm">Preview not available yet</p>
          <p className="text-xs text-muted-foreground">
            The sandbox is being set up...
          </p>
          {projectId && (
            <button
              onClick={sandbox.manualRestart}
              disabled={sandbox.isRestarting}
              className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {sandbox.isRestarting ? (
                <>
                  <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RotateCw className="inline h-4 w-4 mr-2" />
                  Start Sandbox
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show restoration UI if sandbox is being restored
  if (sandbox.isRestarting) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/30 dark:bg-[#1D1D1D]">
        <div className="text-center space-y-4 max-w-md px-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Restoring sandbox...</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>📦 Cloning repository</p>
              <p>🔧 Installing dependencies</p>
              <p>🚀 Starting dev server</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">
            This may take 30-60 seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30 dark:bg-[#1D1D1D]">
      {/* Preview header with URL bar - only shown if hideHeader is false */}
      {!hideHeader && (
        <div className="bg-muted/30 dark:bg-[#1D1D1D] border-b border-border dark:border-[#333433] px-3 py-2.5 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* URL Bar with controls - v0.app style */}
            <div className="flex items-center gap-1.5 bg-[#f2f2f2] dark:bg-[#0E100F] border border-border dark:border-[#333433] rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
              <Monitor className="h-4 w-4 text-gray-900 dark:text-gray-100 flex-shrink-0" />
              <span className="text-muted-foreground text-xs">/</span>
              <input
                type="text"
                value={path}
                onChange={handlePathChange}
                onKeyDown={handlePathSubmit}
                placeholder="/"
                className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none border-none min-w-0"
                style={{ 
                  border: 'none', 
                  boxShadow: 'none',
                  padding: 0
                }}
              />
              <div className="flex items-center gap-0.5 border-l border-border dark:border-[#333433] pl-1.5 ml-1.5">
                <button
                  onClick={handleRefresh}
                  className="p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                  title="Refresh preview"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                {!sandbox.isAlive && projectId && (
                  <button
                    onClick={sandbox.manualRestart}
                    className="p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors text-yellow-500"
                    title="Restart sandbox"
                    disabled={sandbox.isRestarting}
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${sandbox.isRestarting ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  onClick={handleOpenInNewTab}
                  className="p-1 rounded hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview iframe container */}
      <div className="flex-1 relative bg-white dark:bg-gray-900">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-muted/30 dark:bg-[#1D1D1D] z-10"
          >
            <div className="text-center space-y-3">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 dark:bg-[#1D1D1D] z-10">
            <div className="text-center space-y-3">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <p className="text-sm text-muted-foreground">Failed to load preview</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        <iframe
          key={key}
          src={currentUrl}
          className="w-full h-full border-0"
          title="Sandbox Preview"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb"
          onLoad={() => {
            setIsLoading(false);
            setError(false);
          }}
          onError={() => {
            console.error('Iframe failed to load, sandbox may be expired');
            setIsLoading(false);
            setError(true);
            
            // Trigger immediate sandbox check and potential restoration
            if (projectId && !sandbox.isRestarting) {
              console.log('Triggering sandbox health check due to load error');
              sandbox.keepAlive().then(status => {
                if (status && status.needsRestart) {
                  console.log('Sandbox expired, triggering restoration');
                  sandbox.manualRestart();
                }
              });
            }
          }}
        />
      </div>

      {/* Status bar at bottom */}
      <div className="bg-muted/30 dark:bg-[#1D1D1D] border-t border-border dark:border-[#333433] px-4 py-1 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="truncate">{currentUrl}</span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {!sandbox.isAlive && projectId && (
            <span className="text-yellow-500">● Offline</span>
          )}
          <span className={`flex items-center gap-1 ${error ? 'text-destructive' : isLoading ? 'text-yellow-500' : 'text-green-500'}`}>
            {error ? 'Error' : isLoading ? 'Loading...' : '● Ready'}
          </span>
        </div>
      </div>
    </div>
  );
}


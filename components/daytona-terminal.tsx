'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useDaytonaTerminal } from '@/hooks/use-daytona-terminal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DaytonaTerminalProps {
  sandboxId: string;
  projectId: string;
  workingDirectory?: string;
  className?: string;
}

/**
 * Terminal component using Daytona PTY for sandbox command execution
 * Provides a terminal-like interface with command history and output display
 */
export function DaytonaTerminal({
  sandboxId,
  projectId,
  workingDirectory,
  className,
}: DaytonaTerminalProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    lines,
    isConnected,
    isExecuting,
    executeCommand,
    clear,
    getPreviousCommand,
    getNextCommand,
  } = useDaytonaTerminal({
    sandboxId,
    projectId,
    workingDirectory,
    onError: (error) => {
      console.error('Terminal error:', error);
    },
  });

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isExecuting) {
      executeCommand(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevCommand = getPreviousCommand();
      if (prevCommand !== null) {
        setInputValue(prevCommand);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextCommand = getNextCommand();
      if (nextCommand !== null) {
        setInputValue(nextCommand);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clear();
    }
  };

  const handleClear = () => {
    clear();
    inputRef.current?.focus();
  };

  return (
    <div 
      className={cn(
        'flex flex-col h-full bg-[#0E100F] text-[#E6E6E6] font-mono text-sm border border-[#333433]',
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333433] bg-[#1D1D1D]">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-green-400" />
          <span className="text-xs font-semibold text-gray-300">Terminal</span>
          {isConnected ? (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              <span>Connecting...</span>
            </div>
          )}
        </div>
        <Button
          onClick={handleClear}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-gray-400 hover:text-gray-200 hover:bg-[#2D2D2D]"
          disabled={!isConnected}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Terminal output */}
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        <div className="space-y-0.5">
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                'whitespace-pre-wrap break-words',
                line.type === 'input' && 'text-blue-400 font-semibold',
                line.type === 'error' && 'text-red-400',
                line.type === 'output' && 'text-gray-300'
              )}
            >
              {line.content}
            </div>
          ))}
          {isExecuting && (
            <div className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Terminal input */}
      <form onSubmit={handleSubmit} className="border-t border-[#333433] bg-[#1D1D1D]">
        <div className="flex items-center px-3 py-2">
          <span className="text-green-400 mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? 'Enter command... (↑↓ for history, Ctrl+L to clear)'
                : 'Connecting to sandbox...'
            }
            disabled={!isConnected || isExecuting}
            className={cn(
              'flex-1 bg-transparent outline-none border-none text-gray-200 placeholder-gray-600',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {isExecuting && (
            <Loader2 className="h-4 w-4 animate-spin text-yellow-400 ml-2" />
          )}
        </div>
      </form>

      {/* Terminal tips */}
      {isConnected && lines.length === 4 && (
        <div className="px-3 py-2 text-xs text-gray-500 border-t border-[#333433] bg-[#0E100F]">
          <span className="font-semibold text-gray-400">Tips:</span> Use ↑↓ for history
          • Ctrl+L to clear • Try: <code className="text-blue-400 bg-[#1D1D1D] px-1 py-0.5 rounded">ls</code>, 
          <code className="text-blue-400 bg-[#1D1D1D] px-1 py-0.5 rounded ml-1">npm run dev</code>
        </div>
      )}
    </div>
  );
}

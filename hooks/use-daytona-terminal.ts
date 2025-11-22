'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TerminalLine {
  id: string;
  content: string;
  type: 'input' | 'output' | 'error';
  timestamp: number;
}

export interface DaytonaTerminalOptions {
  sandboxId: string;
  projectId: string;
  workingDirectory?: string;
  onError?: (error: Error) => void;
}

export function useDaytonaTerminal({ 
  sandboxId, 
  projectId,
  workingDirectory = 'workspace/project',
  onError 
}: DaytonaTerminalOptions) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Initialize PTY session
  useEffect(() => {
    if (!sandboxId || !projectId) return;

    const initSession = async () => {
      try {
        const response = await fetch(`/api/sandbox/terminal/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sandboxId, 
            projectId,
            workingDirectory 
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to initialize terminal session');
        }

        const data = await response.json();
        setSessionId(data.sessionId);
        setIsConnected(true);

        // Add welcome message (only once)
        setLines([
          {
            id: 'welcome-1',
            content: `🚀 Connected to sandbox ${sandboxId.substring(0, 8)}...`,
            type: 'output',
            timestamp: Date.now(),
          },
          {
            id: 'welcome-2',
            content: `📂 Working directory: ${workingDirectory}`,
            type: 'output',
            timestamp: Date.now(),
          },
          {
            id: 'welcome-3',
            content: `Type your commands below. Press ↑/↓ for command history.`,
            type: 'output',
            timestamp: Date.now(),
          },
          {
            id: 'welcome-4',
            content: '',
            type: 'output',
            timestamp: Date.now(),
          },
        ]);
      } catch (error) {
        console.error('Terminal init error:', error);
        setIsConnected(false);
        onError?.(error as Error);
        addLine({
          content: `❌ Error: ${(error as Error).message}`,
          type: 'error',
        });
      }
    };

    initSession();

    // Cleanup on unmount
    return () => {
      if (sessionId) {
        fetch(`/api/sandbox/terminal/cleanup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, sandboxId, projectId }),
        }).catch(console.error);
      }
    };
  }, [sandboxId, projectId, workingDirectory]);

  const addLine = useCallback((line: Omit<TerminalLine, 'id' | 'timestamp'>) => {
    setLines(prev => [
      ...prev,
      {
        ...line,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim() || !sessionId || !isConnected) return;

    // Add command to history
    commandHistoryRef.current.push(command);
    historyIndexRef.current = commandHistoryRef.current.length;

    // Show command in terminal
    addLine({
      content: `$ ${command}`,
      type: 'input',
    });

    setIsExecuting(true);

    try {
      const response = await fetch(`/api/sandbox/terminal/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sandboxId,
          projectId,
          command,
          workingDirectory,
        }),
      });

      if (!response.ok) {
        throw new Error('Command execution failed');
      }

      const data = await response.json();

      // Display output
      if (data.stdout) {
        data.stdout.split('\n').forEach((line: string) => {
          addLine({
            content: line,
            type: 'output',
          });
        });
      }

      // Display errors
      if (data.stderr) {
        data.stderr.split('\n').forEach((line: string) => {
          addLine({
            content: line,
            type: 'error',
          });
        });
      }

      // Show exit code if non-zero
      if (data.exitCode !== 0) {
        addLine({
          content: `[Exit code: ${data.exitCode}]`,
          type: 'error',
        });
      }

      // Add empty line for spacing
      addLine({
        content: '',
        type: 'output',
      });
    } catch (error) {
      console.error('Command execution error:', error);
      addLine({
        content: `❌ Error: ${(error as Error).message}`,
        type: 'error',
      });
      onError?.(error as Error);
    } finally {
      setIsExecuting(false);
    }
  }, [sessionId, sandboxId, isConnected, workingDirectory, addLine, onError]);

  const clear = useCallback(() => {
    setLines([]);
    addLine({
      content: '🧹 Terminal cleared',
      type: 'output',
    });
    addLine({
      content: '',
      type: 'output',
    });
  }, [addLine]);

  const getPreviousCommand = useCallback(() => {
    if (commandHistoryRef.current.length === 0) return null;
    
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
    }
    
    return commandHistoryRef.current[historyIndexRef.current];
  }, []);

  const getNextCommand = useCallback(() => {
    if (commandHistoryRef.current.length === 0) return null;
    
    if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
      historyIndexRef.current++;
      return commandHistoryRef.current[historyIndexRef.current];
    }
    
    // Reset to end of history (empty input)
    historyIndexRef.current = commandHistoryRef.current.length;
    return '';
  }, []);

  const getCommandHistory = useCallback(() => {
    return [...commandHistoryRef.current];
  }, []);

  return {
    lines,
    isConnected,
    isExecuting,
    sessionId,
    executeCommand,
    clear,
    getPreviousCommand,
    getNextCommand,
    getCommandHistory,
  };
}

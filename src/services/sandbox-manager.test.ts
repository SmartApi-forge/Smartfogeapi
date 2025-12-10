/**
 * SandboxManager Unit Tests
 * 
 * Tests for the SandboxManager service focusing on:
 * - File sync timing (Requirements: 6.1)
 * - Progress event emission (Requirements: 6.3)
 * 
 * Note: These tests focus on the event emission logic and internal behavior.
 * Integration tests with actual Daytona sandboxes would be in a separate file.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SandboxManager, createSandboxManager } from './sandbox-manager';
import { StreamEvent } from '../types/streaming';

// Mock the daytona-client module
vi.mock('../lib/daytona-client', () => ({
  getWorkspace: vi.fn(),
  ensureSandboxRunning: vi.fn(),
}));

import { ensureSandboxRunning, getWorkspace } from '../lib/daytona-client';

describe('SandboxManager', () => {
  let sandboxManager: SandboxManager;
  let emittedEvents: StreamEvent[];
  let mockSandbox: any;

  beforeEach(() => {
    emittedEvents = [];
    
    // Create sandbox manager with event callback
    sandboxManager = createSandboxManager({
      eventCallback: (event) => {
        emittedEvents.push(event);
      },
      projectId: 'test-project',
    });

    // Create mock sandbox
    mockSandbox = {
      id: 'test-sandbox-id',
      fs: {
        uploadFile: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
      },
      process: {
        executeCommand: vi.fn().mockResolvedValue({ result: '' }),
      },
    };

    // Setup default mock implementations
    vi.mocked(ensureSandboxRunning).mockResolvedValue(mockSandbox);
    vi.mocked(getWorkspace).mockResolvedValue(mockSandbox);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });


  describe('syncFiles', () => {
    /**
     * Test file sync timing - should complete within reasonable time
     * Requirements: 6.1
     */
    it('should sync files and report duration', async () => {
      const files = {
        'src/app.tsx': 'export default function App() { return <div>Hello</div>; }',
        'src/index.ts': 'import App from "./app";',
      };

      const result = await sandboxManager.syncFiles('test-sandbox', files);

      expect(result.success).toBe(true);
      expect(result.syncedFiles).toHaveLength(2);
      expect(result.failedFiles).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test that file sync emits progress events
     * Requirements: 6.3
     */
    it('should emit progress events during file sync', async () => {
      const files = {
        'src/component.tsx': 'export const Component = () => <div />;',
      };

      await sandboxManager.syncFiles('test-sandbox', files);

      // Should emit step:start event
      const startEvent = emittedEvents.find(e => e.type === 'step:start' && (e as any).step === 'file_sync');
      expect(startEvent).toBeDefined();

      // Should emit file:generating event
      const generatingEvent = emittedEvents.find(e => e.type === 'file:generating');
      expect(generatingEvent).toBeDefined();

      // Should emit file:complete event
      const completeEvent = emittedEvents.find(e => e.type === 'file:complete');
      expect(completeEvent).toBeDefined();

      // Should emit step:complete event
      const stepCompleteEvent = emittedEvents.find(e => e.type === 'step:complete' && (e as any).step === 'file_sync');
      expect(stepCompleteEvent).toBeDefined();
    });

    /**
     * Test that failed file syncs are tracked
     */
    it('should track failed file syncs', async () => {
      // Make uploadFile fail for one file
      mockSandbox.fs.uploadFile
        .mockResolvedValueOnce(undefined) // First file succeeds
        .mockRejectedValueOnce(new Error('Upload failed')); // Second file fails

      const files = {
        'src/success.tsx': 'success content',
        'src/fail.tsx': 'fail content',
      };

      const result = await sandboxManager.syncFiles('test-sandbox', files);

      expect(result.success).toBe(false);
      expect(result.syncedFiles).toHaveLength(1);
      expect(result.failedFiles).toHaveLength(1);
    });

    /**
     * Test that sync handles empty file list
     */
    it('should handle empty file list', async () => {
      const result = await sandboxManager.syncFiles('test-sandbox', {});

      expect(result.success).toBe(true);
      expect(result.syncedFiles).toHaveLength(0);
      expect(result.failedFiles).toHaveLength(0);
    });

    /**
     * Test that sync emits error events on failure
     * Requirements: 6.4
     */
    it('should emit error events with recovery suggestions on failure', async () => {
      // Make ensureSandboxRunning fail
      vi.mocked(ensureSandboxRunning).mockRejectedValue(new Error('Connection refused'));

      const files = {
        'src/app.tsx': 'content',
      };

      const result = await sandboxManager.syncFiles('test-sandbox', files);

      expect(result.success).toBe(false);

      // Should emit error event
      const errorEvent = emittedEvents.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent as any).message).toContain('Connection refused');

      // Should emit info event with recovery suggestions
      const infoEvent = emittedEvents.find(e => e.type === 'info' && (e as any).message.includes('Recovery'));
      expect(infoEvent).toBeDefined();
    });
  });


  describe('restartServer', () => {
    /**
     * Test server restart emits progress events
     * Requirements: 6.3
     */
    it('should emit server:restarting event when restarting', async () => {
      // Mock successful command execution
      mockSandbox.process.executeCommand.mockResolvedValue({ result: '' });

      await sandboxManager.restartServer('test-sandbox', {
        clearCache: false,
        waitForReady: false,
        timeout: 30,
      });

      // Should emit server:restarting event
      const restartingEvent = emittedEvents.find(e => e.type === 'server:restarting');
      expect(restartingEvent).toBeDefined();
      expect((restartingEvent as any).message).toContain('Restarting');
    });

    /**
     * Test server restart emits ready event on success
     * Requirements: 6.3
     */
    it('should emit server:ready event on successful restart', async () => {
      mockSandbox.process.executeCommand.mockResolvedValue({ result: '' });

      const result = await sandboxManager.restartServer('test-sandbox', {
        clearCache: false,
        waitForReady: false,
        timeout: 30,
      });

      expect(result.success).toBe(true);

      // Should emit server:ready event
      const readyEvent = emittedEvents.find(e => e.type === 'server:ready');
      expect(readyEvent).toBeDefined();
    });

    /**
     * Test server restart with cache clear
     */
    it('should clear cache when requested', async () => {
      mockSandbox.process.executeCommand.mockResolvedValue({ result: '' });

      await sandboxManager.restartServer('test-sandbox', {
        clearCache: true,
        waitForReady: false,
        timeout: 30,
      });

      // Should have called executeCommand with cache clear command
      const calls = mockSandbox.process.executeCommand.mock.calls;
      const cacheCleanCall = calls.find((call: any) => 
        call[0].command.includes('rm -rf')
      );
      expect(cacheCleanCall).toBeDefined();

      // Should emit info event about cache clear
      const infoEvent = emittedEvents.find(e => 
        e.type === 'info' && (e as any).message.includes('Cache cleared')
      );
      expect(infoEvent).toBeDefined();
    });

    /**
     * Test server restart emits error on failure
     * Requirements: 6.4
     */
    it('should emit error event on restart failure', async () => {
      vi.mocked(ensureSandboxRunning).mockRejectedValue(new Error('Sandbox not found'));

      const result = await sandboxManager.restartServer('test-sandbox', {
        clearCache: false,
        waitForReady: false,
        timeout: 30,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sandbox not found');

      // Should emit error event
      const errorEvent = emittedEvents.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  describe('saveEnvFile', () => {
    /**
     * Test env file save emits progress events
     * Requirements: 16.2
     */
    it('should emit progress events when saving env file', async () => {
      // Mock executeCommand to return project path for find, and 200 for health check
      mockSandbox.process.executeCommand.mockImplementation(({ command }: { command: string }) => {
        if (command.includes('find')) {
          return Promise.resolve({ result: '/home/daytona/project' });
        }
        if (command.includes('curl')) {
          return Promise.resolve({ result: '200' }); // Server is ready
        }
        return Promise.resolve({ result: '' });
      });

      await sandboxManager.saveEnvFile('test-sandbox', 'API_KEY=test123\nDATABASE_URL=postgres://localhost');

      // Should emit step:start event
      const startEvent = emittedEvents.find(e => 
        e.type === 'step:start' && (e as any).step === 'env_update'
      );
      expect(startEvent).toBeDefined();

      // Should emit step:complete event
      const completeEvent = emittedEvents.find(e => 
        e.type === 'step:complete' && (e as any).step === 'env_update'
      );
      expect(completeEvent).toBeDefined();
    }, 10000); // Increase timeout for this test

    /**
     * Test env file save triggers server restart
     * Requirements: 16.2
     */
    it('should restart server after saving env file', async () => {
      mockSandbox.process.executeCommand.mockImplementation(({ command }: { command: string }) => {
        if (command.includes('find')) {
          return Promise.resolve({ result: '/home/daytona/project' });
        }
        if (command.includes('curl')) {
          return Promise.resolve({ result: '200' }); // Server is ready
        }
        return Promise.resolve({ result: '' });
      });

      await sandboxManager.saveEnvFile('test-sandbox', 'API_KEY=test123');

      // Should emit server:restarting event (from restartServer call)
      const restartingEvent = emittedEvents.find(e => e.type === 'server:restarting');
      expect(restartingEvent).toBeDefined();
    }, 10000); // Increase timeout for this test

    /**
     * Test env file save uploads to correct path
     */
    it('should upload env file to project root', async () => {
      mockSandbox.process.executeCommand.mockImplementation(({ command }: { command: string }) => {
        if (command.includes('find')) {
          return Promise.resolve({ result: '/home/daytona/myproject' });
        }
        if (command.includes('curl')) {
          return Promise.resolve({ result: '200' }); // Server is ready
        }
        return Promise.resolve({ result: '' });
      });

      await sandboxManager.saveEnvFile('test-sandbox', 'KEY=value');

      // Should have called uploadFile with .env.local path
      const uploadCall = mockSandbox.fs.uploadFile.mock.calls.find((call: any) =>
        call[1].includes('.env.local')
      );
      expect(uploadCall).toBeDefined();
      expect(uploadCall[1]).toBe('/home/daytona/myproject/.env.local');
    }, 10000); // Increase timeout for this test
  });

  describe('getServerStatus', () => {
    /**
     * Test server status detection
     */
    it('should return running status when server is running', async () => {
      mockSandbox.process.executeCommand.mockResolvedValue({ result: '12345' }); // PID returned

      const status = await sandboxManager.getServerStatus('test-sandbox');

      expect(status.status).toBe('running');
    });

    it('should return stopped status when server is not running', async () => {
      mockSandbox.process.executeCommand.mockResolvedValue({ result: 'stopped' });

      const status = await sandboxManager.getServerStatus('test-sandbox');

      expect(status.status).toBe('stopped');
    });

    it('should return error status on failure', async () => {
      vi.mocked(getWorkspace).mockRejectedValue(new Error('Connection failed'));

      const status = await sandboxManager.getServerStatus('test-sandbox');

      expect(status.status).toBe('error');
      expect(status.error).toContain('Connection failed');
    });
  });

  describe('event callback', () => {
    /**
     * Test that events are emitted through callback
     */
    it('should emit events through the callback', async () => {
      const files = { 'test.ts': 'content' };
      
      await sandboxManager.syncFiles('test-sandbox', files);

      // Should have emitted multiple events
      expect(emittedEvents.length).toBeGreaterThan(0);
    });

    /**
     * Test that manager works without callback
     */
    it('should work without event callback', async () => {
      const managerWithoutCallback = createSandboxManager();
      
      const result = await managerWithoutCallback.syncFiles('test-sandbox', { 'test.ts': 'content' });

      // Should still return result even without callback
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});

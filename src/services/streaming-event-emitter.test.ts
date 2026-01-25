/**
 * StreamingEventEmitter Unit Tests
 * 
 * Tests for the StreamingEventEmitter service.
 * 
 * Requirements: 14.1, 14.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  StreamingEventEmitter, 
  createStreamingEventEmitter,
  GenerationPhase 
} from './streaming-event-emitter';
import { streamingService } from './streaming-service';

// Mock the streaming service
vi.mock('./streaming-service', () => ({
  streamingService: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('StreamingEventEmitter', () => {
  const projectId = 'test-project-123';
  const versionId = 'test-version-456';
  let emitter: StreamingEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = new StreamingEventEmitter(projectId, versionId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Emission Sequence', () => {
    /**
     * Test event emission sequence for a typical generation flow
     * Requirements: 14.1
     */
    it('should emit events in correct sequence for generation flow', async () => {
      const emittedEvents: string[] = [];
      
      // Track emitted event types
      vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
        emittedEvents.push(event.type);
      });

      // Simulate a typical generation flow
      await emitter.emitPhaseStart('planning');
      await emitter.emitPhaseComplete('planning');
      await emitter.emitPhaseStart('generating');
      await emitter.emitFileGenerating('component.tsx', 'src/components/component.tsx');
      await emitter.emitCodeChunk('component.tsx', 'const Component = () => {', 25);
      await emitter.emitCodeChunk('component.tsx', '  return <div>Hello</div>;', 75);
      await emitter.emitFileComplete('component.tsx', 'const Component = () => {\n  return <div>Hello</div>;\n};', 'src/components/component.tsx');
      await emitter.emitPhaseComplete('generating');
      await emitter.emitPhaseStart('validating');
      await emitter.emitValidationStart('syntax');
      await emitter.emitValidationComplete('syntax', true, 'No syntax errors');
      await emitter.emitPhaseComplete('validating');
      await emitter.emitComplete({
        summary: 'Generated 1 file',
        totalFiles: 1,
      });

      // Verify sequence
      expect(emittedEvents).toEqual([
        'step:start',      // planning
        'step:complete',   // planning
        'step:start',      // generating
        'file:generating',
        'code:chunk',
        'code:chunk',
        'file:complete',
        'step:complete',   // generating
        'step:start',      // validating
        'validation:start',
        'validation:complete',
        'step:complete',   // validating
        'complete',
      ]);
    });

    /**
     * Test that all phases emit correct step names
     * Requirements: 14.1
     */
    it('should emit correct step names for all phases', async () => {
      const phases: GenerationPhase[] = ['planning', 'generating', 'validating', 'applying', 'syncing', 'restarting'];
      const expectedSteps = ['Planning', 'Generating', 'Validating', 'Applying', 'Syncing', 'Restarting'];

      for (let i = 0; i < phases.length; i++) {
        await emitter.emitPhaseStart(phases[i]);
        
        const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
        expect(lastCall[1]).toMatchObject({
          type: 'step:start',
          step: expectedSteps[i],
        });
      }
    });
  });

  describe('Error Event Content', () => {
    /**
     * Test error event with detailed message
     * Requirements: 14.6
     */
    it('should emit error event with detailed message', async () => {
      await emitter.emitError({
        message: 'Failed to generate code',
        stage: 'generating',
      });

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Failed to generate code'),
          stage: 'generating',
          versionId,
        })
      );
    });

    /**
     * Test error event with recovery suggestions
     * Requirements: 14.6
     */
    it('should include recovery suggestions in error message', async () => {
      await emitter.emitError({
        message: 'Syntax error in generated code',
        recoverySteps: [
          'Check for missing brackets',
          'Verify import statements',
        ],
      });

      const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      const errorMessage = lastCall[1].message;
      
      expect(errorMessage).toContain('Syntax error in generated code');
      expect(errorMessage).toContain('Suggested recovery steps');
      expect(errorMessage).toContain('1. Check for missing brackets');
      expect(errorMessage).toContain('2. Verify import statements');
    });

    /**
     * Test error event infers recovery steps from error code
     * Requirements: 14.6
     */
    it('should infer recovery steps from error code', async () => {
      await emitter.emitError({
        message: 'Import failed',
        errorCode: 'import_error',
      });

      const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      const errorMessage = lastCall[1].message;
      
      expect(errorMessage).toContain('Verify the package is installed');
    });

    /**
     * Test error event infers recovery steps from message content
     * Requirements: 14.6
     */
    it('should infer recovery steps from message content', async () => {
      await emitter.emitError({
        message: 'Timeout while generating code',
      });

      const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      const errorMessage = lastCall[1].message;
      
      expect(errorMessage).toContain('Try simplifying your request');
    });

    /**
     * Test error event uses current phase as stage if not provided
     */
    it('should use current phase as stage if not provided', async () => {
      await emitter.emitPhaseStart('validating');
      await emitter.emitError({
        message: 'Validation failed',
      });

      const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].stage).toBe('validating');
    });
  });

  describe('Completion Event', () => {
    /**
     * Test complete event with summary and version ID
     * Requirements: 14.5
     */
    it('should emit complete event with summary and version ID', async () => {
      await emitter.emitComplete({
        summary: 'Successfully generated 3 files',
        totalFiles: 3,
        sandboxUrl: 'https://sandbox.example.com',
      });

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'complete',
          summary: 'Successfully generated 3 files',
          totalFiles: 3,
          versionId,
          sandboxUrl: 'https://sandbox.example.com',
        })
      );
    });

    /**
     * Test complete event can override version ID
     */
    it('should allow overriding version ID in complete event', async () => {
      const customVersionId = 'custom-version-789';
      
      await emitter.emitComplete({
        summary: 'Done',
        totalFiles: 1,
        versionId: customVersionId,
      });

      const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].versionId).toBe(customVersionId);
    });
  });

  describe('File Progress Tracking', () => {
    /**
     * Test file progress tracking
     */
    it('should track file progress correctly', async () => {
      const filePath = 'src/components/test.tsx';
      
      await emitter.emitFileGenerating('test.tsx', filePath);
      expect(emitter.getFileProgress(filePath)).toBe(0);
      
      await emitter.emitFileComplete('test.tsx', 'content', filePath);
      expect(emitter.getFileProgress(filePath)).toBe(100);
    });

    /**
     * Test overall progress calculation
     */
    it('should calculate overall progress correctly', async () => {
      await emitter.emitFileGenerating('file1.tsx', 'src/file1.tsx');
      await emitter.emitFileComplete('file1.tsx', 'content1', 'src/file1.tsx');
      await emitter.emitFileGenerating('file2.tsx', 'src/file2.tsx');
      
      // 1 file at 100%, 1 file at 0% = 50% overall
      expect(emitter.calculateOverallProgress(2)).toBe(50);
    });
  });

  describe('Code Chunk Events', () => {
    /**
     * Test code chunk progress clamping
     * Requirements: 14.2
     */
    it('should clamp progress to 0-100 range', async () => {
      await emitter.emitCodeChunk('test.tsx', 'code', -10);
      let lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].progress).toBe(0);

      await emitter.emitCodeChunk('test.tsx', 'code', 150);
      lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].progress).toBe(100);
    });
  });

  describe('Version ID Management', () => {
    /**
     * Test setting version ID after construction
     */
    it('should allow setting version ID after construction', async () => {
      const emitterWithoutVersion = new StreamingEventEmitter(projectId);
      const newVersionId = 'new-version-123';
      
      emitterWithoutVersion.setVersionId(newVersionId);
      await emitterWithoutVersion.emitPhaseStart('planning');

      const lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].versionId).toBe(newVersionId);
    });
  });

  describe('Factory Function', () => {
    /**
     * Test factory function creates emitter correctly
     */
    it('should create emitter with factory function', async () => {
      const factoryEmitter = createStreamingEventEmitter(projectId, versionId);
      
      await factoryEmitter.emitPhaseStart('planning');
      
      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          versionId,
        })
      );
    });
  });

  describe('Info and Warning Events', () => {
    /**
     * Test info event emission
     */
    it('should emit info events', async () => {
      await emitter.emitInfo('Auto-fixed missing import');

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'info',
          message: 'Auto-fixed missing import',
          versionId,
        })
      );
    });

    /**
     * Test warning event emission
     */
    it('should emit warning events', async () => {
      await emitter.emitWarning('Component may not be linked');

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'warning',
          message: 'Component may not be linked',
          versionId,
        })
      );
    });
  });

  describe('Server Events', () => {
    /**
     * Test server restarting event
     */
    it('should emit server restarting event', async () => {
      await emitter.emitServerRestarting('Restarting dev server...');

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'server:restarting',
          message: 'Restarting dev server...',
          versionId,
        })
      );
    });

    /**
     * Test server ready event
     */
    it('should emit server ready event with preview URL', async () => {
      await emitter.emitServerReady('Server is ready', 'https://preview.example.com');

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'server:ready',
          message: 'Server is ready',
          previewUrl: 'https://preview.example.com',
          versionId,
        })
      );
    });
  });

  describe('Step Progress Events', () => {
    /**
     * Test step progress event
     */
    it('should emit step progress events', async () => {
      await emitter.emitStepProgress('Generating', 50, 'Processing files...');

      expect(streamingService.emit).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          type: 'step:progress',
          step: 'Generating',
          progress: 50,
          message: 'Processing files...',
          versionId,
        })
      );
    });

    /**
     * Test step progress clamping
     */
    it('should clamp step progress to 0-100 range', async () => {
      await emitter.emitStepProgress('Generating', -5);
      let lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].progress).toBe(0);

      await emitter.emitStepProgress('Generating', 200);
      lastCall = vi.mocked(streamingService.emit).mock.calls.slice(-1)[0];
      expect(lastCall[1].progress).toBe(100);
    });
  });

  describe('Sandbox Sync Events', () => {
    /**
     * Test sandbox sync start event
     * Requirements: 6.1, 14.1
     */
    it('should emit sandbox sync start event', async () => {
      // Mock the streamingService methods for sandbox sync
      vi.mocked(streamingService).emitSandboxSyncStart = vi.fn().mockResolvedValue(undefined);
      
      await emitter.emitSandboxSyncStart(5);

      expect(streamingService.emitSandboxSyncStart).toHaveBeenCalledWith(
        projectId,
        5,
        versionId
      );
    });

    /**
     * Test sandbox sync progress event
     * Requirements: 6.1
     */
    it('should emit sandbox sync progress event', async () => {
      vi.mocked(streamingService).emitSandboxSyncProgress = vi.fn().mockResolvedValue(undefined);
      
      await emitter.emitSandboxSyncProgress(2, 5, 'src/components/Button.tsx');

      expect(streamingService.emitSandboxSyncProgress).toHaveBeenCalledWith(
        projectId,
        2,
        5,
        'src/components/Button.tsx',
        versionId
      );
    });

    /**
     * Test sandbox sync complete event
     * Requirements: 6.1
     */
    it('should emit sandbox sync complete event', async () => {
      vi.mocked(streamingService).emitSandboxSyncComplete = vi.fn().mockResolvedValue(undefined);
      
      const syncedFiles = ['src/file1.tsx', 'src/file2.tsx'];
      const failedFiles: string[] = [];
      const duration = 1500;

      await emitter.emitSandboxSyncComplete(syncedFiles, failedFiles, duration);

      expect(streamingService.emitSandboxSyncComplete).toHaveBeenCalledWith(
        projectId,
        syncedFiles,
        failedFiles,
        duration,
        versionId
      );
    });

    /**
     * Test sandbox sync error event with recovery suggestions
     * Requirements: 6.4
     */
    it('should emit sandbox sync error event with recovery suggestions', async () => {
      vi.mocked(streamingService).emitSandboxSyncError = vi.fn().mockResolvedValue(undefined);
      
      const failedFiles = ['src/broken.tsx'];
      const recoverySuggestions = [
        'Try syncing fewer files at once',
        'Check if the sandbox is still running',
      ];

      await emitter.emitSandboxSyncError(
        'File sync failed: Connection timeout',
        failedFiles,
        recoverySuggestions
      );

      expect(streamingService.emitSandboxSyncError).toHaveBeenCalledWith(
        projectId,
        'File sync failed: Connection timeout',
        failedFiles,
        recoverySuggestions,
        versionId
      );
    });
  });

  describe('Preview Events', () => {
    /**
     * Test preview updating event
     * Requirements: 6.3
     */
    it('should emit preview updating event', async () => {
      vi.mocked(streamingService).emitPreviewUpdating = vi.fn().mockResolvedValue(undefined);
      
      await emitter.emitPreviewUpdating('Restarting server to apply configuration changes...');

      expect(streamingService.emitPreviewUpdating).toHaveBeenCalledWith(
        projectId,
        'Restarting server to apply configuration changes...',
        versionId
      );
    });

    /**
     * Test preview ready event
     * Requirements: 6.3
     */
    it('should emit preview ready event', async () => {
      vi.mocked(streamingService).emitPreviewReady = vi.fn().mockResolvedValue(undefined);
      
      await emitter.emitPreviewReady(
        'https://sandbox-123.preview.example.com',
        'Preview updated and ready!'
      );

      expect(streamingService.emitPreviewReady).toHaveBeenCalledWith(
        projectId,
        'https://sandbox-123.preview.example.com',
        'Preview updated and ready!',
        versionId
      );
    });
  });

  describe('Sandbox Sync Integration', () => {
    /**
     * Test sync files to sandbox method
     * Requirements: 6.1, 6.2
     */
    it('should call syncFilesWithProgress on streaming service', async () => {
      const mockSyncResult = {
        success: true,
        syncedFiles: ['src/file1.tsx', 'src/file2.tsx'],
        failedFiles: [],
        duration: 1200,
      };
      
      vi.mocked(streamingService).syncFilesWithProgress = vi.fn().mockResolvedValue(mockSyncResult);
      
      const files = {
        'src/file1.tsx': 'content1',
        'src/file2.tsx': 'content2',
      };

      const result = await emitter.syncFilesToSandbox(files);

      expect(streamingService.syncFilesWithProgress).toHaveBeenCalledWith(
        projectId,
        files,
        versionId
      );
      expect(result).toEqual(mockSyncResult);
    });

    /**
     * Test sync and restart sandbox method
     * Requirements: 6.1, 6.2, 6.3
     */
    it('should call syncAndRestartWithProgress on streaming service', async () => {
      const mockResult = {
        syncResult: {
          success: true,
          syncedFiles: ['src/file1.tsx'],
          failedFiles: [],
          duration: 1000,
        },
        restartResult: {
          success: true,
          duration: 5000,
        },
        previewUrl: 'https://sandbox-123.preview.example.com',
      };
      
      vi.mocked(streamingService).syncAndRestartWithProgress = vi.fn().mockResolvedValue(mockResult);
      
      const files = {
        '.env.local': 'API_KEY=test123',
      };

      const result = await emitter.syncAndRestartSandbox(files);

      expect(streamingService.syncAndRestartWithProgress).toHaveBeenCalledWith(
        projectId,
        files,
        versionId
      );
      expect(result).toEqual(mockResult);
    });
  });
});

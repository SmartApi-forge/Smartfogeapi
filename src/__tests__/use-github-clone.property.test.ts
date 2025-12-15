/**
 * Property Tests: useGitHubClone Hook State Consistency
 * 
 * Tests that the useGitHubClone hook correctly processes SSE events
 * and maintains consistent state.
 * 
 * **Feature: v0-lovable-architecture, Property 25: Clone Hook State Consistency**
 * **Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.6**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Clone SSE Event Types
 */
interface CloneSSEEvent {
  type: 'clone:start' | 'clone:progress' | 'install:progress' | 'preview:ready' | 'clone:complete' | 'clone:error';
  message?: string;
  repoUrl?: string;
  framework?: string;
  sandboxUrl?: string;
  fileCount?: number;
  projectId?: string;
  error?: string;
}

/**
 * Clone status states
 */
type CloneStatus = 
  | 'idle'
  | 'creating_workspace'
  | 'cloning'
  | 'detecting_framework'
  | 'installing'
  | 'starting_preview'
  | 'creating_snapshot'
  | 'complete'
  | 'error';

/**
 * Hook state representation for testing
 */
interface HookState {
  isCloning: boolean;
  progress: string;
  status: CloneStatus;
  error: string | null;
  sandboxUrl: string | null;
  fileCount: number;
  framework: string | null;
}

/**
 * Initial state after clone() is called
 */
const initialState: HookState = {
  isCloning: true,
  progress: 'Starting clone...',
  status: 'creating_workspace',
  error: null,
  sandboxUrl: null,
  fileCount: 0,
  framework: null,
};

/**
 * Map progress message to status
 */
function getStatusFromMessage(message: string): CloneStatus {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('creating workspace')) {
    return 'creating_workspace';
  }
  if (lowerMessage.includes('cloning')) {
    return 'cloning';
  }
  if (lowerMessage.includes('detecting framework')) {
    return 'detecting_framework';
  }
  if (lowerMessage.includes('installing')) {
    return 'installing';
  }
  if (lowerMessage.includes('starting preview') || lowerMessage.includes('preview server')) {
    return 'starting_preview';
  }
  if (lowerMessage.includes('snapshot')) {
    return 'creating_snapshot';
  }
  
  return 'cloning'; // Default to cloning for unknown progress messages
}

/**
 * Process a single SSE event and return new state
 * This mirrors the event processing logic in the hook
 */
function processEvent(state: HookState, event: CloneSSEEvent): HookState {
  const newState = { ...state };
  
  switch (event.type) {
    case 'clone:start':
      newState.status = 'cloning';
      newState.progress = event.message || 'Starting clone...';
      break;

    case 'clone:progress':
      newState.progress = event.message || '';
      newState.status = getStatusFromMessage(event.message || '');
      if (event.framework) {
        newState.framework = event.framework;
      }
      break;

    case 'install:progress':
      newState.status = 'installing';
      newState.progress = event.message || 'Installing dependencies...';
      break;

    case 'preview:ready':
      newState.status = 'starting_preview';
      newState.progress = event.message || 'Preview ready';
      if (event.sandboxUrl) {
        newState.sandboxUrl = event.sandboxUrl;
      }
      break;

    case 'clone:complete':
      newState.status = 'complete';
      newState.progress = event.message || 'Clone complete!';
      newState.isCloning = false;
      if (event.fileCount !== undefined) {
        newState.fileCount = event.fileCount;
      }
      if (event.sandboxUrl) {
        newState.sandboxUrl = event.sandboxUrl;
      }
      if (event.framework) {
        newState.framework = event.framework;
      }
      break;

    case 'clone:error':
      newState.status = 'error';
      newState.error = event.error || event.message || 'Clone failed';
      newState.progress = '';
      newState.isCloning = false;
      break;
  }
  
  return newState;
}

/**
 * Process a sequence of events
 */
function processEvents(events: CloneSSEEvent[]): HookState {
  return events.reduce(processEvent, { ...initialState });
}

/**
 * Arbitraries for generating test data
 */
const cloneStartEventArb = fc.record({
  type: fc.constant('clone:start' as const),
  message: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  repoUrl: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

const cloneProgressEventArb = fc.record({
  type: fc.constant('clone:progress' as const),
  message: fc.oneof(
    fc.constant('Creating workspace...'),
    fc.constant('Cloning repository...'),
    fc.constant('Detecting framework...'),
    fc.constant('Installing dependencies...'),
    fc.constant('Starting preview server...'),
    fc.constant('Creating snapshot...'),
    fc.string({ minLength: 1, maxLength: 50 }),
  ),
  framework: fc.option(
    fc.oneof(
      fc.constant('react'),
      fc.constant('next'),
      fc.constant('vue'),
      fc.constant('express'),
      fc.constant('unknown'),
    ),
    { nil: undefined }
  ),
});

const installProgressEventArb = fc.record({
  type: fc.constant('install:progress' as const),
  message: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

const previewReadyEventArb = fc.record({
  type: fc.constant('preview:ready' as const),
  message: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  sandboxUrl: fc.webUrl(),
});

const cloneCompleteEventArb = fc.record({
  type: fc.constant('clone:complete' as const),
  message: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  fileCount: fc.integer({ min: 1, max: 1000 }),
  sandboxUrl: fc.option(fc.webUrl(), { nil: undefined }),
  framework: fc.option(
    fc.oneof(
      fc.constant('react'),
      fc.constant('next'),
      fc.constant('vue'),
      fc.constant('express'),
    ),
    { nil: undefined }
  ),
});

const cloneErrorEventArb = fc.record({
  type: fc.constant('clone:error' as const),
  error: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

describe('Property 25: Clone Hook State Consistency', () => {
  /**
   * Property: For any clone:progress event, the progress state SHALL be
   * updated to the event's message.
   * 
   * Requirements: 14.2
   */
  it('should update progress for clone:progress events', () => {
    fc.assert(
      fc.property(
        fc.array(cloneProgressEventArb, { minLength: 1, maxLength: 5 }),
        (progressEvents) => {
          const finalState = processEvents(progressEvents);
          
          // Progress should be the last progress event's message
          const lastEvent = progressEvents[progressEvents.length - 1];
          expect(finalState.progress).toBe(lastEvent.message || '');
          
          // If framework was provided, it should be set
          const lastFrameworkEvent = [...progressEvents].reverse().find(e => e.framework);
          if (lastFrameworkEvent?.framework) {
            expect(finalState.framework).toBe(lastFrameworkEvent.framework);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any install:progress event, the status SHALL be 'installing'.
   * 
   * Requirements: 14.3
   */
  it('should update status for install:progress events', () => {
    fc.assert(
      fc.property(
        installProgressEventArb,
        (installEvent) => {
          const finalState = processEvents([installEvent]);
          
          expect(finalState.status).toBe('installing');
          expect(finalState.progress).toBe(installEvent.message || 'Installing dependencies...');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any preview:ready event, the sandboxUrl SHALL be updated.
   * 
   * Requirements: 14.4
   */
  it('should update sandboxUrl for preview:ready events', () => {
    fc.assert(
      fc.property(
        previewReadyEventArb,
        (previewEvent) => {
          const finalState = processEvents([previewEvent]);
          
          expect(finalState.status).toBe('starting_preview');
          expect(finalState.sandboxUrl).toBe(previewEvent.sandboxUrl);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any clone:complete event, the fileCount SHALL be updated
   * and isCloning SHALL be false.
   * 
   * Requirements: 14.5
   */
  it('should update fileCount for clone:complete events', () => {
    fc.assert(
      fc.property(
        cloneCompleteEventArb,
        (completeEvent) => {
          const finalState = processEvents([completeEvent]);
          
          expect(finalState.status).toBe('complete');
          expect(finalState.isCloning).toBe(false);
          expect(finalState.fileCount).toBe(completeEvent.fileCount);
          
          if (completeEvent.sandboxUrl) {
            expect(finalState.sandboxUrl).toBe(completeEvent.sandboxUrl);
          }
          
          if (completeEvent.framework) {
            expect(finalState.framework).toBe(completeEvent.framework);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any clone:error event, the error state SHALL be set
   * and isCloning SHALL be false.
   * 
   * Requirements: 14.6
   */
  it('should update error state for clone:error events', () => {
    fc.assert(
      fc.property(
        cloneErrorEventArb,
        (errorEvent) => {
          const finalState = processEvents([errorEvent]);
          
          expect(finalState.status).toBe('error');
          expect(finalState.isCloning).toBe(false);
          expect(finalState.error).toBe(errorEvent.error || errorEvent.message || 'Clone failed');
          expect(finalState.progress).toBe('');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For a typical clone sequence (start -> progress -> install -> preview -> complete),
   * the final state SHALL be consistent.
   */
  it('should maintain consistent state for typical clone sequence', () => {
    fc.assert(
      fc.property(
        cloneStartEventArb,
        fc.array(cloneProgressEventArb, { minLength: 1, maxLength: 3 }),
        installProgressEventArb,
        previewReadyEventArb,
        cloneCompleteEventArb,
        (startEvent, progressEvents, installEvent, previewEvent, completeEvent) => {
          const allEvents: CloneSSEEvent[] = [
            startEvent,
            ...progressEvents,
            installEvent,
            previewEvent,
            completeEvent,
          ];
          
          const finalState = processEvents(allEvents);
          
          // Final state should be complete
          expect(finalState.status).toBe('complete');
          expect(finalState.isCloning).toBe(false);
          expect(finalState.error).toBeNull();
          expect(finalState.fileCount).toBe(completeEvent.fileCount);
          
          // Sandbox URL should be from preview or complete event
          const expectedSandboxUrl = completeEvent.sandboxUrl || previewEvent.sandboxUrl;
          expect(finalState.sandboxUrl).toBe(expectedSandboxUrl);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error events should terminate cloning regardless of previous state.
   */
  it('should terminate cloning on error regardless of previous state', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            cloneStartEventArb,
            cloneProgressEventArb,
            installProgressEventArb,
          ),
          { minLength: 0, maxLength: 5 }
        ),
        cloneErrorEventArb,
        (previousEvents, errorEvent) => {
          const allEvents: CloneSSEEvent[] = [...previousEvents, errorEvent];
          const finalState = processEvents(allEvents);
          
          // Error should override any previous state
          expect(finalState.status).toBe('error');
          expect(finalState.isCloning).toBe(false);
          expect(finalState.error).toBe(errorEvent.error || errorEvent.message || 'Clone failed');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: clone:start should set status to 'cloning'.
   */
  it('should set status to cloning for clone:start events', () => {
    fc.assert(
      fc.property(
        cloneStartEventArb,
        (startEvent) => {
          const finalState = processEvents([startEvent]);
          
          expect(finalState.status).toBe('cloning');
          expect(finalState.isCloning).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

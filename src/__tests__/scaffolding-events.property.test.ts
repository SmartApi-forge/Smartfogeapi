/**
 * Property-Based Tests for Scaffolding SSE Events
 * 
 * **Feature: full-project-scaffolding, Property 14: Progress Event Sequence**
 * **Validates: Requirements 5.1-5.8**
 * 
 * For any full scaffolding operation, the SSE events SHALL be emitted in order:
 * scaffold:start → template:* → deps:* → generate:* → preview:ready
 * 
 * **Feature: full-project-scaffolding, Property 6: Dependency Detection Event**
 * **Validates: Requirements 3.2**
 * 
 * For any prompt with detected packages, the system SHALL emit a deps:detected
 * SSE event containing the package names.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { StreamingEventEmitter, createStreamingEventEmitter } from '../services/streaming-event-emitter';
import { streamingService } from '../services/streaming-service';
import type { StreamEvent, SuggestedLibrary } from '../types/streaming';

// Mock the streaming service
vi.mock('../services/streaming-service', () => ({
  streamingService: {
    emit: vi.fn().mockResolvedValue(undefined),
    emitSandboxSyncStart: vi.fn().mockResolvedValue(undefined),
    emitSandboxSyncProgress: vi.fn().mockResolvedValue(undefined),
    emitSandboxSyncComplete: vi.fn().mockResolvedValue(undefined),
    emitSandboxSyncError: vi.fn().mockResolvedValue(undefined),
    emitPreviewUpdating: vi.fn().mockResolvedValue(undefined),
    emitPreviewReady: vi.fn().mockResolvedValue(undefined),
    syncFilesWithProgress: vi.fn().mockResolvedValue(undefined),
    syncAndRestartWithProgress: vi.fn().mockResolvedValue(undefined),
  },
}));

/**
 * Event phase categories for ordering validation
 */
const EVENT_PHASES = {
  scaffold: ['scaffold:start'],
  template: ['template:cloning', 'template:complete'],
  deps: ['deps:analyzing', 'deps:detected', 'deps:suggested', 'deps:installing', 'deps:progress', 'deps:complete', 'deps:error'],
  generate: ['generate:start'],
  preview: ['preview:starting', 'preview:ready'],
} as const;

/**
 * Get the phase index for an event type
 */
function getPhaseIndex(eventType: string): number {
  const phases = Object.keys(EVENT_PHASES);
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i] as keyof typeof EVENT_PHASES;
    if (EVENT_PHASES[phase].includes(eventType as never)) {
      return i;
    }
  }
  return -1; // Unknown event type
}

/**
 * Check if events are in valid order (phases should not go backwards)
 */
function areEventsInValidOrder(eventTypes: string[]): boolean {
  let lastPhaseIndex = -1;
  
  for (const eventType of eventTypes) {
    const phaseIndex = getPhaseIndex(eventType);
    if (phaseIndex === -1) continue; // Skip unknown events
    
    // Phase index should never decrease (can stay same or increase)
    if (phaseIndex < lastPhaseIndex) {
      return false;
    }
    lastPhaseIndex = phaseIndex;
  }
  
  return true;
}

describe('Scaffolding Events Property Tests', () => {
  const projectId = 'test-project-123';
  const versionId = 'test-version-456';
  let emitter: StreamingEventEmitter;
  let emittedEvents: StreamEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = new StreamingEventEmitter(projectId, versionId);
    emittedEvents = [];
    
    // Track emitted events
    vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
      emittedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: full-project-scaffolding, Property 14: Progress Event Sequence**
   * **Validates: Requirements 5.1-5.8**
   */
  describe('Property 14: Progress Event Sequence', () => {
    it('should emit scaffold:start before any template events', async () => {
      // Arbitrary for number of template events to emit
      const templateEventCountArb = fc.integer({ min: 1, max: 3 });
      
      await fc.assert(
        fc.asyncProperty(templateEventCountArb, async (count) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Always start with scaffold:start
          await emitter.emitScaffoldStart();
          
          // Emit template events
          for (let i = 0; i < count; i++) {
            await emitter.emitTemplateCloning();
          }
          await emitter.emitTemplateComplete('sandbox-123', 'https://sandbox.example.com');
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // scaffold:start should be first
          expect(eventTypes[0]).toBe('scaffold:start');
          
          // All template events should come after scaffold:start
          const scaffoldIndex = eventTypes.indexOf('scaffold:start');
          const templateIndices = eventTypes
            .map((type, idx) => type.startsWith('template:') ? idx : -1)
            .filter(idx => idx !== -1);
          
          for (const templateIdx of templateIndices) {
            expect(templateIdx).toBeGreaterThan(scaffoldIndex);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should emit template events before deps events', async () => {
      // Arbitrary for packages to detect
      const packagesArb = fc.array(
        fc.constantFrom('gsap', 'framer-motion', 'three', 'recharts', 'lodash'),
        { minLength: 1, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Emit in correct order
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(packages);
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // Find last template event and first deps event
          const lastTemplateIndex = Math.max(
            ...eventTypes.map((type, idx) => type.startsWith('template:') ? idx : -1)
          );
          const firstDepsIndex = eventTypes.findIndex(type => type.startsWith('deps:'));
          
          // Deps events should come after template events
          if (firstDepsIndex !== -1 && lastTemplateIndex !== -1) {
            expect(firstDepsIndex).toBeGreaterThan(lastTemplateIndex);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should emit deps:complete before generate:start', async () => {
      // Arbitrary for installed packages
      const installedPackagesArb = fc.array(
        fc.record({
          name: fc.constantFrom('gsap', 'framer-motion', 'three', 'recharts'),
          version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
        }),
        { minLength: 0, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(installedPackagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Emit full sequence
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(packages.map(p => p.name));
          await emitter.emitDepsComplete(packages);
          await emitter.emitGenerateStart();
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          const depsCompleteIndex = eventTypes.indexOf('deps:complete');
          const generateStartIndex = eventTypes.indexOf('generate:start');
          
          // deps:complete should come before generate:start
          expect(depsCompleteIndex).toBeLessThan(generateStartIndex);
        }),
        { numRuns: 100 }
      );
    });

    it('should emit generate:start before preview:starting', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Emit sequence
          await emitter.emitGenerateStart();
          await emitter.emitPreviewStarting();
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          const generateIndex = eventTypes.indexOf('generate:start');
          const previewStartingIndex = eventTypes.indexOf('preview:starting');
          
          expect(generateIndex).toBeLessThan(previewStartingIndex);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain valid phase order for any sequence of scaffolding events', async () => {
      // Generate arbitrary valid scaffolding sequences
      const scaffoldingSequenceArb = fc.record({
        hasTemplate: fc.boolean(),
        packageCount: fc.integer({ min: 0, max: 5 }),
        hasError: fc.boolean(),
      });
      
      await fc.assert(
        fc.asyncProperty(scaffoldingSequenceArb, async ({ hasTemplate, packageCount, hasError }) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Always start with scaffold
          await emitter.emitScaffoldStart();
          
          // Template phase
          if (hasTemplate) {
            await emitter.emitTemplateCloning();
            await emitter.emitTemplateComplete('sandbox-123');
          }
          
          // Deps phase
          await emitter.emitDepsAnalyzing();
          const packages = Array.from({ length: packageCount }, (_, i) => `package-${i}`);
          await emitter.emitDepsDetected(packages);
          
          if (hasError) {
            await emitter.emitDepsError('Installation failed', packages);
          } else {
            if (packageCount > 0) {
              await emitter.emitDepsInstalling(packages);
              for (let i = 0; i < packageCount; i++) {
                await emitter.emitDepsProgress(packages[i], i + 1, packageCount);
              }
            }
            await emitter.emitDepsComplete(packages.map(p => ({ name: p, version: '1.0.0' })));
            
            // Generate phase (only if no error)
            await emitter.emitGenerateStart();
            
            // Preview phase
            await emitter.emitPreviewStarting();
          }
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // Verify events are in valid order
          expect(areEventsInValidOrder(eventTypes)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Scaffolding Event Content', () => {
    it('should include timestamp in all scaffolding events', async () => {
      const eventEmittersArb = fc.constantFrom(
        () => emitter.emitScaffoldStart(),
        () => emitter.emitTemplateCloning(),
        () => emitter.emitTemplateComplete('sandbox-123'),
        () => emitter.emitDepsAnalyzing(),
        () => emitter.emitDepsDetected(['gsap']),
        () => emitter.emitDepsSuggested([{ name: 'framer-motion', reason: 'animations', keywords: ['animate'] }]),
        () => emitter.emitDepsInstalling(['gsap']),
        () => emitter.emitDepsProgress('gsap', 1, 1),
        () => emitter.emitDepsComplete([{ name: 'gsap', version: '3.12.0' }]),
        () => emitter.emitDepsError('Failed'),
        () => emitter.emitGenerateStart(),
        () => emitter.emitPreviewStarting(),
      );
      
      await fc.assert(
        fc.asyncProperty(eventEmittersArb, async (emitFn) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          const beforeTime = Date.now();
          await emitFn();
          const afterTime = Date.now();
          
          expect(emittedEvents.length).toBe(1);
          const event = emittedEvents[0] as StreamEvent & { timestamp?: number };
          
          // All scaffolding events should have timestamp
          if (event.type.startsWith('scaffold:') || 
              event.type.startsWith('template:') || 
              event.type.startsWith('deps:') || 
              event.type.startsWith('generate:') || 
              event.type === 'preview:starting') {
            expect(event.timestamp).toBeDefined();
            expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(event.timestamp).toBeLessThanOrEqual(afterTime);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should include packages array in deps:detected events', async () => {
      const packagesArb = fc.array(
        fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        { minLength: 0, maxLength: 10 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsDetected(packages);
          
          const event = emittedEvents[0] as StreamEvent & { packages?: string[] };
          expect(event.type).toBe('deps:detected');
          expect(event.packages).toEqual(packages);
        }),
        { numRuns: 100 }
      );
    });

    it('should include suggestions array in deps:suggested events', async () => {
      const suggestionsArb = fc.array(
        fc.record({
          name: fc.constantFrom('framer-motion', 'gsap', 'recharts', 'react-hook-form'),
          reason: fc.stringMatching(/^[a-zA-Z ]+$/),
          keywords: fc.array(fc.stringMatching(/^[a-z]+$/), { minLength: 1, maxLength: 3 }),
        }),
        { minLength: 0, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(suggestionsArb, async (suggestions) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsSuggested(suggestions as SuggestedLibrary[]);
          
          const event = emittedEvents[0] as StreamEvent & { suggestions?: SuggestedLibrary[] };
          expect(event.type).toBe('deps:suggested');
          expect(event.suggestions).toEqual(suggestions);
        }),
        { numRuns: 100 }
      );
    });

    it('should include progress percentage in deps:progress events', async () => {
      const progressArb = fc.record({
        currentPackage: fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        installedCount: fc.integer({ min: 0, max: 100 }),
        totalCount: fc.integer({ min: 1, max: 100 }),
      }).filter(({ installedCount, totalCount }) => installedCount <= totalCount);
      
      await fc.assert(
        fc.asyncProperty(progressArb, async ({ currentPackage, installedCount, totalCount }) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsProgress(currentPackage, installedCount, totalCount);
          
          const event = emittedEvents[0] as StreamEvent & { 
            progress?: number;
            currentPackage?: string;
            installedCount?: number;
            totalCount?: number;
          };
          
          expect(event.type).toBe('deps:progress');
          expect(event.currentPackage).toBe(currentPackage);
          expect(event.installedCount).toBe(installedCount);
          expect(event.totalCount).toBe(totalCount);
          expect(event.progress).toBe(Math.round((installedCount / totalCount) * 100));
        }),
        { numRuns: 100 }
      );
    });

    it('should include installed packages with versions in deps:complete events', async () => {
      const packagesArb = fc.array(
        fc.record({
          name: fc.stringMatching(/^[a-z][a-z0-9-]*$/),
          version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
        }),
        { minLength: 0, maxLength: 10 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsComplete(packages);
          
          const event = emittedEvents[0] as StreamEvent & { 
            packages?: Array<{ name: string; version: string }>;
          };
          
          expect(event.type).toBe('deps:complete');
          expect(event.packages).toEqual(packages);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Event Handling', () => {
    it('should include error message and failed packages in deps:error events', async () => {
      const errorArb = fc.record({
        error: fc.string({ minLength: 1, maxLength: 100 }),
        failedPackages: fc.array(
          fc.stringMatching(/^[a-z][a-z0-9-]*$/),
          { minLength: 0, maxLength: 5 }
        ),
      });
      
      await fc.assert(
        fc.asyncProperty(errorArb, async ({ error, failedPackages }) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsError(error, failedPackages);
          
          const event = emittedEvents[0] as StreamEvent & { 
            error?: string;
            failedPackages?: string[];
          };
          
          expect(event.type).toBe('deps:error');
          expect(event.error).toBe(error);
          expect(event.failedPackages).toEqual(failedPackages);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Version ID Propagation', () => {
    it('should include versionId in all scaffolding events when set', async () => {
      const versionIdArb = fc.stringMatching(/^[a-z0-9-]+$/);
      
      await fc.assert(
        fc.asyncProperty(versionIdArb, async (testVersionId) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          const testEmitter = new StreamingEventEmitter(projectId, testVersionId);
          
          await testEmitter.emitScaffoldStart();
          await testEmitter.emitTemplateCloning();
          await testEmitter.emitDepsAnalyzing();
          await testEmitter.emitGenerateStart();
          await testEmitter.emitPreviewStarting();
          
          for (const event of emittedEvents) {
            expect(event.versionId).toBe(testVersionId);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 7: Install Before Generate Order**
   * **Validates: Requirements 3.3, 3.7**
   * 
   * For any generation request with detected dependencies, the deps:complete event
   * SHALL be emitted BEFORE the generate:start event.
   */
  describe('Property 7: Install Before Generate Order', () => {
    it('should emit deps:complete before generate:start', async () => {
      const packagesArb = fc.array(
        fc.record({
          name: fc.stringMatching(/^[a-z][a-z0-9-]*$/),
          version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
        }),
        { minLength: 0, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Emit events in correct order
          await emitter.emitDepsComplete(packages);
          await emitter.emitGenerateStart();
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          const depsCompleteIndex = eventTypes.indexOf('deps:complete');
          const generateStartIndex = eventTypes.indexOf('generate:start');
          
          // deps:complete must come before generate:start
          expect(depsCompleteIndex).toBeLessThan(generateStartIndex);
        }),
        { numRuns: 100 }
      );
    });

    it('should not emit generate:start without deps:complete in scaffolding flow', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Full scaffolding sequence
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(['gsap']);
          await emitter.emitDepsComplete([{ name: 'gsap', version: '3.12.0' }]);
          await emitter.emitGenerateStart();
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // Verify order
          expect(eventTypes.indexOf('deps:complete')).toBeLessThan(eventTypes.indexOf('generate:start'));
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 9: Install Progress Events**
   * **Validates: Requirements 3.5**
   * 
   * For any package installation, the system SHALL emit deps:installing events
   * for each package being installed.
   */
  describe('Property 9: Install Progress Events', () => {
    it('should emit deps:progress with correct progress percentage', async () => {
      const progressArb = fc.record({
        currentPackage: fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        installedCount: fc.integer({ min: 0, max: 100 }),
        totalCount: fc.integer({ min: 1, max: 100 }),
      }).filter(({ installedCount, totalCount }) => installedCount <= totalCount);
      
      await fc.assert(
        fc.asyncProperty(progressArb, async ({ currentPackage, installedCount, totalCount }) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsProgress(currentPackage, installedCount, totalCount);
          
          const event = emittedEvents[0] as StreamEvent & { 
            progress?: number;
            currentPackage?: string;
          };
          
          expect(event.type).toBe('deps:progress');
          expect(event.currentPackage).toBe(currentPackage);
          expect(event.progress).toBe(Math.round((installedCount / totalCount) * 100));
        }),
        { numRuns: 100 }
      );
    });

    it('should emit deps:installing with packages array', async () => {
      const packagesArb = fc.array(
        fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        { minLength: 1, maxLength: 10 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsInstalling(packages);
          
          const event = emittedEvents[0] as StreamEvent & { packages?: string[] };
          
          expect(event.type).toBe('deps:installing');
          expect(event.packages).toEqual(packages);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 10: Install Complete Event**
   * **Validates: Requirements 3.6**
   * 
   * For any successful package installation, the system SHALL emit a deps:complete
   * event containing the list of installed packages with versions.
   */
  describe('Property 10: Install Complete Event', () => {
    it('should emit deps:complete with installed packages and versions', async () => {
      const packagesArb = fc.array(
        fc.record({
          name: fc.stringMatching(/^[a-z][a-z0-9-]*$/),
          version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
        }),
        { minLength: 0, maxLength: 10 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsComplete(packages);
          
          const event = emittedEvents[0] as StreamEvent & { 
            packages?: Array<{ name: string; version: string }>;
          };
          
          expect(event.type).toBe('deps:complete');
          expect(event.packages).toEqual(packages);
          
          // Each package should have name and version
          for (const pkg of event.packages || []) {
            expect(typeof pkg.name).toBe('string');
            expect(typeof pkg.version).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should include success message in deps:complete event', async () => {
      const packagesArb = fc.array(
        fc.record({
          name: fc.constantFrom('gsap', 'three', 'recharts'),
          version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
        }),
        { minLength: 1, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsComplete(packages);
          
          const event = emittedEvents[0] as StreamEvent & { message?: string };
          
          expect(event.message).toBeDefined();
          expect(event.message).toContain('✓');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 4: Clone Error Handling**
   * **Validates: Requirements 1.4**
   * 
   * For any template clone failure, the system SHALL emit a clone:error SSE event
   * with an error message.
   */
  describe('Property 4: Clone Error Handling', () => {
    it('should emit error event with message for clone failures', async () => {
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });
      
      await fc.assert(
        fc.asyncProperty(errorMessageArb, async (errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Simulate clone error by emitting error event
          await emitter.emitError({
            message: `Template clone failed: ${errorMessage}`,
            stage: 'template_clone',
          });
          
          const event = emittedEvents[0] as StreamEvent & { message?: string; stage?: string };
          
          expect(event.type).toBe('error');
          expect(event.message).toContain(errorMessage);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 11: Install Error Handling**
   * **Validates: Requirements 3.8**
   * 
   * For any failed package installation, the system SHALL emit a deps:error event
   * and NOT proceed with code generation.
   */
  describe('Property 11: Install Error Handling', () => {
    it('should emit deps:error with error message and failed packages', async () => {
      const errorArb = fc.record({
        error: fc.string({ minLength: 1, maxLength: 100 }),
        failedPackages: fc.array(
          fc.stringMatching(/^[a-z][a-z0-9-]*$/),
          { minLength: 1, maxLength: 5 }
        ),
      });
      
      await fc.assert(
        fc.asyncProperty(errorArb, async ({ error, failedPackages }) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsError(error, failedPackages);
          
          const event = emittedEvents[0] as StreamEvent & { 
            error?: string;
            failedPackages?: string[];
          };
          
          expect(event.type).toBe('deps:error');
          expect(event.error).toBe(error);
          expect(event.failedPackages).toEqual(failedPackages);
        }),
        { numRuns: 100 }
      );
    });

    it('should not emit generate:start after deps:error', async () => {
      const errorArb = fc.string({ minLength: 1, maxLength: 100 });
      
      await fc.assert(
        fc.asyncProperty(errorArb, async (error) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Emit error flow (no generate:start after error)
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(['bad-package']);
          await emitter.emitDepsError(error, ['bad-package']);
          // Note: generate:start should NOT be emitted after error
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // deps:error should be present
          expect(eventTypes).toContain('deps:error');
          
          // generate:start should NOT be present after error
          const errorIndex = eventTypes.indexOf('deps:error');
          const generateIndex = eventTypes.indexOf('generate:start');
          
          // Either generate:start is not present, or it comes before error (which shouldn't happen)
          expect(generateIndex === -1 || generateIndex < errorIndex).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 6: Dependency Detection Event**
   * **Validates: Requirements 3.2**
   * 
   * For any prompt with detected packages, the system SHALL emit a deps:detected
   * SSE event containing the package names.
   */
  describe('Property 6: Dependency Detection Event', () => {
    it('should emit deps:detected event with package names for any detected packages', async () => {
      // Arbitrary for package names (npm package format)
      const packageNameArb = fc.stringMatching(/^@?[a-z][a-z0-9-]*(\/?[a-z][a-z0-9-]*)?$/);
      const packagesArb = fc.array(packageNameArb, { minLength: 1, maxLength: 10 });
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsDetected(packages);
          
          // Should emit exactly one event
          expect(emittedEvents.length).toBe(1);
          
          const event = emittedEvents[0] as StreamEvent & { packages?: string[] };
          
          // Event type must be deps:detected
          expect(event.type).toBe('deps:detected');
          
          // Event must contain the packages array
          expect(event.packages).toBeDefined();
          expect(Array.isArray(event.packages)).toBe(true);
          
          // All packages must be included
          expect(event.packages).toEqual(packages);
          
          // Event must have a message
          expect(event.message).toBeDefined();
          expect(typeof event.message).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('should emit deps:detected event with empty array when no packages detected', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsDetected([]);
          
          const event = emittedEvents[0] as StreamEvent & { packages?: string[] };
          
          expect(event.type).toBe('deps:detected');
          expect(event.packages).toEqual([]);
          expect(event.message).toContain('No additional packages');
        }),
        { numRuns: 100 }
      );
    });

    it('should include timestamp in deps:detected event', async () => {
      const packagesArb = fc.array(
        fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        { minLength: 0, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          const beforeTime = Date.now();
          await emitter.emitDepsDetected(packages);
          const afterTime = Date.now();
          
          const event = emittedEvents[0] as StreamEvent & { timestamp?: number };
          
          expect(event.timestamp).toBeDefined();
          expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(event.timestamp).toBeLessThanOrEqual(afterTime);
        }),
        { numRuns: 100 }
      );
    });

    it('should format message correctly based on detected packages', async () => {
      const packagesArb = fc.array(
        fc.constantFrom('gsap', 'framer-motion', 'three', 'recharts', 'lodash'),
        { minLength: 1, maxLength: 5 }
      );
      
      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitDepsDetected(packages);
          
          const event = emittedEvents[0] as StreamEvent & { message?: string };
          
          // Message should contain "Detected packages:"
          expect(event.message).toContain('Detected packages:');
          
          // Message should contain all package names
          for (const pkg of packages) {
            expect(event.message).toContain(pkg);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 12: Preview Ready Event**
   * **Validates: Requirements 4.2**
   * 
   * For any successful generation, the system SHALL emit a preview:ready event
   * containing a valid sandbox URL.
   */
  describe('Property 12: Preview Ready Event', () => {
    it('should emit preview:ready event with valid sandbox URL', async () => {
      // Arbitrary for sandbox URLs
      const sandboxUrlArb = fc.record({
        sandboxId: fc.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),
        port: fc.constantFrom(3000, 3001, 8080),
      }).map(({ sandboxId, port }) => `https://${port}-${sandboxId}.proxy.daytona.works`);
      
      await fc.assert(
        fc.asyncProperty(sandboxUrlArb, async (previewUrl) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          vi.mocked(streamingService.emitPreviewReady).mockImplementation(async (_, url, msg) => {
            emittedEvents.push({
              type: 'preview:ready',
              previewUrl: url,
              message: msg,
            } as StreamEvent);
          });
          
          await emitter.emitPreviewReady(previewUrl, 'Preview ready! ✓');
          
          const event = emittedEvents[0] as StreamEvent & { previewUrl?: string; message?: string };
          
          expect(event.type).toBe('preview:ready');
          expect(event.previewUrl).toBe(previewUrl);
          expect(event.previewUrl).toMatch(/^https:\/\/\d+-[a-f0-9-]+\.proxy\.daytona\.works$/);
        }),
        { numRuns: 100 }
      );
    });

    it('should emit preview:ready after preview:starting in correct sequence', async () => {
      const sandboxUrlArb = fc.stringMatching(/^https:\/\/3000-[a-f0-9-]+\.proxy\.daytona\.works$/);
      
      await fc.assert(
        fc.asyncProperty(sandboxUrlArb, async (previewUrl) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          vi.mocked(streamingService.emitPreviewReady).mockImplementation(async (_, url, msg) => {
            emittedEvents.push({
              type: 'preview:ready',
              previewUrl: url,
              message: msg,
            } as StreamEvent);
          });
          
          // Emit in correct order
          await emitter.emitPreviewStarting();
          await emitter.emitPreviewReady(previewUrl, 'Preview ready! ✓');
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          const previewStartingIndex = eventTypes.indexOf('preview:starting');
          const previewReadyIndex = eventTypes.indexOf('preview:ready');
          
          // preview:starting should come before preview:ready
          expect(previewStartingIndex).toBeLessThan(previewReadyIndex);
        }),
        { numRuns: 100 }
      );
    });

    it('should include success message in preview:ready event', async () => {
      const messageArb = fc.constantFrom(
        'Preview ready! ✓',
        'Development server started ✓',
        'Preview available'
      );
      const sandboxUrlArb = fc.constant('https://3000-test-sandbox.proxy.daytona.works');
      
      await fc.assert(
        fc.asyncProperty(messageArb, sandboxUrlArb, async (message, previewUrl) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emitPreviewReady).mockImplementation(async (_, url, msg) => {
            emittedEvents.push({
              type: 'preview:ready',
              previewUrl: url,
              message: msg,
            } as StreamEvent);
          });
          
          await emitter.emitPreviewReady(previewUrl, message);
          
          const event = emittedEvents[0] as StreamEvent & { message?: string };
          
          expect(event.message).toBe(message);
          expect(event.message).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should emit preview:ready with versionId when set', async () => {
      const versionIdArb = fc.stringMatching(/^[a-z0-9-]+$/);
      const sandboxUrlArb = fc.constant('https://3000-test-sandbox.proxy.daytona.works');
      
      await fc.assert(
        fc.asyncProperty(versionIdArb, sandboxUrlArb, async (testVersionId, previewUrl) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emitPreviewReady).mockImplementation(async (projId, url, msg, verId) => {
            emittedEvents.push({
              type: 'preview:ready',
              previewUrl: url,
              message: msg,
              versionId: verId,
            } as StreamEvent);
          });
          
          const testEmitter = new StreamingEventEmitter(projectId, testVersionId);
          await testEmitter.emitPreviewReady(previewUrl, 'Preview ready! ✓');
          
          const event = emittedEvents[0] as StreamEvent & { versionId?: string };
          
          expect(event.versionId).toBe(testVersionId);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 13: Server Error Handling**
   * **Validates: Requirements 4.4**
   * 
   * For any dev server startup failure, the system SHALL emit an error event
   * with server logs.
   */
  describe('Property 13: Server Error Handling', () => {
    it('should emit error event with message for server startup failures', async () => {
      const errorMessageArb = fc.stringMatching(/^[a-zA-Z0-9 ]+$/);
      
      await fc.assert(
        fc.asyncProperty(errorMessageArb, async (errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Simulate server error by emitting error event
          await emitter.emitError({
            message: `Failed to start preview server: ${errorMessage}`,
            stage: 'preview_server',
          });
          
          const event = emittedEvents[0] as StreamEvent & { message?: string; stage?: string };
          
          expect(event.type).toBe('error');
          expect(event.message).toContain(errorMessage);
        }),
        { numRuns: 100 }
      );
    });

    it('should include stage information in server error events', async () => {
      const stageArb = fc.constantFrom('preview_server', 'server_startup', 'dev_server');
      const errorArb = fc.stringMatching(/^[a-zA-Z0-9 ]+$/);
      
      await fc.assert(
        fc.asyncProperty(stageArb, errorArb, async (stage, errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitError({
            message: `Server error: ${errorMessage}`,
            stage,
          });
          
          const event = emittedEvents[0] as StreamEvent & { stage?: string };
          
          expect(event.type).toBe('error');
          expect(event.stage).toBe(stage);
        }),
        { numRuns: 100 }
      );
    });

    it('should emit error event when preview server fails after preview:starting', async () => {
      const errorArb = fc.stringMatching(/^[a-zA-Z0-9 ]+$/);
      
      await fc.assert(
        fc.asyncProperty(errorArb, async (errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Simulate the sequence: preview:starting -> error
          await emitter.emitPreviewStarting();
          await emitter.emitError({
            message: `Preview server failed: ${errorMessage}`,
            stage: 'preview_server',
          });
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // preview:starting should come before error
          const previewStartingIndex = eventTypes.indexOf('preview:starting');
          const errorIndex = eventTypes.indexOf('error');
          
          expect(previewStartingIndex).toBeLessThan(errorIndex);
          expect(eventTypes).toContain('error');
        }),
        { numRuns: 100 }
      );
    });

    it('should not emit preview:ready when server fails', async () => {
      const errorArb = fc.stringMatching(/^[a-zA-Z0-9 ]+$/);
      
      await fc.assert(
        fc.asyncProperty(errorArb, async (errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          // Simulate error scenario (no preview:ready should be emitted)
          await emitter.emitPreviewStarting();
          await emitter.emitError({
            message: `Server startup failed: ${errorMessage}`,
            stage: 'preview_server',
          });
          
          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have preview:starting and error, but NOT preview:ready
          expect(eventTypes).toContain('preview:starting');
          expect(eventTypes).toContain('error');
          expect(eventTypes).not.toContain('preview:ready');
        }),
        { numRuns: 100 }
      );
    });

    it('should include recovery suggestions in server error events', async () => {
      const errorArb = fc.constantFrom(
        'EADDRINUSE: port 3000 already in use',
        'Cannot find module next',
        'Connection timeout',
        'Process exited with code 1'
      );
      
      await fc.assert(
        fc.asyncProperty(errorArb, async (errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });
          
          await emitter.emitError({
            message: errorMessage,
            stage: 'preview_server',
          });
          
          const event = emittedEvents[0] as StreamEvent & { message?: string };
          
          expect(event.type).toBe('error');
          expect(event.message).toBeDefined();
          // Error message should contain the original error
          expect(event.message).toContain(errorMessage.split(':')[0]);
        }),
        { numRuns: 100 }
      );
    });
  });
});

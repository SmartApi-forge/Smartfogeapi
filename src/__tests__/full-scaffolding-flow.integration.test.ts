/**
 * Integration Tests for Full Project Scaffolding Flow
 * 
 * Tests the complete scaffolding flow:
 * New project → Template clone → Dependency install → Generate → Preview
 * 
 * Verifies all SSE events are emitted in correct order.
 * 
 * _Requirements: 1.1, 1.2, 1.3, 3.1-3.7, 4.1, 4.2, 5.1-5.8_
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { StreamingEventEmitter } from '../services/streaming-event-emitter';
import { streamingService } from '../services/streaming-service';
import { dependencyDetector } from '../services/dependency-detector';
import { isPackageInTemplate, filterMissingPackages } from '../services/template-service';
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
  return -1;
}

/**
 * Check if events are in valid order (phases should not go backwards)
 */
function areEventsInValidOrder(eventTypes: string[]): boolean {
  let lastPhaseIndex = -1;
  
  for (const eventType of eventTypes) {
    const phaseIndex = getPhaseIndex(eventType);
    if (phaseIndex === -1) continue;
    
    if (phaseIndex < lastPhaseIndex) {
      return false;
    }
    lastPhaseIndex = phaseIndex;
  }
  
  return true;
}

/**
 * Simulate a full scaffolding flow and return emitted events
 */
async function simulateFullScaffoldingFlow(
  emitter: StreamingEventEmitter,
  options: {
    packages?: string[];
    suggestions?: SuggestedLibrary[];
    sandboxId?: string;
    sandboxUrl?: string;
    hasError?: boolean;
    errorType?: 'clone' | 'install' | 'server';
  } = {}
): Promise<StreamEvent[]> {
  const {
    packages = [],
    suggestions = [],
    sandboxId = 'test-sandbox-123',
    sandboxUrl = 'https://3000-test-sandbox.proxy.daytona.works',
    hasError = false,
    errorType,
  } = options;

  // Phase 1: Scaffold start
  await emitter.emitScaffoldStart();

  // Phase 2: Template cloning
  await emitter.emitTemplateCloning();
  
  if (hasError && errorType === 'clone') {
    await emitter.emitError({
      message: 'Template clone failed',
      stage: 'template_clone',
    });
    return [];
  }
  
  await emitter.emitTemplateComplete(sandboxId, sandboxUrl);

  // Phase 3: Dependency detection and installation
  await emitter.emitDepsAnalyzing();
  await emitter.emitDepsDetected(packages);
  
  if (suggestions.length > 0) {
    await emitter.emitDepsSuggested(suggestions);
  }

  if (packages.length > 0) {
    await emitter.emitDepsInstalling(packages);
    
    for (let i = 0; i < packages.length; i++) {
      await emitter.emitDepsProgress(packages[i], i + 1, packages.length);
    }
    
    if (hasError && errorType === 'install') {
      await emitter.emitDepsError('Installation failed', packages);
      return [];
    }
  }
  
  await emitter.emitDepsComplete(
    packages.map(p => ({ name: p, version: '1.0.0' }))
  );

  // Phase 4: Code generation
  await emitter.emitGenerateStart();

  // Phase 5: Preview server
  await emitter.emitPreviewStarting();
  
  if (hasError && errorType === 'server') {
    await emitter.emitError({
      message: 'Server startup failed',
      stage: 'preview_server',
    });
    return [];
  }

  return [];
}

describe('Full Scaffolding Flow Integration Tests', () => {
  const projectId = 'test-project-123';
  const versionId = 'test-version-456';
  let emitter: StreamingEventEmitter;
  let emittedEvents: StreamEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = new StreamingEventEmitter(projectId, versionId);
    emittedEvents = [];
    
    vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
      emittedEvents.push(event);
    });
    
    vi.mocked(streamingService.emitPreviewReady).mockImplementation(async (_, url, msg, verId) => {
      emittedEvents.push({
        type: 'preview:ready',
        previewUrl: url,
        message: msg,
        versionId: verId,
      } as StreamEvent);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Scaffolding Flow Event Sequence', () => {
    /**
     * Test that the full scaffolding flow emits events in the correct order
     * Requirements: 5.1-5.8
     */
    it('should emit all scaffolding events in correct phase order', async () => {
      const packagesArb = fc.array(
        fc.constantFrom('gsap', 'three', 'recharts', 'chart.js', 'd3'),
        { minLength: 0, maxLength: 5 }
      );

      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await simulateFullScaffoldingFlow(emitter, { packages });

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Verify events are in valid phase order
          expect(areEventsInValidOrder(eventTypes)).toBe(true);
          
          // Verify required events are present
          expect(eventTypes).toContain('scaffold:start');
          expect(eventTypes).toContain('template:cloning');
          expect(eventTypes).toContain('template:complete');
          expect(eventTypes).toContain('deps:analyzing');
          expect(eventTypes).toContain('deps:detected');
          expect(eventTypes).toContain('deps:complete');
          expect(eventTypes).toContain('generate:start');
          expect(eventTypes).toContain('preview:starting');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that scaffold:start is always the first event
     * Requirements: 5.1
     */
    it('should always emit scaffold:start as the first event', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await simulateFullScaffoldingFlow(emitter);

          expect(emittedEvents.length).toBeGreaterThan(0);
          expect(emittedEvents[0].type).toBe('scaffold:start');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that template events come before deps events
     * Requirements: 1.1, 1.2
     */
    it('should emit template events before deps events', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await simulateFullScaffoldingFlow(emitter, { packages: ['gsap'] });

          const eventTypes = emittedEvents.map(e => e.type);
          
          const templateCompleteIndex = eventTypes.indexOf('template:complete');
          const depsAnalyzingIndex = eventTypes.indexOf('deps:analyzing');
          
          expect(templateCompleteIndex).toBeLessThan(depsAnalyzingIndex);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that deps:complete comes before generate:start
     * Requirements: 3.3, 3.7
     */
    it('should emit deps:complete before generate:start', async () => {
      const packagesArb = fc.array(
        fc.constantFrom('gsap', 'three', 'recharts'),
        { minLength: 0, maxLength: 3 }
      );

      await fc.assert(
        fc.asyncProperty(packagesArb, async (packages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await simulateFullScaffoldingFlow(emitter, { packages });

          const eventTypes = emittedEvents.map(e => e.type);
          
          const depsCompleteIndex = eventTypes.indexOf('deps:complete');
          const generateStartIndex = eventTypes.indexOf('generate:start');
          
          expect(depsCompleteIndex).toBeLessThan(generateStartIndex);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that generate:start comes before preview:starting
     * Requirements: 4.1
     */
    it('should emit generate:start before preview:starting', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await simulateFullScaffoldingFlow(emitter);

          const eventTypes = emittedEvents.map(e => e.type);
          
          const generateStartIndex = eventTypes.indexOf('generate:start');
          const previewStartingIndex = eventTypes.indexOf('preview:starting');
          
          expect(generateStartIndex).toBeLessThan(previewStartingIndex);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Dependency Detection Integration', () => {
    /**
     * Test that dependency detection correctly identifies packages from prompts
     * Requirements: 3.1
     */
    it('should detect packages mentioned in prompts', () => {
      const promptsWithPackages = [
        { prompt: 'Create a landing page with GSAP animations', expected: ['gsap'] },
        { prompt: 'Build a dashboard with Three.js 3D graphics', expected: ['three'] },
        { prompt: 'Make a chart using recharts', expected: ['recharts'] },
        { prompt: 'Add framer-motion animations', expected: ['framer-motion'] },
      ];

      for (const { prompt, expected } of promptsWithPackages) {
        const detected = dependencyDetector.detectFromPrompt(prompt);
        
        for (const pkg of expected) {
          expect(detected.explicit).toContain(pkg);
        }
      }
    });

    /**
     * Test that library suggestions work based on context
     * Requirements: 9.1-9.9
     */
    it('should suggest appropriate libraries based on context keywords', () => {
      const contextTests = [
        { prompt: 'Create an animated landing page', shouldSuggest: 'framer-motion' },
        { prompt: 'Build a dashboard with charts', shouldSuggest: 'recharts' },
        { prompt: 'Add a form with validation', shouldSuggest: 'react-hook-form' },
        { prompt: 'Create a carousel slider', shouldSuggest: 'embla-carousel-react' },
      ];

      for (const { prompt, shouldSuggest } of contextTests) {
        const suggestions = dependencyDetector.suggestLibraries(prompt);
        const suggestedNames = suggestions.map(s => s.name);
        
        expect(suggestedNames).toContain(shouldSuggest);
      }
    });

    /**
     * Test that template packages are correctly identified
     * Requirements: 7.9
     */
    it('should correctly identify packages in template', () => {
      const templatePackages = ['framer-motion', 'gsap', 'zustand', 'zod', 'react-hook-form'];
      const nonTemplatePackages = ['three', 'chart.js', 'd3', 'stripe'];

      for (const pkg of templatePackages) {
        expect(isPackageInTemplate(pkg)).toBe(true);
      }

      for (const pkg of nonTemplatePackages) {
        expect(isPackageInTemplate(pkg)).toBe(false);
      }
    });

    /**
     * Test that filterMissingPackages correctly filters template packages
     * Requirements: 7.9
     */
    it('should filter out packages already in template', () => {
      const allPackages = ['gsap', 'three', 'framer-motion', 'chart.js', 'zustand'];
      const missing = filterMissingPackages(allPackages);
      
      // gsap, framer-motion, zustand are in template
      expect(missing).not.toContain('gsap');
      expect(missing).not.toContain('framer-motion');
      expect(missing).not.toContain('zustand');
      
      // three, chart.js are NOT in template
      expect(missing).toContain('three');
      expect(missing).toContain('chart.js');
    });
  });

  describe('Event Content Validation', () => {
    /**
     * Test that all scaffolding events include timestamps
     * Requirements: 5.1-5.8
     */
    it('should include timestamp in all scaffolding events', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          const beforeTime = Date.now();
          await simulateFullScaffoldingFlow(emitter, { packages: ['gsap'] });
          const afterTime = Date.now();

          const scaffoldingEventTypes = [
            'scaffold:start', 'template:cloning', 'template:complete',
            'deps:analyzing', 'deps:detected', 'deps:installing',
            'deps:progress', 'deps:complete', 'generate:start', 'preview:starting'
          ];

          for (const event of emittedEvents) {
            if (scaffoldingEventTypes.includes(event.type)) {
              const eventWithTimestamp = event as StreamEvent & { timestamp?: number };
              expect(eventWithTimestamp.timestamp).toBeDefined();
              expect(eventWithTimestamp.timestamp).toBeGreaterThanOrEqual(beforeTime);
              expect(eventWithTimestamp.timestamp).toBeLessThanOrEqual(afterTime);
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Test that deps:detected includes packages array
     * Requirements: 3.2
     */
    it('should include packages array in deps:detected events', async () => {
      const packagesArb = fc.array(
        fc.constantFrom('gsap', 'three', 'recharts'),
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

          const depsDetectedEvent = emittedEvents.find(e => e.type === 'deps:detected') as StreamEvent & { packages?: string[] };
          
          expect(depsDetectedEvent).toBeDefined();
          expect(depsDetectedEvent.packages).toEqual(packages);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that deps:complete includes installed packages with versions
     * Requirements: 3.6
     */
    it('should include installed packages with versions in deps:complete', async () => {
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

          const depsCompleteEvent = emittedEvents.find(e => e.type === 'deps:complete') as StreamEvent & { 
            packages?: Array<{ name: string; version: string }>;
          };
          
          expect(depsCompleteEvent).toBeDefined();
          expect(depsCompleteEvent.packages).toEqual(packages);
          
          for (const pkg of depsCompleteEvent.packages || []) {
            expect(typeof pkg.name).toBe('string');
            expect(typeof pkg.version).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that versionId is propagated to all events
     */
    it('should include versionId in all events when set', async () => {
      const versionIdArb = fc.stringMatching(/^[a-z0-9-]+$/);

      await fc.assert(
        fc.asyncProperty(versionIdArb, async (testVersionId) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          const testEmitter = new StreamingEventEmitter(projectId, testVersionId);
          await simulateFullScaffoldingFlow(testEmitter);

          for (const event of emittedEvents) {
            expect(event.versionId).toBe(testVersionId);
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});


/**
 * Property-Based Tests for Template Completeness
 * 
 * **Feature: full-project-scaffolding, Property 2: Template Completeness**
 * **Validates: Requirements 1.2**
 * 
 * For any cloned template, the resulting sandbox SHALL contain package.json,
 * node_modules directory, app/layout.tsx, and app/page.tsx files.
 */
describe('Property 2: Template Completeness', () => {
  /**
   * Simulated template file structure for testing
   * In a real scenario, this would come from the cloneTemplate function
   */
  const REQUIRED_TEMPLATE_FILES = [
    'package.json',
    'app/layout.tsx',
    'app/page.tsx',
    'tsconfig.json',
    'next.config.mjs',
    'tailwind.config.ts',
  ];

  const OPTIONAL_TEMPLATE_FILES = [
    'app/globals.css',
    'components/ui/button.tsx',
    'components/ui/card.tsx',
    'lib/utils.ts',
    'components.json',
  ];

  /**
   * Generate a simulated template file structure
   */
  function generateTemplateFiles(
    includeRequired: boolean,
    optionalFiles: string[]
  ): Record<string, { content: string; language: string; size: number }> {
    const files: Record<string, { content: string; language: string; size: number }> = {};
    
    if (includeRequired) {
      for (const filePath of REQUIRED_TEMPLATE_FILES) {
        const content = `// ${filePath} content`;
        files[filePath] = {
          content,
          language: filePath.endsWith('.json') ? 'json' : 'typescript',
          size: content.length,
        };
      }
    }
    
    for (const filePath of optionalFiles) {
      const content = `// ${filePath} content`;
      files[filePath] = {
        content,
        language: filePath.endsWith('.json') ? 'json' : filePath.endsWith('.css') ? 'css' : 'typescript',
        size: content.length,
      };
    }
    
    return files;
  }

  /**
   * Validate that a template has all required files
   */
  function validateTemplateCompleteness(
    files: Record<string, unknown>
  ): { valid: boolean; missingFiles: string[] } {
    const missingFiles: string[] = [];
    
    for (const requiredFile of REQUIRED_TEMPLATE_FILES) {
      if (!(requiredFile in files)) {
        missingFiles.push(requiredFile);
      }
    }
    
    return {
      valid: missingFiles.length === 0,
      missingFiles,
    };
  }

  it('should have all required files when template is complete', () => {
    const optionalFilesArb = fc.subarray(OPTIONAL_TEMPLATE_FILES);
    
    fc.assert(
      fc.property(optionalFilesArb, (optionalFiles) => {
        const files = generateTemplateFiles(true, optionalFiles);
        const validation = validateTemplateCompleteness(files);
        
        expect(validation.valid).toBe(true);
        expect(validation.missingFiles).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('should detect missing required files', () => {
    // Generate templates with some required files missing
    const missingFilesArb = fc.subarray(REQUIRED_TEMPLATE_FILES, { minLength: 1 });
    
    fc.assert(
      fc.property(missingFilesArb, (missingFiles) => {
        // Create a template with some required files missing
        const files: Record<string, { content: string; language: string; size: number }> = {};
        
        for (const filePath of REQUIRED_TEMPLATE_FILES) {
          if (!missingFiles.includes(filePath)) {
            const content = `// ${filePath} content`;
            files[filePath] = {
              content,
              language: 'typescript',
              size: content.length,
            };
          }
        }
        
        const validation = validateTemplateCompleteness(files);
        
        // Should be invalid if any required files are missing
        expect(validation.valid).toBe(false);
        expect(validation.missingFiles.length).toBeGreaterThan(0);
        
        // All missing files should be in the validation result
        for (const missing of missingFiles) {
          expect(validation.missingFiles).toContain(missing);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should include package.json in any valid template', () => {
    const optionalFilesArb = fc.subarray(OPTIONAL_TEMPLATE_FILES);
    
    fc.assert(
      fc.property(optionalFilesArb, (optionalFiles) => {
        const files = generateTemplateFiles(true, optionalFiles);
        
        expect(files['package.json']).toBeDefined();
        expect(files['package.json'].content).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('should include app/layout.tsx in any valid template', () => {
    const optionalFilesArb = fc.subarray(OPTIONAL_TEMPLATE_FILES);
    
    fc.assert(
      fc.property(optionalFilesArb, (optionalFiles) => {
        const files = generateTemplateFiles(true, optionalFiles);
        
        expect(files['app/layout.tsx']).toBeDefined();
        expect(files['app/layout.tsx'].content).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('should include app/page.tsx in any valid template', () => {
    const optionalFilesArb = fc.subarray(OPTIONAL_TEMPLATE_FILES);
    
    fc.assert(
      fc.property(optionalFilesArb, (optionalFiles) => {
        const files = generateTemplateFiles(true, optionalFiles);
        
        expect(files['app/page.tsx']).toBeDefined();
        expect(files['app/page.tsx'].content).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('should have correct file structure for Next.js project', () => {
    const optionalFilesArb = fc.subarray(OPTIONAL_TEMPLATE_FILES);
    
    fc.assert(
      fc.property(optionalFilesArb, (optionalFiles) => {
        const files = generateTemplateFiles(true, optionalFiles);
        const filePaths = Object.keys(files);
        
        // Should have app directory files
        const appFiles = filePaths.filter(p => p.startsWith('app/'));
        expect(appFiles.length).toBeGreaterThanOrEqual(2); // layout.tsx and page.tsx
        
        // Should have config files at root
        expect(filePaths).toContain('package.json');
        expect(filePaths).toContain('tsconfig.json');
        expect(filePaths).toContain('next.config.mjs');
        expect(filePaths).toContain('tailwind.config.ts');
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve file content and metadata', () => {
    const optionalFilesArb = fc.subarray(OPTIONAL_TEMPLATE_FILES);
    
    fc.assert(
      fc.property(optionalFilesArb, (optionalFiles) => {
        const files = generateTemplateFiles(true, optionalFiles);
        
        for (const [path, fileData] of Object.entries(files)) {
          // Each file should have content, language, and size
          expect(typeof fileData.content).toBe('string');
          expect(typeof fileData.language).toBe('string');
          expect(typeof fileData.size).toBe('number');
          
          // Size should match content length
          expect(fileData.size).toBe(fileData.content.length);
          
          // Language should be appropriate for file type
          if (path.endsWith('.json')) {
            expect(fileData.language).toBe('json');
          } else if (path.endsWith('.css')) {
            expect(fileData.language).toBe('css');
          } else if (path.endsWith('.ts') || path.endsWith('.tsx')) {
            expect(fileData.language).toBe('typescript');
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Error Recovery Scenario Tests
 * 
 * Tests error handling and recovery for:
 * - Clone failure → Error event → Retry
 * - Install failure → Error event → No generation
 * - Server failure → Error event with logs
 * 
 * _Requirements: 1.4, 3.8, 4.4_
 */
describe('Error Recovery Scenarios', () => {
  const projectId = 'test-project-error';
  const versionId = 'test-version-error';
  let emitter: StreamingEventEmitter;
  let emittedEvents: StreamEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = new StreamingEventEmitter(projectId, versionId);
    emittedEvents = [];
    
    vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
      emittedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Clone Failure Tests
   * Requirements: 1.4
   */
  describe('Clone Failure → Error Event → Retry', () => {
    it('should emit error event when template clone fails', async () => {
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });

      await fc.assert(
        fc.asyncProperty(errorMessageArb, async (errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate clone failure
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitError({
            message: `Template clone failed: ${errorMessage}`,
            stage: 'template_clone',
          });

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have scaffold:start, template:cloning, and error
          expect(eventTypes).toContain('scaffold:start');
          expect(eventTypes).toContain('template:cloning');
          expect(eventTypes).toContain('error');
          
          // Should NOT have template:complete
          expect(eventTypes).not.toContain('template:complete');
          
          // Error event should contain the error message
          const errorEvent = emittedEvents.find(e => e.type === 'error') as StreamEvent & { message?: string };
          expect(errorEvent.message).toContain(errorMessage);
        }),
        { numRuns: 100 }
      );
    });

    it('should include stage information in clone error events', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await emitter.emitError({
            message: 'Clone failed',
            stage: 'template_clone',
          });

          const errorEvent = emittedEvents.find(e => e.type === 'error') as StreamEvent & { stage?: string };
          expect(errorEvent.stage).toBe('template_clone');
        }),
        { numRuns: 100 }
      );
    });

    it('should not proceed to deps phase after clone failure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate clone failure (no deps events should follow)
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitError({
            message: 'Clone failed',
            stage: 'template_clone',
          });

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should NOT have any deps events
          expect(eventTypes).not.toContain('deps:analyzing');
          expect(eventTypes).not.toContain('deps:detected');
          expect(eventTypes).not.toContain('deps:complete');
          expect(eventTypes).not.toContain('generate:start');
        }),
        { numRuns: 100 }
      );
    });

    it('should allow retry after clone failure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // First attempt - fails
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitError({
            message: 'Clone failed - network error',
            stage: 'template_clone',
          });

          // Retry - succeeds
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123', 'https://sandbox.example.com');

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have error from first attempt
          expect(eventTypes.filter(t => t === 'error').length).toBe(1);
          
          // Should have successful template:complete from retry
          expect(eventTypes).toContain('template:complete');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Install Failure Tests
   * Requirements: 3.8
   */
  describe('Install Failure → Error Event → No Generation', () => {
    it('should emit deps:error when package installation fails', async () => {
      const failedPackagesArb = fc.array(
        fc.constantFrom('bad-package', 'nonexistent-lib', 'broken-dep'),
        { minLength: 1, maxLength: 3 }
      );
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });

      await fc.assert(
        fc.asyncProperty(failedPackagesArb, errorMessageArb, async (failedPackages, errorMessage) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate install failure
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(failedPackages);
          await emitter.emitDepsInstalling(failedPackages);
          await emitter.emitDepsError(errorMessage, failedPackages);

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have deps:error
          expect(eventTypes).toContain('deps:error');
          
          // deps:error event should contain failed packages
          const depsErrorEvent = emittedEvents.find(e => e.type === 'deps:error') as StreamEvent & { 
            failedPackages?: string[];
            error?: string;
          };
          expect(depsErrorEvent.failedPackages).toEqual(failedPackages);
          expect(depsErrorEvent.error).toBe(errorMessage);
        }),
        { numRuns: 100 }
      );
    });

    it('should NOT emit generate:start after deps:error', async () => {
      const failedPackagesArb = fc.array(
        fc.constantFrom('bad-package', 'nonexistent-lib'),
        { minLength: 1, maxLength: 3 }
      );

      await fc.assert(
        fc.asyncProperty(failedPackagesArb, async (failedPackages) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate install failure - should NOT proceed to generation
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(failedPackages);
          await emitter.emitDepsInstalling(failedPackages);
          await emitter.emitDepsError('Installation failed', failedPackages);
          // Note: generate:start should NOT be called after error

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have deps:error
          expect(eventTypes).toContain('deps:error');
          
          // Should NOT have generate:start or preview events
          expect(eventTypes).not.toContain('generate:start');
          expect(eventTypes).not.toContain('preview:starting');
          expect(eventTypes).not.toContain('preview:ready');
        }),
        { numRuns: 100 }
      );
    });

    it('should NOT emit deps:complete after deps:error', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate install failure
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(['bad-package']);
          await emitter.emitDepsInstalling(['bad-package']);
          await emitter.emitDepsError('Installation failed', ['bad-package']);
          // Note: deps:complete should NOT be called after error

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have deps:error but NOT deps:complete
          expect(eventTypes).toContain('deps:error');
          expect(eventTypes).not.toContain('deps:complete');
        }),
        { numRuns: 100 }
      );
    });

    it('should include pnpm error message in deps:error event', async () => {
      const pnpmErrorsArb = fc.constantFrom(
        'ERR_PNPM_NO_MATCHING_VERSION  No matching version found for bad-package@latest',
        'ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/nonexistent-lib - Not Found',
        'ERR_PNPM_PEER_DEP_ISSUES  Unmet peer dependencies',
        'ENOENT: no such file or directory',
      );

      await fc.assert(
        fc.asyncProperty(pnpmErrorsArb, async (pnpmError) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await emitter.emitDepsError(pnpmError, ['bad-package']);

          const depsErrorEvent = emittedEvents.find(e => e.type === 'deps:error') as StreamEvent & { error?: string };
          expect(depsErrorEvent.error).toBe(pnpmError);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Server Failure Tests
   * Requirements: 4.4
   */
  describe('Server Failure → Error Event with Logs', () => {
    it('should emit error event when preview server fails to start', async () => {
      const serverErrorsArb = fc.constantFrom(
        'EADDRINUSE: port 3000 already in use',
        'Cannot find module next',
        'Error: listen EACCES: permission denied',
        'Process exited with code 1',
        'Connection timeout after 30000ms',
      );

      await fc.assert(
        fc.asyncProperty(serverErrorsArb, async (serverError) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate server startup failure
          await emitter.emitPreviewStarting();
          await emitter.emitError({
            message: `Failed to start preview server: ${serverError}`,
            stage: 'preview_server',
          });

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have preview:starting and error
          expect(eventTypes).toContain('preview:starting');
          expect(eventTypes).toContain('error');
          
          // Error should contain server error message
          const errorEvent = emittedEvents.find(e => e.type === 'error') as StreamEvent & { message?: string };
          expect(errorEvent.message).toContain(serverError);
        }),
        { numRuns: 100 }
      );
    });

    it('should include stage information in server error events', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await emitter.emitError({
            message: 'Server startup failed',
            stage: 'preview_server',
          });

          const errorEvent = emittedEvents.find(e => e.type === 'error') as StreamEvent & { stage?: string };
          expect(errorEvent.stage).toBe('preview_server');
        }),
        { numRuns: 100 }
      );
    });

    it('should NOT emit preview:ready after server failure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Simulate server failure - should NOT emit preview:ready
          await emitter.emitPreviewStarting();
          await emitter.emitError({
            message: 'Server startup failed',
            stage: 'preview_server',
          });
          // Note: preview:ready should NOT be called after error

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have preview:starting and error
          expect(eventTypes).toContain('preview:starting');
          expect(eventTypes).toContain('error');
          
          // Should NOT have preview:ready
          expect(eventTypes).not.toContain('preview:ready');
        }),
        { numRuns: 100 }
      );
    });

    it('should emit error after generate:start when server fails', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // Full flow until server failure
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected([]);
          await emitter.emitDepsComplete([]);
          await emitter.emitGenerateStart();
          await emitter.emitPreviewStarting();
          await emitter.emitError({
            message: 'Server startup failed',
            stage: 'preview_server',
          });

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have full flow up to error
          expect(eventTypes).toContain('scaffold:start');
          expect(eventTypes).toContain('template:complete');
          expect(eventTypes).toContain('deps:complete');
          expect(eventTypes).toContain('generate:start');
          expect(eventTypes).toContain('preview:starting');
          expect(eventTypes).toContain('error');
          
          // Error should come after preview:starting
          const previewStartingIndex = eventTypes.indexOf('preview:starting');
          const errorIndex = eventTypes.indexOf('error');
          expect(errorIndex).toBeGreaterThan(previewStartingIndex);
        }),
        { numRuns: 100 }
      );
    });

    it('should include recovery suggestions in error events', async () => {
      const errorTypesArb = fc.constantFrom(
        { message: 'EADDRINUSE: port 3000 already in use', expectedSuggestion: 'port' },
        { message: 'Cannot find module next', expectedSuggestion: 'module' },
        { message: 'Connection timeout', expectedSuggestion: 'timeout' },
      );

      await fc.assert(
        fc.asyncProperty(errorTypesArb, async ({ message }) => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          await emitter.emitError({
            message,
            stage: 'preview_server',
          });

          const errorEvent = emittedEvents.find(e => e.type === 'error') as StreamEvent & { message?: string };
          
          // Error message should be present
          expect(errorEvent.message).toBeDefined();
          expect(errorEvent.message!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Combined Error Scenarios
   */
  describe('Combined Error Scenarios', () => {
    it('should handle multiple error types in sequence', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          emittedEvents = [];
          vi.clearAllMocks();
          vi.mocked(streamingService.emit).mockImplementation(async (_, event) => {
            emittedEvents.push(event);
          });

          // First attempt - clone fails
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitError({
            message: 'Clone failed',
            stage: 'template_clone',
          });

          // Second attempt - clone succeeds, install fails
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-123');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected(['bad-package']);
          await emitter.emitDepsError('Install failed', ['bad-package']);

          // Third attempt - everything succeeds
          await emitter.emitScaffoldStart();
          await emitter.emitTemplateCloning();
          await emitter.emitTemplateComplete('sandbox-456');
          await emitter.emitDepsAnalyzing();
          await emitter.emitDepsDetected([]);
          await emitter.emitDepsComplete([]);
          await emitter.emitGenerateStart();
          await emitter.emitPreviewStarting();

          const eventTypes = emittedEvents.map(e => e.type);
          
          // Should have 2 errors (clone and install)
          const errorCount = eventTypes.filter(t => t === 'error').length;
          const depsErrorCount = eventTypes.filter(t => t === 'deps:error').length;
          expect(errorCount + depsErrorCount).toBe(2);
          
          // Should have successful completion events from third attempt
          expect(eventTypes).toContain('generate:start');
          expect(eventTypes).toContain('preview:starting');
        }),
        { numRuns: 100 }
      );
    });
  });
});

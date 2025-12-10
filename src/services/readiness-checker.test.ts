/**
 * ReadinessChecker Unit Tests
 * 
 * Tests for the ReadinessChecker service.
 * 
 * Requirements: 17.1, 17.2
 */

import { describe, it, expect } from 'vitest';
import { ReadinessChecker } from './readiness-checker';

describe('ReadinessChecker', () => {
  const checker = new ReadinessChecker();

  describe('checkEnvVariables (Requirements: 17.1)', () => {
    it('should pass when all required env variables are set', () => {
      const files = {
        'app/api/test/route.ts': `
          const apiKey = process.env.API_KEY;
          const dbUrl = process.env.DATABASE_URL;
        `,
      };
      const setVariables = ['API_KEY', 'DATABASE_URL'];

      const result = checker.checkEnvVariables(files, setVariables);

      expect(result.passed).toBe(true);
      expect(result.name).toBe('Environment Variables');
      expect(result.message).toContain('2 required environment variables are set');
    });

    it('should fail when required env variables are missing', () => {
      const files = {
        'app/api/test/route.ts': `
          const apiKey = process.env.API_KEY;
          const dbUrl = process.env.DATABASE_URL;
          const secret = process.env.SECRET_KEY;
        `,
      };
      const setVariables = ['API_KEY'];

      const result = checker.checkEnvVariables(files, setVariables);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Missing 2 required environment variable(s)');
      expect(result.message).toContain('DATABASE_URL');
      expect(result.message).toContain('SECRET_KEY');
      expect(result.remediation).toBeDefined();
      expect(result.remediation).toContain('DATABASE_URL');
    });

    it('should pass when no env variables are required', () => {
      const files = {
        'components/button.tsx': `
          export function Button() {
            return <button>Click me</button>;
          }
        `,
      };

      const result = checker.checkEnvVariables(files, []);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('0 required environment variables');
    });

    it('should detect bracket notation env variables', () => {
      const files = {
        'lib/config.ts': `
          const key1 = process.env['API_KEY'];
          const key2 = process.env["SECRET"];
        `,
      };
      const setVariables = ['API_KEY'];

      const result = checker.checkEnvVariables(files, setVariables);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('SECRET');
    });
  });

  describe('checkHardcodedSecrets (Requirements: 17.2)', () => {
    it('should pass when no secrets are detected', () => {
      const files = {
        'app/api/test/route.ts': `
          const apiKey = process.env.API_KEY;
          export async function GET() {
            return Response.json({ ok: true });
          }
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(true);
      expect(result.name).toBe('Hardcoded Secrets');
      expect(result.message).toBe('No hardcoded secrets detected in code');
    });

    it('should detect Stripe API keys', () => {
      // Using rk_ prefix (test-only pattern) to avoid GitHub secret scanning
      // The actual checker detects sk_live_ and sk_test_ patterns
      const files = {
        'lib/stripe.ts': `
          const stripe = new Stripe("TESTKEY_live_TestKeyForUnitTestingOnly1234");
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('hardcoded secret');
      expect(result.remediation).toContain('Stripe');
    });

    it('should detect GitHub tokens', () => {
      const files = {
        'lib/github.ts': `
          const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxFAKE";
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(false);
      expect(result.remediation).toContain('GitHub');
    });

    it('should detect MongoDB connection strings', () => {
      const files = {
        'lib/db.ts': `
          const uri = "mongodb+srv://user:password123@cluster.mongodb.net/db"
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(false);
      expect(result.remediation).toContain('MongoDB');
    });

    it('should detect PostgreSQL connection strings', () => {
      const files = {
        'lib/db.ts': `
          const uri = "postgresql://user:secretpass@localhost:5432/mydb"
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(false);
      expect(result.remediation).toContain('PostgreSQL');
    });

    it('should detect JWT tokens', () => {
      const files = {
        'lib/auth.ts': `
          const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(false);
      expect(result.remediation).toContain('JWT');
    });

    it('should skip test files', () => {
      const files = {
        'lib/stripe.test.ts': `
          const stripe = new Stripe("TESTKEY_test_TestKeyForUnitTestingOnly1234");
        `,
        'lib/stripe.spec.ts': `
          const stripe = new Stripe("TESTKEY_test_TestKeyForUnitTestingOnly1234");
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(true);
    });

    it('should skip comment lines', () => {
      const files = {
        'lib/config.ts': `
          // Example: const key = "TESTKEY_live_TestKeyForUnitTestingOnly1234";
          /* const key = "TESTKEY_live_TestKeyForUnitTestingOnly1234"; */
          const apiKey = process.env.STRIPE_KEY;
        `,
      };

      const result = checker.checkHardcodedSecrets(files);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkApiErrorHandling (Requirements: 17.3)', () => {
    it('should pass when API routes have proper error handling', () => {
      const files = {
        'app/api/users/route.ts': `
          export async function GET() {
            try {
              const users = await getUsers();
              return NextResponse.json(users);
            } catch (error) {
              return NextResponse.json({ error: "Failed" }, { status: 500 });
            }
          }
        `,
      };

      const result = checker.checkApiErrorHandling(files);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('1 API route(s) have proper error handling');
    });

    it('should fail when API routes lack try-catch', () => {
      const files = {
        'app/api/users/route.ts': `
          export async function GET() {
            const users = await getUsers();
            return NextResponse.json(users);
          }
        `,
      };

      const result = checker.checkApiErrorHandling(files);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('missing proper error handling');
      expect(result.remediation).toContain('try-catch');
    });

    it('should fail when API routes have try-catch but no error response', () => {
      const files = {
        'app/api/users/route.ts': `
          export async function GET() {
            try {
              const users = await getUsers();
              return NextResponse.json(users);
            } catch (error) {
              console.log(error);
            }
          }
        `,
      };

      const result = checker.checkApiErrorHandling(files);

      expect(result.passed).toBe(false);
      expect(result.remediation).toContain('error response');
    });

    it('should pass when no API routes exist', () => {
      const files = {
        'components/button.tsx': `
          export function Button() {
            return <button>Click</button>;
          }
        `,
      };

      const result = checker.checkApiErrorHandling(files);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('No API routes found');
    });

    it('should detect Pages Router API routes', () => {
      const files = {
        'pages/api/users.ts': `
          export default function handler(req, res) {
            try {
              res.status(200).json({ users: [] });
            } catch (error) {
              res.status(500).json({ error: "Failed" });
            }
          }
        `,
      };

      const result = checker.checkApiErrorHandling(files);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkReadiness (Requirements: 17.5)', () => {
    it('should return comprehensive report when all checks pass', () => {
      const files = {
        'app/api/users/route.ts': `
          const apiKey = process.env.API_KEY;
          export async function GET() {
            try {
              return NextResponse.json({ ok: true });
            } catch (error) {
              return NextResponse.json({ error: "Failed" }, { status: 500 });
            }
          }
        `,
      };

      const result = checker.checkReadiness({
        files,
        setEnvVariables: ['API_KEY'],
      });

      expect(result.isReady).toBe(true);
      expect(result.checks.length).toBe(3);
      expect(result.checks.every(c => c.passed)).toBe(true);
      expect(result.summary).toContain('ready for deployment');
    });

    it('should return comprehensive report when checks fail', () => {
      const files = {
        'app/api/users/route.ts': `
          const apiKey = "TESTKEY_live_TestKeyForUnitTestingOnly1234";
          export async function GET() {
            return NextResponse.json({ ok: true });
          }
        `,
      };

      const result = checker.checkReadiness({
        files,
        setEnvVariables: [],
      });

      expect(result.isReady).toBe(false);
      expect(result.checks.some(c => !c.passed)).toBe(true);
      expect(result.summary).toContain('address the failing checks');
    });

    it('should allow skipping specific checks', () => {
      const files = {
        'lib/config.ts': `
          const key = "TESTKEY_live_TestKeyForUnitTestingOnly1234";
        `,
      };

      const result = checker.checkReadiness({
        files,
        skipChecks: ['secrets'],
      });

      expect(result.checks.length).toBe(2);
      expect(result.checks.find(c => c.name === 'Hardcoded Secrets')).toBeUndefined();
    });
  });

  describe('detectSecrets', () => {
    it('should return line numbers for detected secrets', () => {
      const files = {
        'lib/config.ts': `
          const line1 = "normal";
          const line2 = "TESTKEY_live_TestKeyForUnitTestingOnly1234";
          const line3 = "also normal";
        `,
      };

      const secrets = checker.detectSecrets(files);

      expect(secrets.length).toBe(1);
      expect(secrets[0].line).toBe(3); // Line 3 (1-indexed)
      expect(secrets[0].file).toBe('lib/config.ts');
      expect(secrets[0].secretType).toBe('Stripe API Key');
    });

    it('should detect multiple secrets in same file', () => {
      const files = {
        'lib/config.ts': `
          const stripe = "TESTKEY_live_TestKeyForUnitTestingOnly1234";
          const github = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxFAKE";
        `,
      };

      const secrets = checker.detectSecrets(files);

      expect(secrets.length).toBe(2);
    });
  });

  describe('isApiRoute', () => {
    it('should identify Next.js App Router API routes', () => {
      expect(checker.isApiRoute('app/api/users/route.ts')).toBe(true);
      expect(checker.isApiRoute('app/api/auth/login/route.ts')).toBe(true);
      expect(checker.isApiRoute('app/api/route.ts')).toBe(true);
    });

    it('should identify Next.js Pages Router API routes', () => {
      expect(checker.isApiRoute('pages/api/users.ts')).toBe(true);
      expect(checker.isApiRoute('pages/api/auth/login.ts')).toBe(true);
    });

    it('should not identify non-API files', () => {
      expect(checker.isApiRoute('app/page.tsx')).toBe(false);
      expect(checker.isApiRoute('components/button.tsx')).toBe(false);
      expect(checker.isApiRoute('lib/utils.ts')).toBe(false);
    });
  });

  describe('getApiRoutes', () => {
    it('should return list of API routes from files', () => {
      const files = {
        'app/api/users/route.ts': 'content',
        'app/api/posts/route.ts': 'content',
        'components/button.tsx': 'content',
        'pages/api/legacy.ts': 'content',
      };

      const routes = checker.getApiRoutes(files);

      expect(routes).toHaveLength(3);
      expect(routes).toContain('app/api/users/route.ts');
      expect(routes).toContain('app/api/posts/route.ts');
      expect(routes).toContain('pages/api/legacy.ts');
    });
  });
});

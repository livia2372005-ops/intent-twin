import { describe, it, expect } from 'vitest';
import { ProductContractSchema } from '../src/contract/schema.js';
import { validateContract } from '../src/contract/parser.js';

describe('Product Contract Schema & Validation', () => {
  it('validates a minimal valid contract', () => {
    const valid = {
      version: '0.1',
      product: {
        name: 'test-app',
        description: 'Test application',
      },
      requirements: [
        {
          id: 'R-001',
          title: 'User Signup',
          statement: 'Users can register',
          sources: ['src/signup.ts'],
          probes: [
            {
              type: 'file',
              path: 'src/signup.ts',
              mustExist: true,
            },
          ],
        },
      ],
      invariants: [
        {
          id: 'I-001',
          statement: 'No credentials in client bundle',
          probes: [
            {
              type: 'file',
              path: 'src/',
              notPattern: 'SECRET_KEY',
            },
          ],
        },
      ],
    };

    const res = validateContract(valid);
    expect(res.success).toBe(true);
    expect(res.data?.requirements.length).toBe(1);
    expect(res.data?.invariants?.length).toBe(1);
  });

  it('rejects invalid requirement IDs', () => {
    const invalid = {
      version: '0.1',
      product: { name: 'app' },
      requirements: [
        {
          id: 'invalid-id-without-R-prefix',
          title: 'Title',
          statement: 'Statement',
        },
      ],
    };

    const res = validateContract(invalid);
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toContain('Requirement ID must follow pattern R-xxx');
  });

  it('rejects invalid probe types', () => {
    const invalid = {
      version: '0.1',
      product: { name: 'app' },
      requirements: [
        {
          id: 'R-001',
          title: 'Title',
          statement: 'Statement',
          probes: [
            {
              type: 'unknown-probe-type',
            },
          ],
        },
      ],
    };

    const res = validateContract(invalid);
    expect(res.success).toBe(false);
  });
});

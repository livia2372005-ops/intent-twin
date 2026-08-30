import { describe, it, expect } from 'vitest';
import { db } from '../../src/db.js';

describe('Auth Unit Tests', () => {
  it('retrieves user from session token', () => {
    db.seed();
    const user = db.getUserByToken('token-admin-alpha');
    expect(user).toBeDefined();
    expect(user?.email).toBe('admin@alpha.com');
  });
});

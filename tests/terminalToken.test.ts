import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { authorizeTerminalRequest } from '@/lib/terminalToken';

const SECRET = 'test-secret';
const base = { sub: 'user-1', email: 'u@example.com', secret: SECRET };

describe('authorizeTerminalRequest', () => {
  it('401 when there is no authenticated subject', () => {
    const r = authorizeTerminalRequest({ ...base, sub: undefined, groups: ['Coder'], labId: 'python-basics' });
    expect(r.status).toBe(401);
  });
  it('403 when the user is not a Coder', () => {
    const r = authorizeTerminalRequest({ ...base, groups: ['ContentWriter'], labId: 'python-basics' });
    expect(r.status).toBe(403);
  });
  it('400 for an unknown lab', () => {
    const r = authorizeTerminalRequest({ ...base, groups: ['Coder'], labId: 'rust-basics' });
    expect(r.status).toBe(400);
  });
  it('500 when the signing secret is missing', () => {
    const r = authorizeTerminalRequest({ ...base, secret: '', groups: ['Coder'], labId: 'python-basics' });
    expect(r.status).toBe(500);
  });
  it('200 with a 5-minute token carrying the right claims', () => {
    const r = authorizeTerminalRequest({ ...base, groups: ['Coder'], labId: 'python-basics' });
    expect(r.status).toBe(200);
    const decoded = jwt.verify(r.body.token as string, SECRET) as Record<string, unknown>;
    expect(decoded.id).toBe('user-1');
    expect(decoded.email).toBe('u@example.com');
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(300);
  });
});

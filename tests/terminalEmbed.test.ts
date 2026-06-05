import { describe, it, expect } from 'vitest';
import { parseTerminalFence, TERMINAL_LABS } from '@/lib/terminalEmbed';

describe('parseTerminalFence', () => {
  it('parses a terminal fence with a valid lab', () => {
    expect(parseTerminalFence('terminal', 'lab: python-basics')).toEqual({ labId: 'python-basics' });
  });
  it('tolerates extra whitespace and lines', () => {
    expect(parseTerminalFence('terminal', '  lab:   node-basics  \n')).toEqual({ labId: 'node-basics' });
  });
  it('returns null for a non-terminal language', () => {
    expect(parseTerminalFence('python', 'lab: python-basics')).toBeNull();
  });
  it('returns null for an unknown lab', () => {
    expect(parseTerminalFence('terminal', 'lab: rust-basics')).toBeNull();
  });
  it('returns null when no lab line is present', () => {
    expect(parseTerminalFence('terminal', 'echo hi')).toBeNull();
  });
  it('exposes a display label per lab', () => {
    expect(TERMINAL_LABS['linux-basics']).toBe('Linux');
  });
});

describe('networked labs', () => {
  it('parses a networked lab fence', () => {
    expect(parseTerminalFence('terminal', 'lab: python-net')).toEqual({ labId: 'python-net' });
  });
  it('labels networked labs', () => {
    expect(TERMINAL_LABS['python-net']).toBe('Python (networked)');
    expect(TERMINAL_LABS['node-net']).toBe('Node.js (networked)');
    expect(TERMINAL_LABS['linux-net']).toBe('Linux (networked)');
  });
  it('still parses the offline labs', () => {
    expect(parseTerminalFence('terminal', 'lab: python-basics')).toEqual({ labId: 'python-basics' });
  });
});

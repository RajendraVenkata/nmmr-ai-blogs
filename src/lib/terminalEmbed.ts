// Lab IDs are the relay's container keys (see nmmr-terminal DEFAULT_LABS).
export const TERMINAL_LABS = {
  'python-basics': 'Python',
  'node-basics': 'Node.js',
  'linux-basics': 'Linux',
  'python-net': 'Python (networked)',
  'node-net': 'Node.js (networked)',
  'linux-net': 'Linux (networked)',
} as const;

export type LabId = keyof typeof TERMINAL_LABS;

export const ALLOWED_LAB_IDS = Object.keys(TERMINAL_LABS) as LabId[];

function isLabId(value: string): value is LabId {
  return (ALLOWED_LAB_IDS as string[]).includes(value);
}

/**
 * Decide whether a fenced code block is a terminal embed.
 * Returns the lab to launch, or null to render the block as ordinary code.
 */
export function parseTerminalFence(lang: string | undefined, source: string): { labId: LabId } | null {
  if (lang !== 'terminal') return null;
  const match = /^\s*lab:\s*(\S+)\s*$/m.exec(source);
  if (!match) return null;
  const labId = match[1];
  return isLabId(labId) ? { labId } : null;
}

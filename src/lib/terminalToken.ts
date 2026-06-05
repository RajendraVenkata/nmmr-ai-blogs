import jwt from 'jsonwebtoken';
import { roleFromGroups, canUseContainers } from './roles';
import { ALLOWED_LAB_IDS } from './terminalEmbed';

export interface TerminalAuthInput {
  sub?: string;
  email?: string;
  groups: string[];
  labId?: string;
  secret?: string;
}

export interface TerminalAuthResult {
  status: number;
  body: { token?: string; error?: string };
}

function mintToken(sub: string, email: string | undefined, groups: string[], secret: string): string {
  return jwt.sign(
    { id: sub, email: email ?? '', role: roleFromGroups(groups) },
    secret,
    { expiresIn: '5m' },
  );
}

export function authorizeTerminalRequest(input: TerminalAuthInput): TerminalAuthResult {
  if (!input.sub) return { status: 401, body: { error: 'Unauthenticated' } };
  if (!canUseContainers(input.groups)) return { status: 403, body: { error: 'Coder access required' } };
  if (!input.labId || !(ALLOWED_LAB_IDS as string[]).includes(input.labId)) {
    return { status: 400, body: { error: 'Unknown lab' } };
  }
  if (!input.secret) return { status: 500, body: { error: 'Server misconfigured' } };
  return { status: 200, body: { token: mintToken(input.sub, input.email, input.groups, input.secret) } };
}

export interface ManageAuthInput {
  sub?: string;
  email?: string;
  groups: string[];
  secret?: string;
}

export function authorizeManageRequest(input: ManageAuthInput): TerminalAuthResult {
  if (!input.sub) return { status: 401, body: { error: 'Unauthenticated' } };
  if (!canUseContainers(input.groups)) return { status: 403, body: { error: 'Coder access required' } };
  if (!input.secret) return { status: 500, body: { error: 'Server misconfigured' } };
  return { status: 200, body: { token: mintToken(input.sub, input.email, input.groups, input.secret) } };
}

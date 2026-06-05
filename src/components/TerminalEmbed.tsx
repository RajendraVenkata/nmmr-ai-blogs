'use client';

import { useTerminalSession } from '@/lib/useTerminalSession';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';

export default function TerminalEmbed({ labId }: { labId: LabId }) {
  const { loading, isCoder, status, message, mountRef, launch } = useTerminalSession(labId);
  const label = TERMINAL_LABS[labId];

  if (loading) {
    return <div className="my-4 rounded border bg-gray-50 p-4 text-sm text-gray-500">Loading…</div>;
  }

  if (!isCoder) {
    return (
      <div className="my-4 rounded border bg-gray-50 p-4 text-sm">
        <p className="font-medium">{label} terminal</p>
        <p className="mt-1 text-gray-600">
          Coder access is required to run this terminal.{' '}
          <a href="/account" className="text-indigo-600 underline">Request access</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 rounded border bg-black p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-gray-300">{label} terminal</span>
        {status === 'idle' && (
          <button onClick={launch} className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            Launch
          </button>
        )}
        {status === 'connecting' && <span className="text-xs text-gray-400">{message || 'Connecting…'}</span>}
        {status === 'error' && (
          <button onClick={launch} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white">
            Retry
          </button>
        )}
      </div>
      {status === 'error' && <p className="px-1 pb-2 text-xs text-red-400">{message}</p>}
      <div ref={mountRef} style={{ minHeight: status === 'idle' ? 0 : 300 }} />
    </div>
  );
}

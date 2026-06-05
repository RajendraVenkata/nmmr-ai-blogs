'use client';

import { useState } from 'react';
import { useTerminalSession } from '@/lib/useTerminalSession';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';

export default function FloatingTerminal({ labId }: { labId: LabId }) {
  const { loading, isCoder, status, message, mountRef, launch, refit } = useTerminalSession(labId);
  const [minimized, setMinimized] = useState(false);
  const label = TERMINAL_LABS[labId];

  if (loading) return null;

  function restore() {
    setMinimized(false);
    requestAnimationFrame(() => refit());
  }

  return (
    <>
      {minimized && (
        <button
          onClick={restore}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg"
        >
          ⌨ {label}
        </button>
      )}

      {/* Panel stays mounted; hidden (not unmounted) when minimized so the session persists. */}
      <div
        style={{ display: minimized ? 'none' : 'block' }}
        className="fixed bottom-4 right-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-700 bg-black shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
          <span className="text-xs font-medium text-gray-300">{label} terminal</span>
          <div className="flex items-center gap-2">
            {isCoder && status === 'idle' && (
              <button onClick={launch} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Launch</button>
            )}
            {status === 'connecting' && <span className="text-xs text-gray-400">{message || 'Connecting…'}</span>}
            {isCoder && status === 'error' && (
              <button onClick={launch} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Retry</button>
            )}
            <button
              onClick={() => setMinimized(true)}
              aria-label="Minimize terminal"
              className="px-2 text-lg leading-none text-gray-300 hover:text-white"
            >
              –
            </button>
          </div>
        </div>

        {!isCoder ? (
          <div className="p-3 text-sm text-gray-300">
            Coder access is required to run this terminal.{' '}
            <a href="/account" className="text-indigo-400 underline">Request access</a>.
          </div>
        ) : (
          <>
            {status === 'error' && <p className="px-3 pt-2 text-xs text-red-400">{message}</p>}
            <div ref={mountRef} style={{ height: 320 }} className="p-2" />
          </>
        )}
      </div>
    </>
  );
}

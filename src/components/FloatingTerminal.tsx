'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTerminalSession } from '@/lib/useTerminalSession';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';

const MIN_W = 320;
const MIN_H = 160;

export default function FloatingTerminal({ labId }: { labId: LabId }) {
  const { loading, isCoder, status, message, mountRef, launch, refit } = useTerminalSession(labId);
  const [minimized, setMinimized] = useState(false);
  const [size, setSize] = useState({ w: 480, h: 320 });
  const label = TERMINAL_LABS[labId];

  if (loading) return null;

  function restore() {
    setMinimized(false);
    requestAnimationFrame(() => requestAnimationFrame(() => refit()));
  }

  // Drag the top-left grip to resize; the panel is docked bottom-right, so dragging
  // up/left enlarges it. xterm auto-refits via the hook's ResizeObserver.
  function startResize(e: ReactPointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const maxW = window.innerWidth - 32;
    const maxH = window.innerHeight - 120;
    const onMove = (ev: PointerEvent) => {
      setSize({
        w: Math.min(maxW, Math.max(MIN_W, startW + (startX - ev.clientX))),
        h: Math.min(maxH, Math.max(MIN_H, startH + (startY - ev.clientY))),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
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
        style={{ display: minimized ? 'none' : 'block', width: size.w }}
        className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-700 bg-black shadow-2xl"
      >
        {/* Resize grip (top-left): drag to resize the corner-docked panel. */}
        <div
          onPointerDown={startResize}
          aria-label="Resize terminal"
          title="Drag to resize"
          style={{ touchAction: 'none' }}
          className="absolute left-0 top-0 z-10 h-4 w-4 cursor-nwse-resize rounded-tl-lg hover:bg-white/10"
        />
        <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
          <span className="text-xs font-medium text-gray-300">{label} terminal</span>
          <div className="flex items-center gap-2">
            {isCoder && status === 'idle' && (
              <button onClick={launch} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Launch</button>
            )}
            {status === 'connecting' && <span className="text-xs text-gray-400">{message || 'Connecting…'}</span>}
            {status === 'connected' && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-400" /> live
              </span>
            )}
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
            <div ref={mountRef} style={{ height: size.h }} className="p-2" />
          </>
        )}
      </div>
    </>
  );
}

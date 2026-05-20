import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Play, Plus, Download } from 'lucide-react';
import { getDownloadUrl } from '../api/subsonic';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../lib/i18n';

export default function TrackMenu({ song }: { song: any }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const playAfterCurrent = usePlayerStore(state => state.playAfterCurrent);
  const addToQueue = usePlayerStore(state => state.addToQueue);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  // Close on outside click
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [portalStyle, setPortalStyle] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // Position portal near button on open
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = rect.right - 208; // align right edge of menu (width ~208px) to button
    const top = rect.bottom + 8;
    setPortalStyle({ left: Math.max(8, left), top });
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="ml-2 flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 bg-white/10 dark:bg-black/20 hover:opacity-100 hover:scale-110 dark:text-zinc-300 border border-white/10 shadow-sm transition-all duration-300"
        aria-label="Track options"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && buttonRef.current && typeof document !== 'undefined' && createPortal(
        <div
          style={portalStyle ? { position: 'fixed', left: portalStyle.left, top: portalStyle.top } : { position: 'fixed', left: 0, top: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="animate-in fade-in zoom-in duration-200"
        >
          <div className="w-52 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl z-[99999] p-1 animate-in fade-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => { playAfterCurrent(song); setOpen(false); }}
              className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 hover:translate-x-1"
            >
              <Play size={16} />
              <span>{t('playNextInQueue')}</span>
            </button>
            <button
              onClick={() => { addToQueue(song); setOpen(false); }}
              className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 hover:translate-x-1"
            >
              <Plus size={16} />
              <span>{t('addToQueue')}</span>
            </button>
            <a
              href={getDownloadUrl(song.id)}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 hover:translate-x-1"
            >
              <Download size={16} />
              <span>{t('downloadTrack')}</span>
            </a>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

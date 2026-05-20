import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Download } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { getCoverArtUrl, getStreamUrl, getDownloadUrl } from '../api/subsonic';
import { useI18n } from '../lib/i18n';
import { useAuthStore } from '../store/authStore';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function supportsMediaSession() {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined';
}

export default function PlayerBar({ onOpenNowPlaying, onArtistClick }: { onOpenNowPlaying: () => void, onArtistClick?: (artistId: string) => void }) {
  const { t } = useI18n();
  const streamTranscoding = useAuthStore(state => state.streamTranscoding);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMediaSongIdRef = useRef<string | null>(null);
  // Use shared audio manager to avoid audio element unmounting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('../lib/audioManager').then((mod) => {
        audioRef.current = mod.getSharedAudio();
      });
    }
  }, []);
  const pendingPlayRef = useRef(false);
  const { 
    currentSong, isPlaying, volume, currentTime, duration, seekTo,
    setIsPlaying, setCurrentTime, setDuration, playNext, playPrev, setVolume, setSeekTo
  } = usePlayerStore();

  const [localTime, setLocalTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [isLightCover, setIsLightCover] = useState(false);
  const { theme } = useAuthStore();

  // Sync localTime with currentTime unless dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const coverArt = currentSong ? getCoverArtUrl(currentSong.coverArt || currentSong.albumId) : '';
  const streamUrl = currentSong ? getStreamUrl(currentSong.id) : '';

  useEffect(() => {
    if (!coverArt) { setDominantColor(null); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const sampleSize = 40;
        canvas.width = sampleSize; canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const data = ctx.getImageData(0,0,sampleSize,sampleSize).data;
        const buckets: Record<string, number> = {};
        let max = 0; let dominant = { r: 18, g: 18, b: 18 };
        for (let i=0;i<data.length;i+=4){
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 128) continue;
          const key = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
          buckets[key] = (buckets[key]||0)+1;
          if (buckets[key] > max){ max = buckets[key]; dominant = {r,g,b}; }
        }
        let { r, g, b } = dominant;
        const hsp = Math.sqrt(0.299*(r*r)+0.587*(g*g)+0.114*(b*b));
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
        setIsLightCover(hsp > 150);
      } catch (e) {
        setDominantColor(null);
      }
    };
    img.src = coverArt;
  }, [coverArt]);

  const requestPlayback = () => {
    const audio = audioRef.current;
    if (!audio || pendingPlayRef.current) return;

    pendingPlayRef.current = true;
    audio.play()
      .then(() => {
        if (supportsMediaSession()) {
          navigator.mediaSession.playbackState = 'playing';
        }
      })
      .catch(e => console.error("Playback failed:", e))
      .finally(() => {
        pendingPlayRef.current = false;
      });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;

    pendingPlayRef.current = false;
    try { audio.pause(); } catch (e) {}
    try { audio.removeAttribute && audio.removeAttribute('src'); } catch (e) {}
    try { audio.load && audio.load(); } catch (e) {}
    try { audio.crossOrigin = 'anonymous'; } catch (e) {}
    audio.src = streamUrl;
    try { audio.load && audio.load(); } catch (e) {}

    setCurrentTime(0);
    setLocalTime(0);
    setDuration(currentSong?.duration || 0);

    // Start playback only after the media can play to ensure audio/data loaded
    const onCanPlay = () => {
      if (isPlaying) requestPlayback();
      audio.removeEventListener('canplay', onCanPlay);
    };

    if (audio.readyState >= 3) {
      // HAVE_FUTURE_DATA / HAVE_ENOUGH_DATA
      if (isPlaying) requestPlayback();
    } else {
      audio.addEventListener('canplay', onCanPlay);
    }

    // Fallback: if playback was requested but not started within 8s, try once more
    const fallback = setTimeout(() => {
      if (isPlaying) requestPlayback();
    }, 8000);

    return () => clearTimeout(fallback);
  }, [streamUrl, audioRef.current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      requestPlayback();
    } else {
      pendingPlayRef.current = false;
      try { audio.pause(); } catch (e) {}
    }
  }, [isPlaying]);

  useEffect(() => {
    // Only update MediaSession artwork/metadata once per song id
    if (!currentSong || !supportsMediaSession()) return;

    if (lastMediaSongIdRef.current === currentSong.id) return;

    const coverId = currentSong.coverArt || currentSong.albumId;
    const baseArtwork = coverId
      ? [96, 128, 192, 256, 384, 512].map((size) => ({ src: getCoverArtUrl(coverId, size), sizes: `${size}x${size}` }))
      : [];

    let createdUrls: string[] = [];

    // Set basic metadata immediately (without artwork) so lock screen shows title/artist quickly
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || t('title'),
        artist: currentSong.artist || t('artist'),
        album: currentSong.album || '',
        artwork: [],
      });
      document.title = `${currentSong.title} - ${currentSong.artist}`;
    } catch (error) {
      console.error('Media metadata basic set failed:', error);
    }

    const setup = async () => {
      const fetched = await Promise.all(
        baseArtwork.map(async (a) => {
          try {
            const resp = await fetch(a.src, { mode: 'cors' });
            if (!resp.ok) throw new Error('fetch failed');
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            return { src: url, sizes: a.sizes };
          } catch (e) {
            return a;
          }
        })
      );

      try {
        // Update metadata with artwork when available
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title || t('title'),
          artist: currentSong.artist || t('artist'),
          album: currentSong.album || '',
          artwork: fetched,
        });
        lastMediaSongIdRef.current = currentSong.id;
      } catch (error) {
        console.error('Media metadata update failed:', error);
      }

      const setActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
          console.error(`Media session action failed: ${action}`, error);
        }
      };

      setActionHandler('play', () => setIsPlaying(true));
      setActionHandler('pause', () => setIsPlaying(false));
      setActionHandler('previoustrack', playPrev);
      setActionHandler('nexttrack', playNext);
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    };

    setup();

    return () => {
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [currentSong?.id]);

  useEffect(() => {
    if (!supportsMediaSession()) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : currentSong?.duration || 0;
    const safePosition = Number.isFinite(currentTime) ? Math.min(Math.max(currentTime, 0), safeDuration || currentTime) : 0;
    if (safeDuration > 0 && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: safeDuration,
          playbackRate: audioRef.current?.playbackRate || 1,
          position: safePosition,
        });
      } catch (error) {
        console.error('Media position state failed:', error);
      }
    }
  }, [currentSong?.id, isPlaying, currentTime, duration]);

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, streamTranscoding]);

  // Handle seek from outside
  useEffect(() => {
    if (seekTo !== null && audioRef.current) {
      audioRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
      setSeekTo(null);
    }
  }, [seekTo]);

  // Prevent time jumps when dragging
  const handleTimeUpdate = () => {
    if (!isDragging && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : currentSong.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  if (!currentSong) return null;

  // Darker off-white for light theme to give more depth
  const playerBg = theme === 'light' ? '#e0e3e6' : (isLightCover ? '#000' : (dominantColor || undefined));
  const playerColor = theme === 'light' ? '#0f1724' : (isLightCover ? '#fff' : undefined);

  // Button/icon classes that adapt to theme
  const iconBtnClass = theme === 'light' ? 'text-zinc-700/90 hover:opacity-95 transition-opacity' : 'text-zinc-100/90 hover:opacity-90 transition-opacity';
  const controlBtnShared = 'flex items-center justify-center transition-all';
  const playBtnStyle = theme === 'light'
    ? { backgroundColor: 'transparent', color: '#0f1724', border: 'none', boxShadow: 'none' }
    : { backdropFilter: 'blur(6px)' };
  // For icon-only prev/next buttons we keep transparent visual but maintain hit-area
  const smallCtrlStyle = theme === 'light' ? { boxShadow: 'none', backgroundColor: 'transparent' } : { boxShadow: 'none', backgroundColor: 'transparent' };

  return (
    <div className="fixed left-4 right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] h-20 sm:h-24 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 backdrop-blur-3xl px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 text-zinc-900 dark:text-white pb-0 transition-colors z-50 lg:static lg:bottom-auto"
      style={{ backgroundColor: playerBg, color: playerColor, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={playNext}
      />

      {/* Now Playing Info (Apple Music-like compact card) */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer" onClick={onOpenNowPlaying}>
        <div className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {coverArt ? (
            <img src={coverArt} crossOrigin="anonymous" alt={currentSong.title} className="h-full w-full object-cover object-center" />
          ) : (
            <div className="h-full w-full bg-zinc-200 dark:bg-zinc-800" />
          )}
        </div>
        <div className="min-w-0 truncate">
          <h4 className="text-sm sm:text-base font-semibold truncate">{currentSong.title}</h4>
          <button 
            onClick={(e) => { e.stopPropagation(); onArtistClick && onArtistClick(currentSong.artistId); }}
            className="text-xs text-zinc-100/80 dark:text-zinc-200 truncate hover:underline"
          >
            {currentSong.artist}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-shrink-0 flex-col items-center justify-center sm:w-1/3 sm:min-w-[300px]">
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={playPrev} className={iconBtnClass + ' rounded-full ' + controlBtnShared} style={{ ...smallCtrlStyle, height: 40, width: 40 }} aria-label="Previous">
            <SkipBack size={18} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={controlBtnShared + ' h-10 w-10 sm:h-12 sm:w-12 rounded-full'}
            style={{ ...playBtnStyle, padding: 0 }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
          </button>
          <button onClick={playNext} className={iconBtnClass + ' rounded-full ' + controlBtnShared} style={{ ...smallCtrlStyle, height: 40, width: 40 }} aria-label="Next">
            <SkipForward size={18} />
          </button>
        </div>
        
        {/* Progress Bar (Hidden on ultra-small mobile, shown on SM+) */}
        <div className="hidden sm:flex w-full items-center gap-3 text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 group">
          <span className="w-10 text-right tabular-nums">{formatTime(localTime)}</span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={localTime || 0}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLocalTime(val);
                handleSeek(e);
              }}
              className="w-full h-1.5 appearance-none rounded-full bg-zinc-200 dark:bg-zinc-800 accent-zinc-500 focus:outline-none cursor-pointer
                [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0"
              style={{
                background: `linear-gradient(to right, rgba(161,161,170,0.8) ${((localTime || 0) / (duration || 100)) * 100}%, rgba(161,161,170,0.2) ${((localTime || 0) / (duration || 100)) * 100}%)`
              }}
            />
            {/* Custom thumb for player bar */}
            <div 
              className="absolute h-3 w-3 bg-zinc-500 rounded-full shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${((localTime || 0) / (duration || 100)) * 100}% - 6px)` }}
            />
          </div>
          <span className="w-10 tabular-nums">-{formatTime(duration - localTime)}</span>
        </div>
      </div>

      {/* Volume (Hidden on mobile) */}
      <div className="hidden md:flex items-center justify-end md:w-1/3 gap-4">
        <a 
          href={getDownloadUrl(currentSong.id)} 
          download 
          className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
          title={t('downloadTrack')}
        >
          <Download size={18} />
        </a>
        <div className="flex items-center gap-2">
          <Volume2 size={18} className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 cursor-pointer" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="h-1 w-20 appearance-none rounded-full bg-zinc-300 dark:bg-zinc-700 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #ef4444 ${volume * 100}%, rgba(148,163,184,0.2) ${volume * 100}%)`
            }}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

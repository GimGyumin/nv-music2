import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAlbum, getCoverArtUrl, getDownloadUrl } from '../api/subsonic';
import { Album, Song } from '../types/subsonic';
import { ArrowLeft, Play, Shuffle, Clock, Download } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../lib/i18n';
import TrackMenu from './TrackMenu';

interface AlbumDetailProps {
  albumId: string;
  onBack: () => void;
  onArtistClick?: (artistId: string) => void;
}

function formatDuration(seconds: number) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatMetadataDuration(seconds: number, locale: string) {
  if (!seconds) return locale === 'ko' ? '0분' : '0 minutes';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const roundedMinutes = minutes || (seconds > 0 ? 1 : 0);

  if (locale === 'ko') {
    if (hours > 0) {
      return roundedMinutes > 0 ? `${hours}시간 ${roundedMinutes}분` : `${hours}시간`;
    }
    return `${roundedMinutes}분`;
  }

  if (hours > 0) {
    return roundedMinutes > 0 ? `${hours} hr ${roundedMinutes} min` : `${hours} hr`;
  }

  return `${roundedMinutes} min`;
}

function formatDateParts(
  value: { year?: number; month?: number; day?: number },
  locale: string
) {
  const { year, month, day } = value;
  if (!year) return '';

  if (month && day) {
    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  if (month) {
    return locale === 'ko'
      ? `${year}년 ${month}월`
      : `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, month - 1, 1))} ${year}`;
  }

  return String(year);
}

function formatReleaseDate(album: Album, locale: string) {
  if (album.releaseDate) {
    if (typeof album.releaseDate === 'object') {
      return formatDateParts(album.releaseDate, locale);
    }

    const parsed = new Date(album.releaseDate);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(parsed);
    }
    return album.releaseDate;
  }

  if (album.originalReleaseDate?.year) {
    return formatDateParts(album.originalReleaseDate, locale);
  }

  if (album.year) return String(album.year);
  return '';
}

export default function AlbumDetail({ albumId, onBack, onArtistClick }: AlbumDetailProps) {
  const { t, language } = useI18n();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  
  const [isLight, setIsLight] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [albumMenuOpen, setAlbumMenuOpen] = useState(false);
  const albumMenuRef = useRef<HTMLDivElement | null>(null);
  const [descModalOpen, setDescModalOpen] = useState(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!albumMenuRef.current) return;
      const target = (e as MouseEvent).target as Node;
      if (!albumMenuRef.current.contains(target)) setAlbumMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);
  
  const { theme } = useAuthStore();
  const { setQueue, currentSong, isPlaying, addToQueue, playAfterCurrent } = usePlayerStore();

  useEffect(() => {
    let mounted = true;
    async function loadAlbum() {
      try {
        setLoading(true);
        const data = await getAlbum(albumId);
        if (mounted) setAlbum(data);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load album details');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAlbum();
    return () => { mounted = false; };
  }, [albumId]);

  // reset bgLoaded when switching albums
  useEffect(() => {
    setBgLoaded(false);
  }, [albumId]);

  const coverArt = album ? getCoverArtUrl(album.coverArt || album.id, 600) : '';

  useEffect(() => {
    if (!coverArt) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Sample the entire image to find the dominant color
      const sampleSize = 50;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      const buckets: Record<string, number> = {};
      let maxCount = 0;
      let dominant = { r: 18, g: 18, b: 18 };

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];
        
        if (a < 128) continue; // Skip transparent

        // Bucket by rounding to nearest 16 to group similar colors
        const bucket = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
        buckets[bucket] = (buckets[bucket] || 0) + 1;
        
        if (buckets[bucket] > maxCount) {
          maxCount = buckets[bucket];
          dominant = { r, g, b };
        }
      }
      
      let { r, g, b } = dominant;
      
      // Calculate variance to detect "dynamic/complex" images for fallback if needed
      // (Keeping simplified IS_COMPLEX check but using the mode color)
      let sumR = 0, sumG = 0, sumB = 0;
      const pixelCount = imageData.length / 4;
      for (let i = 0; i < imageData.length; i += 4) {
        sumR += imageData[i];
        sumG += imageData[i + 1];
        sumB += imageData[i + 2];
      }
      const avgR = sumR / pixelCount;
      const avgG = sumG / pixelCount;
      const avgB = sumB / pixelCount;
      
      let variance = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        variance += Math.pow(imageData[i] - avgR, 2) + Math.pow(imageData[i+1] - avgG, 2) + Math.pow(imageData[i+2] - avgB, 2);
      }
      const stdDev = Math.sqrt(variance / (pixelCount * 3));
      
      // If the image is extremely busy/complex (> 150 variance), use a neutral deep color
      if (stdDev > 150) {
        r = 18; g = 18; b = 18;
      }
      
      // If dark mode is active, ensure it's not too bright.
      if (theme === 'dark') {
        const factor = 0.2; // Darken for dark mode
        r = Math.floor(r * factor);
        g = Math.floor(g * factor);
        b = Math.floor(b * factor);
      }
      
      // Calculate brightness (HSP)
      const hsp = Math.sqrt(
        0.299 * (r * r) +
        0.587 * (g * g) +
        0.114 * (b * b)
      );
      
      setDominantColor(`rgb(${r}, ${g}, ${b})`);
      setIsLight(hsp > 150); 
      setBgLoaded(true);
    };
    img.src = coverArt;
  }, [coverArt, theme]);

  // If there's no coverArt, allow rendering immediately
  useEffect(() => {
    if (!coverArt) setBgLoaded(true);
  }, [coverArt]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-red-500"></div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <p className="text-red-500">{error || t('albumNotFound')}</p>
        <button onClick={onBack} className="mt-4 text-red-500 hover:text-red-600 font-bold">{t('goBack')}</button>
      </div>
    );
  }

  const coverArtURL = getCoverArtUrl(album.coverArt || album.id, 600);
  const songs = album.song || [];
  const totalDuration = album.duration || songs.reduce((sum, song) => sum + (song.duration || 0), 0);
  const copyright = album.copyright || songs.find((song) => song.copyright)?.copyright || '';
  const releaseDate = formatReleaseDate(album, language);
  const metadataDuration = formatMetadataDuration(totalDuration, language);
  
  const groupedSongs: Record<string, typeof songs> = {};
  songs.forEach(song => {
    const disc = song.discNumber || 1;
    if (!groupedSongs[disc]) groupedSongs[disc] = [];
    groupedSongs[disc].push(song);
  });
  const discs = Object.keys(groupedSongs).sort((a, b) => Number(a) - Number(b));
  const hasMultipleDiscs = discs.length > 1;
  // Wait until background color is ready before rendering main content
  if (!bgLoaded) {
    return (
      <div 
        className="flex h-full items-center justify-center p-8 min-h-[100dvh]"
        style={{ backgroundColor: dominantColor || (theme === 'dark' ? '#09090b' : '#ffffff') }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-red-500"></div>
      </div>
    );
  }
  // Smooth color variants for CSS (use rgba with alpha so we can animate opacity)
  const radialColor = dominantColor ? dominantColor.replace('rgb(', 'rgba(').replace(')', ', 0.35)') : undefined;
  const linearColor = dominantColor ? dominantColor.replace('rgb(', 'rgba(').replace(')', ', 0.06)') : undefined;
  
  const handlePlayAlbum = () => {
    if (songs.length > 0) {
      setQueue(songs, 0);
    }
  };

  const handleShufflePlay = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
    }
  };

  const handlePlaySong = (index: number) => {
    setQueue(songs, index);
  };

  return (
    <div 
      className="relative min-h-[100dvh] overflow-hidden"
      style={{
        backgroundColor: dominantColor || (theme === 'dark' ? '#09090b' : '#ffffff')
      }}
    >
      <div className="relative pb-32">
        {/* Smooth background layers - no sharp lines */}
        <div 
          className="absolute inset-0 pointer-events-none -z-10 transition-opacity duration-700"
          style={{
            background: radialColor ? `radial-gradient(ellipse 120% 80% at 50% -10%, ${radialColor} 0%, rgba(0,0,0,0) 70%)` : undefined,
            filter: 'blur(80px)',
            opacity: dominantColor ? 1 : 0,
            willChange: 'opacity'
          }}
        />
        <div 
          className="absolute inset-0 pointer-events-none -z-10 transition-opacity duration-900"
          style={{
            background: linearColor ? `linear-gradient(to bottom, ${linearColor} 0%, rgba(0,0,0,0) 100%)` : undefined,
            opacity: dominantColor ? 1 : 0,
            willChange: 'opacity'
          }}
        />

        {/* Header with back button (menu moved beside shuffle) */}
        <div className="px-6 pt-6 lg:pt-6 text-left flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
          <button
            onClick={onBack}
            aria-label="Back"
            style={{ backgroundColor: dominantColor || undefined, color: isLight ? 'black' : 'white' }}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/20 shadow-sm transition-all duration-300 hover:opacity-80 hover:scale-110 active:scale-95`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {/* menu relocated to action buttons */}
        </div>

        <div className="flex flex-col items-center gap-8 px-6 mt-8 text-center md:flex-row md:items-start md:gap-10 md:text-left animate-in fade-in duration-700 delay-200">
          {/* Album Cover */}
          <div className="w-56 flex-shrink-0 sm:w-64 lg:w-72 animate-in fade-in zoom-in duration-700 delay-300">
            <div className={`aspect-square overflow-hidden rounded-3xl transition-all duration-300 hover:scale-105 ${isLight ? 'bg-black/10 shadow-2xl' : 'bg-white/10 shadow-2xl'}`}>
              {coverArtURL ? (
                <img src={coverArtURL} alt={album.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
          </div>

          {/* Album Info */}
          <div className="flex flex-col items-center justify-end pb-4 md:items-start animate-in fade-in slide-in-from-right duration-700 delay-400">
            <h1 className={`text-3xl sm:text-5xl font-extrabold tracking-tight transition-colors mb-3 drop-shadow-sm ${isLight ? 'text-zinc-900' : 'text-white'}`}>{album.name}</h1>
            <button 
               onClick={() => onArtistClick && onArtistClick(album.artistId)}
               className={`text-xl sm:text-2xl font-bold mb-6 hover:underline text-center md:text-left cursor-pointer transition-all w-fit drop-shadow-sm ${isLight ? 'text-red-700' : 'text-red-400'}`}
            >
              {album.artist}
            </button>
            <p className={`text-sm uppercase tracking-widest font-bold mb-8 transition-colors drop-shadow-sm opacity-80 ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`}>
              {album.genre && `${album.genre} • `}
              {album.year && `${album.year} • `}
              {t('songCount', { count: album.songCount })}
            </p>
            
            <div className="flex items-center justify-center gap-4 md:justify-start animate-in fade-in slide-in-from-bottom duration-500 delay-300">
              <button 
                onClick={handlePlayAlbum}
                className={`flex items-center gap-2 rounded-full px-10 py-4 text-base font-bold transition-all active:scale-95 hover:shadow-lg hover:scale-105 ${isLight ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-red-500 text-white hover:bg-red-600 shadow-xl shadow-red-500/20'}`}
              >
                <Play size={20} className="fill-current" />
                {t('play')}
              </button>
              <button 
                onClick={handleShufflePlay}
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-xl hover:scale-125 hover:shadow-2xl transition-all active:scale-95 border border-white/10 duration-300"
                style={{ 
                  backgroundColor: dominantColor || undefined,
                  color: isLight ? 'black' : 'white',
                  filter: isLight ? 'brightness(0.9) contrast(1.2)' : 'brightness(1.5) contrast(1.1)'
                }}
              >
                <Shuffle size={24} />
              </button>
              {/* Album menu moved next to shuffle */}
              <div className="relative ml-2 animate-in fade-in" ref={albumMenuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setAlbumMenuOpen((v) => !v); }}
                  aria-label="Album menu"
                  style={{ backgroundColor: dominantColor || undefined, color: isLight ? 'black' : 'white' }}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 dark:bg-black/20 shadow-sm transition-all duration-300 hover:opacity-95 hover:scale-110 active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" fill="currentColor"/></svg>
                </button>

                {albumMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl z-[99999] animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); songs.slice().reverse().forEach((s) => playAfterCurrent(s)); setAlbumMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 hover:translate-x-1 rounded-md">{t('playNextInQueue')}</button>
                    <button onClick={(e) => { e.stopPropagation(); songs.forEach((s) => addToQueue(s)); setAlbumMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 hover:translate-x-1 rounded-md">Add Album to Queue</button>
                    <a href={getDownloadUrl(album.id)} download onClick={(e) => e.stopPropagation()} className="block px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 hover:translate-x-1 rounded-md">{t('downloadAlbum')}</a>
                  </div>
                )}
              </div>
            </div>

            {/* Album description (from tags/metadata) - shows Comment/Description and supports collapse */}
            {(() => {
              try { console.debug('AlbumDetail album:', album); } catch (e) {}
              const a = album as any;
              let desc = a.comment || a.description || a.annotation || a.summary || a.notes || a['album-description'] || '';
              // try first song-level annotations
              if (!desc && Array.isArray(a.song) && a.song.length > 0) {
                const s0 = a.song[0] as any;
                desc = s0.comment || s0.annotation || s0.notes || '';
              }
              // try nested metadata
              if (!desc && a.metadata) {
                desc = a.metadata.comment || a.metadata.description || '';
              }

              if (!desc) {
                return null;
              }

              return (
                <div className="mt-8 px-4 text-sm leading-relaxed max-w-4xl mx-auto relative z-60 mb-4 lg:mb-4">
                  <div
                    className={`prose prose-sm dark:prose-invert ${isLight ? 'text-zinc-900' : 'text-white'} dark:text-zinc-200`}
                    style={{ maxHeight: '4.5em', overflow: 'hidden' }}
                    dangerouslySetInnerHTML={{ __html: desc }}
                  />
                  <div className="text-right mt-2">
                    <button onClick={(e) => { e.stopPropagation(); setDescModalOpen(true); }} className="text-sm font-medium text-red-500 transition-all duration-200 hover:scale-110 hover:font-semibold">더보기</button>
                  </div>
                  
                  {descModalOpen && createPortal(
                    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 animate-in fade-in duration-200" onClick={() => setDescModalOpen(false)}>
                      <div className="w-11/12 max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
                        <div
                          className={`prose prose-sm dark:prose-invert ${isLight ? 'text-zinc-900' : 'text-zinc-900 dark:text-white'}`}
                          dangerouslySetInnerHTML={{ __html: desc }}
                        />
                        <button
                          onClick={() => setDescModalOpen(false)}
                          className="mt-6 w-full py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-all duration-200 hover:scale-105"
                        >
                          닫기
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              );
            })()}

            
          </div>
        </div>

        {/* Tracklist - Inherits main background */}
        <div className="mt-2 min-h-[50vh] animate-in fade-in duration-700 delay-500">
          <div className="px-6 pt-1.5">
            <div className={`flex items-center text-xs font-black uppercase tracking-[0.2em] pb-4 border-b mb-4 px-4 transition-colors ${isLight ? 'text-black/40 border-black/10' : 'text-white/40 border-white/10'}`}>
              <div className="w-12 text-right mr-4 font-bold opacity-60">#</div>
              <div className="flex-1">{t('title')}</div>
              <div className="w-20 flex justify-end"><Clock size={16} className="opacity-60" /></div>
            </div>
            
            <div className="space-y-1">
              {discs.map(disc => (
                <div key={`disc-${disc}`} className="mb-6 last:mb-0">
                  {hasMultipleDiscs && (
                    <div className={`flex items-center gap-2 px-4 py-3 mt-4 text-xs font-bold uppercase tracking-widest ${isLight ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      <div className={`h-px flex-1 ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />
                      <span>{t('disc', { disc })}</span>
                      <div className={`h-px flex-1 ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />
                    </div>
                  )}
                  <div className="space-y-1">
                    {groupedSongs[disc].map((song) => {
                      const originalIndex = songs.indexOf(song);
                      const isActive = currentSong?.id === song.id;
                      
                      return (
                          <div 
                          key={song.id}
                          onClick={() => handlePlaySong(originalIndex)}
                          onDoubleClick={() => handlePlaySong(originalIndex)}
                          className={`group flex items-center rounded-xl px-4 py-2 text-sm transition-all duration-300 cursor-pointer touch-manipulation hover:translate-x-1 animate-in fade-in ${isActive ? (isLight ? 'bg-black/10 shadow-sm' : 'bg-white/20 shadow-sm') : (isLight ? 'hover:bg-black/5' : 'hover:bg-white/5')}`}
                        >
                          <div className={`w-12 text-right mr-4 tabular-nums font-bold ${isLight ? 'text-black' : 'text-white'}`}>
                            {/* Number / Play Button Toggle */}
                            <div className="relative flex justify-end h-4 items-center">
                              <div className={`group-hover:opacity-0 w-full text-right ${isActive && isPlaying ? 'flex justify-end gap-0.5 h-3' : ''}`}>
                                {isActive && isPlaying ? (
                                  <>
                                    <div className="w-0.5 bg-red-500 animate-music-bar-1" />
                                    <div className="w-0.5 bg-red-500 animate-music-bar-2" />
                                    <div className="w-0.5 bg-red-500 animate-music-bar-3" />
                                  </>
                                ) : (
                                  song.track || (originalIndex + 1)
                                )}
                              </div>
                              <button 
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handlePlaySong(originalIndex);
                                }}
                                className={`absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity ${isLight ? 'text-zinc-900' : 'text-white'}`}
                              >
                                <Play size={14} className="fill-current" />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 font-bold truncate pr-4">
                            <span className={`transition-all duration-300 block ${isActive ? 'text-red-500' : (isLight ? 'text-zinc-900 group-hover:translate-x-1.5' : 'text-white group-hover:translate-x-1.5')}`}>
                              {song.title}
                            </span>
                          </div>
                          <div className={`w-20 text-right tabular-nums font-mono text-xs font-bold ${isLight ? 'text-black/50' : 'text-white/50'} flex items-center justify-end gap-3`}>
                            <div className="mr-1">{formatDuration(song.duration)}</div>
                            <div>
                              <TrackMenu song={song} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-8 border-t px-4 py-8 text-left text-base font-semibold leading-tight transition-colors sm:text-lg ${isLight ? 'border-black/10 text-black/50' : 'border-white/10 text-white/55'}`}>
              {releaseDate && <p>{releaseDate}</p>}
              <p>{t('albumItemSummary', { count: album.songCount || songs.length, duration: metadataDuration })}</p>
              {copyright && <p className="mt-1 break-words">{copyright}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

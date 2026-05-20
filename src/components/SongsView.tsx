import { useEffect, useState, useMemo } from 'react';
import { getRandomSongs, getCoverArtUrl } from '../api/subsonic';
import { Play, ListFilter } from 'lucide-react';
import TrackMenu from './TrackMenu';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../lib/i18n';

type SortKey = 'title' | 'artist' | 'album' | 'year' | 'duration';

export default function SongsView() {
  const { t } = useI18n();
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const setQueue = usePlayerStore(state => state.setQueue);

  useEffect(() => {
    let mounted = true;
    async function loadSongs() {
      try {
        setLoading(true);
        const data = await getRandomSongs(100);
        if (mounted) setSongs(data);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load songs');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSongs();
    return () => { mounted = false; };
  }, []);

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'year') {
        valA = a.year || 0;
        valB = b.year || 0;
      }

      if (typeof valA === 'string' || typeof valB === 'string') {
        const strA = (valA || '').toString();
        const strB = (valB || '').toString();
        const comparison = strA.localeCompare(strB);
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      if (sortOrder === 'asc') return (valA as number || 0) - (valB as number || 0);
      return (valB as number || 0) - (valA as number || 0);
    });
  }, [songs, sortBy, sortOrder]);

  const handlePlaySong = (index: number) => {
    setQueue(sortedSongs, index);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-8 pb-32 max-w-7xl mx-auto w-full pt-16 lg:pt-8">
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-4 overflow-x-auto no-scrollbar">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white shrink-0">{t('songs')}</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {songs.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative group/sort">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer pr-10 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  <option value="title">{t('title')}</option>
                  <option value="artist">{t('artist')}</option>
                  <option value="album">{t('album')}</option>
                  <option value="year">{t('year')}</option>
                  <option value="duration">{t('duration')}</option>
                </select>
                <ListFilter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500" />
              </div>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-500 transition-all active:scale-95"
                title={sortOrder === 'asc' ? t('sortAscending') : t('sortDescending')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          )}
          {songs.length > 0 && (
            <button 
              onClick={() => handlePlaySong(0)}
              className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-2.5 font-bold text-white transition-all hover:bg-red-600 hover:scale-105 shadow-lg shadow-red-500/20 active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Play size={20} className="fill-current" />
              {t('playAll')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-red-500"></div>
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sortedSongs.map((song, index) => (
            <div 
              key={song.id}
              onClick={() => handlePlaySong(index)}
              className="group flex cursor-pointer touch-manipulation items-center gap-4 rounded-xl p-3.5 sm:p-3 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-100 dark:border-transparent transition-all"
            >
              <div className="w-8 text-center text-sm font-medium text-zinc-400 group-hover:hidden">
                {index + 1}
              </div>
              <div className="hidden w-8 justify-center text-red-500 group-hover:flex">
                <Play size={16} className="fill-current" />
              </div>

              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
                {song.coverArt ? (
                  <img loading="lazy" src={getCoverArtUrl(song.coverArt, 100)} alt={song.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700" />
                )}
              </div>

              <div className="flex flex-1 flex-col truncate">
                <span className="truncate font-semibold text-zinc-900 dark:text-white group-hover:text-red-500 transition-colors">
                  {song.title}
                </span>
                <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">{song.artist}</span>
              </div>

              <div className="hidden w-1/4 truncate text-sm text-zinc-500 dark:text-zinc-400 md:block">
                {song.album}
              </div>

              <div className="flex items-center gap-2">
                <div className="w-16 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {formatDuration(song.duration)}
                </div>
                <TrackMenu song={song} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

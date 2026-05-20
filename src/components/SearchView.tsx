import { useState, useEffect, useRef } from 'react';
import { search, getCoverArtUrl } from '../api/subsonic';
import { Play, Search as SearchIcon } from 'lucide-react';
import TrackMenu from './TrackMenu';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../lib/i18n';

interface SearchViewProps {
  onAlbumClick: (albumId: string) => void;
  onArtistClick: (artistId: string) => void;
}

export default function SearchView({ onAlbumClick, onArtistClick }: SearchViewProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setQueue = usePlayerStore(state => state.setQueue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      
      try {
        setLoading(true);
        const data = await search(query);
        setResults(data);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handlePlaySong = (index: number) => {
    if (results?.song) {
      setQueue(results.song, index);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-8 pb-32 max-w-[1600px] mx-auto w-full pt-16 lg:pt-8">
      <div className="mb-8">
        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <SearchIcon className="w-6 h-6 text-zinc-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="block w-full rounded-2xl border-0 bg-zinc-100 dark:bg-zinc-900/80 py-4 pl-14 pr-4 text-zinc-900 dark:text-white ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-inset focus:ring-red-500 transition-all text-lg font-medium shadow-sm"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-red-500"></div>
        </div>
      )}

      {error && (
        <div className="p-4 text-red-500 font-medium">{error}</div>
      )}

      {!loading && !error && results && (
        <div className="space-y-12">
          {results.song && results.song.length > 0 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">{t('songs')}</h2>
              <div className="space-y-1">
                {results.song.map((song: any, index: number) => (
                  <div 
                    key={song.id}
                    onClick={() => handlePlaySong(index)}
                    className="group flex cursor-pointer touch-manipulation items-center gap-4 rounded-xl p-3.5 sm:p-3 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all border border-zinc-100 dark:border-transparent"
                  >
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800 relative border border-zinc-200 dark:border-transparent">
                      {song.coverArt ? (
                        <img loading="lazy" src={getCoverArtUrl(song.coverArt, 100)} alt={song.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <Play size={16} className="fill-current text-white" />
                      </div>
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
            </div>
          )}

          {results.artist && results.artist.length > 0 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">{t('artists')}</h2>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {results.artist.map((artist: any) => (
                  <div 
                    key={artist.id} 
                    className="group cursor-pointer space-y-3"
                    onClick={() => onArtistClick(artist.id)}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-lg transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl border border-zinc-200 dark:border-transparent">
                      {artist.coverArt ? (
                        <img loading="lazy" src={getCoverArtUrl(artist.coverArt)} alt={artist.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-zinc-400 dark:text-zinc-600 bg-zinc-200 dark:bg-zinc-800">
                          {artist.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-red-500 transition-colors">
                        {artist.name}
                      </h3>
                      {artist.albumCount && (
                        <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {t('albumCount', { count: artist.albumCount })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.album && results.album.length > 0 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">{t('albums')}</h2>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {results.album.map((album: any) => (
                  <div 
                    key={album.id} 
                    className="group cursor-pointer space-y-3"
                    onClick={() => onAlbumClick(album.id)}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 shadow-lg transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl border border-zinc-200 dark:border-transparent">
                      <img loading="lazy" src={getCoverArtUrl(album.coverArt || album.id)} alt={album.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-xl hover:scale-105 transition-transform">
                          <Play size={24} className="fill-current ml-1" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-red-500 transition-colors">
                        {album.name}
                      </h3>
                      <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {album.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {(!results.song || results.song.length === 0) && 
           (!results.album || results.album.length === 0) && 
           (!results.artist || results.artist.length === 0) && (
             <div className="text-center py-12 text-zinc-500">
               {t('noResultsFor', { query })}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

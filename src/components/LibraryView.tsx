import { useEffect, useState } from 'react';
import { getAlbums, getCoverArtUrl } from '../api/subsonic';
import { fetchSubsonic } from '../api/subsonic';
import { Album } from '../types/subsonic';
import { Play } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface LibraryViewProps {
  viewType: 'albums' | 'artists';
  onAlbumClick: (albumId: string) => void;
  onArtistClick: (artistId: string) => void;
}

export default function LibraryView({ viewType, onAlbumClick, onArtistClick }: LibraryViewProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadItems() {
      try {
        setLoading(true);
        if (viewType === 'albums') {
          const data = await getAlbums('alphabeticalByName', 500);
          if (mounted) setItems(data);
        } else {
          // fetch artists
          const response = await fetchSubsonic<any>('getArtists.view', '');
          const indices = response['subsonic-response'].artists?.index || [];
          let allArtists: any[] = [];
          for (const index of indices) {
             if (index.artist) {
                allArtists = allArtists.concat(index.artist);
             }
          }
          if (mounted) setItems(allArtists);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || `Failed to load ${viewType}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadItems();
    return () => { mounted = false; };
  }, [viewType]);

  return (
    <div className="p-4 sm:p-8 pb-32 max-w-[1600px] mx-auto w-full pt-16 lg:pt-8">
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white capitalize transition-colors">
          {viewType === 'albums' ? t('albums') : t('artists')}
        </h1>
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
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => {
            const isAlbum = viewType === 'albums';
            const coverArt = isAlbum ? getCoverArtUrl(item.coverArt || item.id) : (item.coverArt ? getCoverArtUrl(item.coverArt) : '');
            
            return (
              <div 
                key={item.id} 
                className="group cursor-pointer space-y-3"
                onClick={() => isAlbum ? onAlbumClick(item.id) : onArtistClick(item.id)}
              >
                <div className={`relative aspect-square overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-lg transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl border border-zinc-200 dark:border-transparent ${isAlbum ? 'rounded-xl' : 'rounded-full'}`}>
                  {coverArt ? (
                    <img
                      src={coverArt}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-zinc-400 dark:text-zinc-600 bg-zinc-200 dark:bg-zinc-800">
                      {item.name[0]}
                    </div>
                  )}
                  {isAlbum && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <button className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-xl hover:scale-105 transition-transform">
                        <Play size={24} className="fill-current ml-1" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={isAlbum ? '' : 'text-center'}>
                  <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-red-500 transition-colors">
                    {item.name}
                  </h3>
                  {isAlbum && item.artist ? (
                    <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.artist}
                    </p>
                  ) : !isAlbum && item.albumCount ? (
                    <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('albumCount', { count: item.albumCount })}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

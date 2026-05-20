import { useEffect, useState } from 'react';
import { getAlbums, getCoverArtUrl } from '../api/subsonic';
import { Album } from '../types/subsonic';
import { Play } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../lib/i18n';

interface AlbumListProps {
  onAlbumClick: (albumId: string) => void;
}

export default function AlbumList({ onAlbumClick }: AlbumListProps) {
  const { t } = useI18n();
  const [newestAlbums, setNewestAlbums] = useState<Album[]>([]);
  const [frequentAlbums, setFrequentAlbums] = useState<Album[]>([]);
  const [randomAlbums, setRandomAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadAllAlbums() {
      try {
        setLoading(true);
        const [newest, frequent, random] = await Promise.all([
          getAlbums('newest', 12),
          getAlbums('frequent', 12),
          getAlbums('random', 12),
        ]);
        if (mounted) {
          setNewestAlbums(newest);
          setFrequentAlbums(frequent);
          setRandomAlbums(random);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load albums');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAllAlbums();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const renderAlbumRow = (title: string, albums: Album[]) => {
    if (albums.length === 0) return null;
    return (
      <div className="mb-12">
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">{title}</h2>
        <div className="flex overflow-x-auto no-scrollbar gap-6 pb-4">
          {albums.map((album) => {
            const coverArt = getCoverArtUrl(album.coverArt || album.id);
            return (
              <div 
                key={album.id} 
                className="group cursor-pointer space-y-3 w-40 sm:w-48 md:w-56 flex-shrink-0"
                onClick={() => onAlbumClick(album.id)}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 shadow-lg transition-transform duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
                  {coverArt ? (
                    <img
                      src={coverArt}
                      alt={album.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  
                  {/* Hover Play Gradient Overlay */}
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
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 pb-32 max-w-[1600px] mx-auto w-full pt-16 lg:pt-8">
      {renderAlbumRow(t('recentlyAdded'), newestAlbums)}
      {renderAlbumRow(t('frequentlyPlayed'), frequentAlbums)}
      {renderAlbumRow(t('recommendations'), randomAlbums)}
    </div>
  );
}

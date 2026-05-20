import { useEffect, useState } from 'react';
import { getArtist, getArtistSongs, getCoverArtUrl, getDownloadUrl } from '../api/subsonic';
import { Album, Song } from '../types/subsonic';
import { ArrowLeft, Play, Clock, Download } from 'lucide-react';
import TrackMenu from './TrackMenu';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../lib/i18n';

interface ArtistDetailProps {
  artistId: string;
  onBack: () => void;
  onAlbumClick: (albumId: string) => void;
}

export default function ArtistDetail({ artistId, onBack, onAlbumClick }: ArtistDetailProps) {
  const { t } = useI18n();
  const [artist, setArtist] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'albums' | 'songs'>('albums');
  
  const { theme } = useAuthStore();
  const { setQueue, currentSong, isPlaying } = usePlayerStore();

  useEffect(() => {
    let mounted = true;
    async function loadArtistData() {
      try {
        setLoading(true);
        const artistData = await getArtist(artistId);
        if (!mounted) return;
        setArtist(artistData);
        
        const artistSongs = await getArtistSongs(artistData.name);
        if (mounted) setSongs(artistSongs);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load artist details');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadArtistData();
    return () => { mounted = false; };
  }, [artistId]);

  const handlePlaySong = (index: number) => {
    setQueue(songs, index);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-red-500"></div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <p className="text-red-500">{error || t('artistNotFound')}</p>
        <button onClick={onBack} className="mt-4 text-red-500 hover:text-red-600 font-medium">{t('goBack')}</button>
      </div>
    );
  }

  const coverArt = artist.coverArt ? getCoverArtUrl(artist.coverArt, 600) : '';
  const albums: Album[] = artist.album || [];

  return (
    <div className="p-4 sm:p-8 pb-32 max-w-7xl mx-auto w-full pt-20 lg:pt-8">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-3 text-sm font-semibold rounded-full h-10 w-10 items-center justify-center transition-colors"
        aria-label="Back"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <ArrowLeft size={16} />
      </button>

      <div className="flex flex-col md:flex-row gap-8 mb-12 items-center md:items-end">
        <div className="w-48 h-48 flex-shrink-0 rounded-full overflow-hidden shadow-2xl bg-zinc-200 dark:bg-zinc-800 border-4 border-white dark:border-zinc-800 transition-colors">
          {coverArt ? (
             <img src={coverArt} alt={artist.name} className="h-full w-full object-cover" />
          ) : (
             <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-200 dark:bg-zinc-800">
               {artist.name[0]}
             </div>
          )}
        </div>
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">{artist.name}</h1>
          <div className="flex items-center gap-4">
            <p className="text-lg text-zinc-500 dark:text-zinc-400">{t('artistCounts', { albums: artist.albumCount, songs: songs.length })}</p>
            <button
              onClick={() => { if (songs.length) setQueue(songs, 0); }}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Play size={14} />
              {t('playAll')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-8 border-b border-zinc-200 dark:border-zinc-800 mb-8 sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm z-50">
        <button 
          onClick={() => setActiveTab('albums')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'albums' ? 'text-red-500 border-red-500' : 'text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-300'}`}
        >
          {t('albums')}
        </button>
        <button 
          onClick={() => setActiveTab('songs')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'songs' ? 'text-red-500 border-red-500' : 'text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-300'}`}
        >
          {t('songs')}
        </button>
      </div>

      {activeTab === 'albums' ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {albums.map((album) => (
            <div 
              key={album.id}
              onClick={() => onAlbumClick(album.id)}
              className="group cursor-pointer rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 p-4 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-100 dark:border-transparent"
            >
              <div className="relative mb-4 aspect-square overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 shadow-lg">
                <img 
                  src={getCoverArtUrl(album.coverArt || album.id, 300)} 
                  alt={album.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-red-500 transition-colors">
                {album.name}
              </h3>
              {album.year && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{album.year}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {songs.length > 0 ? songs.map((song, index) => {
            const isActive = currentSong?.id === song.id;
            return (
              <div 
                key={song.id}
                onClick={() => handlePlaySong(index)}
                onDoubleClick={() => handlePlaySong(index)}
                className={`group flex cursor-pointer touch-manipulation items-center rounded-lg px-4 py-4 sm:py-3 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${isActive ? 'bg-zinc-100 dark:bg-zinc-800/30' : ''}`}
              >
                <div className="w-10 flex-shrink-0 text-zinc-400 dark:text-zinc-500">
                  <div className="relative flex justify-center h-4 items-center">
                    <span className="group-hover:opacity-0">{index + 1}</span>
                    <button 
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePlaySong(index);
                      }}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-zinc-900 dark:text-white"
                    >
                      <Play size={14} className="fill-current" />
                    </button>
                  </div>
                </div>
                
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800 mr-4 border border-zinc-200 dark:border-none">
                  {song.coverArt && (
                    <img src={getCoverArtUrl(song.coverArt, 100)} alt="" className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className={`font-semibold truncate ${isActive ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-200'}`}>
                    {song.title}
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">
                    {song.album}
                  </div>
                </div>

                <div className="w-20 text-right text-zinc-500 tabular-nums font-mono text-xs flex items-center justify-end gap-3">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">{formatDuration(song.duration)}</div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <TrackMenu song={song} />
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-12 text-center text-zinc-500">{t('noSongsForArtist')}</div>
          )}
        </div>
      )}
    </div>
  );
}

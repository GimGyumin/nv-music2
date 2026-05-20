import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import PlayerBar from './PlayerBar';
import AlbumList from './AlbumList';
import AlbumDetail from './AlbumDetail';
import NowPlaying from './NowPlaying';
import ArtistDetail from './ArtistDetail';
import LibraryView from './LibraryView';
import SongsView from './SongsView';
import SearchView from './SearchView';
import SettingsView from './SettingsView';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../lib/i18n';

export default function Layout() {
  const { theme } = useAuthStore();
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState('listen-now');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Re-open sidebar on large screens and close on small screens on mount/resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync theme to document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);

  const handleNavigate = (view: string) => {
    setHistory([]);
    setCurrentView(view);
    if (!view.startsWith('album-')) setSelectedAlbumId(null);
    if (!view.startsWith('artist-')) setSelectedArtistId(null);
  };

  const handleAlbumClick = (albumId: string) => {
    setHistory(prev => [...prev, currentView]);
    setSelectedAlbumId(albumId);
    setCurrentView(`album-${albumId}`);
  };

  const handleArtistClick = (artistId: string) => {
    setHistory(prev => [...prev, currentView]);
    setSelectedArtistId(artistId);
    setCurrentView(`artist-${artistId}`);
    setIsNowPlayingOpen(false);
  };

  const handleBack = () => {
    setHistory(prev => {
      if (prev.length === 0) {
        // Fallback if no history
        setCurrentView('albums');
        setSelectedAlbumId(null);
        return prev;
      }
      const newHistory = [...prev];
      const previousView = newHistory.pop()!;
      setCurrentView(previousView);
      
      if (previousView.startsWith('album-')) {
        setSelectedAlbumId(previousView.replace('album-', ''));
      } else {
        setSelectedAlbumId(null);
      }
      
      if (previousView.startsWith('artist-')) {
        setSelectedArtistId(previousView.replace('artist-', ''));
      } else {
        setSelectedArtistId(null);
      }
      
      return newHistory;
    });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans transition-colors duration-300">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          currentView={currentView} 
          onNavigate={(view) => {
            handleNavigate(view);
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        {/* Main Content Area */}
        <main className="relative w-full flex-1 overflow-y-auto pl-0 lg:pl-0">
          <div className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] hidden lg:flex items-center">
            <button 
              onClick={() => setIsSidebarOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 shadow-sm backdrop-blur-xl transition-colors hover:text-red-500 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100"
              aria-label={isSidebarOpen ? t('closeMenu') : t('openMenu')}
              title={t('toggleMenu')}
            >
              <Menu size={21} strokeWidth={2.4} />
            </button>
          </div>

          {currentView === 'search' && (
            <SearchView onAlbumClick={handleAlbumClick} onArtistClick={handleArtistClick} />
          )}

          {currentView === 'songs' && (
            <SongsView />
          )}

          {currentView === 'settings' && (
            <SettingsView />
          )}

          {currentView === 'listen-now' && (
            <AlbumList onAlbumClick={handleAlbumClick} />
          )}

          {currentView === 'albums' && (
            <LibraryView viewType="albums" onAlbumClick={handleAlbumClick} onArtistClick={handleArtistClick} />
          )}

          {currentView === 'artists' && (
            <LibraryView viewType="artists" onAlbumClick={handleAlbumClick} onArtistClick={handleArtistClick} />
          )}

          {selectedAlbumId && currentView.startsWith('album-') && (
            <AlbumDetail albumId={selectedAlbumId} onBack={handleBack} onArtistClick={handleArtistClick} />
          )}

          {selectedArtistId && currentView.startsWith('artist-') && (
            <ArtistDetail artistId={selectedArtistId} onBack={handleBack} onAlbumClick={handleAlbumClick} />
          )}
        </main>
      </div>

      {/* Fixed bottom player */}
      <PlayerBar onOpenNowPlaying={() => setIsNowPlayingOpen(true)} onArtistClick={handleArtistClick} />
      
      {/* Bottom Nav for Mobile */}
      <BottomNav currentView={currentView} onNavigate={handleNavigate} />

      {/* Full Screen Now Playing Overlay */}
      <NowPlaying isOpen={isNowPlayingOpen} onClose={() => setIsNowPlayingOpen(false)} onArtistClick={handleArtistClick} />
    </div>
  );
}

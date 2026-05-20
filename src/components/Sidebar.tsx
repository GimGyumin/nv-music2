import { Home, Library, Music, LogOut, Search, Users, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { useI18n } from '../lib/i18n';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ currentView, onNavigate, isOpen, onClose }: SidebarProps) {
  const { logout } = useAuthStore();
  const { t } = useI18n();

  const navItems = [
    { id: 'listen-now', label: t('listenNow'), icon: Home },
    { id: 'search', label: t('search'), icon: Search },
  ];

  const libraryItems = [
    { id: 'albums', label: t('albums'), icon: Library },
    { id: 'artists', label: t('artists'), icon: Users },
    { id: 'songs', label: t('songs'), icon: Music },
  ];

  const renderNavButton = (item: { id: string; label: string; icon: typeof Home }) => {
    const Icon = item.icon;
    const active = currentView === item.id || (currentView.startsWith('album-') && item.id === 'albums');

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        title={!isOpen ? item.label : undefined}
        className={cn(
          'flex w-full items-center rounded-lg text-sm font-bold transition-all',
          isOpen ? 'gap-3 px-4 py-2.5' : 'h-11 justify-center px-0',
          active
            ? 'bg-white dark:bg-zinc-800 text-red-500 shadow-sm border border-zinc-200 dark:border-zinc-700'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
        )}
      >
        <Icon size={20} />
        {isOpen && <span>{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'z-50 flex h-full flex-col border-r border-zinc-200 bg-white transition-[width,transform,padding] duration-300 ease-in-out dark:border-zinc-800/50 dark:bg-zinc-950',
          'hidden lg:flex',
          isOpen ? 'w-64 p-4' : 'w-14 p-2'
        )}
      >
        <div className={cn('mb-6 mt-[calc(env(safe-area-inset-top)+3.5rem)]', isOpen ? 'px-4' : 'px-0')}>
          {isOpen ? (
            <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-white">
              <Music className="text-red-500" />
              Music
            </h1>
          ) : (
            <div className="flex h-11 items-center justify-center rounded-lg text-red-500" title="Music">
              <Music size={22} />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-6">
          <ul className="space-y-1">{navItems.map(renderNavButton)}</ul>

          <div>
            {isOpen && (
              <h2 className="mb-2 px-4 text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {t('library')}
              </h2>
            )}
            <ul className="space-y-1">{libraryItems.map(renderNavButton)}</ul>
          </div>
        </div>

        <div className="mt-auto space-y-2 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={() => onNavigate('settings')}
            title={!isOpen ? t('settings') : undefined}
            className={cn(
              'flex w-full items-center rounded-lg text-sm font-bold transition-all',
              isOpen ? 'gap-3 px-4 py-2.5' : 'h-11 justify-center px-0',
              currentView === 'settings'
                ? 'bg-white dark:bg-zinc-800 text-red-500 shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
            )}
          >
            <Settings size={20} />
            {isOpen && <span>{t('settings')}</span>}
          </button>
          <button
            onClick={logout}
            title={!isOpen ? t('signOut') : undefined}
            className={cn(
              'flex w-full items-center rounded-lg text-sm font-bold text-zinc-500 transition-all hover:bg-zinc-200 hover:text-red-500 active:scale-95 dark:text-zinc-400 dark:hover:bg-red-500/10',
              isOpen ? 'gap-3 px-4 py-2.5' : 'h-11 justify-center px-0'
            )}
          >
            <LogOut size={20} />
            {isOpen && <span>{t('signOut')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

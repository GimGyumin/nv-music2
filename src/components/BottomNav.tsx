import { Home, Library, Music, Search, Users, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { useI18n } from '../lib/i18n';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  const { t } = useI18n();

  const navItems = [
    { id: 'listen-now', label: t('listenNow'), icon: Home },
    { id: 'albums', label: t('albums'), icon: Library },
    { id: 'artists', label: t('artists'), icon: Users },
    { id: 'songs', label: t('songs'), icon: Music },
    { id: 'search', label: t('search'), icon: Search },
    { id: 'settings', label: t('settings'), icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-zinc-200 bg-white/80 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80 lg:hidden px-2 overflow-x-auto no-scrollbar gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = currentView === item.id || (currentView.startsWith('album-') && item.id === 'albums') || (currentView.startsWith('artist-') && item.id === 'artists');
        
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 flex-1 min-w-0 transition-colors',
              active ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            )}
          >
            <Icon size={22} className={cn('shrink-0 transition-transform', active && 'scale-110')} />
            <span className="text-[10px] font-medium truncate max-w-full">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

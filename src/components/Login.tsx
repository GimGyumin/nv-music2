import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { generateAuthContext, ping } from '../api/subsonic';
import { Languages, Music, Loader2 } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export default function Login() {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setCredentials, rememberMe, setRememberMe } = useAuthStore();
  const { language, setLanguage, t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Basic formatting
      let formattedUrl = serverUrl.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      const { token, salt } = generateAuthContext(password);
      await ping(formattedUrl, username, token, salt);
      
      setCredentials(formattedUrl, username, token, salt);
    } catch (err: any) {
      setError(err.message || t('failedConnect'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 text-zinc-900 transition-colors duration-300 dark:bg-zinc-950 dark:text-white">
      <label className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex items-center">
        <span className="sr-only">{t('appLanguage')}</span>
        <Languages size={16} className="pointer-events-none absolute left-3 text-zinc-500 dark:text-zinc-400" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'en' | 'ko')}
          className="h-10 appearance-none rounded-full border border-zinc-200 bg-white/90 py-0 pl-9 pr-8 text-xs font-bold text-zinc-700 shadow-sm backdrop-blur-xl transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100"
          aria-label={t('appLanguage')}
        >
          <option value="en">EN</option>
          <option value="ko">한국어</option>
        </select>
      </label>
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-6 shadow-2xl backdrop-blur-xl transition-colors dark:bg-zinc-900/50 sm:p-8 border border-zinc-200 dark:border-zinc-800">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <Music size={32} />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight">{t('login')}</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t('loginSubtitle')}</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-300">{t('serverUrl')}</label>
              <input
                type="text"
                required
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://music.example.com"
                className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-300">{t('username')}</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-zinc-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-500 dark:text-zinc-300">{t('password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-zinc-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-red-500 focus:ring-red-500" 
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('keepLoggedIn')}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-50 dark:focus:ring-offset-zinc-950 disabled:opacity-50 transition-all shadow-lg shadow-red-500/20 active:scale-98"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('connect')}
          </button>
        </form>
      </div>
    </div>
  );
}

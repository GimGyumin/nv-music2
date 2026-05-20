import { type StreamTranscoding, useAuthStore } from '../store/authStore';
import { ChevronLeft, Save } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { changePassword, generateAuthContext, getScanStatus, startLibraryScan } from '../api/subsonic';

export default function SettingsView() {
  const { 
    translationLanguage, 
    googleTranslateApiKey, 
    serverUrl,
    username,
    theme,
    rememberMe,
    lyricsOffset,
    preferEmbeddedLyrics,
    streamTranscoding,
    setTranslationSettings,
    setTheme,
    setRememberMe,
    setLyricsOffset,
    setPreferEmbeddedLyrics,
    setStreamTranscoding,
    setCredentials
  } = useAuthStore();
  const { language, setLanguage, t } = useI18n();

  const [lang, setLang] = useState(translationLanguage || 'ko');
  const [uiLang, setUiLang] = useState(language);
  const [apiKey, setApiKey] = useState(googleTranslateApiKey || '');
  const [currentTheme, setCurrentTheme] = useState(theme);
  const [keepLogin, setKeepLogin] = useState(rememberMe);
  const [offset, setOffset] = useState(lyricsOffset);
  const [prefEmbedded, setPrefEmbedded] = useState(preferEmbeddedLyrics);
  const [transcoding, setTranscoding] = useState<StreamTranscoding>(streamTranscoding || 'original');
  const [saved, setSaved] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  const handleSave = () => {
    setLanguage(uiLang);
    setTranslationSettings(lang, apiKey);
    setTheme(currentTheme);
    setRememberMe(keepLogin);
    setLyricsOffset(offset);
    setPreferEmbeddedLyrics(prefEmbedded);
    setStreamTranscoding(transcoding);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleScan = async (fullScan: boolean) => {
    try {
      const status = await startLibraryScan(fullScan);
      setScanMessage(status?.scanning ? t('scanStarted') : t('scanRequested'));
      setTimeout(async () => {
        try {
          const next = await getScanStatus();
          setScanMessage(next?.scanning ? t('scanRunning') : t('scanIdle'));
        } catch {
          // Status is best-effort; startScan already succeeded.
        }
      }, 1200);
    } catch (error) {
      console.error('Scan failed', error);
      setScanMessage(t('scanFailed'));
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) return;

    try {
      await changePassword(username, newPassword);
      const { token, salt } = generateAuthContext(newPassword);
      setCredentials(serverUrl, username, token, salt);
      setNewPassword('');
      setPasswordMessage(t('passwordChanged'));
    } catch (error) {
      console.error('Password change failed', error);
      setPasswordMessage(t('passwordChangeFailed'));
    }
  };

  if (accountOpen) {
    return (
      <div className="p-4 sm:p-8 pb-32 max-w-2xl mx-auto w-full pt-16 lg:pt-8">
        <div className="mb-8 flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <button
            onClick={() => setAccountOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            aria-label={t('back')}
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{t('account')}</h1>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">{t('libraryScan')}</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => handleScan(true)} className="rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500">
                {t('fullScan')}
              </button>
              <button onClick={() => handleScan(false)} className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                {t('quickScan')}
              </button>
            </div>
            {scanMessage && <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">{scanMessage}</p>}
          </div>

          <div className="rounded-xl bg-white p-6 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">{t('accountInfo')}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-zinc-500 dark:text-zinc-400">{t('serverUrl')}</p>
                <p className="break-all font-semibold text-zinc-900 dark:text-white">{serverUrl}</p>
              </div>
              <div>
                <p className="font-medium text-zinc-500 dark:text-zinc-400">{t('username')}</p>
                <p className="font-semibold text-zinc-900 dark:text-white">{username}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">{t('changePassword')}</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={t('newPassword')}
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white p-2.5 text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
              <button onClick={handlePasswordChange} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500">
                {t('changePassword')}
              </button>
            </div>
            {passwordMessage && <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">{passwordMessage}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 pb-32 max-w-2xl mx-auto w-full pt-16 lg:pt-8">
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4 flex justify-between items-end">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{t('settings')}</h1>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 font-bold text-white transition-all hover:bg-red-500 active:scale-95 shadow-lg shadow-red-600/20 text-sm"
        >
          <Save size={18} />
          {saved ? t('settingsSaved') : t('saveChanges')}
        </button>
      </div>

      <div className="space-y-6">
        {/* Account Section */}
        <button
          onClick={() => setAccountOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-red-500/30 bg-red-50 p-6 text-left transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-950/20 dark:hover:bg-red-950/30"
        >
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{t('account')}</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('accountSectionHint')}</p>
          </div>
          <ChevronLeft size={24} className="ml-4 shrink-0 rotate-180 text-red-500" />
        </button>

        {/* Appearance Section */}
        <div className="rounded-xl bg-white dark:bg-zinc-900/50 p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">{t('appearance')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('appLanguage')}
              </label>
              <select
                value={uiLang}
                onChange={(e) => {
                  const next = e.target.value as 'en' | 'ko';
                  setUiLang(next);
                  setLanguage(next);
                }}
                className="w-full rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 text-zinc-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="en">{t('english')}</option>
                <option value="ko">{t('korean')} (한국어)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('theme')}
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-all font-bold ${
                    currentTheme === 'dark' 
                      ? 'bg-zinc-900 border-red-500 text-white shadow-md' 
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {t('darkMode')}
                </button>
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-all font-bold ${
                    currentTheme === 'light' 
                      ? 'bg-white border-red-500 text-zinc-900 shadow-md' 
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {t('lightMode')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-zinc-900/50 p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">{t('accountPersistence')}</h2>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`relative w-12 h-6 rounded-full transition-colors ${keepLogin ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={keepLogin} 
                onChange={(e) => setKeepLogin(e.target.checked)}
              />
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${keepLogin ? 'translate-x-6' : ''}`} />
            </div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('keepLoggedInPersistence')}</span>
          </label>
          <p className="mt-2 text-xs text-zinc-500">{t('keepLoggedInHint')}</p>
        </div>

        {/* Playback Section */}
        <div className="rounded-xl bg-white dark:bg-zinc-900/50 p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">{t('playbackLyrics')}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="streamTranscoding" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('transcoding')}
              </label>
              <select
                id="streamTranscoding"
                value={transcoding}
                onChange={(e) => setTranscoding(e.target.value as StreamTranscoding)}
                className="w-full rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 text-zinc-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="original">{t('originalStream')}</option>
                <option value="mp3_320">{t('mp3High')}</option>
                <option value="mp3_256">{t('mp3Balanced')}</option>
                <option value="mp3_192">{t('mp3DataSaver')}</option>
                <option value="opus_160">{t('opusBalanced')}</option>
              </select>
              <p className="mt-2 text-xs text-zinc-500">
                {t('transcodingHint')}
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">{t('lyricsPriority')}</h3>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`relative w-12 h-6 rounded-full transition-colors ${prefEmbedded ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={prefEmbedded} 
                    onChange={(e) => setPrefEmbedded(e.target.checked)}
                  />
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${prefEmbedded ? 'translate-x-6' : ''}`} />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('preferEmbeddedLyrics')}</span>
              </label>
              <p className="mt-2 text-xs text-zinc-500">
                {t('preferEmbeddedLyricsHint')}
              </p>
            </div>

            <div>
              <label htmlFor="lyricsOffset" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('lyricsOffset')}
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="lyricsOffset"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={offset}
                  onChange={(e) => setOffset(parseFloat(e.target.value))}
                  className="flex-1 accent-red-500 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 appearance-none"
                />
                <span className="w-12 text-center text-sm font-mono text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 py-1 rounded">
                  {offset > 0 ? `+${offset}` : offset}s
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {t('lyricsOffsetHint')}
              </p>
            </div>
          </div>
        </div>

        {/* Translation Section */}
        <div className="rounded-xl bg-white dark:bg-zinc-900/50 p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">{t('translation')}</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('targetLanguage')}
              </label>
              <select
                id="language"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 text-zinc-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="ko">Korean (한국어)</option>
                <option value="en">English</option>
                <option value="ja">Japanese (日本語)</option>
                <option value="es">Spanish (Español)</option>
                <option value="zh">Chinese (中文)</option>
                <option value="fr">French (Français)</option>
                <option value="de">German (Deutsch)</option>
              </select>
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('googleApiKey')}
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 text-zinc-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <p className="mt-2 text-xs text-zinc-500">
                {t('googleApiKeyHint')}
              </p>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="rounded-xl bg-white dark:bg-zinc-900/50 p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">Information</h2>
          <div className="flex flex-col items-center justify-center space-y-2 py-4">
            <h3 className="text-2xl font-black tracking-tighter text-red-500">NaviMusic</h3>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Version 4.0.0 (Beta)</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4 text-center px-4">
              © {new Date().getFullYear()} Kyumin. All rights reserved.<br />
              Powered by Subsonic API
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-xs text-zinc-500 italic">{t('settingsApplyHint')}</p>
        </div>
      </div>
    </div>
  );
}

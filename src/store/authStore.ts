import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearSubsonicCache } from '../api/subsonic';

export type StreamTranscoding = 'original' | 'mp3_320' | 'mp3_256' | 'mp3_192' | 'opus_160';

interface AuthState {
  serverUrl: string;
  username: string;
  token: string;
  salt: string;
  isAuthenticated: boolean;
  appLanguage: 'en' | 'ko';
  translationLanguage?: string;
  googleTranslateApiKey?: string;
  theme: 'dark' | 'light';
  rememberMe: boolean;
  lyricsOffset: number;
  preferEmbeddedLyrics: boolean;
  streamTranscoding: StreamTranscoding;
  setCredentials: (serverUrl: string, username: string, token: string, salt: string) => void;
  setAppLanguage: (language: 'en' | 'ko') => void;
  setTranslationSettings: (language: string, apiKey: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setRememberMe: (remember: boolean) => void;
  setLyricsOffset: (offset: number) => void;
  setPreferEmbeddedLyrics: (prefer: boolean) => void;
  setStreamTranscoding: (profile: StreamTranscoding) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      serverUrl: '',
      username: '',
      token: '',
      salt: '',
      isAuthenticated: false,
      appLanguage: 'en',
      translationLanguage: 'ko',
      googleTranslateApiKey: '',
      theme: 'dark',
      rememberMe: true,
      lyricsOffset: 0,
      preferEmbeddedLyrics: false,
      streamTranscoding: 'original',
      setCredentials: (serverUrl, username, token, salt) =>
        set({ serverUrl, username, token, salt, isAuthenticated: true }),
      setAppLanguage: (appLanguage) => set({ appLanguage }),
      setTranslationSettings: (translationLanguage, googleTranslateApiKey) => 
        set({ translationLanguage, googleTranslateApiKey }),
      setTheme: (theme) => set({ theme }),
      setRememberMe: (rememberMe) => set({ rememberMe }),
      setLyricsOffset: (lyricsOffset) => set({ lyricsOffset }),
      setPreferEmbeddedLyrics: (preferEmbeddedLyrics) => set({ preferEmbeddedLyrics }),
      setStreamTranscoding: (streamTranscoding) => set({ streamTranscoding }),
      logout: () => {
        clearSubsonicCache();
        set({ serverUrl: '', username: '', token: '', salt: '', isAuthenticated: false });
      },
    }),
    {
      name: 'subsonic-auth-storage',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name) || sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          const state = JSON.parse(JSON.stringify(value));
          // Check rememberMe in the state being saved
          if (state.state.rememberMe) {
            localStorage.setItem(name, JSON.stringify(value));
            sessionStorage.removeItem(name);
          } else {
            sessionStorage.setItem(name, JSON.stringify(value));
            localStorage.removeItem(name);
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
          sessionStorage.removeItem(name);
        },
      },
    }
  )
);

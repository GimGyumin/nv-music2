import { create } from 'zustand';
import { Song } from '../types/subsonic';

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  seekTo: number | null;
  
  setCurrentSong: (song: Song) => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  playAfterCurrent: (song: Song) => void;
  playNext: () => void;
  playPrev: () => void;
  playQueueIndex: (index: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setSeekTo: (time: number | null) => void;
}
const STORAGE_KEY = 'nv:lastSong';

function loadLastSong(): Song | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Song;
  } catch (e) {
    return null;
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: loadLastSong(),
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  seekTo: null,

  setCurrentSong: (song) => set((state) => {
    // If the selected song exists in the current queue, use that queue
    // and position. Otherwise replace the queue with the single selected
    // song so queueIndex stays consistent. This prevents the bug where
    // the "first played" song lingers when switching albums or skipping.
    const foundIndex = state.queue.findIndex((item) => item.id === song.id);
    if (foundIndex !== -1) {
        const newState = {
          currentSong: song,
          queue: state.queue,
          queueIndex: foundIndex,
          currentTime: 0,
          duration: song.duration || 0,
          isPlaying: true,
        };
        try { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(song)); } catch (e) {}
        return newState;
    }

    return {
      currentSong: song,
      queue: [song],
      queueIndex: 0,
      currentTime: 0,
      duration: song.duration || 0,
      isPlaying: true,
    };
    try { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(song)); } catch (e) {}
  }),
  
  setQueue: (songs, startIndex = 0) => set({ 
    queue: songs, 
    queueIndex: startIndex,
    currentSong: songs[startIndex] || null,
    currentTime: 0,
    duration: songs[startIndex]?.duration || 0,
    isPlaying: true
  }),

  addToQueue: (song) => set((state) => ({
    queue: state.queue.length ? [...state.queue, song] : [song],
    queueIndex: state.queue.length ? state.queueIndex : 0,
    currentSong: state.currentSong || song,
    isPlaying: state.currentSong ? state.isPlaying : true,
  })),

  playAfterCurrent: (song) => set((state) => {
    if (!state.queue.length) {
      return { queue: [song], queueIndex: 0, currentSong: song, currentTime: 0, duration: song.duration || 0, isPlaying: true };
    }

    const insertAt = Math.min(state.queueIndex + 1, state.queue.length);
    const queue = [...state.queue.slice(0, insertAt), song, ...state.queue.slice(insertAt)];
    return { queue };
  }),

  playNext: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;
    
    // Auto loop or stop at end
    const nextIndex = (queueIndex + 1) % queue.length;
    const nextSong = queue[nextIndex];
    try { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSong)); } catch (e) {}
    set({ 
      queueIndex: nextIndex,
      currentSong: nextSong,
      currentTime: 0,
      duration: nextSong?.duration || 0,
    });
  },

  playPrev: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;
    
    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;
    const prevSong = queue[prevIndex];
    try { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(prevSong)); } catch (e) {}
    set({
      queueIndex: prevIndex,
      currentSong: prevSong,
      currentTime: 0,
      duration: prevSong?.duration || 0,
    });
  },

  playQueueIndex: (index) => {
    const { queue } = get();
    if (!queue[index]) return;
    const song = queue[index];
    try { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(song)); } catch (e) {}
    set({
      queueIndex: index,
      currentSong: song,
      currentTime: 0,
      duration: song.duration || 0,
      isPlaying: true,
    });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setSeekTo: (time) => set({ seekTo: time }),
}));

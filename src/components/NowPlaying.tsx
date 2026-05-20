import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { getCoverArtUrl, getDownloadUrl } from '../api/subsonic';
import { ChevronDown, MessageSquareText, Languages, Loader2, Play, Pause, SkipBack, SkipForward, Download, Info, ListMusic, MoreHorizontal, Plus } from 'lucide-react';
import { getLyrics, translateLyrics } from '../api/lyrics';
import { useI18n } from '../lib/i18n';

interface NowPlayingProps {
  isOpen: boolean;
  onClose: () => void;
  onArtistClick?: (artistId: string) => void;
}

interface LyricLine {
  time: number;
  text: string;
  side?: 'left' | 'right' | 'center';
}

interface LyricsCacheEntry {
  lines: LyricLine[];
  plain: string | null;
}

interface WikiData {
  songTitle?: string;
  artistTitle?: string;
  songExtract?: string;
  artistExtract?: string;
  credits?: string;
  songUrl?: string;
  artistUrl?: string;
}

interface WikiArticle {
  title: string;
  extract: string;
  url: string;
  language: 'en' | 'ko';
  score: number;
}

const lyricsCache = new Map<string, LyricsCacheEntry>();
const wikiCache = new Map<string, WikiData>();

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseLRC(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const speakers: string[] = [];

  for (const line of lines) {
    const matches = Array.from(line.matchAll(timeReg));
    if (matches.length === 0) continue;

    const text = line.replace(timeReg, '').trim();
    let side: 'left' | 'right' | 'center' = 'center';
    const speakerMatch = text.match(/^\[([^\]]+)\]|^\(([^)]+)\)|^([A-Z]):|^(Artist \d):/i);

    if (speakerMatch) {
      const speaker = (speakerMatch[1] || speakerMatch[2] || speakerMatch[3] || speakerMatch[4] || '').trim();
      if (speaker) {
        if (!speakers.includes(speaker)) speakers.push(speaker);
        side = speakers.indexOf(speaker) % 2 === 0 ? 'left' : 'right';
      }
    }

    for (const match of matches) {
      const m = parseInt(match[1], 10);
      const s = parseInt(match[2], 10);
      let ms = parseInt(match[3], 10);
      if (match[3].length === 2) ms *= 10;
      result.push({ time: m * 60 + s + ms / 1000, text, side });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function getAudioQualityString(song: any, streamTranscoding?: string): string | null {
  if (streamTranscoding && streamTranscoding !== 'original') {
    if (streamTranscoding === 'mp3_320') return '320kbps (MP3)';
    if (streamTranscoding === 'mp3_256') return '256kbps (MP3)';
    if (streamTranscoding === 'mp3_192') return '192kbps (MP3)';
    if (streamTranscoding === 'opus_160') return '160kbps (OPUS)';
    return 'Transcoded';
  }

  const suffix = (song.suffix || 'unknown').toLowerCase();
  const bps = song.bitRate || 0;

  let isLossy = false;
  if (['mp3', 'aac', 'ogg', 'opus', 'wma'].includes(suffix)) {
    isLossy = true;
  } else if (suffix === 'm4a' && bps > 0 && bps < 550) {
    isLossy = true;
  }

  if (isLossy) return null;

  let displaySuffix = suffix.toUpperCase();
  if (suffix === 'm4a') displaySuffix = 'ALAC';

  if (song.bitDepth && song.samplingRate) {
    const rate = song.samplingRate > 1000 ? song.samplingRate / 1000 : song.samplingRate;
    return `${song.bitDepth}bit ${rate % 1 === 0 ? rate : rate.toFixed(1)}kHz (${displaySuffix})`;
  }

  let bitDepth = 16;
  let sampleRate = 44.1;

  // Use exact bitrate from file size and duration if it's much higher than reported, to avoid API cap bugs
  const calculatedBitrate = (song.size && song.duration) ? Math.round((song.size * 8) / song.duration / 1000) : 0;
  const effectiveBitrate = Math.max(bps, calculatedBitrate);

  if (effectiveBitrate >= 3200) {
    bitDepth = 24;
    sampleRate = 192;
  } else if (effectiveBitrate >= 1900) {
    bitDepth = 24;
    sampleRate = 96;
  } else if (effectiveBitrate >= 1200) {
    bitDepth = 24;
    sampleRate = 48;
  } else if (effectiveBitrate > 1000) {
    bitDepth = 24;
    sampleRate = 44.1;
  }

  return `${bitDepth}bit ${sampleRate}kHz (${displaySuffix})`;
}

function getSongCacheKey(song: any) {
  return song.id || `${song.artist || ''}|${song.title || ''}|${song.album || ''}|${song.duration || ''}`;
}

function normalizeText(value = '') {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWikipediaText(input = '') {
  let text = input;

  if (/<[a-z][\s\S]*>/i.test(input) && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');
    doc
      .querySelectorAll(
        [
          'style',
          'script',
          'link',
          'sup.reference',
          '.reference',
          '.reflist',
          '.mw-references-wrap',
          '.mw-editsection',
          '.citation',
          '.cs1',
          '.hatnote',
          '.ambox',
          '.metadata',
          '.navbox',
          '.infobox',
          'table',
        ].join(',')
      )
      .forEach((node) => node.remove());
    text = doc.body.textContent || '';
  }

  text = text
    .replace(/\{\{[^{}]*(?:cite|citation|refn|efn)[^{}]*\}\}/gi, '')
    .replace(/\[\s*(?:edit|citation needed|page needed|better source needed|\d+)\s*\]/gi, '')
    .replace(/\b(?:Cite|Citation)\s+(?:web|news|journal|book|magazine|AV media|album-notes)[^\n.]*/gi, '')
    .replace(/\b(?:url|title|website|publisher|date|access-date|last|first)\s*=\s*[^|\n]+/gi, '')
    .replace(/\|+\s*/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.includes('mw-parser-output')) return false;
      if (/^[.#][\w-].*\{/.test(line)) return false;
      if (/^(font|background|color|margin|padding|border|display|width|height|line-height|vertical-align|text-align)\s*:/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function searchWikipedia(language: 'en' | 'ko', query: string) {
  const url = `https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=6&format=json&origin=*`;
  const data = await fetchJson<any>(url);
  return (data.query?.search || []).map((result: any) => ({
    language,
    title: result.title as string,
    snippet: cleanWikipediaText(result.snippet || ''),
  }));
}

async function fetchWikipediaSummary(language: 'en' | 'ko', title: string) {
  const data = await fetchJson<any>(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (data.type === 'disambiguation') return null;
  return {
    language,
    title: data.title || title,
    extract: cleanWikipediaText(data.extract || ''),
    url: data.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    type: data.type || '',
  };
}

function scoreSongArticle(article: any, song: any) {
  const title = normalizeText(article.title);
  const body = normalizeText(`${article.title} ${article.extract}`);
  const songTitle = normalizeText(song.title);
  const artist = normalizeText(song.artist);
  const album = normalizeText(song.album);
  let score = 0;

  if (!songTitle) return -20;
  if (title === songTitle || title.startsWith(`${songTitle} `)) score += 10;
  if (title.includes(songTitle)) score += 6;
  if (body.includes(songTitle)) score += 3;
  if (artist && body.includes(artist)) score += 6;
  if (album && body.includes(album)) score += 1;
  if (/\b(song|single|track|곡|싱글)\b/i.test(body)) score += 3;
  if (/disambiguation|동음이의/.test(body)) score -= 10;
  if (!title.includes(songTitle) && !body.includes(songTitle)) score -= 8;

  return score;
}

function scoreArtistArticle(article: any, song: any) {
  const title = normalizeText(article.title);
  const body = normalizeText(`${article.title} ${article.extract}`);
  const artist = normalizeText(song.artist);
  const songTitle = normalizeText(song.title);
  let score = 0;

  if (!artist) return -20;
  
  if (title === artist) score += 20;
  else if (title.includes(artist)) score += 10;
  
  if (body.includes(artist)) score += 3;
  if (/\b(singer|musician|band|artist|rapper|composer|가수|음악가|밴드|아티스트)\b/i.test(body)) score += 8;
  if (/disambiguation|동음이의/.test(body)) score -= 15;
  
  // Penalize if it appears to be a song/album article
  if (/\b(song|single|album| EP |track|곡|싱글|앨범)\b/i.test(body)) score -= 10;
  
  // Heavily penalize if the article title includes the song title (to avoid showing song info in artist section)
  if (songTitle && title.includes(songTitle)) score -= 20;

  return score;
}

async function findWikipediaArticle(song: any, type: 'song' | 'artist'): Promise<WikiArticle | null> {
  const languages: Array<'en' | 'ko'> = type === 'song' ? ['en', 'ko'] : ['ko', 'en'];
  const queries =
    type === 'song'
      ? [
          `"${song.title}" "${song.artist}" song`,
          `${song.title} ${song.artist} song`,
          `${song.title} ${song.artist} ${song.album || ''}`,
        ]
      : [`"${song.artist}"`, `${song.artist} musician`, `${song.artist} singer`];

  const searchResults = (
    await Promise.all(
      languages.flatMap((language) => queries.map((query) => searchWikipedia(language, query).catch(() => [])))
    )
  ).flat();

  const uniqueResults = new Map<string, { language: 'en' | 'ko'; title: string }>();
  for (const result of searchResults) {
    uniqueResults.set(`${result.language}:${result.title}`, result);
  }

  const summaries = (
    await Promise.all(
      Array.from(uniqueResults.values())
        .slice(0, 12)
        .map((result) => fetchWikipediaSummary(result.language, result.title).catch(() => null))
    )
  ).filter(Boolean);

  let best: WikiArticle | null = null;
  for (const article of summaries) {
    const score = type === 'song' ? scoreSongArticle(article, song) : scoreArtistArticle(article, song);
    if (!best || score > best.score) {
      best = {
        title: article!.title,
        extract: article!.extract,
        url: article!.url,
        language: article!.language,
        score,
      };
    }
  }

  const minimumScore = type === 'song' ? 5 : 3;
  return best && best.score >= minimumScore ? best : null;
}

async function fetchCredits(language: 'en' | 'ko', title: string) {
  try {
    const sectionsData = await fetchJson<any>(
      `https://${language}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`
    );
    const sections = sectionsData.parse?.sections || [];
    const section = sections.find((item: any) => {
      const line = (item.line || '').toLowerCase();
      return line.includes('personnel') || line.includes('credit') || line.includes('credits') || line.includes('참여') || line.includes('크레딧');
    });
    if (!section) return '';

    const textData = await fetchJson<any>(
      `https://${language}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&section=${section.index}&prop=text&format=json&origin=*`
    );
    return cleanWikipediaText(textData.parse?.text?.['*'] || '');
  } catch (error) {
    console.warn('Failed to fetch Wikipedia credits', error);
    return '';
  }
}

function textLooksLikeTargetLanguage(text: string, targetLanguage?: string) {
  if (!text.trim()) return true;
  if (targetLanguage === 'ko') return /[가-힣]/.test(text);
  if (targetLanguage === 'en') return /^[\x00-\x7F\s.,!?'"()\-:;]+$/.test(text) && /[A-Za-z]/.test(text);
  if (targetLanguage === 'ja') return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
  if (targetLanguage === 'zh') return /[\u3400-\u9fff]/.test(text);
  return false;
}

async function translateInfoIfNeeded(text: string) {
  const cleaned = cleanWikipediaText(text);
  if (!cleaned) return '';

  const { translationLanguage, appLanguage, googleTranslateApiKey } = useAuthStore.getState();
  const targetLanguage = translationLanguage || appLanguage || 'ko';
  if (textLooksLikeTargetLanguage(cleaned, targetLanguage)) return cleaned;

  try {
    return cleanWikipediaText(await translateLyrics(cleaned));
  } catch (error) {
    console.warn('Wikipedia info translation failed', error);
    return cleaned;
  }
}

async function loadWikiForSong(song: any): Promise<WikiData> {
  const [songArticle, artistArticle] = await Promise.all([
    findWikipediaArticle(song, 'song'),
    findWikipediaArticle(song, 'artist'),
  ]);

  const [songExtract, artistExtract, credits] = await Promise.all([
    songArticle ? translateInfoIfNeeded(songArticle.extract) : Promise.resolve(''),
    artistArticle ? translateInfoIfNeeded(artistArticle.extract) : Promise.resolve(''),
    songArticle ? fetchCredits(songArticle.language, songArticle.title).then(translateInfoIfNeeded) : Promise.resolve(''),
  ]);

  return {
    songTitle: songArticle?.title,
    songExtract,
    songUrl: songArticle?.url,
    artistTitle: artistArticle?.title,
    artistExtract,
    artistUrl: artistArticle?.url,
    credits,
  };
}

export default function NowPlaying({ isOpen, onClose, onArtistClick }: NowPlayingProps) {
  const { currentSong, queue, queueIndex, isPlaying, currentTime, duration, setSeekTo, playNext, playPrev, playQueueIndex, setIsPlaying, addToQueue, playAfterCurrent } = usePlayerStore();
  const { lyricsOffset, translationLanguage, googleTranslateApiKey, streamTranscoding } = useAuthStore();
  const { t } = useI18n();
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedLyrics, setTranslatedLyrics] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  // Track info modal removed per UX request
  const [localTime, setLocalTime] = useState(0);
  const [showWiki, setShowWiki] = useState(false);
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [loadingWiki, setLoadingWiki] = useState(false);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const songKey = currentSong ? getSongCacheKey(currentSong) : '';

  useEffect(() => {
    if (!currentSong) return;

    let cancelled = false;
    const key = getSongCacheKey(currentSong);
    setTranslatedLyrics(null);
    setActiveLyricIdx(-1);

    const cachedLyrics = lyricsCache.get(key);
    if (cachedLyrics) {
      setLyricsLines(cachedLyrics.lines);
      setPlainLyrics(cachedLyrics.plain);
      setLoadingLyrics(false);
    } else {
      setLyricsLines([]);
      setPlainLyrics(null);
      setLoadingLyrics(true);
      getLyrics(currentSong.artist, currentSong.title, currentSong.album, currentSong.duration)
        .then((data) => {
          if (cancelled) return;
          const entry: LyricsCacheEntry = data.syncedLyrics
            ? { lines: parseLRC(data.syncedLyrics), plain: null }
            : { lines: [], plain: data.plainLyrics || null };
          lyricsCache.set(key, entry);
          setLyricsLines(entry.lines);
          setPlainLyrics(entry.plain);
        })
        .catch((error) => {
          console.warn('Lyrics fetch failed', error);
          if (!cancelled) {
            lyricsCache.set(key, { lines: [], plain: null });
            setLyricsLines([]);
            setPlainLyrics(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingLyrics(false);
        });
    }

    const wikiKey = `${key}|${translationLanguage || ''}|${Boolean(googleTranslateApiKey?.trim())}`;
    const cachedWiki = wikiCache.get(wikiKey);
    if (cachedWiki) {
      setWikiData(cachedWiki);
      setLoadingWiki(false);
    } else {
      setWikiData(null);
      setLoadingWiki(true);
      loadWikiForSong(currentSong)
        .then((data) => {
          if (cancelled) return;
          wikiCache.set(wikiKey, data);
          setWikiData(data);
        })
        .catch((error) => {
          console.warn('Wikipedia fetch error', error);
          if (!cancelled) {
            wikiCache.set(wikiKey, {});
            setWikiData({});
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingWiki(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [songKey, currentSong, translationLanguage, googleTranslateApiKey]);

  useEffect(() => {
    if (!isDragging) setLocalTime(currentTime);
  }, [currentTime, isDragging]);

  useEffect(() => {
    if (lyricsLines.length === 0) return;

    let newIdx = -1;
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsLines[i].time + lyricsOffset) {
        newIdx = i;
        break;
      }
    }
    if (newIdx !== activeLyricIdx) setActiveLyricIdx(newIdx);
  }, [currentTime, lyricsLines, activeLyricIdx, lyricsOffset]);

  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current && showLyrics && isOpen) {
      const container = lyricsContainerRef.current;
      const activeLine = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeLineRect = activeLine.getBoundingClientRect();
      const top = activeLineRect.top - containerRect.top + container.scrollTop - container.clientHeight / 2 + activeLineRect.height / 2;
      container.scrollTo({
        top: Math.max(0, top),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIdx, showLyrics, isOpen]);

  const handleTranslate = async () => {
    if ((!plainLyrics && lyricsLines.length === 0) || isTranslating) return;
    if (translatedLyrics) {
      setTranslatedLyrics(null);
      return;
    }

    try {
      setIsTranslating(true);
      const textToTranslate = lyricsLines.length > 0 ? lyricsLines.map((line) => line.text).join('\n') : plainLyrics || '';
      setTranslatedLyrics(await translateLyrics(textToTranslate));
    } catch (error) {
      console.error('Translation error', error);
      alert('Failed to translate lyrics.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleWikiClick = () => {
    setShowWiki((visible) => !visible);
    setShowLyrics(false);
    setShowQueue(false);
  };

  const handleLyricsClick = () => {
    setShowLyrics((visible) => !visible);
    setShowWiki(false);
    setShowQueue(false);
  };

  const getDisplayLines = () => {
    if (lyricsLines.length === 0) return [];

    const determineSide = (text: string) => {
      const value = text.trim();
      if (value.startsWith('(') && value.endsWith(')')) return 'right';
      if (value.startsWith('[') && value.endsWith(']')) return 'center';
      return 'left';
    };

    if (!translatedLyrics) {
      return lyricsLines.map((line) => ({
        ...line,
        originalText: line.text,
        side: determineSide(line.text),
      }));
    }

    const translatedArray = translatedLyrics.split('\n');
    return lyricsLines.map((line, index) => ({
      time: line.time,
      originalText: line.text,
      translatedText: translatedArray[index],
      side: determineSide(line.text),
    }));
  };

  const isSameLanguage = () => {
    if (!translationLanguage) return false;
    const text = (plainLyrics || lyricsLines.map((line) => line.text).join(' ')).slice(0, 500);
    if (!text.trim()) return false;

    if (translationLanguage === 'ko' && /[\uAC00-\uD7AF]/.test(text)) return true;
    if (translationLanguage === 'en' && /^[a-zA-Z\s0-9.,!?'"()\-]+$/.test(text)) return true;
    return false;
  };
  const coverArt = currentSong ? getCoverArtUrl(currentSong.coverArt || currentSong.albumId, 800) : undefined;
  const bgStyle = React.useMemo(() => ({
    backgroundImage: coverArt ? `url(${coverArt})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(100px) saturate(250%) brightness(1.1)',
    opacity: 0.8,
    transform: 'scale(1.2)'
  }), [coverArt]);

  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [isLightCover, setIsLightCover] = useState(false);

  useEffect(() => {
    if (!coverArt) { setDominantColor(null); setIsLightCover(false); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const sampleSize = 50;
        canvas.width = sampleSize; canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const data = ctx.getImageData(0,0,sampleSize,sampleSize).data;
        const buckets: Record<string, number> = {};
        let max = 0; let dominant = { r: 18, g: 18, b: 18 };
        for (let i=0;i<data.length;i+=4){
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 128) continue;
          const key = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
          buckets[key] = (buckets[key]||0)+1;
          if (buckets[key] > max){ max = buckets[key]; dominant = {r,g,b}; }
        }
        const { r, g, b } = dominant;
        const hsp = Math.sqrt(0.299*(r*r)+0.587*(g*g)+0.114*(b*b));
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
        setIsLightCover(hsp > 150);
      } catch (e) {
        setDominantColor(null);
        setIsLightCover(false);
      }
    };
    img.src = coverArt;
  }, [coverArt]);

  // Early exit if overlay is closed or there is no current song to display
  if (!isOpen || !currentSong) return null;

  const displayLyricsLines = getDisplayLines();
  const translationDisabled = isTranslating || isSameLanguage();
  const hasOverlay = showLyrics || showWiki || showQueue;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black/10 text-zinc-900 animate-in slide-in-from-bottom-full duration-500 dark:bg-black/40 dark:text-white">
      <div
        className="absolute inset-[-20%] pointer-events-none transition-all duration-1000"
        style={bgStyle}
      />
      <div className="absolute inset-0 pointer-events-none bg-black/10 backdrop-blur-[60px] dark:bg-black/30 animate-in fade-in duration-700" />

      <div className="relative z-[80] flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:pb-4 animate-in fade-in slide-in-from-top duration-700 delay-100">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/20 text-zinc-900 shadow-sm backdrop-blur-2xl transition-all duration-300 hover:bg-white/30 hover:scale-110 active:scale-95 dark:border-white/10 dark:bg-black/20 dark:text-white dark:hover:bg-black/40"
          aria-label="Close now playing"
        >
          <ChevronDown size={24} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-4 py-2 sm:gap-8 sm:px-8">
        {!hasOverlay && (
          <div
            className="flex min-h-0 w-full flex-shrink-0 flex-col items-center justify-center transition-all duration-500 animate-in fade-in zoom-in duration-800 delay-200 lg:h-full lg:w-full"
          >
                <div className="relative animate-in fade-in zoom-in duration-800 delay-300">
              <div
                    className="absolute inset-0 opacity-60 blur-2xl saturate-200 transition-opacity duration-1000 dark:opacity-40 animate-in fade-in duration-1000 delay-400"
                    style={{ ...bgStyle, transform: 'translateY(10%) scale(0.9)' }}
                  />
              <div
                className="relative aspect-square w-[min(68vw,36vh,26rem)] flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 hover:scale-105 dark:border-white/5 sm:w-[min(72vw,42vh,26rem)]"
              >
                {coverArt ? <img src={coverArt} crossOrigin="anonymous" alt={currentSong.title} className="h-full w-full object-cover object-center" /> : null}
              </div>
            </div>

            <div className="mt-3 w-full max-w-md flex-shrink-0 text-center sm:mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
              <h2 className="line-clamp-2 text-xl font-bold tracking-tight drop-shadow-sm min-[380px]:text-2xl sm:text-4xl animate-in fade-in duration-700 delay-500">{currentSong.title}</h2>
              <button
                onClick={() => {
                  onArtistClick?.(currentSong.artistId);
                  onClose();
                }}
                className="mt-1 max-w-full truncate text-lg font-bold text-red-600 opacity-90 drop-shadow-sm transition-all duration-300 hover:opacity-100 hover:underline hover:scale-105 dark:text-red-400 sm:text-2xl animate-in fade-in duration-700 delay-600"
              >
                {currentSong.artist}
              </button>
              <p className="mt-1 line-clamp-1 text-sm font-medium text-zinc-600 drop-shadow-sm dark:text-zinc-300 sm:text-base animate-in fade-in duration-700 delay-700">{currentSong.album}</p>

              {getAudioQualityString(currentSong, streamTranscoding) && (
                <div className="mt-2 flex justify-center sm:mt-3 animate-in fade-in duration-700 delay-800">
                  <span className="max-w-full break-words break-all rounded border border-zinc-300/50 bg-zinc-200/50 px-2.5 py-1 text-[10px] font-bold uppercase text-zinc-600 drop-shadow-sm transition-all duration-300 hover:scale-105 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-400 sm:px-3 sm:text-[11px]">
                    {getAudioQualityString(currentSong, streamTranscoding)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {showLyrics && (
          <div className="absolute inset-0 z-20 flex min-h-0 w-full flex-col px-4 sm:px-8 lg:px-[18vw] animate-in fade-in slide-in-from-bottom-8 duration-800 delay-100 overflow-x-hidden">
            <div
              ref={lyricsContainerRef}
              className="mask-image-vertical min-h-0 flex-1 overflow-y-auto pb-4 scroll-smooth no-scrollbar sm:pb-8 lg:pb-[35vh]"
              style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)' }}
            >
              {loadingLyrics ? (
                <div className="flex h-full items-center justify-center animate-in fade-in duration-500">
                  <div className="flex flex-col items-center gap-4 text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="font-bold">{t('loadingLyrics')}</p>
                  </div>
                </div>
              ) : displayLyricsLines.length > 0 ? (
                <div className="space-y-5 pt-12 sm:space-y-6 lg:pt-[26vh] animate-in fade-in duration-700 delay-100">
                  {displayLyricsLines.map((line, index) => {
                    const isActive = index === activeLyricIdx;
                    const isPassed = index < activeLyricIdx;
                    return (
                      <div
                        key={`${line.time}-${index}`}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => setSeekTo(line.time)}
                        className={`flex cursor-pointer flex-col transition-all duration-500 ${
                          isActive
                            ? 'scale-[1.02] text-zinc-900 dark:text-white'
                            : isPassed
                              ? 'text-zinc-400 dark:text-white/40'
                              : 'text-zinc-300 dark:text-white/20'
                        } ${
                          line.side === 'left' ? 'items-start text-left' : line.side === 'right' ? 'items-end text-right' : 'items-center text-center'
                        } hover:text-red-500 dark:hover:text-red-400`}
                        style={{
                          filter: isActive ? 'blur(0px)' : 'blur(0.5px)',
                          transformOrigin: line.side === 'left' ? 'left' : line.side === 'right' ? 'right' : 'center',
                        }}
                      >
                        <div className="max-w-[92%] break-words text-2xl font-bold drop-shadow-sm sm:text-4xl">{line.originalText || '♪'}</div>
                        {line.translatedText && (
                          <div className={`mt-1 max-w-[92%] break-words text-lg font-medium transition-colors sm:text-2xl ${isActive ? 'text-red-500 dark:text-red-300' : 'text-current opacity-70'}`}>
                            {line.translatedText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : plainLyrics ? (
                <div className="pt-4 text-xl font-medium leading-relaxed text-zinc-800 dark:text-white/80 sm:pt-12 sm:text-3xl animate-in fade-in duration-700 delay-100">
                  <div className="whitespace-pre-line">{plainLyrics}</div>
                  {translatedLyrics && (
                    <div className="mt-8 whitespace-pre-line text-red-600 dark:text-red-300">
                      {translatedLyrics}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center animate-in fade-in duration-500">
                  <p className="text-lg font-bold text-zinc-400 dark:text-zinc-500">{t('noLyrics')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {showWiki && (
          <div className="absolute inset-0 z-20 flex min-h-0 w-full flex-col px-4 sm:px-8 lg:px-[18vw] animate-in fade-in slide-in-from-bottom-8 duration-800 delay-100">
            <div className="mask-image-b min-h-0 flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar sm:pb-12 sm:pr-4">
              {loadingWiki && !wikiData ? (
                <div className="flex h-full items-center justify-center animate-in fade-in duration-500">
                  <div className="flex flex-col items-center gap-4 text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="font-bold">{t('loadingInfo')}</p>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-700 delay-100">
                  <div className="mb-7">
                    <h3 className="mb-2 text-2xl font-bold text-black drop-shadow-sm dark:text-white sm:text-3xl">{t('songInformation')}</h3>
                    {wikiData?.songTitle && <p className="mb-4 text-base font-semibold text-zinc-600 dark:text-zinc-400 sm:text-lg">{wikiData.songTitle}</p>}

                    {wikiData?.songExtract ? (
                      <p className="whitespace-pre-line text-base font-medium leading-relaxed text-zinc-800 drop-shadow-sm dark:text-zinc-200 sm:text-lg">{wikiData.songExtract}</p>
                    ) : (
                      <p className="text-base italic text-zinc-500 sm:text-lg">{t('noSongInfo')}</p>
                    )}
                    {wikiData?.songUrl && (
                      <a href={wikiData.songUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-blue-600 hover:underline dark:text-blue-400">
                        {t('viewOnWikipedia')}
                      </a>
                    )}
                  </div>

                  <div className="mb-7">
                    <h3 className="mb-2 text-2xl font-bold text-black drop-shadow-sm dark:text-white sm:text-3xl">{t('artistInformation')}</h3>
                    {wikiData?.artistTitle && <p className="mb-4 text-base font-semibold text-zinc-600 dark:text-zinc-400 sm:text-lg">{wikiData.artistTitle}</p>}

                    {wikiData?.artistExtract ? (
                      <p className="whitespace-pre-line text-base font-medium leading-relaxed text-zinc-800 drop-shadow-sm dark:text-zinc-200 sm:text-lg">{wikiData.artistExtract}</p>
                    ) : (
                      <p className="text-base italic text-zinc-500 sm:text-lg">{t('noArtistInfo')}</p>
                    )}
                    {wikiData?.artistUrl && (
                      <a href={wikiData.artistUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-blue-600 hover:underline dark:text-blue-400">
                        {t('viewOnWikipedia')}
                      </a>
                    )}
                  </div>

                  {wikiData?.credits && (
                    <div className="mb-7">
                      <h3 className="mb-4 text-2xl font-bold text-black drop-shadow-sm dark:text-white sm:text-3xl">{t('credits')}</h3>
                      <p className="whitespace-pre-line rounded-lg border border-white/20 bg-white/10 p-4 text-base font-medium leading-relaxed text-zinc-800 drop-shadow-sm dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 sm:p-6 sm:text-lg">
                        {wikiData.credits}
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}

        {showQueue && (
          <div className="absolute inset-0 z-20 flex min-h-0 w-full flex-col px-4 sm:px-8 lg:px-[18vw] animate-in fade-in slide-in-from-bottom-8 duration-800 delay-100" onClick={() => setOpenMenuIndex(null)}>
            <div className="min-h-0 flex-1 overflow-y-auto pb-8 pr-1 sm:pb-12">
              <h3 className="mb-4 text-2xl font-bold text-black drop-shadow-sm dark:text-white sm:text-3xl animate-in fade-in duration-700 delay-200">{t('queue')}</h3>
              <div className="space-y-2 animate-in fade-in duration-700 delay-300">
                {queue.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-300 animate-in fade-in hover:translate-x-1 ${
                      index === queueIndex ? 'bg-white/20 text-red-600 dark:bg-black/20 dark:text-red-300 z-10' : 'hover:bg-white/15 dark:hover:bg-black/20 z-0'
                    }`}
                    style={{ overflowWrap: 'break-word' }}
                  >
                    <button
                      onClick={() => playQueueIndex(index)}
                      className="flex-1 flex items-center gap-3 text-left"
                      aria-label={`Play ${song.title}`}
                    >
                      <span className="w-8 text-right text-xs font-bold tabular-nums opacity-60">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words whitespace-normal text-sm font-bold sm:text-base">{song.title}</p>
                        <p className="break-words whitespace-normal text-xs text-zinc-600 dark:text-zinc-400">{song.artist}</p>
                      </div>
                    </button>

                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuIndex(openMenuIndex === index ? null : index); }}
                        className="ml-2 flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-white/10 dark:text-zinc-300 transition-all duration-300 hover:scale-110 active:scale-95"
                        aria-label="Track options"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openMenuIndex === index && (
                        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-zinc-200 bg-white dark:bg-zinc-900 shadow-lg z-[1000] p-1 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); playAfterCurrent(song); setOpenMenuIndex(null); }}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 hover:translate-x-1"
                        >
                          <Play size={16} />
                          <span>{t('playNextInQueue')}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addToQueue(song); setOpenMenuIndex(null); }}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 hover:translate-x-1"
                        >
                          <Plus size={16} />
                          <span>{t('addToQueue')}</span>
                        </button>
                        <a
                          href={getDownloadUrl(song.id)}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200 hover:translate-x-1"
                        >
                          <Download size={16} />
                          <span>{t('downloadTrack')}</span>
                        </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

        <div className="relative flex w-full flex-shrink-0 flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-2 sm:px-8 lg:px-16">
        {showLyrics && (lyricsLines.length > 0 || plainLyrics) && (
          <div className="mb-3 flex w-full max-w-4xl justify-end animate-in fade-in duration-500 delay-200">
            <button
              onClick={handleTranslate}
              disabled={translationDisabled}
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-zinc-800 backdrop-blur-xl transition-all duration-300 hover:bg-white/25 hover:scale-110 active:scale-95 dark:text-zinc-100 sm:h-10 sm:w-10 ${
                translatedLyrics ? 'text-black dark:text-white' : ''
              } ${translationDisabled && !translatedLyrics ? 'cursor-not-allowed opacity-30 grayscale' : ''}`}
              title={isSameLanguage() ? t('lyricsAlreadyTarget') : t('translateLyrics')}
            >
              {isTranslating ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}
            </button>
          </div>
        )}
        <div className="mb-5 flex w-full max-w-4xl items-center gap-3 sm:mb-8 sm:gap-6 group">
          <span className="w-12 text-right text-xs font-medium tabular-nums text-black/60 transition-colors group-hover:text-black dark:text-white/60 dark:group-hover:text-white sm:w-16 sm:text-sm">
            {formatTime(localTime)}
          </span>
          <div className="relative flex flex-1 items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={localTime || 0}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onChange={(event) => {
                const value = parseFloat(event.target.value);
                setLocalTime(value);
                setSeekTo(value);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none overflow-hidden rounded-full bg-white/20 accent-white shadow-inner backdrop-blur-sm dark:bg-white/10 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:appearance-none"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.8) ${((localTime || 0) / (duration || 100)) * 100}%, rgba(255, 255, 255, 0.2) ${((localTime || 0) / (duration || 100)) * 100}%)`,
              }}
            />
            <div
              className="pointer-events-none absolute h-4 w-4 rounded-full bg-white opacity-0 shadow-[0_0_10px_rgba(0,0,0,0.3)] transition-opacity group-hover:opacity-100"
              style={{ left: `calc(${((localTime || 0) / (duration || 100)) * 100}% - 8px)` }}
            />
          </div>
          <span className="w-12 text-xs font-medium tabular-nums text-black/60 transition-colors group-hover:text-black dark:text-white/60 dark:group-hover:text-white sm:w-16 sm:text-sm">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex w-full max-w-4xl flex-col items-center gap-6 sm:gap-10">
          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            <button onClick={playPrev} className={`rounded-full flex items-center justify-center transition-all bg-transparent ${isLightCover ? 'text-zinc-900' : 'text-white'} hover:scale-110 active:scale-95`} style={{ height: 40, width: 40 }} aria-label="Previous">
              <SkipBack size={18} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center justify-center rounded-full transition-all bg-transparent ${isLightCover ? 'text-zinc-900' : 'text-white'}`}
              style={{ height: 56, width: 56, padding: 0 }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current" />}
            </button>
            <button onClick={playNext} className={`rounded-full flex items-center justify-center transition-all bg-transparent ${isLightCover ? 'text-zinc-900' : 'text-white'} hover:scale-110 active:scale-95`} style={{ height: 40, width: 40 }} aria-label="Next">
              <SkipForward size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex w-full max-w-sm items-center justify-between px-4 sm:px-0">
            <a
              href={getDownloadUrl(currentSong.id)}
              download
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:scale-110 active:scale-95 sm:h-14 sm:w-14 ${isLightCover ? 'text-zinc-900' : 'text-white'}`}
              title={t('downloadTrack')}
            >
              <Download size={22} className="sm:h-[26px] sm:w-[26px]" />
            </a>
            
            <button
              onClick={handleWikiClick}
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:scale-110 active:scale-95 sm:h-14 sm:w-14 ${isLightCover ? 'text-zinc-900' : 'text-white'}`}
              title={t('songInfo')}
            >
              {loadingWiki ? <Loader2 size={22} className="animate-spin sm:h-[26px] sm:w-[26px]" /> : <Info size={22} className="sm:h-[26px] sm:w-[26px]" />}
            </button>
            <button
              onClick={() => {
                setShowQueue((value) => !value);
                setShowLyrics(false);
                setShowWiki(false);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:scale-110 active:scale-95 sm:h-14 sm:w-14 ${isLightCover ? 'text-zinc-900' : 'text-white'}`}
              title={t('showQueue')}
            >
              <ListMusic size={22} className="sm:h-[26px] sm:w-[26px]" />
            </button>

            <button
              onClick={handleLyricsClick}
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:scale-110 active:scale-95 sm:h-14 sm:w-14 ${isLightCover ? 'text-zinc-900' : 'text-white'}`}
              title={t('toggleLyrics')}
            >
              <MessageSquareText size={22} className="sm:h-[26px] sm:w-[26px]" />
            </button>
          </div>
          {/* Track info modal removed */}
        </div>
      </div>
    </div>
  );
}

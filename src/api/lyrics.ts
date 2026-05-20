import { fetchSubsonic } from "./subsonic";
import { useAuthStore } from '../store/authStore';

export interface LyricsData {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

export async function getLyrics(artist: string, title: string, album?: string, duration?: number): Promise<LyricsData> {
  const { preferEmbeddedLyrics } = useAuthStore.getState();

  const fetchSubsonicLyrics = async (): Promise<LyricsData | null> => {
    try {
      const data = await fetchSubsonic<any>("getLyrics.view", `artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
      const lyricsList = data['subsonic-response']?.lyricsList?.lyrics;
      const lyrics = Array.isArray(lyricsList) ? lyricsList[0] : data['subsonic-response']?.lyrics;
      
      if (lyrics?.value) {
        return { plainLyrics: lyrics.value };
      }
    } catch (e) {
      console.warn("Failed to fetch from Subsonic", e);
    }
    return null;
  };

  const fetchExternalLyrics = async (): Promise<LyricsData | null> => {
    let bestPlainLyrics: string | null = null;
    let fallbackSyncedLyrics: string | null = null;

    // Try LRCLIB exact match
    try {
      const url = new URL("https://lrclib.net/api/get");
      url.searchParams.append("artist_name", artist);
      url.searchParams.append("track_name", title);
      // Album is often slightly different (e.g. "Deluxe Edition"), so try without album first or use search if this fails
      
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const durationDiff = (duration && data.duration) ? Math.abs(data.duration - duration) : 0;
        const durationMatch = durationDiff < 10;
        
        if (data.syncedLyrics) {
          if (durationMatch) return { syncedLyrics: data.syncedLyrics };
          else fallbackSyncedLyrics = data.syncedLyrics; // Keep as fallback if no better match is found
        }
        if (data.plainLyrics && durationMatch) {
          bestPlainLyrics = data.plainLyrics;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch from LRCLIB get", e);
    }

    // Try LRCLIB search
    try {
      const url = new URL("https://lrclib.net/api/search");
      url.searchParams.append("q", `${artist} ${title}`);
      
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
           const sorted = data.sort((a, b) => {
              if (a.syncedLyrics && !b.syncedLyrics) return -1;
              if (!a.syncedLyrics && b.syncedLyrics) return 1;
              if (duration) {
                 const diffA = Math.abs((a.duration || 0) - duration);
                 const diffB = Math.abs((b.duration || 0) - duration);
                 return diffA - diffB;
              }
              return 0;
           });

           for (const track of sorted) {
              const durationDiff = (duration && track.duration) ? Math.abs(track.duration - duration) : 0;
              const durationMatch = durationDiff < 15; // More lenient for search results
              
              if (track.syncedLyrics) {
                 if (durationMatch) return { syncedLyrics: track.syncedLyrics };
                 if (!fallbackSyncedLyrics) fallbackSyncedLyrics = track.syncedLyrics;
              }
              if (!bestPlainLyrics && track.plainLyrics && durationMatch) {
                 bestPlainLyrics = track.plainLyrics;
              }
           }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch from LRCLIB search", e);
    }

    if (fallbackSyncedLyrics) return { syncedLyrics: fallbackSyncedLyrics };
    return bestPlainLyrics ? { plainLyrics: bestPlainLyrics } : null;
  };

  if (preferEmbeddedLyrics) {
    const subsonic = await fetchSubsonicLyrics();
    if (subsonic) return subsonic;
    const external = await fetchExternalLyrics();
    if (external) return external;
  } else {
    const external = await fetchExternalLyrics();
    if (external) return external;
    const subsonic = await fetchSubsonicLyrics();
    if (subsonic) return subsonic;
  }

  return {};
}

export async function translateLyrics(text: string): Promise<string> {
  const { translationLanguage, googleTranslateApiKey } = useAuthStore.getState();
  const targetLanguage = (translationLanguage || 'ko').trim();
  const sourceLines = text.split('\n');
  const decodeHtmlEntities = (value: string) => {
    const element = document.createElement('textarea');
    element.innerHTML = value;
    return element.value;
  };

  if (googleTranslateApiKey?.trim()) {
    try {
      const url = new URL("https://translation.googleapis.com/language/translate/v2");
      url.searchParams.set("key", googleTranslateApiKey.trim());
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sourceLines,
          target: targetLanguage,
          format: "text"
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || "Failed to translate with Google API");
      }

      const data = await res.json();
      const translations = data.data?.translations;
      if (!Array.isArray(translations)) {
        throw new Error("Invalid Google Translation API response");
      }
      return translations.map((t: any) => decodeHtmlEntities(t.translatedText || '')).join('\n');
    } catch (e) {
      console.error("Google Translate API failed", e);
      throw e;
    }
  }

  // Fallback to free Google Translate API
  try {
    const translatedLines = await Promise.all(
      sourceLines.map(async (line) => {
        if (!line.trim()) return '';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(line)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fallback translation failed");
        const data = await res.json();
        return decodeHtmlEntities(data[0].map((item: any) => item[0]).join(''));
      })
    );
    return translatedLines.join('\n');
  } catch (e) {
    console.error("Google Translate free fallback failed", e);
    throw new Error("Translation failed. Please try again or configure a Google Translate API key in Settings.");
  }
}

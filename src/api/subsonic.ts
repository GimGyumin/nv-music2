import md5 from 'md5';
import { type StreamTranscoding, useAuthStore } from '../store/authStore';
import { SubsonicResponse, Album } from '../types/subsonic';

const CLIENT_ID = 'apple-navi';
const VERSION = '1.16.1';

export function getBaseParams() {
  const { username, token, salt } = useAuthStore.getState();
  return `u=${encodeURIComponent(username)}&t=${token}&s=${salt}&v=${VERSION}&c=${CLIENT_ID}&f=json`;
}

export function generateAuthContext(password: string) {
  const salt = Math.random().toString(36).substring(2, 15);
  const token = md5(password + salt);
  return { token, salt };
}

function resolveUrl(serverUrl: string, endpoint: string, additionalParams = '', includeFormat = true) {
  const base = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  const { username, token, salt } = useAuthStore.getState();
  let params = `u=${encodeURIComponent(username)}&t=${token}&s=${salt}&v=${VERSION}&c=${CLIENT_ID}`;
  if (includeFormat) params += '&f=json';
  
  const joiner = endpoint.includes('?') ? '&' : '?';
  const url = `${base}/rest/${endpoint}${joiner}${params}${additionalParams ? '&' + additionalParams : ''}`;
  return url;
}

const apiCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchSubsonic<T = any>(endpoint: string, params = ''): Promise<T> {
  const { serverUrl } = useAuthStore.getState();
  if (!serverUrl) throw new Error("Server URL not configured");

  const cacheKey = `${endpoint}?${params}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = resolveUrl(serverUrl, endpoint, params, true);
  const response = await fetch(url);
  const data = await response.json();
  
  if (data['subsonic-response']?.status === 'failed') {
    throw new Error(data['subsonic-response'].error?.message || 'Subsonic API error');
  }
  
  apiCache.set(cacheKey, { timestamp: Date.now(), data });
  return data;
}

export function clearSubsonicCache() {
  apiCache.clear();
}

export async function ping(serverUrl: string, username: string, token: string, salt: string) {
  const params = `u=${encodeURIComponent(username)}&t=${token}&s=${salt}&v=${VERSION}&c=${CLIENT_ID}&f=json`;
  const base = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  const url = `${base}/rest/ping.view?${params}`;
  
  const response = await fetch(url);
  const data = await response.json();
  if (data['subsonic-response']?.status !== 'ok') {
    throw new Error(data['subsonic-response']?.error?.message || 'Ping failed');
  }
  return true;
}

export async function startLibraryScan(fullScan = false) {
  const params = fullScan ? 'fullScan=true' : '';
  apiCache.delete('getScanStatus.view?');
  const response = await fetchSubsonic<any>('startScan.view', params);
  return response['subsonic-response'].scanStatus;
}

export async function getScanStatus() {
  apiCache.delete('getScanStatus.view?');
  const response = await fetchSubsonic<any>('getScanStatus.view');
  return response['subsonic-response'].scanStatus;
}

export async function changePassword(username: string, password: string) {
  const response = await fetchSubsonic<any>(
    'changePassword.view',
    `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  );
  return response['subsonic-response']?.status === 'ok';
}

export async function getAlbums(type: 'newest' | 'frequent' | 'recent' | 'alphabeticalByName' | 'random' = 'newest', size = 50): Promise<Album[]> {
  const response = await fetchSubsonic<SubsonicResponse>('getAlbumList2.view', `type=${type}&size=${size}`);
  return response['subsonic-response'].albumList2?.album || [];
}

export async function getAlbum(id: string): Promise<Album> {
  const response = await fetchSubsonic<SubsonicResponse>('getAlbum.view', `id=${id}`);
  const album = response['subsonic-response'].album;
  if (!album) throw new Error("Album not found");
  return album;
}

export async function getArtist(id: string): Promise<any> {
  const response = await fetchSubsonic<any>('getArtist.view', `id=${id}`);
  const artist = response['subsonic-response'].artist;
  if (!artist) throw new Error("Artist not found");
  return artist;
}

export async function getArtistSongs(artistName: string): Promise<any[]> {
  const response = await fetchSubsonic<any>('search3.view', `query=${encodeURIComponent(artistName)}&songCount=100`);
  const songs = response['subsonic-response'].searchResult3?.song || [];
  // Strict filter to ensure data quality
  return songs.filter((s: any) => s.artist.toLowerCase() === artistName.toLowerCase());
}

export async function getRandomSongs(size = 50): Promise<any[]> {
  const response = await fetchSubsonic<any>('getRandomSongs.view', `size=${size}`);
  return response['subsonic-response'].randomSongs?.song || [];
}

export async function search(query: string): Promise<any> {
  const response = await fetchSubsonic<any>('search3.view', `query=${encodeURIComponent(query)}&songCount=500&albumCount=500&artistCount=500`);
  return response['subsonic-response'].searchResult3 || {};
}

export function getCoverArtUrl(id: string, size = 300) {
  const { serverUrl } = useAuthStore.getState();
  if (!serverUrl || !id) return '';
  return resolveUrl(serverUrl, 'getCoverArt.view', `id=${id}&size=${size}`, false);
}

export function getDownloadUrl(id: string) {
  const { serverUrl } = useAuthStore.getState();
  if (!serverUrl || !id) return '';
  return resolveUrl(serverUrl, 'download.view', `id=${id}`, false);
}

function getTranscodingParams(profile: StreamTranscoding) {
  switch (profile) {
    case 'mp3_320':
      return 'format=mp3&maxBitRate=320';
    case 'mp3_256':
      return 'format=mp3&maxBitRate=256';
    case 'mp3_192':
      return 'format=mp3&maxBitRate=192';
    case 'opus_160':
      return 'format=opus&maxBitRate=160';
    case 'original':
    default:
      return '';
  }
}

export function getStreamUrl(id: string) {
  const { serverUrl, streamTranscoding } = useAuthStore.getState();
  if (!serverUrl || !id) return '';
  const transcodingParams = getTranscodingParams(streamTranscoding || 'original');
  const parts = ['id=' + encodeURIComponent(id)];
  if (transcodingParams) parts.push(transcodingParams);
  const params = parts.join('&');
  return resolveUrl(serverUrl, 'stream.view', params, false);
}

export interface SubsonicResponse {
  "subsonic-response": {
    status: "ok" | "failed";
    version: string;
    error?: {
      code: number;
      message: string;
    };
    albumList?: {
      album: Album[];
    };
    albumList2?: {
      album: Album[];
    };
    album?: Album;
    song?: Song;
    directory?: {
      id: string;
      parent: string;
      name: string;
      child: Song[];
    };
  };
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverArt: string;
  songCount: number;
  duration: number;
  created: string;
  copyright?: string;
  releaseDate?: string | {
    year?: number;
    month?: number;
    day?: number;
  };
  originalReleaseDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  year?: number;
  genre?: string;
  song?: Song[]; // Only present when getting album details
}

export interface Song {
  id: string;
  parent: string;
  title: string;
  album: string;
  artist: string;
  track: number;
  year: number;
  coverArt: string;
  size: number;
  contentType: string;
  suffix: string;
  duration: number;
  copyright?: string;
  releaseDate?: string | {
    year?: number;
    month?: number;
    day?: number;
  };
  originalReleaseDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  bitRate: number;
  path: string;
  albumId: string;
  artistId: string;
  type: string;
  discNumber?: number;
}

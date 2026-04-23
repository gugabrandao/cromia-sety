const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface SpotifyTrackInfo {
  bpm: number;
  key: string;
  time_signature: string;
  artwork_url?: string;
  album_name?: string;
  release_date?: string;
  genre?: string;
}

export const getSpotifyToken = async () => {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
};

export const fetchSongMetadata = async (title: string, artist: string): Promise<SpotifyTrackInfo | null> => {
  try {
    const token = await getSpotifyToken();
    
    // 1. Search for the track
    const query = encodeURIComponent(`${title} ${artist}`);
    const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const searchData = await searchResponse.json();
    const track = searchData.tracks?.items?.[0];
    
    if (!track) return null;

    // 2. Get Audio Features (BPM, Key, etc.)
    const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const features = await featuresResponse.json();

    // Map Key and Mode
    const keyName = sharpNotes[features.key] || 'Unknown';
    const modeName = features.mode === 1 ? 'Major' : 'Minor';
    const fullKey = `${keyName} ${modeName}`;

    return {
      bpm: Math.round(features.tempo),
      key: fullKey,
      time_signature: `${features.time_signature}/4`,
      artwork_url: track.album?.images?.[0]?.url,
      album_name: track.album?.name,
      release_date: track.album?.release_date,
      // Spotify doesn't provide track-level genre easily, but we can get it from artist if needed
    };
  } catch (error) {
    console.error('Error fetching Spotify data:', error);
    return null;
  }
};

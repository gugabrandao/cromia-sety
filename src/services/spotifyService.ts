import { supabase } from '../lib/supabase';

export interface TrackMetadata {
  bpm: number;
  key: string;
  time_signature: string;
  artwork_url?: string;
  album_name?: string;
  release_date?: string;
}

/**
 * Invokes the Supabase Edge Function to fetch high-quality song metadata.
 * Uses a hybrid approach (Apple Music + Deezer) to ensure stability and quality.
 */
export const fetchSongMetadata = async (title: string, artist: string): Promise<TrackMetadata | null> => {
  try {
    console.log(`[Metadata] Requesting data for: ${artist} - ${title}`);

    const { data, error } = await supabase.functions.invoke('song-metadata', {
      body: { title, artist },
    });

    if (error) {
      console.error('[Metadata] Edge Function error:', error);
      return null;
    }

    if (!data) {
      console.warn('[Metadata] No data returned from Edge Function.');
      return null;
    }

    console.log(`[Metadata] ✅ Success! BPM: ${data.bpm}, Key: ${data.key}`);
    return data as TrackMetadata;

  } catch (error) {
    console.error('[Metadata] Unexpected service error:', error);
    return null;
  }
};

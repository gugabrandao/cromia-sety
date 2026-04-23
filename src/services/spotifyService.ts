import { supabase } from '../lib/supabase';

interface TrackMetadata {
  bpm: number;
  key: string;
  time_signature: string;
  artwork_url?: string;
  album_name?: string;
  release_date?: string;
}

export const fetchSongMetadata = async (title: string, artist: string): Promise<TrackMetadata | null> => {
  try {
    console.log(`[Metadata] Calling Edge Function for: ${artist} - ${title}`);

    const { data, error } = await supabase.functions.invoke('song-metadata', {
      body: { title, artist },
    });

    if (error) {
      console.error('[Metadata] Edge Function error:', error);
      return null;
    }

    if (!data || (data.bpm === 0 && data.key === 'Unknown')) {
      console.warn('[Metadata] No data found by Edge Function.');
      return null;
    }

    console.log(`[Metadata] ✅ Edge Function returned: BPM=${data.bpm}, Key=${data.key}`);
    return data as TrackMetadata;

  } catch (error) {
    console.error('[Metadata] Unexpected error:', error);
    return null;
  }
};

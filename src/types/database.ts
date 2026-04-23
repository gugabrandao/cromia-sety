export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      musicbox_setlist: {
        Row: {
          id: string
          user_id: string
          title: string
          artist: string
          slug_artist: string | null
          slug_song: string | null
          source: string | null
          source_url: string | null
          content_raw: string | null
          content_html: string | null
          content_json: Json | null
          original_key: string | null
          performance_key: string | null
          bpm: number | null
          time_signature: string | null
          fetch_status: string | null
          fetch_error: string | null
          created_at: string | null
          updated_at: string | null
          observations: string | null
          settings: Json | null
          artwork_url: string | null
          album_name: string | null
          duration_ms: number | null
          genre: string | null
          release_date: string | null
          key: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          artist: string
          slug_artist?: string | null
          slug_song?: string | null
          source?: string | null
          source_url?: string | null
          content_raw?: string | null
          content_html?: string | null
          content_json?: Json | null
          original_key?: string | null
          performance_key?: string | null
          bpm?: number | null
          time_signature?: string | null
          fetch_status?: string | null
          fetch_error?: string | null
          created_at?: string | null
          updated_at?: string | null
          observations?: string | null
          settings?: Json | null
          artwork_url?: string | null
          album_name?: string | null
          duration_ms?: number | null
          genre?: string | null
          release_date?: string | null
          key?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          artist?: string
          slug_artist?: string | null
          slug_song?: string | null
          source?: string | null
          source_url?: string | null
          content_raw?: string | null
          content_html?: string | null
          content_json?: Json | null
          original_key?: string | null
          performance_key?: string | null
          bpm?: number | null
          time_signature?: string | null
          fetch_status?: string | null
          fetch_error?: string | null
          created_at?: string | null
          updated_at?: string | null
          observations?: string | null
          settings?: Json | null
          artwork_url?: string | null
          album_name?: string | null
          duration_ms?: number | null
          genre?: string | null
          release_date?: string | null
          key?: string | null
        }
      }
      musicbox_setlists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          event_type: string | null
          color_theme: string
          cover_image_url: string | null
          event_date: string | null
          event_time: string | null
          venue_name: string | null
          venue_address: string | null
          duration_min: number | null
          estimated_min: number | null
          is_shared: boolean
          share_token: string | null
          share_mode: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          event_type?: string | null
          color_theme?: string
          cover_image_url?: string | null
          event_date?: string | null
          event_time?: string | null
          venue_name?: string | null
          venue_address?: string | null
          duration_min?: number | null
          estimated_min?: number | null
          is_shared?: boolean
          share_token?: string | null
          share_mode?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          event_type?: string | null
          color_theme?: string
          cover_image_url?: string | null
          event_date?: string | null
          event_time?: string | null
          venue_name?: string | null
          venue_address?: string | null
          duration_min?: number | null
          estimated_min?: number | null
          is_shared?: boolean
          share_token?: string | null
          share_mode?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

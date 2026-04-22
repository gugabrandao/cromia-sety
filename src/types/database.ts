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
      musicbox_setlist: {
        Row: {
          id: string
          user_id: string
          setlist_id: string | null
          position: number
          title: string
          artist: string
          slug_artist: string | null
          slug_song: string | null
          source: string
          source_url: string | null
          content_raw: string | null
          content_html: string | null
          content_json: Json | null
          lyrics_only: string | null
          content_versions: Json | null
          original_key: string | null
          performance_key: string | null
          transpose_steps: number
          capo: number
          bpm: number | null
          time_signature: string
          duration_sec: number | null
          difficulty: string | null
          transpose_pref: string
          theme_preset: string
          chord_font: string
          chord_font_size: number
          chord_color: string
          lyric_font: string
          lyric_font_size: number
          lyric_color: string
          bg_color: string
          line_spacing: string
          scroll_speed: number
          auto_scroll: boolean
          show_tabs: boolean
          youtube_url: string | null
          backing_track_url: string | null
          backing_tracks: Json | null
          stem_job_id: string | null
          stem_status: string
          notes: string | null
          color_tag: string | null
          status: string
          fetch_status: string
          fetch_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          setlist_id?: string | null
          position?: number
          title: string
          artist: string
          slug_artist?: string | null
          slug_song?: string | null
          source?: string
          source_url?: string | null
          content_raw?: string | null
          content_html?: string | null
          content_json?: Json | null
          lyrics_only?: string | null
          content_versions?: Json | null
          original_key?: string | null
          performance_key?: string | null
          transpose_steps?: number
          capo?: number
          bpm?: number | null
          time_signature?: string
          duration_sec?: number | null
          difficulty?: string | null
          transpose_pref?: string
          theme_preset?: string
          chord_font?: string
          chord_font_size?: number
          chord_color?: string
          lyric_font?: string
          lyric_font_size?: number
          lyric_color?: string
          bg_color?: string
          line_spacing?: string
          scroll_speed?: number
          auto_scroll?: boolean
          show_tabs?: boolean
          youtube_url?: string | null
          backing_track_url?: string | null
          backing_tracks?: Json | null
          stem_job_id?: string | null
          stem_status?: string
          notes?: string | null
          color_tag?: string | null
          status?: string
          fetch_status?: string
          fetch_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          setlist_id?: string | null
          position?: number
          title?: string
          artist?: string
          slug_artist?: string | null
          slug_song?: string | null
          source?: string
          source_url?: string | null
          content_raw?: string | null
          content_html?: string | null
          content_json?: Json | null
          lyrics_only?: string | null
          content_versions?: Json | null
          original_key?: string | null
          performance_key?: string | null
          transpose_steps?: number
          capo?: number
          bpm?: number | null
          time_signature?: string
          duration_sec?: number | null
          difficulty?: string | null
          transpose_pref?: string
          theme_preset?: string
          chord_font?: string
          chord_font_size?: number
          chord_color?: string
          lyric_font?: string
          lyric_font_size?: number
          lyric_color?: string
          bg_color?: string
          line_spacing?: string
          scroll_speed?: number
          auto_scroll?: boolean
          show_tabs?: boolean
          youtube_url?: string | null
          backing_track_url?: string | null
          backing_tracks?: Json | null
          stem_job_id?: string | null
          stem_status?: string
          notes?: string | null
          color_tag?: string | null
          status?: string
          fetch_status?: string
          fetch_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

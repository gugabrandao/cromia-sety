import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("[song-metadata] Version 1.1.1 - Apple/Deezer Hybrid Active");
  
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, artist } = await req.json();
    if (!title || !artist) return new Response('Missing title/artist', { status: 400, headers: corsHeaders });

    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').trim();
    const searchQuery = `${artist} ${cleanTitle}`;

    let bpm = 0;
    let artwork_url = '';
    let album_name = '';
    let release_date = '';
    let key = 'Unknown';

    // --- 1. Apple Music (iTunes API) - Best for HD Artwork ---
    try {
      const appleRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&limit=1&entity=song`);
      const appleData = await appleRes.json();
      if (appleData.results && appleData.results.length > 0) {
        const track = appleData.results[0];
        // Convert 100x100 to 1000x1000 for high quality
        artwork_url = track.artworkUrl100.replace('100x100bb', '1000x1000bb');
        album_name = track.collectionName;
        release_date = track.releaseDate;
      }
    } catch (e) { console.warn("[song-metadata] Apple failed:", e); }

    // --- 2. Deezer API - Best for stable BPM ---
    try {
      const query = encodeURIComponent(`artist:"${artist}" track:"${cleanTitle}"`);
      const deezerRes = await fetch(`https://api.deezer.com/search?q=${query}`);
      const deezerData = await deezerRes.json();
      if (deezerData.data && deezerData.data.length > 0) {
        const trackId = deezerData.data[0].id;
        const detailRes = await fetch(`https://api.deezer.com/track/${trackId}`);
        const detailData = await detailRes.json();
        bpm = Math.round(detailData.bpm || 0);
        // Fallbacks
        if (!artwork_url) artwork_url = deezerData.data[0].album?.cover_xl;
        if (!album_name) album_name = deezerData.data[0].album?.title;
      }
    } catch (e) { console.warn("[song-metadata] Deezer failed:", e); }

    // --- 3. Key Search (Silent Fallback) ---
    try {
      const keyRes = await fetch(`https://chosic.com/search-results/?q=${encodeURIComponent(searchQuery + ' key')}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4000)
      });
      if (keyRes.ok) {
        const html = await keyRes.text();
        const m = html.match(/Key:\s*([A-G][b#]?\s*(?:Major|Minor|m)?)/i);
        if (m) {
          key = m[1].trim();
          key = key.replace(/♯/g, '#').replace(/♭/g, 'b');
          if (key.endsWith('m') && !key.toLowerCase().includes('minor')) key = key.slice(0, -1) + ' Minor';
          if (!key.toLowerCase().includes('major') && !key.toLowerCase().includes('minor')) key += ' Major';
          key = key.charAt(0).toUpperCase() + key.slice(1);
        }
      }
    } catch { /* Key is non-critical */ }

    const result = { bpm, key, time_signature: '4/4', artwork_url, album_name, release_date };
    console.log(`[song-metadata] ✅ Results:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[song-metadata] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

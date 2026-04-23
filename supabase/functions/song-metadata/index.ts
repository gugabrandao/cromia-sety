import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SEU PROXY DA CLOUDFLARE (O "Invisível")
const MY_PROXY = 'https://sety-proxy.guga-br.workers.dev?url=';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, artist } = await req.json();
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').trim();
    const query = encodeURIComponent(`artist:"${artist}" track:"${cleanTitle}"`);

    // --- 1. Deezer API (BPM, Artwork, Album) ---
    // Deezer não bloqueia o Supabase, então vamos direto nele.
    const searchRes = await fetch(`https://api.deezer.com/search?q=${query}`);
    const searchData = await searchRes.json();
    
    let bpm = 0;
    let artwork_url = '';
    let album_name = '';
    let release_date = '';

    if (searchData.data && searchData.data.length > 0) {
      const track = searchData.data[0];
      const detailRes = await fetch(`https://api.deezer.com/track/${track.id}`);
      const detailData = await detailRes.json();
      bpm = Math.round(detailData.bpm || 0);
      artwork_url = track.album?.cover_xl || track.album?.cover_big;
      album_name = track.album?.title;
      release_date = detailData.release_date;
    }

    // --- 2. Key Search via SEU PROXY CLOUDFLARE ---
    let key = 'Unknown';
    try {
      const keyQuery = encodeURIComponent(`${artist} ${cleanTitle} key`);
      const targetUrl = `https://musicstax.com/search?q=${keyQuery}`;
      
      // Chamamos o seu worker que tem o IP "limpo" da Cloudflare
      const keyRes = await fetch(`${MY_PROXY}${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(8000)
      });
      
      if (keyRes.ok) {
        const html = await keyRes.text();
        const keyMatch = html.match(/Key:\s*([A-G][b#]?\s*(?:Major|Minor|m)?)/i)
                      || html.match(/>([A-G][b#]?\s*(?:Major|Minor))</i)
                      || html.match(/([A-G][b#]?(?:m|maj|min)?)\s*BPM/i);
        if (keyMatch) {
          key = keyMatch[1].trim();
          key = key.replace(/♯/g, '#').replace(/♭/g, 'b');
          if (key.endsWith('m') && !key.toLowerCase().includes('minor')) key = key.slice(0, -1) + ' Minor';
          if (!key.toLowerCase().includes('major') && !key.toLowerCase().includes('minor')) key += ' Major';
          key = key.charAt(0).toUpperCase() + key.slice(1);
        }
      }
    } catch (e) {
      console.warn("[song-metadata] Key proxy fetch failed:", e);
    }

    return new Response(JSON.stringify({ 
      bpm, 
      key, 
      time_signature: '4/4', 
      artwork_url, 
      album_name, 
      release_date 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

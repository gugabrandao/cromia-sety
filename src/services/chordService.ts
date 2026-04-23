/**
 * Chord Service
 * Handles searching and fetching chords from external sources (Cifra Club, etc.)
 */

export interface SongResult {
  title: string;
  artist: string;
  slug_song: string;
  slug_artist: string;
  source: string;
  artwork_url?: string;
  album_name?: string;
  duration_ms?: number;
  genre?: string;
  release_date?: string;
}

export const chordService = {
  async search(query: string): Promise<SongResult[]> {
    const cleanQuery = query.trim();
    console.log(`Searching for: ${cleanQuery}`);

    try {
      // Using iTunes API instead of CifraClub to bypass Cloudflare bot protections
      const targetUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=song&limit=15`;

      const response = await fetch(targetUrl);
      const data = await response.json();

      if (data && data.results && data.results.length > 0) {
        const uniqueSongs = new Map<string, SongResult>();

        data.results.forEach((track: any) => {
          // Remove version info like (Live), (Remastered) from track name for cleaner slugs
          let cleanTitle = track.trackName.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').trim();
          let cleanArtist = track.artistName.trim();

          // Get high-res artwork (600x600)
          const artwork = track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : undefined;

          const normalizeSlug = (str: string) => {
            return str.toLowerCase()
              .replace(/\s*\(.*?\)\s*/g, '') // Remove parênteses
              .replace(/\s*\[.*?\]\s*/g, '') // Remove colchetes
              .replace(/['’´`"]/g, '')       // REMOVE apóstrofos e aspas (não vira hífen)
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
              .replace(/[^a-z0-9]+/g, '-') // troca outros símbolos por hífen
              .replace(/^-+|-+$/g, ''); // limpa hífens extras
          };

          const slugArtist = normalizeSlug(cleanArtist);
          const slugSong = normalizeSlug(cleanTitle);
          const key = `${slugArtist}-${slugSong}`;

          if (!uniqueSongs.has(key)) {
            uniqueSongs.set(key, {
              title: cleanTitle,
              artist: cleanArtist,
              slug_artist: slugArtist,
              slug_song: slugSong,
              source: 'cifraclub',
              artwork_url: artwork,
              album_name: track.collectionName,
              duration_ms: track.trackTimeMillis,
              genre: track.primaryGenreName,
              release_date: track.releaseDate
            });
          }
        });



        return Array.from(uniqueSongs.values()).slice(0, 10);
      }

      return [];
    } catch (error) {
      console.error('Search failed', error);
      return [];
    }
  },

  /**
   * Fetch and parse chord content for a specific song
   * For the demo/MVP, we'll use n8n or a scraping service
   */
  async capture(artistSlug: string, songSlug: string, isSimplified: boolean = false): Promise<any> {
    console.log(`Capturing: ${artistSlug}/${songSlug} (Simplified: ${isSimplified})`);

    const suffix = isSimplified ? 'simplificada.html' : '';
    const targetUrl = `https://www.cifraclub.com.br/${artistSlug}/${songSlug}/${suffix}`;

    // ── CifraClub → ChordPro Converter (shared logic) ─────────────────────
    const isChordToken = (token: string) => {
      if (!token) return false;
      // Regex super limpo e seguro
      const chordRegex = /^[A-G][b#]?(m|min|maj|M|dim|aug|sus|add|7M|7|6|5|4|2|9|11|13|\+|-|\(|\))*(\/[A-G][b#]?)?$/;
      return chordRegex.test(token.trim());
    };


    const convertToChordPro = (rawText: string): string => {
      const lines = rawText.split('\n');
      const out: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '' || /^\[.*\]$/.test(line.trim())) { out.push(line); continue; }
        const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(line.trim()) || line.includes('---');
        const parts = line.split(/(\s+)/);
        const isChordLine = !isTabLine && parts.some(p => isChordToken(p));
        if (!isChordLine) { out.push(line); continue; }
        const next = i + 1 < lines.length ? lines[i + 1] : null;
        const nextIsChord = next ? next.split(/(\s+)/).some(p => isChordToken(p)) : false;
        const nextIsTab = next ? (/^[A-Ge]\|[-|0-9a-z ]+/i.test(next.trim()) || next.includes('---')) : false;
        const nextIsSection = next ? /^\[.*\]$/.test(next.trim()) : false;
        if (next !== null && !nextIsChord && !nextIsTab && !nextIsSection && next.trim() !== '') {
          const padded = next.padEnd(line.length, ' ');
          const positions: { chord: string; index: number }[] = [];
          const re = /(\S+)/g; let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) positions.push({ chord: m[1], index: m.index });
          let merged = ''; let cur = 0;
          for (const cp of positions) {
            if (cp.index > cur) { merged += padded.substring(cur, cp.index); cur = cp.index; }
            merged += `[${cp.chord}]`;
          }
          if (cur < padded.length) merged += padded.substring(cur);
          out.push(merged.trimEnd()); i++;
        } else {
          out.push(line.replace(/(\S+)/g, t => isChordToken(t) ? `[${t}]` : t));
        }
      }
      return out.join('\n');
    };

    const parseHtml = (html: string) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      let content = doc.querySelector('.cifra-txt pre')?.textContent
        || doc.querySelector('.cifra_cnt pre')?.textContent
        || doc.querySelector('pre')?.textContent || '';
      content = content.trim();
      const title = doc.querySelector('.t1')?.textContent?.trim()
        || doc.querySelector('h1')?.textContent?.trim() || songSlug;
      const artist = doc.querySelector('.t3')?.textContent?.trim()
        || doc.querySelector('h2')?.textContent?.trim() || artistSlug;
      return { content, title, artist };
    };

    // ── Proxy list — ordered by reliability ────────────────────────────────
    const CF_WORKER = 'https://sety-proxy.guga-br.workers.dev';
    
    // Generate slug variations to be more resilient
    const slugVariations = [
      songSlug,
      songSlug.replace(/-o-/, '-o'), // sweet-child-o-mine -> sweet-child-omine
      songSlug.replace(/-/g, ''),    // sweet-child-o-mine -> sweetchildomine
    ];

    for (const currentSlug of slugVariations) {
      const currentUrl = `https://www.cifraclub.com.br/${artistSlug}/${currentSlug}/${suffix}`;
      console.log(`Trying variation: ${currentSlug}`);

      const proxies = [
        `${CF_WORKER}?url=${encodeURIComponent(currentUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(currentUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(currentUrl)}`,
      ];

      for (const proxyUrl of proxies) {
        try {
          const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) continue;

          let html = '';
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            html = json.contents || json.data || '';
          } else {
            html = await res.text();
          }

          if (!html || html.includes('Access Denied') || !html.includes('cifra')) continue;

          const { content, title, artist } = parseHtml(html);
          if (!content) continue;

          console.log(`✅ Success via: ${proxyUrl} with slug: ${currentSlug}`);
          return { title, artist, content: convertToChordPro(content), original_url: currentUrl };

        } catch (e) {
          // Silent fail for proxy, try next
        }
      }
    }

    // ── All proxies failed — return structured error (no mock content) ─────
    throw new Error('ALL_PROXIES_FAILED');
  }
};


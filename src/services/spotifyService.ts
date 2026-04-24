export interface TrackMetadata {
  bpm: number;
  key: string;
  time_signature: string;
  artwork_url?: string;
  album_name?: string;
  release_date?: string;
  ai_summary?: string; // Novo campo para o resumo da inteligência artificial
}

// ⚠️ ATENÇÃO: Cole a URL do seu Webhook do n8n aqui
const N8N_WEBHOOK_URL = 'COLE_AQUI_A_URL_DO_SEU_WEBHOOK_DO_N8N';

/**
 * Busca metadados de música usando uma arquitetura direta:
 * 1. Apple Music (iTunes API) direto do cliente para capas HD instantâneas.
 * 2. Webhook do n8n para análise de inteligência artificial (BPM, Tom, Resumo).
 * 
 * @param fastMode Se true, pula a chamada do n8n (que é lenta) e traz só a capa rapidamente.
 */
export const fetchSongMetadata = async (title: string, artist: string, fastMode: boolean = false): Promise<TrackMetadata | null> => {
  try {
    console.log(`[Metadata] Iniciando busca para: ${artist} - ${title} (FastMode: ${fastMode})`);
    
    // Limpa o título para melhorar a busca
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').trim();
    const searchQuery = encodeURIComponent(`${artist} ${cleanTitle}`);

    let metadata: Partial<TrackMetadata> = {
      bpm: 0,
      key: 'Unknown',
      time_signature: '4/4'
    };

    // --- 1. Busca Visual (Apple Music) --- RÁPIDA
    try {
      const appleRes = await fetch(`https://itunes.apple.com/search?term=${searchQuery}&limit=1&entity=song`);
      const appleData = await appleRes.json();
      
      if (appleData.results && appleData.results.length > 0) {
        const track = appleData.results[0];
        metadata.artwork_url = track.artworkUrl100.replace('100x100bb', '1000x1000bb');
        metadata.album_name = track.collectionName;
        metadata.release_date = track.releaseDate;
        console.log(`[Metadata] Apple Music: Capa encontrada.`);
      }
    } catch (e) {
      console.warn("[Metadata] Falha ao buscar na Apple Music:", e);
    }

    // Se estiver no modo rápido (ex: importando música), não chama a IA.
    if (fastMode) {
      console.log(`[Metadata] FastMode ativado. Pulando n8n.`);
      return metadata as TrackMetadata;
    }

    // --- 2. Busca de Inteligência (n8n + LLM) --- LENTA
    try {
      if (N8N_WEBHOOK_URL !== 'COLE_AQUI_A_URL_DO_SEU_WEBHOOK_DO_N8N') {
        const n8nRes = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist, title: cleanTitle })
        });
        
        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          // Esperamos que o n8n devolva { bpm: 120, key: "G", summary: "..." }
          if (n8nData.bpm) metadata.bpm = Math.round(Number(n8nData.bpm));
          if (n8nData.key) metadata.key = n8nData.key;
          if (n8nData.summary) metadata.ai_summary = n8nData.summary;
          console.log(`[Metadata] n8n: Análise concluída.`);
        } else {
          console.warn("[Metadata] n8n retornou erro:", n8nRes.status);
        }
      } else {
        console.warn("[Metadata] URL do n8n não configurada. Pulando análise avançada.");
      }
    } catch (e) {
      console.warn("[Metadata] Falha ao comunicar com o n8n:", e);
    }

    console.log(`[Metadata] ✅ Resultado Final:`, metadata);
    return metadata as TrackMetadata;

  } catch (error) {
    console.error('[Metadata] Erro inesperado:', error);
    return null;
  }
};

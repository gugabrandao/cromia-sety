import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Search, Play, Settings2, Moon, Guitar, Activity, Settings, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchSongMetadata } from '../services/spotifyService';
import SearchModal from '../components/SearchModal';

export default function SetlistView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // States
  const [songs, setSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Edit Config States
  const [editingSong, setEditingSong] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modo Palco States
  const [isPalcoMode, setIsPalcoMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Toggles de Visibilidade do Modo Palco
  const [palcoConfig, setPalcoConfig] = useState(() => {
    const saved = localStorage.getItem('musicbox_palco_config');
    return saved ? JSON.parse(saved) : {
      showKey: true,
      showTempo: false,
      showDesc: false
    };
  });

  // Save config changes
  useEffect(() => {
    localStorage.setItem('musicbox_palco_config', JSON.stringify(palcoConfig));
  }, [palcoConfig]);

  // Fetch Songs
  const fetchSongs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cromiasety_songs')
      .select('*')
      .order('title', { ascending: true });

    if (data) setSongs(data);
    if (error) console.error("Error fetching songs:", error);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // Filter Songs
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songs;
    const query = searchQuery.toLowerCase();
    return songs.filter(song =>
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query)
    );
  }, [songs, searchQuery]);

  // Funções de conversão de tempo
  const msToTime = (ms: number | null) => {
    if (!ms) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const timeToMs = (time: string) => {
    const [minutes, seconds] = time.split(':').map(n => parseInt(n) || 0);
    return (minutes * 60 + seconds) * 1000;
  };

  // Handle Edit Save
  const handleDeleteSong = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja remover esta música do seu repertório?')) return;

    try {
      const { data, error: _error } = await supabase
        .from('cromiasety_songs')
        .delete()
        .eq('id', id)
        .select();

      if (_error) throw _error;
      
      if (!data || data.length === 0) {
        alert('A música não pôde ser apagada do banco de dados. Isso geralmente acontece por falta de permissão (RLS) se a cifra foi importada com um ID de usuário diferente do seu.');
        return;
      }
      
      setSongs(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting song:', err);
      alert('Falha ao deletar a música.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;

    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('cromiasety_songs')
        .update({
          title: editingSong.title,
          artist: editingSong.artist,
          bpm: editingSong.bpm,
          original_key: editingSong.original_key,
          observations: editingSong.observations,
          duration_ms: editingSong.duration_ms,
          tempo_performance_ms: editingSong.tempo_performance_ms,
          bpm_performance: editingSong.bpm_performance,
          tom_performance: editingSong.tom_performance
        })
        .eq('id', editingSong.id);

      if (error) throw error;

      // Update local state
      setSongs(prev => prev.map(s => s.id === editingSong.id ? editingSong : s));
      setEditingSong(null);
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      alert("Falha ao salvar as alterações da música.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchArtwork = async () => {
    if (!editingSong?.title || !editingSong?.artist) return;
    try {
      const metadata = await fetchSongMetadata(editingSong.title, editingSong.artist, true);
      if (metadata?.artwork_url) {
        setEditingSong({ ...editingSong, artwork_url: metadata.artwork_url });
      }
    } catch (err) {
      console.error("Erro ao buscar capa:", err);
    }
  };

  // MODO PALCO RENDER
  if (isPalcoMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden animate-in fade-in duration-300">
        {/* Palco Header */}
        <div className="flex justify-between items-center p-6 bg-black border-b border-white/10 shrink-0">
          <h1 className="text-3xl font-black tracking-tighter opacity-50">PALCO</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Settings2 className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={() => setIsPalcoMode(false)}
              className="px-6 py-4 rounded-full bg-red-500/20 text-red-500 font-bold hover:bg-red-500/30 transition-colors"
            >
              {t('exit')}
            </button>
          </div>
        </div>

        {/* Palco Settings Popover */}
        {showSettings && (
          <div className="absolute top-24 right-6 w-72 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-4 z-[60] animate-in slide-in-from-top-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">{t('visibility')}</h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                <span className="font-medium">{t('key_label')}</span>
                <input type="checkbox" checked={palcoConfig.showKey} onChange={(e) => setPalcoConfig({ ...palcoConfig, showKey: e.target.checked })} className="w-5 h-5 accent-brand-purple" />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                <span className="font-medium">{t('tempo_bpm')}</span>
                <input type="checkbox" checked={palcoConfig.showTempo} onChange={(e) => setPalcoConfig({ ...palcoConfig, showTempo: e.target.checked })} className="w-5 h-5 accent-brand-purple" />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                <span className="font-medium">{t('description_ai')}</span>
                <input type="checkbox" checked={palcoConfig.showDesc} onChange={(e) => setPalcoConfig({ ...palcoConfig, showDesc: e.target.checked })} className="w-5 h-5 accent-brand-purple" />
              </label>
            </div>
          </div>
        )}

        {/* Palco List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-32">
          {filteredSongs.map((song, index) => (
            <div
              key={song.id}
              onClick={() => navigate(`/song/${song.id}`)}
              className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5"
            >
              <div className="text-3xl font-black text-white/20 w-12 text-right shrink-0">{index + 1}</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-4xl md:text-5xl font-black truncate leading-tight tracking-tight">{song.title}</h2>
                <p className="text-xl text-white/50 truncate mt-1">{song.artist}</p>
                {palcoConfig.showDesc && song.observations && (
                  <p className="text-lg text-brand-accent italic mt-3 line-clamp-2">{song.observations}</p>
                )}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {palcoConfig.showKey && song.original_key && (
                  <div className="px-5 py-2 rounded-xl bg-brand-purple/20 text-brand-purple text-2xl font-black">
                    {song.original_key}
                  </div>
                )}
                {palcoConfig.showTempo && song.bpm && (
                  <div className="px-5 py-2 rounded-xl bg-white/10 text-white/70 text-xl font-bold">
                    {song.bpm}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MODO GESTÃO (LISTA RICA) RENDER
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-32 animate-in fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">{t('my_repertoire')}</h1>
          <p className="text-foreground/50 text-lg">{t('manage_repertoire_desc')}</p>
        </div>

        <button
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error: _error } = await (supabase.from('cromiasety_songs') as any).insert({
              user_id: user?.id,
              title: 'Nova Cifra',
              artist: 'Artista Desconhecido',
              content_raw: '[C]\nNova música para o seu repertório.',
              fetch_status: 'success'
            }).select().single();
            if (data) navigate(`/song/${(data as any).id}`);
          }}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-purple text-white rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-purple/20"
        >
          <Plus className="w-5 h-5" />
          CRIAR CIFRA
        </button>

        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-accent text-white rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-accent/20"
        >
          <Search className="w-5 h-5" />
          BUSCAR CIFRA
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <input
            type="text"
            placeholder={t('search_song_artist')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl py-4 pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 font-medium transition-all"
          />
        </div>
        <div className="flex gap-2">
          {/* Espaço para futuros botões de ordenação (Tags, Energia) */}
          <button className="px-6 py-4 rounded-2xl bg-foreground/5 text-foreground/60 font-bold hover:bg-foreground/10 transition-colors">
            {t('alphabetical_order')}
          </button>
        </div>
      </div>

      {/* Rich List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-20 text-foreground/40 font-medium">{t('loading_repertoire')}</div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-20 bg-foreground/5 rounded-3xl border border-foreground/10">
            <Guitar className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('no_songs_found')}</h3>
            <p className="text-foreground/50">{t('try_searching_another')}</p>
          </div>
        ) : (
          filteredSongs.map((song) => (
            <div
              key={song.id}
              onClick={() => navigate(`/song/${song.id}`)}
              className="group flex items-center p-3 pr-6 bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 hover:border-brand-purple/30 rounded-2xl transition-all cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-xl bg-foreground/10 overflow-hidden shrink-0 shadow-md mr-4 relative">
                {song.artwork_url ? (
                  <img src={song.artwork_url} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Guitar className="w-6 h-6 text-foreground/30" /></div>
                )}
                {/* Overlay Play Icon */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-xl font-bold truncate leading-tight">{song.title}</h3>
                <p className="text-sm text-foreground/60 truncate">{song.artist}</p>
              </div>

              {/* Badges & Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {song.original_key && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
                    <span className="text-xs font-black">{song.original_key}</span>
                  </div>
                )}
                {song.bpm && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{song.bpm}</span>
                  </div>
                )}

                {/* Config Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Previne abrir a música
                    setEditingSong({ ...song });
                  }}
                  className="p-2 ml-2 rounded-xl bg-foreground/5 hover:bg-brand-purple/20 text-foreground/40 hover:text-brand-purple transition-all opacity-0 group-hover:opacity-100"
                  title={t('song_config')}
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteSong(e, song.id)}
                  className="p-2 rounded-xl bg-foreground/5 hover:bg-red-500/20 text-foreground/40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  title="Remover música"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Configurações (Edição de Metadados) */}
      {editingSong && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background border border-foreground/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-2xl bg-foreground/5 overflow-hidden shrink-0 shadow-lg relative group">
                {editingSong.artwork_url ? (
                  <img src={editingSong.artwork_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Guitar className="w-8 h-8 text-foreground/20" /></div>
                )}
                <button 
                  onClick={handleFetchArtwork}
                  className="absolute inset-0 bg-brand-purple/80 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold"
                >
                  <Search className="w-5 h-5 mb-1" />
                  BUSCAR CAPA
                </button>
              </div>
              <div>
                <h2 className="text-2xl font-black">{t('song_config')}</h2>
                <p className="text-sm text-foreground/50">Ajuste os detalhes para o palco</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-foreground/60 mb-2">{t('song_title')}</label>
                  <input
                    type="text"
                    required
                    value={editingSong.title || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-foreground/60 mb-2">{t('artist_band')}</label>
                  <input
                    type="text"
                    value={editingSong.artist || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, artist: e.target.value })}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground/60 mb-2">Tom Performance</label>
                  <input
                    type="text"
                    value={editingSong.tom_performance || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, tom_performance: e.target.value })}
                    placeholder="Ex: G, Am"
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground/60 mb-2">BPM Performance</label>
                  <input
                    type="number"
                    value={editingSong.bpm_performance || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, bpm_performance: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Ex: 120"
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground/60 mb-2">Duração Performance (VS)</label>
                  <input
                    type="text"
                    value={msToTime(editingSong.tempo_performance_ms)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9:]*$/.test(val)) {
                        setEditingSong({ ...editingSong, tempo_performance_ms: timeToMs(val) });
                      }
                    }}
                    placeholder="00:00"
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
                <div className="col-span-2 p-4 rounded-2xl bg-foreground/5 border border-foreground/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-3 text-center">Metadados Originais (Apenas Leitura)</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="block text-[9px] font-bold opacity-50 uppercase tracking-tighter">Tom Original</span>
                      <span className="font-bold text-sm">{editingSong.original_key || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold opacity-50 uppercase tracking-tighter">BPM Original</span>
                      <span className="font-bold text-sm">{editingSong.bpm || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold opacity-50 uppercase tracking-tighter">Duração Original</span>
                      <span className="font-bold text-sm">{msToTime(editingSong.duration_ms) || '00:00'}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-foreground/60 mb-2">{t('description_ai')}</label>
                  <textarea
                    value={editingSong.observations || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, observations: e.target.value })}
                    rows={4}
                    placeholder="Notas sobre a performance, estrutura ou resumo da IA..."
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple resize-y"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 mt-6 border-t border-foreground/10">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="flex-1 py-3 font-bold text-foreground/60 hover:bg-foreground/5 rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 font-bold bg-brand-purple text-white rounded-xl hover:bg-brand-accent transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)}
        onSongAdded={() => fetchSongs()}
      />
    </div>
  );
}

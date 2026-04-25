import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon, Music2, Plus, Loader2,
  Guitar, Check, X, ArrowRight, Sparkles
} from 'lucide-react';
import { chordService } from '../services/chordService';
import type { SongResult } from '../services/chordService';
import { supabase } from '../lib/supabase';
import { fetchSongMetadata } from '../services/spotifyService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongAdded?: () => void;
}

export default function SearchModal({ isOpen, onClose, onSongAdded }: SearchModalProps) {
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [addedSongs, setAddedSongs] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState<string | null>(null);
  const [results, setResults] = useState<SongResult[]>([]);
  const [previewSong, setPreviewSong] = useState<SongResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSimplified, setIsSimplified] = useState(false);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await chordService.search(searchQuery);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced Auto-Search
  const handleSelectPreview = async (song: SongResult) => {
    setPreviewSong(song);
    setIsPreviewLoading(true);
    setIsSimplified(false);

    try {
      // Pré-fetch do Spotify para garantir que a foto no preview seja a mesma que será salva
      const spotifyData = await fetchSongMetadata(song.title, song.artist, true);
      if (spotifyData?.artwork_url) {
        setPreviewSong(prev => prev ? { ...prev, artwork_url: spotifyData.artwork_url } : null);
      }
    } catch (err) {
      console.error('Spotify pre-fetch failed:', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (query.trim().length > 2) {
        handleSearch(query);
      } else if (query.trim().length === 0) {
        setResults([]);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleAddSong = async (song: SongResult, simplified: boolean = false) => {
    const songId = `${song.slug_artist}-${song.slug_song}`;
    setIsAdding(songId);
    let manualMode = false;

    try {
      // 1. Tenta capturar a cifra
      let captured: any = null;
      try {
        captured = await chordService.capture(song.slug_artist, song.slug_song, simplified);
      } catch (err: any) {
        if (err?.message === 'ALL_PROXIES_FAILED') {
          manualMode = true;
          captured = {
            title: song.title,
            artist: song.artist,
            content: '[C]\n(Adicione sua cifra aqui...)',
            original_url: ''
          };
        } else {
          throw err;
        }
      }

      // 2. Metadados do Spotify
      let spotifyData = null;
      try {
        spotifyData = await fetchSongMetadata(captured.title, captured.artist, true);
      } catch (err) {
        console.error('Spotify fetch failed:', err);
      }

      // 3. Salva no Supabase (mesmo que a cifra tenha falhado, salvamos os metadados)
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { error } = await supabase.from('cromiasety_songs').insert({
        user_id: userId,
        title: manualMode ? captured.title : (simplified ? `${captured.title} (Simplificada)` : captured.title),
        artist: captured.artist,
        slug_artist: song.slug_artist,
        slug_song: song.slug_song,
        source: manualMode ? 'manual' : 'cifraclub',
        source_url: captured.original_url,
        artwork_url: spotifyData?.artwork_url || song.artwork_url,
        album_name: spotifyData?.album_name || song.album_name,
        duration_ms: song.duration_ms,
        genre: song.genre,
        release_date: spotifyData?.release_date || song.release_date,
        bpm: spotifyData?.bpm,
        original_key: spotifyData?.key,
        time_signature: spotifyData?.time_signature,
        content_raw: captured.content,
        fetch_status: manualMode ? 'error' : 'success'
      } as any);

      if (error) throw error;

      setAddedSongs(prev => new Set(prev).add(songId));

      if (manualMode) {
        setShowToast('Dados importados! Cifra não encontrada, edite manualmente.');
      } else {
        setShowToast(`"${captured.title}" adicionada!`);
      }

      if (onSongAdded) onSongAdded();
      setTimeout(() => setShowToast(null), 6000);
    } catch (error: any) {
      console.error('Error adding song:', error);
      setShowToast('Erro ao adicionar música. Tente novamente.');
      setTimeout(() => setShowToast(null), 5000);
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-background border border-foreground/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 border-b border-foreground/5 flex items-center justify-between bg-foreground/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center">
                  <SearchIcon className="w-6 h-6 text-brand-purple" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Buscar Música</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-full hover:bg-foreground/5 transition-colors text-foreground/40 hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Search Input */}
              <div className="relative mb-8">
                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-foreground/30 w-6 h-6" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome da música ou artista..."
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-[2rem] py-5 pl-16 pr-6 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 focus:border-brand-purple transition-all text-lg font-bold"
                />
              </div>

              {/* Results */}
              <div className="space-y-3">
                {isSearching && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-50">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-accent" />
                    <p className="font-bold uppercase text-[10px] tracking-widest">Buscando...</p>
                  </div>
                )}

                {!isSearching && results.length > 0 && (
                  <div className="grid grid-cols-1 gap-3">
                    {results.map((song) => {
                      const songId = `${song.slug_artist}-${song.slug_song}`;
                      return (
                        <div
                          key={songId}
                          onClick={() => { if (!addedSongs.has(songId)) handleSelectPreview(song); }}
                          className="glass group flex items-center justify-between p-4 rounded-2xl border border-foreground/5 hover:border-brand-purple/30 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:bg-brand-purple/10 transition-colors overflow-hidden">
                              {song.artwork_url ? (
                                <img src={song.artwork_url} className="w-full h-full object-cover" />
                              ) : (
                                <Guitar className="w-6 h-6 text-brand-purple/40" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground group-hover:text-brand-purple transition-colors">{song.title}</h4>
                              <p className="text-xs font-bold text-foreground/40 uppercase tracking-wider">{song.artist}</p>
                            </div>
                          </div>
                          <button
                            disabled={isAdding === songId || addedSongs.has(songId)}
                            className={`p-3 rounded-xl transition-all ${addedSongs.has(songId)
                              ? 'bg-green-500 text-white cursor-default'
                              : 'bg-brand-purple/10 text-brand-purple group-hover:bg-brand-purple group-hover:text-white'
                              }`}
                          >
                            {isAdding === songId ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : addedSongs.has(songId) ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isSearching && hasSearched && query.length > 0 && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-foreground/40 glass rounded-3xl border border-foreground/5">
                    <Music2 className="w-12 h-12 mb-4 opacity-10" />
                    <p className="font-bold">Nenhum resultado para "{query}"</p>
                  </div>
                )}

                {!hasSearched && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-20">
                    <Sparkles className="w-16 h-16 mb-4" />
                    <p className="font-bold uppercase text-xs tracking-widest text-center">Digite o nome de uma música/artista<br />para começar<br /><br />ATENÇÃO: <br />Quando não houver a cifra pronta no Mercado,<br /> importaremos os dados da música e <br /> você poderá criar a cifra manualmente.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-foreground/[0.02] border-t border-foreground/5 flex justify-center min-h-[80px] items-center px-8 text-center">
              {showToast ? (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={`font-bold text-sm flex items-center gap-2 ${showToast.includes('não encontrada') || showToast.includes('manualmente') ? 'text-amber-500' : 'text-green-500'}`}
                >
                  {showToast.includes('não encontrada') || showToast.includes('manualmente') ? <Sparkles className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                  <span>{showToast}</span>
                </motion.div>
              ) : (
                <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">Cromia Sety • Importação via Nuvem</p>
              )}
            </div>
          </motion.div>

          {/* Preview Modal (Nested) */}
          <AnimatePresence>
            {previewSong && (
              <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/40 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass w-full max-w-md rounded-[2.5rem] border border-foreground/10 shadow-2xl p-8"
                >
                  <div className="flex items-start gap-6 mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-foreground/5 flex items-center justify-center shrink-0 overflow-hidden shadow-xl shadow-black/20 relative">
                      {isPreviewLoading && (
                        <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-10">
                          <Loader2 className="w-6 h-6 animate-spin text-brand-purple" />
                        </div>
                      )}
                      {previewSong.artwork_url ? (
                        <img src={previewSong.artwork_url} className="w-full h-full object-cover" />
                      ) : (
                        <Guitar className="w-10 h-10 text-brand-purple" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black leading-tight mb-1">{previewSong.title}</h2>
                      <p className="text-sm font-bold text-foreground/40 uppercase tracking-widest">{previewSong.artist}</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 mb-4 ml-1">Versão da Cifra</h3>
                    <div className="flex bg-foreground/5 p-1.5 rounded-2xl">
                      <button
                        onClick={() => setIsSimplified(false)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${!isSimplified ? 'bg-background shadow-lg text-foreground' : 'text-foreground/40 hover:text-foreground'}`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setIsSimplified(true)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${isSimplified ? 'bg-background shadow-lg text-brand-purple' : 'text-foreground/40 hover:text-foreground'}`}
                      >
                        Simplificada
                      </button>
                    </div>
                    {isSimplified && (
                      <p className="text-[10px] font-bold text-brand-purple/70 mt-4 text-center px-4 uppercase tracking-wider">
                        🤖 Nosso robô buscará a versão facilitada.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setPreviewSong(null)}
                      className="flex-1 py-4 rounded-2xl font-black text-foreground/40 hover:bg-foreground/5 transition-all text-xs uppercase tracking-widest"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => { handleAddSong(previewSong, isSimplified); setPreviewSong(null); }}
                      className="flex-[2] py-4 rounded-2xl font-black bg-brand-purple text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand-purple/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      <Plus className="w-4 h-4" strokeWidth={3} /> Importar Agora
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}

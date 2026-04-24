import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Plus, Moon, Settings2, Trash2, ArrowLeft, Loader2, Guitar, Activity, Calendar, Watch } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

function SortableItem({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 cursor-grab active:cursor-grabbing text-foreground/20 hover:text-brand-purple transition-colors z-20"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      {children}
    </div>
  );
}

export default function SetlistDetailView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [setlist, setSetlist] = useState<any>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal de Adicionar Músicas
  const [showAddModal, setShowAddModal] = useState(false);
  const [librarySongs, setLibrarySongs] = useState<any[]>([]);
  const [searchLibrary, setSearchLibrary] = useState('');
  const [isAddingSong, setIsAddingSong] = useState<string | null>(null);

  // Estados da Pausa
  const [pauseName, setPauseName] = useState('');
  const [pauseDuration, setPauseDuration] = useState('');
  const [isAddingPause, setIsAddingPause] = useState(false);

  const msToTime = (ms: number | null) => {
    if (!ms) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalMs = useMemo(() => {
    return setlistSongs.reduce((acc, link) => {
      if (link.is_interval) {
        return acc + (link.interval_duration || 0) * 60 * 1000;
      }
      return acc + (link.song?.tempo_performance_ms || link.song?.duration_ms || 0);
    }, 0);
  }, [setlistSongs]);

  // Modo Palco (Agora Setlist de Chão)
  const [isPalcoMode, setIsPalcoMode] = useState(false);
  const [currentPalcoIndex, setCurrentPalcoIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [palcoConfig, setPalcoConfig] = useState(() => {
    const saved = localStorage.getItem('musicbox_palco_config');
    return saved ? JSON.parse(saved) : { showKey: true, showTempo: false, showDesc: false };
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    localStorage.setItem('musicbox_palco_config', JSON.stringify(palcoConfig));
  }, [palcoConfig]);

  useEffect(() => {
    fetchSetlistData();
  }, [id]);

  async function fetchSetlistData() {
    if (!id) return;
    setIsLoading(true);
    // 1. Fetch Setlist details
    const { data: setlistData } = await supabase
      .from('cromiasety_setlists')
      .select('*')
      .eq('id', id!)
      .single();

    if (setlistData) setSetlist(setlistData);

    // 2. Fetch linked songs using Foreign Key join
    const { data: songsData } = await supabase
      .from('cromiasety_setlist_songs')
      .select(`
        id, 
        position, 
        is_interval,
        interval_name,
        interval_duration,
        song_id,
        song:song_id (id, title, artist, original_key, bpm, observations, artwork_url, content_html, duration_ms, tempo_performance_ms, bpm_performance, tom_performance)
      `)
      .eq('setlist_id', id!)
      .order('position', { ascending: true });

    if (songsData) {
      setSetlistSongs(songsData);
    }
    setIsLoading(false);
  }

  // Abre o modal e busca a biblioteca geral do usuário
  async function openAddModal() {
    setShowAddModal(true);
    const { data } = await supabase
      .from('cromiasety_setlist')
      .select('id, title, artist, artwork_url, original_key, bpm, duration_ms')
      .order('title', { ascending: true });

    if (data) setLibrarySongs(data);
  }

  // Filtra as músicas da biblioteca (Remove as que já estão no setlist)
  const availableLibrarySongs = useMemo(() => {
    const currentSongIds = new Set(setlistSongs.map(ss => ss.song?.id).filter(Boolean));
    let filtered = librarySongs.filter(ls => !currentSongIds.has(ls.id));

    if (searchLibrary.trim()) {
      const q = searchLibrary.toLowerCase();
      filtered = filtered.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    }
    return filtered;
  }, [librarySongs, setlistSongs, searchLibrary]);

  async function handleAddSongToSetlist(songId: string) {
    if (!id) return;
    setIsAddingSong(songId);
    try {
      const newPosition = setlistSongs.length + 1;
      const { error } = await supabase.from('cromiasety_setlist_songs').insert({
        setlist_id: id,
        song_id: songId,
        position: newPosition
      } as any);

      if (error) throw error;
      await fetchSetlistData(); // Atualiza a lista
    } catch (err) {
      console.error("Erro ao adicionar música no setlist:", err);
      alert("Erro ao adicionar música. As tabelas estão criadas no Supabase?");
    } finally {
      setIsAddingSong(null);
    }
  }

  async function handleAddPause() {
    if (!id || !pauseName.trim()) return;
    setIsAddingPause(true);
    try {
      const newPosition = setlistSongs.length + 1;
      const { error } = await supabase.from('cromiasety_setlist_songs').insert({
        setlist_id: id,
        position: newPosition,
        is_interval: true,
        interval_name: pauseName.trim(),
        interval_duration: pauseDuration ? parseInt(pauseDuration) : null,
        song_id: null // Necessário ter alterado a tabela no Supabase para DROP NOT NULL
      } as any);

      if (error) throw error;
      setPauseName('');
      setPauseDuration('');
      await fetchSetlistData();
    } catch (err) {
      console.error("Erro ao adicionar pausa:", err);
      alert("Erro ao adicionar pausa. Verifique se você rodou o SQL (ALTER TABLE) no Supabase para permitir song_id nulo e as novas colunas.");
    } finally {
      setIsAddingPause(false);
    }
  }

  async function handleRemoveFromSetlist(e: React.MouseEvent, linkId: string) {
    e.stopPropagation();
    if (!confirm(t('remove_song_confirm'))) return;

    try {
      const { error } = await supabase.from('cromiasety_setlist_songs').delete().eq('id', linkId);
      if (error) throw error;
      setSetlistSongs(prev => prev.filter(s => s.id !== linkId));
    } catch (err) {
      console.error(err);
    }
  }

  const navigateToSong = (songId: string) => {
    navigate(`/song/${songId}?setlistId=${id}`);
  };

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = setlistSongs.findIndex((item) => item.id === active.id);
      const newIndex = setlistSongs.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(setlistSongs, oldIndex, newIndex);

      // Update state immediately for smoothness
      setSetlistSongs(newOrder);

      // Sync with database
      try {
        const updates = newOrder.map((item, index) => ({
          id: item.id,
          position: index + 1,
          setlist_id: id,
          song_id: item.song_id || null, // Keep the original song_id if it exists
          is_interval: item.is_interval,
          interval_name: item.interval_name,
          interval_duration: item.interval_duration
        }));

        const { error } = await (supabase as any)
          .from('cromiasety_setlist_songs')
          .upsert(updates);

        if (error) throw error;
      } catch (err) {
        console.error("Error updating positions:", err);
        // Rollback if needed or show error
        fetchSetlistData();
      }
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-purple" /></div>;
  }

  if (!setlist) {
    return <div className="text-center py-20 text-xl font-bold">{t('setlist_not_found')}</div>;
  }

  // --- MODO PALCO ---
  if (isPalcoMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden animate-in fade-in duration-300">
        <div className="flex justify-between items-center p-6 bg-black border-b border-white/10 shrink-0">
          <div>
            <h1 className="text-3xl font-black tracking-tighter opacity-80">{setlist.name}</h1>
            <p className="text-white/40 font-bold tracking-widest uppercase text-xs mt-1">SETLIST DE CHÃO</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSettings(!showSettings)} className="p-4 rounded-full bg-white/5 hover:bg-white/10">
              <Settings2 className="w-6 h-6 text-white" />
            </button>
            <button onClick={() => setIsPalcoMode(false)} className="px-6 py-4 rounded-full bg-red-500/20 text-red-500 font-bold hover:bg-red-500/30">
              Sair
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="absolute top-24 right-6 w-72 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-4 z-[60]">
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

        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {setlistSongs.length === 0 ? (
            <div className="text-white/50 text-2xl font-bold">O Setlist está vazio.</div>
          ) : (
            <>
              {/* Controles Laterais Absolutos (Esquerda e Direita) */}
              <button
                disabled={currentPalcoIndex === 0}
                onClick={() => setCurrentPalcoIndex(p => p - 1)}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-20 h-32 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-3xl transition-colors disabled:opacity-20 z-10"
              >
                <ArrowLeft className="w-10 h-10 text-white" />
              </button>

              <button
                disabled={currentPalcoIndex === setlistSongs.length - 1}
                onClick={() => setCurrentPalcoIndex(p => p + 1)}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-20 h-32 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-3xl transition-colors disabled:opacity-20 z-10"
              >
                <ArrowLeft className="w-10 h-10 text-white rotate-180" />
              </button>

              {/* Item Atual Centralizado com Swipe */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPalcoIndex}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    const swipeThreshold = 50;
                    if (info.offset.x > swipeThreshold && currentPalcoIndex > 0) {
                      setCurrentPalcoIndex(p => p - 1);
                    } else if (info.offset.x < -swipeThreshold && currentPalcoIndex < setlistSongs.length - 1) {
                      setCurrentPalcoIndex(p => p + 1);
                    }
                  }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full max-w-4xl flex flex-col items-center text-center cursor-grab active:cursor-grabbing"
                >
                  <div className="text-brand-purple font-black text-2xl mb-8 tracking-widest uppercase">
                    {currentPalcoIndex + 1} DE {setlistSongs.length}
                  </div>

                  {setlistSongs[currentPalcoIndex].is_interval ? (
                    <div className="flex flex-col items-center">
                      <div className="w-32 h-32 rounded-full bg-brand-purple/10 flex items-center justify-center mb-8 shadow-2xl shadow-brand-purple/20">
                        <Activity className="w-16 h-16 text-brand-purple" />
                      </div>
                      <h2 className="text-6xl md:text-8xl font-black text-brand-purple mb-6 tracking-tighter leading-tight uppercase">
                        {setlistSongs[currentPalcoIndex].interval_name || 'Pausa'}
                      </h2>
                      {setlistSongs[currentPalcoIndex].interval_duration && (
                        <div className="px-12 py-6 rounded-3xl bg-brand-purple text-white text-4xl font-black shadow-2xl shadow-brand-purple/50">
                          {setlistSongs[currentPalcoIndex].interval_duration} MIN
                        </div>
                      )}
                    </div>
                  ) : (
                    /* MODO CHÃO (Tamanhão) */
                    <div className="group">
                      <h2 className="text-7xl md:text-[10rem] font-black text-white mb-8 tracking-tighter leading-none group-hover:text-brand-purple transition-colors">
                        {setlistSongs[currentPalcoIndex].song?.title}
                      </h2>
                      <p className="text-4xl md:text-6xl text-white/40 font-bold mb-16">
                        {setlistSongs[currentPalcoIndex].song?.artist}
                      </p>

                      <div className="flex flex-wrap justify-center gap-8">
                        {palcoConfig.showKey && setlistSongs[currentPalcoIndex].song?.original_key && (
                          <div className="px-10 py-5 rounded-[2.5rem] bg-brand-purple/20 text-brand-purple text-5xl font-black">
                            {setlistSongs[currentPalcoIndex].song?.original_key}
                          </div>
                        )}
                        {palcoConfig.showTempo && setlistSongs[currentPalcoIndex].song?.bpm && (
                          <div className="px-10 py-5 rounded-[2.5rem] bg-white/10 text-white/70 text-5xl font-bold">
                            {setlistSongs[currentPalcoIndex].song?.bpm} BPM
                          </div>
                        )}
                      </div>
                      {palcoConfig.showDesc && setlistSongs[currentPalcoIndex].song?.observations && (
                        <p className="text-3xl text-brand-accent italic mt-16 max-w-4xl">
                          {setlistSongs[currentPalcoIndex].song?.observations}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- MODO GESTÃO DO SETLIST ---
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-32 animate-in fade-in relative">
      <button onClick={() => navigate('/setlists')} className="flex items-center gap-2 text-foreground/50 text-xl hover:text-brand-purple font-bold mb-8 transition-colors">
        <ArrowLeft className="w-5 h-5" /> {t('back_to_setlists')}
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">{setlist.name}</h1>
          <div className="flex flex-wrap gap-4 text-foreground/50 text-sm font-bold uppercase tracking-widest">
            <span>{setlistSongs.filter(s => !s.is_interval).length} Músicas</span>
            <span className="flex items-center gap-1 text-foreground/50"><Watch className="w-5 h-5" /> {msToTime(totalMs)} Total</span>
            {setlist.event_date && (
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {setlist.event_date.split('-').reverse().join('/')}</span>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={openAddModal} className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-purple text-white text-lg rounded-full font-bold hover:scale-105 active:scale-95 transition-all border border-foreground/10">
            <Plus className="w-5 h-5" /> {t('add_button')}
          </button>
          <button
            disabled={setlistSongs.length === 0}
            onClick={() => setIsPalcoMode(true)}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-brand-purple text-foreground rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
          >
            <Moon className="w-5 h-5" fill="currentColor" />
            SETLIST DE CHÃO
          </button>
        </div>
      </div>

      {/* Songs List */}
      <div className="space-y-3">
        {setlistSongs.length === 0 ? (
          <div className="text-center py-20 bg-foreground/5 rounded-3xl border border-foreground/10 flex flex-col items-center">
            <Guitar className="w-12 h-12 text-foreground/20 mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('empty_setlist')}</h3>
            <p className="text-foreground/50 mb-6">{t('add_songs_to_setlist')}</p>
            <button onClick={openAddModal} className="px-6 py-3 bg-brand-purple text-white rounded-xl font-bold">{t('add_songs')}</button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={setlistSongs.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {setlistSongs.map((link, index) => {
                // Cálculo do número da música (ignorando pausas)
                const songNumber = setlistSongs.slice(0, index + 1).filter(s => !s.is_interval).length;

                // Cálculo do subtotal do "Set" (músicas acumuladas até aqui)
                let setSubtotal = 0;
                const isLastBeforePause = setlistSongs[index + 1]?.is_interval;
                const isLastOfShow = index === setlistSongs.length - 1 && !link.is_interval;

                if (isLastBeforePause || isLastOfShow) {
                  // Volta pra trás até a última pausa ou início para somar o set
                  for (let i = index; i >= 0; i--) {
                    if (setlistSongs[i].is_interval) break;
                    setSubtotal += setlistSongs[i].song?.tempo_performance_ms || setlistSongs[i].song?.duration_ms || 0;
                  }
                }

                if (link.is_interval) {
                  return (
                    <SortableItem key={link.id} id={link.id}>
                      <div
                        className="group flex items-center p-3 pl-12 pr-6 bg-brand-purple/5 border border-brand-purple/20 rounded-2xl transition-all"
                      >
                        <div className="w-12 text-center font-bold text-brand-purple/50">
                          {/* Sem número para pausas */}
                        </div>

                        <div className="w-14 h-14 rounded-xl bg-brand-purple/10 flex items-center justify-center shrink-0 shadow-md mr-4">
                          <Activity className="w-6 h-6 text-brand-purple" />
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                          <h3 className="text-xl font-bold truncate leading-tight text-brand-purple">{link.interval_name || 'Pausa'}</h3>
                          <p className="text-sm text-brand-purple/60 truncate">Intervalo no Show</p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {link.interval_duration && (
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-brand-purple/40 uppercase tracking-tighter">Duração</span>
                              <span className="text-sm font-black text-brand-purple bg-brand-purple/10 px-3 py-1.5 rounded-lg">{link.interval_duration} min</span>
                            </div>
                          )}

                          <button
                            onClick={(e) => handleRemoveFromSetlist(e, link.id)}
                            className="p-2 text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </SortableItem>
                  );
                }

                const song = link.song;
                if (!song) return null; // Safe check

                return (
                  <SortableItem key={link.id} id={link.id}>
                    <div
                      onClick={() => navigateToSong(song.id)}
                      className="group flex items-center p-3 pl-12 pr-6 bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 rounded-2xl transition-all cursor-pointer"
                    >
                      <div className="w-12 text-center font-bold text-foreground/30">{songNumber}</div>

                      <div className="w-14 h-14 rounded-xl bg-foreground/10 overflow-hidden shrink-0 shadow-md mr-4 relative">
                        {song.artwork_url ? <img src={song.artwork_url} className="w-full h-full object-cover" /> : <Guitar className="w-6 h-6 m-auto mt-4 text-foreground/30" />}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-xl font-bold truncate leading-tight">{song.title}</h3>
                        <p className="text-sm text-foreground/60 truncate">{song.artist}</p>
                        {/* Subtotal do Set (Exibido apenas na última música antes da pausa ou no final do show) */}
                        {setSubtotal > 0 && (
                          <div className="mt-2 flex items-center">
                            <span className="px-3 py-1 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-black uppercase tracking-widest border border-brand-purple/20">
                              ✨ Subtotal do Set: {msToTime(setSubtotal)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-1">Música</span>
                          <span className="text-sm font-black text-foreground/80 tabular-nums">
                            {msToTime(link.song?.tempo_performance_ms || link.song?.duration_ms)}
                          </span>
                        </div>
                        {(link.song?.tom_performance || link.song?.original_key) && (
                          <span className="text-sm font-black text-brand-purple bg-brand-purple/10 px-2 py-1 rounded">
                            {link.song?.tom_performance || link.song?.original_key}
                          </span>
                        )}
                        {(link.song?.bpm_performance || link.song?.bpm) && (
                          <span className="text-sm font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">
                            {link.song?.bpm_performance || link.song?.bpm} BPM
                          </span>
                        )}

                        <button
                          onClick={(e) => handleRemoveFromSetlist(e, link.id)}
                          className="p-2 text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </SortableItem>
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Modal / Slide-over para adicionar músicas */}
      {showAddModal && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-foreground/10 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right">
          <div className="p-6 border-b border-foreground/5">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">{t('your_library')}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-foreground/50 hover:text-foreground">{t('close')}</button>
            </div>
            <input
              type="text"
              placeholder={t('search_add_song')}
              value={searchLibrary}
              onChange={(e) => setSearchLibrary(e.target.value)}
              className="w-full bg-foreground/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />

            {/* Bloco de Adicionar Pausa - Fixo no Topo */}
            <div className="mt-6 p-4 bg-brand-purple/10 border border-brand-purple/20 rounded-2xl">
              <h3 className="font-bold text-brand-purple mb-3 text-sm uppercase tracking-wider">Adicionar Pausa</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome (Ex: Pausa 1)"
                  value={pauseName}
                  onChange={(e) => setPauseName(e.target.value)}
                  className="flex-1 min-w-0 bg-background border border-brand-purple/20 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-purple text-sm"
                />
                <input
                  type="number"
                  placeholder="Min"
                  value={pauseDuration}
                  onChange={(e) => setPauseDuration(e.target.value)}
                  className="w-20 bg-background border border-brand-purple/20 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-purple text-sm"
                />
                <button
                  onClick={handleAddPause}
                  disabled={!pauseName.trim() || isAddingPause}
                  className="px-4 bg-brand-purple text-white rounded-xl font-bold hover:bg-brand-accent transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isAddingPause ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {availableLibrarySongs.length === 0 ? (
              <p className="text-center text-foreground/50 mt-10">{t('no_songs_available')}</p>
            ) : (
              availableLibrarySongs.map(song => (
                <div key={song.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-foreground/5 border border-transparent hover:border-foreground/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{song.title}</p>
                    <p className="text-xs text-foreground/50 truncate">{song.artist}</p>
                  </div>
                  <button
                    onClick={() => handleAddSongToSetlist(song.id)}
                    disabled={isAddingSong === song.id}
                    className="ml-4 p-2 rounded-lg bg-brand-purple/10 text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                  >
                    {isAddingSong === song.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showAddModal && <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />}
    </div>
  );
}

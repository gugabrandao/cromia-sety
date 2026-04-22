import { useTranslation } from 'react-i18next';
import { 
  Music2, Mic2, Plus, Play, ArrowRight, Guitar, Drum,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [recentSongs, setRecentSongs] = useState<any[]>([]);

  const fetchSongs = async () => {
    const { data } = await supabase
      .from('musicbox_setlist')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8); // Increased limit to see more
    
    if (data) setRecentSongs(data);
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleDeleteSong = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Don't trigger navigation
    if (!confirm('Tem certeza que deseja remover esta música?')) return;

    try {
      const { error } = await supabase
        .from('musicbox_setlist')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setRecentSongs(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting song:', error);
      alert('Falha ao deletar a música.');
    }
  };

  return (
    <div className="selection:bg-brand-purple/30 animate-fade-in">
      {/* Main Content */}
      <div className="pr-8 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">
              Cromia <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-purple-400">{t('app_name')}</span>
            </h1>
            <p className="text-foreground/50 text-lg">{t('tagline')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/search')}
              className="px-6 py-3 rounded-full bg-brand-purple text-white font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-purple/20"
            >
              <Plus className="w-5 h-5" />
              {t('new_setlist')}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="md:col-span-2 glass-card rounded-3xl p-8 relative overflow-hidden group animate-fade-in [animation-delay:100ms]">
            <div className="relative z-10">
              <span className="px-3 py-1 rounded-full bg-brand-purple/20 text-brand-accent text-xs font-bold uppercase tracking-wider mb-4 inline-block">{t('featured')}</span>
              <h2 className="text-5xl font-black mb-4 leading-tight text-foreground">{t('hero_title')}</h2>
              <p className="text-foreground/60 text-lg mb-8 max-w-md">
                {t('hero_subtitle')}
              </p>
              <button 
                onClick={() => navigate('/search')}
                className="px-8 py-4 rounded-2xl bg-brand-purple text-white font-bold flex items-center gap-3 hover:bg-brand-accent transition-colors shadow-lg shadow-brand-purple/20"
              >
                {t('quick_start')}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-purple rounded-full blur-[120px]" />
              <div className="absolute -bottom-24 right-48 w-64 h-64 bg-brand-accent rounded-full blur-[100px]" />
            </div>
          </div>

          <div className="glass rounded-3xl p-8 flex flex-col justify-between animate-fade-in [animation-delay:200ms]">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 flex items-center justify-center mb-6">
                <Mic2 className="w-8 h-8 text-brand-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground">{t('stage_mode')}</h3>
              <p className="text-foreground/40">{t('stage_mode_desc')}</p>
            </div>
            <div className="pt-6 border-t border-foreground/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">{t('active_sessions')}</span>
                <span className="px-2 py-1 rounded bg-green-500/10 text-green-500 font-mono font-bold uppercase">{t('live')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Songs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in [animation-delay:300ms]">
          <h3 className="col-span-full text-xl font-bold mb-2 opacity-80 text-foreground">{t('recent_setlists')}</h3>
          
          {recentSongs.map((song) => (
            <div 
              key={song.id} 
              onClick={() => navigate(`/song/${song.id}`)}
              className="glass group cursor-pointer rounded-2xl p-4 border border-foreground/5 hover:border-brand-accent/30 transition-all hover:translate-y-[-4px] relative"
            >
              {/* Delete Button */}
              <button 
                onClick={(e) => handleDeleteSong(e, song.id)}
                className="absolute top-6 right-6 z-20 p-2 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                title="Deletar música"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="aspect-video rounded-xl bg-foreground/5 mb-4 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center">
                    <Play className="w-4 h-4 fill-white" />
                  </button>
                </div>
                {/* Fallback pattern for cover */}
                <div className="w-full h-full bg-gradient-to-br from-brand-purple/20 to-transparent flex items-center justify-center opacity-40">
                  <Music2 className="w-12 h-12 text-brand-accent" />
                </div>
              </div>
              <h4 className="font-bold mb-1 text-foreground truncate">{song.title}</h4>
              <p className="text-xs text-foreground/40 mb-3 truncate">{song.artist}</p>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded-md bg-brand-purple/10 text-brand-accent text-[10px] font-bold uppercase">{song.original_key || 'C'}</span>
                <span className="px-2 py-0.5 rounded-md bg-foreground/5 text-foreground/40 text-[10px] font-bold uppercase">4/4</span>
              </div>
            </div>
          ))}

          {recentSongs.length === 0 && (
            <div className="col-span-3 py-12 text-center glass rounded-2xl border border-dashed border-foreground/10 flex flex-col items-center justify-center text-foreground/30">
               <Music2 className="w-12 h-12 mb-4 opacity-20" />
               <p>Nenhuma música adicionada ainda.</p>
            </div>
          )}

          <div 
            onClick={() => navigate('/search')}
            className="glass rounded-2xl p-4 border border-dashed border-foreground/10 flex flex-col items-center justify-center text-foreground/30 hover:text-brand-purple transition-all cursor-pointer min-h-[200px]"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">{t('create_new')}</span>
          </div>
        </div>

        {/* AI Features */}
        <section className="mt-20 p-12 rounded-[40px] bg-gradient-to-br from-brand-purple/10 to-transparent border border-foreground/5 animate-fade-in [animation-delay:400ms]">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-black mb-6 text-foreground">{t('ai_title')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex gap-4 items-start text-left">
                  <div className="p-3 rounded-xl bg-brand-purple/10">
                    <Guitar className="w-6 h-6 text-brand-accent" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1 text-foreground">{t('smart_parsing')}</h4>
                    <p className="text-sm text-foreground/40">{t('smart_parsing_desc')}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start text-left">
                  <div className="p-3 rounded-xl bg-brand-purple/10">
                    <Drum className="w-6 h-6 text-brand-accent" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1 text-foreground">{t('stem_separation')}</h4>
                    <p className="text-sm text-foreground/40">{t('stem_separation_desc')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-80 aspect-square glass rounded-3xl relative flex items-center justify-center p-8 overflow-hidden">
               <div className="absolute inset-0 bg-brand-purple/10 blur-3xl rounded-full" />
               <div className="relative z-10 w-full h-full border-2 border-dashed border-brand-accent/20 rounded-2xl flex flex-col items-center justify-center">
                  <div className="text-brand-accent text-xs font-mono mb-4 animate-pulse">{t('processing_audio')}</div>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(v => (
                      <div key={v} className="w-1.5 bg-brand-accent rounded-full animate-bounce" style={{ height: `${v*8}px`, animationDelay: `${v*100}ms` }} />
                    ))}
                  </div>
               </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;

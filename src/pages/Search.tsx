import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, ArrowLeft, Music2, Plus, Loader2, Guitar, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chordService } from '../services/chordService';
import type { SongResult } from '../services/chordService';
import { supabase } from '../lib/supabase';

export default function Search() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [addedSongs, setAddedSongs] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState<string | null>(null);
  const [results, setResults] = useState<SongResult[]>([]);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    console.log('Initiating search for:', searchQuery);
    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await chordService.search(searchQuery);
      console.log('Search data received:', data);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced Auto-Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 2) {
        handleSearch(query);
      } else if (query.trim().length === 0) {
        setResults([]);
        setHasSearched(false);
      }
    }, 500); // 500ms delay after typing stops

    return () => clearTimeout(timer);
  }, [query]);

  const handleAddSong = async (song: SongResult) => {
    const songId = `${song.slug_artist}-${song.slug_song}`;
    setIsAdding(songId);
    try {
      // 1. Capture content
      const captured = await chordService.capture(song.slug_artist, song.slug_song);
      
      // 2. Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '00000000-0000-0000-0000-000000000000';

      const { error } = await supabase.from('musicbox_setlist').insert({
        user_id: userId,
        title: captured.title,
        artist: captured.artist,
        slug_artist: song.slug_artist,
        slug_song: song.slug_song,
        source: 'cifraclub',
        source_url: captured.original_url,
        content_raw: captured.content,
        fetch_status: 'success'
      } as any);

      if (error) throw error;

      // Success UI logic
      setAddedSongs(prev => new Set(prev).add(songId));
      setShowToast(`"${captured.title}" ${t('added_to_library') || 'adicionada!'}`);
      
      // Auto hide toast
      setTimeout(() => setShowToast(null), 3000);
    } catch (error: any) {
      console.error('Error adding song:', error);
      if (error?.message === 'ALL_PROXIES_FAILED') {
        setShowToast('⚠️ Não foi possível buscar a cifra agora. Tente novamente em instantes.');
      } else {
        setShowToast('Erro ao adicionar música. Tente novamente.');
      }
      setTimeout(() => setShowToast(null), 5000);
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <div className="selection:bg-brand-purple/30">
      {/* Header */}
      <header className="p-6 border-b border-foreground/5 flex items-center gap-4">
        <h1 className="text-xl font-bold">{t('explore')}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-brand-purple/10 flex items-center justify-center mx-auto mb-6">
            <Music2 className="w-10 h-10 text-brand-accent" />
          </div>
          <h2 className="text-3xl font-black mb-4">{t('search_hero_title')}</h2>
          <p className="text-foreground/50">{t('search_hero_subtitle')}</p>
        </div>

        {/* Search Input */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(query); }} className="relative mb-12 animate-fade-in [animation-delay:100ms]">
          <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-foreground/30 w-6 h-6" />
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full bg-foreground/5 border border-foreground/10 rounded-[2rem] py-5 pl-16 pr-6 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 focus:border-brand-purple transition-all text-lg shadow-xl shadow-brand-purple/5"
          />
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-full bg-brand-purple text-white font-bold hover:bg-brand-accent transition-colors disabled:opacity-50"
            disabled={isSearching}
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : t('search_button')}
          </button>
        </form>

        {/* Results */}
        <div className="space-y-4 animate-fade-in [animation-delay:200ms]">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-accent" />
              <p>{t('search_loading')}</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/40 mb-4 px-2">{t('search_results_title')}</h3>
              {results.map((song) => (
                <div 
                  key={`${song.slug_artist}-${song.slug_song}`}
                  className="glass group flex items-center justify-between p-4 rounded-2xl border border-foreground/5 hover:border-brand-accent/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:bg-brand-purple/10 transition-colors">
                      <Guitar className="w-6 h-6 text-brand-accent" />
                    </div>
                    <div>
                      <h4 className="font-bold">{song.title}</h4>
                      <p className="text-sm text-foreground/50">{song.artist}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAddSong(song)}
                    disabled={isAdding === `${song.slug_artist}-${song.slug_song}` || addedSongs.has(`${song.slug_artist}-${song.slug_song}`)}
                    className={`p-3 rounded-xl transition-all shadow-lg ${
                      addedSongs.has(`${song.slug_artist}-${song.slug_song}`)
                        ? 'bg-green-500 text-white cursor-default'
                        : 'hover:bg-brand-purple text-brand-accent hover:text-white hover:shadow-brand-purple/20'
                    } disabled:opacity-50`}
                  >
                    {isAdding === `${song.slug_artist}-${song.slug_song}` ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : addedSongs.has(`${song.slug_artist}-${song.slug_song}`) ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))}
            </>
          )}

          {/* No Results Empty State */}
          {!isSearching && hasSearched && query.length > 0 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-foreground/40 glass rounded-3xl border border-foreground/5">
              <Music2 className="w-12 h-12 mb-4 opacity-20" />
              <p>{t('search_no_results')} "{query}"</p>
            </div>
          )}
        </div>
      </main>
      {/* Premium Toast Notification */}
      {showToast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-300">
          <div className="glass px-8 py-4 rounded-2xl border border-brand-purple/20 shadow-2xl flex items-center gap-4 min-w-[300px]">
             <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-500" />
             </div>
             <div>
                <p className="text-foreground font-bold leading-tight">{showToast}</p>
                <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mt-1">{t('sync_success')}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

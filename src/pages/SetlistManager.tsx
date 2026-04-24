import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Mic2, Calendar, MapPin, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SetlistManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [setlists, setSetlists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // New Setlist form state
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    fetchSetlists();
  }, []);

  async function fetchSetlists() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cromiasety_setlists')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data) setSetlists(data);
    if (error) console.error("Error fetching setlists:", error);
    setIsLoading(false);
  }

  const handleCreateSetlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '00000000-0000-0000-0000-000000000000';

      const { data, error } = await (supabase as any).from('cromiasety_setlists').insert({
        user_id: userId,
        name: newName.trim(),
        event_date: newDate || null,
        status: 'draft',
        color_theme: '#a855f7'
      }).select().single();

      if (error) throw error;

      setShowModal(false);
      setNewName('');
      setNewDate('');
      
      // Navigate to the newly created setlist detail view
      if (data) {
        navigate(`/setlists/${data.id}`);
      }
    } catch (err) {
      console.error("Error creating setlist:", err);
      alert("Erro ao criar setlist. Verifique se você rodou o SQL no Supabase!");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-32 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">{t('my_setlists')}</h1>
          <p className="text-foreground/50 text-lg">{t('setlists_desc')}</p>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-purple text-white rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-purple/20"
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
          {t('create_setlist')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 text-center text-foreground/50 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            {t('loading_shows')}
          </div>
        ) : setlists.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-foreground/5 rounded-3xl border border-foreground/10 flex flex-col items-center">
            <Mic2 className="w-16 h-16 text-foreground/20 mb-4" />
            <h3 className="text-2xl font-black mb-2">{t('no_setlist_yet')}</h3>
            <p className="text-foreground/50 max-w-sm">{t('create_first_setlist')}</p>
          </div>
        ) : (
          setlists.map((setlist) => (
            <div 
              key={setlist.id}
              onClick={() => navigate(`/setlists/${setlist.id}`)}
              className="group bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 hover:border-brand-purple/30 rounded-3xl p-6 transition-all cursor-pointer shadow-lg shadow-black/5"
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Mic2 className="w-7 h-7 text-brand-purple" />
              </div>
              <h3 className="text-2xl font-black mb-2 truncate">{setlist.name}</h3>
              
              <div className="flex flex-col gap-2 mt-6">
                {setlist.event_date && (
                  <div className="flex items-center gap-2 text-foreground/50 text-sm">
                    <Calendar className="w-4 h-4" />
                    {setlist.event_date.split('-').reverse().join('/')}
                  </div>
                )}
                {setlist.venue_name && (
                  <div className="flex items-center gap-2 text-foreground/50 text-sm">
                    <MapPin className="w-4 h-4" />
                    {setlist.venue_name}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Criar Setlist */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background border border-foreground/10 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black mb-6">{t('new_setlist_folder')}</h2>
            <form onSubmit={handleCreateSetlist} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-foreground/60 mb-2">{t('show_name')}</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Casamento João e Maria"
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple/50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground/60 mb-2">{t('event_date_optional')}</label>
                <input 
                  type="date" 
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-purple/50"
                />
              </div>
              
              <div className="flex gap-4 pt-4 mt-8 border-t border-foreground/10">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 font-bold text-foreground/60 hover:bg-foreground/5 rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating || !newName.trim()}
                  className="flex-1 py-3 font-bold bg-brand-purple text-white rounded-xl hover:bg-brand-accent transition-colors disabled:opacity-50 flex justify-center items-center"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : t('create_setlist')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

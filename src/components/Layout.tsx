import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mic2, LayoutDashboard, User,
  Sun, Moon, Globe, ListMusic, LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import SettingsModal from './SettingsModal';

interface LayoutProps {
  children: React.ReactNode;
}

import setyLogo from '../assets/sety logo branca.svg';

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const { toggleTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAvatarUrl(user?.user_metadata?.avatar_url || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAvatarUrl(session?.user?.user_metadata?.avatar_url || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!confirm('Deseja realmente sair?')) return;
    await supabase.auth.signOut();
  };
  const location = useLocation();

  const toggleLanguage = () => {
    const nextLng = i18n.language?.startsWith('pt') ? 'en' : 'pt-BR';
    i18n.changeLanguage(nextLng);
  };

  const isActive = (path: string) => location.pathname === path;
  const isSongView = location.pathname.startsWith('/song/');

  return (
    <div className="min-h-screen relative">
      {/* Global Watermark Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] md:w-[1920px] md:h-[1700px] bg-foreground opacity-[0.02] dark:opacity-[0.008]"
          style={{
            WebkitMaskImage: `url("${setyLogo}")`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskImage: `url("${setyLogo}")`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center'
          }}
        />
      </div>

      {/* Sidebar */}
      {!isSongView && (
        <aside className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-8 bg-foreground/5 border-r border-foreground/5 backdrop-blur-xl z-[100] transition-colors duration-300">
          <div
            className="w-12 h-12 flex items-center justify-center mb-12 cursor-pointer hover:scale-105 transition-all"
            onClick={() => navigate('/')}
          >
            <img src={setyLogo} alt="Sety Logo" className={`${isDarkMode ? 'w-10 h-10 object-contain drop-shadow-md invert' : 'w-10 h-10 object-contain drop-shadow-md'}`} />
          </div>

          <nav className="flex-1 flex flex-col gap-8">
            <button
              onClick={() => navigate('/')}
              className={`p-3 rounded-full transition-all group relative ${isActive('/') ? 'bg-brand-purple/20 text-brand-accent' : 'text-foreground/40 hover:text-brand-purple'}`}
            >
              <LayoutDashboard className="w-6 h-6" />
              <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('dashboard')}</span>
            </button>

            <button
              onClick={() => navigate('/repertorio')}
              className={`p-3 rounded-full transition-all group relative ${isActive('/repertorio') || isActive('/setlist') ? 'bg-brand-purple/20 text-brand-accent' : 'text-foreground/40 hover:text-brand-purple'}`}
            >
              <ListMusic className="w-6 h-6" />
              <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Minhas Cifras</span>
            </button>

            <button
              onClick={() => navigate('/setlists')}
              className={`p-3 rounded-full transition-all group relative ${location.pathname.startsWith('/setlists') ? 'bg-brand-purple/20 text-brand-accent' : 'text-foreground/40 hover:text-brand-purple'}`}
            >
              <Mic2 className="w-6 h-6" />
              <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Meus Setlists</span>
            </button>


          </nav>

          <div className="flex flex-col gap-6">
            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-3 rounded-full flex items-center justify-center hover:bg-foreground/5 transition-all text-foreground/40 hover:text-brand-purple"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-6 h-6 text-foreground/40 transition-all hover:text-brand-purple" /> : <Moon className="w-6 h-6" />}
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex flex-col items-center justify-center hover:bg-foreground/5 transition-all text-foreground/40 hover:text-brand-purple group relative p-1 rounded-full"
              title="Change Language"
            >
              <Globe className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase">{i18n.language?.startsWith('pt') ? 'PT' : 'EN'}</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-10 h-10 rounded-full bg-foreground/5 border border-foreground/5 flex items-center justify-center hover:scale-105 hover:border-brand-purple/50 transition-all group relative"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                <User className="w-5 h-5 text-foreground/40 group-hover:text-brand-purple transition-colors" />
              )}
              <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Perfil</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-3 rounded-full text-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all group relative"
            >
              <LogOut className="w-6 h-6 pl-1" />
              <span className="absolute left-full ml-4 px-2 py-1 bg-red-500 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Sair</span>
            </button>
          </div>
        </aside>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />


      {/* Page Content */}
      <main className={`${!isSongView ? 'pl-20' : ''} min-h-screen relative z-10`}>
        {children}
      </main>
    </div>
  );
}

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Music2, Mic2, LayoutDashboard, Settings, User, 
  Search as SearchIcon, Sun, Moon, Globe 
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleLanguage = () => {
    const nextLng = i18n.language?.startsWith('pt') ? 'en' : 'pt-BR';
    i18n.changeLanguage(nextLng);
  };

  const isActive = (path: string) => location.pathname === path;
  const isSongView = location.pathname.startsWith('/song/');

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      {!isSongView && (
        <aside className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-8 bg-foreground/5 border-r border-foreground/5 backdrop-blur-xl z-[100] transition-colors duration-300">
        <div 
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-purple to-brand-accent flex items-center justify-center shadow-lg shadow-brand-purple/20 mb-12 cursor-pointer hover:scale-105 transition-all" 
          onClick={() => navigate('/')}
        >
          <Music2 className="w-7 h-7 text-white" />
        </div>
        
        <nav className="flex-1 flex flex-col gap-8">
          <button 
            onClick={() => navigate('/')}
            className={`p-3 rounded-xl transition-all group relative ${isActive('/') ? 'bg-brand-purple/20 text-brand-accent' : 'text-foreground/40 hover:text-brand-purple'}`}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('dashboard')}</span>
          </button>
          
          <button className="p-3 rounded-xl text-foreground/40 hover:text-brand-purple transition-all group relative">
            <Mic2 className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('performances')}</span>
          </button>

          <button 
            onClick={() => navigate('/search')}
            className={`p-3 rounded-xl transition-all group relative ${isActive('/search') ? 'bg-brand-purple/20 text-brand-accent' : 'text-foreground/40 hover:text-brand-purple'}`}
          >
            <SearchIcon className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-brand-purple text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{t('explore')}</span>
          </button>
        </nav>

        <div className="flex flex-col gap-6">
          {/* Theme Switcher */}
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-full flex items-center justify-center hover:bg-foreground/5 transition-all text-foreground/40 hover:text-brand-purple"
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Language Switcher */}
          <button 
            onClick={toggleLanguage}
            className="flex flex-col items-center justify-center hover:bg-foreground/5 transition-all text-foreground/40 hover:text-brand-purple group relative p-2 rounded-xl"
            title="Change Language"
          >
            <Globe className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold uppercase">{i18n.language?.startsWith('pt') ? 'PT' : 'EN'}</span>
          </button>

          <button className="p-3 rounded-xl text-foreground/40 hover:text-brand-purple transition-all">
            <Settings className="w-6 h-6" />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-foreground/10 border border-foreground/10 flex items-center justify-center overflow-hidden">
            <User className="w-5 h-5 text-foreground/60" />
          </div>
        </div>
      </aside>
      )}

      {/* Page Content */}
      <main className={`${!isSongView ? 'pl-20' : ''} min-h-screen`}>
        {children}
      </main>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Settings, Play, Pause,
  Loader2, Minus, Plus, Check, Guitar, X, Sun, Moon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

export default function SongView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toggleTheme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showSpeedToast, setShowSpeedToast] = useState(false);
  const speedToastTimeout = useRef<any>(null);
  const scrollRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const [transpose, setTranspose] = useState(0);

  // Display Settings
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Advanced Settings State with LocalStorage persistence
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('musicbox_global_settings');
    const defaults = {
      title: { size: 60, color: '#ffffff', font: 'font-outfit' },
      artist: { size: 30, color: '#a855f7', font: 'font-inter' },
      observations: { size: 16, color: '#ffffff', font: 'font-inter', italic: true },
      sections: { size: 22, color: '#a855f7', font: 'font-outfit', italic: false, bold: true },
      chords: { size: 20, color: '#a855f7', font: 'font-mono-custom' },
      lyrics: { size: 20, color: '#ffffff', font: 'font-inter' },
      tabs: { size: 14, color: '#ffffff', font: 'font-courier' },
      showTabs: true,
      showSections: true,
      isDarkMode: true
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('musicbox_global_settings', JSON.stringify(settings));
  }, [settings]);

  const fontOptions = [
    { name: 'Sans', value: 'font-inter' },
    { name: 'Modern', value: 'font-outfit' },
    { name: 'Mono', value: 'font-mono-custom' },
    { name: 'Times', value: 'font-times' },
    { name: 'Serif', value: 'font-georgia' },
  ];

  const tabFontOptions = [
    { name: 'Courier New (Padrão)', value: 'font-courier' },
    { name: 'JetBrains Mono', value: 'font-mono-custom' },
    { name: 'Fira Code', value: 'font-fira' },
    { name: 'Cascadia Code', value: 'font-cascadia' },
  ];

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const isChord = (token: string) => {
    if (!token) return false;
    // Matches chords, including those with parentheses and bass notes (e.g., C/E, G/B, Am(9), C(add9))
    return /^[A-G][b#]?(m|min|maj|M|dim|aug|sus|add|ø|º|7M|7|6|5|4|2|9|11|13|\+|\-|\(|\))*(\/[A-G][b#]?)?$/.test(token.trim());
  };

  const transposeLine = (line: string, amount: number) => {
    if (amount === 0) return line;
    return line.replace(/(\S+)/g, (match) => {
      if (isChord(match)) {
        return match.replace(/[A-G][b#]?/g, (noteMatch) => {
          let note = noteMatch;
          const flatMap: any = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
          if (note.endsWith('b')) note = flatMap[note] || note;

          const index = notes.indexOf(note);
          if (index === -1) return noteMatch;

          let newIndex = (index + amount) % 12;
          if (newIndex < 0) newIndex += 12;
          return notes[newIndex];
        });
      }
      return match;
    });
  };

  useEffect(() => {
    async function fetchSong() {
      if (!id) return;
      setLoading(true);
      const { data, error } = await (supabase.from('musicbox_setlist') as any)
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setSong(data);
        setEditedContent(data.content_raw || '');
        if (data.settings) {
          setSettings((prev: any) => ({
            ...prev,
            ...data.settings,
            title: { ...prev.title, ...(data.settings.title || {}) },
            artist: { ...prev.artist, ...(data.settings.artist || {}) },
            observations: { ...prev.observations, italic: true, ...(data.settings.observations || {}) },
            sections: { ...prev.sections, ...(data.settings.sections || {}) },
            chords: { ...prev.chords, ...(data.settings.chords || {}) },
            lyrics: { ...prev.lyrics, ...(data.settings.lyrics || {}) },
            tabs: { ...prev.tabs, ...(data.settings.tabs || {}) },
            scrollSpeed: data.settings.scrollSpeed ?? prev.scrollSpeed ?? 5, // Default level 5 (1-10 scale)
          }));
        }
      }
      if (error) console.error(error);
      setLoading(false);
    }
    fetchSong();
  }, [id]);

  const updateScrollSpeed = async (newSpeed: number) => {
    // 1. Update UI immediately for responsiveness
    const newSettings = { ...settings, scrollSpeed: newSpeed };
    setSettings(newSettings);

    // Show Speed Toast
    setShowSpeedToast(true);
    if (speedToastTimeout.current) clearTimeout(speedToastTimeout.current);
    speedToastTimeout.current = setTimeout(() => setShowSpeedToast(false), 2000);

    // 2. Auto-save silently to Supabase
    try {
      await (supabase.from('musicbox_setlist') as any)
        .update({ settings: newSettings })
        .eq('id', id);
    } catch (err) {
      console.error('Auto-save speed error:', err);
    }
  };

  const exactScrollYRef = useRef<number>(0);
  const saveSettingsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save visual settings silently
  useEffect(() => {
    if (!song || !id) return;

    if (saveSettingsTimeoutRef.current) clearTimeout(saveSettingsTimeoutRef.current);

    saveSettingsTimeoutRef.current = setTimeout(async () => {
      try {
        await (supabase.from('musicbox_setlist') as any)
          .update({ settings })
          .eq('id', id);
        console.log('Visual settings auto-saved silently');
      } catch (err) {
        console.error('Failed to auto-save settings', err);
      }
    }, 1000);

    return () => {
      if (saveSettingsTimeoutRef.current) clearTimeout(saveSettingsTimeoutRef.current);
    };
  }, [settings, id, song]);

  useEffect(() => {
    if (!isScrolling) {
      if (scrollRef.current) cancelAnimationFrame(scrollRef.current);
      lastTimeRef.current = undefined;
      return;
    }

    // Sincroniza a posição exata com o local onde o usuário está ao dar play
    exactScrollYRef.current = window.scrollY;

    const scrollLoop = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        // Trava o deltaTime em no máximo 50ms para evitar "teletransportes" da tela
        // caso o navegador ou o celular deem uma leve travada (lag spike).
        const rawDelta = time - lastTimeRef.current;
        const deltaTime = Math.min(rawDelta, 50);

        const currentLevel = (settings as any).scrollSpeed || 5;

        // Weber-Fechner law mapping
        const speedMap = [0, 10, 18, 28, 42, 60, 85, 120, 165, 220, 300];
        const pixelsPerSecond = speedMap[currentLevel] || 60;

        const pixelsToScroll = pixelsPerSecond * (deltaTime / 4000);

        // Se o usuário rolou a tela com o dedo, ressincroniza o motor
        if (Math.abs(exactScrollYRef.current - window.scrollY) > 2) {
          exactScrollYRef.current = window.scrollY;
        }

        // Soma com precisão decimal (sub-pixel)
        exactScrollYRef.current += pixelsToScroll;

        // window.scrollTo com float permite que o motor gráfico do navegador 
        // lide com a rolagem suave sem criar "degraus" de 1px/2px.
        window.scrollTo(0, exactScrollYRef.current);
      }
      lastTimeRef.current = time;
      scrollRef.current = requestAnimationFrame(scrollLoop);
    };

    scrollRef.current = requestAnimationFrame(scrollLoop);

    return () => {
      if (scrollRef.current) cancelAnimationFrame(scrollRef.current);
    };
  }, [isScrolling, (settings as any).scrollSpeed]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-accent animate-spin mb-4" />
        <p className="text-foreground/50 animate-pulse">{t('processing_audio')}...</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Song not found</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-brand-purple rounded-full">Go Back</button>
      </div>
    );
  }

  const getProcessedContent = () => {
    const lines = song.content_raw?.split('\n') || [];

    // Pass 1: Filter hidden lines
    const filteredLines = lines.map((line: string, i: number) => {
      const trimmed = line.trim();
      const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(trimmed) || line.includes('---');
      
      if (!settings.showTabs) {
        if (isTabLine) return null;
        
        // Hide tab headers and related terms
        if (/^\[.*\]$/.test(trimmed)) {
          const tl = trimmed.toLowerCase();
          if (tl.includes('tab') || tl.includes('riff') || tl.includes('dedilhado')) return null;
        }

        // Hide "Parte X de Y" lines (including variations)
        if (/^Parte\s+\d+\s+de\s+\d+/i.test(trimmed)) return null;

        // Hide technical tab notations (H.N., P.M., etc. with dots/spaces)
        if (/^(H\.N\.|P\.M\.)[\s\.\-]*$/i.test(trimmed)) return null;

        // Hide pure chord lines immediately preceding a tab
        const isPureBracketChordLine = trimmed.length > 0 && trimmed.split(/\s+/).every((p: string) => /^\[[A-G].*?\]$/.test(p));
        if (isPureBracketChordLine) {
          let nextNonEmptyLine = '';
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() !== '') {
              nextNonEmptyLine = lines[j].trim();
              break;
            }
          }
          const isNextTab = /^[A-Ge]\|[-|0-9a-z ]+/i.test(nextNonEmptyLine) || nextNonEmptyLine.includes('---');
          if (isNextTab) return null;
        }
      }

      return line;
    }).filter((l: string | null) => l !== null) as string[];

    // Pass 2: Collapse consecutive empty lines
    const collapsedLines = filteredLines.filter((line, i) => {
      if (line.trim() === '' && i > 0 && filteredLines[i - 1].trim() === '') return false;
      return true;
    });

    // Pass 3: Transpose and format
    return collapsedLines.map((line) => {
      let displayLine = line;

      const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(displayLine.trim()) || displayLine.includes('---');
      
      const isChordProLine = !isTabLine && /\[.*?\]/.test(displayLine);

      if (isChordProLine) {
        if (transpose !== 0) {
          return displayLine.replace(/\[(.*?)\]/g, (match, content) => {
            if (isChord(content)) return `[${transposeLine(content, transpose)}]`;
            return match;
          });
        }
        return displayLine;
      }

      return displayLine;
    }).join('\n');
  };

  const handleDefinitiveChange = async () => {
    if (!window.confirm("Essa ação vai reescrever o arquivo original da música com as alterações atuais (sem tablaturas, sem seções e no tom visível). Deseja continuar?")) return;

    const newContent = getProcessedContent();

    try {
      const { error } = await (supabase.from('musicbox_setlist') as any)
        .update({
          content_raw: newContent
        })
        .eq('id', id);

      if (error) throw error;

      setSong({ ...song, content_raw: newContent });
      setEditedContent(newContent);
      setTranspose(0);
      alert("Definitive Change aplicada com sucesso!");
    } catch (error) {
      console.error('Error applying definitive change:', error);
      alert('Erro ao aplicar as mudanças definitivas.');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await (supabase.from('musicbox_setlist') as any)
        .update({
          content_raw: editedContent,
          title: song.title,
          artist: song.artist,
          observations: song.observations,
          settings: settings
        })
        .eq('id', id);

      if (error) throw error;
      setSong({ ...song, content_raw: editedContent });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes.');
    }
  };

  const getEffectiveColor = (color: string) => {
    if (isDarkMode) return color;
    // In light mode, if the color is white or very close to it, we use a dark color instead
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 200 ? '#0F0F1A' : color;
  };

  const updateSetting = (element: string, key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [element]: typeof prev[element as keyof typeof prev] === 'object'
        ? { ...(prev[element as keyof typeof prev] as any), [key]: value }
        : value
    }));
  };

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans transition-colors duration-300 ${isDarkMode ? "dark" : "light"}`}>
      {/* Top Floating Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-foreground/5 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-foreground/5 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-bold text-lg leading-tight">{song.title}</h1>
            <p className="text-xs text-foreground/50">{song.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-yellow-500/10 text-yellow-500' : 'bg-brand-purple/10 text-brand-purple'}`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Unified Scroll Controls [-] [Play] [+] */}
          <div className="relative flex items-center bg-foreground/5 rounded-xl p-1 border border-foreground/5 shadow-inner">
            <button
              onClick={() => updateScrollSpeed(Math.max(1, ((settings as any).scrollSpeed || 5) - 1))}
              className={`p-2 hover:bg-foreground/10 rounded-lg ${isDarkMode ? 'text-foreground/60' : 'text-black/60'} hover:text-foreground transition-all`}
              title={t('slower')}
            >
              <Minus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsScrolling(!isScrolling)}
              className={`px-6 py-2 mx-1 rounded-lg transition-all flex items-center justify-center gap-2 ${isScrolling ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' : 'hover:bg-foreground/10 text-foreground/80'}`}
              title={isScrolling ? t('pause_scroll') : t('start_scroll')}
            >
              {isScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => updateScrollSpeed(Math.min(10, ((settings as any).scrollSpeed || 5) + 1))}
              className={`p-2 hover:bg-foreground/10 rounded-lg ${isDarkMode ? 'text-foreground/60' : 'text-black/60'} hover:text-foreground transition-all`}
              title={t('faster')}
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Speed Toast Notification (Anchored to controls) */}
            {showSpeedToast && (
              <div className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none">
                <div className="glass px-4 py-2 rounded-xl border border-brand-accent/20 shadow-xl shadow-brand-accent/10 flex items-center gap-2 whitespace-nowrap">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                  <p className="font-bold text-[10px] tracking-widest uppercase">
                    {t('speed')} <span className="text-brand-accent ml-1 text-sm">{(settings as any).scrollSpeed || 5}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-foreground/10 mx-1" />

          {isEditing ? (
            <button
              onClick={handleSaveEdit}
              className="px-6 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> {t('save')}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2.5 rounded-xl hover:bg-foreground/5 transition-all text-foreground/60"
              title={t('edit_content')}
            >
              <Guitar className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-brand-purple text-white shadow-lg shadow-brand-purple/20"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Side Panel */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsSettingsOpen(false)} />
          <div className={`relative w-full max-w-sm border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col ${isDarkMode ? 'bg-[#0F0F1A]/95 border-white/10 text-white' : 'bg-white border-black/10 text-black'}`}>
            <div className={`p-8 pb-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
              <div className="flex items-center gap-3">
                <Settings className={`w-5 h-5 ${isDarkMode ? 'text-brand-accent' : 'text-brand-purple'}`} />
                <h3 className="text-xl font-bold">{t('settings_title')}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSetting('isDarkMode', '', !isDarkMode)}
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-yellow-500/10 text-yellow-500' : 'bg-brand-purple/10 text-brand-purple'}`}
                  title={isDarkMode ? t('switch_to_light') : t('switch_to_dark')}
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {/* Global Toggles */}
              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => setSettings({ ...settings, showTabs: !settings.showTabs })}
                  className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${settings.showTabs ? 'bg-brand-purple/20 border-brand-purple' : (isDarkMode ? 'bg-foreground/5 border-white/5' : 'bg-black/5 border-black/5')}`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>{t('tablatures')}</span>
                  <div className={`w-10 h-5 rounded-full p-1 transition-all ${settings.showTabs ? 'bg-brand-purple' : (isDarkMode ? 'bg-foreground/20' : 'bg-black/20')}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-all ${settings.showTabs ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              {/* Transpose Control */}
              <div className={`flex items-center justify-between p-4 rounded-2xl border ${isDarkMode ? 'bg-foreground/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                <p className="font-bold">{t('global_transpose')}</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => setTranspose(t => t - 1)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDarkMode ? 'bg-foreground/10 hover:bg-brand-purple' : 'bg-black/10 hover:bg-brand-purple'}`}><Minus className="w-4 h-4" /></button>
                  <span className="w-8 text-center font-bold text-brand-accent">{transpose > 0 ? `+${transpose}` : transpose}</span>
                  <button onClick={() => setTranspose(t => t + 1)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDarkMode ? 'bg-foreground/10 hover:bg-brand-purple' : 'bg-black/10 hover:bg-brand-purple'}`}><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Element Styling Sections */}
              {['title', 'artist', 'sections', 'observations', 'chords', 'lyrics', 'tabs'].map((el) => {
                const elementStyle = (settings as any)[el];
                return (
                  <div key={el} className={`p-4 rounded-2xl border space-y-4 ${isDarkMode ? "bg-foreground/5 border-white/5" : "bg-black/5 border-black/10"}`}>
                    <p className={`font-bold uppercase text-[10px] tracking-widest ${isDarkMode ? "text-brand-accent" : "text-brand-purple"}`}>{t(`${el}_label`)}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={`text-[10px] uppercase ${isDarkMode ? "text-foreground/40" : "text-black/40"}`}>{t('font_size')}</label>
                        <input
                          type="range"
                          min="10"
                          max={
                            el === 'title' ? 80 :
                              el === 'artist' ? 50 :
                                el === 'observations' ? 30 : 40
                          }
                          step="1"
                          value={elementStyle.size}
                          onChange={(e) => updateSetting(el, 'size', parseInt(e.target.value))}
                          className="w-full accent-brand-purple"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={`text-[10px] uppercase ${isDarkMode ? "text-foreground/40" : "text-black/40"}`}>{t('color')}</label>
                        <input
                          type="color"
                          value={elementStyle.color}
                          onChange={(e) => updateSetting(el, 'color', e.target.value)}
                          className="w-full h-8 bg-transparent border-none cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] uppercase ${isDarkMode ? "text-foreground/40" : "text-black/40"}`}>{t('font_family')}</label>
                      <div className="flex gap-2">
                        <select
                          value={elementStyle.font}
                          onChange={(e) => updateSetting(el, 'font', e.target.value)}
                          className={`flex-1 border rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-purple cursor-pointer transition-all ${isDarkMode ? "bg-foreground/10 border-white/10 text-white" : "bg-black/5 border-black/10 text-black"}`}
                        >
                          {(el === 'tabs' ? tabFontOptions : fontOptions).map(f => (
                            <option key={f.value} value={f.value} className={isDarkMode ? "bg-[#0F0F1A] text-white" : "bg-white text-black"}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                        {(el === 'observations' || el === 'sections') && (
                          <>
                            <button
                              onClick={() => updateSetting(el, 'italic', !elementStyle.italic)}
                              className={`px-3 py-2 rounded-xl border transition-all text-xs font-serif italic ${elementStyle.italic ? 'bg-brand-purple border-brand-purple text-white' : `border-black/10 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}`}
                            >
                              I
                            </button>
                            <button
                              onClick={() => updateSetting(el, 'bold', !elementStyle.bold)}
                              className={`px-3 py-2 rounded-xl border transition-all text-xs font-bold ${elementStyle.bold ? 'bg-brand-purple border-brand-purple text-white' : `border-black/10 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}`}
                            >
                              B
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-8 border-t border-foreground/10 space-y-4">
              <button
                onClick={handleDefinitiveChange}
                className="w-full py-4 font-bold rounded-2xl transition-all shadow-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
              >
                Definitive Change
              </button>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className={`w-full py-4 font-bold rounded-2xl transition-all shadow-lg ${isDarkMode ? "bg-brand-purple text-white shadow-brand-purple/20 hover:bg-brand-accent" : "bg-brand-purple text-white shadow-brand-purple/20 hover:bg-brand-purple/90"}`}
              >
                {t('done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content (Chord Sheet) */}
      <main className="pt-24 pb-32 px-6 max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 space-y-6">
          {isEditing ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <input
                value={song.title}
                onChange={(e) => setSong({ ...song, title: e.target.value })}
                className="text-5xl font-black bg-transparent border-b-2 border-brand-purple/30 w-full outline-none focus:border-brand-purple transition-all pb-2"
                placeholder={t('title_label')}
              />
              <input
                value={song.artist}
                onChange={(e) => setSong({ ...song, artist: e.target.value })}
                className="text-2xl text-brand-accent/60 bg-transparent border-b border-white/10 w-full outline-none focus:border-brand-accent transition-all pb-2"
                placeholder={t('artist_label')}
              />
              <textarea
                value={song.observations || ''}
                onChange={(e) => setSong({ ...song, observations: e.target.value })}
                className="w-full h-24 bg-foreground/5 p-4 rounded-2xl border border-white/5 outline-none focus:ring-1 focus:ring-brand-purple text-sm"
                placeholder={t('observations_placeholder')}
              />
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <h1
                className={`font-black tracking-tighter ${settings.title.font}`}
                style={{ fontSize: `${settings.title.size}px`, color: getEffectiveColor(settings.title.color) }}
              >{song.title}</h1>
              <h2
                className={`font-bold opacity-80 -mt-5 ${settings.artist.font}`}
                style={{ fontSize: `${settings.artist.size}px`, color: getEffectiveColor(settings.artist.color) }}
              >{song.artist}</h2>
              {song.observations && (
                <div
                  className={`p-2 bg-brand-purple/10 border-l-4 ${isDarkMode ? 'border-white' : 'border-black'} pl-6 rounded-r-xl ${settings.observations.italic ? 'italic' : 'not-italic'} ${settings.observations.font}`}
                  style={{ fontSize: `${settings.observations.size}px`, color: getEffectiveColor(settings.observations.color) }}
                >
                  {song.observations}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chord Rendering Section */}
        <div className="chord-sheet-container">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[60vh] bg-foreground/5 p-8 rounded-3xl font-mono text-foreground focus:ring-2 focus:ring-brand-purple outline-none border border-foreground/10"
              placeholder="Paste or edit your chords here..."
            />
          ) : (
            <div className="leading-relaxed">
              {(() => {
                const lines = song.content_raw?.split('\n') || [];

                // Pass 1: Filter hidden lines
                const filteredLines = lines.map((line: string, i: number) => {
                  const trimmed = line.trim();
                  const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(trimmed) || line.includes('---');
                  
                  if (!settings.showTabs) {
                    if (isTabLine) return null;
                    
                    // Hide tab headers and related terms
                    if (/^\[.*\]$/.test(trimmed)) {
                      const tl = trimmed.toLowerCase();
                      if (tl.includes('tab') || tl.includes('riff') || tl.includes('dedilhado')) return null;
                    }

                    // Hide "Parte X de Y" lines (including variations)
                    if (/^Parte\s+\d+\s+de\s+\d+/i.test(trimmed)) return null;

                    // Hide technical tab notations (H.N., P.M., etc. with dots/spaces)
                    if (/^(H\.N\.|P\.M\.)[\s\.\-]*$/i.test(trimmed)) return null;

                    // Hide pure chord lines immediately preceding a tab
                    const isPureBracketChordLine = trimmed.length > 0 && trimmed.split(/\s+/).every((p: string) => /^\[[A-G].*?\]$/.test(p));
                    if (isPureBracketChordLine) {
                      let nextNonEmptyLine = '';
                      for (let j = i + 1; j < lines.length; j++) {
                        if (lines[j].trim() !== '') {
                          nextNonEmptyLine = lines[j].trim();
                          break;
                        }
                      }
                      const isNextTab = /^[A-Ge]\|[-|0-9a-z ]+/i.test(nextNonEmptyLine) || nextNonEmptyLine.includes('---');
                      if (isNextTab) return null;
                    }
                  }

                  return line;
                }).filter((l: string | null) => l !== null) as string[];

                // Pass 2: Collapse consecutive empty lines
                const collapsedLines = filteredLines.filter((line: string, i: number) => {
                  if (line.trim() === '' && i > 0 && filteredLines[i - 1].trim() === '') return false;
                  return true;
                });

                return (
                  <>
                    {collapsedLines.map((line: string, i: number) => {
                      const displayLine = line;
                      const trimmed = displayLine.trim();
                      const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(trimmed) || displayLine.includes('---');
                      const isChordProLine = !isTabLine && /\[.*?\]/.test(displayLine);

                      if (isChordProLine) {
                        const rawParts = displayLine.split(/(\[.*?\])/);
                        const tokens: { top: string; isChord: boolean; bottom: string }[] = [];
                        let k = 0;
                        while (k < rawParts.length) {
                          const part = rawParts[k];
                          if (part.startsWith('[') && part.endsWith(']')) {
                            const content = part.slice(1, -1);
                            let displayTop = content;
                            if (isChord(content) && transpose !== 0) displayTop = transposeLine(content, transpose);
                            const bottom = rawParts[k + 1] ?? '';
                            tokens.push({ top: displayTop, isChord: isChord(content), bottom });
                            k += 2;
                          } else {
                            if (part !== '') tokens.push({ top: '', isChord: false, bottom: part });
                            k++;
                          }
                        }

                        const isStandaloneSection = tokens.length === 1 && !tokens[0].isChord && tokens[0].top !== '' && !tokens[0].bottom.trim();
                        const isPureChordLine = tokens.every(t => t.bottom.trim() === '');

                        if (isPureChordLine && !isStandaloneSection) {
                          return (
                            <div key={i} className="pt-3 pb-1 whitespace-pre flex flex-wrap">
                              {tokens.map((tok, idx) => (
                                <span
                                  key={idx}
                                  className={`whitespace-pre ${tok.isChord ? `font-bold ${settings.chords.font}` : `${settings.sections?.font || 'font-outfit'} ${settings.sections?.italic ? 'italic' : ''} ${settings.sections?.bold ? 'font-bold' : ''}`}`}
                                  style={{
                                    fontSize: `${tok.isChord ? settings.chords.size : (settings.sections?.size || settings.chords.size)}px`,
                                    color: getEffectiveColor(tok.isChord ? settings.chords.color : (settings.sections?.color || '#a855f7')),
                                  }}
                                >
                                  {tok.top}{tok.bottom}
                                </span>
                              ))}
                            </div>
                          );
                        }

                        return (
                          <div key={i} className={`flex flex-wrap items-end pb-1 ${isStandaloneSection ? 'mt-8' : 'pt-3'}`}>
                            {tokens.map((tok, idx) => (
                              <div key={idx} className="flex flex-col items-start">
                                <span
                                  className={`whitespace-pre leading-tight ${tok.top === '' ? 'pointer-events-none select-none' : tok.isChord ? `font-bold cursor-pointer hover:opacity-80 transition-opacity ${settings.chords.font}` : `${settings.sections?.font || 'font-outfit'} ${settings.sections?.italic ? 'italic' : ''} ${settings.sections?.bold ? 'font-bold' : ''}`}`}
                                  style={{
                                    fontSize: `${tok.isChord ? settings.chords.size : tok.top !== '' ? (settings.sections?.size || settings.chords.size) : settings.chords.size}px`,
                                    color: tok.top === '' ? 'transparent' : getEffectiveColor(tok.isChord ? settings.chords.color : (settings.sections?.color || '#a855f7')),
                                  }}
                                >
                                  {tok.top || '\u00A0'}
                                </span>
                                <span
                                  className={`whitespace-pre leading-tight ${settings.lyrics.font}`}
                                  style={{ fontSize: `${settings.lyrics.size}px`, color: getEffectiveColor(settings.lyrics.color) }}
                                >
                                  {tok.bottom}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={i}
                          className={`py-0.5 whitespace-pre min-h-[1.5em] ${isTabLine ? settings.tabs.font : settings.lyrics.font}`}
                          style={{
                            fontSize: isTabLine ? `${settings.tabs.size}px` : `${settings.lyrics.size}px`,
                            color: getEffectiveColor(isTabLine ? settings.tabs.color : settings.lyrics.color),
                          }}
                        >
                          {displayLine}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Settings, Play, Pause,
  Loader2, Minus, Plus, Check, Pencil, X, Sun, Moon, Music2, Guitar,
  ChevronLeft, ChevronRight
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
  const [editMode, setEditMode] = useState<'live' | 'classic'>('live');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const addToHistory = (content: string) => {
    setHistory(prev => {
      const newHistory = [content, ...prev];
      return newHistory.slice(0, 10); // Keep last 10 steps
    });
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const lastVersion = history[0];
      setEditedContent(lastVersion);
      setHistory(prev => prev.slice(1));
    }
  };

  const handleCancel = () => {
    if (confirm('Deseja descartar as alterações não salvas?')) {
      setEditedContent(song.content_raw || '');
      setIsEditing(false);
      setHistory([]);
    }
  };

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
      metadata: { size: 10, color: '#ffffff', font: 'font-inter', bold: true },
      showTabs: true,
      showSections: true,
      showMetadata: true,
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
      }
      if (error) console.error(error);
      setLoading(false);
    }
    fetchSong();
  }, [id]);

  const handlePartChange = (lineIdx: number, partIdx: number, newValue: string, isChord: boolean) => {
    const lines = editedContent.split('\n');
    const line = lines[lineIdx];
    const parts = line.split(/(\[.*?\])/g);
    addToHistory(editedContent);
    if (isChord) {
      const cleanChord = newValue.replace(/[\[\]]/g, '').trim();
      parts[partIdx] = cleanChord ? `[${cleanChord}]` : '';
    } else {
      parts[partIdx] = newValue;
    }
    lines[lineIdx] = parts.join('');
    setEditedContent(lines.join('\n'));
  };

  const moveChord = (lineIdx: number, partIdx: number, direction: 'left' | 'right') => {
    const lines = editedContent.split('\n');
    const line = lines[lineIdx];
    const parts = line.split(/(\[.*?\])/g);
    addToHistory(editedContent);
    if (direction === 'right') {
      const nextPart = parts[partIdx + 1] || '';
      if (nextPart.length > 0) {
        const charToMove = nextPart[0];
        parts[partIdx + 1] = nextPart.substring(1);
        parts[partIdx - 1] = (parts[partIdx - 1] || '') + charToMove;
      }
    } else {
      const prevPart = parts[partIdx - 1] || '';
      if (prevPart.length > 0) {
        const charToMove = prevPart[prevPart.length - 1];
        parts[partIdx - 1] = prevPart.substring(0, prevPart.length - 1);
        parts[partIdx + 1] = charToMove + (parts[partIdx + 1] || '');
      }
    }
    lines[lineIdx] = parts.join('');
    setEditedContent(lines.join('\n'));
  };

  const updateScrollSpeed = async (newSpeed: number) => {
    const newSettings = { ...settings, scrollSpeed: newSpeed };
    setSettings(newSettings);
    setShowSpeedToast(true);
    if (speedToastTimeout.current) clearTimeout(speedToastTimeout.current);
    speedToastTimeout.current = setTimeout(() => setShowSpeedToast(false), 2000);
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

  useEffect(() => {
    if (!song || !id) return;
    if (saveSettingsTimeoutRef.current) clearTimeout(saveSettingsTimeoutRef.current);
    saveSettingsTimeoutRef.current = setTimeout(async () => {
      try {
        await (supabase.from('musicbox_setlist') as any).update({ settings }).eq('id', id);
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
    exactScrollYRef.current = window.scrollY;
    const scrollLoop = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        const rawDelta = time - lastTimeRef.current;
        const deltaTime = Math.min(rawDelta, 50);
        const currentLevel = (settings as any).scrollSpeed || 5;
        const speedMap = [0, 10, 18, 28, 42, 60, 85, 120, 165, 220, 300];
        const pixelsPerSecond = speedMap[currentLevel] || 60;
        const pixelsToScroll = pixelsPerSecond * (deltaTime / 4000);
        if (Math.abs(exactScrollYRef.current - window.scrollY) > 2) {
          exactScrollYRef.current = window.scrollY;
        }
        exactScrollYRef.current += pixelsToScroll;
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
    const filteredLines = lines.map((line: string, i: number) => {
      const trimmed = line.trim();
      const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(trimmed) || line.includes('---');
      if (!settings.showTabs && isTabLine) return null;
      return line;
    }).filter((l: string | null) => l !== null) as string[];
    const collapsedLines = filteredLines.filter((line, i) => {
      if (line.trim() === '' && i > 0 && filteredLines[i - 1].trim() === '') return false;
      return true;
    });
    return collapsedLines.map((line) => {
      let displayLine = line;
      const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(displayLine.trim()) || displayLine.includes('---');
      const isChordProLine = !isTabLine && /\[.*?\]/.test(displayLine);
      if (isChordProLine && transpose !== 0) {
        return displayLine.replace(/\[(.*?)\]/g, (match, content) => {
          if (isChord(content)) return `[${transposeLine(content, transpose)}]`;
          return match;
        });
      }
      return displayLine;
    }).join('\n');
  };

  const handleDefinitiveChange = async () => {
    if (!window.confirm("Essa ação vai reescrever o arquivo original da música com as alterações atuais. Deseja continuar?")) return;
    const newContent = getProcessedContent();
    try {
      const { error } = await (supabase.from('musicbox_setlist') as any).update({ content_raw: newContent }).eq('id', id);
      if (error) throw error;
      setSong({ ...song, content_raw: newContent });
      setEditedContent(newContent);
      setTranspose(0);
      alert("Salvo com sucesso!");
    } catch (error) {
      console.error('Error applying definitive change:', error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await (supabase.from('musicbox_setlist') as any).update({
        content_raw: editedContent,
        title: song.title,
        artist: song.artist,
        observations: song.observations,
        settings: settings
      }).eq('id', id);
      if (error) throw error;
      setSong({ ...song, content_raw: editedContent });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };

  const getEffectiveColor = (color: string) => {
    if (isDarkMode) return color;
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
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-foreground/5 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-foreground/5 transition-all"><ArrowLeft className="w-6 h-6" /></button>
          <div>
            <h1 className="font-bold text-lg leading-tight">{song.title}</h1>
            <p className="text-xs text-foreground/50">{song.artist}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-yellow-500/10 text-yellow-500' : 'bg-brand-purple/10 text-brand-purple'}`}>
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="relative flex items-center bg-foreground/5 rounded-xl p-1 border border-foreground/5 shadow-inner">
            <button onClick={() => updateScrollSpeed(Math.max(1, (settings.scrollSpeed || 5) - 1))} className="p-2 hover:bg-foreground/10 rounded-lg"><Minus className="w-4 h-4" /></button>
            <button onClick={() => setIsScrolling(!isScrolling)} className={`px-6 py-2 mx-1 rounded-lg transition-all ${isScrolling ? 'bg-brand-accent text-white' : 'hover:bg-foreground/10 text-foreground/80'}`}>
              {isScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button onClick={() => updateScrollSpeed(Math.min(10, (settings.scrollSpeed || 5) + 1))} className="p-2 hover:bg-foreground/10 rounded-lg"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="w-px h-6 bg-foreground/10 mx-1" />

          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 flex items-center gap-2 hover:bg-green-600 transition-all"
              >
                <Check className="w-4 h-4" /> {t('save')}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-500/10 text-red-500 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" /> {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2.5 rounded-xl hover:bg-foreground/5 transition-all text-foreground/60"
              title={t('edit_content')}
            >
              <Pencil className="w-5 h-5" />
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


      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsSettingsOpen(false)} />
          <div className={`relative w-full max-w-sm border-l shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#0F0F1A]/95 text-white' : 'bg-white text-black'}`}>
            <div className="p-8 pb-4 flex items-center justify-between border-b border-foreground/5">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-brand-accent" />
                <h3 className="text-xl font-bold">{t('settings_title')}</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4">
                <button onClick={() => setSettings({ ...settings, showTabs: !settings.showTabs })} className={`p-4 rounded-2xl border ${settings.showTabs ? 'bg-brand-purple/20' : 'bg-foreground/5'}`}>Tabs</button>
                <button onClick={() => setSettings({ ...settings, showMetadata: !settings.showMetadata })} className={`p-4 rounded-2xl border ${settings.showMetadata ? 'bg-brand-purple/20' : 'bg-foreground/5'}`}>Info</button>
              </div>
              <div className="flex items-center justify-between p-4 mt-4 rounded-2xl border bg-foreground/5">
                <p className="font-bold">Transpose</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => setTranspose(t => t - 1)} className="w-8 h-8 bg-foreground/10 rounded-lg">-</button>
                  <span className="font-bold text-brand-accent">{transpose}</span>
                  <button onClick={() => setTranspose(t => t + 1)} className="w-8 h-8 bg-foreground/10 rounded-lg">+</button>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-foreground/10 space-y-4">
              <button onClick={handleUndo} disabled={history.length === 0} className="w-full py-4 bg-brand-purple/10 text-brand-accent rounded-2xl">Voltar ({history.length})</button>
              <button onClick={handleDefinitiveChange} className="w-full py-4 bg-green-500/10 text-green-500 rounded-2xl">Salvar Alterações</button>
              <button onClick={handleCancel} className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl">Cancelar</button>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-brand-purple text-white rounded-2xl">{t('done')}</button>
            </div>
          </div>
        </div>
      )}

      <main className="pt-24 pb-32 px-6 max-w-4xl mx-auto">
        <div className="mb-8 space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <input value={song.title} onChange={(e) => setSong({ ...song, title: e.target.value })} className="text-5xl font-black bg-transparent border-b-2 border-brand-purple/30 w-full outline-none" />
              <input value={song.artist} onChange={(e) => setSong({ ...song, artist: e.target.value })} className="text-2xl text-brand-accent/60 bg-transparent border-b border-white/10 w-full outline-none" />
              <textarea value={song.observations || ''} onChange={(e) => setSong({ ...song, observations: e.target.value })} className="w-full h-24 bg-foreground/5 p-4 rounded-2xl outline-none" />
            </div>
          ) : (
            <div className="flex items-start gap-8">
              {song.artwork_url && <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl shrink-0"><img src={song.artwork_url} className="w-full h-full object-cover" /></div>}
              <div className="flex-1 min-w-0">
                <h1 className={`font-black tracking-tighter ${settings.title.font}`} style={{ fontSize: `${settings.title.size}px`, color: getEffectiveColor(settings.title.color) }}>{song.title}</h1>
                <h2 className={`font-bold opacity-80 ${settings.artist.font}`} style={{ fontSize: `${settings.artist.size}px`, color: getEffectiveColor(settings.artist.color) }}>{song.artist}</h2>
                {settings.showMetadata && (
                  <div className={`flex gap-4 mt-4 opacity-60 uppercase ${settings.metadata.font}`} style={{ fontSize: `${settings.metadata.size}px`, color: getEffectiveColor(settings.metadata.color) }}>
                    {song.album_name && <span>{song.album_name}</span>}
                    {song.genre && <span>{song.genre}</span>}
                  </div>
                )}
                {song.observations && <div className={`p-2 mt-6 bg-brand-purple/10 border-l-4 border-brand-purple pl-6 rounded-r-xl ${settings.observations.font}`} style={{ fontSize: `${settings.observations.size}px`, color: getEffectiveColor(settings.observations.color) }}>{song.observations}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="chord-sheet-container">
          {isEditing && (
            <div className="flex gap-2 mb-6 p-1 bg-foreground/5 rounded-2xl w-fit">
              <button onClick={() => setEditMode('live')} className={`px-6 py-2 rounded-xl ${editMode === 'live' ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40'}`}>Visual Edit</button>
              <button onClick={() => setEditMode('classic')} className={`px-6 py-2 rounded-xl ${editMode === 'classic' ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40'}`}>Classic ChordPro</button>
            </div>
          )}

          {isEditing && editMode === 'classic' ? (
            <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full min-h-[60vh] bg-foreground/5 p-8 rounded-3xl font-mono outline-none border border-foreground/10" />
          ) : (
            <div className={`leading-relaxed ${isEditing ? 'editing-mode cursor-text' : ''}`}>
              {(() => {
                const contentToUse = isEditing ? editedContent : (song.content_raw || '');
                const lines = contentToUse.split('\n');
                const filteredLines = lines.map((line: string) => {
                  const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(line.trim()) || line.includes('---');
                  if (!settings.showTabs && isTabLine) return null;
                  return line;
                }).filter((l: string | null) => l !== null) as string[];
                const collapsedLines = filteredLines.filter((line, i) => {
                  if (line.trim() === '' && i > 0 && filteredLines[i - 1].trim() === '') return false;
                  return true;
                });

                return (
                  <div className={`flex flex-col gap-y-4 ${isEditing ? 'mt-8' : ''}`}>
                    {collapsedLines.map((line: string, i: number) => {
                      const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(line.trim()) || line.includes('---');
                      const isChordProLine = !isTabLine && /\[.*?\]/.test(line);

                      if (isChordProLine) {
                        const rawParts = line.split(/(\[.*?\])/g);
                        const tokens: any[] = [];
                        let k = 0;
                        while (k < rawParts.length) {
                          const part = rawParts[k];
                          if (part.startsWith('[') && part.endsWith(']')) {
                            const content = part.slice(1, -1);
                            tokens.push({ 
                              top: (transpose !== 0 && isChord(content)) ? transposeLine(content, transpose) : content, 
                              isChord: isChord(content), 
                              bottom: rawParts[k + 1] || '', 
                              partIdx: k 
                            });
                            k += 2;
                          } else {
                            // Se for texto antes do primeiro acorde ou entre eles
                            if (part !== '') tokens.push({ top: '', isChord: false, bottom: part, partIdx: k });
                            k++;
                          }
                        }
                        return (
                          <div key={i} className={`flex flex-wrap items-end ${isEditing ? 'py-8 gap-y-12' : 'pt-5 pb-2'} whitespace-pre transition-all`}>
                            {tokens.map((tok, idx) => (
                              <span 
                                key={idx} 
                                className={`flex flex-col items-start relative group/chord shrink-0 
                                  ${tok.isChord ? 'min-w-[4ch] mr-4' : 'mr-1'} 
                                  ${isEditing && tok.isChord ? 'mr-10' : ''}`}
                              >
                                <div className="flex items-center mb-1.5 h-6">
                                  {isEditing && tok.isChord && (
                                    <button 
                                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(i, tok.partIdx, 'left'); }}
                                      className="p-1 hover:bg-brand-purple/30 rounded-lg transition-all mr-1 bg-brand-purple/10 shadow-sm"
                                    >
                                      <ChevronLeft className="w-4 h-4 text-brand-accent" />
                                    </button>
                                  )}
                                  <span 
                                    contentEditable={isEditing} 
                                    suppressContentEditableWarning 
                                    onBlur={(e) => handlePartChange(i, tok.partIdx, e.currentTarget.textContent || '', true)} 
                                    className={`whitespace-pre min-h-[1.2em] transition-all
                                      ${tok.isChord ? `font-bold ${settings.chords.font}` : ''} 
                                      ${isEditing && tok.isChord ? 'bg-brand-purple/20 px-2 rounded-lg ring-1 ring-brand-purple/30 focus:ring-2 focus:ring-brand-accent outline-none shadow-md' : ''}`} 
                                    style={{ 
                                      fontSize: `${tok.isChord ? settings.chords.size : settings.lyrics.size}px`, 
                                      color: getEffectiveColor(tok.isChord ? settings.chords.color : settings.lyrics.color),
                                      lineHeight: '1'
                                    }}
                                  >
                                    {tok.top}
                                  </span>
                                  {isEditing && tok.isChord && (
                                    <button 
                                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(i, tok.partIdx, 'right'); }}
                                      className="p-1 hover:bg-brand-purple/30 rounded-lg transition-all ml-1 bg-brand-purple/10 shadow-sm"
                                    >
                                      <ChevronRight className="w-4 h-4 text-brand-accent" />
                                    </button>
                                  )}
                                </div>
                                <span 
                                  contentEditable={isEditing} 
                                  suppressContentEditableWarning 
                                  onBlur={(e) => handlePartChange(i, tok.isChord ? tok.partIdx + 1 : tok.partIdx, e.currentTarget.textContent || '', false)} 
                                  className={`whitespace-pre min-h-[1.2em] ${settings.lyrics.font} ${isEditing ? 'hover:bg-brand-purple/5 px-1 rounded-md' : ''}`} 
                                  style={{ 
                                    fontSize: `${settings.lyrics.size}px`, 
                                    color: getEffectiveColor(settings.lyrics.color),
                                    lineHeight: '1.2'
                                  }}
                                >
                                  {tok.bottom}
                                </span>
                              </span>
                            ))}
                          </div>
                        );
                      }
                      const parts = line.split(/(\[.*?\])/g);
                      return (
                        <div key={i} className={`relative min-h-[1.5em] ${isEditing ? 'py-8' : 'py-2'} flex flex-wrap items-center`}>
                          {parts.map((part, pi) => {
                            const isChordPart = part.startsWith('[') && part.endsWith(']');
                            if (isChordPart) {
                              const chord = part.slice(1, -1);
                              return (
                                <span key={pi} className="inline-flex items-center mx-2 my-1">
                                  {isEditing && (
                                    <button 
                                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(i, pi, 'left'); }}
                                      className="p-1 hover:bg-brand-purple/30 rounded-lg bg-brand-purple/5 mr-1"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <span contentEditable={isEditing} suppressContentEditableWarning onBlur={(e) => handlePartChange(i, pi, e.currentTarget.textContent || '', true)} className={`inline-block min-w-[1ch] ${isEditing ? 'bg-brand-purple/20 px-2 rounded-lg ring-1 ring-brand-purple/30' : ''}`} style={{ fontSize: `${settings.chords.size}px`, color: getEffectiveColor(settings.chords.color) }}>{chord}</span>
                                  {isEditing && (
                                    <button 
                                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(i, pi, 'right'); }}
                                      className="p-1 hover:bg-brand-purple/30 rounded-lg bg-brand-purple/5 ml-1"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </span>
                              );
                            }
                            return <span key={pi} contentEditable={isEditing} suppressContentEditableWarning onBlur={(e) => handlePartChange(i, pi, e.currentTarget.textContent || '', false)} className={`whitespace-pre ${isEditing ? 'hover:bg-brand-purple/5 px-1 rounded-md' : ''} ${isTabLine ? settings.tabs.font : settings.lyrics.font}`} style={{ fontSize: `${isTabLine ? settings.tabs.size : settings.lyrics.size}px`, color: getEffectiveColor(isTabLine ? settings.tabs.color : settings.lyrics.color) }}>{part}</span>;
                          })}
                        </div>
                      );
                    })}
                  </div>
                );


              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

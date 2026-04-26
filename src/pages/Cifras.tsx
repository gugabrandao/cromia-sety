import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Settings, Play, Pause,
  Loader2, Minus, Plus, Check, Pencil, X, Sun, Moon, Music2,
  ChevronLeft, ChevronRight, Undo2, Redo2, PlusCircle, Sparkles
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { fetchSongMetadata } from '../services/spotifyService';
import ChordDictionary from '../components/ChordDictionary';
import VoicingEditorModal from '../components/VoicingEditorModal';
import guitarChords from '@tombatossals/chords-db/lib/guitar.json';

// Stable controlled editor for plain-text lines — prevents React/browser DOM conflict
function EditableLine({ line, originalIdx, isTabLine, isEditing, settings, getEffectiveColor, handleLineUpdate, handleContextMenu, isInsideChorus, handleDeleteLine, handleInsertLine }: {
  line: string; originalIdx: number; isTabLine: boolean; isEditing: boolean;
  settings: any; getEffectiveColor: (c: string) => string;
  handleLineUpdate: (idx: number, updater: (old: string) => string) => void;
  handleDeleteLine: (idx: number) => void;
  handleInsertLine: (idx: number) => void;
  handleContextMenu: (e: React.MouseEvent, idx: number, inChorus: boolean, offset: number) => void;
  isInsideChorus: boolean;
}) {
  const [localValue, setLocalValue] = useState(line);
  const isFocused = useRef(false);

  // Sync external state → local only when NOT editing this line
  useEffect(() => {
    if (!isFocused.current) setLocalValue(line);
  }, [line]);

  const fontClass = isTabLine ? (settings.tabs?.font || 'font-mono') : settings.lyrics.font;
  const fontSize = isTabLine ? settings.tabs?.size : settings.lyrics.size;
  const color = getEffectiveColor(isTabLine ? settings.tabs?.color : settings.lyrics.color);

  if (!isEditing) {
    return (
      <div className="min-h-[1.5em] py-1" style={{ marginBottom: `${line.trim() === '' ? (settings.paragraphGap ?? 16) : (settings.plainLineGap ?? 0)}px` }} onContextMenu={(e) => handleContextMenu(e, originalIdx, isInsideChorus, 0)}>
        <span className={`${fontClass} ${settings.lyrics.italic ? 'italic' : ''} ${settings.lyrics.bold ? 'font-bold' : ''}`}
          style={{ fontSize: `${fontSize}px`, color }}>
          {line}
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-h-[1.5em] py-1 group/line transition-all px-4 -mx-4 rounded-xl"
      style={{ marginBottom: `${localValue.trim() === '' ? (settings.paragraphGap ?? 16) : (settings.plainLineGap ?? 0)}px` }}
      onContextMenu={(e) => {
        let offset = 0;
        if (e.target instanceof HTMLTextAreaElement) {
          offset = e.target.selectionStart || 0;
        } else {
          offset = localValue.length;
        }
        handleContextMenu(e, originalIdx, isInsideChorus, offset);
      }}>
      <textarea
        value={localValue}
        spellCheck={false}
        autoCorrect="off"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleLineUpdate(originalIdx, () => localValue.replace(/[\r\n]/g, ''));
            handleInsertLine(originalIdx);
          }
          if (e.key === 'Backspace' && localValue === '') {
            e.preventDefault();
            handleDeleteLine(originalIdx);
          }
        }}
        onChange={(e) => setLocalValue(e.target.value.replace(/[\r\n]/g, ''))}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => {
          isFocused.current = false;
          const text = localValue.replace(/[\r\n]/g, '');
          handleLineUpdate(originalIdx, () => text);
        }}
        className={`outline-none w-full bg-transparent resize-none overflow-hidden ${fontClass} ${settings.lyrics.italic ? 'italic' : ''} ${settings.lyrics.bold ? 'font-bold' : ''} px-2 transition-all`}
        rows={1}
        style={{ fontSize: `${fontSize}px`, color, height: 'auto', minHeight: '1.5em' }}
      />
    </div>
  );
}

export default function Cifras() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleTheme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  // --- Contexto de Setlist ---
  const queryParams = new URLSearchParams(location.search);
  const setlistId = queryParams.get('setlistId');
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [currentSetlistIndex, setCurrentSetlistIndex] = useState(-1);

  useEffect(() => {
    if (setlistId) {
      const fetchSetlistSongs = async () => {
        const { data } = await supabase
          .from('cromiasety_setlist_songs')
          .select('id, song_id, position, is_interval, interval_name, interval_duration')
          .eq('setlist_id', setlistId)
          .order('position', { ascending: true });

        if (data) {
          const formatted = (data as any[]).map(item => ({
            ...item,
            navId: item.is_interval ? `interval_${item.id}` : item.song_id
          }));
          setSetlistSongs(formatted);
          const index = formatted.findIndex(s => s.navId === id);
          setCurrentSetlistIndex(index);
        }
      };
      fetchSetlistSongs();
    }
  }, [setlistId, id]);

  const handleNextInSetlist = () => {
    if (currentSetlistIndex < setlistSongs.length - 1) {
      const nextId = (setlistSongs[currentSetlistIndex + 1] as any).navId;
      navigate(`/song/${nextId}?setlistId=${setlistId}`);
    }
  };

  const handlePrevInSetlist = () => {
    if (currentSetlistIndex > 0) {
      const prevId = (setlistSongs[currentSetlistIndex - 1] as any).navId;
      navigate(`/song/${prevId}?setlistId=${setlistId}`);
    }
  };

  // --- 1. States ---
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const [songScrollSpeed, setSongScrollSpeed] = useState(5);
  const scrollRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const [currentTranspose, setTranspose] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'live' | 'classic'>('live');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const latestContent = useRef('');
  useEffect(() => { latestContent.current = editedContent; }, [editedContent]);
  const [history, setHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [settingsHistory, setSettingsHistory] = useState<any[]>([]);
  const [settingsRedoHistory, setSettingsRedoHistory] = useState<any[]>([]);
  const [revision, setRevision] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, lineIdx: number, isChorus: boolean, charOffset: number } | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [lastInsertedLineIdx, setLastInsertedLineIdx] = useState<number | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedChordForEdit, setSelectedChordForEdit] = useState<string | null>(null);

  useEffect(() => {
    if (lastInsertedLineIdx !== null && isEditing && editMode === 'live') {
      const newLineIdx = lastInsertedLineIdx + 1;
      const element = document.querySelector(`[data-line-idx="${newLineIdx}"] textarea`) as HTMLElement;
      if (element) {
        element.focus();
        setLastInsertedLineIdx(null);
      }
    }
  }, [editedContent, lastInsertedLineIdx, isEditing, editMode]);

  const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // --- 2. Configuration & Settings ---
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('musicbox_global_settings');
    const defaults = {
      title: { size: 69, color: '#fffceb', font: 'font-outfit' },
      artist: { size: 50, color: '#f07400', font: 'font-outfit' },
      observations: { size: 34, color: '#bd5b00', font: 'font-outfit', italic: false },
      sections: { size: 20, color: '#f07400', font: 'font-mono-custom', italic: false, bold: false },
      chords: { size: 25, color: '#ff8800', font: 'font-mono-custom' },
      lyrics: { size: 25, color: '#ffffff', font: 'font-outfit' },
      tabs: { size: 17, color: '#ffffff', font: 'font-fira' },
      metadata: { size: 23, color: '#ffffff', font: 'font-inter', bold: true },
      observationsBg: '#ff8800',
      headerGap: -8,
      chordLyricGap: -8,
      lineGap: 8,
      instrumentalGap: -13,
      plainLineGap: -24,
      paragraphGap: 9,
      sectionGapTop: 0,
      sectionGapBottom: 7,
      showTabs: false,
      showSections: true,
      showMetadata: true,
      showArtwork: true,
      isDarkMode: false,
      scrollSpeed: 5,
      useFlats: false,
      metadataGapTop: 6,
      isWarmWhite: true,
      observationsGapTop: 10
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  useEffect(() => {
    localStorage.setItem('musicbox_global_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (element: string, key: string, value: any, saveHistory = true) => {
    if (saveHistory) addSettingsToHistory(settings);
    setSettings((prev: any) => ({
      ...prev,
      [element]: typeof prev[element as keyof typeof prev] === 'object'
        ? { ...(prev[element as keyof typeof prev] as any), [key]: value }
        : value
    }));
  };

  const updateGlobalSetting = (key: string, value: any, saveHistory = true) => {
    if (saveHistory) addSettingsToHistory(settings);
    setSettings((prev: any) => ({ ...prev, [key]: value }));
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

  // --- 3. History Handlers ---
  const addToHistory = useCallback((content: string) => {
    setHistory(prev => {
      if (prev.length > 0 && prev[0] === content) return prev;
      return [content, ...prev].slice(0, 10);
    });
    setRedoHistory([]);
  }, []);

  const handleFetchMetadata = async () => {
    if (!song.title || !song.artist) return;

    // Simple feedback
    const originalTitle = document.title;
    document.title = "Buscando dados...";

    setIsFetchingMetadata(true);
    try {
      const data = await fetchSongMetadata(song.title, song.artist);

      if (data) {
        const updatedFields = {
          bpm: data.bpm || song.bpm,
          original_key: data.key || song.original_key,
          time_signature: data.time_signature || song.time_signature,
          artwork_url: data.artwork_url || song.artwork_url,
          album_name: data.album_name || song.album_name,
          release_date: data.release_date || song.release_date,
          // Concatena o resumo da IA nas observações existentes, se houver
          observations: data.ai_summary
            ? `${song.observations ? song.observations + '\n\n' : ''}🤖 Análise da IA:\n${data.ai_summary}`
            : song.observations,
        };

        // Update local state
        setSong((prev: any) => ({ ...prev, ...updatedFields }));

        // Auto-save to Supabase directly to columns
        const { error } = await (supabase.from('cromiasety_songs') as any)
          .update(updatedFields)
          .eq('id', id);

        if (error) throw error;

        alert("Dados musicais (BPM/Tom) atualizados e salvos com sucesso!");
      } else {
        alert("Não conseguimos encontrar dados automáticos para esta música. Você pode preenchê-los manualmente se desejar.");
      }
    } catch (error) {
      console.error('Metadata error:', error);
      alert("Erro ao consultar a base de dados musical. Tente novamente em instantes.");
    } finally {
      document.title = originalTitle;
      setIsFetchingMetadata(false);
    }
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const lastVersion = history[0];
      setRedoHistory(prev => [editedContent, ...prev].slice(0, 10));
      setEditedContent(lastVersion);
      setHistory(prev => prev.slice(1));
      setRevision(prev => prev + 1);
    }
  };

  const handleRedo = () => {
    if (redoHistory.length > 0) {
      const nextVersion = redoHistory[0];
      setHistory(prev => [editedContent, ...prev].slice(0, 10));
      setEditedContent(nextVersion);
      setRedoHistory(prev => prev.slice(1));
      setRevision(prev => prev + 1);
    }
  };

  const addSettingsToHistory = (s: any) => {
    const sString = JSON.stringify(s);
    if (settingsHistory.length > 0 && JSON.stringify(settingsHistory[0]) === sString) return;
    setSettingsHistory(prev => [JSON.parse(sString), ...prev].slice(0, 20));
    setSettingsRedoHistory([]);
  };

  const handleSettingsUndo = () => {
    if (settingsHistory.length > 0) {
      const lastVersion = settingsHistory[0];
      setSettingsRedoHistory(prev => [JSON.parse(JSON.stringify(settings)), ...prev].slice(0, 20));
      setSettings(lastVersion);
      setSettingsHistory(prev => prev.slice(1));
    }
  };

  const handleSettingsRedo = () => {
    if (settingsRedoHistory.length > 0) {
      const nextVersion = settingsRedoHistory[0];
      setSettingsHistory(prev => [JSON.parse(JSON.stringify(settings)), ...prev].slice(0, 20));
      setSettings(nextVersion);
      setSettingsRedoHistory(prev => prev.slice(1));
    }
  };

  // --- 4. Content Handlers ---
  const isChord = (token: string) => {
    if (!token) return false;
    return /^[A-G][b#]?(m|min|maj|M|dim|aug|sus|add|ø|º|°|7M|7|6|5|4|2|9|11|13|\+|\-|\(|\))*(\/[A-G][b#]?)?$/.test(token.trim());
  };

  const currentTransposeLine = (line: string, amount: number) => {
    const targetNotes = settings.useFlats ? flatNotes : sharpNotes;

    return line.replace(/(\S+)/g, (match) => {
      if (isChord(match)) {
        return match.replace(/[A-G][b#]?/g, (noteMatch) => {
          let note = noteMatch;
          const flatMap: any = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
          if (note.endsWith('b')) note = flatMap[note] || note;
          const index = sharpNotes.indexOf(note);
          if (index === -1) return noteMatch;

          let newIndex = (index + amount) % 12;
          if (newIndex < 0) newIndex += 12;

          return targetNotes[newIndex];
        });
      }
      return match;
    });
  };

  const handleLineUpdate = useCallback((lineIdx: number, updater: (oldLine: string) => string) => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');
    if (lineIdx < 0 || lineIdx >= lines.length) return;
    const newLine = updater(lines[lineIdx]).replace(/[\r\n]/g, '');
    if (lines[lineIdx] === newLine) return;

    addToHistory(prevContent);
    const newLines = [...lines];
    newLines[lineIdx] = newLine;
    setEditedContent(newLines.join('\n'));
  }, [addToHistory]);

  const handleDeleteLine = useCallback((lineIdx: number) => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');
    if (lines.length <= 1) return;

    addToHistory(prevContent);
    const newLines = [...lines];
    newLines.splice(lineIdx, 1);
    setEditedContent(newLines.join('\n'));
  }, [addToHistory]);

  const handleInsertLine = useCallback((lineIdx: number) => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');

    addToHistory(prevContent);
    const newLines = [...lines];
    newLines.splice(lineIdx + 1, 0, '');
    setEditedContent(newLines.join('\n'));
    setLastInsertedLineIdx(lineIdx);
  }, [addToHistory]);

  const handlePartChange = (lineIdx: number, partIdx: number, newValue: string, isChordPart: boolean) => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');
    const line = lines[lineIdx];
    const parts = line.split(/(\[.*?\])/g);

    let changed = false;
    if (isChordPart) {
      const cleanChord = newValue.replace(/[\[\]]/g, '').trim();
      const newVal = cleanChord ? `[${cleanChord}]` : '';
      if (parts[partIdx] !== newVal) { parts[partIdx] = newVal; changed = true; }
    } else {
      if (parts[partIdx] !== newValue) { parts[partIdx] = newValue; changed = true; }
    }

    if (!changed) return;

    addToHistory(prevContent);
    lines[lineIdx] = parts.join('');
    setEditedContent(lines.join('\n'));
  };

  const moveChord = (lineIdx: number, partIdx: number, direction: 'left' | 'right') => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');
    const line = lines[lineIdx];
    if (!line) return;

    const parts = line.split(/(\[.*?\])/g);
    addToHistory(prevContent);

    if (direction === 'right') {
      const nextPart = parts[partIdx + 1] || '';
      if (nextPart.length > 0) {
        const charToMove = nextPart[0];
        parts[partIdx + 1] = nextPart.slice(1);
        parts[partIdx - 1] = (parts[partIdx - 1] || '') + charToMove;
      }
    } else {
      const prevPart = parts[partIdx - 1] || '';
      if (prevPart.length > 0) {
        const charToMove = prevPart[prevPart.length - 1];
        parts[partIdx - 1] = prevPart.slice(0, -1);
        parts[partIdx + 1] = charToMove + (parts[partIdx + 1] || '');
      }
    }
    lines[lineIdx] = parts.join('');
    setEditedContent(lines.join('\n'));
  };

  const mapPlainToOriginalOffset = (originalLine: string, plainOffset: number) => {
    let originalOffset = 0;
    let currentPlain = 0;

    while (currentPlain < plainOffset && originalOffset < originalLine.length) {
      if (originalLine[originalOffset] === '[') {
        while (originalOffset < originalLine.length && originalLine[originalOffset] !== ']') {
          originalOffset++;
        }
        originalOffset++; // Pula o ']'
      } else {
        currentPlain++;
        originalOffset++;
      }
    }

    // Se paramos em cima de um acorde recém-pulado ou de uma sequência de acordes, 
    // precisamos garantir que o novo acorde venha depois deles se o offset já foi atingido
    while (originalOffset < originalLine.length && originalLine[originalOffset] === '[') {
      while (originalOffset < originalLine.length && originalLine[originalOffset] !== ']') {
        originalOffset++;
      }
      originalOffset++;
    }

    return originalOffset;
  };

  const getDefaultVoicing = (chordName: string) => {
    if (!guitarChords || !guitarChords.chords) return null;

    let key = '';
    let suffix = '';
    
    if (chordName.length >= 2 && (chordName[1] === '#' || chordName[1] === 'b')) {
      key = chordName.substring(0, 2);
      suffix = chordName.substring(2);
    } else {
      key = chordName.substring(0, 1);
      suffix = chordName.substring(1);
    }

    let dbSuffix = suffix;
    if (suffix === '') dbSuffix = 'major';
    if (suffix === 'm') dbSuffix = 'minor';
    if (suffix === 'M') dbSuffix = 'major';
    
    let dbKey = key;
    if (key === 'C#') dbKey = 'Csharp';
    if (key === 'F#') dbKey = 'Fsharp';

    const chordEntries = (guitarChords as any).chords[dbKey];
    if (chordEntries) {
      const entry = chordEntries.find((c: any) => c.suffix === dbSuffix) || chordEntries[0];
      if (entry && entry.positions && entry.positions[0]) {
        const pos = entry.positions[0];
        const fingers: any[] = [];
        
        pos.frets.forEach((f: number, i: number) => {
          const string = 6 - i;
          if (f === 0) {
            fingers.push([string, 0]);
          } else if (f === -1) {
            fingers.push([string, 'x']);
          } else if (f > 0) {
            const fingerNum = pos.fingers[i] > 0 ? pos.fingers[i].toString() : undefined;
            fingers.push([string, f, fingerNum]);
          }
        });

        return {
          fingers,
          barres: pos.barres?.map((fret: number) => ({ fromString: 6, toString: 1, fret })) || [],
          position: pos.baseFret || 1
        };
      }
    }
    
    return null;
  };

  const addChordToLine = (lineIdx: number, plainOffset: number, chordName: string = '') => {
    const prevContent = latestContent.current;
    addToHistory(prevContent);

    if (lineIdx === -1) {
      const newText = prevContent.slice(0, plainOffset) + `[${chordName}]` + prevContent.slice(plainOffset);
      setEditedContent(newText);
      return;
    }

    const lines = prevContent.split('\n');
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    const line = lines[lineIdx];
    const realOffset = (editMode === 'live') ? mapPlainToOriginalOffset(line, plainOffset) : plainOffset;

    const newLine = line.slice(0, realOffset) + `[${chordName}]` + line.slice(realOffset);
    lines[lineIdx] = newLine;
    setEditedContent(lines.join('\n'));
  };

  const handleContextMenu = (e: React.MouseEvent, lineIdx: number, isChorus: boolean, charOffset: number = 0) => {
    if (!isEditing) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, lineIdx, isChorus, charOffset });
  };

  const handleTextareaContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!isEditing) return;
    e.preventDefault();
    const target = e.currentTarget;
    const offset = target.selectionStart || 0;
    setContextMenu({ x: e.clientX, y: e.clientY, lineIdx: -1, isChorus: false, charOffset: offset });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (!typingTimeoutRef.current) {
      addToHistory(latestContent.current);
    } else {
      clearTimeout(typingTimeoutRef.current);
    }

    setEditedContent(newValue);

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const toggleChorus = (targetIdx: number, forceRemove = false) => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');
    if (targetIdx === -1 || targetIdx >= lines.length) return;

    addToHistory(prevContent);

    if (forceRemove) {
      let socIdx = -1;
      for (let i = targetIdx; i >= 0; i--) {
        const low = lines[i].trim().toLowerCase();
        if (low === '{soc}' || low === '{start_of_chorus}') { socIdx = i; break; }
        if (lines[i].trim().startsWith('[') && i < targetIdx) break;
      }
      let eocIdx = -1;
      for (let i = targetIdx; i < lines.length; i++) {
        const low = lines[i].trim().toLowerCase();
        if (low === '{eoc}' || low === '{end_of_chorus}') { eocIdx = i; break; }
        if (lines[i].trim().startsWith('[') && i > targetIdx) break;
      }
      if (socIdx !== -1 && eocIdx !== -1) {
        const newLines = [...lines];
        newLines.splice(eocIdx, 1);
        newLines.splice(socIdx, 1);
        setEditedContent(newLines.join('\n'));
      }
      return;
    }

    const currentLine = lines[targetIdx].trim().toLowerCase();
    const isSection = currentLine.startsWith('[') && currentLine.endsWith(']');
    const isSectionHeader = (l: string) => {
      const t = l.trim();
      return t.startsWith('[') && t.endsWith(']') && !isChord(t.slice(1, -1));
    };

    if (isSection) {
      const nextLine = lines[targetIdx + 1]?.trim().toLowerCase();
      if (nextLine === '{soc}' || nextLine === '{start_of_chorus}') {
        let eocIdx = -1;
        for (let i = targetIdx + 1; i < lines.length; i++) {
          const low = lines[i].trim().toLowerCase();
          if (low === '{eoc}' || low === '{end_of_chorus}') { eocIdx = i; break; }
        }
        if (eocIdx !== -1) {
          const newLines = [...lines];
          newLines.splice(eocIdx, 1);
          newLines.splice(targetIdx + 1, 1);
          setEditedContent(newLines.join('\n'));
        }
      } else {
        const newLines = [...lines];
        newLines.splice(targetIdx + 1, 0, '{soc}');
        let endIdx = targetIdx + 2;
        while (endIdx < newLines.length && !isSectionHeader(newLines[endIdx])) endIdx++;
        while (endIdx > targetIdx + 2 && newLines[endIdx - 1].trim() === '') endIdx--;
        newLines.splice(endIdx, 0, '{eoc}');
        setEditedContent(newLines.join('\n'));
      }
    } else {
      let startIdx = targetIdx;
      while (startIdx > 0 && lines[startIdx - 1].trim() !== '' && !isSectionHeader(lines[startIdx - 1])) startIdx--;
      let endIdx = targetIdx;
      while (endIdx < lines.length - 1 && lines[endIdx + 1].trim() !== '' && !isSectionHeader(lines[endIdx + 1])) endIdx++;
      const newLines = [...lines];
      newLines.splice(endIdx + 1, 0, '{eoc}');
      newLines.splice(startIdx, 0, '{soc}');
      setEditedContent(newLines.join('\n'));
    }
  };

  // --- 5. Render Helper ---
  const renderLine = (line: string, originalIdx: number, isInsideChorus: boolean) => {
    const trimmedLine = line.trim();
    const isTabLine = /^[A-Ge]\|[-|0-9a-z ]+/i.test(trimmedLine) || line.includes('---');
    const isSectionOnly = /^\[[^\]]+\]$/.test(trimmedLine);
    const isChordProLine = !isTabLine && !isSectionOnly && /\[.*?\]/.test(line);

    if (isSectionOnly) {
      if (!settings.showSections && !isEditing) return null;
      const isHidden = !settings.showSections;
      const sectionName = trimmedLine.slice(1, -1);
      return (
        <div key={`section-${originalIdx}`}
          className={`flex items-center ${isEditing ? 'py-4 cursor-context-menu' : ''} ${isHidden ? 'opacity-40 grayscale-[0.5]' : ''}`}
          style={{ marginTop: `${settings.sectionGapTop ?? 12}px`, marginBottom: `${settings.sectionGapBottom ?? 8}px` }}
          onContextMenu={(e) => handleContextMenu(e, originalIdx, isInsideChorus, 0)}>
          <span
            contentEditable={isEditing}
            suppressContentEditableWarning
            spellCheck="false"
            onBlur={(e) => {
              const newName = e.currentTarget.innerText.replace(/[\r\n]/g, '').trim();
              handleLineUpdate(originalIdx, () => `[${newName}]`);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === 'Backspace' && e.currentTarget.innerText.trim() === '') {
                e.preventDefault();
                handleDeleteLine(originalIdx);
              }
            }}
            className={`px-4 py-0 rounded-full font-bold outline-none ${settings.sections?.font || 'font-outfit'} ${settings.sections?.italic ? 'italic' : ''}`}
            style={{ fontSize: `${settings.sections?.size || 18}px`, color: getEffectiveColor(settings.sections?.color || '#a855f7'), backgroundColor: `${settings.sections?.color || '#a855f7'}20` }}
            dangerouslySetInnerHTML={{ __html: sectionName }}
          />
          {isEditing && (
            <button onClick={(e) => { e.stopPropagation(); toggleChorus(originalIdx); }} className="ml-2 p-1.5 rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple transition-all border border-brand-purple/20 group">
              <Music2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      );
    }

    if (isChordProLine) {
      if (isEditing && editMode === 'live') {
        // --- NOVO MODO DE EDIÇÃO VISUAL HÍBRIDO (FLEXÍVEL) ---
        const chords: { name: string; offset: number; partIdx: number }[] = [];
        let plainText = '';
        let currentOffset = 0;
        const parts = line.split(/(\[.*?\])/g);

        parts.forEach((p, pIdx) => {
          if (p.startsWith('[') && p.endsWith(']')) {
            chords.push({ name: p.slice(1, -1), offset: currentOffset, partIdx: pIdx });
          } else {
            plainText += p;
            currentOffset += p.length;
          }
        });

        const fontStyle = {
          fontSize: `${settings.lyrics.size}px`,
          fontFamily: settings.lyrics.font.replace('font-', ''),
          fontStyle: settings.lyrics.italic ? 'italic' : 'normal',
          fontWeight: settings.lyrics.bold ? 'bold' : 'normal',
          letterSpacing: 'normal',
          lineHeight: '1.2'
        };

        const isInstrumental = plainText.trim() === '';

        return (
          <div
            key={`visual-${originalIdx}`}
            data-line-idx={originalIdx}
            className="visual-line-hybrid relative min-h-[4.5em] pt-8 pb-2 px-4 -mx-4 rounded-xl hover:bg-foreground/[0.02] transition-all group/line outline-none focus-within:bg-brand-purple/5 grid"
            style={{ marginBottom: `${isInstrumental ? (settings.instrumentalGap ?? settings.lineGap ?? 0) : (settings.lineGap ?? 0)}px` }}
          >
            {/* Camada de Acordes (Visual) */}
            <div className="col-start-1 row-start-1 w-full pointer-events-none select-none break-words whitespace-pre-wrap" style={{ ...fontStyle, color: 'transparent' }}>
              {/* Usamos um espelho para saber onde cada caractere está */}
              {plainText.split('').map((char, charIdx) => {
                const chordAtThisChar = chords.find(c => c.offset === charIdx);
                return (
                  <span key={charIdx} className="relative">
                    {char}
                    {chordAtThisChar && (
                      <div className="absolute -top-[1.65em] left-1/2 -translate-x-1/2 z-20 pointer-events-auto group/chord flex items-center">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(originalIdx, chordAtThisChar.partIdx, 'left'); }}
                          className="absolute right-full mr-1 opacity-0 group-hover/chord:opacity-100 transition-all p-0.5 hover:bg-brand-purple/30 rounded bg-brand-purple/10 cursor-pointer"
                        >
                          <ChevronLeft className="w-3 h-3 text-brand-accent" />
                        </button>

                        <span
                          contentEditable
                          suppressContentEditableWarning
                          spellCheck="false"
                          onBlur={(e) => handlePartChange(originalIdx, chordAtThisChar.partIdx, e.currentTarget.innerText.trim(), true)}
                          className={`px-1.5 py-0.5 rounded-md bg-brand-purple text-white font-black shadow-lg shadow-brand-purple/30 outline-none cursor-text transition-transform active:scale-95 ${settings.chords.font}`}
                          style={{ fontSize: `${settings.chords.size * 0.75}px` }}
                        >
                          {isChord(chordAtThisChar.name) ? currentTransposeLine(chordAtThisChar.name, currentTranspose) : chordAtThisChar.name}
                        </span>

                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(originalIdx, chordAtThisChar.partIdx, 'right'); }}
                          className="absolute left-full ml-1 opacity-0 group-hover/chord:opacity-100 transition-all p-0.5 hover:bg-brand-purple/30 rounded bg-brand-purple/10 cursor-pointer"
                        >
                          <ChevronRight className="w-3 h-3 text-brand-accent" />
                        </button>
                      </div>
                    )}
                  </span>
                );
              })}

              {/* Slot extra no fim */}
              <span
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleContextMenu(e, originalIdx, isInsideChorus, plainText.length); }}
                className="relative inline-block min-w-[2ch] pointer-events-auto cursor-context-menu"
              >
                &#8203;
                {chords.find(c => c.offset >= plainText.length) && (
                  <div className="absolute -top-[1.65em] left-1/2 -translate-x-1/2 flex items-center group/chord z-20">
                    <button onMouseDown={() => moveChord(originalIdx, chords.find(c => c.offset >= plainText.length)!.partIdx, 'left')} className="opacity-0 group-hover/chord:opacity-100 p-0.5 rounded bg-brand-purple/10 cursor-pointer"><ChevronLeft className="w-3 h-3" /></button>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck="false"
                      onBlur={(e) => handlePartChange(originalIdx, chords.find(c => c.offset >= plainText.length)!.partIdx, e.currentTarget.innerText.trim(), true)}
                      className={`px-1.5 py-0.5 rounded-md bg-brand-purple text-white font-black shadow-lg shadow-brand-purple/30 outline-none cursor-text transition-transform active:scale-95 ${settings.chords.font}`}
                      style={{ fontSize: `${settings.chords.size * 0.75}px` }}
                    >
                      {isChord(chords.find(c => c.offset >= plainText.length)!.name) ? currentTransposeLine(chords.find(c => c.offset >= plainText.length)!.name, currentTranspose) : chords.find(c => c.offset >= plainText.length)!.name}
                    </span>
                    <button onMouseDown={() => moveChord(originalIdx, chords.find(c => c.offset >= plainText.length)!.partIdx, 'right')} className="opacity-0 group-hover/chord:opacity-100 p-0.5 rounded bg-brand-purple/10 cursor-pointer"><ChevronRight className="w-3 h-3" /></button>
                  </div>
                )}
              </span>
            </div>

            {/* O TEXTAREA REAL (Invisível mas funcional) */}
            <textarea
              value={plainText}
              spellCheck={false}
              autoCorrect="off"
              onContextMenu={(e) => {
                const offset = e.currentTarget.selectionStart || 0;
                handleContextMenu(e, originalIdx, isInsideChorus, offset);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInsertLine(originalIdx);
                }
                if (e.key === 'Backspace' && plainText === '') {
                  e.preventDefault();
                  handleDeleteLine(originalIdx);
                }
              }}
              onChange={(e) => {
                const newValue = e.target.value.replace(/[\r\n]/g, '');
                const oldValue = plainText;
                const selectionStart = e.target.selectionStart;

                // Heurística de Diff para "Sticky Chords"
                const diff = newValue.length - oldValue.length;

                // Se o diff for negativo (delete), a posição da mudança é o cursor atual
                // Se for positivo (insert), a posição é cursor - diff
                const startShiftIndex = diff > 0 ? selectionStart - diff : selectionStart;

                handleLineUpdate(originalIdx, (old) => {
                  const oldParts = old.split(/(\[.*?\])/g);
                  let currentChords: { name: string, offset: number }[] = [];
                  let offset = 0;
                  oldParts.forEach(p => {
                    if (p.startsWith('[') && p.endsWith(']')) {
                      currentChords.push({ name: p, offset });
                    } else {
                      offset += p.length;
                    }
                  });

                  // Ajusta os offsets dos acordes baseados no deslocamento do texto
                  const adjustedChords = currentChords.map(c => {
                    if (diff > 0) {
                      // Inserção: Empurra acordes à frente ou na posição da inserção
                      if (c.offset >= startShiftIndex) return { ...c, offset: c.offset + diff };
                    } else if (diff < 0) {
                      // Deleção: Puxa acordes à frente da deleção
                      // Se o acorde estava EXATAMENTE no meio da área deletada, ele "encosta" no início da deleção
                      if (c.offset > startShiftIndex + Math.abs(diff)) return { ...c, offset: c.offset + diff };
                      if (c.offset > startShiftIndex) return { ...c, offset: startShiftIndex };
                    }
                    return c;
                  });

                  // Reconstrói o ChordPro
                  let result = '';
                  for (let i = 0; i <= newValue.length; i++) {
                    // Insere todos os acordes que caíram neste offset (podem ser múltiplos se deletamos texto entre eles)
                    adjustedChords.filter(c => c.offset === i).forEach(c => { result += c.name; });
                    if (i < newValue.length) result += newValue[i];
                  }
                  return result;
                });
              }}
              className="col-start-1 row-start-1 w-full h-full bg-transparent outline-none resize-none overflow-hidden block z-10 break-words whitespace-pre-wrap"
              style={{
                ...fontStyle,
                color: getEffectiveColor(settings.lyrics.color),
                caretColor: getEffectiveColor(settings.lyrics.color) // Mantém o cursor visível
              }}
            />
          </div>
        );
      }

      // --- MODO DE VISUALIZAÇÃO PADRÃO OU TEXTO ---
      const parts = line.split(/(\[.*?\])/g);
      let cumulativeOffset = 0;
      const tokens = parts.map((part, pIdx) => {
        const isChordPart = part.startsWith('[') && part.endsWith(']');
        const partLength = part.length;
        const currentOffset = cumulativeOffset;
        cumulativeOffset += partLength;
        if (isChordPart) {
          const content = part.slice(1, -1);
          const transposed = isChord(content) ? currentTransposeLine(content, currentTranspose) : content;
          return { top: transposed, bottom: '', isChord: true, partIdx: pIdx, startOffset: currentOffset };
        }
        return { top: '', bottom: part, isChord: false, partIdx: pIdx, startOffset: currentOffset };
      });

      const merged: any[] = [];
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].isChord) {
          const next = tokens[i + 1];
          merged.push({
            top: tokens[i].top,
            bottom: next && !next.isChord ? next.bottom : '',
            hasChord: true,
            partIdx: tokens[i].partIdx,
            startOffset: tokens[i].startOffset
          });
          if (next && !next.isChord) i++;
        } else {
          merged.push({ top: '', bottom: tokens[i].bottom, hasChord: false, partIdx: tokens[i].partIdx, startOffset: tokens[i].startOffset });
        }
      }

      const isInstrumental = line.replace(/\[.*?\]/g, '').trim() === '';

      return (
        <div key={`chord-${originalIdx}`} className={`flex flex-wrap items-end min-h-[3em] group/line transition-all ${isEditing ? 'px-4 -mx-4 rounded-xl' : ''}`} style={{ marginBottom: `${isInstrumental ? (settings.instrumentalGap ?? settings.lineGap ?? 0) : (settings.lineGap ?? 0)}px` }} onContextMenu={(e) => {
          if (!isEditing) return;
          const cleanLineLength = line.replace(/\[.*?\]/g, '').length;
          handleContextMenu(e, originalIdx, isInsideChorus, cleanLineLength);
        }}>
          {merged.map((tok, idx) => (
            <span key={`tok-${originalIdx}-${idx}`} className={`inline-flex relative group/chord ${isInstrumental ? 'flex-row items-center pt-2' : 'flex-col items-start pt-4'}`}>
              <div className={`flex items-end relative ${isInstrumental ? '' : 'h-[1.5em] w-full'} ${tok.hasChord && !isInstrumental ? 'pr-2' : ''}`} style={{ marginBottom: isInstrumental ? '0px' : `${settings.chordLyricGap ?? 4}px` }}>
                {isEditing && tok.hasChord && (
                  <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(originalIdx, tok.partIdx, 'left'); }} className="absolute right-full bottom-[2px] mr-1 opacity-0 group-hover/chord:opacity-100 transition-all p-1 hover:bg-brand-purple/30 rounded-md bg-brand-purple/10 z-10 shrink-0">
                    <ChevronLeft className="w-4 h-4 text-brand-accent" />
                  </button>
                )}
                <span contentEditable={isEditing} suppressContentEditableWarning spellCheck="false"
                  onContextMenu={(e) => { if (!isEditing) return; e.stopPropagation(); handleContextMenu(e, originalIdx, isInsideChorus, tok.startOffset); }}
                  onBlur={(e) => handlePartChange(originalIdx, tok.partIdx, e.currentTarget.innerText.trim(), true)}
                  onClick={() => {
                    if (!isEditing && tok.hasChord) {
                      setSelectedChordForEdit(tok.top);
                    }
                  }}
                  className={`whitespace-pre min-h-[1.2em] transition-all ${tok.hasChord ? `font-bold ${settings.chords.font}` : ''} ${isEditing && tok.hasChord ? 'outline-none min-w-[1ch] rounded outline outline-1 outline-dashed outline-brand-purple/30 focus:outline-brand-purple focus:outline-solid' : 'cursor-pointer hover:text-brand-accent transition-colors'}`}
                  style={{ fontSize: `${settings.chords.size}px`, color: getEffectiveColor(settings.chords.color), lineHeight: '1' }}
                  dangerouslySetInnerHTML={{ __html: tok.top || '' }}
                />
                {isEditing && tok.hasChord && (
                  <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(originalIdx, tok.partIdx, 'right'); }} className="ml-1 mb-[2px] opacity-0 group-hover/chord:opacity-100 transition-all p-1 hover:bg-brand-purple/30 rounded-md bg-brand-purple/10 z-10 shrink-0">
                    <ChevronRight className="w-4 h-4 text-brand-accent" />
                  </button>
                )}
              </div>
              <span contentEditable={isEditing} suppressContentEditableWarning spellCheck="false"
                onContextMenu={(e) => {
                  if (!isEditing) return;
                  e.stopPropagation();
                  let localOffset = 0;
                  if (document.caretRangeFromPoint) {
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    if (range && range.startContainer.parentElement === e.currentTarget) {
                      localOffset = range.startOffset;
                    } else if (range && range.startContainer === e.currentTarget) {
                      localOffset = range.startOffset;
                    }
                  }
                  if (localOffset === 0) {
                    const selection = window.getSelection();
                    localOffset = selection ? selection.anchorOffset : 0;
                  }
                  handleContextMenu(e, originalIdx, isInsideChorus, tok.startOffset + localOffset);
                }}
                onBlur={(e) => {
                  const newLyric = e.currentTarget.innerText.replace(/[\r\n\u00A0\u200B]/g, '');
                  handleLineUpdate(originalIdx, (old) => {
                    const parts = old.split(/(\[.*?\])/g);
                    const lyricIdx = tok.hasChord ? tok.partIdx + 1 : tok.partIdx;
                    parts[lyricIdx] = newLyric;
                    return parts.join('');
                  });
                }}
                className={`whitespace-pre inline-block outline-none transition-all ${settings.lyrics.font} ${settings.lyrics.italic ? 'italic' : ''} ${settings.lyrics.bold ? 'font-bold' : ''} ${isEditing ? '' : ''}`}
                style={{ fontSize: `${settings.lyrics.size}px`, color: getEffectiveColor(settings.lyrics.color), minHeight: '1.2em' }}
                dangerouslySetInnerHTML={{ __html: tok.bottom || '&#8203;' }}
              />
            </span>
          ))}
        </div>
      );
    }

    return (
      <EditableLine key={originalIdx} line={line} originalIdx={originalIdx} isTabLine={isTabLine} isEditing={isEditing} settings={settings} getEffectiveColor={getEffectiveColor} handleLineUpdate={handleLineUpdate} handleDeleteLine={handleDeleteLine} handleInsertLine={handleInsertLine} handleContextMenu={handleContextMenu} isInsideChorus={isInsideChorus} />
    );
  };

  // --- 6. Lifecycle & Side Effects ---
  useEffect(() => {
    async function fetchSong() {
      if (!id) return;
      if (id.startsWith('interval_')) {
        setLoading(false);
        setSong({ is_interval: true });
        return;
      }
      setLoading(true);
      const { data, error } = await (supabase.from('cromiasety_songs') as any).select('*').eq('id', id).single();
      if (data) {
        setSong(data);
        setEditedContent(data.content_raw || '');
        setSongScrollSpeed(data.scroll_speed ?? data.settings?.scrollSpeed ?? 5);
      }
      if (error) console.error(error);
      setLoading(false);
    }
    fetchSong();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo(); else handleUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, history, redoHistory, editedContent]);

  useEffect(() => {
    if (!isScrolling) {
      if (scrollRef.current) cancelAnimationFrame(scrollRef.current);
      lastTimeRef.current = undefined;
      return;
    }
    let exactScrollY = window.scrollY;
    const scrollLoop = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        const deltaTime = Math.min(time - lastTimeRef.current, 50);
        const speedMap = [0, 10, 18, 28, 42, 60, 85, 120, 165, 220, 300];
        const pixelsPerSecond = speedMap[songScrollSpeed] || 60;
        exactScrollY += pixelsPerSecond * (deltaTime / 1000);
        window.scrollTo(0, exactScrollY);
      }
      lastTimeRef.current = time;
      scrollRef.current = requestAnimationFrame(scrollLoop);
    };
    scrollRef.current = requestAnimationFrame(scrollLoop);
    return () => { if (scrollRef.current) cancelAnimationFrame(scrollRef.current); };
  }, [isScrolling, songScrollSpeed]);

  const updateSongScrollSpeed = async (newSpeed: number) => {
    const clamped = Math.max(1, Math.min(10, newSpeed));
    setSongScrollSpeed(clamped);
    if (id && !id.startsWith('interval_') && song) {
      try {
        const { error } = await (supabase.from('cromiasety_songs') as any).update({ scroll_speed: clamped }).eq('id', id);
        if (error) throw error;
      } catch (err) {
        try {
          const newDBSettings = { ...(song.settings || {}), scrollSpeed: clamped };
          await (supabase.from('cromiasety_songs') as any).update({ settings: newDBSettings }).eq('id', id);
        } catch (e) { }
      }
    }
  };

  // --- 7. Main Handlers ---
  const handleSaveEdit = async () => {
    try {
      const { error } = await (supabase.from('cromiasety_songs') as any).update({
        content_raw: editedContent,
        title: song.title,
        artist: song.artist,
        observations: song.observations
      }).eq('id', id);
      if (error) throw error;
      setSong({ ...song, content_raw: editedContent });
      setIsEditing(false);
    } catch (error) { console.error('Error saving edit:', error); }
  };

  const handleCancel = () => {
    if (confirm('Deseja descartar as alterações não salvas?')) {
      setEditedContent(song.content_raw || '');
      setIsEditing(false);
      setHistory([]);
    }
  };

  const handleDefinitiveChange = async () => {
    if (!window.confirm("Essa_ação_vai_reescrever_o_arquivo_original_permanentemente._Deseja_continuar?".replace(/_/g, ' '))) return;
    const lines = editedContent.split('\n');
    const filtered = lines.map(line => {
      const isTab = /^[A-Ge]\|[-|0-9a-z ]+/i.test(line.trim()) || line.includes('---');
      if (!settings.showTabs && isTab) return null;
      if (/\[.*?\]/.test(line)) {
        return line.replace(/\[(.*?)\]/g, (m, c) => isChord(c) ? `[${currentTransposeLine(c, currentTranspose)}]` : m);
      }
      return line;
    }).filter(l => l !== null);
    const newContent = filtered.join('\n');
    try {
      const { error } = await (supabase.from('cromiasety_songs') as any).update({ content_raw: newContent }).eq('id', id);
      if (error) throw error;
      setSong({ ...song, content_raw: newContent });
      setEditedContent(newContent);
      setTranspose(0);
      alert("Salvo com sucesso!");
    } catch (error) { console.error('Error applying definitive change:', error); }
  };

  const handleSaveVoicing = async (chord: string, voicing: any) => {
    if (!song || !id) return;
    
    const newSettings = {
      ...(song.settings || {}),
      custom_voicings: {
        ...(song.settings?.custom_voicings || {}),
        [chord]: voicing
      }
    };

    try {
      const { error } = await (supabase.from('cromiasety_songs') as any)
        .update({ settings: newSettings })
        .eq('id', id);

      if (error) throw error;
      setSong({ ...song, settings: newSettings });
    } catch (error) {
      console.error('Error saving voicing:', error);
    }
  };

  const extractedChords = Array.from(new Set(
    (editedContent.match(/\[(.*?)\]/g) || [])
      .map(m => m.slice(1, -1))
      .filter(c => isChord(c))
      .map(c => currentTransposeLine(c, currentTranspose))
  ));

  // --- 8. Render Logic ---
  const renderEditorContent = () => {
    const lines = (isEditing ? editedContent : (song?.content_raw || '')).split('\n');
    const mappedLines = lines.map((text: string, idx: number) => ({ text, originalIdx: idx }));

    let filteredMapped = [...mappedLines];
    if (!settings.showTabs && !isEditing) {
      let currentBlock: number[] = [];
      for (let i = 0; i <= mappedLines.length; i++) {
        if (i < mappedLines.length && mappedLines[i].text.trim() !== '') {
          currentBlock.push(i);
        } else {
          if (currentBlock.length > 0) {
            const blockContent = currentBlock.map(idx => mappedLines[idx].text);
            const hasTab = blockContent.some(l => /^[A-Ge]\|[-|0-9a-z ]+/i.test(l.trim()) || l.includes('---'));
            const hasLyr = blockContent.some(l => /\[.*?\]/.test(l) && l.trim().split(/\[.*?\]/g).some((p: string) => p.trim().length > 0));
            if (hasTab && !hasLyr) currentBlock.forEach(idx => { filteredMapped[idx] = null; });
          }
          currentBlock = [];
        }
      }
    }

    const finalLines = (filteredMapped.filter(l => l !== null) as any[]).filter((l, i, arr) => !(l.text.trim() === '' && i > 0 && arr[i - 1].text.trim() === ''));

    const groups: any[] = [];
    let currentChorus: any[] | null = null;
    finalLines.forEach((lineObj) => {
      const low = lineObj.text.trim().toLowerCase();
      if (low === '{soc}' || low === '{start_of_chorus}') {
        currentChorus = [];
        if (groups.length > 0 && groups[groups.length - 1].type === 'line' && /^\[[^\]]+\]$/.test(groups[groups.length - 1].lines[0].text.trim())) {
          currentChorus.push(groups.pop().lines[0]);
        }
      } else if (low === '{eoc}' || low === '{end_of_chorus}') {
        if (currentChorus) { groups.push({ type: 'chorus', lines: currentChorus }); currentChorus = null; }
      } else {
        if (currentChorus) currentChorus.push(lineObj); else groups.push({ type: 'line', lines: [lineObj] });
      }
    });

    return (
      <div className="flex flex-col" style={{ gap: `${settings.lineGap ?? 8}px` }}>
        {groups.flatMap((g, gi) => {
          if (g.type === 'chorus') {
            const showBrack = settings.showSections || isEditing;
            return (
              <div key={`chorus-${gi}`} className={`pl-6 ml-4 my-2 transition-all ${showBrack ? 'border-l-4' : 'border-l-0'}`} style={{ borderLeftColor: settings.sections?.color || '#a855f7' }}>
                <div className="flex flex-col" style={{ gap: `${settings.lineGap ?? 8}px` }}>
                  {g.lines.map((l: any) => renderLine(l.text, l.originalIdx, true))}
                </div>
              </div>
            );
          }
          return g.lines.map((l: any) => renderLine(l.text, l.originalIdx, false));
        })}
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <Loader2 className="w-12 h-12 text-brand-accent animate-spin mb-4" />
      <p className="text-foreground/50 animate-pulse">Carregando música...</p>
    </div>
  );

  if (!song) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-bold mb-4">Música não encontrada</h2>
      <button onClick={() => navigate('/')} className="px-6 py-2 bg-brand-purple rounded-full">Voltar</button>
    </div>
  );

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

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans transition-colors duration-300 ${isDarkMode ? 'dark' : 'light'} ${!isDarkMode && settings.isWarmWhite ? 'warm' : ''}`}>
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-sm border-b border-foreground/5 z-50 flex items-center justify-between px-6 shadow-xl ">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (setlistId) navigate(`/setlists/${setlistId}`);
              else navigate(-1);
            }}
            className="p-2 rounded-full hover:bg-foreground/5 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg leading-tight">
                {id?.startsWith('interval_') ? (setlistSongs[currentSetlistIndex]?.interval_name || 'Pausa') : (song?.title || 'Carregando...')}
              </h1>
              {setlistId && currentSetlistIndex !== -1 && (
                <span className="text-[10px] font-black bg-brand-purple text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  {currentSetlistIndex + 1} / {setlistSongs.length}
                </span>
              )}
            </div>
            {!id?.startsWith('interval_') && <p className="text-xs text-foreground/50">{song?.artist}</p>}
          </div>
        </div>
        <div className="relative flex items-center bg-foreground/5 rounded-full p-2 border border-foreground/5 shadow-inner">
          <button onClick={() => updateSongScrollSpeed(songScrollSpeed - 1)} className="p-2 hover:bg-foreground/10 rounded-full"><Minus className="w-5 h-5" /></button>
          <div className="flex items-center gap-0 px-0">
            <span className="text-lg w-5 ml-0 text-center font-bold text-foreground/50">{songScrollSpeed}</span>
            <button onClick={() => setIsScrolling(!isScrolling)} className={`px-1 py-1 mx-1 rounded-full transition-all ${isScrolling ? 'bg-brand-accent text-white' : 'hover:bg-foreground/10 text-foreground/80'}`}>
              {isScrolling ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
            </button>
          </div>
          <button onClick={() => updateSongScrollSpeed(songScrollSpeed + 1)} className="p-2 hover:bg-foreground/10 rounded-full"><Plus className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2">

          {isEditing ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleFetchMetadata}
                disabled={isFetchingMetadata}
                className={`p-2.5 rounded-xl transition-all flex items-center gap-2 mr-2 ${isFetchingMetadata ? 'bg-brand-purple/20 text-brand-accent transition-all' : 'hover:bg-brand-purple/10 text-brand-accent'}`}
                title="BPM/TOM/CAPA"
              >
                {isFetchingMetadata ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                <span className="text-sm font-bold hidden md:inline">
                  {isFetchingMetadata ? 'Buscando...' : 'Atualizar Metadata'}
                </span>
              </button>
              <button onClick={handleUndo} disabled={history.length === 0} className={`p-2 rounded-xl transition-all ${history.length === 0 ? 'opacity-20' : 'hover:bg-foreground/5 text-brand-accent'}`}><Undo2 className="w-5 h-5" /></button>
              <button onClick={handleRedo} disabled={redoHistory.length === 0} className={`p-2 rounded-xl transition-all ${redoHistory.length === 0 ? 'opacity-20' : 'hover:bg-foreground/5 text-brand-accent'}`}><Redo2 className="w-5 h-5 mr-4" /></button>
              <button onClick={handleSaveEdit} title="Salvar" className="p-2.5 bg-green-500/20 text-green-500 rounded-full shadow-lg hover:bg-green-500 hover:text-white transition-all"><Check className="w-5 h-5" /></button>
              <button onClick={handleCancel} title="Cancelar" className="p-2.5 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"><X className="w-5 h-5" /></button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-2.5 rounded-xl hover:bg-foreground/5 transition-all text-foreground/80"><Pencil className="w-5 h-5" /></button>
          )}
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl transition-all hover:bg-foreground/5 text-foreground/80`}>
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl text-foreground/80 transition-all hover:bg-foreground/5"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/0" onClick={() => setIsSettingsOpen(false)} />
          <div className={`relative w-full max-w-sm border-l shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#0F0F1A]/95 text-white' : 'bg-white text-black'}`}>
            <div className="p-8 pb-4 flex items-center justify-between border-b border-foreground/5">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-brand-accent" />
                <h3 className="text-xl font-bold">Configurações</h3>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={handleSettingsUndo} disabled={settingsHistory.length === 0} className={`p-1.5 rounded-lg transition-all ${settingsHistory.length === 0 ? 'opacity-20' : 'hover:bg-foreground/10 text-brand-accent'}`} title="Desfazer Configuração"><Undo2 className="w-4 h-4" /></button>
                  <button onClick={handleSettingsRedo} disabled={settingsRedoHistory.length === 0} className={`p-1.5 rounded-lg transition-all ${settingsRedoHistory.length === 0 ? 'opacity-20' : 'hover:bg-foreground/10 text-brand-accent'}`} title="Refazer Configuração"><Redo2 className="w-4 h-4" /></button>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-foreground/5 rounded-full transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-4 gap-2 mb-8">
                {['showTabs', 'showSections', 'showMetadata', 'showArtwork'].map(key => (
                  <button key={key} onClick={() => updateGlobalSetting(key, !(settings as any)[key])} className={`p-3 rounded-2xl border transition-all shadow-xl flex flex-col items-center gap-2 ${(settings as any)[key] ? 'bg-brand-purple/20 border-brand-purple' : 'bg-foreground/5 border-transparent'}`}>
                    <span className="text-[10px] font-bold uppercase opacity-60">{key.replace('show', '')}</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 ${(settings as any)[key] ? 'bg-brand-purple' : 'bg-foreground/20'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all ${(settings as any)[key] ? 'translate-x-4' : ''}`} />
                    </div>
                  </button>
                ))}
              </div>

              {!isDarkMode && (
                <button
                  onClick={() => updateGlobalSetting('isWarmWhite', !settings.isWarmWhite)}
                  className={`w-full mb-8 p-4 rounded-2xl border transition-all flex items-center justify-between ${settings.isWarmWhite ? 'bg-brand-purple/10 border-brand-purple/30' : 'bg-foreground/5 border-transparent'}`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold">{t('warm_white_label')}</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-wider">{settings.isWarmWhite ? '60 100% 97%' : '0 0% 95%'}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-1 transition-all ${settings.isWarmWhite ? 'bg-brand-purple' : 'bg-foreground/20'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-all ${settings.isWarmWhite ? 'translate-x-5' : ''}`} />
                  </div>
                </button>
              )}
              <div className="flex flex-col p-4 rounded-2xl bg-foreground/5 border border-foreground/5 mb-8 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <p className="font-light">{t('global_transpose')}</p>
                    <div className="flex bg-background/50 rounded-lg p-2 mt-2 w-max border border-foreground/10">
                      <button onClick={() => updateGlobalSetting('useFlats', false)} className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all ${!settings.useFlats ? 'bg-brand-purple text-white shadow-md' : 'text-foreground/50 hover:text-foreground'}`}>#</button>
                      <button onClick={() => updateGlobalSetting('useFlats', true)} className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all ${settings.useFlats ? 'bg-brand-purple text-white shadow-md' : 'text-foreground/50 hover:text-foreground'}`}>b</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-7">
                    <button onClick={() => setTranspose(t => t - 1)} className="w-8 h-8 rounded-lg bg-foreground/10 hover:bg-brand-purple"><Minus className="w-4 h-4 ml-2" /></button>
                    <span className="w-8 text-center font-bold text-brand-accent">{currentTranspose > 0 ? `+${currentTranspose}` : currentTranspose}</span>
                    <button onClick={() => setTranspose(t => t + 1)} className="w-8 h-8 rounded-lg bg-foreground/10 hover:bg-brand-purple"><Plus className="w-4 h-4 ml-2" /></button>
                  </div>
                </div>
                <button onClick={handleDefinitiveChange} className="w-full py-2 bg-brand-purple/20 text-brand-purple hover:bg-brand-purple hover:text-white transition-all rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> {t('save_to_file')}
                </button>
              </div>
              <div className="space-y-6">
                {['title', 'artist', 'metadata', 'sections', 'observations', 'chords', 'lyrics', 'tabs'].map((el) => {
                  const s = (settings as any)[el]; if (!s) return null;
                  return (
                    <div key={el} className="p-4 rounded-2xl bg-foreground/5 border border-foreground/5 space-y-4 shadow-lg">
                      <p className="font-bold uppercase text-sm tracking-wide text-brand-accent">{t(`${el}_label`)}</p>
                      <div className="grid grid-cols-2 gap-4 justify-items-end">
                        <div className="space-y-2"><label className="text-xs uppercase opacity-40">{t('font_size')}</label><input type="range" min="10" max="80" value={s.size} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateSetting(el, 'size', parseInt(e.target.value), false)} className="w-full accent-brand-purple" /></div>
                        <div className="space-y-2"><label className="text-xs uppercase opacity-40"></label><input type="color" value={s.color} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateSetting(el, 'color', e.target.value, false)} className="w-10 h-10 p-0 bg-transparent border-none cursor-pointer" /></div>
                      </div>
                      <select value={s.font} onChange={(e) => updateSetting(el, 'font', e.target.value)} className="w-full bg-foreground/10 border-none rounded-xl px-3 py-2 text-sm">
                        {(el === 'tabs' ? tabFontOptions : fontOptions).map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              {/* --- Espaçamentos Globais --- */}
              <div className="mt-8 space-y-4 p-4 rounded-2xl bg-foreground/5 border border-foreground/5">
                <p className="font-bold uppercase text-[13px] tracking-widest text-brand-accent">{t('global_spacings')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('header_gap')}</label>
                    <input type="range" min="-20" max="20" value={settings.headerGap ?? 0} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('headerGap', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('chord_lyric_gap')}</label>
                    <input type="range" min="-20" max="10" value={settings.chordLyricGap ?? 4} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('chordLyricGap', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('line_gap')}</label>
                    <input type="range" min="-24" max="20" value={settings.lineGap ?? 8} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('lineGap', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('instrumental_gap')}</label>
                    <input type="range" min="-24" max="30" value={settings.instrumentalGap ?? (settings.lineGap ?? 0)} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('instrumentalGap', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('plain_line_gap')}</label>
                    <input type="range" min="-24" max="20" value={settings.plainLineGap ?? 0} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('plainLineGap', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('paragraph_gap')}</label>
                    <input type="range" min="-20" max="70" value={settings.paragraphGap ?? 16} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('paragraphGap', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('section_gap_top')}</label>
                    <input type="range" min="0" max="80" value={settings.sectionGapTop ?? 12} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('sectionGapTop', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('metadata_gap_top')}</label>
                    <input type="range" min="-10" max="40" value={settings.metadataGapTop ?? 8} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('metadataGapTop', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('observations_gap_top')}</label>
                    <input type="range" min="-20" max="60" value={settings.observationsGapTop ?? 0} onPointerDown={() => addSettingsToHistory(settings)} onChange={(e) => updateGlobalSetting('observationsGapTop', parseInt(e.target.value), false)} className="w-full accent-brand-purple" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-foreground/10 space-y-4">
              <button onClick={() => setIsSettingsOpen(false)} className="w-[40%] flex justify-center mx-auto py-3 bg-brand-purple/70 text-white rounded-full font-bold hover:bg-brand-purple/100 scale-100 hover:scale-105 transition-all">OK</button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={id}
          drag={setlistId ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (!setlistId) return;
            const swipeThreshold = 50;
            if (info.offset.x > swipeThreshold) handlePrevInSetlist();
            else if (info.offset.x < -swipeThreshold) handleNextInSetlist();
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="pt-24 pb-32 px-6 max-w-4xl mx-auto"
        >
          <div className="mb-8 space-y-6">
            {id?.startsWith('interval_') ? (
              /* Página de Pausa */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-40 h-40 rounded-full bg-brand-purple/10 flex items-center justify-center mb-12 shadow-2xl shadow-brand-purple/20"
                >
                  <Moon className="w-20 h-20 text-brand-purple" fill="currentColor" />
                </motion.div>
                <h2 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter uppercase">
                  {setlistSongs[currentSetlistIndex]?.interval_name || t('pause_title')}
                </h2>
                <p className="text-2xl md:text-3xl text-brand-accent font-bold mb-12 italic">
                  {t('pause_description')}
                </p>
                {setlistSongs[currentSetlistIndex]?.interval_duration && (
                  <div className="px-16 py-8 rounded-[3rem] bg-brand-purple text-white text-5xl font-black shadow-2xl shadow-brand-purple/50">
                    {setlistSongs[currentSetlistIndex]?.interval_duration} MIN
                  </div>
                )}
              </div>
            ) : isEditing ? (
              <div className="space-y-4">
                <input value={song?.title} onChange={(e) => setSong({ ...song, title: e.target.value })} className="text-5xl font-black bg-transparent w-full outline-none" />
                <input value={song?.artist} onChange={(e) => setSong({ ...song, artist: e.target.value })} className="text-3xl font-bold text-foreground/50 bg-transparent w-full outline-none" />
                <textarea
                  value={song?.observations || ''}
                  onChange={(e) => setSong({ ...song, observations: e.target.value })}
                  placeholder={t('observations_placeholder')}
                  className="w-full bg-transparent text-foreground/50  outline-none text-lg resize-none italic"
                  rows={2}
                />
              </div>
            ) : (
              <div className="flex items-start gap-8 ">
                {settings.showArtwork && song?.artwork_url && <div className="w-32 h-32 mt-2 overflow-hidden shrink-0 shadow-[0_8px_20px_rgba(0,0,0,0.5)]"><img src={song.artwork_url} className="w-full h-full object-cover" /></div>}
                <div className="flex-1 min-w-0">
                  <h1 className={`font-black tracking-tight ${settings.title.font}`} style={{ fontSize: `${settings.title.size}px`, color: getEffectiveColor(settings.title.color), marginBottom: `${settings.headerGap || 0}px`, lineHeight: '1.1' }}>{song?.title}</h1>
                  <h2 className={`font-bold opacity-80 tracking-tight ${settings.artist.font}`} style={{ fontSize: `${settings.artist.size}px`, color: getEffectiveColor(settings.artist.color), lineHeight: '1.2' }}>{song?.artist}</h2>
                  {settings.showMetadata && (song?.genre || song?.release_date || song?.album_name || song?.bpm || song?.key) && (
                    <div className={`flex flex-wrap gap-2 ${settings.metadata?.font || 'font-inter'} ${settings.metadata?.bold ? 'font-bold' : ''}`} style={{ fontSize: `${settings.metadata?.size || 10}px`, color: getEffectiveColor(settings.metadata?.color || '#ffffff'), marginTop: `${settings.metadataGapTop ?? 8}px` }}>
                      {song?.bpm && <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 text-brand-accent font-bold">{song.bpm} BPM</span>}
                      {song?.original_key && <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 text-brand-accent font-bold">{song.original_key}</span>}
                      {song?.genre && <span className="px-2 py-0.5 rounded-md bg-foreground/5 opacity-60">{song.genre}</span>}
                      {song?.release_date && <span className="px-2 py-0.5 rounded-md bg-foreground/5 opacity-60">{new Date(song.release_date).getFullYear()}</span>}
                      {song?.album_name && <span className="px-2 py-0.5 rounded-md bg-foreground/5 opacity-60 line-clamp-1">{song.album_name}</span>}
                    </div>
                  )}
                  {song?.observations && (
                    <div className={`mt-0 ${isDarkMode ? 'bg-white/10' : 'bg-foreground/10'} pl-4 pr-4 w-fit ${settings.observations.font} ${settings.observations.italic ? 'italic' : ''}`} style={{ fontSize: `${settings.observations.size}px`, color: getEffectiveColor(settings.observations.color), marginTop: `${settings.observationsGapTop ?? 0}px` }}>
                      {song.observations}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="chord-sheet-container">
            {!id?.startsWith('interval_') && isEditing && (
              <div className="mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex gap-2 p-1 bg-foreground/5 rounded-2xl w-fit">
                    <button onClick={() => { setEditMode('live'); setIsSplitMode(false); }} className={`px-6 py-2 rounded-xl font-bold transition-all ${editMode === 'live' && !isSplitMode ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40 hover:text-foreground/60'}`}>Edição Visual</button>
                    <button onClick={() => { setEditMode('classic'); setIsSplitMode(false); }} className={`px-6 py-2 rounded-xl font-bold transition-all ${editMode === 'classic' && !isSplitMode ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40 hover:text-foreground/60'}`}>Modo Texto</button>
                    <button onClick={() => { setEditMode('live'); setIsSplitMode(true); }} className={`px-6 py-2 rounded-xl font-bold transition-all ${isSplitMode ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40 hover:text-foreground/60'}`}>Modo Split</button>
                  </div>
                </div>
                <p className="mt-4 text-sm text-foreground/50 italic max-w-2xl leading-relaxed mb-10">
                  {isSplitMode ? 'O Modo Split permite editar visualmente à esquerda e ver o código ChordPro à direita simultaneamente.' : (editMode === 'live' ? t('visual_edition_instruction') : t('classic_mode_instruction'))}
                </p>
              </div>
            )}

            {!id?.startsWith('interval_') && (isEditing && isSplitMode ? (
              <div className="grid grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <h3 className="text-xs uppercase font-black tracking-widest text-brand-purple opacity-50 mb-4">Visual</h3>
                  <div key={revision} className="leading-relaxed editing-mode cursor-text">
                    {renderEditorContent()}
                  </div>
                </div>
                <div className="space-y-4 h-full">
                  <h3 className="text-xs uppercase font-black tracking-widest text-brand-purple opacity-50 mb-4">ChordPro</h3>
                  <textarea
                    value={editedContent}
                    onChange={handleTextareaChange}
                    onContextMenu={handleTextareaContextMenu}
                    className="w-full min-h-[60vh] h-full bg-foreground/5 p-8 rounded-3xl font-mono outline-none border border-foreground/10 text-sm"
                  />
                </div>
              </div>
            ) : isEditing && editMode === 'classic' ?
              <textarea value={editedContent} onChange={handleTextareaChange} onContextMenu={handleTextareaContextMenu} className="w-full min-h-[60vh] bg-foreground/5 p-8 rounded-3xl font-mono outline-none border border-foreground/10" />
              :
              <div key={revision} className={`leading-relaxed ${isEditing ? 'editing-mode cursor-text' : ''}`}>
                {renderEditorContent()}
              </div>
            )}
          </div>

          {!id?.startsWith('interval_') && (
            <ChordDictionary 
              chords={extractedChords}
              customVoicings={song?.settings?.custom_voicings || {}}
              onSaveVoicing={handleSaveVoicing}
            />
          )}
        </motion.main>
      </AnimatePresence>

      {contextMenu && isEditing && (
        <div className="fixed z-[100] bg-background/95 backdrop-blur-xl border border-foreground/10 shadow-2xl rounded-2xl p-2 min-w-[240px] animate-in fade-in zoom-in duration-200"
          style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(null)} onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-2 text-[10px] font-bold text-foreground/40 uppercase tracking-widest border-b border-foreground/5 mb-1">Opções</div>
          <button onClick={() => { addChordToLine(contextMenu.lineIdx, contextMenu.charOffset); setContextMenu(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-brand-purple/10 text-foreground/80 hover:text-brand-purple">
            <div className="p-2 rounded-lg bg-brand-purple/5"><PlusCircle className="w-4 h-4" /></div><span className="font-medium">Inserir Acorde Aqui</span>
          </button>

          <div className="px-3 py-2 mt-2 text-[10px] font-bold text-foreground/40 uppercase tracking-widest border-b border-foreground/5 mb-1">Símbolos de Compasso</div>
          <div className="grid grid-cols-7 gap-1 px-2 pb-2 mt-2">
            {['|', '│', 'ǁ', '║', '|:', ':|', '-'].map(symbol => (
              <button key={symbol} onClick={() => { addChordToLine(contextMenu.lineIdx, contextMenu.charOffset, symbol); setContextMenu(null); }} className="flex items-center justify-center py-2 rounded-lg bg-foreground/5 hover:bg-brand-purple/10 hover:text-brand-purple transition-all font-mono font-bold">
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}
      {contextMenu && <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />}
      
      <AnimatePresence>
        {selectedChordForEdit && (
          <VoicingEditorModal
            chordName={selectedChordForEdit}
            initialVoicing={song?.settings?.custom_voicings?.[selectedChordForEdit] || getDefaultVoicing(selectedChordForEdit)}
            onSave={(voicing) => handleSaveVoicing(selectedChordForEdit, voicing)}
            onClose={() => setSelectedChordForEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

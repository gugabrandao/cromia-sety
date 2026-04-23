import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Settings, Play, Pause,
  Loader2, Minus, Plus, Check, Pencil, X, Sun, Moon, Music2,
  ChevronLeft, ChevronRight, Undo2, Redo2, PlusCircle, Sparkles
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { fetchSongMetadata } from '../services/spotifyService';

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
      <div className="min-h-[1.5em] py-1" onContextMenu={(e) => handleContextMenu(e, originalIdx, isInsideChorus, 0)}>
        <span className={`${fontClass} ${settings.lyrics.italic ? 'italic' : ''} ${settings.lyrics.bold ? 'font-bold' : ''}`}
          style={{ fontSize: `${fontSize}px`, color }}>
          {line}
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-h-[1.5em] py-1 group/line transition-all px-4 -mx-4 rounded-xl"
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

export default function SongView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toggleTheme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  // --- 1. States ---
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const [currentTranspose, setTranspose] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'live' | 'classic'>('live');
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

  const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // --- 2. Configuration & Settings ---
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('musicbox_global_settings');
    const defaults = {
      title: { size: 60, color: '#1a1a1a', font: 'font-outfit' },
      artist: { size: 24, color: '#f97316', font: 'font-inter' },
      observations: { size: 16, color: '#4b5563', font: 'font-inter', italic: true },
      sections: { size: 20, color: '#f97316', font: 'font-outfit', italic: false, bold: true },
      chords: { size: 18, color: '#f97316', font: 'font-mono-custom' },
      lyrics: { size: 18, color: '#1a1a1a', font: 'font-inter' },
      tabs: { size: 14, color: '#1a1a1a', font: 'font-courier' },
      metadata: { size: 10, color: '#6b7280', font: 'font-inter', bold: true },
      observationsBg: '#f97316',
      headerGap: -4,
      chordLyricGap: 0,
      lineGap: 12,
      sectionGapTop: 24,
      sectionGapBottom: 8,
      showTabs: true,
      showSections: true,
      showMetadata: true,
      showArtwork: true,
      isDarkMode: true,
      scrollSpeed: 5,
      useFlats: false,
      metadataGapTop: 4,
      isWarmWhite: true
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  useEffect(() => {
    localStorage.setItem('musicbox_global_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (element: string, key: string, value: any) => {
    addSettingsToHistory(settings);
    setSettings((prev: any) => ({
      ...prev,
      [element]: typeof prev[element as keyof typeof prev] === 'object'
        ? { ...(prev[element as keyof typeof prev] as any), [key]: value }
        : value
    }));
  };

  const updateGlobalSetting = (key: string, value: any) => {
    addSettingsToHistory(settings);
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

    try {
      const data = await fetchSongMetadata(song.title, song.artist);

      if (data) {
        setSong((prev: any) => ({
          ...prev,
          bpm: data.bpm || prev.bpm,
          key: data.key || prev.key,
          time_signature: data.time_signature || prev.time_signature,
          artwork_url: data.artwork_url || prev.artwork_url,
          album_name: data.album_name || prev.album_name,
          release_date: data.release_date || prev.release_date,
        }));
        alert("Dados encontrados e atualizados!");
      } else {
        alert("Não encontramos dados para esta música no Spotify.");
      }
    } catch (error) {
      alert("Erro ao buscar dados no Spotify. Verifique suas credenciais.");
    } finally {
      document.title = originalTitle;
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
    return /^[A-G][b#]?(m|min|maj|M|dim|aug|sus|add|ø|º|7M|7|6|5|4|2|9|11|13|\+|\-|\(|\))*(\/[A-G][b#]?)?$/.test(token.trim());
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

  const addChordToLine = (lineIdx: number, charOffset: number) => {
    const prevContent = latestContent.current;
    const lines = prevContent.split('\n');
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    addToHistory(prevContent);
    const line = lines[lineIdx];
    const newLine = line.slice(0, charOffset) + '[]' + line.slice(charOffset);
    lines[lineIdx] = newLine;
    setEditedContent(lines.join('\n'));
  };

  const handleContextMenu = (e: React.MouseEvent, lineIdx: number, isChorus: boolean, charOffset: number = 0) => {
    if (!isEditing) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, lineIdx, isChorus, charOffset });
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

      return (
        <div key={`chord-${originalIdx}`} className={`flex flex-wrap items-end min-h-[3em] group/line transition-all ${isEditing ? 'px-4 -mx-4 rounded-xl' : ''}`} onContextMenu={(e) => {
          if (!isEditing) return;
          const cleanLineLength = line.replace(/\[.*?\]/g, '').length;
          handleContextMenu(e, originalIdx, isInsideChorus, cleanLineLength);
        }}>
          {merged.map((tok, idx) => (
            <span key={`tok-${originalIdx}-${idx}`} className="inline-flex flex-col items-start relative group/chord pt-4">
              <div className={`h-[1.5em] flex items-end relative w-full ${tok.hasChord ? 'pr-2' : ''}`} style={{ marginBottom: `${settings.chordLyricGap ?? 4}px` }}>
                {isEditing && tok.hasChord && (
                  <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveChord(originalIdx, tok.partIdx, 'left'); }} className="absolute right-full bottom-[2px] mr-1 opacity-0 group-hover/chord:opacity-100 transition-all p-1 hover:bg-brand-purple/30 rounded-md bg-brand-purple/10 z-10 shrink-0">
                    <ChevronLeft className="w-4 h-4 text-brand-accent" />
                  </button>
                )}
                <span contentEditable={isEditing} suppressContentEditableWarning spellCheck="false"
                  onContextMenu={(e) => { if (!isEditing) return; e.stopPropagation(); handleContextMenu(e, originalIdx, isInsideChorus, tok.startOffset); }}
                  onBlur={(e) => handlePartChange(originalIdx, tok.partIdx, e.currentTarget.innerText.trim(), true)}
                  className={`whitespace-pre min-h-[1.2em] transition-all ${tok.hasChord ? `font-bold ${settings.chords.font}` : ''} ${isEditing && tok.hasChord ? 'outline-none min-w-[1ch] rounded outline outline-1 outline-dashed outline-brand-purple/30 focus:outline-brand-purple focus:outline-solid' : ''}`}
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
      setLoading(true);
      const { data, error } = await (supabase.from('musicbox_setlist') as any).select('*').eq('id', id).single();
      if (data) {
        setSong(data);
        setEditedContent(data.content_raw || '');
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
    if (!song || !id) return;
    const timeout = setTimeout(async () => {
      try { await (supabase.from('musicbox_setlist') as any).update({ settings }).eq('id', id); } catch (err) { console.error('Auto-save settings error:', err); }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [settings, id, song]);

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
        const pixelsPerSecond = speedMap[settings.scrollSpeed || 5] || 60;
        exactScrollY += pixelsPerSecond * (deltaTime / 1000);
        window.scrollTo(0, exactScrollY);
      }
      lastTimeRef.current = time;
      scrollRef.current = requestAnimationFrame(scrollLoop);
    };
    scrollRef.current = requestAnimationFrame(scrollLoop);
    return () => { if (scrollRef.current) cancelAnimationFrame(scrollRef.current); };
  }, [isScrolling, settings.scrollSpeed]);

  // --- 7. Main Handlers ---
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
    if (!window.confirm("Essa ação vai reescrever o arquivo original permanentemente. Deseja continuar?")) return;
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
      const { error } = await (supabase.from('musicbox_setlist') as any).update({ content_raw: newContent }).eq('id', id);
      if (error) throw error;
      setSong({ ...song, content_raw: newContent });
      setEditedContent(newContent);
      setTranspose(0);
      alert("Salvo com sucesso!");
    } catch (error) { console.error('Error applying definitive change:', error); }
  };

  // --- 8. Render Logic ---
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
            <button onClick={() => setSettings({ ...settings, scrollSpeed: Math.max(1, (settings.scrollSpeed || 5) - 1) })} className="p-2 hover:bg-foreground/10 rounded-lg"><Minus className="w-4 h-4" /></button>
            <button onClick={() => setIsScrolling(!isScrolling)} className={`px-6 py-2 mx-1 rounded-lg transition-all ${isScrolling ? 'bg-brand-accent text-white' : 'hover:bg-foreground/10 text-foreground/80'}`}>
              {isScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button onClick={() => setSettings({ ...settings, scrollSpeed: Math.min(10, (settings.scrollSpeed || 5) + 1) })} className="p-2 hover:bg-foreground/10 rounded-lg"><Plus className="w-4 h-4" /></button>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button onClick={handleFetchMetadata} className="p-2.5 rounded-xl hover:bg-brand-purple/10 text-brand-accent transition-all flex items-center gap-2 mr-2" title="Buscar dados no Spotify"><Sparkles className="w-5 h-5" /> <span className="text-xs font-bold hidden md:inline">Auto-Info</span></button>
              <button onClick={handleUndo} disabled={history.length === 0} className={`p-2 rounded-xl transition-all ${history.length === 0 ? 'opacity-20' : 'hover:bg-foreground/5 text-brand-accent'}`}><Undo2 className="w-5 h-5" /></button>
              <button onClick={handleRedo} disabled={redoHistory.length === 0} className={`p-2 rounded-xl transition-all ${redoHistory.length === 0 ? 'opacity-20' : 'hover:bg-foreground/5 text-brand-accent'}`}><Redo2 className="w-5 h-5" /></button>
              <button onClick={handleSaveEdit} className="px-6 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 hover:bg-green-600 transition-all">Salvar</button>
              <button onClick={handleCancel} className="px-4 py-2 bg-red-500/10 text-red-500 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all"> Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-2.5 rounded-xl hover:bg-foreground/5 transition-all text-foreground/60"><Pencil className="w-5 h-5" /></button>
          )}
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl bg-brand-purple text-white shadow-lg"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsSettingsOpen(false)} />
          <div className={`relative w-full max-w-sm border-l shadow-2xl flex flex-col ${isDarkMode ? 'bg-[#0F0F1A]/95 text-white' : 'bg-white text-black'}`}>
            <div className="p-8 pb-4 flex items-center justify-between border-b border-foreground/5">
              <div className="flex items-center gap-3"><Settings className="w-5 h-5 text-brand-accent" /><h3 className="text-xl font-bold">Configurações</h3></div>
              <button onClick={() => setIsSettingsOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-4 gap-2 mb-8">
                {['showTabs', 'showSections', 'showMetadata', 'showArtwork'].map(key => (
                  <button key={key} onClick={() => updateGlobalSetting(key, !(settings as any)[key])} className={`p-3 rounded-2xl border transition-all shadow-xl flex flex-col items-center gap-2 ${(settings as any)[key] ? 'bg-brand-purple/20 border-brand-purple' : 'bg-foreground/5 border-transparent'}`}>
                    <span className="text-[10px] font-bold uppercase opacity-60">{key.replace('show', '')}</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 ${(settings as any)[key] ? 'bg-brand-purple' : 'bg-foreground/20'}`}><div className={`w-3 h-3 bg-white rounded-full transition-all ${(settings as any)[key] ? 'translate-x-4' : ''}`} /></div>
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-xs uppercase opacity-40">{t('font_size')}</label><input type="range" min="10" max="80" value={s.size} onChange={(e) => updateSetting(el, 'size', parseInt(e.target.value))} className="w-full accent-brand-purple" /></div>
                        <div className="space-y-2"><label className="text-xs uppercase opacity-40">{t('color')}</label><input type="color" value={s.color} onChange={(e) => updateSetting(el, 'color', e.target.value)} className="w-full h-8 p-0 bg-transparent border-none cursor-pointer rounded-lg" /></div>
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
                    <input type="range" min="-20" max="20" value={settings.headerGap ?? 0} onChange={(e) => updateGlobalSetting('headerGap', parseInt(e.target.value))} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('chord_lyric_gap')}</label>
                    <input type="range" min="-10" max="10" value={settings.chordLyricGap ?? 4} onChange={(e) => updateGlobalSetting('chordLyricGap', parseInt(e.target.value))} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('line_gap')}</label>
                    <input type="range" min="0" max="40" value={settings.lineGap ?? 8} onChange={(e) => updateGlobalSetting('lineGap', parseInt(e.target.value))} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('section_gap_top')}</label>
                    <input type="range" min="0" max="60" value={settings.sectionGapTop ?? 12} onChange={(e) => updateGlobalSetting('sectionGapTop', parseInt(e.target.value))} className="w-full accent-brand-purple" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase opacity-40">{t('metadata_gap_top')}</label>
                    <input type="range" min="-10" max="40" value={settings.metadataGapTop ?? 8} onChange={(e) => updateGlobalSetting('metadataGapTop', parseInt(e.target.value))} className="w-full accent-brand-purple" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-foreground/10 space-y-4">
              <div className="flex gap-2">
                <button onClick={handleSettingsUndo} disabled={settingsHistory.length === 0} className="flex-1 py-4 bg-brand-purple/10 text-brand-accent rounded-2xl font-bold flex items-center justify-center gap-2"><Undo2 className="w-4 h-4" /> Desfazer</button>
                <button onClick={handleSettingsRedo} disabled={settingsRedoHistory.length === 0} className="flex-1 py-4 bg-brand-purple/10 text-brand-accent rounded-2xl font-bold flex items-center justify-center gap-2"><Redo2 className="w-4 h-4" /> Refazer</button>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-brand-purple text-white rounded-2xl font-bold">OK</button>
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
              <textarea
                value={song.observations || ''}
                onChange={(e) => setSong({ ...song, observations: e.target.value })}
                placeholder={t('observations_placeholder')}
                className="w-full bg-transparent border-b border-white/10 outline-none text-sm opacity-60 italic resize-none"
                rows={2}
              />
            </div>
          ) : (
            <div className="flex items-start gap-8 ">
              {settings.showArtwork && song.artwork_url && <div className="w-32 h-32 mt-2 overflow-hidden shrink-0 shadow-[0_8px_20px_rgba(0,0,0,0.5)]"><img src={song.artwork_url} className="w-full h-full object-cover" /></div>}
              <div className="flex-1 min-w-0">
                <h1 className={`font-black tracking-tighter ${settings.title.font}`} style={{ fontSize: `${settings.title.size}px`, color: getEffectiveColor(settings.title.color), marginBottom: `${settings.headerGap || 0}px`, lineHeight: '1.1' }}>{song.title}</h1>
                <h2 className={`font-bold opacity-80 tracking-tight ${settings.artist.font}`} style={{ fontSize: `${settings.artist.size}px`, color: getEffectiveColor(settings.artist.color), lineHeight: '1.2' }}>{song.artist}</h2>
                {settings.showMetadata && (song.genre || song.release_date || song.album_name || song.bpm || song.key) && (
                  <div className={`flex flex-wrap gap-2 ${settings.metadata?.font || 'font-inter'} ${settings.metadata?.bold ? 'font-bold' : ''}`} style={{ fontSize: `${settings.metadata?.size || 10}px`, color: getEffectiveColor(settings.metadata?.color || '#ffffff'), marginTop: `${settings.metadataGapTop ?? 8}px` }}>
                    {song.bpm && <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 text-brand-accent font-bold">{song.bpm} BPM</span>}
                    {song.key && <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 text-brand-accent font-bold">{song.key}</span>}
                    {song.genre && <span className="px-2 py-0.5 rounded-md bg-foreground/5 opacity-60">{song.genre}</span>}
                    {song.release_date && <span className="px-2 py-0.5 rounded-md bg-foreground/5 opacity-60">{new Date(song.release_date).getFullYear()}</span>}
                    {song.album_name && <span className="px-2 py-0.5 rounded-md bg-foreground/5 opacity-60 line-clamp-1">{song.album_name}</span>}
                  </div>
                )}
                {song.observations && (
                  <div className={`mt-0 ${isDarkMode ? 'bg-white/10' : 'bg-foreground/10'} pl-4 pr-4 w-fit ${settings.observations.font} ${settings.observations.italic ? 'italic' : ''}`} style={{ fontSize: `${settings.observations.size}px`, color: getEffectiveColor(settings.observations.color) }}>
                    {song.observations}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="chord-sheet-container">
          {isEditing && (
            <div className="flex gap-2 mb-6 p-1 bg-foreground/5 rounded-2xl w-fit">
              <button onClick={() => setEditMode('live')} className={`px-6 py-2 rounded-xl ${editMode === 'live' ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40'}`}>Edição Visual</button>
              <button onClick={() => setEditMode('classic')} className={`px-6 py-2 rounded-xl ${editMode === 'classic' ? 'bg-brand-purple text-white shadow-lg' : 'text-foreground/40'}`}>Modo Texto</button>
            </div>
          )}
          {isEditing && editMode === 'classic' ? (
            <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full min-h-[60vh] bg-foreground/5 p-8 rounded-3xl font-mono outline-none border border-foreground/10" />
          ) : (
            <div key={revision} className={`leading-relaxed ${isEditing ? 'editing-mode cursor-text' : ''}`}>
              {(() => {
                const lines = (isEditing ? editedContent : (song.content_raw || '')).split('\n');
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
              })()}
            </div>
          )}
        </div>
      </main>

      {contextMenu && isEditing && (
        <div className="fixed z-[100] bg-background/95 backdrop-blur-xl border border-foreground/10 shadow-2xl rounded-2xl p-2 min-w-[240px] animate-in fade-in zoom-in duration-200"
          style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(null)} onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-2 text-[10px] font-bold text-foreground/40 uppercase tracking-widest border-b border-foreground/5 mb-1">Opções</div>
          <button onClick={() => { addChordToLine(contextMenu.lineIdx, contextMenu.charOffset); setContextMenu(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-brand-purple/10 text-foreground/80 hover:text-brand-purple">
            <div className="p-2 rounded-lg bg-brand-purple/5"><PlusCircle className="w-4 h-4" /></div><span className="font-medium">Inserir Acorde Aqui</span>
          </button>
        </div>
      )}
      {contextMenu && <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />}
    </div>
  );
}

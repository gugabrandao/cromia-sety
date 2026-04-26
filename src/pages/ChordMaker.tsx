import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SVGuitarChord } from 'svguitar';
import { Chord as TonalChord, Note } from 'tonal';
import {
  Trash2, Download,
  ChevronRight, ChevronLeft,
  Music, Info, Check, Save,
  Settings2, Edit3
} from 'lucide-react';

// Tuning Presets
const TUNING_PRESETS = [
  { name: 'Standard', notes: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'] },
  { name: 'Drop D', notes: ['E4', 'B3', 'G3', 'D3', 'A2', 'D2'] },
  { name: 'Open D', notes: ['D4', 'A3', 'F#3', 'D3', 'A2', 'D2'] },
  { name: 'Open G', notes: ['D4', 'B3', 'G3', 'D3', 'G2', 'D2'] },
  { name: 'DADGAD', notes: ['D4', 'A3', 'G3', 'D3', 'A2', 'D2'] },
  { name: 'Half Step Down', notes: ['Eb4', 'Bb3', 'Gb3', 'Db3', 'Ab2', 'Eb2'] },
  { name: 'Whole Step Down', notes: ['D4', 'A3', 'F3', 'C3', 'G2', 'D2'] },
];

const STRING_NUMS = [1, 2, 3, 4, 5, 6];
const HOUSE_NUMS = [1, 2, 3, 4, 5];

interface Finger {
  string: number;
  fret: number;
  finger?: string | number;
}

interface Barre {
  fret: number;
  fromString: number;
  toString: number;
  finger?: string | number;
}

export default function ChordMaker() {
  const { t } = useTranslation();
  const [fingers, setFingers] = useState<Finger[]>([]);
  const [mutedStrings, setMutedStrings] = useState<number[]>([]);
  const [baseFret, setBaseFret] = useState(1);
  const [barres, setBarres] = useState<Barre[]>([]);
  const [tuning, setTuning] = useState<string[]>(TUNING_PRESETS[0].notes);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [detectedChords, setDetectedChords] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  // Drag state for barre
  const [dragStart, setDragStart] = useState<{ string: number, fret: number, removing?: Barre } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ fret: number, from: number, to: number } | null>(null);

  // Note Recognition Logic - Robust "Highest Fret Wins"
  useEffect(() => {
    const activeNotes: string[] = [];

    [6, 5, 4, 3, 2, 1].forEach(stringNum => {
      if (mutedStrings.includes(stringNum)) return;

      const possibleFrets: number[] = [0];

      // 1. Check fingers
      const finger = fingers.find(f => f.string === stringNum);
      if (finger) possibleFrets.push(baseFret + finger.fret - 1);

      // 2. Check established barres
      barres.forEach(b => {
        if (stringNum <= b.fromString && stringNum >= b.toString) {
          possibleFrets.push(baseFret + b.fret - 1);
        }
      });

      // 3. Check CURRENT DRAG preview
      if (dragPreview && stringNum <= dragPreview.from && stringNum >= dragPreview.to) {
        possibleFrets.push(baseFret + dragPreview.fret - 1);
      }

      const fret = Math.max(...possibleFrets);

      const tuningNote = tuning[stringNum - 1];
      const tuningMidi = Note.midi(tuningNote) || 0;
      const midi = tuningMidi + fret;

      const name = Note.fromMidi(midi);
      activeNotes.push(Note.pitchClass(name));
    });

    if (activeNotes.length >= 2) {
      const detected = TonalChord.detect(activeNotes);
      const cleaned = detected.map(name => {
        return name.replace(/M(?=\/|$)/, '').replace(/Major(?=\/|$)/, '');
      });
      setDetectedChords(cleaned);
    } else {
      setDetectedChords([]);
    }
  }, [fingers, mutedStrings, barres, dragPreview, baseFret, tuning]);

  // SVGuitar Preview
  useEffect(() => {
    if (chartRef.current) {
      try {
        chartRef.current.innerHTML = '';
        const chart = new SVGuitarChord(chartRef.current);

        const activeFingers: any[] = [];

        STRING_NUMS.forEach(s => {
          if (mutedStrings.includes(s)) {
            activeFingers.push([s, 'x']);
          } else {
            const f = fingers.find(fin => fin.string === s);
            if (f) {
              // SVGuitar supports [string, fret, label]
              activeFingers.push([s, f.fret, f.finger?.toString() || '']);
            } else {
              const isBarre = barres.some(b => s <= b.fromString && s >= b.toString);
              if (!isBarre) {
                activeFingers.push([s, 0]);
              }
            }
          }
        });

        chart.configure({
          title: customTitle || detectedChords[0] || '?',
          style: 'normal' as any,
          fingerSize: 0.7,
          color: '#ffffff',
          titleColor: '#fffceb',
          fingerTextColor: '#000000',
          fretColor: '#ffffff50',
          stringColor: '#ffffff50',
          fretLabelColor: '#ffffff50',
          barreChordRadius: 1,
          barreChordStyle: 'rectangle' as any,
          fontFamily: 'Outfit, sans-serif'
        })
          .chord({
            fingers: activeFingers,
            barres: barres.map(b => ({
              fromString: b.fromString,
              toString: b.toString,
              fret: b.fret,
              text: b.finger?.toString() || ''
            })),
            position: baseFret
          })
          .draw();

        // Force white fill for barres in the SVG
        const barreElements = chartRef.current.querySelectorAll('.barre');
        barreElements.forEach(el => {
          el.setAttribute('fill', '#ffffff');
          el.setAttribute('stroke', '#ffffff');
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [fingers, mutedStrings, baseFret, barres, detectedChords, customTitle]);

  const toggleFret = (string: number, fret: number, isCtrl: boolean = false) => {
    // Check if clicking on an existing barre position
    const existingBarre = barres.find(b => b.fret === fret && string <= b.fromString && string >= b.toString);
    if (existingBarre) {
      if (isCtrl) {
        setBarres(barres.filter(b => b !== existingBarre));
        setCustomTitle('');
        return;
      }

      const cycle = [undefined, 1, 2, 3, 4, 'T', 'REMOVE'];
      const currentIndex = cycle.indexOf(existingBarre.finger as any);
      const nextValue = cycle[currentIndex + 1];

      if (nextValue === 'REMOVE') {
        setBarres(barres.filter(b => b !== existingBarre));
      } else {
        setBarres(barres.map(b => b === existingBarre ? { ...b, finger: nextValue as any } : b));
      }
      setCustomTitle('');
      return;
    }

    const existing = fingers.find(f => f.string === string && f.fret === fret);
    setCustomTitle(''); // Reset title on interaction

    if (existing) {
      if (isCtrl) {
        setFingers(fingers.filter(f => !(f.string === string && f.fret === fret)));
        return;
      }
      // Cycle: null -> 1 -> 2 -> 3 -> 4 -> T -> remove
      const cycle = [undefined, 1, 2, 3, 4, 'T', 'REMOVE'];
      const currentIndex = cycle.indexOf(existing.finger as any);
      const nextValue = cycle[currentIndex + 1];

      if (nextValue === 'REMOVE') {
        setFingers(fingers.filter(f => !(f.string === string && f.fret === fret)));
      } else {
        setFingers(fingers.map(f => (f.string === string && f.fret === fret) ? { ...f, finger: nextValue as any } : f));
      }
    } else if (!isCtrl) {
      // Add a dot without number
      setFingers([...fingers.filter(f => f.string !== string), { string, fret }]);
      setMutedStrings(mutedStrings.filter(s => s !== string));
    }
  };

  const toggleMute = (string: number) => {
    setCustomTitle(''); // Reset title on mute toggle
    if (mutedStrings.includes(string)) {
      setMutedStrings(mutedStrings.filter(s => s !== string));
    } else {
      setMutedStrings([...mutedStrings, string]);
      setFingers(fingers.filter(f => f.string !== string));
      // Remove barres that cover this string?
      setBarres(barres.filter(b => !(string <= b.fromString && string >= b.toString)));
    }
  };

  const handleTuningChange = (stringIdx: number, note: string) => {
    const newTuning = [...tuning];
    newTuning[stringIdx] = note.toUpperCase() + (tuning[stringIdx].match(/[0-9]/)?.[0] || '2');
    setTuning(newTuning);
    setCustomTitle(''); // Reset title on tuning change
  };

  const onMouseDown = (string: number, fret: number) => {
    const existingBarre = barres.find(b => b.fret === fret && string <= b.fromString && string >= b.toString);
    setDragStart({ string, fret, removing: existingBarre });
  };

  const onMouseEnter = (string: number, fret: number) => {
    if (!dragStart) return;
    if (dragStart.fret === fret && dragStart.string !== string) {
      setDragPreview({
        fret,
        from: Math.max(dragStart.string, string),
        to: Math.min(dragStart.string, string)
      });
    } else {
      setDragPreview(null);
    }
  };

  const onMouseUp = (string: number, fret: number, e: React.MouseEvent) => {
    if (!dragStart) return;

    if (dragPreview) {
      setBarres([...barres.filter(b => b.fret !== fret), {
        fret: dragPreview.fret,
        fromString: dragPreview.from,
        toString: dragPreview.to
      }]);
      // Cleanup fingers and mutes in range
      setFingers(fingers.filter(f => f.fret !== fret || f.string > dragPreview.from || f.string < dragPreview.to));
      setMutedStrings(mutedStrings.filter(s => !(s <= dragPreview.from && s >= dragPreview.to)));
      setCustomTitle('');
    } else if (dragStart.removing && dragStart.string === string && dragStart.fret === fret) {
      // Use the cycle logic
      toggleFret(string, fret, e.ctrlKey);
    } else if (dragStart.string === string && dragStart.fret === fret) {
      toggleFret(string, fret, e.ctrlKey);
    }

    setDragStart(null);
    setDragPreview(null);
  };

  return (
    <div className="min-h-screen bg-background pt-12 pb-24 px-8 flex flex-col items-center select-none">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl flex flex-col items-center mb-12 text-center"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-brand-purple/20 rounded-2xl">
            <Music className="w-8 h-8 text-brand-accent" />
          </div>
          <h1 className="text-6xl font-black tracking-tight text-white">Chord Maker</h1>
        </div>
        <p className="text-white/40 text-lg font-medium max-w-2xl uppercase tracking-widest">
          Biblioteca de acordes
        </p>
      </motion.div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

        {/* Left Side: Tuning & Settings */}
        <div className="lg:col-span-3 flex flex-col gap-6 order-2 lg:order-1">
          {/* Detected Names */}
          <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-xl">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Info className="w-4 h-4" /> Acordes Possíveis
            </h3>

            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {detectedChords.length > 0 ? (
                  detectedChords.map((chord, idx) => (
                    <motion.div
                      key={chord}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => setCustomTitle(chord)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${chord === (customTitle || detectedChords[0]) ? 'bg-brand-purple border-brand-purple shadow-lg shadow-brand-purple/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                    >
                      <span className="text-xl font-bold text-white">{chord}</span>
                      {chord === (customTitle || detectedChords[0]) && <Check className="w-5 h-5 text-white/50" />}
                    </motion.div>
                  ))
                ) : (
                  <div className="py-12 text-center text-white/20 italic text-sm">
                    Monte um acorde...
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <label className="text-sm font-bold text-white/20 uppercase tracking-widest mb-2 block">Título Personalizado</label>
              <div className="relative group">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ex: Bm7(11)"
                  className="placeholder:text-foreground/10 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand-purple transition-all"
                />
                <Edit3 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-brand-purple" />
              </div>
            </div>
          </div>

          {/* Tuning Presets Only */}
          <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-xl">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Afinações Especiais
            </h3>

            <select
              onChange={(e) => {
                const p = TUNING_PRESETS.find(pr => pr.name === e.target.value);
                if (p) {
                  setTuning(p.notes);
                  setCustomTitle('');
                }
              }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand-purple transition-all appearance-none cursor-pointer"
            >
              {TUNING_PRESETS.map(p => (
                <option key={p.name} value={p.name} className="bg-zinc-900">{p.name}</option>
              ))}
            </select>
          </div>

          <button className="w-full py-5 bg-white/5 border border-white/5 text-white/50 font-bold rounded-[2rem] flex items-center justify-center gap-3 hover:bg-white/10 transition-all group">
            <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> Salvar na Biblioteca
          </button>
        </div>

        {/* Center: Interactive Fretboard */}
        <div className="lg:col-span-6 flex flex-col items-center order-1 lg:order-2" onMouseLeave={() => { setDragStart(null); setDragPreview(null); }}>
          <div className="relative w-full max-w-[450px] aspect-[1/1.8] bg-[#141414] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">

            {/* Tuning Inputs at the top of the neck */}
            <div className="h-20 flex items-center justify-around px-12 bg-black/60 border-b border-white/10">
              {[6, 5, 4, 3, 2, 1].map(s => (
                <div key={s} className="flex flex-col items-center w-10">
                  <input
                    type="text"
                    maxLength={2}
                    value={tuning[s - 1].replace(/[0-9]/g, '')}
                    onChange={(e) => handleTuningChange(s - 1, e.target.value)}
                    className="w-10 bg-white/5 border-none text-center text-white/80 font-bold text-xl outline-none hover:bg-white/20 focus:bg-brand-purple/20 transition-all rounded-md uppercase"
                  />
                </div>
              ))}
            </div>

            {/* Open/Mute Header */}
            <div className="h-20 bg-black/40 flex items-center justify-around px-12 border-b border-white/5 relative z-20">
              {[6, 5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  onClick={() => toggleMute(s)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm !text-white/70 font-semibold transition-all ${mutedStrings.includes(s) ? 'bg-black text-white shadow-lg shadow-red-500/5' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                >
                  {mutedStrings.includes(s) ? 'X' : 'O'}
                </button>
              ))}
            </div>

            {/* The Neck */}
            <div className="flex-1 relative flex flex-col">
              <div className="absolute inset-0 flex justify-around px-12 pointer-events-none">
                {[6, 5, 4, 3, 2, 1].map(s => (
                  <div key={s} className="w-[3px] h-full bg-gradient-to-r from-white/10 via-white/30 to-white/10 relative shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                ))}
              </div>

              <div className="flex-1 flex flex-col">
                {HOUSE_NUMS.map(h => (
                  <div key={h} className="relative flex-1 border-b-[4px] border-white/5 last:border-0 flex">
                    <span className="absolute -left-10 top-1/2 -translate-y-1/2 text-xs font-black text-white/20">{(baseFret + h - 1).toString().padStart(2, '0')}</span>

                    <div className="flex-1 flex justify-around px-12 relative">
                      {/* Interactive Layer */}
                      {[6, 5, 4, 3, 2, 1].map(s => {
                        const finger = fingers.find(f => f.string === s && f.fret === h);
                        return (
                          <div
                            key={s}
                            onMouseDown={() => onMouseDown(s, h)}
                            onMouseEnter={() => onMouseEnter(s, h)}
                            onMouseUp={(e) => onMouseUp(s, h, e)}
                            className="w-14 h-full relative flex items-center justify-center cursor-pointer group/cell z-20"
                          >
                            <AnimatePresence>
                              {finger && (
                                <motion.div
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.5, opacity: 0 }}
                                  className="w-10 h-10 rounded-full bg-brand-purple border-2 border-white shadow-xl shadow-brand-purple/50 z-10 flex items-center justify-center"
                                >
                                  {finger.finger ? (
                                    <span className="text-white text-xs font-black">{finger.finger}</span>
                                  ) : (
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {!finger && (
                              <div className="w-8 h-8 rounded-full border border-white/5 group-hover/cell:border-white/20 transition-all scale-75 opacity-0 group-hover/cell:opacity-100" />
                            )}
                          </div>
                        );
                      })}

                      <div className="absolute top-0 bottom-0 left-12 right-12 pointer-events-none">
                        <div className="relative h-full">
                          {/* Barres Layer */}
                          {barres.filter(b => b.fret === h).map((b, idx) => {
                            const fromIdx = [6, 5, 4, 3, 2, 1].indexOf(b.fromString);
                            const toIdx = [6, 5, 4, 3, 2, 1].indexOf(b.toString);

                            const p1 = (fromIdx + 0.5) * (100 / 6);
                            const p2 = (toIdx + 0.5) * (100 / 6);
                            const padding = 7;
                            const left = (p1 - padding) + '%';
                            const width = (p2 - p1 + (2 * padding)) + '%';

                            return (
                              <div
                                key={idx}
                                className="absolute h-10 top-1/2 -translate-y-1/2 bg-brand-purple border-2 border-white rounded-full shadow-lg z-10 flex items-center justify-center"
                                style={{ left, width }}
                                onMouseUp={(e) => onMouseUp(b.fromString, h, e)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  toggleFret(b.fromString, h, true); // Right click also deletes
                                }}
                              >
                                {b.finger && (
                                  <span className="text-white text-xs font-black">{b.finger}</span>
                                )}
                              </div>
                            );
                          })}

                          {dragPreview && dragPreview.fret === h && (
                            <div
                              className="absolute h-10 top-1/2 -translate-y-1/2 bg-brand-purple/50 border-2 border-white/50 rounded-full z-10"
                              style={{
                                left: `calc(${(([6, 5, 4, 3, 2, 1].indexOf(dragPreview.from) + 0.5) * (100 / 6)) - 7}% )`,
                                width: `calc(${(([6, 5, 4, 3, 2, 1].indexOf(dragPreview.to) + 0.5) * (100 / 6)) - (([6, 5, 4, 3, 2, 1].indexOf(dragPreview.from) + 0.5) * (100 / 6)) + 14}% )`
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {baseFret === 1 && (
                <div className="absolute top-0 left-0 right-0 h-4 bg-white/70 shadow-lg z-10 blur-[0.5px]" />
              )}
            </div>
          </div>

          <div className="mt-12 flex items-center gap-6 bg-white/5 p-4 rounded-[2rem] border border-white/5 backdrop-blur-md">
            <button
              onClick={() => setBaseFret(Math.max(1, baseFret - 1))}
              className="p-4 bg-white/5 rounded-2xl hover:bg-brand-purple transition-all text-white disabled:opacity-20"
              disabled={baseFret === 1}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Casa Base</span>
              <span className="text-3xl font-black text-white">{baseFret}</span>
            </div>
            <button
              onClick={() => setBaseFret(baseFret + 1)}
              className="p-4 bg-white/5 rounded-2xl hover:bg-brand-purple transition-all text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Right Side: Final Preview & Export */}
        <div className="lg:col-span-3 flex flex-col gap-8 order-3">
          <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-xl flex flex-col items-center">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] mb-8 w-full text-left">Preview Final</h3>
            <div ref={chartRef} className="w-full aspect-[1/1.2]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setFingers([]); setMutedStrings([]); setBarres([]); setCustomTitle(''); }}
              className="py-4 bg-red-500/10 border border-red-500/20 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
            >
              <Trash2 className="w-5 h-5" /> Limpar
            </button>
            <button className="py-4 bg-white/5 border border-white/5 text-white/50 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
              <Download className="w-5 h-5" /> Exportar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

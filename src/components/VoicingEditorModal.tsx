import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SVGuitarChord } from 'svguitar';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface VoicingEditorModalProps {
  chordName: string;
  initialVoicing?: any;
  onSave: (voicing: any) => void;
  onClose: () => void;
}

export default function VoicingEditorModal({ chordName, initialVoicing, onSave, onClose }: VoicingEditorModalProps) {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);

  // States
  const [fingers, setFingers] = useState<Finger[]>(initialVoicing?.fingers?.map((f: any) => ({
    string: f[0],
    fret: f[1],
    finger: f[2]
  })).filter((f: any) => typeof f.fret === 'number') || []);
  
  const [barres, setBarres] = useState<Barre[]>(initialVoicing?.barres || []);
  const [baseFret, setBaseFret] = useState<number>(initialVoicing?.position || initialVoicing?.baseFret || 1);
  const [mutedStrings, setMutedStrings] = useState<number[]>(initialVoicing?.mutedStrings || initialVoicing?.fingers?.filter((f: any) => f[1] === 'x').map((f: any) => f[0]) || []);

  // Drag state for barre
  const [dragStart, setDragStart] = useState<{ string: number, fret: number, removing?: Barre } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ fret: number, from: number, to: number } | null>(null);

  const STRING_NUMS = [1, 2, 3, 4, 5, 6];
  const HOUSE_NUMS = [1, 2, 3, 4, 5];

  // SVGuitar Preview Effect
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
          title: chordName,
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

        const barreElements = chartRef.current.querySelectorAll('.barre');
        barreElements.forEach(el => {
          el.setAttribute('fill', '#ffffff');
          el.setAttribute('stroke', '#ffffff');
        });
      } catch (err) {
        console.error('Error rendering chord preview:', err);
      }
    }
  }, [fingers, barres, baseFret, mutedStrings, chordName]);

  const toggleFret = (string: number, fret: number) => {
    const existingBarre = barres.find(b => b.fret === fret && string <= b.fromString && string >= b.toString);
    if (existingBarre) {
      const cycle = [undefined, 1, 2, 3, 4, 'T', 'REMOVE'];
      const currentIndex = cycle.indexOf(existingBarre.finger as any);
      const nextValue = cycle[currentIndex + 1];
      if (nextValue === 'REMOVE') {
        setBarres(barres.filter(b => b !== existingBarre));
      } else {
        setBarres(barres.map(b => b === existingBarre ? { ...b, finger: nextValue as any } : b));
      }
      return;
    }

    const existing = fingers.find(f => f.string === string && f.fret === fret);
    if (!existing) {
      setFingers([...fingers.filter(f => f.string !== string), { string, fret }]);
      setMutedStrings(mutedStrings.filter(s => s !== string));
    } else {
      const cycle = [undefined, 1, 2, 3, 4, 'T', 'REMOVE'];
      const currentIndex = cycle.indexOf(existing.finger as any);
      const nextValue = cycle[currentIndex + 1];
      if (nextValue === 'REMOVE') {
        setFingers(fingers.filter(f => !(f.string === string && f.fret === fret)));
      } else {
        setFingers(fingers.map(f => (f.string === string && f.fret === fret) ? { ...f, finger: nextValue as any } : f));
      }
    }
  };

  const toggleMute = (string: number) => {
    if (mutedStrings.includes(string)) {
      setMutedStrings(mutedStrings.filter(s => s !== string));
    } else {
      setMutedStrings([...mutedStrings, string]);
      setFingers(fingers.filter(f => f.string !== string));
      setBarres(barres.filter(b => !(string <= b.fromString && string >= b.toString)));
    }
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

  const onMouseUp = (string: number, fret: number) => {
    if (!dragStart) return;
    if (dragPreview) {
      setBarres([...barres.filter(b => b.fret !== fret), {
        fret: dragPreview.fret,
        fromString: dragPreview.from,
        toString: dragPreview.to
      }]);
      setFingers(fingers.filter(f => f.fret !== fret || f.string > dragPreview.from || f.string < dragPreview.to));
      setMutedStrings(mutedStrings.filter(s => !(s <= dragPreview.from && s >= dragPreview.to)));
    } else if (dragStart.removing && dragStart.string === string && dragStart.fret === fret) {
      toggleFret(string, fret);
    } else if (dragStart.string === string && dragStart.fret === fret) {
      toggleFret(string, fret);
    }
    setDragStart(null);
    setDragPreview(null);
  };

  const handleSave = () => {
    const svFingers = fingers.map(f => [f.string, f.fret, f.finger]);
    onSave({ 
      fingers: svFingers, 
      barres, 
      position: baseFret, 
      mutedStrings 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-[3rem] w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-1 bg-brand-purple blur-md opacity-50" />

        <div className="p-10 border-b border-white/5 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-purple/20 rounded-xl">
                <Check className="w-6 h-6 text-brand-accent" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                {chordName}
              </h2>
            </div>
            <p className="text-white/20 text-xs font-bold uppercase tracking-[0.3em] mt-2 ml-1">
              Personalizando Shape
            </p>
          </div>
          <button onClick={onClose} className="p-5 hover:bg-white/5 rounded-full transition-all group">
            <X className="w-8 h-8 text-white/20 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 flex flex-col lg:flex-row gap-16 custom-scrollbar">
          {/* Fretboard Section - EXACT CLONE OF CHORDMAKER SCALE */}
          <div className="flex-1 flex flex-col items-center justify-center scale-90 lg:scale-100">
             <div className="relative w-full max-w-[400px]">
                {/* Nut/Top Labels */}
                <div className="grid grid-cols-6 mb-8 px-8">
                  {[6, 5, 4, 3, 2, 1].map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleMute(s)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all border-2 mx-auto ${
                        mutedStrings.includes(s)
                          ? 'bg-red-500/20 border-red-500 text-red-500'
                          : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'
                      }`}
                    >
                      {mutedStrings.includes(s) ? 'X' : 'O'}
                    </button>
                  ))}
                </div>

                {/* Neck */}
                <div className="relative h-[500px] bg-[#1a1a1a] rounded-2xl border-x-4 border-white/5 p-4 shadow-2xl overflow-hidden">
                  {/* Bone Nut (Pestana de osso) */}
                  {baseFret === 1 && (
                    <div className="absolute top-0 left-0 right-0 h-4 bg-[#fffceb] shadow-xl z-20" />
                  )}

                  <div className="absolute inset-0 grid grid-rows-5">
                    {HOUSE_NUMS.map((h) => (
                      <div key={h} className="relative border-b border-white/10 group/cell">
                        <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20">
                          {baseFret + h - 1}
                        </span>
                        
                        {/* Background String Lines */}
                        <div className="absolute inset-0 flex justify-around px-8 z-0">
                          {STRING_NUMS.map((s) => (
                            <div key={s} className="w-[1px] h-full bg-white/20" />
                          ))}
                        </div>

                        {/* Interactive Layer */}
                        <div className="absolute inset-0 flex justify-around px-8 z-10">
                          {[6, 5, 4, 3, 2, 1].map((s) => {
                            const finger = fingers.find((f) => f.string === s && f.fret === h);
                            return (
                              <div
                                key={s}
                                onMouseDown={() => onMouseDown(s, h)}
                                onMouseEnter={() => onMouseEnter(s, h)}
                                onMouseUp={() => onMouseUp(s, h)}
                                className="w-10 h-full flex items-center justify-center cursor-pointer relative"
                              >
                                <AnimatePresence mode="popLayout">
                                  {finger && (
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      className="w-10 h-10 rounded-full bg-brand-purple border-2 border-white shadow-lg flex items-center justify-center z-20"
                                    >
                                      {finger.finger ? (
                                        <span className="text-white text-xs font-black">{finger.finger}</span>
                                      ) : (
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>

                        {/* Barres Layer */}
                        {/* Barres & Drag Layer */}
                        <div className="absolute top-0 bottom-0 left-8 right-8">
                          <div className="relative h-full">
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
                                  className="absolute h-10 top-1/2 -translate-y-1/2 bg-brand-purple border-2 border-white rounded-full shadow-lg z-10 pointer-events-none flex items-center justify-center"
                                  style={{ left, width }}
                                >
                                  {b.finger && (
                                    <span className="text-white text-xs font-black">{b.finger}</span>
                                  )}
                                </div>
                              );
                            })}

                            {dragPreview && dragPreview.fret === h && (
                              <div
                                className="absolute h-10 top-1/2 -translate-y-1/2 bg-brand-purple/50 border-2 border-white/50 rounded-full z-10 pointer-events-none"
                                style={{
                                  left: `calc(${( ([6, 5, 4, 3, 2, 1].indexOf(dragPreview.from) + 0.5) * (100 / 6) ) - 7}% )`,
                                  width: `calc(${( ([6, 5, 4, 3, 2, 1].indexOf(dragPreview.to) + 0.5) * (100 / 6) ) - ( ([6, 5, 4, 3, 2, 1].indexOf(dragPreview.from) + 0.5) * (100 / 6) ) + 14}% )`
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>

             <div className="mt-12 flex items-center gap-10">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{t('base_fret')}</span>
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-2 border border-white/10 shadow-xl">
                    <button onClick={() => setBaseFret(Math.max(1, baseFret - 1))} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-purple text-white transition-all"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="font-black text-white text-xl w-6 text-center">{baseFret}</span>
                    <button onClick={() => setBaseFret(baseFret + 1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-purple text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setFingers([]); setBarres([]); setMutedStrings([]); }}
                  className="mt-6 p-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 border border-red-500/20 group"
                >
                  <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase">{t('clear_all')}</span>
                </button>
             </div>
          </div>

          {/* Preview and Save */}
          <div className="w-full lg:w-96 flex flex-col gap-10">
            <div className="bg-white/5 rounded-[2.5rem] p-10 border border-white/10 flex flex-col items-center shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-brand-purple/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.4em] mb-8 relative z-10">{t('preview_final')}</h3>
              <div ref={chartRef} className="w-56 h-72 relative z-10" />
            </div>

            <button
              onClick={handleSave}
              className="w-full py-7 bg-brand-purple text-white font-black rounded-3xl flex items-center justify-center gap-4 hover:scale-[1.02] transition-all shadow-2xl shadow-brand-purple/40 text-lg uppercase tracking-widest"
            >
              <Check className="w-7 h-7" /> {t('save_voicing')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SVGuitarChord } from 'svguitar';
import guitarChords from '@tombatossals/chords-db/lib/guitar.json';
import VoicingEditorModal from './VoicingEditorModal';

interface ChordDiagramProps {
  chordName: string;
  voicing?: any;
  onClick?: () => void;
}

function ChordDiagram({ chordName, voicing, onClick }: ChordDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = '';
        const chart = new SVGuitarChord(containerRef.current);
        
        chart.configure({
          title: chordName,
          style: 'normal' as any,
          fingerSize: 0.7,
          color: '#ffffff', // Clean white for a premium look
          titleColor: '#fffceb',
          fingerTextColor: '#000000',
          fretColor: '#ffffff30',
          stringColor: '#ffffff30',
          fretLabelColor: '#ffffff50',
          barreChordRadius: 1,
          barreChordStyle: 'rectangle' as any,
          fixedDiagramPosition: true,
          fontFamily: 'Outfit, sans-serif'
        })
        .chord(voicing || { fingers: [], barres: [], position: 1 })
        .draw();

        // Force white fill for barres in the SVG
        const barreElements = containerRef.current.querySelectorAll('.barre');
        barreElements.forEach(el => {
          el.setAttribute('fill', '#ffffff');
          el.setAttribute('stroke', '#ffffff');
        });
      } catch (err) {
        console.error(`Error rendering chord ${chordName}:`, err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="text-[10px] text-red-500 flex items-center justify-center h-full">Error: ${chordName}</div>`;
        }
      }
    }
  }, [chordName, voicing]);

  return (
    <div 
      onClick={onClick}
      className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105"
    >
      <div ref={containerRef} className="w-32 h-40" />
    </div>
  );
}

interface ChordDictionaryProps {
  chords: string[];
  customVoicings?: Record<string, any>;
  onSaveVoicing: (chord: string, voicing: any) => void;
}

export default function ChordDictionary({ chords, customVoicings = {}, onSaveVoicing }: ChordDictionaryProps) {
  const [editingChord, setEditingChord] = useState<string | null>(null);
  const { t } = useTranslation();

  // Parse and unique chords
  const uniqueChords = useMemo(() => {
    return Array.from(new Set(chords.filter(c => c && c.trim() !== ''))).sort();
  }, [chords]);

  // Helper to find default voicing in chords-db
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

    // Map suffixes to chords-db format
    let dbSuffix = suffix;
    if (suffix === '') dbSuffix = 'major';
    if (suffix === 'm') dbSuffix = 'minor';
    if (suffix === 'M') dbSuffix = 'major';
    
    // Key normalization for chords-db
    let dbKey = key;
    if (key === 'C#') dbKey = 'Csharp';
    if (key === 'F#') dbKey = 'Fsharp';
    // Ab, Bb, Eb are already correct in the keys list I saw

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

  if (uniqueChords.length === 0) return null;

  return (
    <div className="mt-16 pt-16 border-t border-white/5">
      <div className="mb-12">
        <h2 className="text-5xl font-black tracking-tighter text-white mb-2">{t('chord_dictionary_title')}</h2>
        <p className="text-white/40 text-sm font-bold uppercase tracking-widest">{t('chord_dictionary_subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
        {uniqueChords.map(chord => (
          <ChordDiagram 
            key={chord} 
            chordName={chord} 
            voicing={customVoicings[chord] || getDefaultVoicing(chord)}
            onClick={() => setEditingChord(chord)}
          />
        ))}
      </div>

      {editingChord && (
        <VoicingEditorModal
          chordName={editingChord}
          initialVoicing={customVoicings[editingChord] || getDefaultVoicing(editingChord)}
          onSave={(voicing) => onSaveVoicing(editingChord, voicing)}
          onClose={() => setEditingChord(null)}
        />
      )}
    </div>
  );
}

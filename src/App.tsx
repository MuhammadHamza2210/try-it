import { useMemo, useRef, useState } from 'react';
import { Upload, RotateCcw, Shirt, Check, Camera, SlidersHorizontal, Sparkles, Video } from 'lucide-react';
import TryOnStage from './tryon/TryOnStage';
import AiTryOn from './tryon/AiTryOn';
import { DEFAULT_ANCHORS } from './tryon/warp';
import type { Garment, TryOnAnchors } from './tryon/types';

type StageMode = 'live' | 'ai';

// Ready-to-use starter kurtas. The colored ones are clean cutouts (great for the
// live overlay AND the AI mode); the last is a real garment photo (best for AI).
const STARTERS: Garment[] = [
  { id: 'ivory', name: 'Ivory Kurta', url: '/garments/ivory-kurta.png', anchors: { ...DEFAULT_ANCHORS } },
  { id: 'navy', name: 'Navy Kurta', url: '/garments/navy-kurta.png', anchors: { ...DEFAULT_ANCHORS } },
  { id: 'charcoal', name: 'Charcoal Kurta', url: '/garments/charcoal-kurta.png', anchors: { ...DEFAULT_ANCHORS } },
  { id: 'emerald', name: 'Emerald Kurta', url: '/garments/emerald-kurta.png', anchors: { ...DEFAULT_ANCHORS } },
  { id: 'maroon', name: 'Maroon Kurta', url: '/garments/maroon-kurta.png', anchors: { ...DEFAULT_ANCHORS } },
  { id: 'white-embroidered', name: 'White Embroidered Kurta', url: '/garments/white-embroidered-kurta.jpg', anchors: { ...DEFAULT_ANCHORS } },
];

export default function App() {
  const [garments, setGarments] = useState<Garment[]>(STARTERS);
  const [selectedId, setSelectedId] = useState(STARTERS[0].id);
  const [showFit, setShowFit] = useState(false);
  const [stageMode, setStageMode] = useState<StageMode>('live');
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => garments.find((g) => g.id === selectedId) ?? garments[0],
    [garments, selectedId]
  );

  const patchAnchors = (patch: Partial<TryOnAnchors>) =>
    setGarments((gs) =>
      gs.map((g) => (g.id === selected.id ? { ...g, anchors: { ...g.anchors, ...patch } } : g))
    );

  const shoulderWidth = Number((selected.anchors.rightX - selected.anchors.leftX).toFixed(2));
  const setShoulderWidth = (w: number) =>
    patchAnchors({ leftX: (1 - w) / 2, rightX: (1 + w) / 2 });

  const onGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const id = `g-${Date.now()}-${file.name}`;
    const g: Garment = {
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      url,
      anchors: { ...DEFAULT_ANCHORS },
    };
    setGarments((gs) => [...gs, g]);
    setSelectedId(id);
    setShowFit(true);
  };

  return (
    <div className="min-h-full bg-ink">
      {/* Ambient plaster/aubergine wash behind the fitting room */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#3B1F2B_0%,#1A1416_60%)]" />

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-5 py-8 sm:px-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 text-brass">
            <Shirt className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide">Try It</span>
          </div>
          <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.05] text-plaster sm:text-5xl">
            See the outfit <span className="italic text-blush">on you</span> in 3 steps.
          </h1>

          {/* The 3-step map, always visible */}
          <ol className="mt-4 flex flex-wrap gap-2 text-xs text-plaster/70">
            <StepPill n={1} icon={<Shirt className="h-3.5 w-3.5" />} label="Pick the clothing" />
            <StepPill n={2} icon={<Camera className="h-3.5 w-3.5" />} label="Show yourself (camera or photo)" />
            <StepPill n={3} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Adjust the fit & save" />
          </ol>
        </header>

        {/* Two-pane fitting room */}
        <main className="grid flex-1 gap-6 lg:grid-cols-[340px_1fr]">
          {/* Controls */}
          <section className="flex flex-col gap-5">
            {/* STEP 1 — garment */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <StepHeading n={1} title="Pick the clothing" />
              <p className="mt-1 text-[11px] leading-snug text-plaster/50">
                A few ready-made kurtas are set up. The colored ones work in both modes; the
                <strong className="text-plaster/80"> White Embroidered</strong> one is a real photo (best for AI).
                Add your own with <strong className="text-plaster/80">Upload garment</strong> — a product photo
                for AI, or a transparent PNG for live preview.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {garments.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`relative h-24 w-20 overflow-hidden rounded-xl border transition-all ${
                      g.id === selected.id
                        ? 'border-brass ring-2 ring-brass/40'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    style={CHECKER}
                    title={g.name}
                  >
                    <img src={g.url} alt={g.name} className="h-full w-full object-contain" />
                    {g.id === selected.id && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brass text-ink">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/20 text-plaster/40 transition-colors hover:border-brass hover:text-brass"
                >
                  <Upload className="h-5 w-5" />
                  <span className="px-1 text-center text-[10px] leading-tight">Upload garment</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/webp"
                  onChange={onGarmentUpload}
                  className="hidden"
                />
              </div>
              <p className="mt-3 rounded-lg bg-brass/10 px-3 py-2 text-[11px] text-plaster/70">
                Selected: <strong className="text-blush">{selected.name}</strong> — now go to the right and
                press <strong className="text-plaster/90">Start Camera</strong>.
              </p>
            </div>

            {/* STEP 3 — fit (collapsible, secondary) */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <button
                onClick={() => setShowFit((s) => !s)}
                className="flex w-full items-center justify-between"
              >
                <StepHeading n={3} title="Adjust the fit" />
                <span className="text-[11px] text-brass">{showFit ? 'Hide' : 'Show'}</span>
              </button>

              {showFit && (
                <>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => patchAnchors({ ...DEFAULT_ANCHORS })}
                      className="flex items-center gap-1 text-[11px] font-medium text-brass hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                  </div>
                  <div className="mt-2 flex gap-4">
                    <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10" style={CHECKER}>
                      <img src={selected.url} alt="" className="h-full w-full object-contain" />
                      <Dot x={selected.anchors.leftX} y={selected.anchors.leftY} />
                      <Dot x={selected.anchors.rightX} y={selected.anchors.rightY} />
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <SliderRow label="Shoulder Y" value={selected.anchors.leftY} min={0} max={0.4} step={0.01}
                        onChange={(v) => patchAnchors({ leftY: v, rightY: v })} />
                      <SliderRow label="Shoulder width" value={shoulderWidth} min={0.3} max={0.95} step={0.01}
                        onChange={setShoulderWidth} />
                      <SliderRow label="Overall scale" value={selected.anchors.scale} min={0.8} max={1.8} step={0.01}
                        onChange={(v) => patchAnchors({ scale: v })} />
                      <SliderRow label="Vertical offset" value={selected.anchors.offsetY} min={-0.15} max={0.35} step={0.01}
                        onChange={(v) => patchAnchors({ offsetY: v })} />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-plaster/40">
                    Line the two dots up with the garment's shoulder seams, then tweak the drape.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* STEP 2 — Stage */}
          <section className="flex min-h-[70vh] flex-col rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StepHeading n={2} title="Show yourself" />
              {/* Live vs AI toggle */}
              <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs">
                <ModeTab active={stageMode === 'live'} onClick={() => setStageMode('live')} icon={<Video className="h-3.5 w-3.5" />}>
                  Live preview
                </ModeTab>
                <ModeTab active={stageMode === 'ai'} onClick={() => setStageMode('ai')} icon={<Sparkles className="h-3.5 w-3.5" />}>
                  AI photorealistic
                </ModeTab>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-plaster/45">
              {stageMode === 'live'
                ? 'Instant, on-device overlay via your camera or a photo — great for a quick look.'
                : 'Upload one photo and an AI renders you actually wearing it (free, ~30–90s).'}
            </p>
            <div className="mt-4 flex-1">
              {stageMode === 'live' ? (
                <TryOnStage
                  key={selected.id}
                  garmentUrl={selected.url}
                  anchors={selected.anchors}
                  garmentName={selected.name}
                  fileName={slug(selected.name)}
                />
              ) : (
                <AiTryOn garmentUrl={selected.url} garmentName={selected.name} />
              )}
            </div>
          </section>
        </main>

        <footer className="mt-8 text-center text-[11px] text-plaster/30">
          Try It · on-device virtual try-on · pose estimation by MediaPipe
        </footer>
      </div>
    </div>
  );
}

const CHECKER: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg,#2a2226 25%,transparent 25%),linear-gradient(-45deg,#2a2226 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2226 75%),linear-gradient(-45deg,transparent 75%,#2a2226 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
};

function StepPill({ n, icon, label }: { n: number; icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brass text-[11px] font-bold text-ink">
        {n}
      </span>
      <span className="flex items-center gap-1.5">{icon}{label}</span>
    </li>
  );
}

function ModeTab({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
        active ? 'bg-brass text-ink' : 'text-plaster/70 hover:text-plaster'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brass text-xs font-bold text-ink">
        {n}
      </span>
      <h2 className="font-display text-lg text-plaster">{title}</h2>
    </div>
  );
}

function Dot({ x, y }: { x: number; y: number }) {
  return (
    <span
      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brass shadow"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    />
  );
}

function SliderRow({
  label, value, min, max, step, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px] text-plaster/60">
        <span>{label}</span>
        <span className="tabular-nums text-plaster/40">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'try-it';
}

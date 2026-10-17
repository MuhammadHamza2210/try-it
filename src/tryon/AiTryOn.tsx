import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Loader2, Download, Sparkles, AlertCircle, KeyRound, ExternalLink,
  RotateCcw, Camera, Check, CircleAlert, Scissors,
} from 'lucide-react';
import { runAiTryOn } from './aiClient';
import { preparePersonPhoto, type PreparedPhoto } from './prepImage';
import WebcamCapture from './WebcamCapture';

interface Props {
  garmentUrl: string;
  garmentName: string;
}

const TOKEN_KEY = 'tryit_hf_token';

/**
 * Photorealistic AI try-on with an automatic photo-prep pipeline:
 * capture/upload → pose check + auto-crop + optional background removal → generate.
 */
export default function AiTryOn({ garmentUrl, garmentName }: Props) {
  const [token, setToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);

  const [capturing, setCapturing] = useState(false);
  const rawImgRef = useRef<HTMLImageElement | null>(null);
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setTokenSaved(true);
    }
  }, []);

  const saveToken = () => {
    const t = token.trim();
    if (!t) return;
    localStorage.setItem(TOKEN_KEY, t);
    setTokenSaved(true);
  };
  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setTokenSaved(false);
  };

  // ── Prep pipeline ────────────────────────────────────────────
  const prep = useCallback(async (img: HTMLImageElement, useRemoveBg: boolean) => {
    setPreparing(true);
    setError(null);
    setResultUrl(null);
    try {
      const result = await preparePersonPhoto(img, { removeBackground: useRemoveBg });
      setPrepared((old) => {
        if (old?.url) URL.revokeObjectURL(old.url);
        return result;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that photo.');
    } finally {
      setPreparing(false);
    }
  }, []);

  const onGotImage = useCallback(
    (img: HTMLImageElement) => {
      rawImgRef.current = img;
      setCapturing(false);
      prep(img, removeBg);
    },
    [prep, removeBg]
  );

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => onGotImage(img);
    img.onerror = () => setError('Could not read that image.');
    img.src = URL.createObjectURL(file);
  };

  const toggleRemoveBg = () => {
    const next = !removeBg;
    setRemoveBg(next);
    if (rawImgRef.current) prep(rawImgRef.current, next);
  };

  const reset = () => {
    if (prepared?.url) URL.revokeObjectURL(prepared.url);
    rawImgRef.current = null;
    setPrepared(null);
    setResultUrl(null);
    setError(null);
  };

  const generate = useCallback(async () => {
    setError(null);
    setResultUrl(null);
    const t = (localStorage.getItem(TOKEN_KEY) || token).trim();
    if (!t) {
      setError('Please paste your free Hugging Face token first.');
      return;
    }
    if (!prepared) {
      setError('Please add a photo of yourself first.');
      return;
    }
    setBusy(true);
    setStatus('Preparing…');
    try {
      const garmentBlob = await (await fetch(garmentUrl)).blob();
      const res = await runAiTryOn({
        personBlob: prepared.blob,
        garmentBlob,
        garmentDesc: garmentName,
        token: t,
        onStatus: setStatus,
      });
      setResultUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }, [garmentUrl, garmentName, token, prepared]);

  // ── Token gate ──────────────────────────────────────────────
  if (!tokenSaved) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <KeyRound className="h-8 w-8 text-brass" />
        <h3 className="font-display text-xl text-plaster">One-time free setup</h3>
        <p className="max-w-sm text-sm text-plaster/60">
          The photorealistic model runs for free on Hugging Face. Paste a free access
          token once — it's stored only in this browser.
        </p>
        <a
          href="https://huggingface.co/settings/tokens"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-blush hover:underline"
        >
          Get my free token <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <div className="flex w-full max-w-sm gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="hf_xxxxxxxx"
            className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-plaster outline-none placeholder:text-plaster/30 focus:border-brass"
          />
          <button
            onClick={saveToken}
            disabled={!token.trim()}
            className="rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  // ── Webcam capture ──────────────────────────────────────────
  if (capturing) {
    return <WebcamCapture onCapture={onGotImage} onCancel={() => setCapturing(false)} />;
  }

  // ── Header (shared) ─────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between pb-3">
      <p className="flex items-center gap-1.5 text-sm text-plaster">
        <Sparkles className="h-4 w-4 text-brass" /> AI Photorealistic
      </p>
      <button onClick={clearToken} className="text-[11px] text-plaster/40 hover:text-plaster/70">
        Reset token
      </button>
    </div>
  );

  // ── Result ──────────────────────────────────────────────────
  if (resultUrl) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <img src={resultUrl} alt={`You wearing ${garmentName}`} className="max-h-[52vh] max-w-full rounded-2xl shadow-2xl" />
          <div className="flex gap-3">
            <a
              href={resultUrl}
              download={`${garmentName || 'try-it'}-ai-tryon.png`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-ink"
            >
              <Download className="h-4 w-4" /> Save Image
            </a>
            <button
              onClick={() => setResultUrl(null)}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm text-plaster hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main flow ───────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {header}

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {!prepared && !preparing && (
          <>
            <p className="max-w-xs text-center text-sm text-plaster/60">
              Add a photo of yourself — I’ll auto-check the angle, crop it, and (optionally)
              clean the background so the try-on looks its best.
            </p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row">
              <button
                onClick={() => setCapturing(true)}
                className="flex items-center justify-center gap-2 rounded-full bg-blush px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                <Camera className="h-4 w-4" /> Take Photo
              </button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-plaster transition-colors hover:bg-white/10">
                <Upload className="h-4 w-4" /> Upload Photo
                <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-plaster/60">
              <input type="checkbox" checked={removeBg} onChange={toggleRemoveBg} className="accent-brass" />
              <Scissors className="h-3.5 w-3.5" /> Remove background (optional)
            </label>
          </>
        )}

        {preparing && (
          <div className="flex flex-col items-center gap-2 text-plaster">
            <Loader2 className="h-6 w-6 animate-spin text-brass" />
            <p className="text-sm">Checking & preparing your photo…</p>
          </div>
        )}

        {prepared && !preparing && (
          <>
            {/* Prepared photo + garment */}
            <div className="flex items-end justify-center gap-4">
              <div className="text-center">
                <p className="mb-1.5 text-[11px] text-plaster/50">Your photo (prepared)</p>
                <img src={prepared.url} alt="You, prepared" className="h-52 w-40 rounded-xl border border-white/10 object-cover" />
              </div>
              <span className="pb-20 text-2xl text-plaster/30">+</span>
              <div className="text-center">
                <p className="mb-1.5 text-[11px] text-plaster/50">Garment</p>
                <div className="h-52 w-40 overflow-hidden rounded-xl border border-white/10" style={CHECKER}>
                  <img src={garmentUrl} alt={garmentName} className="h-full w-full object-contain" />
                </div>
              </div>
            </div>

            {/* Quality checklist */}
            <div className="w-full max-w-sm space-y-1 rounded-xl bg-white/[0.04] px-4 py-3 text-[12px]">
              <CheckRow ok={prepared.checks.personFound} label="Person detected" />
              <CheckRow ok={prepared.checks.upperBodyInFrame} label="Head & shoulders in frame" />
              <CheckRow ok={prepared.checks.fullBody} label="Torso / full body visible" />
              <CheckRow ok={prepared.checks.frontFacing} label="Facing the camera" />
              {prepared.checks.tips.length > 0 && (
                <p className="pt-1 text-[11px] leading-snug text-amber-300/80">
                  Tip: {prepared.checks.tips[0]}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-plaster/60">
                <input type="checkbox" checked={removeBg} onChange={toggleRemoveBg} className="accent-brass" />
                <Scissors className="h-3.5 w-3.5" /> Remove background
              </label>
              <button onClick={reset} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-plaster hover:bg-white/20">
                <RotateCcw className="h-3.5 w-3.5" /> Change photo
              </button>
            </div>

            {busy ? (
              <div className="flex flex-col items-center gap-2 text-plaster">
                <Loader2 className="h-6 w-6 animate-spin text-brass" />
                <p className="text-sm">{status || 'Working…'}</p>
                <p className="text-[11px] text-plaster/40">Free shared GPU — hang tight, don't close the tab.</p>
              </div>
            ) : (
              <button
                onClick={generate}
                className="flex items-center gap-2 rounded-full bg-blush px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                <Sparkles className="h-4 w-4" /> Generate photorealistic try-on
              </button>
            )}
            {!prepared.checks.ok && !busy && (
              <p className="max-w-sm text-center text-[11px] text-plaster/40">
                You can still generate, but a photo that passes all checks gives the best result.
              </p>
            )}
          </>
        )}

        {error && (
          <div className="flex max-w-sm items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-left text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? 'text-plaster/80' : 'text-plaster/45'}`}>
      {ok ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />
      ) : (
        <CircleAlert className="h-3.5 w-3.5 text-amber-400" />
      )}
      {label}
    </div>
  );
}

const CHECKER: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg,#2a2226 25%,transparent 25%),linear-gradient(-45deg,#2a2226 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2226 75%),linear-gradient(-45deg,transparent 75%,#2a2226 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
};

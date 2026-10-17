import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, Download, Loader2, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { usePoseLandmarker } from './usePoseLandmarker';
import { drawGarment } from './warp';
import type { Landmark } from './warp';
import type { TryOnAnchors } from './types';

interface Props {
  garmentUrl: string;
  anchors: TryOnAnchors;
  garmentName: string;
  /** slug-ish label used for the downloaded snapshot filename */
  fileName?: string;
}

type Mode = 'idle' | 'webcam' | 'upload';

/**
 * Live try-on stage.
 *
 * Webcam mode shows the camera feed in a *visible* mirrored <video> and draws
 * ONLY the garment onto a transparent <canvas> layered on top — this is far more
 * robust than piping frames through a hidden video (which Chrome refuses to do,
 * showing as a black screen). Photo mode paints the still image + garment into
 * the same canvas. Everything runs on-device.
 */
export default function TryOnStage({ garmentUrl, anchors, garmentName, fileName = 'try-it' }: Props) {
  const { setMode: setModelMode, detectVideo, detectImage, loading, error } = usePoseLandmarker();

  const [mode, setMode] = useState<Mode>('idle');
  const [poseFound, setPoseFound] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState(false); // camera feed actually rendering
  const [hasPhoto, setHasPhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const garmentRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastLmsRef = useRef<Landmark[] | null>(null);

  // Keep the latest anchors in a ref so the rAF loop always warps with the
  // current fit sliders without a restart.
  const anchorsRef = useRef(anchors);
  useEffect(() => {
    anchorsRef.current = anchors;
  }, [anchors]);

  // (Re)load the garment cutout whenever the source changes.
  useEffect(() => {
    if (!garmentUrl) {
      garmentRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = garmentUrl;
    garmentRef.current = img;
    return () => {
      garmentRef.current = null;
    };
  }, [garmentUrl]);

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ── Live webcam loop: draw ONLY the garment on the overlay canvas ──
  const drawOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(drawOverlay);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      rafRef.current = requestAnimationFrame(drawOverlay);
      return;
    }
    if (!live) setLive(true);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const res = detectVideo(video, performance.now());
    const lms = res?.landmarks?.[0] ?? null;
    lastLmsRef.current = lms;
    const garment = garmentRef.current;
    if (lms && garment) {
      // mirror=true so the garment lines up with the CSS-mirrored video feed.
      setPoseFound(drawGarment(ctx, garment, lms, w, h, anchorsRef.current, true));
    } else {
      setPoseFound(false);
    }
    rafRef.current = requestAnimationFrame(drawOverlay);
  }, [detectVideo, live]);

  const startWebcam = useCallback(async () => {
    setMode('webcam');
    setCamError(null);
    setStarting(true);
    setPoseFound(false);
    setLive(false);
    try {
      // Ask for the camera FIRST so the permission prompt is immediate, then
      // load the model while the stream warms up.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        setCamError('Video element not ready — press Start Camera again.');
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {}); // autoplay policies: muted+playsInline should allow it
      await setModelMode('VIDEO');
      rafRef.current = requestAnimationFrame(drawOverlay);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not access the camera';
      setCamError(
        /denied|permission|notallowed/i.test(msg)
          ? 'Camera access was blocked. Click the camera icon in your browser’s address bar, allow it, then Retry.'
          : /notfound|devices/i.test(msg)
            ? 'No camera found. Plug one in or use “Upload a Photo” instead.'
            : msg
      );
    } finally {
      setStarting(false);
    }
  }, [setModelMode, drawOverlay]);

  // ── Still-photo upload: paint photo + garment into the canvas ──
  const onUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      stopStream();
      setMode('upload');
      setLive(false);
      setHasPhoto(true);
      setStarting(true);
      setCamError(null);
      setPoseFound(false);
      try {
        await setModelMode('IMAGE');
        const url = URL.createObjectURL(file);
        const photo = new Image();
        photo.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const maxSide = 1000;
          const ratio = Math.min(1, maxSide / Math.max(photo.naturalWidth, photo.naturalHeight));
          const w = Math.round(photo.naturalWidth * ratio);
          const h = Math.round(photo.naturalHeight * ratio);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(photo, 0, 0, w, h);
          const res = detectImage(photo);
          const lms = res?.landmarks?.[0];
          const garment = garmentRef.current;
          if (lms && garment) {
            setPoseFound(drawGarment(ctx, garment, lms, w, h, anchorsRef.current, false));
          } else {
            setPoseFound(false);
          }
          URL.revokeObjectURL(url);
          setStarting(false);
        };
        photo.onerror = () => {
          setCamError('Could not read that image.');
          setStarting(false);
        };
        photo.src = url;
      } catch {
        setCamError('Failed to process the photo.');
        setStarting(false);
      }
    },
    [detectImage, setModelMode, stopStream]
  );

  const backToStart = useCallback(() => {
    stopStream();
    setMode('idle');
    setPoseFound(false);
    setCamError(null);
    setHasPhoto(false);
    setLive(false);
  }, [stopStream]);

  useEffect(() => stopStream, [stopStream]);

  const snapshot = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let dataUrl: string;
      if (mode === 'webcam') {
        // Composite mirrored video + the garment overlay into a fresh canvas.
        const video = videoRef.current;
        const w = video?.videoWidth || canvas.width;
        const h = video?.videoHeight || canvas.height;
        const tmp = document.createElement('canvas');
        tmp.width = w;
        tmp.height = h;
        const tctx = tmp.getContext('2d');
        if (!tctx || !video) return;
        tctx.save();
        tctx.translate(w, 0);
        tctx.scale(-1, 1);
        tctx.drawImage(video, 0, 0, w, h);
        tctx.restore();
        tctx.drawImage(canvas, 0, 0, w, h); // garment overlay
        dataUrl = tmp.toDataURL('image/png');
      } else {
        dataUrl = canvas.toDataURL('image/png');
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName}-tryon.png`;
      a.click();
    } catch {
      setCamError('Snapshot failed — the garment image may block cross-origin export.');
    }
  }, [fileName, mode]);

  const busy = loading || starting;

  // Always-mounted, visible-in-webcam source video. Mirrored like a mirror.
  const videoEl = (
    <video
      ref={videoRef}
      playsInline
      muted
      autoPlay
      className={mode === 'webcam' ? 'block max-h-[60vh] max-w-full rounded-2xl' : 'hidden'}
      style={{ transform: 'scaleX(-1)' }}
    />
  );

  // ── Idle ──────────────────────────────────────────────────────
  if (mode === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        {videoEl}
        <div>
          <p className="text-xs uppercase tracking-widest text-plaster/40">Trying on</p>
          <p className="mt-1 font-display text-2xl text-blush">{garmentName}</p>
        </div>
        <div className="relative h-40 w-32 overflow-hidden rounded-2xl border border-white/10" style={CHECKER}>
          <img src={garmentUrl} alt={garmentName} className="h-full w-full object-contain" />
        </div>
        <p className="max-w-xs text-sm text-plaster/60">Choose how you'd like to see it on you:</p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row">
          <button
            onClick={startWebcam}
            className="flex items-center justify-center gap-2 rounded-full bg-blush px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            <Camera className="h-4 w-4" /> Start Camera
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-plaster transition-colors hover:bg-white/10">
            <Upload className="h-4 w-4" /> Upload a Photo
            <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
          </label>
        </div>
        <p className="text-[11px] text-plaster/40">Live camera works best. Nothing leaves your device.</p>
      </div>
    );
  }

  // ── Active (webcam or photo) ──────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <button
          onClick={backToStart}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-plaster hover:bg-white/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="text-xs text-plaster/50">
          Trying on <span className="text-blush">{garmentName}</span>
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative inline-flex items-center justify-center">
          {videoEl}

          <canvas
            ref={canvasRef}
            className={
              mode === 'webcam'
                ? 'absolute inset-0 h-full w-full rounded-2xl'
                : 'block max-h-[60vh] max-w-full rounded-2xl bg-black/30'
            }
          />

          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-ink/60 text-plaster">
              <Loader2 className="h-8 w-8 animate-spin text-blush" />
              <p className="text-sm">{loading ? 'Loading the try-on engine…' : 'Starting camera…'}</p>
            </div>
          )}

          {(camError || error) && !busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-ink/80 px-6 text-center text-plaster">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm">{camError || error}</p>
              {mode === 'webcam' && (
                <button onClick={startWebcam} className="mt-2 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm hover:bg-white/25">
                  <RefreshCw className="h-4 w-4" /> Retry
                </button>
              )}
            </div>
          )}

          {!busy && !camError && !error && !poseFound && (mode === 'upload' || live) && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-4 py-2 text-center text-xs text-plaster backdrop-blur">
              {mode === 'webcam'
                ? 'Step back so your head & shoulders are in frame ✨'
                : 'No person found — try a clearer, front-facing full-body photo'}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-3">
        {mode === 'upload' && hasPhoto && (
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm text-plaster hover:bg-white/20">
            <RefreshCw className="h-4 w-4" /> Change photo
            <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
          </label>
        )}
        <button
          onClick={snapshot}
          disabled={!poseFound}
          className="flex items-center gap-2 rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-40"
          title={poseFound ? 'Download a snapshot' : 'Get in frame first'}
        >
          <Download className="h-4 w-4" /> Save Snapshot
        </button>
      </div>

      <p className="pt-2 text-center text-[11px] text-plaster/40">
        Preview only — actual drape and fit may vary. Runs privately on your device.
      </p>
    </div>
  );
}

const CHECKER: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg,#2a2226 25%,transparent 25%),linear-gradient(-45deg,#2a2226 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2226 75%),linear-gradient(-45deg,transparent 75%,#2a2226 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
};

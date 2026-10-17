import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  onCapture: (img: HTMLImageElement) => void;
  onCancel: () => void;
}

/**
 * Live webcam with a dashed full-body guide so the user stands at the right
 * distance/angle, then captures a still frame as an HTMLImageElement.
 */
export default function WebcamCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not access the camera';
        setError(
          /denied|permission|notallowed/i.test(msg)
            ? 'Camera blocked. Allow it in the address bar, then reopen.'
            : msg
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    // Capture the true (un-mirrored) frame for a natural photo.
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    const img = new Image();
    img.onload = () => onCapture(img);
    img.src = c.toDataURL('image/png');
  }, [onCapture]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="max-h-[52vh] max-w-full rounded-2xl bg-black/40"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Full-body guide overlay */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="h-[86%] w-[52%] rounded-[45%/30%] border-2 border-dashed border-blush/70" />
            <p className="absolute bottom-3 rounded-full bg-ink/70 px-3 py-1 text-[11px] text-plaster backdrop-blur">
              Fit your head-to-hips inside the outline, face forward
            </p>
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-ink/60 text-plaster">
            <Loader2 className="h-7 w-7 animate-spin text-blush" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-ink/80 px-6 text-center text-plaster">
            <AlertCircle className="h-7 w-7 text-red-400" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm text-plaster hover:bg-white/20"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          onClick={capture}
          disabled={!ready}
          className="flex items-center gap-2 rounded-full bg-blush px-6 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          <Camera className="h-4 w-4" /> Capture
        </button>
      </div>
    </div>
  );
}

import { FilesetResolver, PoseLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { POSE_WASM_BASE, POSE_MODEL_URL, SEG_MODEL_URL } from './config';

// ── Lazy-loaded MediaPipe singletons (IMAGE mode) ────────────────────────────
let poseP: Promise<PoseLandmarker> | null = null;
let segP: Promise<ImageSegmenter> | null = null;

async function getPose() {
  if (!poseP) {
    poseP = (async () => {
      const vision = await FilesetResolver.forVisionTasks(POSE_WASM_BASE);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })();
  }
  return poseP;
}

async function getSegmenter() {
  if (!segP) {
    segP = (async () => {
      const vision = await FilesetResolver.forVisionTasks(POSE_WASM_BASE);
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: SEG_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })();
  }
  return segP;
}

// MediaPipe Pose landmark indices.
const L_SH = 11;
const R_SH = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;

interface Lm {
  x: number;
  y: number;
  visibility?: number;
}

export interface PhotoChecks {
  personFound: boolean;
  upperBodyInFrame: boolean;
  frontFacing: boolean;
  fullBody: boolean;
  ok: boolean;
  tips: string[];
}

export interface PreparedPhoto {
  blob: Blob;
  url: string;
  checks: PhotoChecks;
}

const vis = (lm?: Lm) => (lm?.visibility ?? 0);

function drawScaled(source: CanvasImageSource, srcW: number, srcH: number, maxSide: number) {
  const ratio = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * ratio));
  const h = Math.max(1, Math.round(srcH * ratio));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(source, 0, 0, w, h);
  return c;
}

function analyzeLandmarks(lms: Lm[] | undefined): { checks: PhotoChecks; box: [number, number, number, number] | null } {
  const tips: string[] = [];
  if (!lms || lms.length <= R_HIP) {
    return {
      checks: {
        personFound: false,
        upperBodyInFrame: false,
        frontFacing: false,
        fullBody: false,
        ok: false,
        tips: ['No person detected — use a clear photo of one person.'],
      },
      box: null,
    };
  }

  const shouldersOk = vis(lms[L_SH]) > 0.6 && vis(lms[R_SH]) > 0.6;
  const hipsOk = vis(lms[L_HIP]) > 0.5 && vis(lms[R_HIP]) > 0.5;
  const kneesOk = vis(lms[L_KNEE]) > 0.4 || vis(lms[R_KNEE]) > 0.4;

  const shoulderW = Math.abs(lms[L_SH].x - lms[R_SH].x);
  const symmetric = Math.abs(vis(lms[L_SH]) - vis(lms[R_SH])) < 0.35;
  const frontFacing = shouldersOk && symmetric && shoulderW > 0.1;

  if (!shouldersOk) tips.push('Get your head & shoulders fully in the frame.');
  if (!hipsOk) tips.push('Step back so your torso (down to the hips) is visible.');
  if (!frontFacing) tips.push('Face the camera straight-on, shoulders square.');
  if (shoulderW > 0.55) tips.push('You’re a bit close — step back for a fuller shot.');

  // Bounding box from visible landmarks (+ generous head/foot padding).
  const pts = lms.filter((l) => vis(l) > 0.3);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const box: [number, number, number, number] = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];

  const checks: PhotoChecks = {
    personFound: true,
    upperBodyInFrame: shouldersOk,
    frontFacing,
    fullBody: hipsOk && (kneesOk || vis(lms[L_ANKLE]) > 0.3 || vis(lms[R_ANKLE]) > 0.3),
    ok: shouldersOk && hipsOk && frontFacing,
    tips,
  };
  return { checks, box };
}

/**
 * Frame the person into a 3:4 portrait WITHOUT cutting anything: take the padded
 * bounding box from the *full-resolution* source (so it stays sharp), then "fit"
 * it into 768×1024 on a light plate. Extra headroom keeps the top of the head in.
 */
function framePortrait(
  source: HTMLImageElement,
  box: [number, number, number, number]
): HTMLCanvasElement {
  const W = source.naturalWidth;
  const H = source.naturalHeight;
  let x0 = box[0] * W;
  let y0 = box[1] * H;
  let x1 = box[2] * W;
  let y1 = box[3] * H;

  const bw = x1 - x0;
  const bh = y1 - y0;
  // Generous headroom (top-of-head isn't a landmark) + side/bottom padding.
  x0 -= bw * 0.16;
  x1 += bw * 0.16;
  y0 -= bh * 0.38;
  y1 += bh * 0.14;
  // Clamp to the actual image so we never sample outside it.
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(W, x1);
  y1 = Math.min(H, y1);

  const rw = x1 - x0;
  const rh = y1 - y0;

  const outW = 768;
  const outH = 1024;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, outW, outH);

  // "contain" fit — the whole region is visible, nothing cropped away.
  const scale = Math.min(outW / rw, outH / rh);
  const dw = rw * scale;
  const dh = rh * scale;
  const dx = (outW - dw) / 2;
  const dy = (outH - dh) / 2;
  ctx.drawImage(source, x0, y0, rw, rh, dx, dy, dw, dh);
  return out;
}

/** Replace the background with a clean light-gray plate using selfie segmentation. */
async function removeBackground(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const seg = await getSegmenter();
  const w = canvas.width;
  const h = canvas.height;
  const res = seg.segment(canvas);
  const mask = res.confidenceMasks?.[0];
  if (!mask) {
    res.close?.();
    return canvas;
  }
  const conf = mask.getAsFloat32Array();
  const mw = mask.width;
  const mh = mask.height;

  const srcCtx = canvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  const dst = outCtx.createImageData(w, h);

  const BG = [240, 240, 240];
  for (let y = 0; y < h; y++) {
    const my = mh === h ? y : Math.floor((y / h) * mh);
    for (let x = 0; x < w; x++) {
      const mx = mw === w ? x : Math.floor((x / w) * mw);
      let a = conf[my * mw + mx]; // foreground (person) probability 0..1
      // Smooth (feathered) matte — avoids hard halos/ghosting at the edges.
      a = a <= 0.25 ? 0 : a >= 0.8 ? 1 : (a - 0.25) / 0.55;
      a = a * a * (3 - 2 * a); // smoothstep
      const i = (y * w + x) * 4;
      dst.data[i] = src.data[i] * a + BG[0] * (1 - a);
      dst.data[i + 1] = src.data[i + 1] * a + BG[1] * (1 - a);
      dst.data[i + 2] = src.data[i + 2] * a + BG[2] * (1 - a);
      dst.data[i + 3] = 255;
    }
  }
  outCtx.putImageData(dst, 0, 0);
  mask.close?.();
  res.close?.();
  return out;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png')
  );
}

/**
 * Full prep pipeline: analyze the pose, auto-crop & center the person to a
 * portrait framing the try-on model likes, optionally remove the background,
 * and return a ready-to-send blob plus a quality checklist.
 */
export async function preparePersonPhoto(
  source: HTMLImageElement,
  opts: { removeBackground: boolean }
): Promise<PreparedPhoto> {
  // Analyze on a small copy (fast), but crop from the full-res original (sharp).
  const small = drawScaled(source, source.naturalWidth, source.naturalHeight, 1024);
  const pose = await getPose();
  const result = pose.detect(small);
  const { checks, box } = analyzeLandmarks(result.landmarks?.[0] as Lm[] | undefined);

  let out = box
    ? framePortrait(source, box)
    : drawScaled(source, source.naturalWidth, source.naturalHeight, 1024);
  if (opts.removeBackground) {
    try {
      out = await removeBackground(out);
    } catch {
      /* fall back to the un-removed crop */
    }
  }
  const blob = await toBlob(out);
  return { blob, url: URL.createObjectURL(blob), checks };
}

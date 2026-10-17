import type { TryOnAnchors } from './types';

// Sensible defaults for a front-facing top/shirt cutout whose shoulder seams
// sit near the top quarter of the image. Fine-tune per garment.
export const DEFAULT_ANCHORS: TryOnAnchors = {
  leftX: 0.26,
  leftY: 0.14,
  rightX: 0.74,
  rightY: 0.14,
  scale: 1.12,
  offsetY: 0.02,
};

// A single MediaPipe pose landmark (normalized 0..1 coordinates).
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// MediaPipe Pose landmark indices we rely on.
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;

interface Pt {
  x: number;
  y: number;
}

/**
 * Warp + draw a transparent garment image onto a body using a 2-point
 * similarity transform (translate + uniform scale + rotate) derived from the
 * shoulder landmarks. The garment follows the person as they move, tilt, and
 * change distance to the camera — enough to feel "worn" without a GPU.
 *
 * @param mirror  set true for a selfie webcam feed drawn mirrored, so the
 *                garment lines up with the flipped video.
 */
export function drawGarment(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  landmarks: Landmark[],
  canvasW: number,
  canvasH: number,
  anchors: TryOnAnchors,
  mirror: boolean
): boolean {
  if (!landmarks || landmarks.length <= R_HIP) return false;
  if (!garment.complete || !garment.naturalWidth) return false;

  const toPx = (lm: Landmark): Pt => ({
    x: (mirror ? 1 - lm.x : lm.x) * canvasW,
    y: lm.y * canvasH,
  });

  const sL = toPx(landmarks[L_SHOULDER]);
  const sR = toPx(landmarks[R_SHOULDER]);
  const hL = toPx(landmarks[L_HIP]);
  const hR = toPx(landmarks[R_HIP]);

  // Torso height (shoulder mid -> hip mid) drives the vertical-offset nudge.
  const shoulderMid: Pt = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };
  const hipMid: Pt = { x: (hL.x + hR.x) / 2, y: (hL.y + hR.y) / 2 };
  const torsoH =
    Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y) || canvasH * 0.4;

  // Work in screen-space left/right so it's robust regardless of mirroring or
  // which way the person faces.
  let P1 = sL;
  let P2 = sR;
  if (P1.x > P2.x) [P1, P2] = [P2, P1];

  // Scale the garment about the shoulder midline and nudge it vertically.
  const mid: Pt = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
  const dy = anchors.offsetY * torsoH;
  const T1: Pt = {
    x: mid.x + (P1.x - mid.x) * anchors.scale,
    y: mid.y + (P1.y - mid.y) * anchors.scale + dy,
  };
  const T2: Pt = {
    x: mid.x + (P2.x - mid.x) * anchors.scale,
    y: mid.y + (P2.y - mid.y) * anchors.scale + dy,
  };

  // Garment anchor points in pixel space.
  const gw = garment.naturalWidth;
  const gh = garment.naturalHeight;
  const A1: Pt = { x: anchors.leftX * gw, y: anchors.leftY * gh };
  const A2: Pt = { x: anchors.rightX * gw, y: anchors.rightY * gh };

  // Solve the similarity transform mapping A1->T1 and A2->T2.
  const dA: Pt = { x: A2.x - A1.x, y: A2.y - A1.y };
  const dT: Pt = { x: T2.x - T1.x, y: T2.y - T1.y };
  const lenA = Math.hypot(dA.x, dA.y) || 1;
  const scale = Math.hypot(dT.x, dT.y) / lenA;
  const angle = Math.atan2(dT.y, dT.x) - Math.atan2(dA.y, dA.x);

  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  // Affine matrix [a c e ; b d f]
  const a = cos;
  const b = sin;
  const c = -sin;
  const d = cos;
  const e = T1.x - (a * A1.x + c * A1.y);
  const f = T1.y - (b * A1.x + d * A1.y);

  ctx.save();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(garment, 0, 0);
  ctx.restore();
  // Reset to identity so subsequent draws aren't affected.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}

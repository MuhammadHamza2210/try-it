// Normalized (0..1) anchor metadata describing where a garment cutout's
// shoulder seams sit and how it should be scaled/nudged onto a body.
export interface TryOnAnchors {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  scale: number;
  offsetY: number;
}

// A garment the shopper can try on: a transparent-PNG cutout + its fit anchors.
export interface Garment {
  id: string;
  name: string;
  url: string;
  anchors: TryOnAnchors;
}

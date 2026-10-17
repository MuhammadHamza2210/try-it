// Virtual Try-On engine configuration.
//
// By default the MediaPipe pose model + WASM runtime are pulled from a CDN
// (works out of the box). To make the feature fully OFFLINE, vendor these
// files under `frontend/public/mediapipe/` and set the two env vars below in
// `frontend/.env`:
//
//   VITE_POSE_WASM=/mediapipe/wasm
//   VITE_POSE_MODEL=/mediapipe/pose_landmarker_lite.task
//
// Download once from:
//   https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/  -> public/mediapipe/wasm/
//   https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

const MP_VERSION = '0.10.18';

export const POSE_WASM_BASE =
  import.meta.env.VITE_POSE_WASM ||
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;

export const POSE_MODEL_URL =
  import.meta.env.VITE_POSE_MODEL ||
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Selfie segmentation model — used to remove the background from the person
// photo before AI try-on (a clean plain backdrop gives noticeably better results).
export const SEG_MODEL_URL =
  import.meta.env.VITE_SEG_MODEL ||
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

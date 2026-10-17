# Try It — Virtual Try-On

A standalone, in-browser virtual try-on with **two modes**:

1. **Live preview** (on-device) — drop in a **transparent-PNG garment cutout**
   and see it overlaid on your body through your **webcam** or a **photo**. Pose
   estimation runs entirely on-device with MediaPipe; nothing leaves your device.
   Instant, but it's a graphic laid over you.
2. **AI photorealistic** (free, via Hugging Face) — upload one photo of yourself
   and an AI model (IDM-VTON) renders you *actually wearing* the garment. Needs a
   free Hugging Face token; the photo is sent to the free HF GPU space and takes
   ~30–90s (may queue when busy).

> This project was extracted out of the `ikhlas` store so the try-on engine can
> live and evolve on its own.

## AI photorealistic mode — one-time setup

1. Make a free account at <https://huggingface.co>.
2. Create an access token (role **Read**) at
   <https://huggingface.co/settings/tokens>.
3. In the app, switch **Step 2** to **AI photorealistic**, paste the token once
   (stored only in your browser).

### Automatic photo prep

You don't need to worry about getting the perfect angle — when you **Take Photo**
(with an on-screen body guide) or **Upload** one, the app automatically:

- **Checks the pose** (person found, head & shoulders in frame, torso visible,
  facing the camera) and shows a checklist + a tip if something's off — all
  on-device via MediaPipe.
- **Auto-crops & centers** you to the 3:4 framing the try-on model expects.
- **Removes the background** (optional toggle, on by default) using selfie
  segmentation, replacing it with a clean plate for better results.

Then press **Generate**. Best results still come from a real garment product
photo (set it in Step 1) rather than the cartoon cutouts.

## Quick start

```bash
cd "Try It"
npm install
npm run dev        # http://localhost:5180
```

Then:

1. Pick the bundled **Sample Kurta**, or **Add PNG** to upload your own
   transparent garment cutout.
2. Line the two dots up with the garment's shoulder seams and tune the fit
   sliders (shoulder Y, shoulder width, overall scale, vertical offset).
3. Switch to **Live Camera** (allow camera access) or **Upload Photo**, and hit
   **Save Snapshot** to download the result.

## How it works

- `src/tryon/usePoseLandmarker.ts` — lazily loads the MediaPipe Pose Landmarker
  (WASM, CPU) and exposes `detectVideo` / `detectImage`.
- `src/tryon/warp.ts` — `drawGarment()` solves a 2-point similarity transform
  from the detected shoulders and warps the garment onto the body. Exports
  `DEFAULT_ANCHORS`.
- `src/tryon/TryOnStage.tsx` — the canvas engine: mirrored webcam loop + still
  photo path, snapshot export.
- `src/App.tsx` — the "fitting room" UI: garment picker + fit tuning.

### Garment cutouts

A garment must be a **transparent PNG** (background removed) with the shoulder
seams roughly in the top quarter. Anchors are normalized `0..1` coordinates
within the image — tune them per garment in the **Fit** panel.

### Offline model (optional)

By default the pose model + WASM runtime load from a CDN. To run fully offline,
vendor the files under `public/mediapipe/` and set in a `.env`:

```
VITE_POSE_WASM=/mediapipe/wasm
VITE_POSE_MODEL=/mediapipe/pose_landmarker_lite.task
```

See `src/tryon/config.ts` for the download URLs.

## Regenerate the sample garment

```bash
cd tools
pip install pillow
python make_sample_garment.py   # writes ../public/sample-garment.png
```

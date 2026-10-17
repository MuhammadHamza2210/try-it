import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { POSE_MODEL_URL, POSE_WASM_BASE } from './config';

export type RunningMode = 'IMAGE' | 'VIDEO';

/**
 * Lazily loads the MediaPipe Pose Landmarker (WASM, CPU delegate) and exposes
 * detect helpers for both live video and still images. The heavy model is only
 * fetched when `ensure()` is first called — keep this hook inside a lazily
 * imported component so shoppers who never open Try-On don't download it.
 */
export function usePoseLandmarker() {
  const ref = useRef<PoseLandmarker | null>(null);
  const modeRef = useRef<RunningMode>('VIDEO');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(async () => {
    if (ref.current) return ref.current;
    setLoading(true);
    setError(null);
    try {
      const vision = await FilesetResolver.forVisionTasks(POSE_WASM_BASE);
      const lm = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      });
      ref.current = lm;
      modeRef.current = 'VIDEO';
      setReady(true);
      return lm;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load the pose model';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const setMode = useCallback(
    async (mode: RunningMode) => {
      const lm = await ensure();
      if (modeRef.current !== mode) {
        await lm.setOptions({ runningMode: mode });
        modeRef.current = mode;
      }
      return lm;
    },
    [ensure]
  );

  const detectVideo = useCallback((video: HTMLVideoElement, timestampMs: number) => {
    const lm = ref.current;
    if (!lm || modeRef.current !== 'VIDEO') return null;
    return lm.detectForVideo(video, timestampMs);
  }, []);

  const detectImage = useCallback((img: HTMLImageElement) => {
    const lm = ref.current;
    if (!lm || modeRef.current !== 'IMAGE') return null;
    return lm.detect(img);
  }, []);

  // Free native resources on unmount.
  useEffect(() => {
    return () => {
      try {
        ref.current?.close();
      } catch {
        /* ignore */
      }
      ref.current = null;
    };
  }, []);

  return { ensure, setMode, detectVideo, detectImage, ready, loading, error };
}

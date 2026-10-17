import { Client } from '@gradio/client';

// Free, open-source photorealistic virtual try-on model hosted on Hugging Face.
// It renders the *person actually wearing* the garment (folds, fit, body shape)
// rather than pasting a flat image on top. Runs on HF's shared free GPU, so it
// needs the caller's free HF token and may queue when busy.
const SPACE = 'yisol/IDM-VTON';

export interface AiTryOnParams {
  personBlob: Blob;
  garmentBlob: Blob;
  garmentDesc: string;
  token: string;
  /** progress / queue updates for the UI */
  onStatus?: (message: string) => void;
  seed?: number;
}

export interface AiTryOnResult {
  /** URL of the generated "wearing it" image */
  url: string;
}

/**
 * Calls IDM-VTON's `/tryon` endpoint and resolves with the generated image URL.
 * Throws a friendly Error on token / quota / availability problems.
 */
export async function runAiTryOn({
  personBlob,
  garmentBlob,
  garmentDesc,
  token,
  onStatus,
  seed = 42,
}: AiTryOnParams): Promise<AiTryOnResult> {
  onStatus?.('Connecting to the AI model…');

  let app: Client;
  try {
    app = await Client.connect(SPACE, { hf_token: token as `hf_${string}` });
  } catch (e) {
    throw new Error(
      'Could not connect to the AI model. Check your Hugging Face token and internet connection.' +
        (e instanceof Error ? ` (${e.message})` : '')
    );
  }

  const submission = app.submit('/tryon', [
    // Human input is an ImageEditor — auto-mask is on, so no drawn mask needed.
    { background: personBlob, layers: [], composite: personBlob },
    garmentBlob,
    garmentDesc || 'garment',
    true, // use auto-generated mask
    false, // auto-crop & resize
    38, // denoising steps (higher = more detail/accuracy, a bit slower)
    seed,
  ]);

  for await (const msg of submission) {
    if (msg.type === 'status') {
      const status = msg as { stage?: string; position?: number; message?: string };
      if (status.stage === 'error') {
        const m = String(status.message || '').toLowerCase();
        throw new Error(
          m.includes('quota') || m.includes('gpu')
            ? 'The free GPU quota is used up for now. Wait a bit and try again, or try later.'
            : m.includes('token') || m.includes('auth')
              ? 'Your Hugging Face token was rejected. Double-check it (it should start with "hf_").'
              : `The AI model reported an error${status.message ? `: ${status.message}` : '.'}`
        );
      }
      if (status.stage === 'pending') {
        if (typeof status.position === 'number' && status.position > 0) {
          onStatus?.(`In queue — position ${status.position + 1}. This can take a minute…`);
        } else {
          onStatus?.('Generating your try-on… (this takes ~30–90s)');
        }
      }
    } else if (msg.type === 'data') {
      const out = (msg as { data?: unknown[] }).data?.[0] as
        | string
        | { url?: string; path?: string }
        | undefined;
      const url = typeof out === 'string' ? out : out?.url || out?.path;
      if (url) {
        onStatus?.('Done!');
        return { url };
      }
      throw new Error('The AI model returned no image. Please try again.');
    }
  }

  throw new Error('The AI model finished without returning an image. Please try again.');
}

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Small, fast model — 384-dim embeddings, ~23 MB, runs entirely in-process.
const MODEL = "Xenova/all-MiniLM-L6-v2";

let _pipeline: FeatureExtractionPipeline | null = null;
let _loading: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;
  if (_loading) return _loading;
  _loading = pipeline("feature-extraction", MODEL, { dtype: "fp32" }).then(
    (p) => {
      _pipeline = p as FeatureExtractionPipeline;
      return _pipeline;
    },
  );
  return _loading;
}

/** Always enabled — no API key required. */
export function embeddingsEnabled(): boolean {
  return true;
}

/** Generate a normalised embedding vector for a text string. */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const pipe = await getPipeline();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    // output is a Tensor — convert to a plain JS array
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.error("[embeddings] Failed to embed text:", err);
    return null;
  }
}

/** Cosine similarity between two equal-length vectors (range −1 to 1). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Build the text that gets embedded for a tour — concatenates all semantically useful fields. */
export function tourToEmbeddingText(tour: {
  title: string;
  description: string;
  location: string;
  itinerarySteps: unknown;
}): string {
  const steps = Array.isArray(tour.itinerarySteps)
    ? (tour.itinerarySteps as Array<{ type?: string; title?: string; description?: string }>)
        .map((s) => [s.type, s.title, s.description].filter(Boolean).join(": "))
        .join(". ")
    : "";
  return `${tour.title}. ${tour.description}. Location: ${tour.location}. ${steps}`.trim();
}

/**
 * Optional semantic search.
 *
 * `@huggingface/transformers` (and its `onnxruntime-node` native runtime) are
 * ~400 MB installed, so they are declared as OPTIONAL dependencies and are not
 * installed in the production Docker image. They are loaded lazily via dynamic
 * import; if the package is absent, `getEmbedding()` returns null and callers
 * fall back to keyword search.
 *
 * To enable semantic search, install the optional deps and set
 * ENABLE_SEMANTIC_SEARCH=true.
 */

// Small, fast model — 384-dim embeddings, ~23 MB, runs entirely in-process.
const MODEL = "Xenova/all-MiniLM-L6-v2";

type EmbedFn = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let _pipeline: EmbedFn | null = null;
let _loading: Promise<EmbedFn | null> | null = null;
/** Set once the optional dependency is known to be missing, so we stop retrying. */
let _unavailable = false;

/**
 * Semantic search is opt-in. Without it the search endpoint uses its keyword
 * (ILIKE) path, which is always available.
 */
export function embeddingsEnabled(): boolean {
  return process.env["ENABLE_SEMANTIC_SEARCH"] === "true" && !_unavailable;
}

async function getPipeline(): Promise<EmbedFn | null> {
  if (_pipeline) return _pipeline;
  if (_unavailable) return null;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // Indirected through a variable so esbuild leaves it as a runtime
      // require rather than trying to bundle the package at build time.
      const moduleName = "@huggingface/transformers";
      const transformers = (await import(
        /* @vite-ignore */ moduleName
      )) as typeof import("@huggingface/transformers");

      // Cache the downloaded model on the persistent volume, otherwise it is
      // re-downloaded on every container restart.
      const modelCacheDir = process.env["MODEL_CACHE_DIR"];
      if (modelCacheDir) {
        transformers.env.cacheDir = modelCacheDir;
      }

      const pipe = await transformers.pipeline("feature-extraction", MODEL, {
        dtype: "fp32",
      });
      _pipeline = pipe as unknown as EmbedFn;
      return _pipeline;
    } catch (err) {
      _unavailable = true;
      console.warn(
        "[embeddings] Semantic search unavailable, falling back to keyword search:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  })();

  return _loading;
}

/** Generate a normalised embedding vector, or null if unavailable. */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  try {
    const pipe = await getPipeline();
    if (!pipe) return null;
    const output = await pipe(text, { pooling: "mean", normalize: true });
    // output is a Tensor — convert to a plain JS array
    return Array.from(output.data);
  } catch (err) {
    console.error("[embeddings] Failed to embed text:", err);
    return null;
  }
}

/** Cosine similarity between two equal-length vectors (range −1 to 1). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
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
    ? (
        tour.itinerarySteps as Array<{
          type?: string;
          title?: string;
          description?: string;
        }>
      )
        .map((s) => [s.type, s.title, s.description].filter(Boolean).join(": "))
        .join(". ")
    : "";
  return `${tour.title}. ${tour.description}. Location: ${tour.location}. ${steps}`.trim();
}

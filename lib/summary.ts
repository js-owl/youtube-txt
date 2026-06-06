// Общие типы и type-guards для всего, что связано с саммари.
// Этот файл — единый источник правды для фронта и бэкенда.

export type Summary = {
  title: string;
  channel: string;
  duration: string;
  mainIdea: string;
  keyPoints: string[];
};

// Контракт API: то, что бэкенд отдаёт фронтенду.
export type SummarizeApiSuccess = {
  success: true;
  data: {
    title: string;
    channel: string;
    duration: string;
    mainThought: string;
    keyPoints: string[];
  };
};

export type SummarizeApiError = {
  success: false;
  error: string;
};

export type SummarizeApiResponse = SummarizeApiSuccess | SummarizeApiError;

// ====== Внешние API: shape-описания и type-guards ======

// Supadata: https://docs.supadata.ai
// Возвращает объект с полем content: [{ text, offset, duration, lang }, ...]
// Документацию контракта нужно сверить — это узкий type-guard.
type SupadataSegment = {
  text: string;
  offset?: number;
  duration?: number;
  lang?: string;
};

type SupadataTranscript = {
  content: SupadataSegment[];
  lang?: string;
  availableLangs?: string[];
};

export function isSupadataTranscript(x: unknown): x is SupadataTranscript {
  if (typeof x !== "object" || x === null) return false;
  const c = (x as { content?: unknown }).content;
  if (!Array.isArray(c)) return false;
  return c.every(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as { text?: unknown }).text === "string",
  );
}

export function extractTranscriptText(x: SupadataTranscript): string {
  return x.content.map((s) => s.text).join(" ");
}

// YouTube oEmbed: https://noembed.com/embed?url=...
// { title, author_name, author_url, type, ... }
type OEmbedResponse = {
  title: string;
  author_name: string;
  author_url?: string;
  type?: string;
};

export function isOEmbedResponse(x: unknown): x is OEmbedResponse {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { title?: unknown; author_name?: unknown };
  return typeof o.title === "string" && typeof o.author_name === "string";
}

// Gemini summary shape — то, что модель обязана вернуть.
type GeminiSummary = {
  mainThought: string;
  keyPoints: string[];
};

export function isGeminiSummary(x: unknown): x is GeminiSummary {
  if (typeof x !== "object" || x === null) return false;
  const s = x as { mainThought?: unknown; keyPoints?: unknown };
  return (
    typeof s.mainThought === "string" &&
    Array.isArray(s.keyPoints) &&
    s.keyPoints.every((p) => typeof p === "string")
  );
}

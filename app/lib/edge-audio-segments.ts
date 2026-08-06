import { textChunks } from "./document-parser";

const EDGE_SEGMENT_LIMIT = 3000;

export function edgeAudioSegments(text: string, maximumSourceChunks = Number.POSITIVE_INFINITY) {
  const source = textChunks(text).slice(0, maximumSourceChunks).join(" ");
  const sentences = source.match(/[^.!?]+[.!?]*/g) ?? [source];
  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (current && `${current} ${piece}`.length > EDGE_SEGMENT_LIMIT) {
      segments.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }

  if (current) segments.push(current);
  return segments;
}

export function estimatedSentenceIndex(sentences: string[], ratio: number) {
  if (!sentences.length) return 0;
  const weights = sentences.map((sentence) => {
    const words = sentence.trim().split(/\s+/).filter(Boolean).length;
    const pauses = (sentence.match(/[,;:—-]/g) ?? []).length * 0.35;
    return Math.max(1, words + pauses);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = Math.max(0, Math.min(1, ratio)) * total;
  let cursor = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index];
    if (target <= cursor) return index;
  }
  return sentences.length - 1;
}

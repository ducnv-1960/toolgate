function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

interface DocEntry {
  termFreq: Map<string, number>;
  length: number;
}

const _docs = new Map<string, DocEntry>();
const _df = new Map<string, Set<string>>(); // term -> set of doc IDs

const K1 = 1.5;
const B = 0.75;

function avgDocLen(): number {
  if (_docs.size === 0) return 1;
  let total = 0;
  for (const d of _docs.values()) total += d.length;
  return total / _docs.size;
}

export function bm25Add(id: string, text: string): void {
  bm25Remove(id); // clean up old entry if present

  const tokens = tokenize(text);
  const termFreq = new Map<string, number>();
  for (const t of tokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);

  _docs.set(id, { termFreq, length: tokens.length });

  for (const term of termFreq.keys()) {
    if (!_df.has(term)) _df.set(term, new Set());
    _df.get(term)!.add(id);
  }
}

export function bm25Remove(id: string): void {
  const entry = _docs.get(id);
  if (!entry) return;
  for (const term of entry.termFreq.keys()) {
    const docSet = _df.get(term);
    if (docSet) {
      docSet.delete(id);
      if (docSet.size === 0) _df.delete(term);
    }
  }
  _docs.delete(id);
}

export function bm25Clear(): void {
  _docs.clear();
  _df.clear();
}

export function bm25Search(
  query: string,
  topK: number = 10
): Array<{ id: string; score: number }> {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || _docs.size === 0) return [];

  const N = _docs.size;
  const avgl = avgDocLen();
  const scores = new Map<string, number>();

  for (const term of queryTerms) {
    const docSet = _df.get(term);
    if (!docSet) continue;
    const df = docSet.size;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

    for (const docId of docSet) {
      const entry = _docs.get(docId)!;
      const tf = entry.termFreq.get(term) ?? 0;
      const norm = K1 * (1 - B + B * (entry.length / avgl));
      const tfScore = (tf * (K1 + 1)) / (tf + norm);
      scores.set(docId, (scores.get(docId) ?? 0) + idf * tfScore);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, score]) => ({ id, score }));
}

export function bm25Size(): number {
  return _docs.size;
}

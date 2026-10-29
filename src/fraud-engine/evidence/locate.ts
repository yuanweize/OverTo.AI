export interface EvidenceSpan { start: number; end: number; text: string }
/** NFC comparison with grapheme boundaries mapped back to original UTF-16 offsets. */
export function locateEvidence(text: string, quote: string): { spans: EvidenceSpan[]; truncated: boolean } {
  if (!quote || text.length > 10000 || quote.length > 10000) return { spans: [], truncated: false };
  let normalized = '';
  const boundaries = new Map<number, number>([[0,0]]);
  for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    boundaries.set(normalized.length, segment.index);
    normalized += segment.segment.normalize('NFC');
    boundaries.set(normalized.length, segment.index + segment.segment.length);
  }
  const needle = quote.normalize('NFC');
  const spans: EvidenceSpan[] = [];
  let from = 0;
  while (from <= normalized.length - needle.length) {
    const at = normalized.indexOf(needle, from);
    if (at < 0) break;
    from = at + 1;
    const start = boundaries.get(at), end = boundaries.get(at + needle.length);
    if (start === undefined || end === undefined) continue;
    if (spans.length === 128) return { spans, truncated: true };
    spans.push({ start, end, text: text.slice(start,end) });
  }
  return { spans, truncated: false };
}

/** Read at most maxBytes, with a deadline for slow or stalled request bodies. */
export async function readRequestBody(request: Request, maxBytes: number, timeoutMs = 10_000): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BODY_MISSING');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('BODY_TIMEOUT')), timeoutMs); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('BODY_TOO_LARGE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally { if (timer) clearTimeout(timer); }
}

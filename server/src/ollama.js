// Small client for a local Ollama server (https://ollama.com). Visitors' questions never leave your own server.
export const ollamaEnabled = () => !!process.env.OLLAMA_URL;
export const chatModel = () => process.env.OLLAMA_MODEL || 'llama3.2';
export const embedModel = () => process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const base = () => String(process.env.OLLAMA_URL || '').replace(/\/$/, '');

async function call(path, body, timeoutMs, method = 'POST') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(base() + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Ollama answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Ollama did not answer within ${Math.round(timeoutMs / 1000)} seconds`);
    throw e;
  } finally { clearTimeout(timer); }
}

export async function chat(messages) {
  const data = await call('/api/chat', {
    model: chatModel(), messages, stream: false, keep_alive: '30m',
    options: { temperature: 0.2, num_predict: 350 },
  }, Number(process.env.OLLAMA_TIMEOUT_MS || 60000));
  return data?.message?.content || '';
}

export async function embed(texts) {
  const data = await call('/api/embed', { model: embedModel(), input: texts }, 60000);
  if (!Array.isArray(data?.embeddings) || data.embeddings.length !== texts.length) throw new Error('Ollama returned no embeddings');
  return data.embeddings;
}

export async function installedModels() {
  const data = await call('/api/tags', null, 5000, 'GET');
  return (data?.models || []).map((m) => m.name);
}

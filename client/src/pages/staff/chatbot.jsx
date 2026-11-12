import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Trash2, Upload, RefreshCw, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../api.js';
import { Err } from './panels.jsx';

const Ok = ({ msg }) => (msg ? <p role="status" className="my-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{msg}</p> : null);
const MAX_BYTES = 300 * 1024;
const VIA = {
  llm: 'Answered by the AI from the knowledge',
  'no-source': 'Handed to staff: nothing in the knowledge matched well enough',
  'no-answer': 'Handed to staff: the AI could not answer from the knowledge',
  request: 'Handed to staff: the visitor asked for a person',
  smalltalk: 'Greeting or thanks',
  rules: 'Built-in answers (the AI was not used)',
};

function Status({ s, onRebuild, busy }) {
  const line = (good, label, detail) => (
    <li className="flex items-start gap-2 text-sm">
      {good ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-700" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" />}
      <span><b className="font-semibold">{label}:</b> {detail}</span>
    </li>
  );
  return (
    <div className="rounded-xl border border-ink/15 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl">Assistant status</h3>
        <button className="btn btn-ghost" onClick={onRebuild} disabled={busy}><RefreshCw size={16} />{busy ? 'Rebuilding…' : 'Rebuild knowledge'}</button>
      </div>
      <ul className="mt-4 space-y-2">
        {line(s.enabled, 'AI assistant', s.enabled ? `on (Ollama at ${s.url})` : 'off. Set OLLAMA_URL in server/.env to turn it on. Until then the built-in answers are used.')}
        {s.enabled && line(s.reachable, 'Ollama', s.reachable ? 'connected' : `not reachable${s.error ? ` (${s.error})` : ''}. Is Ollama running? Visitors get the built-in answers meanwhile.`)}
        {s.enabled && s.reachable && line(s.has_chat_model, `Chat model ${s.chat_model}`, s.has_chat_model ? 'installed' : `not installed. Run: ollama pull ${s.chat_model}`)}
        {s.enabled && s.reachable && line(s.has_embed_model && s.search_mode === 'embeddings', `Search model ${s.embed_model}`, s.search_mode === 'embeddings' ? 'installed, searching by meaning' : `not available, so searching by keywords. For better matching run: ollama pull ${s.embed_model}${s.embed_error ? ` (${s.embed_error})` : ''}`)}
        {line(s.passages > 0, 'Knowledge', `${s.files.length} file(s) plus the live office data, ${s.passages} passages${s.built_at ? `, built ${new Date(s.built_at).toLocaleTimeString()}` : ''}`)}
      </ul>
    </div>
  );
}

export function ChatbotPanel() {
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null); // { name, content, isNew }
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const [asking, setAsking] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => { try { setStatus(await api('/chatbot/status')); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  const rebuild = async () => {
    setErr(''); setOk(''); setBusy(true);
    try { await api('/chatbot/reindex', { method: 'POST' }); await load(); setOk('Knowledge rebuilt.'); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const open = async (name) => {
    setErr(''); setOk('');
    try { const d = await api(`/chatbot/files/${encodeURIComponent(name)}`); setEditor({ name, content: d.content, isNew: false }); } catch (e) { setErr(e.message); }
  };
  const save = async (e) => {
    e.preventDefault(); setErr(''); setOk('');
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,80}\.(md|txt)$/i.test(editor.name.trim())) return setErr('Use a file name like fees-and-payments.md (letters, numbers, spaces, - and _; ending in .md or .txt).');
    if (!editor.content.trim()) return setErr('The file is empty. Write the information visitors should be able to ask about.');
    setBusy(true);
    try {
      await api(`/chatbot/files/${encodeURIComponent(editor.name.trim())}`, { method: 'PUT', body: { content: editor.content } });
      setOk(`${editor.name.trim()} saved and added to the chatbot's knowledge.`); setEditor(null); await load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const remove = async (name) => {
    if (!window.confirm(`Delete ${name}? The chatbot will no longer use it.`)) return;
    setErr(''); setOk('');
    try { await api(`/chatbot/files/${encodeURIComponent(name)}`, { method: 'DELETE' }); setEditor(null); await load(); setOk(`${name} deleted.`); } catch (x) { setErr(x.message); }
  };
  const pick = (e) => { // read a text file in the browser; the admin reviews it before saving
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setOk('');
    if (!/\.(md|txt)$/i.test(f.name)) return setErr('Only .md and .txt files can be used. For PDF or Word files, copy the text into a .txt file first.');
    if (f.size > MAX_BYTES) return setErr('That file is too large (300 KB maximum).');
    const r = new FileReader();
    r.onload = () => setEditor({ name: f.name, content: String(r.result), isNew: true });
    r.onerror = () => setErr('Could not read that file.');
    r.readAsText(f);
  };
  const ask = async (e) => {
    e.preventDefault(); setErr(''); setResult(null);
    if (q.trim().length < 2) return setErr('Type a question to test.');
    setAsking(true);
    try { setResult(await api('/chatbot/test', { method: 'POST', body: { question: q } })); } catch (x) { setErr(x.message); } finally { setAsking(false); }
  };

  return (
    <div className="space-y-8">
      <Err msg={err} /><Ok msg={ok} />
      {status && <Status s={status} onRebuild={rebuild} busy={busy} />}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl">Knowledge files</h3>
            <p className="text-sm text-ink/60">The chatbot answers only from these files and the live office data (hours, services, documents). If the answer is not there, it hands the chat to staff.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => fileInput.current?.click()}><Upload size={16} />Upload a file</button>
            <button className="btn btn-primary" onClick={() => setEditor({ name: '', content: '', isNew: true })}>New file</button>
            <input ref={fileInput} type="file" accept=".md,.txt,text/plain,text/markdown" className="sr-only" aria-label="Upload a text file" onChange={pick} />
          </div>
        </div>
        <ul className="mt-4 divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white">
          {status?.files.map((f) => (
            <li key={f.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-teal" /><div className="min-w-0"><p className="truncate font-medium">{f.name}</p><p className="text-xs text-ink/60">{f.chars.toLocaleString()} characters · {f.chunks} passage(s) · updated {new Date(f.updated).toLocaleString()}</p></div></div>
              <div className="flex gap-2">
                <button className="btn btn-ghost px-3 py-1.5" onClick={() => open(f.name)}>Edit</button>
                <button className="btn btn-danger px-2 py-2" aria-label={`Delete ${f.name}`} onClick={() => remove(f.name)}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
          {status && !status.files.length && <li className="px-4 py-6 text-sm text-ink/60">No files yet. Add facts the live data does not cover, such as fees, processing times, holidays and office rules. Until then, questions about those go to staff.</li>}
        </ul>
      </section>

      {editor && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-seal/60 bg-paper p-5">
          <h3 className="text-xl">{editor.isNew ? 'Add a knowledge file' : `Edit ${editor.name}`}</h3>
          <div>
            <label className="label" htmlFor="kf-name">File name</label>
            <input id="kf-name" className="input max-w-md" maxLength={85} placeholder="e.g. fees-and-payments.md" value={editor.name} readOnly={!editor.isNew} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="kf-content">Content</label>
            <textarea id="kf-content" rows={14} maxLength={300000} className="input font-mono" placeholder={'# Fees\n\n## Certified copy of a birth certificate\nWrite the facts in plain sentences, one topic per heading.'} value={editor.content} onChange={(e) => setEditor({ ...editor, content: e.target.value })} />
            <p className="mt-1 text-xs text-ink/60">Visitors may be quoted anything written here. Use short headings and complete sentences. Do not write anything you are unsure of.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save file'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      )}

      <section>
        <h3 className="text-xl">Try the chatbot</h3>
        <p className="text-sm text-ink/60">Ask a question exactly as a visitor would. You will see the answer, whether it would hand off to staff, and which passages it found.</p>
        <form onSubmit={ask} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="kf-q">Test question</label>
          <input id="kf-q" className="input min-w-[16rem] flex-1" maxLength={500} placeholder="e.g. What documents do I need for a birth certificate?" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary" disabled={asking}><Send size={16} />{asking ? 'Thinking…' : 'Ask'}</button>
        </form>
        {asking && <p className="mt-3 text-sm text-ink/60">The first question after starting Ollama can take a while while the model loads.</p>}
        {result && (
          <div className="mt-4 space-y-3 rounded-xl border border-ink/15 bg-white p-5" aria-live="polite">
            <p className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${result.handoff ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'}`}>{result.handoff ? 'Would hand off to staff' : 'Would answer'}</p>
            <p className="whitespace-pre-wrap text-sm">{result.reply}</p>
            <p className="text-xs text-ink/60">{VIA[result.via] || result.via} · {result.ms} ms{result.mode ? ` · search: ${result.mode}` : ''}</p>
            {result.retrieved?.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">Passages found ({result.retrieved.length})</summary>
                <ul className="mt-2 space-y-2">
                  {result.retrieved.map((p, i) => (
                    <li key={i} className={`rounded-lg border p-3 text-xs ${p.used ? 'border-green-300 bg-green-50' : 'border-ink/10 bg-paper'}`}>
                      <p className="font-semibold">{p.source}{p.heading ? ` > ${p.heading}` : ''} · score {p.score} · {p.used ? 'used' : 'too low to use'}</p>
                      <p className="mt-1 text-ink/70">{p.text}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink/55">Too many wrong hand-offs? Lower CHATBOT_MIN_SCORE_EMBED (or _KEYWORD) a little in server/.env. Wrong answers? Raise it.</p>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

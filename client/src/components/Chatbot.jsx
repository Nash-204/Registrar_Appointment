import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { api } from '../api.js';

const STATUS = { bot: 'Automated assistant', waiting_handoff: 'Waiting for a staff member…', assigned: 'Chatting with staff', closed: 'Chat ended' };

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => JSON.parse(sessionStorage.getItem('chat') || 'null'));
  const [msgs, setMsgs] = useState([]);
  const [status, setStatus] = useState('bot');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [typing, setTyping] = useState(false); // the assistant is preparing a reply
  const last = useRef(0);
  const end = useRef(null);
  const hdr = session ? { 'x-visitor-token': session.token } : {};

  const pull = async () => {
    if (!session) return;
    try {
      const d = await api(`/chat/sessions/${session.id}/messages?after=${last.current}`, { headers: hdr });
      setStatus(d.status);
      if (d.messages.length) { last.current = d.messages.at(-1).id; setMsgs((m) => [...m, ...d.messages]); }
      if (d.status !== 'bot' || d.messages.some((m) => m.sender_type !== 'visitor')) setTyping(false); // a reply arrived, or a person took over
    } catch { sessionStorage.removeItem('chat'); setSession(null); setMsgs([]); last.current = 0; }
  };

  useEffect(() => {
    if (!open || !session) return;
    pull();
    const t = setInterval(pull, 3000);
    return () => clearInterval(t);
  }, [open, session?.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, typing]);
  useEffect(() => { // never leave the indicator on forever if something goes wrong on the server
    if (!typing) return undefined;
    const t = setTimeout(() => setTyping(false), 90000);
    return () => clearTimeout(t);
  }, [typing]);

  const start = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const s = await api('/chat/sessions', { method: 'POST', body: { name } });
      sessionStorage.setItem('chat', JSON.stringify(s)); setSession(s);
    } catch (x) { setErr(x.message); }
  };
  const send = async (e) => {
    e.preventDefault();
    const m = text.trim(); if (!m) return;
    setText(''); setErr('');
    if (status === 'bot') setTyping(true);
    try { await api(`/chat/sessions/${session.id}/messages`, { method: 'POST', body: { message: m }, headers: hdr }); await pull(); }
    catch (x) { setErr(x.message); setTyping(false); }
  };
  const restart = () => { sessionStorage.removeItem('chat'); setSession(null); setMsgs([]); last.current = 0; setStatus('bot'); setTyping(false); };

  return (
    <>
      {open && (
        <section className="fixed bottom-24 right-4 z-50 flex h-[28rem] max-h-[75vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-ink/20 bg-white shadow-xl" aria-label="Help chat">
          <div className="bg-ink px-4 py-3 text-white">
            <p className="font-serif text-base">Registry help</p>
            <p className="text-xs text-white/70">{session ? STATUS[status] : 'Ask about hours, requirements or booking'}</p>
          </div>
          {!session ? (
            <form onSubmit={start} className="flex flex-1 flex-col justify-center gap-3 p-4">
              <label className="label" htmlFor="cn">Your name</label>
              <input id="cn" maxLength={120} placeholder="Your name (optional)" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-primary">Start chat</button>
              {err && <p className="text-sm text-red-700">{err}</p>}
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-mist/50 p-3" aria-live="polite">
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                    <p className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.sender_type === 'visitor' ? 'bg-teal text-white' : m.sender_type === 'employee' ? 'border border-seal bg-white' : 'bg-white'}`}>
                      {m.sender_type === 'employee' && <span className="mb-0.5 block text-xs font-semibold text-sealdark">Staff</span>}{m.message}
                    </p>
                  </div>
                ))}
                {typing && <div className="flex justify-start" role="status"><p className="rounded-lg bg-white px-3 py-2 text-sm text-ink/60">Assistant is typing…</p></div>}
                <div ref={end} />
              </div>
              {err && <p className="px-3 pt-1 text-xs text-red-700">{err}</p>}
              {status === 'closed' ? (
                <div className="p-3"><button className="btn btn-primary w-full" onClick={restart}>Start a new chat</button></div>
              ) : (
                <form onSubmit={send} className="flex gap-2 border-t border-ink/10 p-2">
                  <input className="input" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question" aria-label="Message" />
                  <button className="btn btn-primary px-3" aria-label="Send"><Send size={16} /></button>
                </form>
              )}
            </>
          )}
        </section>
      )}
      <button onClick={() => setOpen(!open)} aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-4 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-seal text-ink shadow-lg hover:bg-[#dca02d]">
        {open ? <X /> : <MessageCircle />}
      </button>
    </>
  );
}

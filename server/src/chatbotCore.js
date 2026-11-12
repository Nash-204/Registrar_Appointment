// The chatbot's decision flow. Dependencies are passed in, so the flow can be tested without a model or a database.
import { isHandoffRequest, smallTalkReply, botReply } from './bot.js';
import { buildMessages, parseModelAnswer } from './ragLogic.js';

export const HUMAN_REPLY = 'I will connect you with a staff member. Please wait here; someone will join this chat shortly.';
export const HANDOFF_REPLY = 'I am sorry, I cannot answer that reliably, so I am connecting you with a staff member. Please wait here; someone will reply in this chat shortly.';

const sources = (list) => [...new Set(list.map((r) => r.chunk.source))];
// Short follow-ups such as "how long does it take?" are searched together with the visitor's previous question.
const searchText = (question, history) => {
  const prev = [...history].reverse().find((m) => m.role === 'user');
  return question.length < 40 && prev ? `${prev.content} ${question}` : question;
};

export function createChatbot({ enabled, retrieve, llm, minScore, office, rules = botReply, log = console }) {
  return async function answer(question, history = [], { debug = false } = {}) {
    const q = String(question || '').trim();
    if (isHandoffRequest(q)) return { reply: HUMAN_REPLY, handoff: true, via: 'request' };
    const talk = smallTalkReply(q);
    if (talk) return { reply: talk, handoff: false, via: 'smalltalk' };

    if (enabled()) {
      try {
        const { results, mode } = await retrieve(searchText(q, history));
        const good = results.filter((r) => r.score >= minScore(mode));
        const extra = debug ? { mode, retrieved: results.map((r) => ({ source: r.chunk.source, heading: r.chunk.heading, score: Math.round(r.score * 1000) / 1000, text: r.chunk.text.slice(0, 300), used: r.score >= minScore(mode) })) } : {};
        if (!good.length) return { reply: HANDOFF_REPLY, handoff: true, via: 'no-source', ...extra }; // nothing in the knowledge matches, so a person should answer
        const { answer: text } = parseModelAnswer(await llm(buildMessages({ context: good, history, question: q, office: office() })));
        if (!text) return { reply: HANDOFF_REPLY, handoff: true, via: 'no-answer', sources: sources(good), ...extra };
        return { reply: text, handoff: false, via: 'llm', sources: sources(good), ...extra };
      } catch (e) {
        log.error('Chatbot AI is unavailable, using the built-in answers instead:', e.message);
      }
    }
    const r = rules(q);
    return { reply: r.reply, handoff: r.handoff, via: 'rules' };
  };
}

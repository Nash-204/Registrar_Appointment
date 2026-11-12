import { createChatbot } from './chatbotCore.js';
import { search, officeInfo } from './knowledge.js';
import { chat, ollamaEnabled } from './ollama.js';

const MIN_EMBED = Number(process.env.CHATBOT_MIN_SCORE_EMBED || 0.55);     // cosine similarity needed to trust a passage
const MIN_KEYWORD = Number(process.env.CHATBOT_MIN_SCORE_KEYWORD || 0.5);  // share of the question's words found in the passage
const MAX_PARALLEL = Number(process.env.OLLAMA_PARALLEL || 2);
const MAX_QUEUE = 20;

// Only a few questions go to the model at once; the rest wait their turn. A long queue falls back to the built-in answers.
let running = 0;
const waiting = [];
async function withSlot(fn) {
  while (running >= MAX_PARALLEL) {
    if (waiting.length >= MAX_QUEUE) throw new Error('The assistant is busy');
    await new Promise((resolve) => waiting.push(resolve));
  }
  running++;
  try { return await fn(); } finally { running--; waiting.shift()?.(); }
}

export const answerQuestion = createChatbot({
  enabled: ollamaEnabled,
  retrieve: (q) => search(q),
  llm: (messages) => withSlot(() => chat(messages)),
  minScore: (mode) => (mode === 'embeddings' ? MIN_EMBED : MIN_KEYWORD),
  office: officeInfo,
});

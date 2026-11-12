// Admin: manage the chatbot's knowledge files, check Ollama, and try questions.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { log } from '../db.js';
import { body, text } from '../validate.js';
import { ollamaEnabled, installedModels, chatModel, embedModel } from '../ollama.js';
import { answerQuestion } from '../chatbot.js';
import { knowledgeStatus, reindex, readKnowledgeFile, writeKnowledgeFile, deleteKnowledgeFile } from '../knowledge.js';
import { HttpError } from '../validate.js';

const r = Router();
r.use(requireAuth('admin'));

const wrapErr = async (fn) => { try { return await fn(); } catch (e) { if (e.status && !(e instanceof HttpError)) throw new HttpError(e.status, e.message); throw e; } };
const has = (models, m) => models.some((x) => x === m || x.startsWith(m + ':'));

r.get('/status', async (_req, res) => {
  const s = await knowledgeStatus();
  let reachable = false, models = [], error = null;
  if (ollamaEnabled()) { try { models = await installedModels(); reachable = true; } catch (e) { error = e.message; } }
  res.json({
    enabled: ollamaEnabled(), url: process.env.OLLAMA_URL || null, chat_model: chatModel(), embed_model: embedModel(),
    reachable, error, has_chat_model: has(models, chatModel()), has_embed_model: has(models, embedModel()),
    search_mode: s.mode, embed_error: s.embedError, passages: s.chunks, files: s.files, built_at: s.builtAt,
  });
});

r.get('/files/:name', async (req, res) => res.json({ name: req.params.name, content: await wrapErr(() => readKnowledgeFile(req.params.name)) }));

r.put('/files/:name', async (req, res) => {
  const content = text(body(req).content, 'Content', { min: 1, max: 300000, multiline: true });
  await wrapErr(() => writeKnowledgeFile(req.params.name, content));
  log(req.user.name, `Saved chatbot knowledge file ${req.params.name}`);
  res.json({ ok: true });
});

r.delete('/files/:name', async (req, res) => {
  await wrapErr(() => deleteKnowledgeFile(req.params.name));
  log(req.user.name, `Deleted chatbot knowledge file ${req.params.name}`);
  res.json({ ok: true });
});

r.post('/reindex', async (req, res) => {
  await reindex();
  res.json(await knowledgeStatus());
});

// Ask the bot a question exactly as a visitor would, and see what it found.
r.post('/test', async (req, res) => {
  const question = text(body(req).question, 'Question', { max: 500 });
  const started = Date.now();
  const out = await answerQuestion(question, [], { debug: true });
  res.json({ ...out, ms: Date.now() - started });
});

export default r;

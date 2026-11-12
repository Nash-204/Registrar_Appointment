import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSettings, saveSettings } from '../settings.js';
import { validateSettingsUpdate } from '../settingsLogic.js';
import { body } from '../validate.js';
import { log } from '../db.js';
import { nowCtx, sameDayOpen } from '../scheduleLogic.js';

const r = Router();

// Public: only what the booking page needs (hours, notice, and whether same-day online booking is open right now).
r.get('/public', async (_req, res) => {
  const s = await getSettings();
  res.json({
    office_open: s.office_open, office_close: s.office_close, booking_start: s.booking_start, booking_end: s.booking_end,
    max_days_ahead: s.max_days_ahead, checklist_notice: s.checklist_notice, same_day_open: sameDayOpen(s, nowCtx()),
  });
});

r.get('/', requireAuth('admin'), async (_req, res) => res.json(await getSettings()));

r.put('/', requireAuth('admin'), async (req, res) => {
  const current = await getSettings();
  const { next, changed } = validateSettingsUpdate(body(req), current);
  await saveSettings(changed);
  log(req.user.name, `Changed settings: ${Object.keys(changed).join(', ') || 'none'}`);
  res.json(next);
});

export default r;

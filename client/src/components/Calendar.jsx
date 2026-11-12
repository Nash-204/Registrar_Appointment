import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ value, onChange, min, max, hint = 'Weekends and dates outside the booking period can’t be selected.' }) {
  const start = value ? new Date(value + 'T00:00:00') : min;

  const [view, setView] = useState(
    () => new Date(start.getFullYear(), start.getMonth(), 1)
  );

  const minKey = key(min);
  const maxKey = key(max);
  const todayKey = key(new Date());

  const year = view.getFullYear();
  const month = view.getMonth();

  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();

  const cells = [
    ...Array(lead).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => new Date(year, month, i + 1)
    ),
  ];

  const canPrev = new Date(year, month, 0) >= min;
  const canNext = new Date(year, month + 1, 1) <= max;

  const go = (n) => setView(new Date(year, month + n, 1));

  return (
    <div
      className="w-full rounded-xl border border-ink/10 bg-white p-3 sm:p-6"
      role="group"
      aria-label="Choose a date"
    >
      {/* Month navigation */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-30"
          onClick={() => go(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>

        <p
          className="text-center font-serif text-lg font-semibold text-ink sm:text-xl"
          aria-live="polite"
        >
          {view.toLocaleDateString('en-PH', {
            month: 'long',
            year: 'numeric',
          })}
        </p>

        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-30"
          onClick={() => go(1)}
          disabled={!canNext}
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAYS.map((d) => (
          <span
            key={d}
            className="flex h-8 items-center justify-center text-xs font-semibold text-ink/50 sm:text-sm"
          >
            {d}
          </span>
        ))}

        {cells.map((d, i) => {
          if (!d) {
            return <span key={`b${i}`} aria-hidden="true" />;
          }

          const k = key(d);
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const off = weekend || k < minKey || k > maxKey;
          const sel = k === value;
          const today = k === todayKey;

          return (
            <button
              key={k}
              type="button"
              disabled={off}
              onClick={() => onChange(k)}
              aria-pressed={sel}
              aria-label={d.toLocaleDateString('en-PH', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              className={`h-11 min-w-0 rounded-lg text-sm transition-colors sm:h-14 sm:text-base ${
                sel
                  ? 'bg-teal font-bold text-white shadow-sm'
                  : off
                    ? 'cursor-not-allowed text-ink/25'
                    : 'text-ink hover:bg-mist'
              } ${
                today && !sel
                  ? 'ring-1 ring-inset ring-seal'
                  : ''
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Calendar legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-4 text-xs text-ink/60">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-teal" />
          Selected
        </span>

        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full ring-1 ring-seal" />
          Today
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-ink/55">
        {hint}
      </p>
    </div>
  );
}
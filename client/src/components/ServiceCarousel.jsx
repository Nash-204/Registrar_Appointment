import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { api } from '../api.js';
import { SERVICE_ICONS as ICONS } from '../serviceIcons.js';

const GROUPS = ['All', 'Register', 'Correction', 'Request', 'Other services'];

export default function ServiceCarousel() {
  const [services, setServices] = useState(null);
  const [error, setError] = useState('');
  const [group, setGroup] = useState('All');
  const [edge, setEdge] = useState({ start: true, end: false });
  const track = useRef(null);

  useEffect(() => { api('/services').then(setServices).catch((e) => setError(e.message)); }, []);
  const list = useMemo(() => (services ? (group === 'All' ? services : services.filter((s) => s.grp === group)) : []), [services, group]);

  const update = () => {
    const el = track.current;
    if (el) setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => { track.current?.scrollTo({ left: 0 }); update(); }, [group, services]);
  useEffect(() => { window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, []);

  const move = (dir) => {
    const el = track.current;
    const card = el.querySelector('article');
    el.scrollBy({ left: dir * ((card?.offsetWidth || 320) + 16), behavior: 'smooth' });
  };

  if (error) return <p role="alert" className="rounded-lg bg-white px-4 py-3 text-sm text-red-800">We could not load the requirements right now. Please refresh the page.</p>;
  if (!services) return <p className="text-sm text-ink/60">Loading requirements…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter services">
          {GROUPS.map((g) => (
            <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${group === g ? 'bg-ink text-white' : 'border border-ink/20 bg-white text-ink hover:bg-white/60'}`}>{g}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost h-10 w-10 !p-0" onClick={() => move(-1)} disabled={edge.start} aria-label="Previous cards"><ChevronLeft size={20} /></button>
          <button type="button" className="btn btn-ghost h-10 w-10 !p-0" onClick={() => move(1)} disabled={edge.end} aria-label="Next cards"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div ref={track} onScroll={update} tabIndex={0} role="region" aria-roledescription="carousel" aria-label="Services and required documents"
        className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((s) => {
          const Icon = ICONS[s.icon] || FileText;
          const must = s.requirements.filter((r) => r.kind === 'mandatory');
          const maybe = s.requirements.filter((r) => r.kind === 'conditional');
          return (
            <article key={s.id} className="flex w-[18.5rem] shrink-0 snap-start flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:w-[21rem]">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-seal/90 text-ink"><Icon size={22} /></span>
              <h3 className="mt-4 text-xl leading-snug">{s.purpose}</h3>
              <p className="mt-1 text-xs text-ink/60">About {s.duration_minutes} minutes at the counter</p>
              <p className="mt-2 text-sm text-ink/70">{s.summary}</p>
              {must.length > 0 && <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-sealdark">Bring these</p>
                <ul className="mt-2 space-y-2">{must.map((d) => <li key={d.id} className="flex gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-teal" /><span>{d.label}</span></li>)}</ul>
              </>}
              {maybe.length > 0 && <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink/50">May also be needed</p>
                <ul className="mt-2 space-y-2 text-ink/80">{maybe.map((d) => <li key={d.id} className="flex gap-2 text-sm"><span className="mt-0.5 w-4 shrink-0 text-center text-ink/40">+</span><span>{d.label}</span></li>)}</ul>
              </>}
              {s.note && <p className="mt-4 rounded-lg bg-mist px-3 py-2 text-xs text-ink/75">{s.note}</p>}
              <div className="mt-auto space-y-2 pt-6">
                <Link to={`/appointment?purpose=${encodeURIComponent(s.purpose)}`} className="btn btn-primary w-full">Book this service <ArrowRight size={16} /></Link>
                <Link to={`/about#service-${s.id}`} className="btn btn-ghost w-full">What is this service?</Link>
              </div>
            </article>
          );
        })}
        {!list.length && <p className="text-sm text-ink/60">No services in this group right now.</p>}
      </div>
      <p className="mt-2 text-xs text-ink/60">Requirements and fees can vary by case. Our staff will confirm what you need when you arrive.</p>
    </div>
  );
}

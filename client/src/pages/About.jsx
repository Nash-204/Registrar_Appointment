import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Target, Eye, Clock, CalendarDays, ArrowRight, HelpCircle, FileText } from 'lucide-react';

import { site } from '../siteConfig.js';
import { api } from '../api.js';
import { SERVICE_ICONS } from '../serviceIcons.js';

// `dark` uses the bright gold so the label stays readable on navy backgrounds.
const Eyebrow = ({ children, dark }) => (
  <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-seal' : 'text-sealdark'}`}>
    <span className={`h-0.5 w-10 ${dark ? 'bg-seal' : 'bg-sealdark'}`} />
    {children}
  </p>
);

const GROUP_ORDER = ['Register', 'Correction', 'Request', 'Other services'];
const GROUP_BLURB = {
  Register: 'Record a birth, death or marriage for the first time.',
  Correction: 'Fix a mistake in a record that is already registered.',
  Request: 'Get a certified copy of a record that is already registered.',
  'Other services': 'Situations that need special handling.',
};
const CONFUSED = [
  ['Correction', 'Something in the record is wrong, and you want to fix it.'],
  ['Supplemental', 'Something is missing from the record, and you want to add it.'],
  ['Acknowledgment', 'A father recognizes a child born to parents who were not married.'],
  ['Legitimation', 'The parents later marry, and the child becomes legitimate.'],
  ['Late Registration', 'The birth, death or marriage was never registered, or was registered too late.'],
];

// Explains each service in plain language. The text comes from Admin > Services and documents, so the office can edit it.
function ServiceDescriptions() {
  const { hash } = useLocation();
  const [services, setServices] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/services').then(setServices).catch((e) => setError(e.message)); }, []);
  // A link such as /about#service-12 opens right at that service, once the list has loaded.
  useEffect(() => {
    if (!services || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [services, hash]);

  const groups = GROUP_ORDER.map((g) => [g, (services || []).filter((s) => s.grp === g)]).filter(([, l]) => l.length);

  return (
    <section className="bg-paper" id="services">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <Eyebrow>What we offer</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold md:text-4xl">What Each Service Is For</h2>
        <p className="mt-4 max-w-2xl leading-7 text-ink/70">
          Not sure which service you need? Here is what each one means in plain language, so you can book the right one the first time.
        </p>

        <div className="mt-8 rounded-2xl border border-seal/50 bg-white p-5 md:p-6">
          <p className="flex items-center gap-2 font-semibold"><HelpCircle size={18} className="text-teal" />Often mixed up</p>
          <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {CONFUSED.map(([name, text]) => (
              <div key={name}><dt className="text-sm font-semibold">{name}</dt><dd className="text-sm text-ink/70">{text}</dd></div>
            ))}
          </dl>
        </div>

        {error && <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">We could not load the service descriptions right now. Please refresh the page.</p>}
        {!services && !error && <p className="mt-8 text-ink/60">Loading…</p>}

        {services && (
          <nav className="mt-8" aria-label="Jump to a service">
            <ul className="flex flex-wrap gap-2">
              {services.map((s) => (
                <li key={s.id}><a href={`#service-${s.id}`} className="inline-block rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm hover:border-seal hover:bg-mist">{s.purpose}</a></li>
              ))}
            </ul>
          </nav>
        )}

        {groups.map(([group, list]) => (
          <div key={group} className="mt-12">
            <h3 className="text-2xl font-semibold">{group}</h3>
            <p className="mt-1 text-sm text-ink/60">{GROUP_BLURB[group]}</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {list.map((s) => {
                const Icon = SERVICE_ICONS[s.icon] || FileText;
                const paragraphs = (s.details || s.summary || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
                return (
                  <article key={s.id} id={`service-${s.id}`} className="flex scroll-mt-24 flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm target:border-seal target:ring-2 target:ring-seal/60">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-seal"><Icon size={22} /></span>
                      <div>
                        <h4 className="font-serif text-xl font-semibold leading-snug">{s.purpose}</h4>
                        <p className="mt-1 text-xs text-ink/55">A visit takes about {s.duration_minutes} minutes</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-ink/80">
                      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                    {s.note && <p className="mt-4 rounded-lg bg-mist px-3 py-2 text-xs text-ink/75">{s.note}</p>}
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <Link to={`/appointment?purpose=${encodeURIComponent(s.purpose)}`} className="btn btn-primary">Book this service <ArrowRight size={16} /></Link>
                      <Link to="/#requirements" className="btn btn-ghost">Documents to bring</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function About() {
  return (
    <div className="bg-paper text-ink">
      {/* Page Header */}
      <section className="bg-navy-deep text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <Eyebrow dark>Get to know us</Eyebrow>

          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            About the Civil Registry Office
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
            We preserve important life records through accurate registration
            and provide reliable, courteous service to the community.
          </p>
        </div>
      </section>

      {/* About the Office */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="grid items-start gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <div>
            <Eyebrow>Who we are</Eyebrow>

            <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
              Serving Our Community
            </h2>
          </div>

          <div className="space-y-4 text-base leading-8 text-ink/75">
            <p>
              The Civil Registry Office maintains records of births, deaths,
              and marriages within its jurisdiction. These documents help
              establish identity, family relationships, and eligibility for
              various legal rights and public services.
            </p>

            <p>
              We are committed to helping residents with civil registration,
              document requests, and corrections through an organized,
              accessible, and efficient public service.
            </p>
          </div>
        </div>
      </section>

      {/* Mission and Vision */}
      <section className="bg-mist">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Our purpose and direction</Eyebrow>

            <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
              Our Mission and Vision
            </h2>

            <p className="mt-4 leading-7 text-ink/70">
              Guided by accuracy, integrity, and commitment to public service,
              we work to protect civil records and serve every resident
              with care.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Mission Card */}
            <article className="rounded-2xl border border-ink/10 bg-white p-7 shadow-sm transition-shadow hover:shadow-md md:p-9">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-seal">
                <Target size={27} className="text-ink" />
              </div>

              <h3 className="mt-6 text-2xl font-semibold">
                Our Mission
              </h3>

              <p className="mt-4 leading-8 text-ink/75">
                To register and maintain civil records accurately and promptly,
                while providing residents with efficient, accessible, and
                courteous service for registration, document requests, and
                corrections.
              </p>
            </article>

            {/* Vision Card */}
            <article className="rounded-2xl border border-ink/10 bg-white p-7 shadow-sm transition-shadow hover:shadow-md md:p-9">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-seal">
                <Eye size={27} className="text-ink" />
              </div>

              <h3 className="mt-6 text-2xl font-semibold">
                Our Vision
              </h3>

              <p className="mt-4 leading-8 text-ink/75">
                To be a trusted, responsive, and service-oriented Civil Registry
                Office recognized for reliable records management, transparent
                processes, and quality public service for the community.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Services */}
      <ServiceDescriptions />

      {/* Office Hours */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <Eyebrow dark>
              Plan your visit
            </Eyebrow>

            <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
              We're Here to Help
            </h2>

            <p className="mt-4 max-w-md leading-7 text-white/80">
              Visit our office during regular business hours for assistance
              with your civil registry needs.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-seal text-ink">
                <CalendarDays size={22} />
              </span>

              <div>
                <h3 className="font-semibold text-white">
                  Office Hours
                </h3>

                <p className="mt-2 text-white/80">
                  {site.officeHours}
                </p>

                <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
                  <Clock size={16} className="text-seal" />
                  Appointment hours: {site.appointmentHours}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

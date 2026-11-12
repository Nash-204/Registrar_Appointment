import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, ChevronRight, Clock, FilePlus2, FileText, MapPin, Pencil, Users, ClipboardList } from 'lucide-react';
import { site } from '../siteConfig.js';
import ServiceCarousel from '../components/ServiceCarousel.jsx';

const info = [
  [Clock, 'Office hours', [site.officeHours]],
  [CalendarCheck, 'Appointment hours', [site.appointmentHours]],
  [MapPin, 'Where', site.address],
];
const services = [
  [FilePlus2, 'Registration', 'Birth, death and marriage registration, including late registration and out-of-town filings.'],
  [FileText, 'Certified copies', 'Request certified copies of birth, death and marriage records.'],
  [Pencil, 'Corrections and supplemental reports', 'Fix an error in an entry or add missing information to a record.'],
  [Users, 'Acknowledgment and legitimation', 'File documents that recognize or legitimize a child under the law.'],
];
const steps = ['Choose what you need', 'Enter your contact details', 'Pick a day and time', 'Bring your reference code and the required documents'];

const Eyebrow = ({ children, dark }) => (
  <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-seal' : 'text-sealdark'}`}>
    <span className={`h-0.5 w-10 ${dark ? 'bg-seal' : 'bg-sealdark'}`} />{children}
  </p>
);

export default function Home() {
  const [heroOk, setHeroOk] = useState(true);
  return (
    <>
      {/* Hero */}
      <section className="on-dark relative isolate overflow-hidden bg-gradient-to-br from-navy-deep to-[#143262] text-white">
        {heroOk && <img src={site.hero} alt="" onError={() => setHeroOk(false)} className="absolute inset-0 -z-20 h-full w-full object-cover" />}
        <div className="absolute inset-0 -z-10 bg-navy-deep/60 md:bg-transparent" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-deep from-10% via-navy-deep/75 via-35% to-transparent to-70%" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-[1.35fr_1fr] md:py-24">
          <div>
            <Eyebrow dark>Welcome to the</Eyebrow>
            <h1 className="mt-4 text-4xl leading-tight !text-white md:text-5xl lg:text-6xl">
              {site.officeName}
              <span className="block !text-seal">{site.heroLine2}</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-white/90">{site.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/appointment" className="btn btn-seal px-6 py-3 text-base"><CalendarCheck size={18} />Book an Appointment <ArrowRight size={18} /></Link>
              <a href="#contact" className="btn btn-outline-light px-6 py-3 text-base"><FileText size={18} />Contact Details</a>
            </div>
          </div>
          <dl className="space-y-5 rounded-2xl bg-white/50 p-6 text-ink shadow-xl backdrop-blur">
            {info.map(([Icon, label, lines]) => (
              <div key={label} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-seal"><Icon size={20} /></span>
                <div><dt className="font-semibold">{label}</dt>{lines.map((l) => <dd key={l} className="text-sm text-ink/70">{l}</dd>)}</div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Services */}
      <section className="bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1fr_2fr] md:py-20">
          <div>
            <Eyebrow>Our services</Eyebrow>
            <h2 className="mt-4 text-4xl font-semibold md:text-5xl">What We Handle</h2>
            <p className="mt-4 max-w-xs text-ink/70">We process civil registry documents and provide various services for the community.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map(([Icon, title, text]) => (
              <a key={title} href="#requirements" className="group flex items-start gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-seal"><Icon size={22} /></span>
                <span className="flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-ink/70">{text}</span></span>
                <ChevronRight size={18} className="mt-1 shrink-0 text-sealdark transition-transform group-hover:translate-x-0.5" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements carousel */}
      <section id="requirements" className="bg-mist">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <Eyebrow>Come prepared</Eyebrow>
          <h2 className="mt-4 text-4xl font-semibold md:text-5xl">Know what to bring</h2>
          <p className="mt-4 max-w-xl text-ink/70">Find your service below to see what it is for and which documents to bring, so your visit goes smoothly.</p>
          <div className="mt-8"><ServiceCarousel /></div>
        </div>
      </section>

      {/* Gold wave into the appointment section */}
      <div className="bg-mist leading-[0]" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block h-10 w-full md:h-16">
          <path d="M0 80V38C240 6 520 62 860 34C1100 14 1290 12 1440 32V80Z" fill="#F0B13A" />
        </svg>
      </div>

      {/* Appointment promo */}
      <section className="on-dark bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-20">
          <div>
            <ClipboardList size={32} className="text-seal" />
            <h2 className="mt-4 text-4xl font-semibold !text-white">Skip the line. Book online.</h2>
            <p className="mt-4 max-w-md text-white/85">Reserve a time at the counter in about two minutes. You will get a confirmation email with a reference code.</p>
            <Link to="/appointment" className="btn btn-seal mt-7 px-6 py-3 text-base">Book your appointment <ArrowRight size={18} /></Link>
          </div>
          <ol className="space-y-4 self-center">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-seal text-sm font-bold text-ink">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

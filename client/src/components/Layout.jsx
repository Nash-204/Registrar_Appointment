import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { Menu, X, MapPin, Phone, Mail, Clock } from 'lucide-react';
import Chatbot from './Chatbot.jsx';
import Logo from './Logo.jsx';
import { site } from '../siteConfig.js';

const links = [['/', 'Home'], ['/about', 'About Us'], ['/appointment', 'Appointment'], ['/track', 'Track Appointment']];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const cls = ({ isActive }) =>
    `rounded-full px-5 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-seal text-ink' : 'text-white/85 hover:bg-white/10 hover:text-white'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-navy-deep via-ink to-[#143262] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={48} />
            <span className="font-serif text-lg leading-tight sm:text-xl">{site.officeName}<span className="block font-sans text-xs font-medium text-seal">{site.locality}</span></span>
          </Link>
          <nav className="hidden gap-1 md:flex" aria-label="Main">{links.map(([to, t]) => <NavLink key={to} to={to} end={to === '/'} className={cls}>{t}</NavLink>)}</nav>
          <button className="rounded-lg p-2 hover:bg-white/10 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && <nav className="flex flex-col gap-1 px-4 pb-4 md:hidden" aria-label="Mobile">{links.map(([to, t]) => <NavLink key={to} to={to} end={to === '/'} className={cls} onClick={() => setOpen(false)}>{t}</NavLink>)}</nav>}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer id="contact" className="bg-navy-deep text-sm text-white/75">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-3"><Logo size={44} /><p className="font-serif text-xl text-white">{site.officeName}</p></div>
            <p className="mt-3 max-w-sm">Registration of births, deaths and marriages, and certified copies of civil records for the residents of {site.locality}.</p>
          </div>
          <ul className="space-y-3">
            <li className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-seal" /><span>{site.address.join(', ')}</span></li>
            <li className="flex gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-seal" /><a href={site.phoneHref} className="hover:text-white">{site.phone}</a></li>
            <li className="flex gap-3"><Mail size={18} className="mt-0.5 shrink-0 text-seal" /><a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a></li>
            <li className="flex gap-3"><Clock size={18} className="mt-0.5 shrink-0 text-seal" /><span>Office: {site.officeHours}<br />Appointments: {site.appointmentHours}</span></li>
          </ul>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs">
            <p>© {new Date().getFullYear()} {site.officeName}</p>
            <Link to="/login" className="hover:text-white">Staff sign in</Link>
          </div>
        </div>
      </footer>
      <Chatbot />
    </div>
  );
}

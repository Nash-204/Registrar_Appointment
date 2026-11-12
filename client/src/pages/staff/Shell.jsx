import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../auth.jsx';

export default function Shell({ title, tabs, tab, setTab, children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div><p className="font-serif text-lg">{title}</p><p className="text-xs text-white/60">{user.name}</p></div>
          <button className="btn border border-white/30 text-white hover:bg-white/10" onClick={() => { logout(); nav('/login'); }}><LogOut size={16} />Sign out</button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Sections">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
              className={`whitespace-nowrap border-b-4 px-4 py-2 text-sm font-medium ${tab === k ? 'border-seal text-white' : 'border-transparent text-white/70 hover:text-white'}`}>{label}</button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

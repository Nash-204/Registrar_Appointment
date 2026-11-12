import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const u = await login(email, password); nav(u.role === 'admin' ? '/admin' : '/employee'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-mist px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-ink/15 bg-white p-8">
        <Logo size={56} />
        <h1 className="text-3xl">Staff sign in</h1>
        <div><label className="label" htmlFor="e">Email address</label><input id="e" type="email" required maxLength={160} placeholder="name@yourdomain.gov.ph" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        <div><label className="label" htmlFor="p">Password</label><input id="p" type="password" required maxLength={200} placeholder="Your password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <Link to="/" className="block text-center text-sm text-teal">Back to the public site</Link>
      </form>
    </div>
  );
}

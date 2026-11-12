import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { site } from '../siteConfig.js';

// Shows /images/logo.png; falls back to an icon until you add the file.
export default function Logo({ size = 44 }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img src={site.logo} alt="" onError={() => setOk(false)} className="shrink-0 rounded-full object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full border-2 border-seal text-seal bg-ink" style={{ width: size, height: size }}>
      <Landmark size={Math.round(size * 0.5)} />
    </span>
  );
}

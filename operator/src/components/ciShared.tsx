import { useEffect, useState } from 'react';
import type { FleetMachine } from '../types';
import { assetInitials, brandColors } from '../lib/format';

export function Thumb({ machine, lg }: { machine: FleetMachine; lg?: boolean }) {
  const cls = `op-ci-thumb${lg ? ' op-ci-thumb-lg' : ''}`;
  if (machine.imageUrl) return <img className={cls} src={machine.imageUrl} alt="" />;
  const [bg, fg] = brandColors(machine.brand ?? machine.name);
  return (
    <div className={cls} style={{ background: bg, color: fg }}>
      {assetInitials(machine.brand ?? machine.name)}
    </div>
  );
}

export function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="op-ci-timer">
      {hh > 0 ? `${pad(hh)}:` : ''}
      {pad(mm)}:{pad(ss)}
    </span>
  );
}

export function machineSub(m: FleetMachine) {
  return [m.brand, m.model, m.assetType].filter(Boolean).join(', ');
}

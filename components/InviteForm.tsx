'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/session';

export default function InviteForm({ role, free, ownerSlots }: { role: Role; free: number; ownerSlots: number }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [invRole, setInvRole] = useState('consultant');
  const [msg, setMsg] = useState<string | null>(null);
  const owner = role === 'owner';
  const roles = owner ? ['consultant', 'supervisor', 'admin', ...(ownerSlots > 0 ? ['owner'] : [])] : ['consultant', 'supervisor'];
  const needsSeat = invRole !== 'admin' && free <= 0;
  const label = needsSeat ? (owner ? 'Buy a seat and invite' : 'Request a seat from Owners') : 'Send invite';
  const hint = needsSeat
    ? owner ? 'This adds one paid seat to the account.' : 'No paid seat is free. Both Owners get a costed request; either can approve.'
    : invRole === 'admin' ? 'Admins are free and have no app access.' : free + ' paid seat' + (free === 1 ? '' : 's') + ' free.';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/team/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role: invRole }) });
    const body = await res.json();
    setMsg(res.ok ? body.message : body.error);
    setTimeout(() => setMsg(null), 3000);
    if (res.ok) { setEmail(''); router.refresh(); }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '14px 16px', borderTop: '1px dashed var(--n4)', background: 'var(--bg)' }}>
      <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" style={{ flex: '1 1 220px' }} />
      <select className="select" value={invRole} onChange={e => setInvRole(e.target.value)}>
        {roles.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
      </select>
      <button className="btn btn-primary" type="submit">{label}</button>
      <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--n6)' }}>{hint}</span>
      {msg && <div className="toast">{msg}</div>}
    </form>
  );
}

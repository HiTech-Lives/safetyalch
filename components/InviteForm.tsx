'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/session';

const ROLE_LABELS: Record<string, string> = {
  consultant: 'Consultant (Licensed Seat)',
  supervisor: 'Supervisor (Licensed Seat)',
  underwriting: 'Underwriting / Captive Analyst (Licensed Seat)',
  viewer: 'Read-Only Viewer ($0 Complimentary)',
  admin: 'Team Admin ($0 Complimentary)',
  owner: 'Workspace Owner (Licensed Seat · Max 2)',
};

export default function InviteForm({
  role,
  canInviteAdmin,
  canSpendMoney,
  free,
  ownerSlots,
}: {
  role: Role;
  canInviteAdmin: boolean;
  canSpendMoney: boolean;
  free: number;
  ownerSlots: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [invRole, setInvRole] = useState('consultant');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const roles = [
    'consultant',
    'supervisor',
    'underwriting',
    'viewer',
    ...(canInviteAdmin ? ['admin'] : []),
    ...(role === 'owner' && ownerSlots > 0 ? ['owner'] : []),
  ];

  const isComplimentary = invRole === 'admin' || invRole === 'viewer';
  const needsSeat = !isComplimentary && free <= 0;
  const label = needsSeat ? (canSpendMoney ? 'Buy a seat & invite' : 'Request seat from Owners') : 'Send invite';
  const hint = isComplimentary
    ? `${invRole === 'admin' ? 'Team Admins' : 'Read-Only Viewers'} are complimentary ($0) and do not consume a licensed field seat.`
    : needsSeat
    ? canSpendMoney
      ? 'Adds 1 licensed seat to your workspace subscription.'
      : 'No free licensed seat available. Sends an audited approval request to Workspace Owners.'
    : `${free} licensed seat${free === 1 ? '' : 's'} available.`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role: invRole, reason: reason.trim() || undefined }),
    });
    const body = await res.json();
    setMsg(res.ok ? body.message : body.error);
    setTimeout(() => setMsg(null), 3200);
    if (res.ok) {
      setEmail('');
      setReason('');
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        padding: '14px 16px',
        borderTop: '1px dashed var(--n4)',
        background: 'var(--bg)',
      }}
    >
      <input
        className="input"
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="name@company.com"
        style={{ flex: '1 1 220px' }}
      />
      <select className="select" value={invRole} onChange={e => setInvRole(e.target.value)} style={{ minWidth: 240 }}>
        {roles.map(r => (
          <option key={r} value={r}>
            {ROLE_LABELS[r] || r}
          </option>
        ))}
      </select>
      {needsSeat && !canSpendMoney && (
        <input
          className="input"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Optional note for Owners (e.g. New Ag consultant)"
          style={{ flex: '1 1 220px' }}
        />
      )}
      <button className="btn btn-primary" type="submit">
        {label}
      </button>
      <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--n6)' }}>{hint}</span>
      {msg && <div className="toast">{msg}</div>}
    </form>
  );
}

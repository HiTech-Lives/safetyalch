'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SeatButtons({ free }: { free: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  async function change(delta: 1 | -1) {
    const res = await fetch('/api/billing/seats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ delta }) });
    const body = await res.json();
    setMsg(res.ok ? body.message : body.error);
    setTimeout(() => setMsg(null), 2600);
    if (res.ok) router.refresh();
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <button className="btn btn-primary" onClick={() => change(1)}>Add a seat</button>
      <button className="btn" disabled={free <= 0} onClick={() => change(-1)}>Remove an unused seat</button>
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

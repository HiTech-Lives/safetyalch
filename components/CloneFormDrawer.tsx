'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CloneFormDrawer({ forms }: { forms: any[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sourceCode, setSourceCode] = useState(forms[0]?.code ?? 'WHS');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'clone_form', sourceCode, newCode, newName }),
    });
    const body = await res.json();
    setBusy(false);
    setToast(res.ok ? body.message : body.error);
    setTimeout(() => setToast(null), 2800);
    if (res.ok) {
      setOpen(false);
      setNewCode('');
      setNewName('');
      router.push(`/forms/${body.code}`);
      router.refresh();
    }
  }

  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>+ Clone &amp; Customize Form</button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <aside className="drawer" role="dialog" aria-label="Clone Master Form">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Tenant-Scoped Form Customization</div>
                <h2>Clone Master Form Into Tenant</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submit} className="drawer-body">
              <div style={{ fontSize: 12.5, color: 'var(--n6)', lineHeight: 1.5 }}>
                Cloning creates a tenant-owned copy of any master form so your consultancy can add, detach, or customize questions without modifying the global master template.
              </div>
              <label className="field">
                <span>Source Master Template</span>
                <select className="select" value={sourceCode} onChange={e => setSourceCode(e.target.value)}>
                  {forms.filter(f => !f.tenant_id).map(f => (
                    <option key={f.code} value={f.code}>{f.code} · {f.name} ({f.n} items)</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>New Form Code (up to 16 chars, e.g. WHS-CUSTOM)</span>
                <input className="input" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} required placeholder="WHS-CUSTOM" />
              </label>
              <label className="field">
                <span>Custom Form Title</span>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Cold Storage & Ammonia Warehouse Audit" />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Clone Form</button>
                <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}


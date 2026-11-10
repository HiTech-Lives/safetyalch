'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CloneFormDrawer({
  forms,
  canMaster = false,
  canTenant = false,
  hasTeamWorkspace = false,
}: {
  forms: any[];
  canMaster?: boolean;
  canTenant?: boolean;
  hasTeamWorkspace?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'tenant' | 'platform'>(hasTeamWorkspace && canTenant ? 'tenant' : 'platform');
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
      body: JSON.stringify({ action: 'clone_form', scope, sourceCode, newCode, newName }),
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
      <button className="btn btn-sm" onClick={() => setOpen(true)}>+ Clone Existing Form / Policy</button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <aside className="drawer" role="dialog" aria-label="Clone Form or Policy">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{scope === 'platform' ? 'Master Library Template Duplication' : 'Workspace Form Customization'}</div>
                <h2>Clone Form or Written Policy</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submit} className="drawer-body">
              <div style={{ fontSize: 12.5, color: 'var(--n6)', lineHeight: 1.5 }}>
                {scope === 'platform'
                  ? 'Duplicates all sections and items of an existing template into a new Global Master Form or Written Policy.'
                  : 'Creates a workspace-owned copy of any master form or policy so your consultancy can add, detach, or customize items without altering the global master library.'}
              </div>

              {canMaster && hasTeamWorkspace && canTenant && (
                <label className="field">
                  <span>Destination Library Plane</span>
                  <select className="select" value={scope} onChange={e => setScope(e.target.value as 'tenant' | 'platform')}>
                    <option value="tenant">Workspace Custom Copy (This Tenant Only)</option>
                    <option value="platform">Platform Master Template (Global Library)</option>
                  </select>
                </label>
              )}

              <label className="field">
                <span>Source Form / Written Policy</span>
                <select className="select" value={sourceCode} onChange={e => setSourceCode(e.target.value)}>
                  {forms.map(f => (
                    <option key={f.code} value={f.code}>
                      {f.code} · {f.name} ({f.n} items · {f.tenant_id ? 'Workspace' : 'Master'})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>New Template Code (up to 16 chars, e.g. GAP-WVPP or WHS-COLD)</span>
                <input className="input mono" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} required placeholder="GAP-WVPP" />
              </label>
              <label className="field">
                <span>New Form / Policy Title</span>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Workplace Violence Prevention Written Policy Audit" />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Clone &amp; Open Builder →</button>
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

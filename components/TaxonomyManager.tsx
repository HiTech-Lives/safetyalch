'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';

export default function TaxonomyManager({
  taxonomy,
  industries,
  members,
}: {
  taxonomy: {
    groupLabel: string;
    groups: any[];
    relationshipTypes: any[];
    relationships: any[];
  };
  industries: any[];
  members: any[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'groups' | 'industries' | 'hierarchy'>('groups');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Section 1: Portfolio Groups ("Gems")
  const [groupLabel, setGroupLabel] = useState(taxonomy.groupLabel || 'Portfolio Groups');
  const [gId, setGId] = useState<string | null>(null);
  const [gCode, setGCode] = useState('');
  const [gName, setGName] = useState('');
  const [gType, setGType] = useState('sig_captive');
  const [gColor, setGColor] = useState('#2d6a4f');
  const [gBilling, setGBilling] = useState('included_captive');

  // Section 2: Custom Workspace Industries & Sub-Sectors
  const [indCode, setIndCode] = useState('');
  const [indName, setIndName] = useState('');
  const [indBrand, setIndBrand] = useState('');
  const [indBaseline, setIndBaseline] = useState('29 CFR Part 1910');
  const [indOverlay, setIndOverlay] = useState('');
  const [indTopics, setIndTopics] = useState('iipp, hazcom, ergonomics');

  const [subParentId, setSubParentId] = useState(industries[0]?.id || '');
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');

  // Section 3: Company Hierarchy & Relationship Types
  const [rtCode, setRtCode] = useState('');
  const [rtLabel, setRtLabel] = useState('');
  const [rtRollup, setRtRollup] = useState(true);

  const [fromMemberId, setFromMemberId] = useState(members[0]?.id || '');
  const [toMemberId, setToMemberId] = useState(members[1]?.id || members[0]?.id || '');
  const [relCode, setRelCode] = useState(taxonomy.relationshipTypes[0]?.code || 'PARENT_CHILD');
  const [relNotes, setRelNotes] = useState('');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  async function postTaxonomy(payload: Record<string, any>, onSuccess?: () => void) {
    setBusy(true);
    const res = await fetch('/api/tenant/taxonomy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      if (onSuccess) onSuccess();
      router.refresh();
    }
  }

  function editGroup(g: any) {
    setGId(g.id);
    setGCode(g.code);
    setGName(g.name);
    setGType(g.group_type || 'sig_captive');
    setGColor(g.accent_color || '#2d6a4f');
    setGBilling(g.billing_mode || 'included_captive');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tabs">
        <button type="button" className={'tab ' + (tab === 'groups' ? 'on' : '')} onClick={() => setTab('groups')}>
          1. Portfolio Groups (&ldquo;{taxonomy.groupLabel}&rdquo;) ({taxonomy.groups.length})
        </button>
        <button type="button" className={'tab ' + (tab === 'industries' ? 'on' : '')} onClick={() => setTab('industries')}>
          2. Shield &amp; Custom Industry Lines ({industries.length})
        </button>
        <button type="button" className={'tab ' + (tab === 'hierarchy' ? 'on' : '')} onClick={() => setTab('hierarchy')}>
          3. Company Hierarchy &amp; Relationships ({taxonomy.relationships.length})
        </button>
      </div>

      {tab === 'groups' && (
        <div className="cols" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Frame className="strong">
              <div className="panel-head">
                <div>
                  <h2>Workspace Group Terminology &amp; Starter Presets</h2>
                  <div className="sub">
                    Every tenant can name its portfolio groupings (&ldquo;Gems&rdquo;, &ldquo;Programs&rdquo;,
                    &ldquo;Captives&rdquo;, &ldquo;Client Portfolios&rdquo;) and maintain its own custom roster
                  </div>
                </div>
              </div>
              <div className="panel-body">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    postTaxonomy({ action: 'update_group_label', groupLabel });
                  }}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
                >
                  <label className="field" style={{ flex: 1, minWidth: 220 }}>
                    <span>Portfolio Group Label (shown across Members, Reports &amp; ACL Filters)</span>
                    <input
                      className="input"
                      value={groupLabel}
                      onChange={e => setGroupLabel(e.target.value)}
                      placeholder="Gems, Programs, Captives, Client Portfolios..."
                      required
                    />
                  </label>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Save Terminology Label
                  </button>
                </form>

                <div style={{ paddingTop: 12, borderTop: '1px solid var(--div2)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="kicker">1-Click Starter Presets:</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => postTaxonomy({ action: 'apply_group_preset', presetKey: 'breckpoint_sig_rsa' })}
                  >
                    Load Breckpoint SIG &ldquo;Gems&rdquo; + RSA Preset (CAN, CAP, CCN, CFM, CLP, CRMBC, RSA)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => postTaxonomy({ action: 'apply_group_preset', presetKey: 'standard_consultancy' })}
                  >
                    Load Standard Consultancy Preset (Captive, Carrier, Direct)
                  </button>
                </div>
              </div>
            </Frame>

            <Frame>
              <div className="panel-head">
                <h2>Active {taxonomy.groupLabel} ({taxonomy.groups.length})</h2>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Badge</th>
                      <th>Display Name</th>
                      <th>Group Type</th>
                      <th>Billing Mode</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxonomy.groups.map(g => (
                      <tr key={g.id}>
                        <td>
                          <span
                            className="pill"
                            style={{ background: g.accent_color || 'var(--acc)', color: '#fff', fontWeight: 700 }}
                          >
                            {g.code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{g.name}</td>
                        <td className="kicker">{g.group_type}</td>
                        <td>
                          <Pill kind={g.billing_mode === 'included_captive' ? 'ok' : 'amber'}>{g.billing_mode}</Pill>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="btn btn-sm" onClick={() => editGroup(g)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ color: 'var(--bad)' }}
                              disabled={busy}
                              onClick={() => postTaxonomy({ action: 'archive_group', id: g.id })}
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {taxonomy.groups.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sub" style={{ padding: 16 }}>
                          No groups configured yet. Apply a starter preset above or add a custom group on the right.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Frame>
          </div>

          <Frame>
            <div className="panel-head">
              <h2>{gId ? `Edit ${gCode}` : `Add Custom ${taxonomy.groupLabel} Entry`}</h2>
              {gId && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setGId(null);
                    setGCode('');
                    setGName('');
                  }}
                >
                  + New Instead
                </button>
              )}
            </div>
            <form
              className="panel-body"
              onSubmit={e => {
                e.preventDefault();
                postTaxonomy(
                  {
                    action: 'save_group',
                    id: gId,
                    code: gCode,
                    name: gName,
                    groupType: gType,
                    accentColor: gColor,
                    billingMode: gBilling,
                  },
                  () => {
                    setGId(null);
                    setGCode('');
                    setGName('');
                  }
                );
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
                <label className="field">
                  <span>Short Code</span>
                  <input
                    className="input mono"
                    value={gCode}
                    onChange={e => setGCode(e.target.value.toUpperCase())}
                    placeholder="CAN / RSA"
                    required
                  />
                </label>
                <label className="field">
                  <span>Group Name</span>
                  <input
                    className="input"
                    value={gName}
                    onChange={e => setGName(e.target.value)}
                    placeholder="California Agriculture Network"
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Program / Portfolio Type</span>
                  <select className="select" value={gType} onChange={e => setGType(e.target.value)}>
                    <option value="sig_captive">SIG / Group Captive</option>
                    <option value="retail_rsa">Retail Fee-for-Service (RSA)</option>
                    <option value="carrier_program">Carrier Dispatch Program</option>
                    <option value="association">Trade Association</option>
                    <option value="internal_division">Internal Business Division</option>
                    <option value="custom">Custom Portfolio</option>
                  </select>
                </label>
                <label className="field">
                  <span>Billing Rule</span>
                  <select className="select" value={gBilling} onChange={e => setGBilling(e.target.value)}>
                    <option value="included_captive">Included in Captive Assessment</option>
                    <option value="scoro_invoiced">Invoiced / Fee-for-Service (RSA)</option>
                    <option value="fee_for_service">Per-Survey Flat Fee</option>
                    <option value="hourly">Hourly T&amp;M</option>
                    <option value="none">Non-Billable</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Badge Accent Hex</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={gColor}
                    onChange={e => setGColor(e.target.value)}
                    style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--div)' }}
                  />
                  <input
                    className="input mono"
                    value={gColor}
                    onChange={e => setGColor(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
              </label>

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {gId ? 'Update Group' : `Save ${taxonomy.groupLabel} Entry`}
              </button>
            </form>
          </Frame>
        </div>
      )}

      {tab === 'industries' && (
        <div className="cols" style={{ gridTemplateColumns: '1.35fr 1fr', alignItems: 'start' }}>
          <Frame className="strong">
            <div className="panel-head">
              <div>
                <h2>Shield Industry Lines, Specialty Lines &amp; Workspace Visibility</h2>
                <div className="sub">
                  Toggle global lines on/off for your workspace or add custom tenant industry lines &amp; sub-sectors
                </div>
              </div>
            </div>
            <div className="panel-body">
              {industries.map(line => (
                <div
                  key={line.id}
                  style={{
                    padding: '12px 14px',
                    background: line.disabled_for_tenant ? 'var(--bg)' : 'var(--bg-soft)',
                    border: '1px solid var(--div)',
                    opacity: line.disabled_for_tenant ? 0.65 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="code">{line.code}</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{line.name}</span>
                      {line.shield_brand && <Pill kind="ink">{line.shield_brand}</Pill>}
                      {line.is_core_shield ? (
                        <Pill kind="verified">Core Shield</Pill>
                      ) : line.tenant_id ? (
                        <Pill kind="amber">Workspace Custom</Pill>
                      ) : (
                        <Pill kind="neutral">Specialty Line</Pill>
                      )}
                    </div>
                    {!line.tenant_id && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() =>
                          postTaxonomy({
                            action: 'toggle_global_industry',
                            industryLineId: line.id,
                            enabled: Boolean(line.disabled_for_tenant),
                          })
                        }
                      >
                        {line.disabled_for_tenant ? 'Enable in Workspace' : 'Hide from Pickers'}
                      </button>
                    )}
                  </div>
                  {line.federal_baseline && (
                    <div className="sub">
                      <strong>Baseline:</strong> {line.federal_baseline}
                    </div>
                  )}
                  {line.subsectors?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {line.subsectors.map((sub: any) => (
                        <Pill key={sub.id} kind="line">
                          {sub.code}: {sub.name}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Frame>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Frame>
              <div className="panel-head">
                <h2>+ Add Custom Workspace Industry Line</h2>
              </div>
              <form
                className="panel-body"
                onSubmit={e => {
                  e.preventDefault();
                  postTaxonomy(
                    {
                      action: 'save_custom_industry',
                      code: indCode,
                      name: indName,
                      shieldBrand: indBrand,
                      federalBaseline: indBaseline,
                      stateOverlayNotes: indOverlay,
                      defaultTopics: indTopics,
                    },
                    () => {
                      setIndCode('');
                      setIndName('');
                      setIndBrand('');
                      setIndOverlay('');
                    }
                  );
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Code</span>
                    <input
                      className="input mono"
                      value={indCode}
                      onChange={e => setIndCode(e.target.value.toUpperCase())}
                      placeholder="BIOTECH"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Industry Line Name</span>
                    <input
                      className="input"
                      value={indName}
                      onChange={e => setIndName(e.target.value)}
                      placeholder="Life Sciences & Cleanroom Labs"
                      required
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Brand Alias (Optional)</span>
                    <input
                      className="input"
                      value={indBrand}
                      onChange={e => setIndBrand(e.target.value)}
                      placeholder="BioShield"
                    />
                  </label>
                  <label className="field">
                    <span>Federal Baseline</span>
                    <input
                      className="input"
                      value={indBaseline}
                      onChange={e => setIndBaseline(e.target.value)}
                      placeholder="29 CFR 1910.1450 Lab Standard"
                    />
                  </label>
                </div>
                <label className="field">
                  <span>State Overlay Notes</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={indOverlay}
                    onChange={e => setIndOverlay(e.target.value)}
                    placeholder="CA 8 CCR 5191 Occupational Exposure to Hazardous Chemicals in Laboratories..."
                  />
                </label>
                <label className="field">
                  <span>Default Hazard Topics (comma-separated)</span>
                  <input className="input mono" value={indTopics} onChange={e => setIndTopics(e.target.value)} />
                </label>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Create Workspace Industry Line
                </button>
              </form>
            </Frame>

            <Frame>
              <div className="panel-head">
                <h2>+ Add Custom Sub-Sector</h2>
              </div>
              <form
                className="panel-body"
                onSubmit={e => {
                  e.preventDefault();
                  postTaxonomy(
                    {
                      action: 'save_custom_subsector',
                      industryLineId: subParentId,
                      code: subCode,
                      name: subName,
                      description: subDesc,
                    },
                    () => {
                      setSubCode('');
                      setSubName('');
                      setSubDesc('');
                    }
                  );
                }}
              >
                <label className="field">
                  <span>Parent Industry Line</span>
                  <select className="select" value={subParentId} onChange={e => setSubParentId(e.target.value)}>
                    {industries.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.shield_brand ? `${l.shield_brand} (${l.name})` : l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Sub-Sector Code</span>
                    <input
                      className="input mono"
                      value={subCode}
                      onChange={e => setSubCode(e.target.value.toUpperCase())}
                      placeholder="AGRI-VITICULTURE"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Sub-Sector Name</span>
                    <input
                      className="input"
                      value={subName}
                      onChange={e => setSubName(e.target.value)}
                      placeholder="Vineyard & Winery Crush Operations"
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Scope Description</span>
                  <input
                    className="input"
                    value={subDesc}
                    onChange={e => setSubDesc(e.target.value)}
                    placeholder="Night harvest lighting, tank CO2 confined space & cellar barrel racks"
                  />
                </label>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Add Sub-Sector
                </button>
              </form>
            </Frame>
          </div>
        </div>
      )}

      {tab === 'hierarchy' && (
        <div className="cols" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Frame className="strong">
              <div className="panel-head">
                <div>
                  <h2>Active Corporate Hierarchy Links ({taxonomy.relationships.length})</h2>
                  <div className="sub">
                    Model Parent → Subsidiary, Sibling Common Ownership, Franchise, GC → Subcontractor, or PEO → Client
                    relationships
                  </div>
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Primary / Parent Member</th>
                      <th>Relationship</th>
                      <th>Linked / Child Member</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxonomy.relationships.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.from_member_name}</td>
                        <td>
                          <Pill kind="ink">{r.relationship_code}</Pill>
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.to_member_name}</td>
                        <td className="sub">{r.notes || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: 'var(--bad)' }}
                            disabled={busy}
                            onClick={() => postTaxonomy({ action: 'delete_company_relationship', id: r.id })}
                          >
                            Unlink
                          </button>
                        </td>
                      </tr>
                    ))}
                    {taxonomy.relationships.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sub" style={{ padding: 16 }}>
                          No company hierarchy links recorded yet. Link two Members using the form on the right.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Frame>

            <Frame>
              <div className="panel-head">
                <h2>Custom Relationship Types ({taxonomy.relationshipTypes.length})</h2>
              </div>
              <div className="panel-body">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {taxonomy.relationshipTypes.map((rt: any) => (
                    <Pill key={rt.id} kind={rt.rolls_up_analytics ? 'ok' : 'line'}>
                      {rt.code}: {rt.label} {rt.rolls_up_analytics ? '(Rolls Up)' : ''}
                    </Pill>
                  ))}
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    postTaxonomy(
                      {
                        action: 'save_relationship_type',
                        code: rtCode,
                        label: rtLabel,
                        rollsUpAnalytics: rtRollup,
                      },
                      () => {
                        setRtCode('');
                        setRtLabel('');
                      }
                    );
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr auto auto',
                    gap: 10,
                    alignItems: 'end',
                    paddingTop: 10,
                    borderTop: '1px solid var(--div2)',
                  }}
                >
                  <label className="field">
                    <span>Code</span>
                    <input
                      className="input mono"
                      value={rtCode}
                      onChange={e => setRtCode(e.target.value.toUpperCase())}
                      placeholder="PEO_CLIENT"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Relationship Label</span>
                    <input
                      className="input"
                      value={rtLabel}
                      onChange={e => setRtLabel(e.target.value)}
                      placeholder="PEO → Client Company"
                      required
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, paddingBottom: 8 }}>
                    <input type="checkbox" checked={rtRollup} onChange={e => setRtRollup(e.target.checked)} />
                    <span>Roll up analytics</span>
                  </label>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={busy} style={{ height: 36 }}>
                    + Save Type
                  </button>
                </form>
              </div>
            </Frame>
          </div>

          <Frame>
            <div className="panel-head">
              <h2>Link Two Member Companies</h2>
            </div>
            <form
              className="panel-body"
              onSubmit={e => {
                e.preventDefault();
                postTaxonomy(
                  {
                    action: 'add_company_relationship',
                    fromMemberId,
                    toMemberId,
                    relationshipCode: relCode,
                    notes: relNotes,
                  },
                  () => setRelNotes('')
                );
              }}
            >
              <label className="field">
                <span>Primary / Parent Member</span>
                <select className="select" value={fromMemberId} onChange={e => setFromMemberId(e.target.value)}>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.group_code ? `(${m.group_code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Relationship Type</span>
                <select className="select" value={relCode} onChange={e => setRelCode(e.target.value)}>
                  {taxonomy.relationshipTypes.map((rt: any) => (
                    <option key={rt.code} value={rt.code}>
                      {rt.label} ({rt.code})
                    </option>
                  ))}
                  {taxonomy.relationshipTypes.length === 0 && (
                    <>
                      <option value="PARENT_CHILD">Parent → Subsidiary</option>
                      <option value="SIBLING">Sibling / Common Ownership</option>
                      <option value="FRANCHISE">Franchisor → Franchisee</option>
                      <option value="GC_SUB">General Contractor → Subcontractor</option>
                    </>
                  )}
                </select>
              </label>

              <label className="field">
                <span>Linked / Subsidiary / Sibling Member</span>
                <select className="select" value={toMemberId} onChange={e => setToMemberId(e.target.value)}>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.group_code ? `(${m.group_code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Ownership / Policy Notes (Optional)</span>
                <input
                  className="input"
                  value={relNotes}
                  onChange={e => setRelNotes(e.target.value)}
                  placeholder="Shared FEIN / Combined SIG Policy"
                />
              </label>

              <button type="submit" className="btn btn-primary" disabled={busy || members.length < 2}>
                Link Member Companies
              </button>
            </form>
          </Frame>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}


import Link from 'next/link';
import { PageHeader, Frame, Pill } from '@/components/ui';
import CloneFormDrawer from '@/components/CloneFormDrawer';
import { getSession, can } from '@/lib/session';
import { listForms } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  const s = await getSession();
  const forms = await listForms(s.tenantId);
  const total = forms.reduce((a, f) => a + Number(f.n), 0);
  return (
    <>
      <PageHeader title="Forms" subtitle={forms.length + ' forms · ' + total + ' questions · Master library + Tenant custom templates'}>
        {can.editFormsAndRegs(s) && <CloneFormDrawer forms={forms} />}
      </PageHeader>
      <div className="content">
        <div className="cards">
          {forms.map(f => (
            <Frame as={Link} key={f.code} href={'/forms/' + f.code} className="stat" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Pill kind="solid">{f.code}</Pill>
                <span className="kicker">{f.industry}</span>
                {f.tenant_id ? <Pill kind="acc">Tenant Custom</Pill> : <Pill kind="line">Master v{f.version}</Pill>}
              </span>
              <span style={{ font: '700 18px/1.15 var(--fh)', letterSpacing: '.02em', textTransform: 'uppercase' }}>{f.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--n6)' }}>{f.n} questions · {f.sections} sections{Number(f.shared) ? ' · ' + f.shared + ' shared' : ''}</span>
              {f.scale === 'maturity' && <span><Pill kind="acc">Maturity scale</Pill></span>}
            </Frame>
          ))}
        </div>
      </div>
    </>
  );
}

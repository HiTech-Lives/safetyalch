import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader, SearchForm } from '@/components/ui';
import FormSectionView from '@/components/FormSectionView';
import { getOptionalSession, getOptionalPlatformSession, can } from '@/lib/session';
import { getForm, listRegs, listIndustryCatalog } from '@/lib/queries';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function FormDetail({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ s?: string; q?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const [s, ps] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
  if (!s && !ps) redirect(`/login?next=/forms/${code}`);

  const [data, regs, industries] = await Promise.all([
    getForm(code.toUpperCase(), sp.s ? Number(sp.s) : undefined, s?.tenantId ?? null),
    listRegs(s?.tenantId ?? null),
    listIndustryCatalog(s?.tenantId ?? null),
  ]);
  if (!data) notFound();

  const { form, sections, current, questions, total } = data;
  const qKeys = questions.map((x: any) => x.question_key).filter(Boolean);
  const regMappings = qKeys.length
    ? await q<any>(
        `SELECT qr.*, g.code AS reg_code, g.title AS reg_title, g.source_url
           FROM question_regulations qr
           JOIN regulations g ON g.reg_id = qr.reg_id
          WHERE qr.question_key IN (${qKeys.map(() => '?').join(',')})`,
        qKeys
      )
    : [];

  const questionsWithRegs = questions.map((x: any) => ({
    ...x,
    linked_regs: regMappings.filter((m: any) => m.question_key === x.question_key),
  }));

  const needle = (sp.q ?? '').toLowerCase();
  const shown = questionsWithRegs.filter(
    (x: any) => !needle || (x.question_text + ' ' + (x.recommendation ?? '')).toLowerCase().includes(needle)
  );

  const canMaster = Boolean(ps?.permissions.has('platform:forms.master_manage'));
  const canTenant = Boolean(s && can.editFormsAndRegs(s));
  const canEdit = form.tenant_id === null ? canMaster : Boolean(canTenant && s && form.tenant_id === s.tenantId);

  return (
    <>
      <PageHeader
        title={form.code + ' · ' + form.name}
        subtitle={`${form.industry} · ${total} items · v${form.version} · ${
          form.tenant_id ? 'Workspace Custom' : 'Master Library'
        }${canEdit ? ' · Builder Active' : ' · Read-Only (Clone to Customize)'}`}
      >
        <SearchForm defaultValue={sp.q} keep={{ s: current.section_no }} />
      </PageHeader>
      <div className="content">
        <Link href="/forms" style={{ fontSize: 12.5 }}>
          ← All Forms, Written Policies &amp; Scorecards
        </Link>
        <div className="split">
          <div
            className="frame"
            style={{
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'thin',
            }}
          >
            <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>
              Sections ({sections.length})
            </div>
            {sections.map((x: any) => {
              const on = x.section_no === current.section_no;
              return (
                <Link
                  key={x.section_no}
                  href={'/forms/' + form.code + '?s=' + x.section_no}
                  className="row"
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    fontSize: 13,
                    borderLeft: '4px solid ' + (on ? 'var(--acc)' : 'transparent'),
                    background: on ? 'var(--a1)' : '#fff',
                  }}
                >
                  <span className="kicker" style={{ width: 20 }}>
                    {x.section_no}
                  </span>
                  <span style={{ flex: 1, lineHeight: 1.3 }}>
                    {x.name}
                    {x.max_points ? <span className="sub"> ({x.max_points} pts)</span> : null}
                  </span>
                  <span className="kicker">{x.n}</span>
                </Link>
              );
            })}
          </div>
          <FormSectionView
            form={form}
            current={current}
            questions={shown}
            regs={regs}
            industries={industries.filter((i: any) => !i.disabled_for_tenant)}
            canEdit={canEdit}
            canMaster={canMaster}
            canTenant={canTenant}
            hasTeamWorkspace={Boolean(s)}
          />
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import FieldRunner from '@/components/FieldRunner';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/queries';
import { q, one } from '@/lib/db';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function FieldInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const [tenant, insp] = await Promise.all([
    getTenant(s),
    one<any>(
      `SELECT i.*, f.name AS form_name, f.scale, u.name AS consultant,
              m.name AS member, st.name AS site, st.jurisdiction
         FROM inspections i
         JOIN forms f ON f.code = i.form_code
         JOIN users u ON u.id = i.consultant_id
         JOIN sites st ON st.id = i.site_id
         JOIN members m ON m.id = st.member_id
        WHERE i.id = ? AND i.tenant_id = ?`,
      [id, s.tenantId]
    ),
  ]);
  if (!insp) notFound();

  const [sections, questions, ansRows, recRows, priorSiteRecs] = await Promise.all([
    q<any>('SELECT section_no, name FROM form_sections WHERE form_code=? ORDER BY section_no', [insp.form_code]),
    q<any>('SELECT * FROM questions WHERE form_code=? ORDER BY sort_order', [insp.form_code]),
    q<any>('SELECT * FROM answers WHERE inspection_id=?', [id]),
    q<any>('SELECT * FROM recommendations WHERE inspection_id=?', [id]),
    q<any>(
      `SELECT r.id, r.text, r.status, r.due_on
         FROM recommendations r
         JOIN inspections i2 ON i2.id = r.inspection_id
        WHERE i2.site_id = ? AND r.inspection_id <> ? AND r.status IN ('open','assumed')
        ORDER BY r.due_on LIMIT 5`,
      [insp.site_id, id]
    ),
  ]);

  const initialAnswers: Record<string, any> = {};
  for (const a of ansRows) initialAnswers[a.question_id] = a;
  const initialRecs: Record<string, any> = {};
  for (const r of recRows) if (r.question_id) initialRecs[r.question_id] = r;

  const accent = tenant.brand_scopes?.app ? guardAccent(tenant.accent) : '#4b2454';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', ['--acc' as string]: accent }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div className="kicker" style={{ color: 'var(--sand)' }}>Field Inspector · {insp.id} · {insp.form_code} v{insp.form_version}</div>
          <div style={{ font: '700 19px var(--fh)', letterSpacing: '.03em', textTransform: 'uppercase' }}>
            {insp.member} · {insp.site} ({insp.jurisdiction})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/field" className="btn btn-sm" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.35)', color: '#fff' }}>
            ← All Field Visits
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 24px 56px' }}>
        <FieldRunner
          insp={insp}
          sections={sections}
          questions={questions}
          initialAnswers={initialAnswers}
          initialRecs={initialRecs}
          priorSiteRecs={priorSiteRecs}
        />
      </main>
    </div>
  );
}


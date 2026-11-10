import { NextResponse } from 'next/server';
import {
  getOptionalSession,
  getOptionalPlatformSession,
  apiErrorResponse,
  ApiAuthError,
} from '@/lib/session';
import { verifySameOrigin } from '@/lib/security';
import { q, one, audit, platformAudit, nowSql } from '@/lib/db';

const VALID_CATEGORIES = ['field_inspection', 'maturity', 'policy_gap', 'lce_100', 'auto_sup_1_5', 'rca_percent'];
const VALID_SCALES = ['safe_unsafe_na', 'maturity', 'policy_gap', 'lce_100', 'auto_sup_1_5', 'rca_percent'];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export async function POST(req: Request) {
  try {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) throw new ApiAuthError(403, csrf.error);

    const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
    if (!teamSess && !platSess) throw new ApiAuthError(401, 'Authentication required.');

    const canMaster = Boolean(platSess?.permissions.has('platform:forms.master_manage'));
    const canTenant = Boolean(teamSess?.permissions.has('team:forms.tenant_manage'));

    const body = await req.json();
    const { action } = body as { action: string };

    // Helper to verify write ownership over an existing form
    const assertFormWriteAuth = async (code: string) => {
      const form = await one<any>('SELECT * FROM forms WHERE code=?', [code.toUpperCase()]);
      if (!form) throw new ApiAuthError(404, `Form ${code} not found.`);
      if (form.tenant_id === null) {
        if (!canMaster) {
          throw new ApiAuthError(
            403,
            'Master templates (Platform-wide) can only be edited by Platform Compliance Editors. Clone this template to customize it for your workspace.'
          );
        }
        return { form, isMaster: true };
      }
      if (!canTenant || !teamSess || form.tenant_id !== teamSess.tenantId) {
        throw new ApiAuthError(403, 'You do not have permission to edit this workspace template.');
      }
      return { form, isMaster: false };
    };

    if (action === 'create_form') {
      const wantMaster = body.scope === 'platform' || (!teamSess && canMaster);
      if (wantMaster && !canMaster) {
        throw new ApiAuthError(403, 'Missing platform:forms.master_manage permission to create Master templates.');
      }
      if (!wantMaster && !canTenant) {
        throw new ApiAuthError(403, 'Missing team:forms.tenant_manage permission to create Workspace templates.');
      }

      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 16);
      const name = String(body.name || '').trim().slice(0, 190);
      const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'field_inspection';
      const scale = VALID_SCALES.includes(body.scale) ? body.scale : category === 'policy_gap' ? 'policy_gap' : 'safe_unsafe_na';
      const industry = String(body.industry || 'General').trim().slice(0, 80);
      const shieldCode = body.shieldCode ? String(body.shieldCode).toUpperCase().slice(0, 32) : null;
      const subsectorCode = body.subsectorCode ? String(body.subsectorCode).toUpperCase().slice(0, 40) : null;
      const description = String(body.description || '').trim() || null;
      const allowAdditional = body.allowAdditionalFindings !== false ? 1 : 0;

      if (!code || code.length < 2 || !name) {
        return NextResponse.json({ error: 'Template code (2–16 chars) and title are required.' }, { status: 400 });
      }
      if (await one('SELECT code FROM forms WHERE code=?', [code])) {
        return NextResponse.json({ error: `Template code "${code}" is already in use.` }, { status: 409 });
      }

      const targetTenantId = wantMaster ? null : teamSess!.tenantId;
      await q(
        `INSERT INTO forms (code, tenant_id, name, industry, shield_code, subsector_code, category, scale, description, allow_additional_findings, is_archived, version, published_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,0,1,?)`,
        [code, targetTenantId, name, industry, shieldCode, subsectorCode, category, scale, description, allowAdditional, nowSql()]
      );

      const rawSections: { name: string; maxPoints?: number | null }[] = Array.isArray(body.sections) && body.sections.length
        ? body.sections
        : [{ name: category === 'policy_gap' ? 'Written Policy Elements & Statutory Mandates' : 'General Safety & Field Controls' }];

      let secNo = 1;
      for (const sec of rawSections) {
        const secName = String(sec?.name || `Section ${secNo}`).trim().slice(0, 190);
        const maxPts = sec?.maxPoints !== undefined && sec?.maxPoints !== null ? Number(sec.maxPoints) : null;
        await q('INSERT INTO form_sections (form_code, section_no, name, max_points) VALUES (?,?,?,?)', [
          code,
          secNo++,
          secName,
          maxPts,
        ]);
      }

      if (wantMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_created', null, 'form', code, { name, category, scale });
      } else {
        await audit(targetTenantId!, teamSess!.user.id, 'form.tenant_created', 'form', code, { name, category, scale }, teamSess!.impersonation?.platformUserId);
      }

      return NextResponse.json({ ok: true, code, message: `Created ${wantMaster ? 'Master' : 'Workspace'} template ${code} — ${name}.` });
    }

    const formCode = String(body.formCode || body.code || '').toUpperCase();
    const { form, isMaster } = await assertFormWriteAuth(formCode);

    if (action === 'update_form') {
      const name = String(body.name || form.name).trim().slice(0, 190);
      const category = VALID_CATEGORIES.includes(body.category) ? body.category : form.category || 'field_inspection';
      let scale = VALID_SCALES.includes(body.scale) ? body.scale : form.scale;
      const industry = String(body.industry || form.industry).trim().slice(0, 80);
      const shieldCode = body.shieldCode !== undefined ? (body.shieldCode ? String(body.shieldCode).toUpperCase().slice(0, 32) : null) : form.shield_code;
      const subsectorCode = body.subsectorCode !== undefined ? (body.subsectorCode ? String(body.subsectorCode).toUpperCase().slice(0, 40) : null) : form.subsector_code;
      const description = body.description !== undefined ? String(body.description || '').trim() || null : form.description;
      const allowAdditional = body.allowAdditionalFindings !== undefined ? (body.allowAdditionalFindings ? 1 : 0) : form.allow_additional_findings;

      if (scale !== form.scale) {
        const usedRow = await one<{ n: number }>('SELECT COUNT(*) AS n FROM inspections WHERE form_code=?', [formCode]);
        if ((usedRow?.n ?? 0) > 0) {
          return NextResponse.json(
            { error: `Cannot change scoring scale on ${formCode} because ${usedRow?.n} historical inspection(s) already use it. Clone a new form to use a different scale.` },
            { status: 409 }
          );
        }
      }

      await q(
        `UPDATE forms SET name=?, category=?, scale=?, industry=?, shield_code=?, subsector_code=?, description=?, allow_additional_findings=?
          WHERE code=?`,
        [name, category, scale, industry, shieldCode, subsectorCode, description, allowAdditional, formCode]
      );

      if (isMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_updated', null, 'form', formCode, { name, category, scale, industry });
      } else {
        await audit(form.tenant_id, teamSess!.user.id, 'form.tenant_updated', 'form', formCode, { name, category, scale, industry }, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, message: `${formCode} settings updated.` });
    }

    if (action === 'publish_form') {
      await q('UPDATE forms SET version = version + 1, published_at = ? WHERE code=?', [nowSql(), formCode]);
      if (isMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_published', null, 'form', formCode, { nextVersion: form.version + 1 });
      } else {
        await audit(form.tenant_id, teamSess!.user.id, 'form.tenant_published', 'form', formCode, { nextVersion: form.version + 1 }, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, message: `${formCode} published as v${form.version + 1}.` });
    }

    if (action === 'archive_form') {
      await q('UPDATE forms SET is_archived = 1 WHERE code=?', [formCode]);
      if (isMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_archived', null, 'form', formCode);
      } else {
        await audit(form.tenant_id, teamSess!.user.id, 'form.tenant_archived', 'form', formCode, undefined, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, message: `${formCode} archived.` });
    }

    if (action === 'restore_form') {
      await q('UPDATE forms SET is_archived = 0 WHERE code=?', [formCode]);
      if (isMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_restored', null, 'form', formCode);
      } else {
        await audit(form.tenant_id, teamSess!.user.id, 'form.tenant_restored', 'form', formCode, undefined, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, message: `${formCode} restored to active catalog.` });
    }

    if (action === 'delete_form') {
      const [inspRef, visitRef] = await Promise.all([
        one<{ n: number }>('SELECT COUNT(*) AS n FROM inspections WHERE form_code=?', [formCode]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM visits WHERE form_code=?', [formCode]),
      ]);
      if ((inspRef?.n ?? 0) > 0 || (visitRef?.n ?? 0) > 0) {
        return NextResponse.json(
          {
            error: `Cannot permanently delete ${formCode} because ${inspRef?.n ?? 0} inspection(s) and ${visitRef?.n ?? 0} scheduled visit(s) reference it (7-year compliance retention). Archive the template instead.`,
          },
          { status: 409 }
        );
      }

      const exclusiveKeys = await q<{ question_key: string }>(
        `SELECT DISTINCT question_key FROM questions
          WHERE form_code=?
            AND question_key NOT IN (SELECT DISTINCT question_key FROM (SELECT question_key FROM questions WHERE form_code<>?) AS other_q)`,
        [formCode, formCode]
      );
      if (exclusiveKeys.length > 0) {
        const ks = exclusiveKeys.map(k => k.question_key);
        await q(
          `DELETE FROM question_regulations WHERE question_key IN (${ks.map(() => '?').join(',')})`,
          ks
        );
      }
      await q('DELETE FROM questions WHERE form_code=?', [formCode]);
      await q('DELETE FROM form_sections WHERE form_code=?', [formCode]);
      await q('DELETE FROM forms WHERE code=?', [formCode]);

      if (isMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_deleted', null, 'form', formCode, { name: form.name });
      } else {
        await audit(form.tenant_id, teamSess!.user.id, 'form.tenant_deleted', 'form', formCode, { name: form.name }, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, message: `Template ${formCode} permanently deleted.` });
    }

    if (action === 'add_section') {
      const secName = String(body.name || '').trim().slice(0, 190);
      const maxPoints = body.maxPoints !== undefined && body.maxPoints !== '' && body.maxPoints !== null ? Number(body.maxPoints) : null;
      if (!secName) return NextResponse.json({ error: 'Section name is required.' }, { status: 400 });

      const maxRow = await one<{ m: number }>('SELECT COALESCE(MAX(section_no), 0) AS m FROM form_sections WHERE form_code=?', [formCode]);
      const nextSec = (maxRow?.m ?? 0) + 1;
      await q('INSERT INTO form_sections (form_code, section_no, name, max_points) VALUES (?,?,?,?)', [
        formCode,
        nextSec,
        secName,
        maxPoints,
      ]);
      return NextResponse.json({ ok: true, sectionNo: nextSec, message: `Section ${nextSec} ("${secName}") added.` });
    }

    if (action === 'update_section') {
      const sectionNo = Number(body.sectionNo);
      const secName = String(body.name || '').trim().slice(0, 190);
      const maxPoints = body.maxPoints !== undefined && body.maxPoints !== '' && body.maxPoints !== null ? Number(body.maxPoints) : null;
      if (!sectionNo || !secName) return NextResponse.json({ error: 'Section number and name are required.' }, { status: 400 });

      await q('UPDATE form_sections SET name=?, max_points=? WHERE form_code=? AND section_no=?', [
        secName,
        maxPoints,
        formCode,
        sectionNo,
      ]);
      return NextResponse.json({ ok: true, message: `Section ${sectionNo} updated.` });
    }

    if (action === 'delete_section') {
      const sectionNo = Number(body.sectionNo);
      const qCount = await one<{ n: number }>('SELECT COUNT(*) AS n FROM questions WHERE form_code=? AND section_no=?', [formCode, sectionNo]);
      if ((qCount?.n ?? 0) > 0) {
        return NextResponse.json({ error: 'Move or delete all items in this section before removing it.' }, { status: 409 });
      }
      const totalSec = await one<{ n: number }>('SELECT COUNT(*) AS n FROM form_sections WHERE form_code=?', [formCode]);
      if ((totalSec?.n ?? 0) <= 1) {
        return NextResponse.json({ error: 'A form must retain at least one section.' }, { status: 409 });
      }
      await q('DELETE FROM form_sections WHERE form_code=? AND section_no=?', [formCode, sectionNo]);
      return NextResponse.json({ ok: true, message: `Section ${sectionNo} removed.` });
    }

    if (action === 'import_questions_csv') {
      const csvText = String(body.csvText || '').trim();
      if (!csvText) return NextResponse.json({ error: 'Paste CSV rows to import.' }, { status: 400 });

      const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let imported = 0;
      let maxSort = (await one<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0) AS m FROM questions WHERE form_code=?', [formCode]))?.m ?? 0;

      for (let idx = 0; idx < lines.length; idx++) {
        const cols = parseCsvLine(lines[idx]);
        // Skip header row if detected
        if (idx === 0 && /question_text|section/i.test(cols.join(','))) continue;
        const secNo = Math.max(1, Number(cols[0]) || 1);
        const qText = String(cols[1] || '').trim();
        if (!qText) continue;

        // Ensure section exists
        await q('INSERT IGNORE INTO form_sections (form_code, section_no, name) VALUES (?,?,?)', [
          formCode,
          secNo,
          `Section ${secNo}`,
        ]);

        const prio = ['High', 'Med', 'Low'].includes(cols[2]) ? cols[2] : 'Med';
        const topic = String(cols[3] || 'general').trim().slice(0, 40);
        const recText = String(cols[4] || '').trim() || null;
        const threshold = cols[5] !== undefined && cols[5] !== '' && !Number.isNaN(Number(cols[5])) ? Number(cols[5]) : null;
        const unit = cols[6] ? String(cols[6]).trim().slice(0, 20) : null;

        const existingCount = (await one<{ n: number }>('SELECT COUNT(*) AS n FROM questions WHERE form_code=? AND section_no=?', [formCode, secNo]))?.n ?? 0;
        const nextIdx = existingCount + 1;
        const questionId = `${secNo}.${nextIdx}`.slice(0, 10);
        const questionKey = `${formCode}-${String(secNo).padStart(2, '0')}-${String(nextIdx).padStart(2, '0')}`.slice(0, 32);
        maxSort += 1;

        await q(
          `INSERT INTO questions
             (form_code, question_id, question_key, section_no, sort_order, question_text, answer_type, requires_rec, photo_required, priority, topic, measure_unit, threshold, recommendation, is_shared)
           VALUES (?,?,?,?,?,?,?,1,0,?,?,?,?,?,0)`,
          [formCode, questionId, questionKey, secNo, maxSort, qText, form.scale, prio, topic, unit, threshold, recText]
        );
        imported++;
      }

      if (imported > 0) {
        await q('UPDATE forms SET version = version + 1, published_at = ? WHERE code=?', [nowSql(), formCode]);
      }
      return NextResponse.json({ ok: true, imported, message: `Imported ${imported} question(s) into ${formCode}.` });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}


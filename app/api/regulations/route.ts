import { NextResponse } from 'next/server';
import { getSession, can } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { todayISO } from '@/lib/format';

export async function POST(req: Request) {
  const s = await getSession();
  if (!can.editFormsAndRegs(s)) {
    return NextResponse.json({ error: 'Only Owners and Admins can manage the regulation library.' }, { status: 403 });
  }
  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'create') {
    const jurisdiction = String(body.jurisdiction || 'CA').toUpperCase();
    const agency = String(body.agency || '').trim();
    const code = String(body.code || '').trim();
    const title = String(body.title || '').trim();
    const topic = String(body.topic || 'general').trim();
    const summary = String(body.summary || '').trim();
    const verbatimText = String(body.verbatimText || '').trim() || null;
    const sourceUrl = String(body.sourceUrl || '').trim() || 'https://www.osha.gov';
    const verifiedToday = !!(body.verifiedToday || body.verifyNow) && !!verbatimText;
    const notes = String(body.notes || '').trim() || null;

    if (!agency || !code || !title || !summary || !sourceUrl) {
      return NextResponse.json({ error: 'Agency, citation code, section title, summary, and source URL are required.' }, { status: 400 });
    }

    const regId = `${jurisdiction}-${code.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 40);
    if (await one('SELECT reg_id FROM regulations WHERE reg_id=?', [regId])) {
      return NextResponse.json({ error: `Regulation ${regId} already exists. Use Supersede if the law changed.` }, { status: 409 });
    }

    const verifiedOn = verifiedToday ? todayISO() : null;
    const verifiedBy = verifiedToday ? s.user.name : null;
    const status = verifiedToday ? 'active' : 'UNVERIFIED - paste from source';

    await q(
      `INSERT INTO regulations (reg_id, jurisdiction, agency, code, title, topic, summary, verbatim_text, source_url, verified_on, verified_by, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [regId, jurisdiction, agency, code, title, topic, summary, verbatimText, sourceUrl, verifiedOn, verifiedBy, status, notes]
    );
    await audit(s.tenantId, s.user.id, 'regulation.created', 'regulation', regId, { code, jurisdiction, status });
    return NextResponse.json({ ok: true, message: `Regulation ${code} (${regId}) added.`, regId });
  }

  if (action === 'verify') {
    const regId = String(body.regId || '');
    const verbatimText = String(body.verbatimText || '').trim();
    const sourceUrl = String(body.sourceUrl || '').trim();
    const notes = String(body.notes || '').trim() || null;

    if (!verbatimText) {
      return NextResponse.json({ error: 'Paste the verbatim regulation text from the official agency source to verify.' }, { status: 400 });
    }

    const existing = await one<any>('SELECT * FROM regulations WHERE reg_id=?', [regId]);
    if (!existing) return NextResponse.json({ error: 'Regulation not found.' }, { status: 404 });
    if (existing.verified_on) {
      return NextResponse.json({ error: 'Verified entries cannot be edited in place. Use Supersede instead.' }, { status: 409 });
    }

    const today = todayISO();
    await q(
      'UPDATE regulations SET verbatim_text=?, source_url=?, verified_on=?, verified_by=?, status=?, notes=? WHERE reg_id=?',
      [verbatimText, sourceUrl || existing.source_url, today, s.user.name, 'active', notes, regId]
    );
    await audit(s.tenantId, s.user.id, 'regulation.verified', 'regulation', regId, { verifiedOn: today });
    return NextResponse.json({ ok: true, message: `${existing.code} verified on ${today}.` });
  }

  if (action === 'supersede') {
    const oldRegId = String(body.oldRegId || '');
    const oldReg = await one<any>('SELECT * FROM regulations WHERE reg_id=?', [oldRegId]);
    if (!oldReg) return NextResponse.json({ error: 'Original regulation not found.' }, { status: 404 });

    const code = String(body.code || oldReg.code).trim();
    const title = String(body.title || oldReg.title).trim();
    const summary = String(body.summary || oldReg.summary).trim();
    const verbatimText = String(body.verbatimText || '').trim() || null;
    const sourceUrl = String(body.sourceUrl || oldReg.source_url).trim();
    const notes = String(body.notes || '').trim() || null;

    const baseId = `${oldReg.jurisdiction}-${code.replace(/[^A-Za-z0-9]/g, '')}`;
    const newRegId = (baseId === oldRegId ? `${baseId}-R${Date.now().toString().slice(-4)}` : baseId).slice(0, 40);
    const today = verbatimText ? todayISO() : null;
    const status = verbatimText ? 'active' : 'UNVERIFIED - paste from source';

    await q(
      `INSERT INTO regulations (reg_id, jurisdiction, agency, code, title, topic, summary, verbatim_text, source_url, verified_on, verified_by, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [newRegId, oldReg.jurisdiction, oldReg.agency, code, title, oldReg.topic, summary, verbatimText, sourceUrl, today, today ? s.user.name : null, status, notes]
    );
    await q("UPDATE regulations SET status='superseded', superseded_by=? WHERE reg_id=?", [newRegId, oldRegId]);
    await q('UPDATE question_regulations SET reg_id=? WHERE reg_id=?', [newRegId, oldRegId]);
    await audit(s.tenantId, s.user.id, 'regulation.superseded', 'regulation', oldRegId, { supersededBy: newRegId });
    return NextResponse.json({ ok: true, message: `${oldReg.code} superseded by ${newRegId}.`, newRegId });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}


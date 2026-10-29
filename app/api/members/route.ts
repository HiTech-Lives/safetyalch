import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSession, can } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { crewIds } from '@/lib/queries';

const JURISDICTIONS = ['FED', 'CA', 'NV', 'WA', 'OR', 'AZ', 'TX', 'UT', 'BC', 'USA-FED', 'USA-OR', 'USA-WA', 'CAN-BC', 'CAN-FED'];

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'create_member') {
    if (!can.createMember(s)) {
      return NextResponse.json({ error: 'Only Owners and Admins can create a Member.' }, { status: 403 });
    }
    const name = String(body.name || '').trim();
    const industry = String(body.industry || 'General').trim();
    const city = String(body.city || '').trim() || null;
    const contactName = String(body.contactName || '').trim();
    const contactEmail = String(body.contactEmail || '').trim().toLowerCase();
    const siteName = String(body.siteName || 'Main site').trim();
    const siteAddress = String(body.siteAddress || '').trim() || null;
    const jurisdiction = String(body.jurisdiction || 'CA').toUpperCase();
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : (Array.isArray(body.assignedUserIds) ? body.assignedUserIds : []);

    if (!name) return NextResponse.json({ error: 'Member name is required.' }, { status: 400 });
    if (!contactName || !contactEmail) return NextResponse.json({ error: 'Primary contact name and email are required.' }, { status: 400 });
    if (!JURISDICTIONS.includes(jurisdiction)) return NextResponse.json({ error: 'Invalid jurisdiction.' }, { status: 400 });

    const memberId = randomUUID();
    const contactId = randomUUID();
    const siteId = randomUUID();

    await q('INSERT INTO members (id, tenant_id, name, industry, city) VALUES (?,?,?,?,?)', [memberId, s.tenantId, name, industry, city]);
    await q('INSERT INTO member_contacts (id, member_id, name, email, is_primary) VALUES (?,?,?,?,1)', [contactId, memberId, contactName, contactEmail]);
    await q('INSERT INTO sites (id, member_id, name, address, jurisdiction) VALUES (?,?,?,?,?)', [siteId, memberId, siteName, siteAddress, jurisdiction]);

    for (const uid of userIds) {
      await q('INSERT IGNORE INTO member_assignments (member_id, user_id) VALUES (?,?)', [memberId, uid]);
    }
    await audit(s.tenantId, s.user.id, 'member.created', 'member', memberId, { name, siteName, jurisdiction, assigned: userIds });
    return NextResponse.json({ ok: true, message: `Member "${name}" created.`, memberId });
  }

  if (action === 'add_site') {
    if (!can.createMember(s)) {
      return NextResponse.json({ error: 'Only Owners and Admins can add sites.' }, { status: 403 });
    }
    const memberId = String(body.memberId || '');
    const siteName = String(body.siteName || body.name || '').trim();
    const address = String(body.address || '').trim() || null;
    const jurisdiction = String(body.jurisdiction || 'CA').toUpperCase();

    if (!memberId || !siteName) return NextResponse.json({ error: 'Site name is required.' }, { status: 400 });
    if (!JURISDICTIONS.includes(jurisdiction)) return NextResponse.json({ error: 'Invalid jurisdiction.' }, { status: 400 });

    const m = await one<any>('SELECT id, name FROM members WHERE id=? AND tenant_id=?', [memberId, s.tenantId]);
    if (!m) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

    const siteId = randomUUID();
    await q('INSERT INTO sites (id, member_id, name, address, jurisdiction) VALUES (?,?,?,?,?)', [siteId, memberId, siteName, address, jurisdiction]);
    await audit(s.tenantId, s.user.id, 'site.added', 'site', siteId, { memberId, siteName, jurisdiction });
    return NextResponse.json({ ok: true, message: `Site "${siteName}" (${jurisdiction}) added to ${m.name}.` });
  }

  if (action === 'set_assignments') {
    if (!can.assignMembers(s)) {
      return NextResponse.json({ error: 'Not authorized to assign Consultants.' }, { status: 403 });
    }
    const memberId = String(body.memberId || '');
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : (Array.isArray(body.assignedUserIds) ? body.assignedUserIds : []);
    const m = await one<any>('SELECT id, name FROM members WHERE id=? AND tenant_id=?', [memberId, s.tenantId]);
    if (!m) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

    const crew = await crewIds(s);
    if (crew) {
      // Supervisor can only modify assignments for their own crew
      await q('DELETE FROM member_assignments WHERE member_id=? AND user_id IN (?)', [memberId, crew]);
      for (const uid of userIds.filter(u => crew.includes(u))) {
        await q('INSERT IGNORE INTO member_assignments (member_id, user_id) VALUES (?,?)', [memberId, uid]);
      }
    } else {
      await q('DELETE FROM member_assignments WHERE member_id=?', [memberId]);
      for (const uid of userIds) {
        await q('INSERT IGNORE INTO member_assignments (member_id, user_id) VALUES (?,?)', [memberId, uid]);
      }
    }

    await audit(s.tenantId, s.user.id, 'member.assigned', 'member', memberId, { assigned: userIds });
    return NextResponse.json({ ok: true, message: `Assignments updated for ${m.name}.` });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}


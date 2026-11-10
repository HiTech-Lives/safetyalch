import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireApiSession, can, apiErrorResponse } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { crewIds, listMembers } from '@/lib/queries';
import { assertUsersInTenant } from '@/lib/acl';
import { sanitizeCsvCell } from '@/lib/security';

const WATCH_TIERS = ['none', 'green', 'yellow', 'orange', 'red'];

async function isValidJurisdiction(code: string): Promise<boolean> {
  if (!/^[A-Z-]{2,12}$/.test(code)) return false;
  const row = await one('SELECT code FROM jurisdiction_portals WHERE code=?', [code]);
  if (row) return true;
  return ['FED', 'CA', 'NV', 'WA', 'OR', 'AZ', 'TX', 'UT', 'BC', 'DC', 'PR', 'VI'].includes(code);
}

export async function GET(req: Request) {
  try {
    const s = await requireApiSession();
    const url = new URL(req.url);
    if (url.searchParams.get('export') === 'csv') {
      const members = await listMembers(s);
      const headers = [
        'Member Name',
        'Group / Gem',
        'Shield Line',
        'Industry',
        'Sub-Sector',
        'Watch Tier',
        'Employees',
        'City',
        'Broker Firm',
        'Broker Contact',
        'Primary Contact',
        'Contact Email',
        'Sites',
        'Open Findings',
      ];
      const lines = [
        headers.join(','),
        ...members.map((m: any) =>
          [
            m.name,
            m.group_code || '',
            m.shield_brand || '',
            m.industry,
            m.subsector_code || '',
            m.watch_tier || 'none',
            m.employee_count ?? '',
            m.city || '',
            m.broker_firm || '',
            m.broker_name || '',
            m.contact || '',
            m.contact_email || '',
            (m.sites || []).map((st: any) => `${st.name} (${st.jurisdiction})`).join('; '),
            m.open ?? 0,
          ]
            .map(v => `"${sanitizeCsvCell(v).replace(/"/g, '""')}"`)
            .join(',')
        ),
      ];
      return new NextResponse(lines.join('\r\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="members-directory.csv"',
        },
      });
    }
    return NextResponse.json({ members: await listMembers(s) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req);
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'create_member') {
      if (!can.createMember(s)) {
        return NextResponse.json({ error: 'Missing team:members.manage permission.' }, { status: 403 });
      }
      const name = String(body.name || '').trim();
      const industry = String(body.industry || 'General').trim();
      const industryLineId = body.industryLineId ? String(body.industryLineId) : null;
      const subsectorCode = body.subsectorCode ? String(body.subsectorCode).slice(0, 40) : null;
      const groupId = body.groupId ? String(body.groupId) : null;
      const watchTier = WATCH_TIERS.includes(body.watchTier) ? body.watchTier : 'none';
      const flags = Array.isArray(body.flags)
        ? body.flags.map((x: unknown) => String(x).trim()).filter(Boolean)
        : String(body.flags || '')
            .split(',')
            .map(x => x.trim())
            .filter(Boolean);
      const brokerName = String(body.brokerName || '').trim() || null;
      const brokerEmail = String(body.brokerEmail || '').trim().toLowerCase() || null;
      const brokerFirm = String(body.brokerFirm || '').trim() || null;
      const employeeCount = body.employeeCount ? Math.max(0, Number(body.employeeCount)) : null;
      const descriptionOfOperations = String(body.descriptionOfOperations || '').trim() || null;
      const city = String(body.city || '').trim() || null;

      const contactName = String(body.contactName || '').trim();
      const contactEmail = String(body.contactEmail || '').trim().toLowerCase();
      const siteName = String(body.siteName || 'Main site').trim();
      const siteAddress = String(body.siteAddress || '').trim() || null;
      const siteEmployees = body.siteEmployeeCount ? Math.max(0, Number(body.siteEmployeeCount)) : employeeCount;
      const siteOps = String(body.siteDescriptionOfOperations || '').trim() || descriptionOfOperations;
      const jurisdiction = String(body.jurisdiction || 'CA').toUpperCase().slice(0, 8);
      const userIds: string[] = Array.isArray(body.userIds)
        ? body.userIds
        : Array.isArray(body.assignedUserIds)
        ? body.assignedUserIds
        : [];

      if (!name) return NextResponse.json({ error: 'Member name is required.' }, { status: 400 });
      if (!contactName || !contactEmail) return NextResponse.json({ error: 'Primary contact name and email are required.' }, { status: 400 });
      if (!(await isValidJurisdiction(jurisdiction))) return NextResponse.json({ error: 'Invalid jurisdiction code.' }, { status: 400 });

      if (groupId) {
        const g = await one('SELECT id FROM tenant_member_groups WHERE id=? AND tenant_id=?', [groupId, s.tenantId]);
        if (!g) return NextResponse.json({ error: 'Selected portfolio group does not belong to this workspace.' }, { status: 403 });
      }
      await assertUsersInTenant(s.tenantId, userIds);

      const memberId = randomUUID();
      const contactId = randomUUID();
      const siteId = randomUUID();

      await q(
        `INSERT INTO members
           (id, tenant_id, name, industry, industry_line_id, subsector_code, group_id, watch_tier, flags_json,
            broker_name, broker_email, broker_firm, employee_count, description_of_operations, city)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          memberId,
          s.tenantId,
          name,
          industry,
          industryLineId,
          subsectorCode,
          groupId,
          watchTier,
          JSON.stringify(flags),
          brokerName,
          brokerEmail,
          brokerFirm,
          employeeCount,
          descriptionOfOperations,
          city,
        ]
      );
      await q('INSERT INTO member_contacts (id, member_id, name, email, is_primary) VALUES (?,?,?,?,1)', [
        contactId,
        memberId,
        contactName,
        contactEmail,
      ]);
      await q(
        'INSERT INTO sites (id, member_id, name, address, jurisdiction, employee_count, description_of_operations) VALUES (?,?,?,?,?,?,?)',
        [siteId, memberId, siteName, siteAddress, jurisdiction, siteEmployees, siteOps]
      );

      for (const uid of userIds) {
        await q('INSERT IGNORE INTO member_assignments (member_id, user_id) VALUES (?,?)', [memberId, uid]);
      }

      await audit(
        s.tenantId,
        s.user.id,
        'member.created',
        'member',
        memberId,
        { name, groupId, industryLineId, watchTier, siteName, jurisdiction },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({ ok: true, message: `Member "${name}" created.`, memberId });
    }

    if (action === 'update_member') {
      if (!can.createMember(s)) {
        return NextResponse.json({ error: 'Missing team:members.manage permission.' }, { status: 403 });
      }
      const memberId = String(body.memberId || '');
      const m = await one<any>('SELECT * FROM members WHERE id=? AND tenant_id=?', [memberId, s.tenantId]);
      if (!m) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

      const groupId = body.groupId !== undefined ? (body.groupId ? String(body.groupId) : null) : m.group_id;
      if (groupId) {
        const g = await one('SELECT id FROM tenant_member_groups WHERE id=? AND tenant_id=?', [groupId, s.tenantId]);
        if (!g) return NextResponse.json({ error: 'Invalid portfolio group.' }, { status: 403 });
      }

      const name = String(body.name || m.name).trim();
      const industry = String(body.industry || m.industry).trim();
      const industryLineId = body.industryLineId !== undefined ? (body.industryLineId ? String(body.industryLineId) : null) : m.industry_line_id;
      const subsectorCode = body.subsectorCode !== undefined ? (body.subsectorCode ? String(body.subsectorCode).slice(0, 40) : null) : m.subsector_code;
      const watchTier = WATCH_TIERS.includes(body.watchTier) ? body.watchTier : m.watch_tier;
      const flags =
        body.flags !== undefined
          ? JSON.stringify(
              Array.isArray(body.flags)
                ? body.flags.map((x: unknown) => String(x).trim()).filter(Boolean)
                : String(body.flags || '')
                    .split(',')
                    .map(x => x.trim())
                    .filter(Boolean)
            )
          : typeof m.flags_json === 'string'
          ? m.flags_json
          : JSON.stringify(m.flags_json || []);

      const brokerName = body.brokerName !== undefined ? String(body.brokerName || '').trim() || null : m.broker_name;
      const brokerEmail = body.brokerEmail !== undefined ? String(body.brokerEmail || '').trim().toLowerCase() || null : m.broker_email;
      const brokerFirm = body.brokerFirm !== undefined ? String(body.brokerFirm || '').trim() || null : m.broker_firm;
      const employeeCount = body.employeeCount !== undefined ? (body.employeeCount !== '' && body.employeeCount !== null ? Number(body.employeeCount) : null) : m.employee_count;
      const descriptionOfOperations = body.descriptionOfOperations !== undefined ? String(body.descriptionOfOperations || '').trim() || null : m.description_of_operations;
      const city = body.city !== undefined ? String(body.city || '').trim() || null : m.city;

      await q(
        `UPDATE members
            SET name=?, industry=?, industry_line_id=?, subsector_code=?, group_id=?, watch_tier=?, flags_json=?,
                broker_name=?, broker_email=?, broker_firm=?, employee_count=?, description_of_operations=?, city=?
          WHERE id=? AND tenant_id=?`,
        [
          name,
          industry,
          industryLineId,
          subsectorCode,
          groupId,
          watchTier,
          flags,
          brokerName,
          brokerEmail,
          brokerFirm,
          employeeCount,
          descriptionOfOperations,
          city,
          memberId,
          s.tenantId,
        ]
      );

      if (body.contactName && body.contactEmail) {
        await q('UPDATE member_contacts SET name=?, email=? WHERE member_id=? AND is_primary=1', [
          String(body.contactName).trim(),
          String(body.contactEmail).trim().toLowerCase(),
          memberId,
        ]);
      }

      await audit(s.tenantId, s.user.id, 'member.updated', 'member', memberId, { name, groupId, watchTier }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `${name} profile updated.` });
    }

    if (action === 'add_site') {
      if (!can.createMember(s)) {
        return NextResponse.json({ error: 'Missing team:members.manage permission.' }, { status: 403 });
      }
      const memberId = String(body.memberId || '');
      const siteName = String(body.siteName || body.name || '').trim();
      const address = String(body.address || '').trim() || null;
      const jurisdiction = String(body.jurisdiction || 'CA').toUpperCase().slice(0, 8);
      const employeeCount = body.employeeCount ? Math.max(0, Number(body.employeeCount)) : null;
      const descriptionOfOperations = String(body.descriptionOfOperations || '').trim() || null;

      if (!memberId || !siteName) return NextResponse.json({ error: 'Site name is required.' }, { status: 400 });
      if (!(await isValidJurisdiction(jurisdiction))) return NextResponse.json({ error: 'Invalid jurisdiction.' }, { status: 400 });

      const m = await one<any>('SELECT id, name FROM members WHERE id=? AND tenant_id=?', [memberId, s.tenantId]);
      if (!m) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

      const siteId = randomUUID();
      await q(
        'INSERT INTO sites (id, member_id, name, address, jurisdiction, employee_count, description_of_operations) VALUES (?,?,?,?,?,?,?)',
        [siteId, memberId, siteName, address, jurisdiction, employeeCount, descriptionOfOperations]
      );
      await audit(s.tenantId, s.user.id, 'site.added', 'site', siteId, { memberId, siteName, jurisdiction }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `Site "${siteName}" (${jurisdiction}) added to ${m.name}.` });
    }

    if (action === 'set_assignments') {
      if (!can.assignMembers(s)) {
        return NextResponse.json({ error: 'Not authorized to assign Consultants.' }, { status: 403 });
      }
      const memberId = String(body.memberId || '');
      const userIds: string[] = Array.isArray(body.userIds)
        ? body.userIds
        : Array.isArray(body.assignedUserIds)
        ? body.assignedUserIds
        : [];
      const m = await one<any>('SELECT id, name FROM members WHERE id=? AND tenant_id=?', [memberId, s.tenantId]);
      if (!m) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

      await assertUsersInTenant(s.tenantId, userIds);

      const crew = await crewIds(s);
      if (crew) {
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

      await audit(s.tenantId, s.user.id, 'member.assigned', 'member', memberId, { assigned: userIds }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `Assignments updated for ${m.name}.` });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

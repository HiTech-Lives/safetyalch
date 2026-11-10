import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { q, one, audit, nowSql } from '@/lib/db';
import { generateOpaqueToken, sha256Hex } from '@/lib/security';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { canActOn } from '@/lib/queries';

export async function GET(req: Request) {
  try {
    const s = await requireApiSession(undefined, 'team:reports.share');
    const url = new URL(req.url);
    const entityType = url.searchParams.get('entityType') || 'inspection';
    const entityId = url.searchParams.get('entityId') || '';
    if (!entityId) return NextResponse.json({ links: [] });

    const links = await q<any>(
      `SELECT rsl.id, rsl.entity_type, rsl.entity_id, rsl.recipient_label, rsl.report_mode,
              rsl.expires_at, rsl.revoked_at, rsl.access_count, rsl.last_accessed_at, rsl.created_at,
              u.name AS created_by_name
         FROM report_share_links rsl
         JOIN users u ON u.id = rsl.created_by
        WHERE rsl.tenant_id=? AND rsl.entity_type=? AND rsl.entity_id=?
        ORDER BY rsl.created_at DESC`,
      [s.tenantId, entityType, entityId]
    );
    return NextResponse.json({ links });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:reports.share');
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'create') {
      const entityType = body.entityType === 'quick_report' ? 'quick_report' : 'inspection';
      const entityId = String(body.entityId || '').trim();
      const recipientLabel = String(body.recipientLabel || 'External Broker / Carrier').trim().slice(0, 180);
      const reportMode = ['full', 'gap', 'letter', 'photos', 'response'].includes(body.reportMode)
        ? String(body.reportMode)
        : 'full';
      const days = Math.max(1, Math.min(30, Number(body.days) || 7));

      if (!entityId) {
        return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
      }

      if (entityType === 'inspection') {
        const insp = await one<any>(
          `SELECT i.id, i.consultant_id, m.group_id
             FROM inspections i
             JOIN sites st ON st.id = i.site_id
             JOIN members m ON m.id = st.member_id
            WHERE i.id=? AND i.tenant_id=?`,
          [entityId, s.tenantId]
        );
        if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
        if (!(await canActOn(s, insp.consultant_id))) {
          return NextResponse.json({ error: 'Outside your crew scope.' }, { status: 403 });
        }
        if (s.groupScopes.length && (!insp.group_id || !s.groupScopes.includes(insp.group_id))) {
          return NextResponse.json({ error: 'Outside your portfolio group scope.' }, { status: 403 });
        }
      } else {
        const qr = await one<any>(
          `SELECT qr.id, qr.author_id, m.group_id
             FROM quick_reports qr
             JOIN members m ON m.id = qr.member_id
            WHERE qr.id=? AND qr.tenant_id=?`,
          [entityId, s.tenantId]
        );
        if (!qr) return NextResponse.json({ error: 'Quick report not found.' }, { status: 404 });
        if (!(await canActOn(s, qr.author_id))) {
          return NextResponse.json({ error: 'Outside your crew scope.' }, { status: 403 });
        }
      }

      const rawToken = generateOpaqueToken();
      const id = randomUUID();
      const expiresAt = nowSql(days * 86400 * 1000);

      await q(
        `INSERT INTO report_share_links
           (id, tenant_id, entity_type, entity_id, token_hash, recipient_label, report_mode, expires_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, s.tenantId, entityType, entityId, sha256Hex(rawToken), recipientLabel, reportMode, expiresAt, s.user.id]
      );

      await audit(
        s.tenantId,
        s.user.id,
        'report.share_created',
        entityType,
        entityId,
        { shareId: id, recipientLabel, reportMode, days, expiresAt },
        s.impersonation?.platformUserId
      );

      const basePath =
        entityType === 'inspection' ? `/inspections/${entityId}/report` : `/quick-reports/${entityId}/report`;
      const shareUrl = `${basePath}?mode=${encodeURIComponent(reportMode)}&share=${rawToken}`;

      return NextResponse.json({
        ok: true,
        id,
        shareUrl,
        expiresAt,
        message: `Time-limited ${days}-day read-only link created for "${recipientLabel}".`,
      });
    }

    if (action === 'revoke') {
      const id = String(body.id || '').trim();
      const existing = await one<any>('SELECT * FROM report_share_links WHERE id=? AND tenant_id=?', [id, s.tenantId]);
      if (!existing) return NextResponse.json({ error: 'Share link not found.' }, { status: 404 });
      await q('UPDATE report_share_links SET revoked_at=? WHERE id=? AND tenant_id=?', [nowSql(), id, s.tenantId]);
      await audit(
        s.tenantId,
        s.user.id,
        'report.share_revoked',
        existing.entity_type,
        existing.entity_id,
        { shareId: id },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({ ok: true, message: 'External share link revoked immediately.' });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}


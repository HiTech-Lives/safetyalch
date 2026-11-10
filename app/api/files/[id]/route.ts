import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { one, nowSql } from '@/lib/db';
import { sha256Hex } from '@/lib/security';
import { getOptionalSession, getOptionalPortalSession, getOptionalPlatformSession } from '@/lib/session';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await one<any>('SELECT * FROM stored_files WHERE id=?', [id]);
  if (!file) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  const url = new URL(req.url);
  const shareRaw = url.searchParams.get('share');

  let authorized = false;

  // 1. Check if this file is an active tenant's brand logo (safe to render on sign-in, portal & reports)
  const logoTenant = await one<{ id: string }>('SELECT id FROM tenants WHERE id=? AND logo_key=?', [
    file.tenant_id,
    `/api/files/${file.id}`,
  ]);
  if (logoTenant) {
    authorized = true;
  }

  // 2. Check Team Workspace Session
  if (!authorized) {
    const teamSess = await getOptionalSession();
    if (teamSess && teamSess.tenantId === file.tenant_id) {
      authorized = true;
    }
  }

  // 3. Check Platform Super/Ops Admin Session
  if (!authorized) {
    const platSess = await getOptionalPlatformSession();
    if (platSess && platSess.permissions.has('platform:tenants.view')) {
      authorized = true;
    }
  }

  // 4. Check Member Portal Session
  if (!authorized) {
    const portalSess = await getOptionalPortalSession();
    if (
      portalSess &&
      portalSess.tenantId === file.tenant_id &&
      (!file.member_id || portalSess.memberId === file.member_id)
    ) {
      authorized = true;
    }
  }

  // 5. Check Expiring External Share Token
  if (!authorized && shareRaw && shareRaw.length >= 32) {
    const share = await one<any>(
      `SELECT * FROM report_share_links
        WHERE token_hash=? AND tenant_id=? AND revoked_at IS NULL AND expires_at > ?`,
      [sha256Hex(shareRaw), file.tenant_id, nowSql()]
    );
    if (share) {
      if (
        (share.entity_type === 'inspection' && share.entity_id === file.inspection_id) ||
        (share.entity_type === 'quick_report' && share.entity_id === file.quick_report_id)
      ) {
        authorized = true;
      }
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Authentication required to view this private file.' }, { status: 403 });
  }

  // Prevent path traversal outside .storage/uploads
  const storageRoot = path.resolve(process.cwd(), '.storage', 'uploads');
  const absPath = path.resolve(process.cwd(), file.disk_path);
  if (!absPath.startsWith(storageRoot)) {
    return NextResponse.json({ error: 'Invalid storage path.' }, { status: 400 });
  }

  try {
    const bytes = await fs.readFile(absPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.original_name || file.id)}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Stored file missing on disk.' }, { status: 404 });
  }
}


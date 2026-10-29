import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSession, can } from '@/lib/session';
import { q, audit } from '@/lib/db';

export async function POST(req: Request) {
  const s = await getSession();
  if (!can.manageBrand(s)) return NextResponse.json({ error: 'Only Owners and Admins can change the brand.' }, { status: 403 });
  const b = (await req.json()) as {
    name: string;
    domain: string;
    sender: string;
    accent: string;
    logo?: string;
    logoDataUrl?: string;
    scopes: Record<string, boolean>;
  };
  if (!b.name?.trim()) return NextResponse.json({ error: 'Business name is required.' }, { status: 400 });
  if (!/^#[0-9a-f]{6}$/i.test(b.accent)) return NextResponse.json({ error: 'Accent must be a hex color like #4b2454.' }, { status: 400 });

  let logoPath: string | undefined = undefined;
  if (b.logoDataUrl && b.logoDataUrl.startsWith('data:image/')) {
    const m = b.logoDataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (m) {
      const ext = m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1];
      const buf = Buffer.from(m[2], 'base64');
      const fileName = `logo-${s.tenantId}-${Date.now()}.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'brand');
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), buf);
      logoPath = `/uploads/brand/${fileName}`;
    }
  } else if (b.logo !== undefined) {
    logoPath = b.logo || '';
  }

  const scopes = Object.fromEntries(['app', 'reports', 'email', 'portal', 'signin'].map(k => [k, !!b.scopes?.[k]]));
  if (logoPath !== undefined) {
    await q('UPDATE tenants SET name=?, custom_domain=?, email_sender=?, accent=?, logo_key=?, brand_scopes=? WHERE id=?', [
      b.name.trim(),
      b.domain.trim() || null,
      b.sender.trim() || null,
      b.accent.toLowerCase(),
      logoPath || null,
      JSON.stringify(scopes),
      s.tenantId,
    ]);
  } else {
    await q('UPDATE tenants SET name=?, custom_domain=?, email_sender=?, accent=?, brand_scopes=? WHERE id=?', [
      b.name.trim(),
      b.domain.trim() || null,
      b.sender.trim() || null,
      b.accent.toLowerCase(),
      JSON.stringify(scopes),
      s.tenantId,
    ]);
  }
  await audit(s.tenantId, s.user.id, 'brand.updated', 'tenant', s.tenantId, { accent: b.accent, logo: logoPath, scopes });
  return NextResponse.json({ ok: true, logo: logoPath });
}

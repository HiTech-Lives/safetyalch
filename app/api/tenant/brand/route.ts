import { NextResponse } from 'next/server';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { q, audit } from '@/lib/db';
import { getTenant } from '@/lib/queries';
import { validateAndStoreUpload } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:brand.manage');
    const current = await getTenant(s);

    const b = (await req.json()) as {
      name: string;
      domain: string;
      sender: string;
      accent: string;
      logo?: string;
      logoDataUrl?: string;
      scopes: Record<string, boolean>;
      ssoConfig?: {
        enabled?: boolean;
        providerName?: string;
        issuerUrl?: string;
        clientId?: string;
        authorizationUrl?: string;
      };
    };

    if (!b.name?.trim()) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 });
    }
    if (!/^#[0-9a-f]{6}$/i.test(b.accent)) {
      return NextResponse.json({ error: 'Accent must be a hex color like #4b2454.' }, { status: 400 });
    }

    let logoPath: string | undefined = undefined;
    if (b.logoDataUrl && b.logoDataUrl.startsWith('data:')) {
      const m = b.logoDataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/);
      if (!m) {
        return NextResponse.json({ error: 'Malformed logo image data.' }, { status: 400 });
      }
      if (m[1].toLowerCase().includes('svg')) {
        return NextResponse.json(
          { error: 'SVG logos are blocked to prevent script injection. Please upload a PNG, JPEG, or WebP logo.' },
          { status: 400 }
        );
      }
      const buf = Buffer.from(m[2], 'base64');
      const fileObj = new File([buf], `brand-logo-${s.tenantId}`, { type: m[1] });
      const validated = await validateAndStoreUpload(fileObj, s.tenantId, { maxBytes: 2 * 1024 * 1024 });

      await q(
        `INSERT INTO stored_files (id, tenant_id, mime_type, byte_size, disk_path, original_name, uploaded_by_user)
         VALUES (?,?,?,?,?,?,?)`,
        [validated.fileId, s.tenantId, validated.mimeType, validated.byteSize, validated.diskPath, `logo.${validated.ext}`, s.user.id]
      );
      logoPath = `/api/files/${validated.fileId}`;
    } else if (b.logo !== undefined) {
      logoPath = b.logo || '';
    }

    const nextSender = b.sender?.trim().toLowerCase() || null;
    const senderUnchanged = nextSender === (current.email_sender || null);
    const nextSenderVerified = senderUnchanged ? (current.email_sender_verified ? 1 : 0) : 0;

    const scopes = Object.fromEntries(['app', 'reports', 'email', 'portal', 'signin'].map(k => [k, !!b.scopes?.[k]]));
    const ssoJson =
      b.ssoConfig !== undefined
        ? JSON.stringify({
            enabled: Boolean(b.ssoConfig.enabled),
            providerName: String(b.ssoConfig.providerName || 'Enterprise OIDC / SAML SSO').trim().slice(0, 120),
            issuerUrl: String(b.ssoConfig.issuerUrl || '').trim().slice(0, 300),
            clientId: String(b.ssoConfig.clientId || '').trim().slice(0, 190),
            authorizationUrl: String(b.ssoConfig.authorizationUrl || '').trim().slice(0, 400),
          })
        : current.sso_config_json
        ? JSON.stringify(current.sso_config_json)
        : null;

    if (logoPath !== undefined) {
      await q(
        'UPDATE tenants SET name=?, custom_domain=?, email_sender=?, email_sender_verified=?, accent=?, logo_key=?, brand_scopes=?, sso_config_json=? WHERE id=?',
        [
          b.name.trim(),
          b.domain?.trim().toLowerCase() || null,
          nextSender,
          nextSenderVerified,
          b.accent.toLowerCase(),
          logoPath || null,
          JSON.stringify(scopes),
          ssoJson,
          s.tenantId,
        ]
      );
    } else {
      await q(
        'UPDATE tenants SET name=?, custom_domain=?, email_sender=?, email_sender_verified=?, accent=?, brand_scopes=?, sso_config_json=? WHERE id=?',
        [
          b.name.trim(),
          b.domain?.trim().toLowerCase() || null,
          nextSender,
          nextSenderVerified,
          b.accent.toLowerCase(),
          JSON.stringify(scopes),
          ssoJson,
          s.tenantId,
        ]
      );
    }

    await audit(
      s.tenantId,
      s.user.id,
      'brand.updated',
      'tenant',
      s.tenantId,
      { accent: b.accent, logo: logoPath, scopes, senderChanged: !senderUnchanged, ssoEnabled: Boolean(b.ssoConfig?.enabled) },
      s.impersonation?.platformUserId
    );
    return NextResponse.json({ ok: true, logo: logoPath, emailSenderVerified: Boolean(nextSenderVerified) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

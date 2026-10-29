import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  if (process.env.DEMO_ROLE_SWITCH !== 'true') return NextResponse.json({ error: 'Disabled' }, { status: 404 });
  const body = (await req.json()) as { role?: string; tenantId?: string; userId?: string };
  const jar = await cookies();

  if (body.userId) {
    jar.set('sa_user_id', body.userId, { path: '/', sameSite: 'lax', httpOnly: true });
    return NextResponse.json({ ok: true });
  }

  // Clear explicit user override when using the tenant/role demo switcher
  jar.delete('sa_user_id');

  if (body.tenantId) {
    jar.set('demo_tenant', body.tenantId, { path: '/', sameSite: 'lax', httpOnly: true });
  }
  if (body.role) {
    if (!['owner', 'admin', 'supervisor', 'consultant'].includes(body.role)) {
      return NextResponse.json({ error: 'Bad role' }, { status: 400 });
    }
    jar.set('demo_role', body.role, { path: '/', sameSite: 'lax', httpOnly: true });
  }
  return NextResponse.json({ ok: true });
}

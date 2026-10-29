import { NextResponse } from 'next/server';
import { getSession, can } from '@/lib/session';
import { q, audit } from '@/lib/db';
import { seatUsage } from '@/lib/queries';

export async function POST(req: Request) {
  const s = await getSession();
  if (!can.spendMoney(s)) return NextResponse.json({ error: 'Only an Owner can buy or remove seats.' }, { status: 403 });
  const { delta } = (await req.json()) as { delta: number };
  if (delta !== 1 && delta !== -1) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (delta === -1 && (await seatUsage(s)).free <= 0) return NextResponse.json({ error: 'No unused seat to remove.' }, { status: 409 });
  await q('UPDATE tenants SET seats_purchased = seats_purchased + ? WHERE id=?', [delta, s.tenantId]);
  await audit(s.tenantId, s.user.id, delta > 0 ? 'seat.added' : 'seat.removed', 'tenant', s.tenantId);
  // TODO(billing): charge / credit through the payment provider once one is chosen.
  return NextResponse.json({ ok: true, message: delta > 0 ? 'Seat added. It will appear on the next invoice.' : 'Unused seat removed.' });
}

import { NextResponse } from 'next/server';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { getRec } from '@/lib/queries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireApiSession();
    const data = await getRec(s, id);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err);
  }
}

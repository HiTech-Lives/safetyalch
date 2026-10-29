'use client';
import Link from 'next/link';

export default function ExportButtons({ id, baseline }: { id: string; baseline: boolean }) {
  return (
    <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Link href={`/inspections/${id}/report?type=full`} target="_blank" className="btn btn-primary">
        Full report PDF ↗
      </Link>
      <Link href={`/inspections/${id}/report?type=${baseline ? 'development' : 'recommendations'}`} target="_blank" className="btn">
        {baseline ? 'Development plan PDF ↗' : 'Recommendation report PDF ↗'}
      </Link>
    </div>
  );
}

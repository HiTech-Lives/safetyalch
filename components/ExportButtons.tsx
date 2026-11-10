'use client';
import Link from 'next/link';

export default function ExportButtons({ id, baseline }: { id: string; baseline: boolean }) {
  return (
    <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Link href={`/inspections/${id}/report?mode=full`} target="_blank" className="btn btn-primary">
        {baseline ? 'Maturity & Development Report ↗' : 'Full Report / Scorecard PDF ↗'}
      </Link>
      {!baseline && (
        <>
          <Link href={`/inspections/${id}/report?mode=letter`} target="_blank" className="btn">
            ARU Visit Cover Letter PDF ↗
          </Link>
          <Link href={`/inspections/${id}/report?mode=response`} target="_blank" className="btn">
            30-Day Board Response Form ↗
          </Link>
          <Link href={`/inspections/${id}/report?mode=photos`} target="_blank" className="btn">
            Location Photo Page ↗
          </Link>
        </>
      )}
    </div>
  );
}

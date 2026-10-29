'use client';
import Link from 'next/link';

export default function PrintReportBar({
  id,
  type,
  baseline,
}: {
  id: string;
  type: string;
  baseline: boolean;
}) {
  return (
    <div
      className="no-print"
      style={{
        background: 'var(--ink)',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href={`/inspections/${id}`} style={{ color: '#fff', fontSize: 12.5 }}>
          ← Inspection {id}
        </Link>
        <span style={{ color: 'rgba(255,255,255,.35)' }}>|</span>
        <Link
          href={`/inspections/${id}/report?type=full`}
          style={{ color: type === 'full' ? 'var(--sand)' : 'rgba(255,255,255,.75)', fontSize: 12.5, fontWeight: type === 'full' ? 600 : 400 }}
        >
          Full Inspection Report
        </Link>
        <Link
          href={`/inspections/${id}/report?type=${baseline ? 'development' : 'recommendations'}`}
          style={{
            color: type !== 'full' ? 'var(--sand)' : 'rgba(255,255,255,.75)',
            fontSize: 12.5,
            fontWeight: type !== 'full' ? 600 : 400,
          }}
        >
          {baseline ? '12-Month Development Plan' : 'Standalone Recommendation Report'}
        </Link>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-sm"
        style={{ background: 'var(--sand)', borderColor: 'var(--sand)', color: 'var(--ink)', fontWeight: 700 }}
      >
        Print / Save as PDF
      </button>
    </div>
  );
}


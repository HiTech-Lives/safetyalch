export const PRIORITY_DAYS = { High: 7, Med: 30, Low: 60 } as const;
export type Priority = keyof typeof PRIORITY_DAYS;
export type RecStatus = 'open' | 'pending' | 'corrected' | 'assumed';
export type RecState = RecStatus | 'overdue';

export const STATE_LABEL: Record<RecState, string> = {
  open: 'Open', overdue: 'Overdue', pending: 'Pending review', corrected: 'Corrected', assumed: 'Risk assumed',
};

export const MATURITY = ['absent', 'written', 'practiced', 'owned'] as const;

export function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function recState(status: RecStatus, dueOn: string): RecState {
  return status === 'open' && dueOn.slice(0, 10) < todayISO() ? 'overdue' : status;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

export const fmtDate = (s: string) => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
export const fmtShort = (s: string) => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
export const fmtDay = (s: string) => { const d = parse(s); return WD[d.getDay()] + ' ' + d.getDate(); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);

export const shortName = (n: string | null) => {
  if (!n) return 'Unassigned';
  const p = n.split(' ');
  return p[0][0] + '. ' + p.slice(1).join(' ');
};
export const initials = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

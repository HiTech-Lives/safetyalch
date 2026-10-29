export function Frame({ children, className = '', as: Tag = 'div', ...rest }: { children: React.ReactNode; className?: string; as?: any; [k: string]: any }) {
  return (
    <Tag className={'frame ' + className} {...rest}>
      <span className="mk tl">+</span><span className="mk tr">+</span><span className="mk bl">+</span><span className="mk br">+</span>
      {children}
    </Tag>
  );
}

export function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={'pill pill-' + kind}>{children}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function SearchForm({ defaultValue, keep }: { defaultValue?: string; keep?: Record<string, string | number> }) {
  return (
    <form className="search" action="">
      {keep && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--n6)" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input name="q" defaultValue={defaultValue} placeholder="Search this list" />
    </form>
  );
}

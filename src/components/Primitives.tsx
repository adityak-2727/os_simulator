import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  primary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`button ${primary ? 'primary' : ''} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}
export function Panel({
  title,
  aside,
  children,
  className = '',
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
export function Status({ label }: { label: string }) {
  const tone = ['Completed', 'Safe', 'Granted', 'No cycle'].includes(label)
    ? 'success'
    : [
          'Invalid',
          'Invalid request',
          'Unsafe',
          'Deadlocked',
          'Engine error',
        ].includes(label)
      ? 'error'
      : label === 'Running'
        ? 'active'
        : label.startsWith('Wait for')
          ? 'waiting'
          : '';
  return <span className={`status ${tone}`}>{label}</span>;
}
export function ScrollTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    cpu: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4" />
        <rect x="9" y="9" width="6" height="6" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    memory: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10M7 13h10M7 17h6" />
      </>
    ),
    deadlock: (
      <>
        <circle cx="5" cy="6" r="3" />
        <circle cx="19" cy="6" r="3" />
        <circle cx="12" cy="19" r="3" />
        <path d="M8 6h8M6 9l4 7m8-7-4 7" />
      </>
    ),
    synchronization: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="10" cy="18" r="2" />
      </>
    ),
    disk: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0" />
      </>
    ),
    system: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4M6 8h4m4 0h4M6 12h12" />
      </>
    ),
    experiments: (
      <>
        <path d="M9 3h6m-5 0v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M8 14h8" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 3v1" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    previous: (
      <>
        <path d="m16 5-10 7 10 7Z" />
        <path d="M4 5v14" />
      </>
    ),
    next: (
      <>
        <path d="m8 5 10 7-10 7Z" />
        <path d="M20 5v14" />
      </>
    ),
    reset: (
      <>
        <path d="M4 8a9 9 0 1 1 0 8M4 3v6h6" />
      </>
    ),
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.memory}
    </svg>
  );
}

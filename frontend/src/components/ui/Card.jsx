import clsx from 'clsx';

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx('rounded-xl bg-white shadow-sm ring-1 ring-slate-200', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

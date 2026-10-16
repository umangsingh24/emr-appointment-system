import clsx from 'clsx';
import { AlertTriangle, Inbox } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors.js';
import { Button } from './Button.jsx';

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="size-10 text-slate-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load data' }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <AlertTriangle className="size-10 text-rose-400" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200/70', className ?? 'h-4 w-full')} />;
}

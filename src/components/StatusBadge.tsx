import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'draft' | 'open' | 'closed' | 'pending_approval';

interface StatusBadgeProps {
  status: Status;
  daysOpen?: number;
  /** If true, the report was returned by manager for clarification (still status=open) */
  returnedForClarification?: boolean;
}

const statusConfig = {
  draft: {
    label: 'טיוטה',
    className: 'bg-gray-500 text-white',
    icon: '🔘',
  },
  open: {
    label: 'פתוח',
    className: 'bg-orange-500 text-white',
    icon: '🟠',
  },
  pending_approval: {
    label: 'ממתין לאישור',
    className: 'bg-yellow-500 text-white',
    icon: '⏳',
  },
  closed: {
    label: 'סגור',
    className: 'bg-green-600 text-white',
    icon: '🟢',
  },
  returned: {
    label: 'הוחזר לבירור',
    className: 'bg-red-500 text-white',
    icon: '🔁',
  },
};

export function StatusBadge({ status, daysOpen, returnedForClarification }: StatusBadgeProps) {
  // If open and returned for clarification, show special status
  const effectiveStatus = status === 'open' && returnedForClarification ? 'returned' : status;
  const config = statusConfig[effectiveStatus];
  
  return (
    <div className="flex flex-col gap-1">
      <Badge className={cn('font-semibold', config.className)}>
        {config.icon} {config.label}
      </Badge>
      {status === 'open' && !returnedForClarification && daysOpen !== undefined && (
        <span className="text-xs text-muted-foreground">
          פתוח {daysOpen} ימים
        </span>
      )}
    </div>
  );
}

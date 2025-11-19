import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'draft' | 'open' | 'pending' | 'approved' | 'rejected' | 'closed';

interface StatusBadgeProps {
  status: Status;
  daysOpen?: number;
}

const statusConfig = {
  draft: {
    label: 'טיוטה',
    className: 'bg-status-draft text-white',
    icon: '🔘',
  },
  open: {
    label: 'פתוח',
    className: 'bg-status-open text-white status-open',
    icon: '🟠',
  },
  pending: {
    label: 'ממתין לאישור',
    className: 'bg-status-pending text-white',
    icon: '🔵',
  },
  approved: {
    label: 'אושר',
    className: 'bg-status-approved text-white',
    icon: '🟢',
  },
  rejected: {
    label: 'נדחה',
    className: 'bg-status-rejected text-white',
    icon: '🔴',
  },
  closed: {
    label: 'סגור',
    className: 'bg-status-closed text-white',
    icon: '⚫',
  },
};

export function StatusBadge({ status, daysOpen }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <div className="flex flex-col gap-1">
      <Badge className={cn('font-semibold', config.className)}>
        {config.icon} {config.label}
      </Badge>
      {status === 'open' && daysOpen !== undefined && (
        <span className="text-xs text-muted-foreground">
          פתוח {daysOpen} ימים
        </span>
      )}
      {status === 'rejected' && (
        <span className="text-xs text-destructive font-medium">
          דרושה פעולה
        </span>
      )}
    </div>
  );
}

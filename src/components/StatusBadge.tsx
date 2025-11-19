import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'draft' | 'open' | 'closed';

interface StatusBadgeProps {
  status: Status;
  daysOpen?: number;
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
  closed: {
    label: 'סגור',
    className: 'bg-green-600 text-white',
    icon: '🟢',
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
    </div>
  );
}

import { useMemo } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  amount_in_ils: number;
}

interface DuplicateGroup {
  expenses: Expense[];
  reason: string;
}

interface DuplicateExpenseDetectorProps {
  expenses: Expense[];
}

const categoryLabels: Record<string, string> = {
  flights: 'טיסות',
  accommodation: 'לינה',
  food: 'מזון',
  transportation: 'תחבורה',
  miscellaneous: 'שונות',
};

export const DuplicateExpenseDetector = ({ expenses }: DuplicateExpenseDetectorProps) => {
  const duplicates = useMemo(() => {
    const duplicateGroups: DuplicateGroup[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < expenses.length; i++) {
      const exp1 = expenses[i];
      if (checked.has(exp1.id)) continue;

      const group: Expense[] = [exp1];
      const reasons: string[] = [];

      for (let j = i + 1; j < expenses.length; j++) {
        const exp2 = expenses[j];
        if (checked.has(exp2.id)) continue;

        let isDuplicate = false;
        const matchReasons: string[] = [];

        // Check exact match: same date, amount, and currency
        if (
          exp1.expense_date === exp2.expense_date &&
          exp1.amount === exp2.amount &&
          exp1.currency === exp2.currency
        ) {
          isDuplicate = true;
          matchReasons.push('תאריך, סכום ומטבע זהים');
        }

        // Check same date and category with similar amount (within 5%)
        if (
          !isDuplicate &&
          exp1.expense_date === exp2.expense_date &&
          exp1.category === exp2.category &&
          Math.abs(exp1.amount - exp2.amount) / Math.max(exp1.amount, exp2.amount) < 0.05
        ) {
          isDuplicate = true;
          matchReasons.push('תאריך וקטגוריה זהים עם סכום דומה');
        }

        // Check similar description (Levenshtein distance or simple comparison)
        if (
          !isDuplicate &&
          exp1.description &&
          exp2.description &&
          exp1.description.toLowerCase().trim() === exp2.description.toLowerCase().trim() &&
          exp1.amount === exp2.amount
        ) {
          isDuplicate = true;
          matchReasons.push('תיאור וסכום זהים');
        }

        // Check same ILS amount on same date (different currencies)
        if (
          !isDuplicate &&
          exp1.expense_date === exp2.expense_date &&
          Math.abs(exp1.amount_in_ils - exp2.amount_in_ils) < 1 &&
          exp1.currency !== exp2.currency
        ) {
          isDuplicate = true;
          matchReasons.push('סכום בש"ח זהה באותו תאריך (מטבעות שונים)');
        }

        if (isDuplicate) {
          group.push(exp2);
          checked.add(exp2.id);
          reasons.push(...matchReasons);
        }
      }

      if (group.length > 1) {
        checked.add(exp1.id);
        duplicateGroups.push({
          expenses: group,
          reason: [...new Set(reasons)].join(', '),
        });
      }
    }

    return duplicateGroups;
  }, [expenses]);

  if (duplicates.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <Copy className="h-4 w-4" />
        זוהו {duplicates.length} קבוצות של הוצאות כפולות אפשריות
      </AlertTitle>
      <AlertDescription className="mt-3">
        <div className="space-y-3">
          {duplicates.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800"
            >
              <div className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                קבוצה {groupIndex + 1}: {group.reason}
              </div>
              <div className="space-y-2">
                {group.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-wrap items-center gap-2 text-sm text-amber-900 dark:text-amber-100"
                  >
                    <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 border-amber-300">
                      {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-200/50 dark:bg-amber-800/50">
                      {categoryLabels[expense.category] || expense.category}
                    </Badge>
                    <span className="font-medium">
                      {expense.amount.toLocaleString()} {expense.currency}
                    </span>
                    {expense.description && (
                      <span className="text-amber-600 dark:text-amber-400 truncate max-w-[200px]">
                        ({expense.description})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          מומלץ לבדוק אם מדובר בהוצאות כפולות ולמחוק את המיותרות.
        </p>
      </AlertDescription>
    </Alert>
  );
};

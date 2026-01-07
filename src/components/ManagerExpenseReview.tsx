import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Save, Loader2 } from 'lucide-react';
import { ManagerAttachmentUpload } from '@/components/ManagerAttachmentUpload';
import { useToast } from '@/hooks/use-toast';

interface ManagerExpenseReviewProps {
  expenseId: string;
  currentStatus?: 'pending' | 'approved' | 'rejected';
  currentComment?: string;
  onReview: (expenseId: string, status: 'approved' | 'rejected', comment: string, attachments: File[]) => Promise<void>;
  disabled?: boolean;
}

export const ManagerExpenseReview = ({
  expenseId,
  currentStatus,
  currentComment,
  onReview,
  disabled = false,
}: ManagerExpenseReviewProps) => {
  const { toast } = useToast();

  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected' | null>(
    currentStatus === 'approved' || currentStatus === 'rejected' ? currentStatus : null
  );
  const [comment, setComment] = useState(currentComment || '');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Keep local UI in sync with DB-driven props (e.g., after reload)
  useEffect(() => {
    setReviewStatus(
      currentStatus === 'approved' || currentStatus === 'rejected' ? currentStatus : null
    );
    setComment(currentComment || '');
    setAttachments([]);
    setIsSaved(false);
  }, [expenseId, currentStatus, currentComment]);

  const handleStatusChange = (status: 'approved' | 'rejected') => {
    setReviewStatus(status);
    setIsSaved(false);
  };

  const handleSaveReview = async () => {
    if (!reviewStatus) return;

    if (reviewStatus === 'rejected' && !comment.trim()) {
      toast({
        title: 'חסרה הערה',
        description: 'כדי לדחות/לבקש בירור חובה לכתוב הערה.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await onReview(expenseId, reviewStatus, comment, attachments);
      setIsSaved(true);
    } catch (error: any) {
      console.error('Error saving review:', error);
      toast({
        title: 'שגיאה בשמירה',
        description: error?.message || 'לא ניתן לשמור את ההערה. נסה שוב.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttachmentsChange = (files: File[]) => {
    setAttachments(files);
    setIsSaved(false);
  };

  const canSave = reviewStatus && (reviewStatus === 'approved' || comment.trim());

  // If already saved to DB (currentStatus is set from DB), show saved state
  const isAlreadySavedToDb = currentStatus === 'approved' || currentStatus === 'rejected';

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      isAlreadySavedToDb || isSaved
        ? currentStatus === 'approved' || reviewStatus === 'approved'
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-300 dark:border-green-700'
          : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-red-300 dark:border-red-700'
        : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800'
    }`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-sm font-bold text-blue-800 dark:text-blue-300">סקירת מנהל:</span>
        
        {/* Show saved status indicator */}
        {(isAlreadySavedToDb || isSaved) && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            currentStatus === 'approved' || reviewStatus === 'approved'
              ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100'
              : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100'
          }`}>
            <CheckCircle className="w-3.5 h-3.5" />
            {currentStatus === 'approved' || reviewStatus === 'approved' ? 'אושר ונשמר' : 'נדחה ונשמר'}
          </div>
        )}
      </div>
      
      {/* Status buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          size="sm"
          variant={reviewStatus === 'approved' ? 'default' : 'outline'}
          className={reviewStatus === 'approved' 
            ? 'bg-green-600 hover:bg-green-700 text-white' 
            : 'hover:bg-green-50 hover:border-green-300 border-green-200'}
          onClick={() => handleStatusChange('approved')}
          disabled={disabled || isSaving}
        >
          <CheckCircle className="w-4 h-4 ml-1" />
          אשר
        </Button>
        <Button
          size="sm"
          variant={reviewStatus === 'rejected' ? 'default' : 'outline'}
          className={reviewStatus === 'rejected' 
            ? 'bg-red-600 hover:bg-red-700 text-white' 
            : 'hover:bg-red-50 hover:border-red-300 border-red-200'}
          onClick={() => handleStatusChange('rejected')}
          disabled={disabled || isSaving}
        >
          <XCircle className="w-4 h-4 ml-1" />
          דחה / בקש בירור
        </Button>
      </div>

      {/* Comment section - always visible when status is selected */}
      {reviewStatus && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`manager-comment-${expenseId}`} className="text-sm mb-1 block font-medium">
              {reviewStatus === 'rejected' ? 'הערה / בקשת בירור (חובה):' : 'הערה (אופציונלי):'}
            </Label>
            <Textarea
              id={`manager-comment-${expenseId}`}
              placeholder={reviewStatus === 'rejected' 
                ? 'פרט מדוע ההוצאה נדחתה או מה נדרש לבירור...' 
                : 'הוסף הערה...'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="text-sm bg-white dark:bg-slate-800"
              disabled={disabled || isSaving}
            />
          </div>
          
          {reviewStatus === 'rejected' && (
            <ManagerAttachmentUpload
              expenseId={expenseId}
              onFilesChange={handleAttachmentsChange}
              disabled={disabled || isSaving}
            />
          )}
          
          {/* Save button */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={handleSaveReview}
              disabled={disabled || isSaving || !canSave}
              className={isSaved || isAlreadySavedToDb
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-blue-600 hover:bg-blue-700'}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : isSaved || isAlreadySavedToDb ? (
                <CheckCircle className="w-4 h-4 ml-1" />
              ) : (
                <Save className="w-4 h-4 ml-1" />
              )}
              {isSaved || isAlreadySavedToDb ? 'נשמר ✓' : 'שמור הערה'}
            </Button>
            
            {reviewStatus === 'rejected' && !comment.trim() && (
              <span className="text-xs text-red-600 font-medium">
                יש להוסיף הערה לדחייה
              </span>
            )}
          </div>
          
          {/* Saved confirmation message */}
          {(isSaved || isAlreadySavedToDb) && (
            () => {
              const savedText = (currentComment ?? comment).trim();
              if (!savedText) return null;
              return (
                <div
                  className={`mt-2 p-2 rounded-lg text-xs ${
                    reviewStatus === 'approved' || currentStatus === 'approved'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                  }`}
                >
                  <span className="font-semibold">נשמר: </span>
                  {savedText}
                </div>
              );
            }
          )()}
        </div>
      )}
    </div>
  );
};

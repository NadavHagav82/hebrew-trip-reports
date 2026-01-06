import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Save, Loader2 } from 'lucide-react';
import { ManagerAttachmentUpload } from '@/components/ManagerAttachmentUpload';

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
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected' | null>(
    currentStatus === 'approved' || currentStatus === 'rejected' ? currentStatus : null
  );
  const [comment, setComment] = useState(currentComment || '');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Reset saved state when status changes
  useEffect(() => {
    setIsSaved(false);
  }, [reviewStatus, comment]);

  const handleStatusChange = (status: 'approved' | 'rejected') => {
    setReviewStatus(status);
    setIsSaved(false);
  };

  const handleSaveReview = async () => {
    if (!reviewStatus) return;
    
    // Validate rejected expenses must have comment
    if (reviewStatus === 'rejected' && !comment.trim()) {
      return;
    }
    
    setIsSaving(true);
    try {
      await onReview(expenseId, reviewStatus, comment, attachments);
      setIsSaved(true);
    } catch (error) {
      console.error('Error saving review:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttachmentsChange = (files: File[]) => {
    setAttachments(files);
    setIsSaved(false);
  };

  const canSave = reviewStatus && (reviewStatus === 'approved' || comment.trim());

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-blue-800 dark:text-blue-300">סקירת מנהל:</span>
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
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSaveReview}
              disabled={disabled || isSaving || !canSave}
              className={isSaved 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-blue-600 hover:bg-blue-700'}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : isSaved ? (
                <CheckCircle className="w-4 h-4 ml-1" />
              ) : (
                <Save className="w-4 h-4 ml-1" />
              )}
              {isSaved ? 'נשמר!' : 'שמור הערה'}
            </Button>
            
            {reviewStatus === 'rejected' && !comment.trim() && (
              <span className="text-xs text-red-600 font-medium">
                יש להוסיף הערה לדחייה
              </span>
            )}
            
            {isSaved && (
              <span className="text-xs text-green-600 font-medium">
                ✓ ההערה נשמרה על ההוצאה
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

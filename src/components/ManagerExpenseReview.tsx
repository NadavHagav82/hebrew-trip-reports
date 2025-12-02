import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { ManagerAttachmentUpload } from '@/components/ManagerAttachmentUpload';

interface ManagerExpenseReviewProps {
  expenseId: string;
  currentStatus?: 'pending' | 'approved' | 'rejected';
  currentComment?: string;
  onReview: (expenseId: string, status: 'approved' | 'rejected', comment: string, attachments: File[]) => void;
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
  const [showCommentBox, setShowCommentBox] = useState(false);

  const handleStatusChange = (status: 'approved' | 'rejected') => {
    setReviewStatus(status);
    setShowCommentBox(true);
    onReview(expenseId, status, comment, attachments);
  };

  const handleCommentChange = (value: string) => {
    setComment(value);
    if (reviewStatus) {
      onReview(expenseId, reviewStatus, value, attachments);
    }
  };

  const handleAttachmentsChange = (files: File[]) => {
    setAttachments(files);
    if (reviewStatus) {
      onReview(expenseId, reviewStatus, comment, files);
    }
  };

  return (
    <div className="mt-4 border-t border-dashed border-gray-300 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-600">סקירת מנהל:</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={reviewStatus === 'approved' ? 'default' : 'outline'}
            className={reviewStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 hover:border-green-300'}
            onClick={() => handleStatusChange('approved')}
            disabled={disabled}
          >
            <CheckCircle className="w-4 h-4 ml-1" />
            אשר
          </Button>
          <Button
            size="sm"
            variant={reviewStatus === 'rejected' ? 'default' : 'outline'}
            className={reviewStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'hover:bg-red-50 hover:border-red-300'}
            onClick={() => handleStatusChange('rejected')}
            disabled={disabled}
          >
            <XCircle className="w-4 h-4 ml-1" />
            דחה / בקש בירור
          </Button>
          {!showCommentBox && reviewStatus === null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCommentBox(true)}
              disabled={disabled}
            >
              <MessageSquare className="w-4 h-4 ml-1" />
              הערה
            </Button>
          )}
        </div>
      </div>

      {showCommentBox && (
        <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
          <div>
            <Label htmlFor={`manager-comment-${expenseId}`} className="text-sm mb-1 block">
              {reviewStatus === 'rejected' ? 'הערה / בקשת בירור (חובה):' : 'הערה (אופציונלי):'}
            </Label>
            <Textarea
              id={`manager-comment-${expenseId}`}
              placeholder={reviewStatus === 'rejected' 
                ? 'פרט מדוע ההוצאה נדחתה או מה נדרש לבירור...' 
                : 'הוסף הערה...'}
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              rows={2}
              className="text-sm"
              disabled={disabled}
            />
          </div>
          
          {reviewStatus === 'rejected' && (
            <ManagerAttachmentUpload
              expenseId={expenseId}
              onFilesChange={handleAttachmentsChange}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
};

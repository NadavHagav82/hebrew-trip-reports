import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManagerAttachmentUploadProps {
  expenseId: string;
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export const ManagerAttachmentUpload = ({ 
  expenseId, 
  onFilesChange,
  disabled = false 
}: ManagerAttachmentUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    if (selectedFiles.length === 0) return;

    // Validate file types and sizes
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const invalidFiles = selectedFiles.filter(
      file => !validTypes.includes(file.type) || file.size > maxSize
    );

    if (invalidFiles.length > 0) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור קבצי תמונה, PDF או מסמכי Word בגודל עד 10MB',
        variant: 'destructive',
      });
      return;
    }

    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-2">
      <div>
        <input
          type="file"
          id={`file-upload-${expenseId}`}
          multiple
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        <label htmlFor={`file-upload-${expenseId}`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            className="w-full cursor-pointer"
            asChild
          >
            <span>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מעלה קבצים...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 ml-2" />
                  צרף קבצים (תמונות, PDF, Word)
                </>
              )}
            </span>
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-muted/50 rounded-md p-2 text-sm"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ({formatFileSize(file.size)})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFile(index)}
                disabled={disabled || uploading}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

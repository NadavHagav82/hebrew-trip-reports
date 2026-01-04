import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Paperclip, Link2, Trash2, FileText, Image, ExternalLink, Upload, X, Loader2, Save, Plus, CheckCircle2, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  file_name: string;
  /** Stored value from DB: either storage path (preferred) or legacy URL */
  file_url: string;
  file_type: string;
  file_size: number;
  category: string;
  link_url: string | null;
  notes: string | null;
  uploaded_at: string;
  /** Local-only: extracted storage path for private bucket items */
  storage_path?: string;
}

interface TravelRequestAttachmentsProps {
  travelRequestId: string | null;
  readOnly?: boolean;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onRequestSaveDraft?: () => Promise<string | null>;
}

type PendingFileItem = {
  file: File;
  category: string;
};

const CATEGORIES = [
  { value: 'flights', label: 'טיסות' },
  { value: 'accommodation', label: 'לינה' },
  { value: 'transport', label: 'תחבורה' },
  { value: 'other', label: 'אחר' },
];

export default function TravelRequestAttachments({ 
  travelRequestId, 
  readOnly = false,
  onAttachmentsChange,
  onRequestSaveDraft
}: TravelRequestAttachmentsProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFileItem[]>([]);
  const [pendingLinks, setPendingLinks] = useState<{ url: string; category: string; notes: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; progress: number; total: number; current: number } | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState('flights');
  const [newLinkNotes, setNewLinkNotes] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('flights');
  const [isDragging, setIsDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string; index: number } | null>(null);
  
  // Refs to keep current values accessible in callbacks
  const pendingFilesRef = useRef(pendingFiles);
  const pendingLinksRef = useRef(pendingLinks);
  
  // Keep refs in sync with state
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
    pendingLinksRef.current = pendingLinks;
  }, [pendingFiles, pendingLinks]);

  // Get all image attachments for navigation
  const imageAttachments = attachments.filter(a => a.file_type.startsWith('image/'));

  const extractStoragePath = (value: string) => {
    // New format: value is already a path like "userId/requestId/file.ext"
    if (!value.startsWith('http')) return value;

    // Legacy public URL format includes "/travel-attachments/"
    const parts = value.split('/travel-attachments/');
    return parts.length > 1 ? parts[1] : null;
  };

  const createSignedUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('travel-attachments')
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24h

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const openLightbox = (url: string, name: string, index: number) => {
    setLightboxImage({ url, name, index });
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxImage || imageAttachments.length <= 1) return;
    const currentIndex = lightboxImage.index;
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % imageAttachments.length;
    } else {
      newIndex = (currentIndex - 1 + imageAttachments.length) % imageAttachments.length;
    }
    const newAttachment = imageAttachments[newIndex];
    setLightboxImage({ url: newAttachment.file_url, name: newAttachment.file_name, index: newIndex });
  };

  // Compress image using Canvas API
  const compressImage = async (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      // Only compress images
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compression didn't help, use original
              resolve(file);
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log(`Compressed ${file.name}: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(`הקובץ ${file.name} גדול מדי (מקסימום 10MB)`);
        return false;
      }
      const validTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats', 'application/vnd.ms-excel'];
      if (!validTypes.some(type => file.type.startsWith(type))) {
        toast.error(`סוג הקובץ ${file.name} אינו נתמך`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Check if there are images to compress
    const hasImages = validFiles.some(f => f.type.startsWith('image/'));
    let processedFiles: File[] = validFiles;

    if (hasImages) {
      setCompressing(true);
      toast.info('דוחס תמונות...');

      try {
        processedFiles = await Promise.all(validFiles.map(file => compressImage(file)));

        // Calculate savings
        const originalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
        const compressedSize = processedFiles.reduce((sum, f) => sum + f.size, 0);
        const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);

        if (savedPercent > 5) {
          toast.success(`${validFiles.length} קבצים נוספו (נחסכו ${savedPercent}%)`);
        } else {
          toast.success(`${validFiles.length} קבצים נוספו`);
        }
      } finally {
        setCompressing(false);
      }
    } else {
      toast.success(`${validFiles.length} קבצים נוספו`);
    }

    const items: PendingFileItem[] = processedFiles.map((file) => ({ file, category: selectedCategory }));

    // Auto-upload if travelRequestId exists
    if (travelRequestId && user) {
      setUploading(true);
      try {
        for (const item of items) {
          setUploadProgress({ fileName: item.file.name, progress: 0, total: items.length, current: items.indexOf(item) + 1 });
          const attachmentData = await uploadSingleFile(item, travelRequestId);
          if (attachmentData) {
            setAttachments((prev) => [attachmentData, ...prev]);
            toast.success(`הצרופה ${item.file.name} נשמרה`);
          }
        }
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    } else {
      // No travelRequestId – keep them pending
      setPendingFiles((prev) => [...prev, ...items]);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  useEffect(() => {
    if (travelRequestId) {
      loadAttachments();
    }
  }, [travelRequestId]);

  useEffect(() => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments);
    }
  }, [attachments]);

  const loadAttachments = async () => {
    if (!travelRequestId) return;

    const { data, error } = await supabase
      .from('travel_request_attachments')
      .select('*')
      .eq('travel_request_id', travelRequestId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error loading attachments:', error);
      return;
    }

    const resolved = await Promise.all(
      (data || []).map(async (row) => {
        // Links are already public
        if (row.file_type === 'link') return row as Attachment;

        const storagePath = extractStoragePath(row.file_url);
        if (!storagePath) return row as Attachment;

        const signedUrl = await createSignedUrl(storagePath);
        if (!signedUrl) return { ...(row as Attachment), storage_path: storagePath };

        return {
          ...(row as Attachment),
          storage_path: storagePath,
          file_url: signedUrl,
        };
      })
    );

    setAttachments(resolved);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) {
      toast.error('יש להזין כתובת קישור');
      return;
    }

    try {
      new URL(newLinkUrl);
    } catch {
      toast.error('כתובת הקישור אינה תקינה');
      return;
    }

    setPendingLinks(prev => [...prev, {
      url: newLinkUrl.trim(),
      category: newLinkCategory,
      notes: newLinkNotes.trim()
    }]);

    setNewLinkUrl('');
    setNewLinkNotes('');
    toast.success('קישור נוסף');
  };

  const removePendingLink = (index: number) => {
    setPendingLinks(prev => prev.filter((_, i) => i !== index));
  };

  // Uploads single file immediately (uses current or provided requestId)
  const uploadSingleFile = async (item: PendingFileItem, requestId: string) => {
    if (!user) return null;

    const file = item.file;
    const fileExt = file.name.split('.').pop();
    const storagePath = `${user.id}/${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Get current session token for authenticated upload
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      toast.error('יש להתחבר מחדש כדי להעלות קבצים');
      return null;
    }

    const uploadResult = await new Promise<{ error: Error | null }>((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress({ fileName: file.name, progress: percentComplete, total: 1, current: 1 });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve({ error: null });
        else resolve({ error: new Error(`Upload failed with status ${xhr.status}`) });
      });

      xhr.addEventListener('error', () => resolve({ error: new Error('Upload failed') }));

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      xhr.open('POST', `${supabaseUrl}/storage/v1/object/travel-attachments/${storagePath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.send(file);
    });

    if (uploadResult.error) {
      console.error('Upload error:', uploadResult.error);
      toast.error(`שגיאה בהעלאת ${file.name}`);
      return null;
    }

    const { data: attachmentData, error: insertError } = await supabase
      .from('travel_request_attachments')
      .insert({
        travel_request_id: requestId,
        uploaded_by: user.id,
        file_name: file.name,
        // Store storage path in DB (bucket is private)
        file_url: storagePath,
        file_type: file.type,
        file_size: file.size,
        category: item.category,
      })
      .select()
      .single();

    if (insertError || !attachmentData) {
      console.error('Insert error:', insertError);
      toast.error('שגיאה בשמירת הצרופה');
      return null;
    }

    const signedUrl = await createSignedUrl(storagePath);

    return {
      ...(attachmentData as Attachment),
      storage_path: storagePath,
      file_url: signedUrl || attachmentData.file_url,
    };
  };

  const savePendingFile = async (index: number) => {
    if (!user) return;
    if (!travelRequestId) {
      toast.info('כדי לשמור צרופות יש לשמור את הבקשה כטיוטה קודם');
      return;
    }

    const item = pendingFiles[index];
    if (!item) return;

    setUploading(true);
    setUploadProgress({ fileName: item.file.name, progress: 0, total: 1, current: 1 });

    try {
      const attachmentData = await uploadSingleFile(item, travelRequestId);

      if (attachmentData) {
        setAttachments((prev) => [attachmentData, ...prev]);
        setPendingFiles((prev) => prev.filter((_, i) => i !== index));
        toast.success('הצרופה נשמרה');
      }
    } catch (error) {
      console.error('savePendingFile error:', error);
      toast.error('שגיאה בשמירת הצרופה');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const savePendingLink = async (index: number) => {
    if (!user) return;
    if (!travelRequestId) {
      toast.info('כדי לשמור צרופות יש לשמור את הבקשה כטיוטה קודם');
      return;
    }

    const link = pendingLinks[index];
    if (!link) return;

    setUploading(true);
    setUploadProgress({ fileName: new URL(link.url).hostname, progress: 100, total: 1, current: 1 });

    try {
      const { data: linkData, error: linkError } = await supabase
        .from('travel_request_attachments')
        .insert({
          travel_request_id: travelRequestId,
          uploaded_by: user.id,
          file_name: new URL(link.url).hostname,
          file_url: link.url,
          file_type: 'link',
          file_size: 0,
          category: link.category,
          link_url: link.url,
          notes: link.notes || null,
        })
        .select()
        .single();

      if (linkError || !linkData) {
        console.error('Link insert error:', linkError);
        toast.error('שגיאה בשמירת הקישור');
        return;
      }

      setAttachments((prev) => [linkData, ...prev]);
      setPendingLinks((prev) => prev.filter((_, i) => i !== index));
      toast.success('הקישור נשמר');
    } catch (error) {
      console.error('savePendingLink error:', error);
      toast.error('שגיאה בשמירת הקישור');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadAllAttachments = useCallback(async (requestId: string) => {
    if (!user) return;

    // Use refs to get current values
    const currentPendingFiles = pendingFilesRef.current;
    const currentPendingLinks = pendingLinksRef.current;

    if (currentPendingFiles.length === 0 && currentPendingLinks.length === 0) {
      console.log('No pending files or links to upload');
      return;
    }

    setUploading(true);
    const uploadedAttachments: Attachment[] = [];
    const totalFiles = currentPendingFiles.length + currentPendingLinks.length;
    let completedFiles = 0;

    try {
      // Get current session token for authenticated upload
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        toast.error('יש להתחבר מחדש כדי להעלות קבצים');
        setUploading(false);
        return;
      }

      // Upload files with progress tracking
      for (let i = 0; i < currentPendingFiles.length; i++) {
        const item = currentPendingFiles[i];
        const file = item.file;

        setUploadProgress({
          fileName: file.name,
          progress: 0,
          total: totalFiles,
          current: i + 1
        });

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Use XMLHttpRequest for progress tracking
        const uploadResult = await new Promise<{ error: Error | null }>((resolve) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadProgress({
                fileName: file.name,
                progress: percentComplete,
                total: totalFiles,
                current: i + 1
              });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ error: null });
            } else {
              resolve({ error: new Error(`Upload failed with status ${xhr.status}`) });
            }
          });

          xhr.addEventListener('error', () => {
            resolve({ error: new Error('Upload failed') });
          });

          // Get the Supabase storage URL
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

          xhr.open('POST', `${supabaseUrl}/storage/v1/object/travel-attachments/${fileName}`);
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
          xhr.setRequestHeader('x-upsert', 'true');
          xhr.send(file);
        });

        if (uploadResult.error) {
          console.error('Upload error:', uploadResult.error);
          toast.error(`שגיאה בהעלאת ${file.name}`);
          continue;
        }

        const { data: attachmentData, error: insertError } = await supabase
          .from('travel_request_attachments')
          .insert({
            travel_request_id: requestId,
            uploaded_by: user.id,
            file_name: file.name,
            // Store storage path in DB (bucket is private)
            file_url: fileName,
            file_type: file.type,
            file_size: file.size,
            category: item.category,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
        } else if (attachmentData) {
          const signedUrl = await createSignedUrl(fileName);
          uploadedAttachments.push({
            ...(attachmentData as Attachment),
            storage_path: fileName,
            file_url: signedUrl || attachmentData.file_url,
          });
        }

        completedFiles++;
      }

      // Save links
      for (const link of currentPendingLinks) {
        setUploadProgress({
          fileName: new URL(link.url).hostname,
          progress: 100,
          total: totalFiles,
          current: completedFiles + 1
        });

        const { data: linkData, error: linkError } = await supabase
          .from('travel_request_attachments')
          .insert({
            travel_request_id: requestId,
            uploaded_by: user.id,
            file_name: new URL(link.url).hostname,
            file_url: link.url,
            file_type: 'link',
            file_size: 0,
            category: link.category,
            link_url: link.url,
            notes: link.notes || null,
          })
          .select()
          .single();

        if (linkError) {
          console.error('Link insert error:', linkError);
        } else if (linkData) {
          uploadedAttachments.push(linkData);
        }
        
        completedFiles++;
      }

      setPendingFiles([]);
      setPendingLinks([]);
      setAttachments(prev => [...uploadedAttachments, ...prev]);

      if (uploadedAttachments.length > 0) {
        toast.success(`${uploadedAttachments.length} קבצים נוספו בהצלחה`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('שגיאה בהעלאת הקבצים');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [user]);

  const deleteAttachment = async (attachment: Attachment) => {
    if (attachment.file_type !== 'link') {
      // Delete from storage
      const path = attachment.storage_path || extractStoragePath(attachment.file_url);
      if (path) {
        await supabase.storage.from('travel-attachments').remove([path]);
      }
    }

    const { error } = await supabase
      .from('travel_request_attachments')
      .delete()
      .eq('id', attachment.id);

    if (error) {
      toast.error('שגיאה במחיקת הקובץ');
      return;
    }

    setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    toast.success('הקובץ נמחק');
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'link') return <Link2 className="h-4 w-4" />;
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Expose upload function for parent component - update on every render
  useEffect(() => {
    (window as any).uploadTravelAttachments = uploadAllAttachments;
    return () => {
      delete (window as any).uploadTravelAttachments;
    };
  }, [uploadAllAttachments]);

  const hasPendingItems = pendingFiles.length > 0 || pendingLinks.length > 0;
  const totalPendingCount = pendingFiles.length + pendingLinks.length;

  // Manual save function for when travelRequestId exists
  const handleManualSave = async () => {
    if (!travelRequestId || !hasPendingItems) return;
    await uploadAllAttachments(travelRequestId);
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-primary" />
            <span>צרופות ומסמכים</span>
            {(attachments.length > 0 || hasPendingItems) && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {attachments.length + totalPendingCount}
              </span>
            )}
          </div>
          {/* Save button when there are pending items */}
          {hasPendingItems && !readOnly && (
            <Button
              onClick={() => {
                if (!travelRequestId) {
                  toast.info('כדי לשמור צרופות יש לשמור את הבקשה כטיוטה קודם');
                  return;
                }
                void handleManualSave();
              }}
              disabled={uploading}
              size="sm"
              className="gap-2"
              variant={travelRequestId ? "default" : "outline"}
              title={!travelRequestId ? 'שמור טיוטה כדי לאפשר שמירת צרופות' : undefined}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              שמור צרופות ({totalPendingCount})
            </Button>
          )}
        </CardTitle>
        {!readOnly && (
          <p className="text-xs text-muted-foreground">
            הוסף קבצים, תמונות וקישורים לתמיכה בבקשה שלך
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Progress */}
        {uploading && uploadProgress && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3 animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                מעלה קובץ {uploadProgress.current} מתוך {uploadProgress.total}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[200px]">{uploadProgress.fileName}</span>
                <span>{uploadProgress.progress}%</span>
              </div>
              <Progress value={uploadProgress.progress} className="h-2" />
            </div>
          </div>
        )}

        {/* Compressing indicator */}
        {compressing && (
          <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">דוחס תמונות...</span>
          </div>
        )}

        {!readOnly && !uploading && (
          <>
            {/* Upload Section Header */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4 text-primary" />
                <span>הוסף קבצים</span>
              </div>
              
              {/* Category Selection */}
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">קטגוריה:</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Drag & Drop Zone */}
              <label 
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="block cursor-pointer"
              >
                <div className={`flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed rounded-lg transition-all ${
                  isDragging 
                    ? 'border-primary bg-primary/10 scale-[1.01]' 
                    : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'
                }`}>
                  <div className={`p-3 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Upload className={`h-6 w-6 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-center">
                    <span className={`text-sm font-medium block ${isDragging ? 'text-primary' : 'text-foreground'}`}>
                      {isDragging ? 'שחרר לכאן...' : 'גרור קבצים לכאן'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      או לחץ לבחירת קבצים (תמונות, PDF, מסמכים)
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            {/* Pending Files - Show with clear visual feedback */}
            {pendingFiles.length > 0 && (
              <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs">
                      {pendingFiles.length}
                    </span>
                    קבצים ממתינים לשמירה
                  </Label>
                  <div className="flex items-center gap-2">
                    {!travelRequestId && (
                      <span className="text-xs text-muted-foreground">
                        יישמרו עם שמירת הטיוטה או שליחת הבקשה
                      </span>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setPendingFiles([])}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      נקה הכל
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {pendingFiles.map((item, index) => {
                    const file = item.file;
                    return (
                      <div key={index} className="relative group bg-background rounded-lg border overflow-hidden">
                        {file.type.startsWith('image/') ? (
                          <>
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-24 object-cover"
                              loading="lazy"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removePendingFile(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <div className="h-24 flex flex-col items-center justify-center p-2 relative">
                            {getFileIcon(file.type)}
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removePendingFile(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <div className="p-1.5 border-t bg-muted/30 space-y-1">
                          <p className="text-xs truncate">{file.name}</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                            <span className="text-[10px] text-muted-foreground truncate">{getCategoryLabel(item.category)}</span>
                          </div>
                          {travelRequestId ? (
                            <Button
                              onClick={() => void savePendingFile(index)}
                              disabled={uploading}
                              size="sm"
                              className="w-full h-7 text-xs"
                              variant="secondary"
                            >
                              שמור צרופה
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground block text-center">
                              שמור טיוטה כדי להעלות
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Link Section */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="h-4 w-4 text-primary" />
                <span>הוסף קישור</span>
              </div>
              <p className="text-xs text-muted-foreground">
                הדבק קישורים מאתרי הזמנות (Booking, Expedia, Google Flights וכו')
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex gap-2">
                  <Select value={newLinkCategory} onValueChange={setNewLinkCategory}>
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="https://..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="flex-1 h-9"
                  />
                  <Button variant="secondary" onClick={addLink} size="sm" className="h-9">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {newLinkUrl && (
                  <Input
                    placeholder="הערה (אופציונלי)"
                    value={newLinkNotes}
                    onChange={(e) => setNewLinkNotes(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            </div>

            {/* Pending Links */}
            {pendingLinks.length > 0 && (
              <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-xs">
                      {pendingLinks.length}
                    </span>
                    קישורים ממתינים לשמירה
                  </Label>
                  {!travelRequestId && (
                    <span className="text-xs text-muted-foreground">
                      יישמרו עם שמירת הטיוטה או שליחת הבקשה
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {pendingLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                      <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded shrink-0">
                        {getCategoryLabel(link.category)}
                      </span>
                      <span className="flex-1 text-sm truncate">{link.url}</span>
                      {travelRequestId && (
                        <Button
                          onClick={() => void savePendingLink(index)}
                          disabled={uploading}
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          variant="secondary"
                        >
                          שמור קישור
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removePendingLink(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status message */}
            {hasPendingItems && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                travelRequestId 
                  ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                  : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
              }`}>
                {travelRequestId ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-300">
                      שמור כל צרופה בנפרד בכפתורי "שמור" ברשימות למעלה
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      הקבצים והקישורים יועלו אוטומטית עם שמירת הטיוטה או שליחת הבקשה
                    </span>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Existing Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <Label>קבצים מצורפים:</Label>
            
            {/* Image Attachments Grid */}
            {imageAttachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                {imageAttachments.map((attachment, index) => (
                  <div key={attachment.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => openLightbox(attachment.file_url, attachment.file_name, index)}
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
                    >
                      <img
                        src={attachment.file_url}
                        alt={attachment.file_name}
                        className="w-full h-32 object-cover rounded-md border hover:opacity-90 transition-opacity cursor-zoom-in"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-md">
                        <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                      </div>
                    </button>
                    <div className="absolute top-1 right-1">
                      <span className="text-xs bg-primary/90 text-primary-foreground px-2 py-0.5 rounded">
                        {getCategoryLabel(attachment.category)}
                      </span>
                    </div>
                    {!readOnly && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAttachment(attachment);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-1">{attachment.file_name}</p>
                    {attachment.notes && (
                      <p className="text-xs text-muted-foreground/70 truncate">{attachment.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Non-image Attachments List */}
            <div className="space-y-2">
              {attachments.filter(a => !a.file_type.startsWith('image/')).map(attachment => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-md"
                >
                  {getFileIcon(attachment.file_type)}
                  <span className="text-xs bg-primary/10 px-2 py-0.5 rounded">
                    {getCategoryLabel(attachment.category)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {attachment.file_type === 'link' ? (
                      <a
                        href={attachment.link_url || attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {attachment.file_name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <a
                        href={attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {attachment.file_name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {attachment.notes && (
                      <p className="text-xs text-muted-foreground">{attachment.notes}</p>
                    )}
                  </div>
                  {attachment.file_size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)}
                    </span>
                  )}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAttachment(attachment)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {attachments.length === 0 && readOnly && (
          <p className="text-sm text-muted-foreground text-center py-4">
            לא צורפו קבצים לבקשה זו
          </p>
        )}
      </CardContent>

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <DialogTitle className="sr-only">{lightboxImage?.name || 'תמונה מוגדלת'}</DialogTitle>
          {lightboxImage && (
            <div className="relative flex items-center justify-center w-full h-full min-h-[60vh]">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
                onClick={closeLightbox}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Navigation buttons */}
              {imageAttachments.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => navigateLightbox('next')}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => navigateLightbox('prev')}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Image */}
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="max-w-full max-h-[85vh] object-contain"
              />

              {/* Image info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm text-center truncate">{lightboxImage.name}</p>
                {imageAttachments.length > 1 && (
                  <p className="text-white/70 text-xs text-center mt-1">
                    {lightboxImage.index + 1} / {imageAttachments.length}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Export the pending items getter for parent components
export const getPendingAttachments = () => ({
  hasPending: () => {
    const uploadFn = (window as any).uploadTravelAttachments;
    return !!uploadFn;
  }
});

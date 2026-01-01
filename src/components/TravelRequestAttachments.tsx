import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Link2, Trash2, FileText, Image, ExternalLink, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: string;
  link_url: string | null;
  notes: string | null;
  uploaded_at: string;
}

interface TravelRequestAttachmentsProps {
  travelRequestId: string | null;
  readOnly?: boolean;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
}

const CATEGORIES = [
  { value: 'flights', label: 'טיסות' },
  { value: 'accommodation', label: 'לינה' },
  { value: 'transport', label: 'תחבורה' },
  { value: 'other', label: 'אחר' },
];

export default function TravelRequestAttachments({ 
  travelRequestId, 
  readOnly = false,
  onAttachmentsChange 
}: TravelRequestAttachmentsProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingLinks, setPendingLinks] = useState<{ url: string; category: string; notes: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState('flights');
  const [newLinkNotes, setNewLinkNotes] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('flights');

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

    setAttachments(data || []);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(`הקובץ ${file.name} גדול מדי (מקסימום 10MB)`);
        return false;
      }
      return true;
    });

    setPendingFiles(prev => [...prev, ...newFiles]);
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

  const uploadAllAttachments = async (requestId: string) => {
    if (!user) return;

    setUploading(true);
    const uploadedAttachments: Attachment[] = [];

    try {
      // Upload files
      for (const file of pendingFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('travel-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`שגיאה בהעלאת ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('travel-attachments')
          .getPublicUrl(fileName);

        const { data: attachmentData, error: insertError } = await supabase
          .from('travel_request_attachments')
          .insert({
            travel_request_id: requestId,
            uploaded_by: user.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            category: selectedCategory,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
        } else if (attachmentData) {
          uploadedAttachments.push(attachmentData);
        }
      }

      // Save links
      for (const link of pendingLinks) {
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
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    if (attachment.file_type !== 'link') {
      // Delete from storage
      const path = attachment.file_url.split('/travel-attachments/')[1];
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

  // Expose upload function for parent component
  (window as any).uploadTravelAttachments = uploadAllAttachments;

  const hasPendingItems = pendingFiles.length > 0 || pendingLinks.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          צרופות ומסמכים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <>
            {/* File Upload */}
            <div className="space-y-2">
              <Label>העלאת קבצים (תמונות, PDF, מסמכים)</Label>
              <div className="flex gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-32">
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
                <label className="flex-1">
                  <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">לחץ לבחירת קבצים</span>
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
            </div>

            {/* Pending Files */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">קבצים ממתינים להעלאה:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {pendingFiles.map((file, index) => (
                    <div key={index} className="relative p-2 bg-muted/50 rounded-md">
                      {file.type.startsWith('image/') ? (
                        <div className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-32 object-cover rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 left-1 h-6 w-6"
                            onClick={() => removePendingFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.type)}
                          <span className="flex-1 text-sm truncate">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePendingFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Link */}
            <div className="space-y-2 pt-4 border-t">
              <Label>הוספת קישור (Expedia, Booking, Google Flights וכו')</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Select value={newLinkCategory} onValueChange={setNewLinkCategory}>
                  <SelectTrigger>
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
                  className="md:col-span-2"
                />
                <Button variant="outline" onClick={addLink}>
                  <Link2 className="h-4 w-4 ml-2" />
                  הוסף
                </Button>
              </div>
              <Input
                placeholder="הערה (אופציונלי)"
                value={newLinkNotes}
                onChange={(e) => setNewLinkNotes(e.target.value)}
              />
            </div>

            {/* Pending Links */}
            {pendingLinks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">קישורים ממתינים:</Label>
                <div className="space-y-1">
                  {pendingLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Link2 className="h-4 w-4" />
                      <span className="text-xs bg-primary/10 px-2 py-0.5 rounded">
                        {getCategoryLabel(link.category)}
                      </span>
                      <span className="flex-1 text-sm truncate">{link.url}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePendingLink(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasPendingItems && !travelRequestId && (
              <p className="text-sm text-muted-foreground">
                * הקבצים והקישורים יישמרו לאחר שמירת הבקשה
              </p>
            )}
          </>
        )}

        {/* Existing Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <Label>קבצים מצורפים:</Label>
            
            {/* Image Attachments Grid */}
            {attachments.filter(a => a.file_type.startsWith('image/')).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                {attachments.filter(a => a.file_type.startsWith('image/')).map(attachment => (
                  <div key={attachment.id} className="relative group">
                    <a
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={attachment.file_url}
                        alt={attachment.file_name}
                        className="w-full h-32 object-cover rounded-md border hover:opacity-90 transition-opacity"
                      />
                    </a>
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
                        onClick={() => deleteAttachment(attachment)}
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

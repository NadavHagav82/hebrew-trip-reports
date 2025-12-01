import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, CheckCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_by: string;
  profiles: {
    full_name: string;
  };
}

interface AccountingCommentsProps {
  reportId: string;
  isAccountingUser: boolean;
}

export const AccountingComments = ({ reportId, isAccountingUser }: AccountingCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();

    // Set up real-time subscription
    const channel = supabase
      .channel(`accounting-comments-${reportId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounting_comments',
          filter: `report_id=eq.${reportId}`
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reportId]);

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_comments')
        .select(`
          *,
          profiles!accounting_comments_created_by_fkey(full_name)
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      // Get current user profile for comment author name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('accounting_comments')
        .insert({
          report_id: reportId,
          comment_text: newComment.trim(),
          created_by: user.id,
        });

      if (error) throw error;

      // Send notification email
      try {
        await supabase.functions.invoke('notify-accounting-comment', {
          body: {
            reportId,
            commentText: newComment.trim(),
            commentAuthor: profileData?.full_name || 'הנהלת חשבונות',
          },
        });
      } catch (emailError) {
        console.error('Error sending notification:', emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: 'הערה נשלחה',
        description: 'ההערה נוספה והעובד/מנהל קיבלו התראה',
      });

      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשלוח את ההערה',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveComment = async (commentId: string, isResolved: boolean) => {
    try {
      const { error } = await supabase
        .from('accounting_comments')
        .update({
          is_resolved: !isResolved,
          resolved_at: !isResolved ? new Date().toISOString() : null,
        })
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: !isResolved ? 'הערה סומנה כטופלה' : 'הערה סומנה כלא טופלה',
      });
    } catch (error) {
      console.error('Error resolving comment:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את ההערה',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          הערות הנהלת חשבונות
          {comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        {comments.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`border rounded-lg p-4 ${
                  comment.is_resolved
                    ? 'bg-muted/50 border-green-200'
                    : 'bg-card border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {comment.profiles.full_name}
                    </span>
                    {comment.is_resolved && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="w-3 h-3 ml-1" />
                        טופל
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap mb-2">{comment.comment_text}</p>
                {isAccountingUser && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolveComment(comment.id, comment.is_resolved)}
                    className="text-xs"
                  >
                    {comment.is_resolved ? 'סמן כלא טופל' : 'סמן כטופל'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">אין הערות עדיין</p>
          </div>
        )}

        {/* New Comment Form */}
        {isAccountingUser && (
          <div className="space-y-2 pt-4 border-t">
            <Textarea
              placeholder="הוסף הערה לעובד או למנהל..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              disabled={submitting}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
                size="sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 ml-2" />
                    שלח הערה
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

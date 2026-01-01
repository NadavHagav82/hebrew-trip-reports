import { useState, useEffect, useCallback } from "react";
import { Bell, Check, Trash2, Plane, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TravelRequestPreview {
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  estimated_total_ils: number | null;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  report_id: string | null;
  travel_request_id: string | null;
  is_read: boolean;
  created_at: string;
  travel_request?: TravelRequestPreview | null;
}

interface SwipeState {
  id: string;
  startX: number;
  currentX: number;
  isSwiping: boolean;
}

const SWIPE_THRESHOLD = 80;

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [swipeState, setSwipeState] = useState<SwipeState | null>(null);
  const navigate = useNavigate();

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  };

  const triggerShakeAnimation = () => {
    setIsShaking(true);
    playNotificationSound();
    setTimeout(() => setIsShaking(false), 600);
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      // Fetch travel request details for notifications that have travel_request_id
      const travelRequestIds = data
        .filter(n => n.travel_request_id)
        .map(n => n.travel_request_id);
      
      let travelRequests: Record<string, TravelRequestPreview> = {};
      
      if (travelRequestIds.length > 0) {
        const { data: travelData } = await supabase
          .from("travel_requests")
          .select("id, destination_city, destination_country, start_date, end_date, estimated_total_ils")
          .in("id", travelRequestIds);
        
        if (travelData) {
          travelRequests = travelData.reduce((acc, tr) => {
            acc[tr.id] = {
              destination_city: tr.destination_city,
              destination_country: tr.destination_country,
              start_date: tr.start_date,
              end_date: tr.end_date,
              estimated_total_ils: tr.estimated_total_ils,
            };
            return acc;
          }, {} as Record<string, TravelRequestPreview>);
        }
      }
      
      const enrichedNotifications = data.map(n => ({
        ...n,
        travel_request: n.travel_request_id ? travelRequests[n.travel_request_id] || null : null,
      }));
      
      setNotifications(enrichedNotifications);
      setUnreadCount(enrichedNotifications.filter((n) => !n.is_read).length);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          triggerShakeAnimation();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const deleteNotification = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    
    await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    
    if (notification && !notification.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    if (notification.type === 'travel_request_pending' && notification.travel_request_id) {
      navigate(`/travel/pending-approvals?request=${notification.travel_request_id}`);
      setOpen(false);
    } else if (notification.type === 'travel_request_pending') {
      navigate('/travel/pending-approvals');
      setOpen(false);
    } else if ((notification.type === 'travel_approved' || notification.type === 'travel_rejected') && notification.travel_request_id) {
      navigate(`/travel-requests/${notification.travel_request_id}`);
      setOpen(false);
    } else if (notification.type === 'travel_approved' || notification.type === 'travel_rejected') {
      navigate('/travel-requests');
      setOpen(false);
    } else if (notification.report_id) {
      navigate(`/report/${notification.report_id}`);
      setOpen(false);
    }
  };

  // Swipe handlers - bidirectional
  const handleTouchStart = useCallback((e: React.TouchEvent, notificationId: string) => {
    setSwipeState({
      id: notificationId,
      startX: e.touches[0].clientX,
      currentX: e.touches[0].clientX,
      isSwiping: false,
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState) return;
    
    const currentX = e.touches[0].clientX;
    const diff = Math.abs(currentX - swipeState.startX);
    
    setSwipeState({
      ...swipeState,
      currentX,
      isSwiping: diff > 10,
    });
  }, [swipeState]);

  const handleTouchEnd = useCallback((notification: Notification) => {
    if (!swipeState) return;
    
    const diff = swipeState.currentX - swipeState.startX;
    
    // In RTL: negative diff = swipe left (mark as read), positive diff = swipe right (delete)
    if (diff < -SWIPE_THRESHOLD && !notification.is_read) {
      markAsRead(swipeState.id);
    } else if (diff > SWIPE_THRESHOLD) {
      deleteNotification(swipeState.id);
    }
    
    setSwipeState(null);
  }, [swipeState]);

  const getSwipeOffset = (notificationId: string): { left: number; right: number } => {
    if (!swipeState || swipeState.id !== notificationId) return { left: 0, right: 0 };
    const diff = swipeState.currentX - swipeState.startX;
    
    if (diff < 0) {
      // Swipe left (mark as read)
      return { left: Math.min(Math.abs(diff), 100), right: 0 };
    } else {
      // Swipe right (delete)
      return { left: 0, right: Math.min(diff, 100) };
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "report_approved":
      case "travel_approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "report_rejected":
      case "travel_rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "expense_rejected":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "expense_approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "travel_request_pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "report_approved":
        return "דוח אושר";
      case "report_rejected":
        return "דוח נדחה";
      case "expense_rejected":
        return "הוצאה נדחתה";
      case "expense_approved":
        return "הוצאה אושרה";
      case "travel_request_pending":
        return "ממתין לאישור";
      case "travel_approved":
        return "נסיעה אושרה";
      case "travel_rejected":
        return "נסיעה נדחתה";
      default:
        return "התראה";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "relative transition-all",
            isShaking && "animate-[shake_0.5s_ease-in-out]"
          )}
        >
          <Bell className={cn(
            "h-5 w-5 transition-transform",
            isShaking && "text-amber-500"
          )} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">התראות</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              סמן הכל כנקרא
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              אין התראות
            </div>
          ) : (
            <div className="divide-y overflow-hidden">
              {notifications.map((notification) => {
                const swipeOffset = getSwipeOffset(notification.id);
                const isSwipingThis = swipeState?.id === notification.id && swipeState.isSwiping;
                const translateX = swipeOffset.right > 0 ? swipeOffset.right : -swipeOffset.left;
                
                return (
                  <div
                    key={notification.id}
                    className="relative overflow-hidden"
                  >
                    {/* Left swipe background - Mark as read (green) */}
                    {!notification.is_read && swipeOffset.left > 0 && (
                      <div 
                        className={cn(
                          "absolute inset-y-0 left-0 flex items-center justify-center bg-green-500 transition-all",
                          swipeOffset.left > SWIPE_THRESHOLD ? "bg-green-600" : ""
                        )}
                        style={{ width: `${swipeOffset.left}px` }}
                      >
                        {swipeOffset.left > 30 && (
                          <Check className="h-5 w-5 text-white" />
                        )}
                      </div>
                    )}
                    
                    {/* Right swipe background - Delete (red) */}
                    {swipeOffset.right > 0 && (
                      <div 
                        className={cn(
                          "absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 transition-all",
                          swipeOffset.right > SWIPE_THRESHOLD ? "bg-red-600" : ""
                        )}
                        style={{ width: `${swipeOffset.right}px` }}
                      >
                        {swipeOffset.right > 30 && (
                          <Trash2 className="h-5 w-5 text-white" />
                        )}
                      </div>
                    )}
                    
                    {/* Notification content */}
                    <div
                      className={cn(
                        "p-3 cursor-pointer hover:bg-muted/50 transition-all bg-background relative",
                        !notification.is_read ? "bg-primary/5" : ""
                      )}
                      style={{
                        transform: `translateX(${translateX}px)`,
                        transition: isSwipingThis ? 'none' : 'transform 0.2s ease-out'
                      }}
                      onClick={() => !swipeState?.isSwiping && handleNotificationClick(notification)}
                      onTouchStart={(e) => handleTouchStart(e, notification.id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={() => handleTouchEnd(notification)}
                    >
                      <div className="flex items-start gap-2">
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${getTypeColor(notification.type)}`}
                            >
                              {getTypeLabel(notification.type)}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          
                          {/* Travel Request Preview */}
                          {notification.travel_request && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs space-y-1">
                              <div className="flex items-center gap-1.5 text-foreground">
                                <Plane className="h-3 w-3 text-primary" />
                                <span className="font-medium">
                                  {notification.travel_request.destination_city}, {notification.travel_request.destination_country}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {format(new Date(notification.travel_request.start_date), "d MMM", { locale: he })} - {format(new Date(notification.travel_request.end_date), "d MMM yyyy", { locale: he })}
                                </span>
                              </div>
                              {notification.travel_request.estimated_total_ils && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <DollarSign className="h-3 w-3" />
                                  <span>תקציב: ₪{notification.travel_request.estimated_total_ils.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.created_at), "dd/MM/yyyy HH:mm", {
                              locale: he,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* Mobile hint */}
        <div className="p-2 border-t text-center text-xs text-muted-foreground md:hidden">
          החלק שמאלה לסימון כנקרא • החלק ימינה למחיקה
        </div>
      </PopoverContent>
    </Popover>
  );
};
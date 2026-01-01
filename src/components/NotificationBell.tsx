import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check } from "lucide-react";
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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  report_id: string | null;
  travel_request_id: string | null;
  is_read: boolean;
  created_at: string;
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

  // Play notification sound
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

  // Trigger shake animation
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
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
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

  // Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, notificationId: string, isRead: boolean) => {
    if (isRead) return;
    
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
    const diff = currentX - swipeState.startX;
    
    // Only allow right swipe (positive diff) in RTL
    if (diff < 0) {
      setSwipeState({
        ...swipeState,
        currentX,
        isSwiping: Math.abs(diff) > 10,
      });
    }
  }, [swipeState]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeState) return;
    
    const diff = swipeState.startX - swipeState.currentX;
    
    if (diff > SWIPE_THRESHOLD) {
      // Swipe threshold reached - mark as read
      markAsRead(swipeState.id);
    }
    
    setSwipeState(null);
  }, [swipeState]);

  const getSwipeOffset = (notificationId: string): number => {
    if (!swipeState || swipeState.id !== notificationId) return 0;
    const diff = swipeState.startX - swipeState.currentX;
    return Math.max(0, Math.min(diff, 100));
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
                
                return (
                  <div
                    key={notification.id}
                    className="relative overflow-hidden"
                  >
                    {/* Swipe background indicator */}
                    {!notification.is_read && (
                      <div 
                        className={cn(
                          "absolute inset-y-0 left-0 flex items-center justify-center bg-green-500 transition-all",
                          swipeOffset > SWIPE_THRESHOLD ? "bg-green-600" : ""
                        )}
                        style={{ width: `${swipeOffset}px` }}
                      >
                        {swipeOffset > 30 && (
                          <Check className="h-5 w-5 text-white" />
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
                        transform: `translateX(-${swipeOffset}px)`,
                        transition: isSwipingThis ? 'none' : 'transform 0.2s ease-out'
                      }}
                      onClick={() => handleNotificationClick(notification)}
                      onTouchStart={(e) => handleTouchStart(e, notification.id, notification.is_read)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.created_at), "dd/MM/yyyy HH:mm", {
                              locale: he,
                            })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Swipe hint for unread notifications */}
                      {!notification.is_read && !isSwipingThis && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground opacity-40 pointer-events-none md:hidden">
                          ←
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* Mobile hint */}
        {unreadCount > 0 && (
          <div className="p-2 border-t text-center text-xs text-muted-foreground md:hidden">
            החלק שמאלה לסימון כנקרא
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
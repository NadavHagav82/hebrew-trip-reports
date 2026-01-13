import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: {
    username: string;
    full_name: string;
    employee_id: string | null;
    department: string;
    is_manager: boolean;
    manager_id: string | null;
    accounting_manager_email: string | null;
    organization_id?: string | null;
  }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // CRITICAL: Prevent logout on refresh by properly handling session initialization
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // First, get the existing session from storage
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (isMounted && existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
        }
        
        hasInitialized.current = true;
        if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        hasInitialized.current = true;
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Only update state if we're mounted
      if (!isMounted) return;

      // Handle different auth events
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          break;
        case 'SIGNED_OUT':
          // Only clear session on explicit sign out
          setSession(null);
          setUser(null);
          break;
        case 'INITIAL_SESSION':
          // On initial session, only update if we have a session (don't clear existing)
          if (nextSession) {
            setSession(nextSession);
            setUser(nextSession.user);
          }
          break;
        default:
          // For other events, update normally
          if (nextSession) {
            setSession(nextSession);
            setUser(nextSession.user);
          }
      }

      // Mark as no longer loading after first auth event
      if (hasInitialized.current) {
        setLoading(false);
      }
    });

    // Initialize auth
    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Retry a couple times on transient backend timeouts (e.g. 504 / request_timeout)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) return { error: null };

      const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
      const transient =
        msg.includes('504') ||
        msg.includes('request_timeout') ||
        msg.includes('context deadline exceeded') ||
        msg.includes('timeout') ||
        msg.includes('failed to fetch') ||
        msg.includes('network');

      if (!transient || attempt === 3) {
        return { error };
      }

      await sleep(600 * attempt);
    }

    return { error: new Error('Unknown sign-in error') };
  };

  const signUp = async (email: string, password: string, userData: {
    username: string;
    full_name: string;
    employee_id: string | null;
    department: string;
    is_manager: boolean;
    manager_id: string | null;
    accounting_manager_email: string | null;
    organization_id?: string | null;
  }) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: userData
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

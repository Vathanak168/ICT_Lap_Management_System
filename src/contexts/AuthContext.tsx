import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  role: 'admin' | 'teacher' | null;
  profileImage: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'teacher' | null>(null); 
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const user = session?.user ?? null;
  const profileRequestRef = useRef(0);
  const loadedProfileUserIdRef = useRef<string | null>(null);

  const fetchUserProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestRef.current;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, profile_image_url')
        .eq('id', userId)
        .maybeSingle();
        
      if (requestId !== profileRequestRef.current) return;
      if (error) throw error;

      const validRole = data?.role === 'admin' || data?.role === 'teacher' ? data.role : null;
      setRole(validRole);
      setProfileImage(data?.profile_image_url ?? null);
    } catch (error: any) {
      if (requestId !== profileRequestRef.current) return;
      console.error('Error fetching user profile:', error);
      
      // Auto-logout if JWT is expired (401 / PGRST303)
      if (error?.code === 'PGRST303' || error?.message?.includes('JWT')) {
        void supabase.auth.signOut();
      }
      
      setRole(null);
      setProfileImage(null);
    } finally {
      if (requestId === profileRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      setSession(data.session);

      if (data.session?.user) {
        loadedProfileUserIdRef.current = data.session.user.id;
        await fetchUserProfile(data.session.user.id);
      } else {
        setRole(null);
        setProfileImage(null);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
      setSession(null);
      setRole(null);
      setProfileImage(null);
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      
      if (currentSession?.user) {
        if (loadedProfileUserIdRef.current !== currentSession.user.id) {
          // New user signed in
          setRole(null);
          setProfileImage(null);
          loadedProfileUserIdRef.current = currentSession.user.id;
          void fetchUserProfile(currentSession.user.id);
        }
      } else {
        // User signed out
        profileRequestRef.current++;
        loadedProfileUserIdRef.current = null;
        setRole(null);
        setProfileImage(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeAuth, fetchUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  }, [user?.id, fetchUserProfile]);

  const contextValue = useMemo(() => ({
    user,
    session,
    isLoading,
    role,
    profileImage,
    refreshProfile
  }), [user, session, isLoading, role, profileImage, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
};

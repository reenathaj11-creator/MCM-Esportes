import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

type UserRole = 'admin' | 'user';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Pegar a sessão atual no load inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        determineRole(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Escutar mudanças de autenticação (login, logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        determineRole(session.user);
      } else {
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const determineRole = (user: User) => {
    // Permissão de admin via banco (app_metadata, somente-servidor) ou para o e-mail oficial do dono.
    // NÃO usar user_metadata aqui: ele é gravável pelo próprio usuário no cadastro.
    const isOwner = user.email === 'felipe.fschneider@gmail.com';
    const isMetaAdmin = user.app_metadata?.role === 'admin';
    
    setRole(isOwner || isMetaAdmin ? 'admin' : 'user');
    setIsLoading(false);
  };

  const logout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

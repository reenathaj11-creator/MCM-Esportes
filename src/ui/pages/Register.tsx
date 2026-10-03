import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Auto login ou redirect
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-primary/10 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-sm z-10">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="MCM Esportes" className="w-20 h-20 object-contain mb-4" />
          <h2 className="text-2xl font-bold text-white tracking-tight">Criar Conta</h2>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-brand-muted" />
              </div>
              <input
                type="text"
                required
                placeholder="Nome completo"
                className="block w-full pl-11 pr-4 py-4 bg-brand-card/50 border border-white/5 rounded-2xl text-white placeholder-brand-muted focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-brand-muted" />
              </div>
              <input
                type="email"
                required
                placeholder="Seu e-mail"
                className="block w-full pl-11 pr-4 py-4 bg-brand-card/50 border border-white/5 rounded-2xl text-white placeholder-brand-muted focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-brand-muted" />
              </div>
              <input
                type="password"
                required
                placeholder="Sua senha"
                className="block w-full pl-11 pr-4 py-4 bg-brand-card/50 border border-white/5 rounded-2xl text-white placeholder-brand-muted focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-brand-bg font-bold bg-brand-primary hover:bg-brand-primary-dark transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 mt-6"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Criar Conta'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-brand-muted">
          Já tem uma conta?{' '}
          <Link to="/login" className="font-bold text-brand-primary hover:text-brand-primary-dark">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}

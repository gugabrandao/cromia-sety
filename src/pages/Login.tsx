import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import setyLogo from '../assets/sety logo branca.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-purple/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/10 blur-[120px] rounded-full animate-pulse [animation-delay:1s]" />

      <div className="w-full max-w-md px-6 relative z-10">
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-top-8 duration-700">
          <div
            className="h-16 w-48 bg-gradient-to-r from-brand-accent to-purple-400 mb-4"
            style={{
              WebkitMaskImage: `url("${setyLogo}")`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskImage: `url("${setyLogo}")`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center'
            }}
          />
          <p className="text-foreground/40 tracking-[0.3em] uppercase text-xs font-bold">Professional Setlist Manager</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-[2.5rem] p-10 border border-white/5 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <h2 className="text-3xl font-black text-white mb-2 text-center">Bem-vindo</h2>
          <p className="text-foreground/40 text-sm text-center mb-10 font-medium">Faça login para acessar seu repertório</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20 group-focus-within:text-brand-purple transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 outline-none focus:ring-2 focus:ring-brand-purple/50 focus:bg-white/10 transition-all text-white placeholder:text-white/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20 group-focus-within:text-brand-purple transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 outline-none focus:ring-2 focus:ring-brand-purple/50 focus:bg-white/10 transition-all text-white placeholder:text-white/10"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-purple hover:bg-brand-accent text-white font-black py-4 rounded-2xl shadow-xl shadow-brand-purple/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  ACESSAR DASHBOARD
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-black/20 px-4 text-foreground/30 font-bold backdrop-blur-xl">Ou entre com</span></div>
          </div>

          <div className="mt-8 flex justify-center">
            <button 
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 py-3.5 px-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-bold text-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" />
              Entrar com Google
            </button>
          </div>
        </div>

        <p className="mt-10 text-center text-foreground/20 text-xs">
          © 2024 Cromia Sety • Professional Live Performance Ecosystem
        </p>
      </div>
    </div>
  );
}

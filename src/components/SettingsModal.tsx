import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { 
  X, Mail, Lock, Loader2, Check, ShieldCheck, 
  ChevronRight, ArrowRight, UserCircle, Eye, EyeOff, Camera,
  User, Phone 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
        setAvatarUrl(user?.user_metadata?.avatar_url || null);
        setFullName(user?.user_metadata?.full_name || '');
        setPhone(user?.user_metadata?.phone || '');
      });
    }
  }, [isOpen]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: fullName,
          phone: phone
        }
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setMessage({ type: 'success', text: 'Foto de perfil atualizada!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro no upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres' });
      return;
    }
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<> ]/.test(newPassword);

    if (!hasUppercase || !hasNumber || !hasSpecial) {
      setMessage({ 
        type: 'error', 
        text: 'A senha deve conter pelo menos uma letra maiúscula, um número e um caractere especial' 
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar senha' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-background border border-foreground/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 border-b border-foreground/5 flex items-center justify-between bg-foreground/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-brand-purple" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{t('settings')}</h2>
                  <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Conta e Segurança</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 rounded-full hover:bg-foreground/5 transition-colors text-foreground/40 hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Profile Info */}
              <div className="glass p-6 rounded-3xl border border-foreground/5">
                <div className="flex items-center gap-6">
                  <div className="relative group/avatar">
                    <div className="w-20 h-20 rounded-full bg-foreground/5 flex items-center justify-center border-2 border-foreground/10 overflow-hidden relative shadow-xl shadow-black/20">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-12 h-12 text-foreground/20" />
                      )}
                      
                      {uploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}

                      <label className="absolute inset-0 bg-brand-purple/80 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all z-20">
                        <Camera className="w-6 h-6 text-white mb-1" />
                        <span className="text-[8px] font-black text-white uppercase tracking-tighter">Mudar</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleAvatarUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-1">E-mail de Acesso</p>
                    <p className="text-lg font-bold text-foreground truncate max-w-[200px]">{user?.email || 'carregando...'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Check className="w-3 h-3" /> Verificado
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Details Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-brand-purple" />
                  <h3 className="font-bold text-foreground/60 uppercase text-xs tracking-widest">Dados Pessoais</h3>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-foreground/30 uppercase ml-1">Nome Completo</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20 group-focus-within:text-brand-purple transition-colors" />
                      <input 
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Seu nome artístico ou real"
                        className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-12 py-4 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-foreground/30 uppercase ml-1">Telefone / WhatsApp</label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20 group-focus-within:text-brand-purple transition-colors" />
                      <input 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-12 py-4 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="w-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20 font-black py-4 rounded-2xl hover:bg-brand-purple hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {profileLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        SALVAR ALTERAÇÕES
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="h-px bg-foreground/5 w-full" />

              {/* Password Change Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-brand-purple" />
                  <h3 className="font-bold text-foreground/60 uppercase text-xs tracking-widest">Mudar Senha</h3>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-foreground/30 uppercase ml-1">Nova Senha</label>
                      <div className="relative group">
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-5 py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-brand-purple transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-foreground/30 uppercase ml-1">Confirmar Senha</label>
                      <div className="relative group">
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-foreground/5 border border-foreground/5 rounded-2xl px-5 py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-1">
                    {[
                      { label: '8+ caracteres', met: newPassword.length >= 8 },
                      { label: 'Maiúscula', met: /[A-Z]/.test(newPassword) },
                      { label: 'Número', met: /[0-9]/.test(newPassword) },
                      { label: 'Especial', met: /[!@#$%^&*(),.?":{}|<> ]/.test(newPassword) }
                    ].map((req, i) => (
                      <div key={i} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${req.met ? 'text-green-500' : 'text-foreground/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${req.met ? 'bg-green-500' : 'bg-foreground/10'}`} />
                        {req.label}
                      </div>
                    ))}
                  </div>

                  {message && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
                        message.type === 'success' 
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}
                    >
                      {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                      {message.text}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !newPassword}
                    className="w-full bg-foreground text-background font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        ATUALIZAR SENHA
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-foreground/[0.02] border-t border-foreground/5 flex justify-center">
              <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">Cromia Sety v1.0.0 • Segurança Avançada</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

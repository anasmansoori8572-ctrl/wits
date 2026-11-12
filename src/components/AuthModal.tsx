import React, { useState } from 'react';
import { User, SiteSettings } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { X, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  initialRole?: 'student' | 'admin';
  siteSettings?: SiteSettings;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialRole = 'student',
  siteSettings
}) => {
  const [email, setEmail] = useState(initialRole === 'admin' ? 'admin@witslingo.com' : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const isAdmin = initialRole === 'admin';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // If admin, pass email as admin@witslingo.com or check against siteSettings.adminPasskey
      const targetEmail = isAdmin ? (email || 'admin@witslingo.com') : email;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          username: targetEmail,
          password: password.trim(),
          adminPasskey: isAdmin ? password.trim() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        // Direct client-side fallback check if offline or custom passkey
        if (isAdmin && (password.trim() === 'admin123' || (siteSettings?.adminPasskey && password.trim() === siteSettings.adminPasskey))) {
          const fallbackAdminUser: User = {
            id: 'usr-admin-01',
            name: siteSettings?.founderName || 'Ziyaur Rehman Zia',
            email: 'admin@witslingo.com',
            role: 'admin',
            phone: siteSettings?.phone1 || '+91 7310952271',
            batchIds: []
          };
          onLoginSuccess(fallbackAdminUser, 'fallback-admin-token-' + Date.now());
          onClose();
          return;
        }
        throw new Error(data.error || 'Invalid credentials.');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      // If admin and password is valid fallback
      if (isAdmin && (password.trim() === 'admin123' || (siteSettings?.adminPasskey && password.trim() === siteSettings.adminPasskey))) {
        const fallbackAdminUser: User = {
          id: 'usr-admin-01',
          name: siteSettings?.founderName || 'Ziyaur Rehman Zia',
          email: 'admin@witslingo.com',
          role: 'admin',
          phone: siteSettings?.phone1 || '+91 7310952271',
          batchIds: []
        };
        onLoginSuccess(fallbackAdminUser, 'fallback-admin-token-' + Date.now());
        onClose();
        return;
      }
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-purple-100 animate-in zoom-in-95 duration-150 relative overscroll-contain max-h-[92vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#4A1D96] flex items-center justify-center mx-auto mb-2 shadow-xs">
            {isAdmin ? <KeyRound className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h2 className="font-['Outfit'] text-2xl font-bold text-slate-900">
            {isAdmin ? 'Academy Admin Security' : 'Student Portal Login'}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {isAdmin
              ? 'Enter Admin Security Key to open management dashboard'
              : 'Enter your registered credentials to access your course classes & recordings'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {!isAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Email or Admission ID (Username) *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. student@gmail.com or WL-OCT26-8363"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#4A1D96]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              {isAdmin ? 'Admin Security Password *' : 'Account Password *'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus={isAdmin}
                placeholder={isAdmin ? 'Enter Admin Password (e.g. admin123)' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#4A1D96]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isAdmin && (
              <p className="text-[11px] text-slate-400 pt-0.5">
                Default security password: <span className="font-mono text-purple-700 font-semibold">admin123</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold tracking-wide shadow-md shadow-purple-950/15 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{loading ? 'Verifying Security...' : 'Unlock & Open Admin Dashboard'}</span>
              </>
            ) : (
              <>
                <span>{loading ? 'Authenticating...' : 'Sign In to Student Portal'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-1 text-center text-[11px] text-slate-400">
          Wits Lingo Academy • Secure Administration Gateway
        </div>

      </div>
    </div>
  );
};

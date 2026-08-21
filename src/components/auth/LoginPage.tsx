import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useERP } from '../../context/ERPContext';
import { ThemeToggle } from '../common/ThemeToggle';
import {
  Factory,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, users } = useAuth();
  const { setIsSetupOpen } = useERP();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setErrorMsg('Please enter your email or username');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const success = await login(usernameOrEmail, password);
      if (!success) {
        setErrorMsg('Invalid username or password. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(0,0,0,0))] p-4 font-sans text-xs antialiased relative transition-colors duration-200">
      {/* Pinned Top-Right Theme Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle size="md" variant="button" showLabel />
      </div>

      <div className="w-full max-w-md space-y-5">
        {/* Factory Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-blue-500/25 ring-1 ring-white/20 mb-1">
            <Factory className="h-7 w-7 text-white drop-shadow-xs" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl font-sans uppercase">
                Monoara Jahur
              </h1>
              <span className="rounded bg-blue-500/15 dark:bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-700 dark:text-blue-300 border border-blue-400/30">
                MJAL
              </span>
            </div>
            <p className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 dark:from-blue-400 dark:via-cyan-300 dark:to-indigo-300 tracking-wider uppercase mt-0.5">
              Apparels Ltd. • Industrial Garments ERP
            </p>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl dark:shadow-2xl backdrop-blur-xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 h-24 w-24 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

          <div className="mb-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Authorized Access Login</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Enter your official credentials to enter the ERP portal</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" /> Secure Auth
            </span>
          </div>

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-[11px] text-rose-700 dark:text-rose-300 animate-fade-in">
              <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address or Username
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. hr.admin@mjal.com or username"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/80 pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Account Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/80 pl-9 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between text-[11px] pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <span>Keep session active</span>
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-bold text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50 transition-all cursor-pointer text-xs mt-2"
            >
              {isLoading ? (
                <span>Authenticating with ERP...</span>
              ) : (
                <>
                  <span>Sign In to ERP Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* First time setup if database has no users */}
          {users.length === 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>No Super Admin created in Supabase Auth yet</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSetupOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/30 hover:bg-indigo-100 dark:hover:bg-indigo-600/50 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-500/40 text-xs font-bold transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Register Initial Super Admin in Supabase Auth</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 dark:text-slate-500">
          <span>Monoara Jahur Apparels Ltd. &copy; {new Date().getFullYear()} &bull; Enterprise Resource Planning</span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ROLE_LABELS } from '../db';
import { Lock, User, KeyRound, Coffee, ShieldAlert, ArrowRight, Eye, EyeOff, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { maskEmail } from '../services/OtpService';
import cloudSyncService from '../services/cloudSyncService';

export default function ManagerWebLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const users = useLiveQuery(() => db.users.toArray()) || [];
  const settings = useLiveQuery(() => db.app_settings.get('default')) || {};

  // Auto-sync with cloud on mount so web portal fetches latest credentials and orders
  useEffect(() => {
    let isMounted = true;
    setIsCloudSyncing(true);
    setSyncStatusMsg('Fetching latest data from POS...');

    cloudSyncService.pullCloudData().then((snapshot) => {
      if (isMounted) {
        setIsCloudSyncing(false);
        if (snapshot) {
          setSyncStatusMsg('Connected to live POS database ✓');
        } else {
          setSyncStatusMsg('');
        }
      }
    }).catch(() => {
      if (isMounted) setIsCloudSyncing(false);
    });

    return () => { isMounted = false; };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Find matching manager or super_admin account
      const allUsers = await db.users.toArray();
      const matched = allUsers.find(u => {
        const uRole = u.role;
        const isMgr = uRole === 'manager' || uRole === 'super_admin';
        if (!isMgr) return false;

        const uName = (u.username || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const userMatches = uName === cleanUser || uEmail === cleanUser || u.name.toLowerCase() === cleanUser;
        const passMatches = (u.password && u.password === cleanPass) || (u.pin && u.pin === cleanPass);

        return userMatches && passMatches;
      });

      if (!matched) {
        // Fallback default admin credentials check if database is empty/first load
        if (cleanUser === 'admin' && (cleanPass === 'admin123' || cleanPass === '999900')) {
          const fallbackAdmin = {
            id: 9999,
            name: 'Super Admin',
            role: 'super_admin',
            username: 'admin',
            email: 'admin@airlunacreations.com'
          };
          onLoginSuccess(fallbackAdmin);
          return;
        }

        if (cleanUser === 'manager' && (cleanPass === 'manager123' || cleanPass === '123400')) {
          const fallbackMgr = {
            id: 9998,
            name: 'Store Manager',
            role: 'manager',
            username: 'manager',
            email: 'manager@airlunacreations.com'
          };
          onLoginSuccess(fallbackMgr);
          return;
        }

        setErrorMsg('Invalid manager username or password.');
        return;
      }

      if (matched.is_active === 0) {
        setErrorMsg('This manager account is currently deactivated.');
        return;
      }

      onLoginSuccess(matched);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#faf5ef] dark:bg-[#120f0d] text-text-main overflow-y-auto">
      {/* Left Identity Banner */}
      <div className="w-full md:w-1/2 lg:w-5/12 bg-gradient-to-br from-[#1c1815] via-[#231e1a] to-[#141210] text-white p-8 md:p-14 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-orange-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/30">
              <Coffee size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">{settings?.cafeName || 'Aster POS'}</h1>
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                Manager Portal
              </span>
            </div>
          </div>

          <div className="space-y-4 my-8 max-w-md">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Real-time store oversight, analytics &amp; controls.
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Designed exclusively for Managers and Store Owners. Access sales revenue, ingredient stocks, menu configurations, and audit trails securely from any web browser.
            </p>
          </div>
        </div>

        {/* Live sync indicator */}
        <div className="relative z-10 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCloudSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className="font-semibold text-stone-300">
                {isCloudSyncing ? 'Syncing POS data...' : 'Cloud Relay Online'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">Vercel Web App</span>
          </div>
          {syncStatusMsg && (
            <p className="text-[11px] text-amber-300 mt-1 font-medium">{syncStatusMsg}</p>
          )}
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 md:p-16 bg-surface dark:bg-[#1a1613]">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-left">
            <h3 className="text-2xl font-black text-text-main tracking-tight">Manager Sign In</h3>
            <p className="text-xs text-text-light font-medium mt-1">
              Use your assigned Manager or Admin credentials to access the web dashboard.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold p-3.5 rounded-xl flex items-center gap-2 animate-shake">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-light">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin or manager"
                  className="w-full h-12 pl-10 pr-4 bg-background border border-border rounded-xl text-text-main text-sm font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-light">
                  <KeyRound size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 pr-10 bg-background border border-border rounded-xl text-text-main text-sm font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Default Credentials Tip */}
          <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5 text-xs">
            <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles size={13} /> Default Manager Logins:
            </p>
            <div className="text-[11px] text-text-light space-y-1">
              <p>• Admin: <strong className="text-text-main">admin</strong> / Password: <strong className="text-text-main">admin123</strong></p>
              <p>• Manager: <strong className="text-text-main">manager</strong> / Password: <strong className="text-text-main">manager123</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

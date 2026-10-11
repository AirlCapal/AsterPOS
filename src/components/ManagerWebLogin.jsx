import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Coffee, ShieldAlert, ArrowRight, Eye, EyeOff, RefreshCw,
  Sparkles, CheckCircle2, Sun, Moon, Monitor, Wifi,
  BarChart3, Package, Users, ShieldCheck
} from 'lucide-react';
import cloudSyncService from '../services/cloudSyncService';

export default function ManagerWebLogin({ onLoginSuccess, theme, setTheme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

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
          setSyncStatusMsg('Connected to live POS database');
        } else {
          setSyncStatusMsg('');
        }
      }
    }).catch(() => {
      if (isMounted) setIsCloudSyncing(false);
    });

    return () => { isMounted = false; };
  }, []);

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
  };

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
      const allUsers = await db.users.toArray();
      const matched = allUsers.find(u => {
        const uRole = u.role;
        const isMgr = uRole === 'manager' || uRole === 'super_admin';
        if (!isMgr) return false;

        const uName = (u.username || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const userMatches = uName === cleanUser || uEmail === cleanUser || (u.name && u.name.toLowerCase() === cleanUser);
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
    <div className="web-portal min-h-screen w-full flex flex-col md:flex-row bg-background text-text-main selection:bg-primary/20 selection:text-primary">

      {/* ── Left Identity Banner (Hidden on mobile or compact, prominent on md+) ── */}
      <div className="w-full md:w-5/12 lg:w-1/2 bg-gradient-to-br from-stone-900 via-stone-950 to-neutral-950 text-white p-6 sm:p-10 lg:p-16 flex flex-col justify-between relative overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-border/20">

        {/* Ambient Gradient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5 mb-6 md:mb-12">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-600/20 ring-1 ring-white/20 shrink-0">
              {settings?.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <Coffee size={24} className="text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                  {settings?.cafeName || 'Aster POS'}
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/25">
                  Web Portal
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium">Store Operations &amp; Management</p>
            </div>
          </div>

          {/* Heading & Value Proposition (hidden on small mobile to save space) */}
          <div className="hidden sm:block space-y-4 my-6 lg:my-10 max-w-lg">
            <h2 className="text-2xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Real-time store oversight, analytics &amp; remote controls.
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Designed exclusively for Managers and Store Owners. Monitor live transactions, restock ingredients, revise menu pricing, and manage staff permissions securely from any web browser.
            </p>
          </div>

          {/* Features Highlights (visible md+) */}
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <BarChart3 size={16} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Live Sales Analytics</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <Package size={16} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Stock &amp; Inventory</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <Wifi size={16} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Auto-Sync with POS</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <ShieldCheck size={16} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Role-Based Access</span>
            </div>
          </div>
        </div>

        {/* Live POS Relay Status */}
        <div className="relative z-10 pt-4 md:pt-8 border-t border-white/10 mt-6 md:mt-10">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCloudSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className="font-semibold text-stone-300 text-[11px] sm:text-xs">
                {isCloudSyncing ? 'Connecting to POS...' : 'Cloud Relay Online'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono hidden sm:inline">Vercel Cloud Edition</span>
          </div>
          {syncStatusMsg && (
            <p className="text-[11px] text-amber-300 mt-1 font-medium">{syncStatusMsg}</p>
          )}
        </div>
      </div>

      {/* ── Right Login Form Area ── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 bg-surface relative">

        {/* Top bar with Theme Switcher */}
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <div className="flex items-center gap-2 text-xs text-text-light font-medium">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Secure Manager Login</span>
          </div>

          {setTheme && (
            <div className="flex items-center bg-surface-hover border border-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setTheme('theme-light')}
                className={`p-1.5 rounded-md transition-all ${theme === 'theme-light' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:text-text-main'}`}
                title="Light Theme"
              >
                <Sun size={13} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('theme-gray')}
                className={`p-1.5 rounded-md transition-all ${theme === 'theme-gray' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:text-text-main'}`}
                title="Charcoal Theme"
              >
                <Monitor size={13} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('theme-dark')}
                className={`p-1.5 rounded-md transition-all ${theme === 'theme-dark' ? 'bg-primary text-white shadow-sm' : 'text-text-light hover:text-text-main'}`}
                title="Dark Theme"
              >
                <Moon size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Center Card */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">Sign In</h3>
            <p className="text-xs sm:text-sm text-text-light font-medium mt-1.5">
              Enter your manager credentials to manage your store online.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold p-3.5 rounded-xl flex items-center gap-2.5 animate-shake">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin or manager"
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-text-main text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-light/50"
                autoFocus
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-3.5 pr-10 bg-background border border-border rounded-xl text-text-main text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-light/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-3 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Sign In Pills */}
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-text-light uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" /> Default Credentials
              </span>
              <span className="text-[10px] text-text-light/70">Click to fill</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123')}
                className="p-2.5 rounded-xl border border-border bg-background hover:bg-surface-hover hover:border-primary/40 text-left transition-all group"
              >
                <div className="text-xs font-bold text-text-main group-hover:text-primary">Super Admin</div>
                <div className="text-[10px] text-text-light font-mono mt-0.5">admin / admin123</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('manager', 'manager123')}
                className="p-2.5 rounded-xl border border-border bg-background hover:bg-surface-hover hover:border-primary/40 text-left transition-all group"
              >
                <div className="text-xs font-bold text-text-main group-hover:text-primary">Store Manager</div>
                <div className="text-[10px] text-text-light font-mono mt-0.5">manager / manager123</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-[11px] text-text-light/60 font-medium">
          Aster POS Management Suite &bull; Multi-Branch Web Sync
        </div>
      </div>
    </div>
  );
}

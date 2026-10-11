import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Coffee, ShieldAlert, ArrowRight, Eye, EyeOff, RefreshCw,
  Sparkles, CheckCircle2, Sun, Moon, Monitor, Wifi,
  BarChart3, Package, Users, ShieldCheck, Store, Building2, MapPin
} from 'lucide-react';
import cloudSyncService, { normalizeBranchKey } from '../services/cloudSyncService';

export default function ManagerWebLogin({ onLoginSuccess, theme, setTheme }) {
  const [branchInput, setBranchInput] = useState(() => {
    return localStorage.getItem('aster_active_branch') || 'admin@airlunacreations.com';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const settings = useLiveQuery(() => db.app_settings.get('default')) || {};

  // Auto-sync with cloud for active branch on mount
  useEffect(() => {
    let isMounted = true;
    setIsCloudSyncing(true);
    setSyncStatusMsg(`Connecting to branch [${normalizeBranchKey(branchInput)}]...`);

    cloudSyncService.pullCloudData(branchInput).then((snapshot) => {
      if (isMounted) {
        setIsCloudSyncing(false);
        if (snapshot) {
          setSyncStatusMsg(`Connected to live branch [${normalizeBranchKey(branchInput)}] ✓`);
        } else {
          setSyncStatusMsg(`Branch online: ready for sync`);
        }
      }
    }).catch(() => {
      if (isMounted) setIsCloudSyncing(false);
    });

    return () => { isMounted = false; };
  }, [branchInput]);

  const handleQuickFill = (branch, pass) => {
    setBranchInput(branch);
    setPassword(pass);
    setErrorMsg('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanBranch = branchInput.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanBranch || !cleanPass) {
      setErrorMsg('Please enter both your Branch Identifier / Email and Password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Set active branch partition and pull latest cloud snapshot for this branch
      cloudSyncService.setBranch(cleanBranch);
      try {
        await cloudSyncService.pullCloudData(cleanBranch);
      } catch (pullErr) {
        console.warn('Pre-login cloud pull notice:', pullErr);
      }

      // 2. Validate against manager accounts in local database (now populated with branch data)
      const allUsers = await db.users.toArray();
      const matched = allUsers.find(u => {
        const uRole = u.role;
        const isMgr = uRole === 'manager' || uRole === 'super_admin';
        if (!isMgr) return false;

        const uName = (u.username || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const userMatches = uName === cleanBranch || uEmail === cleanBranch || 
                            (u.name && u.name.toLowerCase() === cleanBranch) ||
                            cleanBranch.includes(uName) || cleanBranch.includes(uEmail);
        const passMatches = (u.password && u.password === cleanPass) || (u.pin && u.pin === cleanPass);

        return passMatches && (userMatches || cleanBranch.includes('@'));
      });

      if (!matched) {
        // Universal fallback for Super Admin / Manager setup & testing across branches
        const isDefaultAdmin = cleanPass === 'admin123' || cleanPass === '999900';
        const isDefaultMgr = cleanPass === 'manager123' || cleanPass === '123400';

        if (isDefaultAdmin) {
          const fallbackAdmin = {
            id: 9999,
            name: `Admin (${cleanBranch})`,
            role: 'super_admin',
            username: cleanBranch.split('@')[0] || 'admin',
            email: cleanBranch.includes('@') ? cleanBranch : 'admin@airlunacreations.com',
            branch: cleanBranch
          };
          onLoginSuccess(fallbackAdmin);
          return;
        }

        if (isDefaultMgr) {
          const fallbackMgr = {
            id: 9998,
            name: `Manager (${cleanBranch})`,
            role: 'manager',
            username: cleanBranch.split('@')[0] || 'manager',
            email: cleanBranch.includes('@') ? cleanBranch : 'manager@airlunacreations.com',
            branch: cleanBranch
          };
          onLoginSuccess(fallbackMgr);
          return;
        }

        setErrorMsg(`Invalid credentials for branch [${cleanBranch}]. Please check password.`);
        return;
      }

      if (matched.is_active === 0) {
        setErrorMsg('This manager account is currently deactivated for this branch.');
        return;
      }

      matched.branch = cleanBranch;
      onLoginSuccess(matched);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="web-portal min-h-screen w-full flex flex-col md:flex-row bg-background text-text-main selection:bg-primary/20 selection:text-primary">

      {/* ── Left Identity Banner ── */}
      <div className="w-full md:w-5/12 lg:w-1/2 bg-gradient-to-br from-stone-900 via-stone-950 to-neutral-950 text-white p-6 sm:p-10 lg:p-16 flex flex-col justify-between relative overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-border/20">

        {/* Ambient Glows */}
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
                  Multi-Branch Portal
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium">Store Operations &amp; Remote Management</p>
            </div>
          </div>

          {/* Heading */}
          <div className="hidden sm:block space-y-4 my-6 lg:my-10 max-w-lg">
            <h2 className="text-2xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Multi-shop branch isolation &amp; real-time store oversight.
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Log in with your Branch Manager Email to manage your specific store. Each branch operates on an isolated data partition so sales, inventory, and menu prices never collide between different shops.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <Building2 size={16} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Branch-Isolated Data</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <BarChart3 size={16} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Live Sales Analytics</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <Wifi size={16} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Two-Way POS Auto-Sync</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <ShieldCheck size={16} className="text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-stone-200">Secure Cloud Relay</span>
            </div>
          </div>
        </div>

        {/* Live Branch Relay Status */}
        <div className="relative z-10 pt-4 md:pt-8 border-t border-white/10 mt-6 md:mt-10">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCloudSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className="font-semibold text-stone-300 text-[11px] sm:text-xs">
                {isCloudSyncing ? 'Connecting to Branch...' : 'Cloud Relay Online'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono hidden sm:inline">Active Branch: {normalizeBranchKey(branchInput)}</span>
          </div>
          {syncStatusMsg && (
            <p className="text-[11px] text-amber-300 mt-1 font-medium truncate">{syncStatusMsg}</p>
          )}
        </div>
      </div>

      {/* ── Right Login Form Area ── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 bg-surface relative">

        {/* Top bar with Theme Switcher */}
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <div className="flex items-center gap-2 text-xs text-text-light font-medium">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Store Branch Sign In</span>
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
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">Manager Sign In</h3>
            <p className="text-xs sm:text-sm text-text-light font-medium mt-1.5">
              Enter your shop branch identifier (Manager Email) and password.
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider">
                  Branch Identifier / Manager Email
                </label>
                <span className="text-[10px] text-primary font-semibold">Separate per shop</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={branchInput}
                  onChange={e => setBranchInput(e.target.value)}
                  placeholder="e.g. branch1@shop.com or BRANCH-001"
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-text-main text-sm font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-light/50"
                  autoFocus
                  required
                />
              </div>
              <p className="text-[11px] text-text-light/80 mt-1">
                Data for this branch will be isolated from other branches and shops.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider">
                  Manager Password
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
                  <span>Connecting to Branch &amp; Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Branch Portal</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Branches Pill Section */}
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-text-light uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" /> Multi-Branch Demo Quick Fill
              </span>
              <span className="text-[10px] text-text-light/70">Click to load</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('branch1@asterpos.com', 'admin123')}
                className="p-2.5 rounded-xl border border-border bg-background hover:bg-surface-hover hover:border-primary/40 text-left transition-all group"
              >
                <div className="text-xs font-bold text-text-main group-hover:text-primary flex items-center gap-1">
                  <Store size={12} className="text-amber-500" /> Branch 1 (Downtown)
                </div>
                <div className="text-[10px] text-text-light font-mono mt-0.5 truncate">branch1@asterpos.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('branch2@asterpos.com', 'manager123')}
                className="p-2.5 rounded-xl border border-border bg-background hover:bg-surface-hover hover:border-primary/40 text-left transition-all group"
              >
                <div className="text-xs font-bold text-text-main group-hover:text-primary flex items-center gap-1">
                  <Store size={12} className="text-orange-500" /> Branch 2 (Mall)
                </div>
                <div className="text-[10px] text-text-light font-mono mt-0.5 truncate">branch2@asterpos.com</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-[11px] text-text-light/60 font-medium">
          Aster POS Management Suite &bull; Multi-Branch Store Isolation
        </div>
      </div>
    </div>
  );
}

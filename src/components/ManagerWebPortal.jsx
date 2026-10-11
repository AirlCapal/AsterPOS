import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ROLE_LABELS, hasMinRole } from '../db';
import {
  BarChart3, Receipt, Package, UtensilsCrossed, Settings as SettingsIcon,
  Crown, User, LogOut, Sun, Moon, Monitor, RefreshCw, Coffee,
  ChevronRight, Shield, ShieldCheck, Clock, ExternalLink, Menu, X,
  ArrowUpRight, Wifi, WifiOff, Bell, ChevronDown, Upload, Download,
  TrendingUp, AlertTriangle, Store
} from 'lucide-react';
import cloudSyncService from '../services/cloudSyncService';

// Module Components
import Dashboard from './Dashboard';
import SalesHistory from './SalesHistory';
import InventoryManager from './InventoryManager';
import MenuManager from './MenuManager';
import SuperAdminSettings from './SuperAdminSettings';
import Settings from './Settings';
import AccountSettings from './AccountSettings';

export default function ManagerWebPortal({ currentUser, onLogout, theme, setTheme }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPushingToPos, setIsPushingToPos] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [contentKey, setContentKey] = useState(0); // for fade animation on tab switch
  const [cloudSyncState, setCloudSyncState] = useState({
    isSyncing: false,
    lastSyncTime: null,
    lastSyncStatus: 'idle',
    syncError: null,
    lastWebPushTime: null
  });

  const showToast = useCallback((msg, type = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setContentKey(prev => prev + 1);
    setSidebarOpen(false);
  }, []);

  const handlePushToPos = async () => {
    setIsPushingToPos(true);
    try {
      await cloudSyncService.pushWebChanges();
      showToast('Changes pushed to POS successfully. The tablet will sync when connected to the internet.', 'success');
    } catch (err) {
      showToast(`Push failed: ${err.message}`, 'error');
    } finally {
      setIsPushingToPos(false);
    }
  };

  const settings = useLiveQuery(() => db.app_settings.get('default')) || {};
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const ingredients = useLiveQuery(() => db.ingredients.toArray()) || [];
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Today's quick summary
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => o.timestamp >= todayStart.getTime() && o.status === 'completed');
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const lowStockCount = ingredients.filter(i => (i.currentStock || 0) <= (i.safetyThreshold || 0)).length;
  const currency = settings?.currency || '₱';

  // Subscribe to cloud sync
  useEffect(() => {
    const unsub = cloudSyncService.subscribe(setCloudSyncState);
    return unsub;
  }, []);

  // Format relative sync time
  const getRelativeSyncTime = () => {
    if (!cloudSyncState.lastSyncTime) return 'Never';
    const diffSec = Math.floor((Date.now() - cloudSyncState.lastSyncTime) / 1000);
    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(cloudSyncState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const navSections = [
    {
      title: 'Analytics',
      items: [
        { id: 'dashboard', label: 'Overview', icon: BarChart3, desc: 'Sales & performance' },
        { id: 'sales', label: 'Transactions', icon: Receipt, desc: 'Order history', badge: todayOrders.length > 0 ? todayOrders.length : null },
      ]
    },
    {
      title: 'Operations',
      items: [
        { id: 'inventory', label: 'Inventory', icon: Package, desc: 'Stock levels', badge: lowStockCount > 0 ? lowStockCount : null, badgeColor: 'danger' },
        { id: 'menu', label: 'Menu', icon: UtensilsCrossed, desc: 'Products & pricing', badge: products.length > 0 ? products.length : null },
      ]
    },
    {
      title: 'System',
      items: [
        ...(isSuperAdmin ? [{ id: 'admin', label: 'Administration', icon: Crown, desc: 'Staff & security' }] : []),
        { id: 'settings', label: 'Settings', icon: SettingsIcon, desc: 'Store config' },
        { id: 'account', label: 'Account', icon: User, desc: 'Profile & preferences' },
      ]
    }
  ];

  const allNavItems = navSections.flatMap(s => s.items);
  const activeNavItem = allNavItems.find(i => i.id === activeTab);
  const activeSection = navSections.find(s => s.items.some(i => i.id === activeTab));

  return (
    <div className="web-portal flex h-screen bg-background text-text-main overflow-hidden font-sans">

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[280px] bg-surface border-r border-border
        flex flex-col
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Sidebar Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {settings?.logoDataUrl ? (
              <img src={settings.logoDataUrl} alt="Logo" className="w-9 h-9 rounded-xl object-cover ring-2 ring-border" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-sm">
                <Coffee size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-sm tracking-tight truncate leading-tight text-text-main">
                {settings?.cafeName || 'Aster POS'}
              </h1>
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                Manager Portal
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-text-light hover:bg-surface-hover hover:text-text-main transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map((section, sIdx) => (
            <div key={sIdx}>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-light/60 px-3 mb-2">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group
                        ${isActive
                          ? 'bg-primary text-white shadow-md shadow-primary/20'
                          : 'text-text-light hover:text-text-main hover:bg-surface-hover'}
                      `}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive ? 'bg-white/15' : 'bg-surface-hover group-hover:bg-border'
                      }`}>
                        <Icon size={16} className={isActive ? 'text-white' : 'text-text-light group-hover:text-text-main'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-semibold leading-tight ${isActive ? 'text-white' : ''}`}>
                          {item.label}
                        </div>
                        <div className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'text-white/70' : 'text-text-light/70'}`}>
                          {item.desc}
                        </div>
                      </div>
                      {item.badge != null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                          item.badgeColor === 'danger'
                            ? (isActive ? 'bg-red-400/30 text-white' : 'bg-red-500/10 text-red-500')
                            : (isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary')
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-3 space-y-2.5 flex-shrink-0 bg-surface-hover/30">

          {/* Sync Status Compact */}
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                cloudSyncState.isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`} />
              <span className="text-[11px] font-medium text-text-light">
                {cloudSyncState.isSyncing ? 'Syncing...' : `Synced ${getRelativeSyncTime()}`}
              </span>
            </div>
            <button
              onClick={() => cloudSyncService.pullCloudData()}
              disabled={cloudSyncState.isSyncing}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-light hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              title="Refresh POS data"
            >
              <RefreshCw size={12} className={cloudSyncState.isSyncing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* User Profile */}
          <div className="flex items-center justify-between bg-surface rounded-xl border border-border px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {currentUser?.name?.charAt(0)?.toUpperCase() || 'M'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-main truncate leading-tight">{currentUser?.name}</p>
                <p className="text-[10px] text-text-light font-medium truncate">
                  {ROLE_LABELS[currentUser?.role] || 'Manager'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-light hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">

        {/* Top Bar */}
        <header className="h-14 bg-surface border-b border-border px-4 lg:px-6 flex items-center justify-between flex-shrink-0 z-10">

          {/* Left: Hamburger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg bg-surface-hover border border-border flex items-center justify-center text-text-main hover:bg-border transition-colors flex-shrink-0"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium text-text-light hidden sm:inline">
                {activeSection?.title || 'Dashboard'}
              </span>
              <ChevronRight size={12} className="text-text-light/50 hidden sm:block flex-shrink-0" />
              <h2 className="text-sm font-bold text-text-main truncate">
                {activeNavItem?.label || 'Overview'}
              </h2>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">

            {/* Live Revenue Pill — desktop only */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg">
              <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                {currency}{todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 font-medium">
                today
              </span>
            </div>

            {/* Low Stock Alert — desktop only */}
            {lowStockCount > 0 && (
              <button
                onClick={() => handleTabChange('inventory')}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/8 border border-red-500/15 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/15 transition-colors"
              >
                <AlertTriangle size={13} />
                <span className="text-[11px] font-semibold">{lowStockCount} low stock</span>
              </button>
            )}

            {/* Push to POS */}
            <button
              onClick={handlePushToPos}
              disabled={isPushingToPos}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-[11px] font-bold transition-all active:scale-[0.97] disabled:opacity-50 shadow-sm"
              title="Push changes to POS tablet"
            >
              <Upload size={13} className={isPushingToPos ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isPushingToPos ? 'Pushing...' : 'Push to POS'}</span>
            </button>

            {/* Pull Sales */}
            <button
              onClick={() => cloudSyncService.pullCloudData()}
              disabled={cloudSyncState.isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-hover hover:bg-border text-text-main border border-border rounded-lg text-[11px] font-semibold transition-all"
              title="Fetch latest sales from POS"
            >
              <Download size={13} className={cloudSyncState.isSyncing ? 'animate-spin text-amber-500' : ''} />
              <span className="hidden md:inline">{cloudSyncState.isSyncing ? 'Syncing...' : 'Fetch Sales'}</span>
            </button>

            {/* Theme Toggle */}
            <div className="hidden sm:flex items-center bg-surface-hover border border-border rounded-lg p-0.5">
              {[
                { key: 'theme-light', icon: Sun, title: 'Light' },
                { key: 'theme-gray', icon: Monitor, title: 'Charcoal' },
                { key: 'theme-dark', icon: Moon, title: 'Dark' },
              ].map(t => {
                const ThemeIcon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className={`p-1.5 rounded-md transition-all ${
                      theme === t.key
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-light hover:text-text-main'
                    }`}
                    title={t.title}
                  >
                    <ThemeIcon size={13} />
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 min-h-0 flex flex-col bg-background relative overflow-hidden">

          {/* Toast */}
          {toastMsg && (
            <div className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2.5 animate-slide-in-right ${
              toastType === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}>
              {toastType === 'error' ? <AlertTriangle size={14} /> : <RefreshCw size={14} />}
              <span className="leading-snug">{toastMsg}</span>
              <button onClick={() => setToastMsg('')} className="ml-auto w-5 h-5 rounded flex items-center justify-center hover:bg-white/20 flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Mobile Revenue Bar (visible on small screens only) */}
          <div className="xl:hidden border-b border-border bg-surface px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-text-main">
                  {currency}{todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[10px] text-text-light font-medium">
                {todayOrders.length} {todayOrders.length === 1 ? 'sale' : 'sales'} today
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${cloudSyncState.isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[10px] text-text-light font-medium">
                {cloudSyncState.isSyncing ? 'Syncing' : getRelativeSyncTime()}
              </span>
            </div>
          </div>

          {/* Page Content: full height flex container so views with h-full and inner lists scroll properly across all screen dimensions */}
          <div key={contentKey} className="flex-1 min-h-0 flex flex-col animate-fade-up overflow-hidden">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'sales' && <SalesHistory currentUser={currentUser} />}
            {activeTab === 'inventory' && <InventoryManager currentUser={currentUser} />}
            {activeTab === 'menu' && <MenuManager />}
            {activeTab === 'admin' && isSuperAdmin && <SuperAdminSettings currentUser={currentUser} />}
            {activeTab === 'settings' && <Settings currentUser={currentUser} />}
            {activeTab === 'account' && <AccountSettings currentUser={currentUser} />}
          </div>
        </main>
      </div>
    </div>
  );
}

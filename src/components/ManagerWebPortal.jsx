import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ROLE_LABELS, hasMinRole } from '../db';
import {
  BarChart3, Receipt, Package, UtensilsCrossed, Settings as SettingsIcon,
  Crown, User, LogOut, Sun, Moon, Monitor, RefreshCw, Coffee,
  ChevronRight, Shield, ShieldCheck, Clock, ExternalLink, Menu, X, ArrowLeftRight
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

export default function ManagerWebPortal({ currentUser, onLogout, theme, setTheme, onSwitchToPos }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPushingToPos, setIsPushingToPos] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [cloudSyncState, setCloudSyncState] = useState({
    isSyncing: false,
    lastSyncTime: null,
    lastSyncStatus: 'idle',
    syncError: null,
    lastWebPushTime: null
  });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handlePushToPos = async () => {
    setIsPushingToPos(true);
    try {
      await cloudSyncService.pushWebChanges();
      showToast('✓ Successfully pushed to POS! Once connected to Wi-Fi, the POS app will automatically apply your edits.');
    } catch (err) {
      showToast(`Push failed: ${err.message}`);
    } finally {
      setIsPushingToPos(false);
    }
  };

  const settings = useLiveQuery(() => db.app_settings.get('default')) || {};
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Calculate today's quick summary
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => o.timestamp >= todayStart.getTime() && o.status === 'completed');
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Subscribe to cloud sync updates
  useEffect(() => {
    const unsub = cloudSyncService.subscribe(setCloudSyncState);
    return unsub;
  }, []);

  // Format relative sync time
  const getRelativeSyncTime = () => {
    if (!cloudSyncState.lastSyncTime) return 'Never synced';
    const diffSec = Math.floor((Date.now() - cloudSyncState.lastSyncTime) / 1000);
    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(cloudSyncState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview & Analytics', icon: BarChart3, badge: null },
    { id: 'sales', label: 'Orders & Receipts', icon: Receipt, badge: todayOrders.length > 0 ? `${todayOrders.length}` : null },
    { id: 'inventory', label: 'Inventory & Stocks', icon: Package, badge: null },
    { id: 'menu', label: 'Menu & Catalog', icon: UtensilsCrossed, badge: null },
    ...(isSuperAdmin ? [{ id: 'admin', label: 'Staff & Security', icon: Crown, badge: 'Admin' }] : []),
    { id: 'settings', label: 'Store Settings', icon: SettingsIcon, badge: null },
    { id: 'account', label: 'My Account', icon: User, badge: null },
  ];

  return (
    <div className="flex h-screen bg-[#faf7f2] dark:bg-[#110e0c] text-text-main overflow-hidden font-sans">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop / Collapsible Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-surface dark:bg-[#171310] border-r border-border
        flex flex-col justify-between
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-2xl lg:shadow-none
      `}>
        {/* Sidebar Header */}
        <div className="p-5 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow-md" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                  <Coffee size={20} />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-bold text-base tracking-tight truncate leading-tight">
                  {settings?.cafeName || 'Aster POS'}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Manager Portal
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-text-light hover:bg-surface-hover"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-light/70 px-3 mb-2">
            Management &amp; Controls
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all
                  ${isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/25 font-semibold' 
                    : 'text-text-light hover:text-text-main hover:bg-surface-hover'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'text-text-light'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: Cloud Sync Widget & User Profile */}
        <div className="p-4 border-t border-border/80 space-y-3 bg-surface-hover/30">
          {/* Cloud Sync Status Box */}
          <div className="p-3 bg-surface rounded-xl border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${cloudSyncState.isSyncing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-xs font-semibold text-text-main">
                  {cloudSyncState.isSyncing ? 'Pulling POS Data...' : 'Live POS Relay'}
                </span>
              </div>
              <button
                onClick={() => cloudSyncService.pullCloudData()}
                disabled={cloudSyncState.isSyncing}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-light hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                title="Sync latest POS transactions now"
              >
                <RefreshCw size={13} className={cloudSyncState.isSyncing ? 'animate-spin text-amber-500' : ''} />
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-light">
              <span>Last update:</span>
              <span className="font-medium text-text-main">{getRelativeSyncTime()}</span>
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-primary text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {currentUser?.name?.charAt(0) || 'M'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-text-main truncate leading-tight">{currentUser?.name}</p>
                <p className="text-[10px] text-text-light font-medium uppercase tracking-wide truncate">
                  {ROLE_LABELS[currentUser?.role] || 'Manager'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Switch to POS Mode link */}
          {onSwitchToPos && (
            <button
              onClick={onSwitchToPos}
              className="w-full text-center text-[10px] font-semibold text-text-light hover:text-primary transition-colors flex items-center justify-center gap-1 pt-1"
            >
              <ArrowLeftRight size={11} /> Switch to Cashier POS Mode
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Executive Top Bar */}
        <header className="h-16 bg-surface dark:bg-[#171310] border-b border-border px-4 sm:px-6 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl bg-surface-hover border border-border flex items-center justify-center text-text-main"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight flex items-center gap-2">
                {navItems.find(i => i.id === activeTab)?.label || 'Overview'}
              </h2>
              <p className="text-[11px] text-text-light hidden sm:block">
                Store performance &amp; remote controls synced live from POS
              </p>
            </div>
          </div>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Live Sales Pill */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Today: {settings?.currency || '₱'}{todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">
                ({todayOrders.length} {todayOrders.length === 1 ? 'sale' : 'sales'})
              </span>
            </div>

            {/* Push Changes to POS Button */}
            <button
              onClick={handlePushToPos}
              disabled={isPushingToPos}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 active:scale-95 disabled:opacity-50"
              title="Transmit current menu, prices, stocks & staff to the POS app"
            >
              <RefreshCw size={14} className={isPushingToPos ? 'animate-spin' : ''} />
              <span>{isPushingToPos ? 'Pushing to POS...' : 'Push Edits to POS'}</span>
            </button>

            {/* Quick Manual Sync Button */}
            <button
              onClick={() => cloudSyncService.pullCloudData()}
              disabled={cloudSyncState.isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover hover:bg-border text-text-main border border-border rounded-xl text-xs font-semibold transition-all"
              title="Refresh live sales data from POS"
            >
              <RefreshCw size={14} className={cloudSyncState.isSyncing ? 'animate-spin text-amber-500' : ''} />
              <span className="hidden sm:inline">Fetch Sales</span>
            </button>

            {/* Theme Toggle */}
            <div className="flex items-center bg-surface-hover border border-border rounded-xl p-0.5">
              <button 
                onClick={() => setTheme('theme-light')} 
                className={`p-1.5 rounded-lg transition-colors ${theme === 'theme-light' ? 'bg-primary text-white shadow' : 'text-text-light hover:text-text-main'}`}
                title="Light Theme"
              >
                <Sun size={15} />
              </button>
              <button 
                onClick={() => setTheme('theme-gray')} 
                className={`p-1.5 rounded-lg transition-colors ${theme === 'theme-gray' ? 'bg-primary text-white shadow' : 'text-text-light hover:text-text-main'}`}
                title="Charcoal Theme"
              >
                <Monitor size={15} />
              </button>
              <button 
                onClick={() => setTheme('theme-dark')} 
                className={`p-1.5 rounded-lg transition-colors ${theme === 'theme-dark' ? 'bg-primary text-white shadow' : 'text-text-light hover:text-text-main'}`}
                title="Dark Theme"
              >
                <Moon size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background relative">
          {/* Floating Toast Notification */}
          {toastMsg && (
            <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
              <span>{toastMsg}</span>
            </div>
          )}

          <div className="max-w-7xl mx-auto h-full">
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

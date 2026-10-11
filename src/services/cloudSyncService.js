/**
 * CloudSyncService — Robust Multi-Branch Synchronization between Aster POS and Manager Web Portal.
 * 
 * Supports complete data isolation for different shops / branches based on:
 *   - Manager Email (e.g. manager@branch1.com)
 *   - Branch / Store Identifier (e.g. BRANCH-001, SHOP-NORTH)
 * 
 * Two-Way Auto-Sync:
 *   1. POS -> Cloud Relay: Orders, revenue, stock levels transmitted automatically when online.
 *   2. Web -> POS: Remote manager edits (menu, prices, inventory, staff) pushed to the cloud
 *      and applied to the specific branch POS tablet when connected to the internet.
 */

import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { db } from '../db';
import { DEFAULT_GOOGLE_SCRIPT_URL } from './OtpService';

export function normalizeBranchKey(input) {
  if (!input) return 'default';
  const clean = String(input).toLowerCase().trim();
  // Safe alphanumeric, @, ., -, _
  const normalized = clean.replace(/[^a-z0-9_@.-]/g, '_');
  return normalized || 'default';
}

class CloudSyncService {
  constructor() {
    this.isSyncing = false;
    this.syncTimer = null;
    this.listeners = new Set();
    this.lastSyncTime = null;
    this.lastSyncStatus = 'idle'; // 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
    this.syncError = null;
    this.networkListener = null;
    this.lastWebPushTime = null;
    this.currentBranch = null;
  }

  async init() {
    if (typeof window === 'undefined') return;

    // Load active branch from localStorage or settings
    await this.resolveActiveBranch();

    // 1. Android / Capacitor Network listener
    try {
      this.networkListener = await Network.addListener('networkStatusChange', async (status) => {
        if (status.connected) {
          await this.syncAll();
        } else {
          this.lastSyncStatus = 'offline';
          this.notify();
        }
      });

      const initialStatus = await Network.getStatus();
      if (initialStatus?.connected) {
        this.syncAll();
      }
    } catch (e) {
      // Capacitor Network not available (e.g. standard browser)
    }

    // 2. Browser online / offline listeners
    window.addEventListener('online', () => {
      this.syncAll();
    });
    window.addEventListener('offline', () => {
      this.lastSyncStatus = 'offline';
      this.notify();
    });

    // 3. Periodic auto-sync every 20 seconds
    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.syncAll();
      }, 20000);
    }
  }

  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.networkListener) {
      try { this.networkListener.remove(); } catch {}
      this.networkListener = null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastSyncStatus: this.lastSyncStatus,
      syncError: this.syncError,
      lastWebPushTime: this.lastWebPushTime,
      currentBranch: this.currentBranch || 'default'
    };
    this.listeners.forEach(cb => {
      try { cb(state); } catch {}
    });
  }

  /**
   * Resolves the active branch identifier
   */
  async resolveActiveBranch() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aster_active_branch');
      if (saved) {
        this.currentBranch = normalizeBranchKey(saved);
        return this.currentBranch;
      }
    }

    try {
      const settings = await db.app_settings.get('default');
      const fromSettings = settings?.branchIdentifier || settings?.managerEmail;
      if (fromSettings) {
        this.currentBranch = normalizeBranchKey(fromSettings);
        return this.currentBranch;
      }
    } catch {}

    this.currentBranch = 'default';
    return this.currentBranch;
  }

  getBranchKey() {
    if (this.currentBranch) return this.currentBranch;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aster_active_branch');
      if (saved) {
        this.currentBranch = normalizeBranchKey(saved);
        return this.currentBranch;
      }
    }
    return 'default';
  }

  setBranch(branchKey) {
    const normalized = normalizeBranchKey(branchKey);
    this.currentBranch = normalized;
    if (typeof window !== 'undefined') {
      localStorage.setItem('aster_active_branch', normalized);
    }
    this.notify();
    return normalized;
  }

  /**
   * Resolves endpoint URLs with local /api/sync relay fallback
   */
  async getSyncEndpoints() {
    const settings = await db.app_settings.get('default');
    const customUrl = settings?.googleAppsScriptUrl?.trim();
    const isWeb = typeof window !== 'undefined' && !Capacitor.isNativePlatform();

    const endpoints = [];

    // On web, try on-origin /api/sync first to bypass browser CORS
    if (isWeb && typeof window !== 'undefined') {
      endpoints.push('/api/sync');
    }

    // Then Google Apps Script URL
    if (customUrl) {
      endpoints.push(customUrl);
    } else {
      endpoints.push(DEFAULT_GOOGLE_SCRIPT_URL);
    }

    return endpoints;
  }

  /**
   * Background unified sync
   */
  async syncAll() {
    if (this.isSyncing) return;
    const isWeb = typeof window !== 'undefined' && localStorage.getItem('aster_portal_mode') === 'manager_web';

    if (isWeb) {
      await this.pullCloudData();
    } else {
      await this.checkAndApplyManagerUpdates();
      await this.triggerAutoSync();
    }
  }

  /**
   * Builds the latest state payload partitioned by branch
   */
  async buildCloudPayload(source = 'POS') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const [todayOrders, ingredients, categories, products, auditLogs, appSettings, users] = await Promise.all([
      db.orders.where('timestamp').aboveOrEqual(todayMs).toArray(),
      db.ingredients.toArray(),
      db.categories.toArray(),
      db.products.toArray(),
      db.audit_logs.where('timestamp').aboveOrEqual(todayMs).reverse().limit(50).toArray(),
      db.app_settings.toArray(),
      db.users.toArray()
    ]);

    const completed = todayOrders.filter(o => o.status === 'completed');
    const voided = todayOrders.filter(o => o.status === 'voided');
    const totalRevenue = completed.reduce((sum, o) => sum + (o.total || 0), 0);
    const cashSales = completed.filter(o => o.paymentMethod === 'Cash').reduce((sum, o) => sum + (o.total || 0), 0);

    const branch = this.getBranchKey();
    const settingsObj = appSettings[0] || {};

    return {
      action: 'PUSH_SYNC_DATA',
      branch: branch,
      branchName: settingsObj.cafeName || 'Aster Store',
      source: source,
      timestamp: Date.now(),
      summary: {
        totalRevenue,
        totalOrders: completed.length,
        cashSales,
        digitalSales: totalRevenue - cashSales,
        voidCount: voided.length,
        avgOrderValue: completed.length > 0 ? totalRevenue / completed.length : 0
      },
      orders: todayOrders.slice(-100).reverse(),
      ingredients: ingredients.map(i => ({
        id: i.id,
        name: i.name,
        currentStock: i.currentStock,
        safetyThreshold: i.safetyThreshold,
        unit: i.unit,
        costPerUnit: i.costPerUnit
      })),
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        isAvailable: p.isAvailable
      })),
      categories,
      auditLogs,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username || '',
        password: u.password || '',
        pin: u.pin,
        role: u.role,
        is_active: u.is_active,
        email: u.email,
        phone_number: u.phone_number,
        otp_delivery_preference: u.otp_delivery_preference
      })),
      settings: settingsObj
    };
  }

  /**
   * POS -> CLOUD: Transmits cashier orders and shift metrics under this branch
   */
  async triggerAutoSync() {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.lastSyncStatus = 'offline';
      this.notify();
      return;
    }

    try {
      this.isSyncing = true;
      this.lastSyncStatus = 'syncing';
      this.syncError = null;
      this.notify();

      const branch = this.getBranchKey();
      const payload = await this.buildCloudPayload('POS');
      const endpoints = await this.getSyncEndpoints();

      let success = false;
      let lastErr = null;

      for (const url of endpoints) {
        try {
          const fetchUrl = `${url}?branch=${encodeURIComponent(branch)}`;
          const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            success = true;
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (success) {
        this.lastSyncTime = Date.now();
        this.lastSyncStatus = 'synced';
        this.syncError = null;
      } else {
        throw lastErr || new Error('All sync endpoints failed');
      }
    } catch (err) {
      console.warn('[CloudSyncService] POS sync push error:', err);
      this.lastSyncStatus = 'error';
      this.syncError = err.message;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * WEB -> CLOUD: Pushes manager modifications (products, prices, stocks, settings)
   */
  async pushWebChanges() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('You are currently offline. Connect to internet to push edits to POS.');
    }

    try {
      this.isSyncing = true;
      this.lastSyncStatus = 'syncing';
      this.notify();

      const branch = this.getBranchKey();
      const payload = await this.buildCloudPayload('WEB');
      payload.action = 'PUSH_WEB_UPDATE';

      const endpoints = await this.getSyncEndpoints();
      let success = false;
      let lastErr = null;

      for (const url of endpoints) {
        try {
          const fetchUrl = `${url}?branch=${encodeURIComponent(branch)}`;
          const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            success = true;
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (success) {
        this.lastWebPushTime = Date.now();
        this.lastSyncTime = Date.now();
        this.lastSyncStatus = 'synced';
        this.syncError = null;
        return { success: true, branch, timestamp: this.lastWebPushTime };
      } else {
        throw lastErr || new Error('Failed to push changes to cloud relay');
      }
    } catch (err) {
      console.warn('[CloudSyncService] Web push error:', err);
      this.lastSyncStatus = 'error';
      this.syncError = err.message;
      throw err;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * POS -> CLOUD: Pulls manager web updates for THIS branch
   */
  async checkAndApplyManagerUpdates() {
    try {
      const branch = this.getBranchKey();
      const endpoints = await this.getSyncEndpoints();

      let remoteData = null;

      for (const url of endpoints) {
        try {
          const fetchUrl = `${url}?action=GET_SYNC_DATA&branch=${encodeURIComponent(branch)}&t=${Date.now()}`;
          const res = await fetch(fetchUrl);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && json.snapshot) {
              remoteData = json;
              break;
            }
          }
        } catch {}
      }

      if (!remoteData) return false;

      const isFromWeb = remoteData.source === 'WEB';
      const mutationTs = remoteData.mutationTimestamp || remoteData.snapshot.timestamp || 0;
      const lastAppliedTs = parseInt(localStorage.getItem(`last_applied_web_ts_${branch}`) || '0', 10);

      if (isFromWeb && mutationTs > lastAppliedTs) {
        console.log(`[CloudSyncService] Manager Web updates detected for branch [${branch}]. Applying...`);
        const s = remoteData.snapshot;

        await db.transaction('rw', [db.products, db.ingredients, db.categories, db.users, db.app_settings], async () => {
          if (Array.isArray(s.products)) {
            const remoteProductIds = new Set(s.products.map(p => p.id));
            const localProducts = await db.products.toArray();
            for (const lp of localProducts) {
              if (!remoteProductIds.has(lp.id)) await db.products.delete(lp.id);
            }
            for (const p of s.products) await db.products.put(p);
          }

          if (Array.isArray(s.categories)) {
            const remoteCatIds = new Set(s.categories.map(c => c.id));
            const localCats = await db.categories.toArray();
            for (const lc of localCats) {
              if (!remoteCatIds.has(lc.id)) await db.categories.delete(lc.id);
            }
            for (const c of s.categories) await db.categories.put(c);
          }

          if (Array.isArray(s.ingredients)) {
            for (const ing of s.ingredients) await db.ingredients.put(ing);
          }

          if (Array.isArray(s.users)) {
            for (const u of s.users) await db.users.put(u);
          }

          if (s.settings && typeof s.settings === 'object') {
            await db.app_settings.put({ ...s.settings, id: 'default' });
          }
        });

        localStorage.setItem(`last_applied_web_ts_${branch}`, mutationTs.toString());
        this.lastSyncTime = Date.now();
        this.lastSyncStatus = 'synced';
        this.notify();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('manager-remote-update-applied', {
            detail: { branch, timestamp: mutationTs }
          }));
        }
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[CloudSyncService] checkAndApplyManagerUpdates warning:', err);
      return false;
    }
  }

  /**
   * CLOUD -> WEB: Pulls latest data into Manager Web Portal for the active branch
   */
  async pullCloudData(specificBranch = null) {
    try {
      this.isSyncing = true;
      this.lastSyncStatus = 'syncing';
      this.notify();

      const branch = specificBranch ? normalizeBranchKey(specificBranch) : this.getBranchKey();
      const endpoints = await this.getSyncEndpoints();

      let remoteSnapshot = null;
      let lastErr = null;

      for (const url of endpoints) {
        try {
          const fetchUrl = `${url}?action=GET_SYNC_DATA&branch=${encodeURIComponent(branch)}&t=${Date.now()}`;
          const res = await fetch(fetchUrl);
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.snapshot) {
              remoteSnapshot = data.snapshot;
              break;
            }
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (remoteSnapshot) {
        const s = remoteSnapshot;

        await db.transaction('rw', [db.products, db.ingredients, db.orders, db.audit_logs, db.categories, db.users], async () => {
          if (s.products?.length) {
            for (const p of s.products) await db.products.put(p);
          }
          if (s.ingredients?.length) {
            for (const ing of s.ingredients) await db.ingredients.put(ing);
          }
          if (s.orders?.length) {
            for (const ord of s.orders) await db.orders.put(ord);
          }
          if (s.categories?.length) {
            for (const cat of s.categories) await db.categories.put(cat);
          }
          if (s.auditLogs?.length) {
            for (const audit of s.auditLogs) await db.audit_logs.put(audit);
          }
          if (s.users?.length) {
            for (const u of s.users) await db.users.put(u);
          }
        });

        this.lastSyncTime = Date.now();
        this.lastSyncStatus = 'synced';
        this.syncError = null;
        return s;
      }

      // No snapshot found for this branch yet
      this.lastSyncStatus = 'idle';
      return null;
    } catch (err) {
      console.warn('[CloudSyncService] Pull error:', err);
      this.lastSyncStatus = 'error';
      this.syncError = err.message;
      return null;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Diagnostic Test Connection tool
   */
  async testConnection(customUrl = null, customBranch = null) {
    const branch = customBranch ? normalizeBranchKey(customBranch) : this.getBranchKey();
    const testUrl = (customUrl || (await this.getSyncEndpoints())[0]).trim();

    try {
      const pingUrl = `${testUrl}?action=TEST_CONNECTION&branch=${encodeURIComponent(branch)}&t=${Date.now()}`;
      const res = await fetch(pingUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return {
        ok: true,
        branch,
        url: testUrl,
        message: data.message || `Connected to Cloud Relay for branch [${branch}] ✓`
      };
    } catch (err) {
      return {
        ok: false,
        branch,
        url: testUrl,
        message: err.message || 'Connection failed'
      };
    }
  }
}

export const cloudSyncService = new CloudSyncService();
export default cloudSyncService;

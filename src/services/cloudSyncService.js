/**
 * CloudSyncService — Robust Two-Way Automatic Synchronization between Aster POS and Manager Web Portal.
 * 
 * Works 100% free via Google Apps Script (Web App endpoint):
 *   1. POS -> Website: When the POS tablet is online, completed sales, register summaries,
 *      and inventory deductions are pushed to the Cloud Relay so managers see live data.
 *   2. Website -> POS: When managers edit products, prices, categories, inventory stock,
 *      staff accounts, or store settings from the website, changes are pushed to the Cloud Relay.
 *      As soon as the POS tablet has an internet connection (via Wi-Fi or mobile data), it
 *      automatically pulls and applies the manager's edits into its local database in real time!
 */

import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { db } from '../db';
import { DEFAULT_GOOGLE_SCRIPT_URL } from './OtpService';

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
    this.isWebAutoPublishing = false;
  }

  async init() {
    if (typeof window === 'undefined') return;

    // 1. Android / Capacitor Wi-Fi & Network change listener
    try {
      this.networkListener = await Network.addListener('networkStatusChange', async (status) => {
        console.log('[CloudSyncService] Wi-Fi / Network status changed:', status);
        if (status.connected) {
          // As soon as POS connects to Wi-Fi, pull any manager web edits and transmit POS data!
          await this.syncAll();
        } else {
          this.lastSyncStatus = 'offline';
          this.notify();
        }
      });

      // Immediate check on startup
      const initialStatus = await Network.getStatus();
      if (initialStatus?.connected) {
        this.syncAll();
      }
    } catch (e) {
      console.warn('[CloudSyncService] Capacitor Network listener setup notice:', e);
    }

    // 2. Web browser online / offline listeners
    window.addEventListener('online', () => {
      this.syncAll();
    });
    window.addEventListener('offline', () => {
      this.lastSyncStatus = 'offline';
      this.notify();
    });

    // 3. Background periodic sync every 15 seconds
    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.syncAll();
      }, 15000);
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
      lastWebPushTime: this.lastWebPushTime
    };
    this.listeners.forEach(cb => {
      try { cb(state); } catch {}
    });
  }

  /**
   * Unified sync: pulls remote updates and pushes local data depending on context
   */
  async syncAll() {
    if (this.isSyncing) return;
    const isWeb = typeof window !== 'undefined' && localStorage.getItem('aster_portal_mode') === 'manager_web';
    
    if (isWeb) {
      // Manager Website: pull POS sales data
      await this.pullCloudData();
    } else {
      // Cashier POS Tablet: check for Manager edits first, then push POS sales
      await this.checkAndApplyManagerUpdates();
      await this.triggerAutoSync();
    }
  }

  /**
   * Builds the latest state payload to transmit from POS to Cloud Relay
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

    return {
      action: 'PUSH_SYNC_DATA',
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
      settings: appSettings[0] || {}
    };
  }

  /**
   * Pushes data from POS App to Google Apps Script cloud relay
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

      const settings = await db.app_settings.get('default');
      const scriptUrl = settings?.googleAppsScriptUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
      if (!scriptUrl) {
        this.isSyncing = false;
        this.lastSyncStatus = 'idle';
        this.notify();
        return;
      }

      const payload = await this.buildCloudPayload('POS');

      // Transmit to Google Apps Script
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      this.lastSyncTime = Date.now();
      this.lastSyncStatus = 'synced';
    } catch (err) {
      console.warn('[CloudSyncService] Sync push error:', err);
      this.lastSyncStatus = 'error';
      this.syncError = err.message;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * MANAGER WEBSITE -> CLOUD: Pushes edits made by Manager (menu, prices, inventory, staff, settings)
   */
  async pushWebChanges() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('You are currently offline. Connect to internet to push edits to POS.');
    }

    try {
      this.isSyncing = true;
      this.lastSyncStatus = 'syncing';
      this.notify();

      const settings = await db.app_settings.get('default');
      const scriptUrl = settings?.googleAppsScriptUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
      if (!scriptUrl) throw new Error('Google Apps Script URL is not configured');

      const payload = await this.buildCloudPayload('WEB');
      payload.action = 'PUSH_WEB_UPDATE';

      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      this.lastWebPushTime = Date.now();
      this.lastSyncTime = Date.now();
      this.lastSyncStatus = 'synced';
      return { success: true, timestamp: this.lastWebPushTime };
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
   * POS TABLET -> CLOUD: Checks if the Manager edited any data from the website,
   * and automatically applies the updates directly into the POS local database!
   */
  async checkAndApplyManagerUpdates() {
    try {
      const settings = await db.app_settings.get('default');
      const scriptUrl = settings?.googleAppsScriptUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
      if (!scriptUrl) return false;

      const res = await fetch(`${scriptUrl}?action=GET_SYNC_DATA&t=${Date.now()}`);
      if (!res.ok) return false;
      const data = await res.json();

      if (!data || !data.success || !data.snapshot) return false;

      // Only apply if the snapshot came from WEB and is newer than last applied
      const isFromWeb = data.source === 'WEB';
      const mutationTs = data.mutationTimestamp || data.snapshot.timestamp || 0;
      const lastAppliedTs = parseInt(localStorage.getItem('last_applied_web_ts') || '0', 10);

      if (isFromWeb && mutationTs > lastAppliedTs) {
        console.log('[CloudSyncService] New updates from Manager Web detected! Applying to POS database...');
        const s = data.snapshot;

        await db.transaction('rw', [db.products, db.ingredients, db.categories, db.users, db.app_settings], async () => {
          // 1. Sync Products & Prices
          if (Array.isArray(s.products)) {
            const remoteProductIds = new Set(s.products.map(p => p.id));
            const localProducts = await db.products.toArray();
            for (const lp of localProducts) {
              if (!remoteProductIds.has(lp.id)) {
                await db.products.delete(lp.id);
              }
            }
            for (const p of s.products) {
              await db.products.put(p);
            }
          }

          // 2. Sync Categories
          if (Array.isArray(s.categories)) {
            const remoteCatIds = new Set(s.categories.map(c => c.id));
            const localCats = await db.categories.toArray();
            for (const lc of localCats) {
              if (!remoteCatIds.has(lc.id)) {
                await db.categories.delete(lc.id);
              }
            }
            for (const c of s.categories) {
              await db.categories.put(c);
            }
          }

          // 3. Sync Ingredients & Stocks
          if (Array.isArray(s.ingredients)) {
            for (const ing of s.ingredients) {
              await db.ingredients.put(ing);
            }
          }

          // 4. Sync Users / Staff (PINs, Web Passwords, Roles)
          if (Array.isArray(s.users)) {
            for (const u of s.users) {
              await db.users.put(u);
            }
          }

          // 5. Sync Settings
          if (s.settings && typeof s.settings === 'object') {
            await db.app_settings.put({ ...s.settings, id: 'default' });
          }
        });

        localStorage.setItem('last_applied_web_ts', mutationTs.toString());
        this.lastSyncTime = Date.now();
        this.lastSyncStatus = 'synced';
        this.notify();

        // Dispatch notification event for the POS user interface
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('manager-remote-update-applied', {
            detail: { timestamp: mutationTs }
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
   * Pulls data into Manager Web Portal from Google Apps Script cloud relay
   */
  async pullCloudData() {
    try {
      this.isSyncing = true;
      this.lastSyncStatus = 'syncing';
      this.notify();

      const settings = await db.app_settings.get('default');
      const scriptUrl = settings?.googleAppsScriptUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
      if (!scriptUrl) return null;

      // GET request to fetch cloud snapshot
      const res = await fetch(`${scriptUrl}?action=GET_SYNC_DATA&t=${Date.now()}`);
      if (!res.ok) throw new Error('Cloud pull failed');
      const data = await res.json();

      if (data && data.success && data.snapshot) {
        const s = data.snapshot;

        // Apply snapshot into local IndexedDB
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
        return s;
      }
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
}

export const cloudSyncService = new CloudSyncService();
export default cloudSyncService;

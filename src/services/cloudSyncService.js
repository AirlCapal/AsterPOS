/**
 * CloudSyncService — Automatic background synchronization between Aster POS and Manager Web Portal.
 * 
 * Works 100% free via Google Apps Script (Web App endpoint):
 *   1. Automatic Transmission: When the POS is online, transactions, stock adjustments, 
 *      and register summaries are batched and dispatched to the Cloud Sync endpoint.
 *   2. Manager Web Portal: Polls / pulls snapshots and transactions from the cloud endpoint
 *      so managers see live data from anywhere in the world on Vercel without needing local Wi-Fi.
 *   3. Offline Resilience: If the POS loses internet, mutations queue up locally and 
 *      auto-transmit as soon as connectivity resumes.
 */

import { Capacitor } from '@capacitor/core';
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
  }

  init() {
    if (typeof window === 'undefined') return;

    // Listen to online events
    window.addEventListener('online', () => {
      this.triggerAutoSync();
    });

    // Start background sync timer every 30 seconds
    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.triggerAutoSync();
      }, 30000);
    }
  }

  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
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
      syncError: this.syncError
    };
    this.listeners.forEach(cb => {
      try { cb(state); } catch {}
    });
  }

  /**
   * Builds the latest state payload to transmit to the cloud
   */
  async buildCloudPayload() {
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
      timestamp: Date.now(),
      summary: {
        totalRevenue,
        totalOrders: completed.length,
        cashSales,
        digitalSales: totalRevenue - cashSales,
        voidCount: voided.length,
        avgOrderValue: completed.length > 0 ? totalRevenue / completed.length : 0
      },
      orders: completed.slice(-30).reverse(),
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

      const payload = await this.buildCloudPayload();

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

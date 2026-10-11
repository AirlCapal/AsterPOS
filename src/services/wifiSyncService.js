/**
 * Wi-Fi LAN Sync Service — LOCAL ONLY (Zero Internet Required)
 *
 * Architecture:
 *   - Main Counter (Host): Starts a native WebSocket server on port 8765
 *     via the LocalSyncServer Capacitor plugin running on Android.
 *     Manager Devices connect to ws://<main-counter-ip>:8765.
 *
 *   - Manager Device (Client): Connects to the Main Counter's WebSocket
 *     server using the browser's native WebSocket API.
 *
 * Data Flow:
 *   Main Counter broadcasts: transactions, register summaries, stock mutations, audit events.
 *   Manager Device receives: real-time streams + full snapshot on connect.
 *
 * Security:
 *   - Communication is over local Wi-Fi only (not exposed to internet).
 *   - Room codes validated to alphanumeric 4-12 chars.
 *   - TODO(security): Add shared PIN authentication for pairing.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { db } from '../db';

// Register the native plugin (only available on Android)
const LocalSyncServer = registerPlugin('LocalSyncServer');

// --- Constants ---
const SYNC_STORAGE_KEY = 'aster-wifi-sync-config';
const SERVER_PORT = 8765;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;
const HEARTBEAT_INTERVAL_MS = 5000;

// Event types
const EVENT_TYPES = Object.freeze({
  TRANSACTION_COMPLETED: 'TRANSACTION_COMPLETED',
  REGISTER_SUMMARY_MUTATED: 'REGISTER_SUMMARY_MUTATED',
  STOCK_MUTATED: 'STOCK_MUTATED',
  AUDIT_EVENT: 'AUDIT_EVENT',
  SNAPSHOT_REQUEST: 'SNAPSHOT_REQUEST',
  SNAPSHOT_RESPONSE: 'SNAPSHOT_RESPONSE',
  HEARTBEAT: 'HEARTBEAT',
  HEARTBEAT_ACK: 'HEARTBEAT_ACK',
});

// Device roles
const ROLES = Object.freeze({
  MAIN_COUNTER: 'MAIN_COUNTER',
  MANAGER_DEVICE: 'MANAGER_DEVICE',
  NONE: 'NONE',
});

function validateRoomCode(code) {
  if (typeof code !== 'string') return false;
  return /^[A-Za-z0-9]{4,12}$/.test(code.trim());
}

function validateIpAddress(ip) {
  if (typeof ip !== 'string') return false;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim());
}

function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw);
    if (config && typeof config.role === 'string') return config;
  } catch {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  }
  return null;
}

function saveSyncConfig(config) {
  localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(config));
}

function clearSyncConfig() {
  localStorage.removeItem(SYNC_STORAGE_KEY);
}


// ====================================================
// WifiSyncService
// ====================================================

class WifiSyncService {
  constructor() {
    this.role = ROLES.NONE;
    this.roomCode = '';
    this.serverIp = '';
    this.status = 'disconnected';

    // Main Counter state
    this.nativeListenerHandle = null;

    // Manager Device state
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isDestroyed = false;

    // Event listeners
    this._listeners = new Map();

    // Debug log buffer
    this._debugLog = [];
  }

  // --- Event Emitter ---
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this._listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(data); } catch { /* swallow */ }
      });
    }
  }

  _log(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this._debugLog.push(entry);
    if (this._debugLog.length > 100) this._debugLog.shift();
    this._emit('debug_log', entry);
  }

  getDebugLog() {
    return [...this._debugLog];
  }

  getConfig() {
    return loadSyncConfig();
  }

  // ===========================================================
  // MAIN COUNTER — Start native WebSocket server
  // ===========================================================

  async startAsMainCounter(roomCode) {
    if (!validateRoomCode(roomCode)) {
      throw new Error('Room code must be 4-12 alphanumeric characters.');
    }

    this.destroy();
    this.isDestroyed = false;
    this.role = ROLES.MAIN_COUNTER;
    this.roomCode = roomCode;
    this._setStatus('connecting');
    this._log('Starting as Main Counter...');

    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      throw new Error('Main Counter mode requires the Android app. Please run this on the installed APK, not the browser.');
    }

    try {
      const result = await LocalSyncServer.startServer();
      this.serverIp = result.ip;
      this._log(`Server started on ${result.ip}:${result.port}`);

      // Listen for native events (client connect/disconnect/messages)
      this.nativeListenerHandle = await LocalSyncServer.addListener('syncEvent', async (event) => {
        this._handleNativeEvent(event);
      });

      saveSyncConfig({ role: ROLES.MAIN_COUNTER, roomCode });
      this._setStatus('connected');
      this._startHeartbeat();

      this._emit('server_started', { ip: result.ip, port: result.port });
      return result;
    } catch (err) {
      this._log(`Failed to start server: ${err.message}`);
      this._setStatus('disconnected');
      throw err;
    }
  }

  async _handleNativeEvent(event) {
    if (this.isDestroyed) return;

    if (event.event === 'client_connected') {
      this._log(`Manager connected (${event.clientCount} total)`);
      this._emit('connection_count', event.clientCount);
      this._emit('peer_connected', { clientId: event.clientId });

      // Auto-send snapshot to the newly connected manager
      const snapshot = await this.buildSnapshot();
      this.broadcast(EVENT_TYPES.SNAPSHOT_RESPONSE, snapshot);
    }

    if (event.event === 'client_disconnected') {
      this._log(`Manager disconnected (${event.clientCount} remaining)`);
      this._emit('connection_count', event.clientCount);
      this._emit('peer_disconnected', { clientId: event.clientId });
    }

    if (event.event === 'message_received') {
      try {
        const msg = JSON.parse(event.message);
        if (msg.type === EVENT_TYPES.SNAPSHOT_REQUEST) {
          const snapshot = await this.buildSnapshot();
          this.broadcast(EVENT_TYPES.SNAPSHOT_RESPONSE, snapshot);
        }
        if (msg.type === EVENT_TYPES.HEARTBEAT_ACK) {
          // Manager alive
        }
      } catch { /* malformed */ }
    }
  }

  // ===========================================================
  // MANAGER DEVICE — Connect via WebSocket to Main Counter IP
  // ===========================================================

  startAsManager(roomCode, hostIp) {
    if (!validateRoomCode(roomCode)) {
      return Promise.reject(new Error('Room code must be 4-12 alphanumeric characters.'));
    }
    if (!validateIpAddress(hostIp)) {
      return Promise.reject(new Error('Please enter a valid IP address (e.g., 192.168.1.100).'));
    }

    this.destroy();
    this.isDestroyed = false;
    this.role = ROLES.MANAGER_DEVICE;
    this.roomCode = roomCode;
    this.serverIp = hostIp.trim();
    this._setStatus('connecting');
    this._log(`Connecting to Main Counter at ${this.serverIp}:${SERVER_PORT}...`);

    saveSyncConfig({ role: ROLES.MANAGER_DEVICE, roomCode, hostIp: this.serverIp });

    // Return a promise that resolves when WebSocket actually opens
    return new Promise((resolve, reject) => {
      this._connectWebSocket(this.serverIp, resolve, reject);
    });
  }

  _connectWebSocket(hostIp, onFirstConnect, onFirstError) {
    if (this.isDestroyed) return;

    let hasSettled = false; // Track if the initial promise resolved/rejected
    let connectionTimeout = null;

    // Timeout for initial connection attempt (8 seconds)
    if (onFirstConnect) {
      connectionTimeout = setTimeout(() => {
        if (!hasSettled) {
          hasSettled = true;
          this._log('Connection timed out after 8 seconds');
          if (onFirstError) {
            onFirstError(new Error('Connection timed out. Make sure the Main Counter is running and both devices are on the same Wi-Fi network.'));
          }
          // Don't destroy — let it keep trying via reconnect
          this._setStatus('reconnecting');
          this._scheduleReconnect();
        }
      }, 8000);
    }

    try {
      const url = `ws://${hostIp}:${SERVER_PORT}/ws`;
      this._log(`Opening WebSocket to ${url}`);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        if (this.isDestroyed) return;
        if (connectionTimeout) clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;
        this._setStatus('connected');
        this._log('Connected to Main Counter!');
        this._startHeartbeat();

        // Request snapshot
        this._wsSend({ type: EVENT_TYPES.SNAPSHOT_REQUEST, timestamp: Date.now() });

        // Resolve initial connection promise
        if (!hasSettled && onFirstConnect) {
          hasSettled = true;
          onFirstConnect();
        }
      };

      this.ws.onmessage = (evt) => {
        if (this.isDestroyed) return;
        try {
          const msg = JSON.parse(evt.data);
          this._emit('sync_event', msg);

          switch (msg.type) {
            case EVENT_TYPES.TRANSACTION_COMPLETED:
              db.orders.put(msg.payload).catch(() => {});
              this._emit('transaction', msg.payload);
              break;
            case EVENT_TYPES.REGISTER_SUMMARY_MUTATED:
              this._emit('register_summary', msg.payload);
              break;
            case EVENT_TYPES.STOCK_MUTATED:
              db.ingredients.update(msg.payload.ingredientId, { currentStock: msg.payload.newStock }).catch(() => {});
              this._emit('stock_update', msg.payload);
              break;
            case EVENT_TYPES.AUDIT_EVENT:
              db.audit_logs.add(msg.payload).catch(() => {});
              this._emit('audit_event', msg.payload);
              break;
            case EVENT_TYPES.SNAPSHOT_RESPONSE:
              this._log('Received full snapshot from Main Counter');
              if (msg.payload.recentTransactions) {
                for (const tx of msg.payload.recentTransactions) {
                  db.orders.put(tx).catch(() => {});
                }
              }
              if (msg.payload.ingredients) {
                for (const ing of msg.payload.ingredients) {
                  db.ingredients.update(ing.id, { currentStock: ing.currentStock }).catch(() => {});
                }
              }
              if (msg.payload.auditEvents) {
                for (const audit of msg.payload.auditEvents) {
                  db.audit_logs.put(audit).catch(() => {});
                }
              }
              this._emit('snapshot', msg.payload);
              break;
            case EVENT_TYPES.HEARTBEAT:
              this._wsSend({ type: EVENT_TYPES.HEARTBEAT_ACK, timestamp: Date.now() });
              break;
          }
        } catch { /* malformed */ }
      };

      this.ws.onclose = () => {
        if (this.isDestroyed) return;
        if (connectionTimeout) clearTimeout(connectionTimeout);
        this._log('WebSocket connection closed');
        this._clearHeartbeat();

        // If this was the first attempt and it never opened, reject
        if (!hasSettled && onFirstError) {
          hasSettled = true;
          onFirstError(new Error('Connection closed before it opened. Verify the Main Counter IP address and ensure both devices are on the same Wi-Fi.'));
          return;
        }

        this._setStatus('reconnecting');
        this._scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        if (this.isDestroyed) return;
        this._log(`WebSocket error: ${err?.message || 'Connection failed'}`);

        // If this was the first attempt, reject the promise
        if (!hasSettled && onFirstError) {
          hasSettled = true;
          if (connectionTimeout) clearTimeout(connectionTimeout);
          onFirstError(new Error('Connection failed. Check the IP address and ensure the Main Counter is running.'));
          return;
        }

        this._emit('error', new Error('Connection failed. Check IP address and ensure Main Counter is running.'));
      };

    } catch (err) {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      this._log(`Failed to create WebSocket: ${err.message}`);
      if (!hasSettled && onFirstError) {
        hasSettled = true;
        onFirstError(err);
        return;
      }
      this._setStatus('reconnecting');
      this._scheduleReconnect();
    }
  }

  _wsSend(data) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    } catch { /* ignore */ }
  }

  // ===========================================================
  // SHARED: Broadcast (Main Counter only)
  // ===========================================================

  broadcast(eventType, payload) {
    if (this.role !== ROLES.MAIN_COUNTER) return;

    const message = JSON.stringify({
      type: eventType,
      payload,
      timestamp: Date.now(),
    });

    // Send via native plugin to all connected WebSocket clients
    if (Capacitor.isNativePlatform()) {
      LocalSyncServer.broadcast({ message }).catch(() => {});
    }
  }

  // ===========================================================
  // SHARED: Build Snapshot
  // ===========================================================

  async buildSnapshot() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const todayOrders = await db.orders
      .where('timestamp')
      .aboveOrEqual(todayMs)
      .toArray();

    const completedOrders = todayOrders.filter(o => o.status === 'completed');
    const voidedOrders = todayOrders.filter(o => o.status === 'voided');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = completedOrders.length;
    const cashSales = completedOrders
      .filter(o => o.paymentMethod === 'Cash')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const ingredients = await db.ingredients.toArray();

    const recentAudits = await db.audit_logs
      .where('timestamp')
      .aboveOrEqual(todayMs)
      .reverse()
      .limit(50)
      .toArray();

    return {
      timestamp: Date.now(),
      registerSummary: {
        totalRevenue,
        totalOrders,
        cashSales,
        digitalSales: totalRevenue - cashSales,
        voidCount: voidedOrders.length,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      recentTransactions: completedOrders.slice(-20).reverse(),
      ingredients: ingredients.map(i => ({
        id: i.id,
        name: i.name,
        currentStock: i.currentStock,
        safetyThreshold: i.safetyThreshold,
        unit: i.unit,
      })),
      auditEvents: recentAudits,
    };
  }

  // ===========================================================
  // Connection count
  // ===========================================================

  async getConnectionCount() {
    if (this.role === ROLES.MAIN_COUNTER && Capacitor.isNativePlatform()) {
      try {
        const status = await LocalSyncServer.getStatus();
        return status.clients || 0;
      } catch { return 0; }
    }
    if (this.role === ROLES.MANAGER_DEVICE) {
      return this.ws && this.ws.readyState === WebSocket.OPEN ? 1 : 0;
    }
    return 0;
  }

  // ===========================================================
  // Get the local IP of this device
  // ===========================================================

  async getLocalIp() {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalSyncServer.getLocalIp();
        return result.ip;
      } catch { return '0.0.0.0'; }
    }
    return '0.0.0.0';
  }

  // ===========================================================
  // Reconnect logic (Manager Device)
  // ===========================================================

  _scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;
    if (this.role !== ROLES.MANAGER_DEVICE) return;

    const finalDelay = 2000; // Stable 2s reconnect check while on same local network
    this.reconnectAttempts++;
    this._log(`Reconnecting to Main Counter in 2s (attempt #${this.reconnectAttempts})...`);
    this._emit('reconnect_attempt', { attempt: this.reconnectAttempts, delay: finalDelay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isDestroyed || this.status === 'connected') return;
      this._connectWebSocket(this.serverIp);
    }, finalDelay);
  }

  _clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ===========================================================
  // Heartbeat
  // ===========================================================

  _startHeartbeat() {
    this._clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.role === ROLES.MAIN_COUNTER) {
        this.broadcast(EVENT_TYPES.HEARTBEAT, { ts: Date.now() });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  _clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ===========================================================
  // Status
  // ===========================================================

  _setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this._emit('status_changed', newStatus);
    }
  }

  // ===========================================================
  // Teardown
  // ===========================================================

  destroy() {
    this.isDestroyed = true;
    this._clearReconnectTimer();
    this._clearHeartbeat();

    // Stop native server if running
    if (this.nativeListenerHandle) {
      try { this.nativeListenerHandle.remove(); } catch { /* ignore */ }
      this.nativeListenerHandle = null;
    }
    if (Capacitor.isNativePlatform() && this.role === ROLES.MAIN_COUNTER) {
      LocalSyncServer.stopServer().catch(() => {});
    }

    // Close WebSocket client
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }

    this.role = ROLES.NONE;
    this._setStatus('disconnected');
  }

  disable() {
    this.destroy();
    clearSyncConfig();
    this.roomCode = '';
    this.serverIp = '';
    this._emit('config_changed', null);
  }
}

// Singleton
const wifiSyncService = new WifiSyncService();

export { wifiSyncService, ROLES, EVENT_TYPES, validateRoomCode, validateIpAddress };
export default wifiSyncService;

/**
 * useWifiSync — React hook for the local Wi-Fi sync service.
 *
 * Provides reactive state for connection status, incoming data streams,
 * debug logs, and control functions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import wifiSyncService, { ROLES, EVENT_TYPES } from '../services/wifiSyncService';

export function useWifiSync() {
  const [status, setStatus] = useState(wifiSyncService.status);
  const [role, setRole] = useState(wifiSyncService.role);
  const [roomCode, setRoomCode] = useState(wifiSyncService.roomCode);
  const [serverIp, setServerIp] = useState(wifiSyncService.serverIp);
  const [connectionCount, setConnectionCount] = useState(0);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [lastStockUpdate, setLastStockUpdate] = useState(null);
  const [lastRegisterSummary, setLastRegisterSummary] = useState(null);
  const [lastAuditEvent, setLastAuditEvent] = useState(null);
  const [error, setError] = useState(null);
  const [reconnectInfo, setReconnectInfo] = useState(null);
  const [debugLog, setDebugLog] = useState([]);

  const [transactionLog, setTransactionLog] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    const unsubs = [
      wifiSyncService.on('status_changed', (newStatus) => {
        setStatus(newStatus);
      }),
      wifiSyncService.on('connection_count', (count) => {
        setConnectionCount(count);
      }),
      wifiSyncService.on('snapshot', (snapshot) => {
        setLastSnapshot(snapshot);
        if (snapshot?.registerSummary) {
          setLastRegisterSummary(snapshot.registerSummary);
        }
        if (snapshot?.recentTransactions) {
          setTransactionLog(snapshot.recentTransactions);
        }
        if (snapshot?.auditEvents) {
          setAuditLog(snapshot.auditEvents);
        }
      }),
      wifiSyncService.on('transaction', (tx) => {
        setLastTransaction(tx);
        setTransactionLog(prev => [tx, ...prev].slice(0, 100));
      }),
      wifiSyncService.on('stock_update', (stock) => {
        setLastStockUpdate(stock);
        setLastSnapshot(prev => {
          if (!prev) return prev;
          const updated = prev.ingredients?.map(ing =>
            ing.id === stock.ingredientId
              ? { ...ing, currentStock: stock.newStock }
              : ing
          );
          return { ...prev, ingredients: updated };
        });
      }),
      wifiSyncService.on('register_summary', (summary) => {
        setLastRegisterSummary(summary);
        setLastSnapshot(prev => prev ? { ...prev, registerSummary: summary } : prev);
      }),
      wifiSyncService.on('audit_event', (event) => {
        setLastAuditEvent(event);
        setAuditLog(prev => [event, ...prev].slice(0, 100));
      }),
      wifiSyncService.on('error', (err) => {
        setError(err?.message || 'Connection error');
        setTimeout(() => setError(null), 8000);
      }),
      wifiSyncService.on('reconnect_attempt', (info) => {
        setReconnectInfo(info);
      }),
      wifiSyncService.on('peer_connected', () => {
        wifiSyncService.getConnectionCount().then(setConnectionCount);
      }),
      wifiSyncService.on('peer_disconnected', () => {
        wifiSyncService.getConnectionCount().then(setConnectionCount);
      }),
      wifiSyncService.on('config_changed', () => {
        const config = wifiSyncService.getConfig();
        setRole(config?.role || ROLES.NONE);
        setRoomCode(config?.roomCode || '');
        setServerIp(config?.hostIp || '');
      }),
      wifiSyncService.on('server_started', (info) => {
        setServerIp(info.ip);
      }),
      wifiSyncService.on('debug_log', (entry) => {
        setDebugLog(prev => [...prev, entry].slice(-50));
      }),
    ];

    // Load debug history
    setDebugLog(wifiSyncService.getDebugLog());

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  const startAsMainCounter = useCallback(async (newRoomCode) => {
    try {
      setError(null);
      const result = await wifiSyncService.startAsMainCounter(newRoomCode);
      setRole(ROLES.MAIN_COUNTER);
      setRoomCode(newRoomCode);
      setServerIp(result.ip);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const startAsManager = useCallback(async (newRoomCode, hostIp) => {
    try {
      setError(null);
      await wifiSyncService.startAsManager(newRoomCode, hostIp);
      setRole(ROLES.MANAGER_DEVICE);
      setRoomCode(newRoomCode);
      setServerIp(hostIp);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const broadcast = useCallback((eventType, payload) => {
    wifiSyncService.broadcast(eventType, payload);
  }, []);

  const disconnect = useCallback(() => {
    wifiSyncService.disable();
    setStatus('disconnected');
    setRole(ROLES.NONE);
    setRoomCode('');
    setServerIp('');
    setConnectionCount(0);
    setLastSnapshot(null);
    setTransactionLog([]);
    setAuditLog([]);
    setDebugLog([]);
  }, []);

  return {
    // Status
    status,
    role,
    roomCode,
    serverIp,
    connectionCount,
    error,
    reconnectInfo,
    debugLog,
    isConnected: status === 'connected',
    isMainCounter: role === ROLES.MAIN_COUNTER,
    isManagerDevice: role === ROLES.MANAGER_DEVICE,
    isConfigured: role !== ROLES.NONE,

    // Data streams
    lastSnapshot,
    lastTransaction,
    lastStockUpdate,
    lastRegisterSummary,
    lastAuditEvent,
    transactionLog,
    auditLog,

    // Actions
    startAsMainCounter,
    startAsManager,
    broadcast,
    disconnect,
  };
}

export default useWifiSync;

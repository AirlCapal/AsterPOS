/**
 * WifiSyncSettings — Configuration panel for Wi-Fi LAN synchronization.
 * 
 * Simplified UX:
 *   1. Select role (Main Counter / Manager Device)
 *   2. Main Counter: just tap "Start" → shows IP for the other device
 *   3. Manager Device: enter IP shown on Main Counter → tap "Connect"
 *   4. Live debug log shows exactly what's happening
 * 
 * Security:
 *   - Room codes validated to alphanumeric 4-12 chars.
 *   - Communication over local Wi-Fi only.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi, WifiOff, Radio, Monitor, Smartphone, Check, X, RefreshCw,
  Link2, Unlink, Copy, Zap, Info, Shield, ChevronDown, ChevronUp, Terminal, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRScanner from './QRScanner';
import { ROLES, validateRoomCode } from '../services/wifiSyncService';

export default function WifiSyncSettings({ syncState }) {
  const {
    status, role, roomCode, serverIp, connectionCount, error, isConnected,
    isMainCounter, isManagerDevice, isConfigured,
    startAsMainCounter, startAsManager, disconnect, debugLog
  } = syncState;

  const [selectedRole, setSelectedRole] = useState(role || ROLES.NONE);
  const [inputRoomCode, setInputRoomCode] = useState(roomCode || '');
  const [inputHostIp, setInputHostIp] = useState(serverIp || '');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [pingStatus, setPingStatus] = useState('');

  const logEndRef = useRef(null);

  // Auto-scroll debug log
  useEffect(() => {
    if (showDebugLog && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debugLog, showDebugLog]);

  const handleConnect = async () => {
    const cleanRoomCode = inputRoomCode.trim().toUpperCase();
    if (!validateRoomCode(cleanRoomCode)) {
      setLocalError('Room code must be 4-12 alphanumeric characters (letters and numbers only).');
      return;
    }
    if (selectedRole === ROLES.NONE) {
      setLocalError('Please select a device role first.');
      return;
    }

    setLocalError('');
    setIsLoading(true);

    try {
      if (selectedRole === ROLES.MAIN_COUNTER) {
        await startAsMainCounter(cleanRoomCode);
      } else {
        const cleanHostIp = inputHostIp.trim();
        if (!cleanHostIp) {
          setLocalError('Please enter the Main Counter IP address.');
          setIsLoading(false);
          return;
        }
        await startAsManager(cleanRoomCode, cleanHostIp);
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setLocalError(err.message || 'Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setSelectedRole(ROLES.NONE);
    setInputRoomCode('');
    setInputHostIp('');
    setShowSuccess(false);
  };

  const handleCopyIp = () => {
    navigator.clipboard?.writeText(serverIp).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    for (let i = 0; i < 6; i++) {
      code += chars[array[i] % chars.length];
    }
    setInputRoomCode(code);
  };

  const displayError = localError || error;

  const handleTestPing = async () => {
    setPingStatus('Pinging...');
    try {
      const res = await fetch(`http://${serverIp}:8080/`, { method: 'GET', mode: 'no-cors' });
      // If it doesn't throw, we assume the server is reachable
      setPingStatus('Ping OK');
      setTimeout(() => setPingStatus(''), 3000);
    } catch (e) {
      setPingStatus('Ping Failed');
      setTimeout(() => setPingStatus(''), 3000);
    }
  };

  // ===== CONNECTED STATE =====
  const renderConnectedStatus = () => {
    const statusDot = isConnected
      ? 'bg-emerald-400'
      : status === 'reconnecting' || status === 'connecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-red-400';

    const statusText = isConnected
      ? 'Connected & Syncing'
      : status === 'reconnecting'
        ? 'Reconnecting...'
        : status === 'connecting'
          ? 'Establishing connection...'
          : 'Disconnected';

    const statusColor = isConnected
      ? 'text-emerald-600'
      : status === 'reconnecting' || status === 'connecting'
        ? 'text-amber-600'
        : 'text-red-500';

    return (
      <div className="space-y-4">
        {/* Active Connection Card */}
        <div className={`rounded-xl border-2 p-4 transition-all ${isConnected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${statusDot}`} />
                {isConnected && (
                  <div className={`absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-30`} />
                )}
              </div>
              <span className={`text-sm font-bold ${statusColor}`}>{statusText}</span>
            </div>
            {isConnected && <Zap size={16} className="text-emerald-500" />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-[10px] font-medium text-text-light uppercase tracking-wider">Role</p>
              <div className="flex items-center gap-1.5 mt-1">
                {isMainCounter ? <Monitor size={14} className="text-primary" /> : <Smartphone size={14} className="text-primary" />}
                <span className="text-xs font-bold text-text-main">
                  {isMainCounter ? 'Main Counter' : 'Manager Device'}
                </span>
              </div>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-[10px] font-medium text-text-light uppercase tracking-wider">Room Code</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-bold text-text-main font-mono tracking-wider">{roomCode}</span>
              </div>
            </div>
          </div>

          {isMainCounter && (
            <>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div id="wifi-ip-display" className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-[10px] font-medium text-primary uppercase tracking-wider">Your IP Address</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-bold text-primary font-mono">{serverIp || '...'}</span>
                  <button onClick={handleCopyIp} className="btn-compact text-primary/60 hover:text-primary transition-colors">
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[9px] text-primary/70 mt-1 font-medium">Tell Manager Device to enter this IP</p>
              </div>
              <div id="wifi-status-badge" className="bg-background rounded-lg p-3 border border-border">
                <p className="text-[10px] font-medium text-text-light uppercase tracking-wider">Connected Devices</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-text-main">{connectionCount}</span>
                  <span className="text-xs text-text-light">Manager{connectionCount !== 1 ? 's' : ''} linked</span>
                </div>
              </div>
            </div>
            
            <div id="wifi-qr-code" className="mt-3 bg-white p-4 rounded-xl border flex flex-col items-center justify-center gap-3">
               <p className="text-xs font-bold text-gray-800">Scan to Pair (Manager App)</p>
               <QRCodeSVG value={JSON.stringify({ip: serverIp, roomCode: roomCode, port: 8080, masterKey: 'AIRL092918'})} size={150} level="M" />
               <p className="text-[10px] font-medium text-gray-500 text-center">Open Web Dashboard at:<br/>http://{serverIp}:8080</p>
            </div>
            </>
          )}

          {/* Manager Device: Show what we're connected to */}
          {isManagerDevice && (
            <div className="mt-3 bg-background rounded-lg p-3 border border-border flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-text-light uppercase tracking-wider">Connected To</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm font-bold text-text-main font-mono">{serverIp}:8080</span>
                </div>
              </div>
              <button id="wifi-ping-btn" onClick={handleTestPing} className="min-h-[32px] px-3 bg-surface-hover border border-border text-xs font-semibold rounded-lg hover:bg-border transition-colors">
                {pingStatus || 'Test Ping'}
              </button>
            </div>
          )}
        </div>

        {/* Debug Log Toggle */}
        {renderDebugLog()}

        {/* Disconnect Button */}
        <button
          onClick={handleDisconnect}
          className="w-full min-h-[44px] px-4 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Unlink size={16} /> Disconnect & Disable Sync
        </button>
      </div>
    );
  };

  // ===== SETUP FORM =====
  const renderSetupForm = () => (
    <div className="space-y-4">
      {/* Step 1: Role Selection */}
      <div>
        <label className="block text-xs font-semibold text-text-light uppercase tracking-wider mb-2">
          Step 1 — Choose this device's role
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            id="wifi-host-toggle"
            onClick={() => { setSelectedRole(ROLES.MAIN_COUNTER); setLocalError(''); }}
            className={`min-h-[80px] rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 p-3 transition-all ${
              selectedRole === ROLES.MAIN_COUNTER
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border text-text-light hover:border-text-light hover:bg-surface-hover'
            }`}
          >
            <Monitor size={22} />
            <span className="text-xs font-bold">Main Counter</span>
            <span className="text-[9px] font-medium opacity-70">POS / Cash Register</span>
          </button>
          <button
            id="wifi-client-toggle"
            onClick={() => { setSelectedRole(ROLES.MANAGER_DEVICE); setLocalError(''); }}
            className={`min-h-[80px] rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 p-3 transition-all ${
              selectedRole === ROLES.MANAGER_DEVICE
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border text-text-light hover:border-text-light hover:bg-surface-hover'
            }`}
          >
            <Smartphone size={22} />
            <span className="text-xs font-bold">Manager Device</span>
            <span className="text-[9px] font-medium opacity-70">View live data</span>
          </button>
        </div>
      </div>

      {/* Step 2: Room Code */}
      <div>
        <label className="block text-xs font-semibold text-text-light uppercase tracking-wider mb-2">
          Step 2 — Room Code (same on both devices)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputRoomCode}
            onChange={(e) => {
              const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase();
              setInputRoomCode(val);
              setLocalError('');
            }}
            placeholder="e.g. CAFE01"
            maxLength={12}
            className="flex-1 min-h-[44px] px-4 bg-background border border-border rounded-xl text-text-main font-mono text-sm font-semibold tracking-widest uppercase focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <button
            onClick={generateRandomCode}
            className="min-h-[44px] px-3 bg-surface-hover hover:bg-border border border-border rounded-xl text-text-light transition-colors flex items-center gap-1.5"
            title="Generate random code"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Step 3: Host IP (Only for Manager Device) */}
      {selectedRole === ROLES.MANAGER_DEVICE && (
        <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
          
          {isScanning ? (
            <div className="w-full bg-background rounded-xl p-2 border border-border">
              <QRScanner
                onScanSuccess={(scanned) => {
                  try {
                    const data = JSON.parse(scanned);
                    if (data.ip) setInputHostIp(data.ip);
                    if (data.roomCode) setInputRoomCode(data.roomCode);
                    setIsScanning(false);
                    setLocalError('');
                  } catch(e) {
                    setLocalError("Invalid QR Code Format");
                  }
                }}
                onScanFailure={(err) => {
                  // silent fail for continuous scan
                }}
              />
              <button
                onClick={() => setIsScanning(false)}
                className="w-full mt-2 min-h-[40px] bg-surface-hover hover:bg-border text-text-main rounded-lg font-semibold flex items-center justify-center transition-colors"
              >
                Cancel Scan
              </button>
            </div>
          ) : (
            <button
              id="wifi-scan-btn"
              onClick={() => setIsScanning(true)}
              className="w-full min-h-[48px] bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <QrCode size={18} /> Scan Counter QR (Quick Pair)
            </button>
          )}

          <div className="relative flex items-center justify-center">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
             <div className="relative bg-background px-3 text-[10px] uppercase font-bold text-text-light">OR ENTER MANUALLY</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-light uppercase tracking-wider mb-2">
              Step 3 — Enter Main Counter's IP Address
            </label>
          <input
            type="text"
            value={inputHostIp}
            onChange={(e) => {
              setInputHostIp(e.target.value.trim());
              setLocalError('');
            }}
            placeholder="e.g. 192.168.1.100"
            className="w-full min-h-[44px] px-4 bg-background border border-border rounded-xl text-text-main font-mono text-sm font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <p className="text-[10px] text-text-light mt-1.5 flex items-center gap-1">
            <Info size={10} />
            This IP is shown on the Main Counter device after it starts.
          </p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {selectedRole === ROLES.MAIN_COUNTER && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex gap-2.5 animate-in fade-in">
          <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-text-main">Main Counter mode</p>
            <p className="text-[11px] text-text-light mt-0.5 leading-relaxed">
              This device will broadcast transactions, inventory, and audit data.
              After starting, your <strong>IP address</strong> will be shown — enter it on the Manager Device to connect.
            </p>
          </div>
        </div>
      )}

      {selectedRole === ROLES.MANAGER_DEVICE && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex gap-2.5 animate-in fade-in">
          <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-text-main">Manager Device mode</p>
            <p className="text-[11px] text-text-light mt-0.5 leading-relaxed">
              This device will receive real-time data from the Main Counter.
              Make sure the Main Counter is <strong>started first</strong>, then enter its IP address above.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {displayError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
          <X size={14} /> {displayError}
        </div>
      )}

      {/* Success */}
      {showSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold p-3 rounded-xl flex items-center gap-2 animate-in">
          <Check size={14} /> Connected successfully!
        </div>
      )}

      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={isLoading || !inputRoomCode || selectedRole === ROLES.NONE || (selectedRole === ROLES.MANAGER_DEVICE && !inputHostIp)}
        className="w-full min-h-[48px] px-6 bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-sm shadow-lg transition-all active:scale-95 disabled:active:scale-100 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            {selectedRole === ROLES.MAIN_COUNTER ? 'Starting Server...' : 'Connecting...'}
          </>
        ) : (
          <>
            <Link2 size={16} />
            {selectedRole === ROLES.MAIN_COUNTER ? 'Start as Main Counter' : selectedRole === ROLES.MANAGER_DEVICE ? 'Connect to Main Counter' : 'Enable Wi-Fi Sync'}
          </>
        )}
      </button>

      {/* Debug Log Toggle */}
      {renderDebugLog()}
    </div>
  );

  // ===== DEBUG LOG =====
  const renderDebugLog = () => (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setShowDebugLog(!showDebugLog)}
        className="w-full px-3 py-2.5 bg-surface-hover flex items-center justify-between text-xs font-semibold text-text-light hover:bg-border transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal size={13} />
          Connection Log
        </div>
        {showDebugLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showDebugLog && (
        <div className="bg-gray-900 p-3 max-h-[180px] overflow-y-auto font-mono text-[10px] leading-relaxed">
          {(!debugLog || debugLog.length === 0) ? (
            <p className="text-gray-500 italic">No log entries yet. Start a connection to see activity.</p>
          ) : (
            debugLog.map((entry, i) => (
              <div key={i} className={`${
                entry.includes('error') || entry.includes('Error') || entry.includes('failed') || entry.includes('Failed')
                  ? 'text-red-400'
                  : entry.includes('Connected') || entry.includes('started') || entry.includes('Received')
                    ? 'text-emerald-400'
                    : entry.includes('Reconnect') || entry.includes('timed out')
                      ? 'text-amber-400'
                      : 'text-gray-300'
              }`}>
                {entry}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-surface p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-border">
      <div className="flex items-center gap-2 mb-5 sm:mb-6">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
          {isConnected ? <Wifi size={20} /> : <Radio size={20} />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-main">Wi-Fi LAN Sync</h3>
          <p className="text-[11px] text-text-light font-medium">Real-time device-to-device streaming</p>
        </div>
      </div>

      {isConfigured ? renderConnectedStatus() : renderSetupForm()}
    </div>
  );
}

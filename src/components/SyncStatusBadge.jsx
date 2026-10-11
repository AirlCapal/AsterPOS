/**
 * SyncStatusBadge — Real-time connection indicator for the header navbar.
 * 
 * Shows:
 *   🟢 Wi-Fi Sync Active (Main Counter ➔ Manager Linked)
 *   🟡 Searching for Main Counter POS...
 *   🔴 Wi-Fi Disconnected / Standalone Mode
 */

import React from 'react';
import { Wifi, WifiOff, Radio, Monitor, Smartphone } from 'lucide-react';

export default function SyncStatusBadge({ status, role, connectionCount, roomCode }) {
  // Don't render if sync is not configured
  if (!role || role === 'NONE') return null;

  const isMainCounter = role === 'MAIN_COUNTER';
  const isConnected = status === 'connected';
  const isReconnecting = status === 'reconnecting' || status === 'connecting';

  let dotColor, bgColor, textColor, borderColor, label, Icon;

  if (isConnected) {
    dotColor = 'bg-emerald-400';
    bgColor = 'bg-emerald-500/10';
    textColor = 'text-emerald-600';
    borderColor = 'border-emerald-500/20';
    Icon = Wifi;
    if (isMainCounter) {
      label = connectionCount > 0
        ? `Sync Live · ${connectionCount} Device${connectionCount > 1 ? 's' : ''}`
        : 'Broadcasting';
    } else {
      label = 'Sync Active';
    }
  } else if (isReconnecting) {
    dotColor = 'bg-amber-400 animate-pulse';
    bgColor = 'bg-amber-500/10';
    textColor = 'text-amber-600';
    borderColor = 'border-amber-500/20';
    Icon = Radio;
    label = isMainCounter ? 'Waiting...' : 'Searching...';
  } else {
    dotColor = 'bg-red-400';
    bgColor = 'bg-red-500/10';
    textColor = 'text-red-500';
    borderColor = 'border-red-500/20';
    Icon = WifiOff;
    label = 'Standalone';
  }

  return (
    <div className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border ${bgColor} ${borderColor} cursor-default select-none transition-all duration-300`}
      title={`Role: ${isMainCounter ? 'Main Counter' : 'Manager Device'} · Room: ${roomCode} · Status: ${status}`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        {isConnected && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${dotColor} animate-ping opacity-40`} />
        )}
      </div>
      <Icon size={13} className={`${textColor} flex-shrink-0`} />
      <span className={`text-[10px] font-semibold ${textColor} whitespace-nowrap hidden sm:inline`}>
        {label}
      </span>
      {/* Role icon */}
      <div className={`w-4 h-4 rounded flex items-center justify-center ${bgColor} flex-shrink-0`}>
        {isMainCounter ? <Monitor size={10} className={textColor} /> : <Smartphone size={10} className={textColor} />}
      </div>
    </div>
  );
}

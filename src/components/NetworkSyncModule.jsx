import React from 'react';
import WifiSyncSettings from './WifiSyncSettings';
import { Network, Activity, Info } from 'lucide-react';

export default function NetworkSyncModule({ syncState }) {
  return (
    <div className="p-3 sm:p-5 lg:p-8 h-full flex flex-col bg-background overflow-y-auto">
      <div className="mb-6 lg:mb-8 flex-shrink-0">
        <h2 className="text-2xl sm:text-3xl font-semibold text-text-main flex items-center gap-3">
          <Network size={28} className="text-primary" />
          Wi-Fi Sync Module
        </h2>
        <p className="text-text-light font-medium text-sm mt-1">
          Connect multiple devices on the same local network to share data in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <WifiSyncSettings syncState={syncState} />
        </div>
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-semibold text-text-main flex items-center gap-2 mb-4">
              <Info size={20} className="text-primary" />
              Troubleshooting & Status
            </h3>
            
            <div className="space-y-4 text-sm text-text-main">
              <div className="p-4 bg-background border border-border rounded-xl">
                <p className="font-semibold mb-2">Can't connect to the other device?</p>
                <ul className="list-disc pl-5 space-y-1.5 text-text-light">
                  <li>Ensure both devices are connected to the <strong>exact same Wi-Fi network</strong>.</li>
                  <li>Verify the <strong>Room Code</strong> matches exactly (it is case-insensitive).</li>
                  <li>Ensure one device is set to <strong>Main Counter</strong> and the other to <strong>Manager Device</strong>.</li>
                  <li>An initial internet connection is required briefly to establish the connection (via signaling), after which it switches to purely local Wi-Fi.</li>
                </ul>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl">
                <p className="font-semibold mb-2">Live Connection Diagnostics</p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="p-3 bg-surface-hover rounded-lg">
                    <p className="text-xs text-text-light uppercase tracking-wider mb-1">Status</p>
                    <p className="font-semibold capitalize text-primary">{syncState.status}</p>
                  </div>
                  <div className="p-3 bg-surface-hover rounded-lg">
                    <p className="text-xs text-text-light uppercase tracking-wider mb-1">Role</p>
                    <p className="font-semibold">{syncState.role === 'NONE' ? 'Not Configured' : syncState.role.replace('_', ' ')}</p>
                  </div>
                  <div className="p-3 bg-surface-hover rounded-lg">
                    <p className="text-xs text-text-light uppercase tracking-wider mb-1">Active Peers</p>
                    <p className="font-semibold">{syncState.connectionCount}</p>
                  </div>
                  <div className="p-3 bg-surface-hover rounded-lg">
                    <p className="text-xs text-text-light uppercase tracking-wider mb-1">Last Sync Event</p>
                    <p className="font-semibold">{syncState.lastTransaction || syncState.lastStockUpdate ? 'Received recently' : 'No data yet'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

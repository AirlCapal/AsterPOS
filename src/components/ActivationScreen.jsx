import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ActivationScreen({ onActivate }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = `DEV-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${new Date().getFullYear()}`;
      localStorage.setItem('device_id', id);
    }
    setDeviceId(id);
  }, []);

  const handleActivate = (e) => {
    e.preventDefault();
    if (code === 'AIRL092918') {
      setSuccess(true);
      setError(false);
      setTimeout(() => {
        onActivate();
      }, 1500);
    } else {
      setError(true);
      setTimeout(() => setError(false), 800); // Reset shake animation
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-4 animate-in fade-in duration-500">
      <div className={`w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden ${error ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <div className="p-8 text-center border-b border-border bg-surface-hover">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-main mb-1">Aster POS</h1>
          <p className="text-text-light text-sm font-medium">License Activation</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-background border border-border rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-text-light font-medium">Hardware ID</span>
            <span className="font-mono font-bold text-text-main text-sm">{deviceId}</span>
          </div>

          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">Product Key</label>
              <input
                type="password"
                value={code}
                onChange={e => setCode(e.target.value)}
                className={`w-full h-14 px-5 bg-background border-2 rounded-xl focus:outline-none focus:ring-2 font-mono text-xl tracking-widest text-center transition-colors ${
                  error ? 'border-red-500 focus:ring-red-500/20 text-red-500' : 
                  success ? 'border-green-500 text-green-500' : 'border-border focus:border-primary focus:ring-primary/20 text-text-main'
                }`}
                placeholder="Enter 10-digit code"
                readOnly={success}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-semibold animate-in slide-in-from-top-2">
                <ShieldAlert size={16} /> Invalid Product Code. Contact Administrator.
              </div>
            )}
            
            {success && (
              <div className="flex items-center justify-center gap-2 text-green-500 text-sm font-semibold animate-in slide-in-from-top-2">
                <CheckCircle2 size={16} /> License Verified. Unlocking...
              </div>
            )}

            <button
              type="submit"
              disabled={!code || success}
              className="w-full h-14 mt-4 bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-[15px] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
            >
              Activate POS License
            </button>
          </form>
        </div>
      </div>
      
      {/* Add custom shake animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}} />
    </div>
  );
}

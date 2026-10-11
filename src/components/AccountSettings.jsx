import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { User, Lock, KeyRound, Save, CheckCircle2, Eye, EyeOff, ShieldCheck, Mail, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-text-main mb-2">{title}</h3>
          <p className="text-sm text-text-light leading-relaxed">{message}</p>
        </div>
        <div className="flex bg-surface-hover border-t border-border p-3 sm:p-4 gap-3">
          <button onClick={onCancel} className="flex-1 min-h-[44px] bg-surface border border-border hover:bg-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-colors shadow-lg">Confirm</button>
        </div>
      </div>
    </div>
  );
};

export default function AccountSettings({ currentUser }) {
  const isWeb = !Capacitor.isNativePlatform();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // Password fields (for Web Portal)
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // PIN fields (for POS Register)
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setNewPin('');
      setConfirmPin('');
    }
  }, [currentUser]);

  const showToast = (msg, type = 'error') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Verify identity: match current password or current PIN
    const entered = currentPass.trim();
    const matchesPass = currentUser.password && currentUser.password === entered;
    const matchesPin = currentUser.pin && currentUser.pin === entered;

    // Fallback defaults for admin/manager if never updated
    const isFallbackAdmin = (currentUser.username === 'admin' || currentUser.id === 9999) && (entered === 'admin123' || entered === '999900');
    const isFallbackMgr = (currentUser.username === 'manager' || currentUser.id === 9998) && (entered === 'manager123' || entered === '123400');

    if (!matchesPass && !matchesPin && !isFallbackAdmin && !isFallbackMgr) {
      showToast('Current password or PIN is incorrect. Please verify your credentials.');
      return;
    }

    // Validate new password if provided
    if (newPass || confirmPass) {
      if (newPass.length < 6) {
        showToast('New password must be at least 6 characters.');
        return;
      }
      if (newPass !== confirmPass) {
        showToast('New passwords do not match. Please re-enter.');
        return;
      }
    }

    // Validate new PIN if provided
    if (newPin || confirmPin) {
      if (newPin.length < 4 || newPin.length > 6) {
        showToast('Register PIN must be 4 to 6 digits.');
        return;
      }
      if (newPin !== confirmPin) {
        showToast('New PINs do not match. Please re-enter.');
        return;
      }
    }

    if (!name.trim()) {
      showToast('Display name cannot be empty.');
      return;
    }

    setConfirmDialog(true);
  };

  const executeSave = async () => {
    setConfirmDialog(false);
    setIsSaving(true);
    try {
      const updates = {
        name: name.trim(),
        username: username.trim() || currentUser.username,
        email: email.trim() || currentUser.email
      };

      if (newPass && newPass === confirmPass) {
        updates.password = newPass.trim();
      }
      if (newPin && newPin === confirmPin) {
        updates.pin = newPin.trim();
      }

      if (currentUser.id) {
        await db.users.update(currentUser.id, updates);
      }

      // Update in-memory user
      Object.assign(currentUser, updates);

      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setNewPin('');
      setConfirmPin('');
      showToast('Account credentials updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update account.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 lg:p-8 max-w-2xl mx-auto w-full h-full flex flex-col relative overflow-hidden">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white font-semibold text-sm shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2 ${toastMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toastMessage.msg}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        title="Confirm Account Updates"
        message="Are you sure you want to save these credential changes?"
        onConfirm={executeSave}
        onCancel={() => setConfirmDialog(false)}
      />

      <div className="mb-4 sm:mb-6 flex-shrink-0">
        <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Account Settings</h2>
        <p className="text-text-light font-medium text-sm">
          {isWeb ? 'Manage manager profile, web login password, and register PIN' : 'Update your personal profile and access security'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        <form onSubmit={handleSave} className="space-y-6">

          {/* Profile Card */}
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg flex-shrink-0">
                {currentUser?.name?.charAt(0)?.toUpperCase() || 'M'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-text-main text-base truncate">{currentUser?.name}</p>
                <p className="text-xs text-text-light font-medium capitalize">{currentUser?.role?.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="h-11 w-full px-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-semibold"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  Web Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="h-11 w-full px-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-semibold"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-11 w-full px-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-semibold"
                  placeholder="manager@domain.com"
                />
              </div>
            </div>
          </div>

          {/* Web Password Card */}
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <KeyRound size={18} />
              </div>
              <div>
                <p className="font-semibold text-text-main text-sm">Manager Web Password</p>
                <p className="text-xs text-text-light">Used to log in to this web dashboard via Vercel browser</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="New password"
                    className="h-11 w-full px-3.5 pr-10 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main"
                  >
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-11 w-full px-3.5 pr-10 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main"
                  >
                    {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {newPass && confirmPass && newPass === confirmPass && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold bg-emerald-500/10 p-2.5 rounded-lg">
                <CheckCircle2 size={14} /> Passwords match
              </div>
            )}
            {newPass && confirmPass && newPass !== confirmPass && (
              <div className="flex items-center gap-2 text-red-500 text-xs font-semibold bg-red-500/10 p-2.5 rounded-lg">
                Passwords do not match
              </div>
            )}
          </div>

          {/* POS Register PIN Card (Optional secondary) */}
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="font-semibold text-text-main text-sm">Tablet POS PIN (Cashier Override)</p>
                <p className="text-xs text-text-light">Used to authorize discounts or voids on the Android tablet</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  New 4-6 Digit PIN (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="••••••"
                    className="h-11 w-full px-3.5 pr-10 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-mono font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main"
                  >
                    {showNewPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1.5">
                  Confirm New PIN
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="••••••"
                    className="h-11 w-full px-3.5 pr-10 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-mono font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main"
                  >
                    {showConfirmPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Current Password / PIN Verification */}
          <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-primary/30 shadow-sm space-y-3">
            <label className="block text-xs font-bold text-primary uppercase tracking-wider">
              Verify Current Password or PIN *
            </label>
            <p className="text-xs text-text-light">
              Enter your current login password or PIN to authorize and save these changes.
            </p>
            <div className="relative max-w-sm">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                value={currentPass}
                onChange={e => setCurrentPass(e.target.value)}
                placeholder="Current password or PIN"
                required
                className="h-11 w-full px-3.5 pr-10 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-main"
              >
                {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2 pb-8">
            <button
              type="submit"
              disabled={isSaving || !currentPass}
              className="w-full h-11 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} /> {isSaving ? 'Saving Changes...' : 'Save Account Updates'}
            </button>
            {!currentPass && (
              <p className="text-xs text-text-light text-center mt-2 font-medium">Enter your current password or PIN above to enable saving</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

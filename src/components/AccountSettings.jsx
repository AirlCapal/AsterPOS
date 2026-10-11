import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { User, Lock, Save, CheckCircle2, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';

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

// Extracted OUTSIDE the component so it doesn't re-mount on every render (fixes keyboard closing)
const PinInput = ({ label, icon: IconComp, value, onChange, show, onToggle, placeholder }) => (
  <div>
    <label className="block text-sm font-semibold text-text-light mb-2 flex items-center gap-2">
      <IconComp size={16} /> {label}
    </label>
    <div className="relative">
      <input 
        type={show ? 'text' : 'password'} 
        value={value} 
        onChange={e => {
          const v = e.target.value.replace(/[^0-9]/g, '');
          onChange(v);
        }}
        inputMode="numeric"
        maxLength={6}
        className="h-12 w-full px-4 pr-12 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main font-semibold tracking-widest" 
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-text-light hover:text-text-main hover:bg-surface-hover transition-colors"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);

export default function AccountSettings({ currentUser }) {
  const [name, setName] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setCurrentPin('');
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

    // Validate current PIN
    if (currentPin !== currentUser.pin) {
      showToast('Current PIN is incorrect. Please try again.');
      return;
    }

    // Validate new PIN (only if user wants to change it)
    if (newPin || confirmPin) {
      if (newPin.length < 6) {
        showToast('New PIN must be exactly 6 digits.');
        return;
      }
      if (newPin !== confirmPin) {
        showToast('New PINs do not match. Please re-enter.');
        return;
      }
    }

    // Name validation
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
      const updates = { name: name.trim() };
      if (newPin && newPin === confirmPin) {
        updates.pin = newPin;
      }
      await db.users.update(currentUser.id, updates);
      
      // Update the currentUser object in memory
      currentUser.name = updates.name;
      if (updates.pin) currentUser.pin = updates.pin;

      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      showToast('Account updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to update account. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto w-full h-full flex flex-col relative">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white font-semibold text-sm shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2 ${toastMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : null}
          {toastMessage.msg}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={confirmDialog}
        title="Confirm Changes"
        message="Are you sure you want to save these changes to your account?"
        onConfirm={executeSave}
        onCancel={() => setConfirmDialog(false)}
      />

      <div className="mb-6 sm:mb-8 flex-shrink-0">
        <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Account Settings</h2>
        <p className="text-text-light font-medium text-sm">Update your personal information and PIN code</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Profile Card */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <User size={28} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-text-main text-lg truncate">{currentUser.name}</p>
                <p className="text-sm text-text-light font-medium capitalize">{currentUser.role?.replace('_', ' ')}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-light mb-2 flex items-center gap-2">
                <User size={16} /> Display Name
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                className="h-12 w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main font-semibold" 
                placeholder="Your Name" 
              />
            </div>
          </div>

          {/* PIN Change Card */}
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="font-semibold text-text-main">Change PIN Code</p>
                <p className="text-xs text-text-light font-medium">Enter your current PIN to verify identity</p>
              </div>
            </div>

            <PinInput
              label="Current PIN (Required)"
              icon={Lock}
              value={currentPin}
              onChange={setCurrentPin}
              show={showCurrentPin}
              onToggle={() => setShowCurrentPin(!showCurrentPin)}
              placeholder="Enter current 6-digit PIN"
            />

            <PinInput
              label="New PIN (Optional)"
              icon={Lock}
              value={newPin}
              onChange={setNewPin}
              show={showNewPin}
              onToggle={() => setShowNewPin(!showNewPin)}
              placeholder="Enter new 6-digit PIN"
            />

            <PinInput
              label="Confirm New PIN"
              icon={Lock}
              value={confirmPin}
              onChange={setConfirmPin}
              show={showConfirmPin}
              onToggle={() => setShowConfirmPin(!showConfirmPin)}
              placeholder="Re-enter new PIN"
            />

            {newPin && confirmPin && newPin === confirmPin && (
              <div className="flex items-center gap-2 text-green-500 text-xs font-semibold bg-green-500/10 p-2.5 rounded-lg">
                <CheckCircle2 size={14} /> PINs match
              </div>
            )}
            {newPin && confirmPin && newPin !== confirmPin && (
              <div className="flex items-center gap-2 text-red-500 text-xs font-semibold bg-red-500/10 p-2.5 rounded-lg">
                PINs do not match
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-2 pb-6">
            <button 
              type="submit" 
              disabled={isSaving || !currentPin}
              className="w-full h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {!currentPin && (
              <p className="text-xs text-text-light text-center mt-2 font-medium">Enter your current PIN to enable saving</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

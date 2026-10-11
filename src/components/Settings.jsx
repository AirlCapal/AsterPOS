import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hasMinRole, ROLE_LABELS } from '../db';
import {
  Save, Users, Store, Trash2, UserPlus, Shield, AlertTriangle,
  QrCode, Check, KeyRound, Eye, EyeOff, Upload, X, Power, PowerOff, Edit2,
  Building2, Wifi, RefreshCw, Send, CheckCircle2
} from 'lucide-react';
import WifiSyncSettings from './WifiSyncSettings';
import { maskEmail, maskPhone } from '../services/OtpService';
import cloudSyncService from '../services/cloudSyncService';

// --- Confirm Dialog ---
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, variant = 'primary' }) => {
  if (!isOpen) return null;
  const btnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-primary hover:bg-primary-dark text-white';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-text-main mb-2">{title}</h3>
          <p className="text-sm text-text-light leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button onClick={onCancel} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 min-h-[44px] rounded-xl font-semibold text-sm transition-all active:scale-95 ${btnClass}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- Toast ---
const Toast = ({ message, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed top-4 right-4 z-[70] bg-green-500 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2">
      <Check size={16} /> {message}
    </div>
  );
};

export default function Settings({ currentUser, syncState }) {
  const settingsData = useLiveQuery(() => db.app_settings.get('default'));
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const qrCodes = useLiveQuery(() => db.payment_qr_codes.toArray()) || [];

  const isManager = hasMinRole(currentUser?.role, 'manager');
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [formData, setFormData] = useState({
    taxRate: 12,
    currency: '₱',
    receiptFooter: 'Thank you!'
  });
  const [branchIdentifier, setBranchIdentifier] = useState('admin@airlunacreations.com');
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [syncTestResult, setSyncTestResult] = useState(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showPin, setShowPin] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });

  const qrInputRefs = useRef({});

  useEffect(() => {
    if (settingsData) {
      setFormData({
        taxRate: settingsData.taxRate || 12,
        currency: settingsData.currency || '₱',
        receiptFooter: settingsData.receiptFooter || ''
      });
      setBranchIdentifier(settingsData.branchIdentifier || settingsData.managerEmail || 'admin@airlunacreations.com');
    }
  }, [settingsData]);

  const flash = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const showConfirm = (title, message, onConfirm, variant = 'primary') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  };
  const closeConfirm = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

  const handleTestConnection = async () => {
    setIsTestingSync(true);
    setSyncTestResult(null);
    try {
      const cleanBranch = branchIdentifier.trim().toLowerCase();
      cloudSyncService.setBranch(cleanBranch);
      const res = await cloudSyncService.testConnection(null, cleanBranch);
      setSyncTestResult(res);
      if (res.ok) {
        flash(`Connected to cloud for branch [${cleanBranch}] ✓`);
      } else {
        flash(res.message);
      }
    } catch (err) {
      setSyncTestResult({ ok: false, message: err.message });
      flash('Sync test failed');
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncingNow(true);
    try {
      const cleanBranch = branchIdentifier.trim().toLowerCase();
      cloudSyncService.setBranch(cleanBranch);
      await cloudSyncService.triggerAutoSync();
      flash(`POS orders synced to branch [${cleanBranch}]!`);
    } catch (err) {
      flash('Sync notice: ' + err.message);
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleSave = () => {
    showConfirm('Save Settings', 'Save changes to store and branch configuration?', async () => {
      closeConfirm();
      const cleanBranch = branchIdentifier.trim().toLowerCase();
      const current = await db.app_settings.get('default') || {};
      await db.app_settings.put({
        ...current,
        id: 'default',
        taxRate: formData.taxRate,
        currency: formData.currency,
        receiptFooter: formData.receiptFooter,
        branchIdentifier: cleanBranch
      });
      cloudSyncService.setBranch(cleanBranch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      flash(`Settings saved for branch [${cleanBranch}]`);
    });
  };

  const handleDeleteUser = (user) => {
    // Managers can only delete cashiers
    if (currentUser.role === 'manager' && user.role !== 'cashier') {
      return flash('Managers can only manage Cashier accounts');
    }
    if (user.id === currentUser.id) return flash('Cannot delete your own account');

    showConfirm('Remove Staff', `Remove "${user.name}"? This cannot be undone.`, async () => {
      closeConfirm();
      await db.users.delete(user.id);
      flash('Staff member removed');
    }, 'danger');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const name = e.target.elements.staffName.value.trim();
    const pin = e.target.elements.staffPin.value;
    const role = e.target.elements.staffRole.value;
    const email = e.target.elements.staffEmail?.value.trim() || '';
    const phone = e.target.elements.staffPhone?.value.trim() || '';
    const otpPref = e.target.elements.staffOtpPref?.value || 'BOTH';

    if (!/^\d{6}$/.test(pin)) return flash('PIN must be exactly 6 digits');
    if (users.some(u => u.pin === pin)) return flash('This PIN is already taken');

    // Managers can only create cashiers
    if (currentUser.role === 'manager' && role !== 'cashier') {
      return flash('Managers can only create Cashier accounts');
    }

    if ((role === 'manager' || role === 'super_admin') && (!email || !phone)) {
      return flash('Email and Phone are mandatory for Manager accounts');
    }

    showConfirm('Add Staff', `Add new ${ROLE_LABELS[role]} account for "${name}"?`, async () => {
      closeConfirm();
      await db.users.add({
        name,
        pin,
        role,
        email,
        phone_number: phone,
        otp_delivery_preference: otpPref,
        is_active: 1
      });
      e.target.reset();
      flash('Staff member added');
    });
  };

  const handleEditUser = (user) => {
    if (currentUser.role === 'manager' && user.role !== 'cashier' && user.id !== currentUser.id) {
      return flash('Managers can only edit Cashier accounts');
    }
    setEditingUser({
      ...user,
      newPin: '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      otp_delivery_preference: user.otp_delivery_preference || 'BOTH'
    });
  };

  const handleSaveUserDetails = () => {
    if (!editingUser) return;
    if (editingUser.newPin && !/^\d{6}$/.test(editingUser.newPin)) return flash('PIN must be exactly 6 digits');
    if (editingUser.newPin && users.some(u => u.pin === editingUser.newPin && u.id !== editingUser.id)) return flash('This PIN is already taken');

    const isMgr = editingUser.role === 'manager' || editingUser.role === 'super_admin';
    if (isMgr && !editingUser.email?.trim()) return flash('Email is mandatory for manager accounts');
    if (isMgr && !editingUser.phone_number?.trim()) return flash('Phone number is mandatory for manager accounts');

    showConfirm('Save Staff Profile', `Save profile details for "${editingUser.name}"?`, async () => {
      closeConfirm();
      const updates = {
        name: editingUser.name.trim(),
        email: editingUser.email.trim(),
        phone_number: editingUser.phone_number.trim(),
        otp_delivery_preference: editingUser.otp_delivery_preference || 'BOTH'
      };
      if (editingUser.newPin) {
        updates.pin = editingUser.newPin;
      }
      await db.users.update(editingUser.id, updates);
      setEditingUser(null);
      flash('Staff profile updated');
    });
  };

  // QR Upload (managers can also upload QR codes)
  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Only image files are allowed')); return; }
      if (file.size > 5 * 1024 * 1024) { reject(new Error('File must be under 5MB')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleQrUpload = async (qrId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await db.payment_qr_codes.update(qrId, { qrDataUrl: dataUrl });
      flash('QR code uploaded');
    } catch (err) {
      flash(err.message);
    }
    e.target.value = '';
  };

  const handleToggleUserActive = async (user) => {
    if (currentUser.role === 'manager' && user.role !== 'cashier') {
      return flash('Managers can only manage Cashier accounts');
    }
    if (user.id === currentUser.id) return flash('Cannot deactivate your own account');
    const newStatus = user.is_active ? 0 : 1;
    await db.users.update(user.id, { is_active: newStatus });
    flash(`Account ${newStatus ? 'Activated' : 'Deactivated'}`);
  };

  // Filter staff that current manager can see/manage
  const managedUsers = currentUser.role === 'manager'
    ? users.filter(u => u.role === 'cashier')
    : users;

  return (
    <div className="p-3 sm:p-5 lg:p-8 h-full flex flex-col bg-background overflow-hidden">
      <Toast message={toastMsg} isVisible={showToast} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
        variant={confirmDialog.variant}
      />

      <div className="mb-4 sm:mb-6 lg:mb-8 flex-shrink-0">
        <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">System Settings</h2>
        <p className="text-text-light font-medium text-sm">Manage store details, QR codes, and staff access</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 overflow-y-auto lg:overflow-hidden min-h-0">

        {/* Store Settings + QR Management */}
        <div className="flex-1 lg:overflow-y-auto space-y-4 sm:space-y-6">
          
          {/* Wi-Fi Sync Configuration */}
          {syncState && <WifiSyncSettings syncState={syncState} />}

          {/* Multi-Branch & Cloud Sync Configuration */}
          <div className="bg-surface p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-text-main">Branch &amp; Cloud Sync</h3>
                  <p className="text-xs text-text-light font-medium">Multi-shop isolation &amp; automatic web synchronization</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active Branch: {cloudSyncService.getBranchKey()}
              </span>
            </div>

            <div className="bg-background border border-border rounded-xl p-3.5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-1">
                  Shop Branch Identifier / Manager Email
                </label>
                <input
                  type="text"
                  value={branchIdentifier}
                  onChange={e => setBranchIdentifier(e.target.value)}
                  placeholder="e.g. branch1@shop.com or BRANCH-001"
                  className="min-h-[42px] w-full px-3.5 bg-surface border border-border rounded-xl text-text-main text-sm font-semibold focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-text-light mt-1">
                  Sales and inventory for this POS tablet will sync exclusively to this branch. Safe for deploying across different shops.
                </p>
              </div>

              {syncTestResult && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  syncTestResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {syncTestResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{syncTestResult.message}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingSync || !branchIdentifier.trim()}
                  className="min-h-[38px] px-3.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Wifi size={13} className={isTestingSync ? 'animate-pulse text-primary' : 'text-primary'} />
                  <span>{isTestingSync ? 'Testing Connection...' : 'Test Cloud Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncingNow}
                  className="min-h-[38px] px-3.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isSyncingNow ? 'animate-spin' : ''} />
                  <span>{isSyncingNow ? 'Syncing...' : 'Sync POS to Cloud Now'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Store Settings */}
          <div className="bg-surface p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-border">
            <div className="flex items-center gap-2 mb-5 sm:mb-6 text-lg sm:text-xl font-semibold text-text-main"><Store size={22} /> Store Configuration</div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-1">Tax/VAT Rate (%)</label>
                  <input type="number" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value) || 0})} className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main" min="0" max="100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-1">Currency Symbol</label>
                  <input type="text" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main" maxLength={5} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-light mb-1">Receipt Footer Message</label>
                <input type="text" value={formData.receiptFooter} onChange={e => setFormData({...formData, receiptFooter: e.target.value})} className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main" maxLength={100} />
              </div>
              <button onClick={handleSave} className={`min-h-[48px] px-6 sm:px-8 rounded-xl font-semibold flex items-center gap-2 mt-4 shadow-lg transition-all active:scale-95 text-sm sm:text-base ${saved ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}>
                <Save size={17} /> {saved ? 'Saved ✓' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* QR Code Management (Manager + Super Admin) */}
          <div className="bg-surface p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-border">
            <div className="flex items-center gap-2 mb-5 sm:mb-6 text-lg sm:text-xl font-semibold text-text-main"><QrCode size={22} /> Payment QR Codes</div>
            <p className="text-sm text-text-light mb-4">Upload QR code images for cashless payment methods. These appear during checkout.</p>
            <div className="space-y-4">
              {qrCodes.map(qr => (
                <div key={qr.id} className="bg-background border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-surface border border-border rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {qr.qrDataUrl ? (
                      <img src={qr.qrDataUrl} alt={qr.methodName} className="w-full h-full object-contain p-1" />
                    ) : (
                      <QrCode size={24} className="text-text-light opacity-30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-main text-sm">{qr.label || qr.methodName}</p>
                    {qr.accountName && <p className="text-[11px] text-text-light truncate">{qr.accountName}</p>}
                    {qr.accountNumber && <p className="text-[11px] text-text-light truncate">{qr.accountNumber}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      ref={el => { qrInputRefs.current[qr.id] = el; }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={e => handleQrUpload(qr.id, e)}
                      className="hidden"
                    />
                    <button
                      onClick={() => qrInputRefs.current[qr.id]?.click()}
                      className="min-h-[36px] px-3 bg-surface-hover hover:bg-border border border-border text-text-main rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Upload size={13} /> {qr.qrDataUrl ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Management (Managers manage cashiers only) */}
        <div className="w-full lg:w-[420px] bg-surface p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-border flex flex-col lg:overflow-hidden flex-shrink-0">
          <div className="flex items-center gap-2 mb-5 sm:mb-6 text-lg sm:text-xl font-semibold text-text-main">
            <Users size={22} />
            {currentUser.role === 'manager' ? 'Cashier Management' : 'Staff & PIN Management'}
          </div>

          <form onSubmit={handleAddUser} className="mb-4 sm:mb-6 p-3 sm:p-4 bg-background border border-border rounded-xl space-y-2.5 sm:space-y-3 flex-shrink-0">
            <h4 className="font-semibold text-sm text-text-main flex items-center gap-1.5"><UserPlus size={15} /> Add New Staff</h4>
            <input type="text" name="staffName" placeholder="Staff Name" required className="min-h-[40px] w-full px-3 bg-surface border border-border rounded-lg text-sm text-text-main" maxLength={50} />
            <div className="flex gap-2">
              <input type="text" name="staffPin" placeholder="6-Digit PIN" required maxLength={6} pattern="\d{6}" inputMode="numeric" className="min-h-[40px] flex-1 px-3 bg-surface border border-border rounded-lg text-sm text-text-main" />
              <select name="staffRole" className="min-h-[40px] w-28 sm:w-32 px-2 bg-surface border border-border rounded-lg text-sm text-text-main">
                <option value="cashier">Cashier</option>
                {isSuperAdmin && <option value="manager">Manager</option>}
              </select>
            </div>
            <button type="submit" className="w-full min-h-[40px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-lg font-semibold text-sm transition-colors">Add Staff</button>
          </form>

          {/* Staff Edit / Profile Modal */}
          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
                <div className="p-5 border-b border-border bg-surface-hover flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-text-main flex items-center gap-2"><Edit2 size={18} /> Edit Staff Profile</h3>
                    <p className="text-xs text-text-light mt-0.5">{editingUser.name}</p>
                  </div>
                  <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded-full hover:bg-border flex items-center justify-center text-text-light">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-light mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="min-h-[40px] w-full px-3 bg-background border border-border rounded-xl text-text-main text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-light mb-1">New 6-Digit PIN (Optional)</label>
                    <input
                      type="text"
                      placeholder="Leave blank to keep current"
                      value={editingUser.newPin}
                      onChange={e => setEditingUser({ ...editingUser, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      className="min-h-[42px] w-full px-3 bg-background border border-border rounded-xl text-text-main text-sm font-semibold tracking-wider text-center"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </div>

                  {(editingUser.role === 'manager' || editingUser.role === 'super_admin') && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-primary flex items-center gap-1">
                        <Shield size={13} /> Manager OTP Contact Details
                      </p>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">Email (Gmail) *</label>
                        <input
                          type="email"
                          value={editingUser.email || ''}
                          onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                          className="min-h-[38px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                          placeholder="manager@airlunacreations.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">Mobile Phone (SMS) *</label>
                        <input
                          type="tel"
                          value={editingUser.phone_number || ''}
                          onChange={e => setEditingUser({ ...editingUser, phone_number: e.target.value })}
                          className="min-h-[38px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                          placeholder="+639123456789"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">OTP Preference</label>
                        <select
                          value={editingUser.otp_delivery_preference || 'BOTH'}
                          onChange={e => setEditingUser({ ...editingUser, otp_delivery_preference: e.target.value })}
                          className="min-h-[38px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main font-semibold"
                        >
                          <option value="BOTH">Both (Gmail & SMS)</option>
                          <option value="GMAIL">Gmail Email Only</option>
                          <option value="SMS">SMS Text Only</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditingUser(null)} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm">Cancel</button>
                    <button onClick={handleSaveUserDetails} className="flex-1 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all active:scale-95">Save</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1.5 sm:space-y-2 min-h-0">
            {managedUsers.map(u => (
              <div key={u.id} className="flex justify-between items-center p-3 bg-background border border-border rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${u.role === 'manager' || u.role === 'super_admin' ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-text-light'}`}>
                    <Shield size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-main text-sm truncate">{u.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-text-light">{ROLE_LABELS[u.role]}</span>
                      <button
                        onClick={() => setShowPin({ ...showPin, [u.id]: !showPin[u.id] })}
                        className="text-[11px] text-text-light hover:text-text-main flex items-center gap-0.5"
                      >
                        {showPin[u.id] ? <><EyeOff size={9} /> {u.pin}</> : <><Eye size={9} /> ••••</>}
                      </button>
                      {(u.role === 'manager' || u.role === 'super_admin') && (
                        <span className="text-[10px] text-text-light font-medium bg-surface px-1.5 py-0.5 rounded border border-border">
                          OTP: {u.otp_delivery_preference || 'BOTH'}
                        </span>
                      )}
                    </div>
                    {(u.role === 'manager' || u.role === 'super_admin') && (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-text-light font-medium">
                        {u.email && <span>✉️ {maskEmail(u.email)}</span>}
                        {u.phone_number && <span>📱 {maskPhone(u.phone_number)}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleUserActive(u)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${u.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/20'}`}
                    title={u.is_active ? "Deactivate Account" : "Activate Account"}
                  >
                    {u.is_active ? <Power size={13} /> : <PowerOff size={13} />}
                  </button>
                  <button onClick={() => handleEditUser(u)} className="text-text-light hover:text-primary font-medium text-xs px-2 py-1 hover:bg-primary/10 rounded-lg transition-colors flex-shrink-0" title="Edit Profile">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteUser(u)} className="text-text-light hover:text-red-500 font-medium text-xs px-2 py-1 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

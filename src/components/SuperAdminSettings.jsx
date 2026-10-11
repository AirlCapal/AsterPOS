import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ROLE_LABELS } from '../db';
import {
  Save, Users, Store, Trash2, UserPlus, Shield, AlertTriangle,
  Upload, Image as ImageIcon, QrCode, X, Eye, EyeOff, Crown,
  Download, DatabaseBackup, RotateCcw, Check, Edit2, KeyRound, Key, Layers, Power, PowerOff, ToggleLeft, ToggleRight,
  Receipt, Lock, Monitor, Mail, MessageSquare, Send, Copy, ExternalLink, CheckCircle2,
  LayoutDashboard, ClipboardList, BarChart3, Package, UtensilsCrossed, Network, Settings as SettingsGear, User as UserIcon, Wifi,
  RefreshCw, Building2, Globe
} from 'lucide-react';
import { testSendEmail, testSendSms, maskEmail, maskPhone } from '../services/OtpService';
import cloudSyncService, { normalizeBranchKey } from '../services/cloudSyncService';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// --- File-to-DataURL helper ---
const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('Only image files are allowed'));
      return;
    }
    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('File must be under 5MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const fileToJson = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(new Error('Invalid JSON format'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// --- Confirm Dialog (replaces native confirm/alert) ---
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

// --- Toast Notification ---
const Toast = ({ message, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed top-4 right-4 z-[70] bg-green-500 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2">
      <Check size={16} /> {message}
    </div>
  );
};

export default function SuperAdminSettings({ currentUser }) {
  const settingsData = useLiveQuery(() => db.app_settings.get('default'));
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const qrCodes = useLiveQuery(() => db.payment_qr_codes.toArray()) || [];
  const dbCategories = useLiveQuery(() => db.categories.orderBy('sort_order').toArray()) || [];

  const [activeSection, setActiveSection] = useState('categories');
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Branding state
  const [brandForm, setBrandForm] = useState({
    cafeName: '', receiptFooter: '', taxRate: 12, currency: '₱',
    storeAddress: '', storeContact: '', storeTIN: ''
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [iconPreview, setIconPreview] = useState('');

  // User management state
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    pin: '',
    role: 'cashier',
    email: '',
    phone_number: '',
    otp_delivery_preference: 'BOTH'
  });
  const [showPin, setShowPin] = useState({});

  // OTP Gateway state
  const [otpGatewayForm, setOtpGatewayForm] = useState({
    googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec',
    emailWebhookUrl: '',
    emailSenderAddress: 'airlunacreations@gmail.com',
    smsWebhookUrl: ''
  });
  const [testEmailTo, setTestEmailTo] = useState('manager@airlunacreations.com');
  const [testSmsTo, setTestSmsTo] = useState('+639123456789');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSms, setIsTestingSms] = useState(false);

  // Categories management state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '☕', status: 'Active', sort_order: 99 });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });

  // Multi-Branch Cloud Sync state
  const [branchIdentifier, setBranchIdentifier] = useState(() => cloudSyncService?.getBranchKey ? cloudSyncService.getBranchKey() : 'default');
  const [cloudRelayUrl, setCloudRelayUrl] = useState(() => cloudSyncService?.getGasUrl ? cloudSyncService.getGasUrl() : 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec');
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncTestResult, setSyncTestResult] = useState(null);

  const logoInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const qrInputRefs = useRef({});
  const importBackupRef = useRef(null);

  useEffect(() => {
    if (settingsData) {
      setBrandForm({
        cafeName: settingsData.cafeName || 'Aster POS',
        receiptFooter: settingsData.receiptFooter || '',
        taxRate: settingsData.taxRate || 12,
        currency: settingsData.currency || '₱',
        storeAddress: settingsData.storeAddress || '',
        storeContact: settingsData.storeContact || '',
        storeTIN: settingsData.storeTIN || ''
      });
      setLogoPreview(settingsData.logoDataUrl || '');
      setIconPreview(settingsData.iconDataUrl || '');
      const gasUrl = settingsData.googleAppsScriptUrl || 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec';
      setOtpGatewayForm({
        googleAppsScriptUrl: gasUrl,
        emailWebhookUrl: settingsData.emailWebhookUrl || '',
        emailSenderAddress: settingsData.emailSenderAddress || 'airlunacreations@gmail.com',
        smsWebhookUrl: settingsData.smsWebhookUrl || ''
      });
      if (settingsData.branchIdentifier) {
        setBranchIdentifier(settingsData.branchIdentifier);
      }
      if (settingsData.googleAppsScriptUrl) {
        setCloudRelayUrl(settingsData.googleAppsScriptUrl);
      }
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

  // --- BRANDING ---
  const handleSaveBranding = async () => {
    showConfirm('Save Branding', 'Save all branding and store configuration changes?', async () => {
      closeConfirm();
      // Preserve existing module settings and other fields
      const current = await db.app_settings.get('default') || {};
      await db.app_settings.put({
        ...current,
        id: 'default',
        ...brandForm,
        logoDataUrl: logoPreview,
        iconDataUrl: iconPreview
      });
      flash('Branding saved successfully');
    });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoPreview(dataUrl);
    } catch (err) {
      flash(err.message);
    }
    e.target.value = '';
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setIconPreview(dataUrl);
    } catch (err) {
      flash(err.message);
    }
    e.target.value = '';
  };

  // --- QR CODES ---
  const handleQrUpload = async (qrId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await db.payment_qr_codes.update(qrId, { qrDataUrl: dataUrl });
      flash('QR code image uploaded');
    } catch (err) {
      flash(err.message);
    }
    e.target.value = '';
  };

  const handleQrFieldUpdate = async (qrId, field, value) => {
    await db.payment_qr_codes.update(qrId, { [field]: value });
  };

  const handleRemoveQr = (qrId) => {
    showConfirm('Remove QR Image', 'Remove this QR code image? The payment method entry will remain.', async () => {
      closeConfirm();
      await db.payment_qr_codes.update(qrId, { qrDataUrl: '' });
      flash('QR image removed');
    }, 'danger');
  };

  // --- USER MANAGEMENT ---
  const handleAddUser = () => {
    if (!newUser.name.trim()) return flash('Name is required');
    if (!/^\d{6}$/.test(newUser.pin)) return flash('PIN must be exactly 6 digits');
    if (users.some(u => u.pin === newUser.pin)) return flash('This PIN is already taken');

    const isManagerRole = newUser.role === 'manager' || newUser.role === 'super_admin';
    if (isManagerRole && !newUser.email?.trim()) {
      return flash('Email is mandatory for Manager and Super Admin accounts');
    }
    if (isManagerRole && !newUser.phone_number?.trim()) {
      return flash('Mobile phone number is mandatory for Manager and Super Admin accounts');
    }

    // Only super_admin can create other super_admins
    if (newUser.role === 'super_admin' && currentUser.role !== 'super_admin') {
      return flash('Only Super Admins can create Super Admin accounts');
    }

    showConfirm('Add Staff', `Add new ${ROLE_LABELS[newUser.role]} account for "${newUser.name}"?`, async () => {
      closeConfirm();
      await db.users.add({
        name: newUser.name.trim(),
        username: (newUser.username || newUser.name.replace(/\s+/g, '').toLowerCase()).trim(),
        password: (newUser.password || newUser.pin).trim(),
        pin: newUser.pin,
        role: newUser.role,
        email: (newUser.email || '').trim(),
        phone_number: (newUser.phone_number || '').trim(),
        otp_delivery_preference: newUser.otp_delivery_preference || 'BOTH',
        is_active: 1
      });
      setNewUser({
        name: '',
        username: '',
        password: '',
        pin: '',
        role: 'cashier',
        email: '',
        phone_number: '',
        otp_delivery_preference: 'BOTH'
      });
      setShowAddUser(false);
      flash('Staff member added');
    });
  };

  const handleDeleteUser = (user) => {
    if (user.id === currentUser.id) return flash('Cannot delete your own account');
    // Protect the last super_admin
    if (user.role === 'super_admin') {
      const superAdminCount = users.filter(u => u.role === 'super_admin').length;
      if (superAdminCount <= 1) return flash('Cannot delete the last Super Admin');
    }
    showConfirm('Remove Staff', `Permanently remove "${user.name}" (${ROLE_LABELS[user.role]})? This cannot be undone.`, async () => {
      closeConfirm();
      await db.users.delete(user.id);
      flash('Staff member removed');
    }, 'danger');
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (user.id === currentUser.id) return flash('Cannot change your own role');
    if (user.role === 'super_admin') {
      const superAdminCount = users.filter(u => u.role === 'super_admin').length;
      if (superAdminCount <= 1) return flash('Cannot demote the last Super Admin');
    }
    await db.users.update(userId, { role: newRole });
    flash(`Role updated to ${ROLE_LABELS[newRole]}`);
  };

  const handleEditUser = (user) => {
    setEditingUser({
      ...user,
      newPin: user.pin || '',
      username: user.username || '',
      password: user.password || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      otp_delivery_preference: user.otp_delivery_preference || 'BOTH'
    });
  };

  const handleSaveUserDetails = () => {
    if (!editingUser) return;
    if (editingUser.newPin && !/^\d{6}$/.test(editingUser.newPin)) {
      return flash('PIN must be exactly 6 digits');
    }
    if (editingUser.newPin && users.some(u => u.pin === editingUser.newPin && u.id !== editingUser.id)) {
      return flash('This PIN is already taken');
    }

    const isManagerRole = editingUser.role === 'manager' || editingUser.role === 'super_admin';
    if (isManagerRole && !editingUser.email?.trim()) {
      return flash('Email is mandatory for manager accounts');
    }
    if (isManagerRole && !editingUser.phone_number?.trim()) {
      return flash('Phone number is mandatory for manager accounts');
    }

    showConfirm('Update Staff Profile', `Save profile details for "${editingUser.name}"?`, async () => {
      closeConfirm();
      const updates = {
        name: editingUser.name.trim(),
        username: (editingUser.username || '').trim(),
        password: (editingUser.password || '').trim(),
        email: (editingUser.email || '').trim(),
        phone_number: (editingUser.phone_number || '').trim(),
        otp_delivery_preference: editingUser.otp_delivery_preference || 'BOTH'
      };
      if (editingUser.newPin) {
        updates.pin = editingUser.newPin;
      }
      await db.users.update(editingUser.id, updates);
      setEditingUser(null);
      flash('Staff profile updated successfully');
    });
  };

  const handleToggleUserActive = async (user) => {
    if (user.id === currentUser.id) return flash('Cannot deactivate your own account');
    const newStatus = user.is_active ? 0 : 1;
    await db.users.update(user.id, { is_active: newStatus });
    flash(`Account ${newStatus ? 'Activated' : 'Deactivated'}`);
  };

  // --- CATEGORIES MANAGEMENT ---
  const handleAddCategory = () => {
    if (!newCategory.name.trim()) return flash('Category name is required');
    showConfirm('Add Category', `Add new category "${newCategory.name}"?`, async () => {
      closeConfirm();
      await db.categories.add({ 
        name: newCategory.name.trim(), 
        icon: newCategory.icon || '☕', 
        status: newCategory.status, 
        sort_order: parseInt(newCategory.sort_order) || 99 
      });
      setNewCategory({ name: '', icon: '☕', status: 'Active', sort_order: 99 });
      setShowAddCategory(false);
      flash('Category added successfully');
    });
  };

  const handleToggleCategoryStatus = async (category) => {
    const newStatus = category.status === 'Active' ? 'Disabled' : 'Active';
    await db.categories.update(category.id, { status: newStatus });
    flash(`Category ${newStatus}`);
  };

  const handleDeleteCategory = (category) => {
    showConfirm('Delete Category', `Permanently delete category "${category.name}"?`, async () => {
      closeConfirm();
      await db.categories.delete(category.id);
      flash('Category deleted');
    }, 'danger');
  };

  // --- SYSTEM ---
  const handleExportBackup = () => {
    showConfirm('Export Backup', 'Download a full database backup as JSON?', async () => {
      closeConfirm();
      const data = {
        exportDate: new Date().toISOString(),
        appVersion: '3.1',
        schemaVersion: db.verno,
        settings: await db.app_settings.toArray(),
        users: await db.users.toArray(),
        products: await db.products.toArray(),
        ingredients: await db.ingredients.toArray(),
        recipes: await db.recipes.toArray(),
        orders: await db.orders.toArray(),
        transactions: await db.transactions.toArray(),
        payment_qr_codes: await db.payment_qr_codes.toArray(),
        categories: await db.categories.toArray(),
        inventory_adjustments: await db.inventory_adjustments.toArray(),
        audit_logs: await db.audit_logs.toArray(),
        shift_sessions: await db.shift_sessions.toArray(),
        shift_closings: await db.shift_closings.toArray(),
        cash_payouts: await db.cash_payouts.toArray(),
        customers: await db.customers.toArray(),
        parked_orders: await db.parked_orders.toArray(),
        timecards: await db.timecards.toArray(),
        employee_payroll: await db.employee_payroll.toArray(),
        cancelled_orders_log: await db.cancelled_orders_log.toArray()
      };
      
      const fileName = `aster_backup_${new Date().toISOString().split('T')[0]}.json`;
      const jsonData = JSON.stringify(data, null, 2);

      if (Capacitor.isNativePlatform()) {
        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: jsonData,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });
          
          await Share.share({
            title: 'Aster POS Backup',
            text: 'Database backup from Aster POS',
            url: result.uri,
            dialogTitle: 'Save Backup File'
          });
          flash('Backup prepared for saving');
        } catch (err) {
          console.error(err);
          flash('Failed to save backup on device', 'danger');
        }
      } else {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        flash('Backup downloaded');
      }
    });
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await fileToJson(file);
      
      if (!data.users || !data.products) {
         throw new Error("Invalid backup file structure: missing users or products");
      }

      showConfirm(
        '⚠️ Restore Backup',
        `Importing will REPLACE your current local database with data from ${new Date(data.exportDate || Date.now()).toLocaleDateString()}. Proceed?`,
        async () => {
          closeConfirm();
          
          await db.transaction('rw', db.tables, async () => {
             for (const table of db.tables) {
                await table.clear();
             }
             
             // Sanitize & migrate app_settings to ensure latest modules and OTP defaults exist
             if (data.settings && data.settings.length > 0) {
               const allCashierDefaults = { pos: true, shift: true, sales: true, account: true, inventory: true, dashboard: false, menu: false, network: false, settings: false };
               const allManagerDefaults = { pos: true, shift: true, dashboard: true, sales: true, menu: true, network: true, settings: true, account: true, inventory: true };
               const sanitizedSettings = data.settings.map(s => ({
                 ...s,
                 googleAppsScriptUrl: s.googleAppsScriptUrl || 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec',
                 emailSenderAddress: s.emailSenderAddress || 'airlunacreations@gmail.com',
                 cashierModules: { ...allCashierDefaults, ...(s.cashierModules || {}) },
                 managerModules: { ...allManagerDefaults, ...(s.managerModules || {}) }
               }));
               await db.app_settings.bulkAdd(sanitizedSettings);
             }

             // Sanitize users to ensure new fields (email, phone, otp_delivery_preference) exist for all accounts
             if (data.users && data.users.length > 0) {
               const sanitizedUsers = data.users.map(u => ({
                 ...u,
                 email: typeof u.email === 'string' ? u.email.trim() : '',
                 phone_number: typeof u.phone_number === 'string' ? u.phone_number.trim() : '',
                 otp_delivery_preference: u.otp_delivery_preference || 'BOTH',
                 is_active: u.is_active !== undefined ? u.is_active : 1
               }));
               await db.users.bulkAdd(sanitizedUsers);
             }

             if (data.products && data.products.length > 0) await db.products.bulkAdd(data.products);
             if (data.ingredients && data.ingredients.length > 0) await db.ingredients.bulkAdd(data.ingredients);
             if (data.recipes && data.recipes.length > 0) await db.recipes.bulkAdd(data.recipes);
             if (data.orders && data.orders.length > 0) await db.orders.bulkAdd(data.orders);
             if (data.transactions && data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
             if (data.payment_qr_codes && data.payment_qr_codes.length > 0) await db.payment_qr_codes.bulkAdd(data.payment_qr_codes);
             if (data.categories && data.categories.length > 0) await db.categories.bulkAdd(data.categories);
             if (data.inventory_adjustments && data.inventory_adjustments.length > 0) await db.inventory_adjustments.bulkAdd(data.inventory_adjustments);
             if (data.audit_logs && data.audit_logs.length > 0) await db.audit_logs.bulkAdd(data.audit_logs);
             if (data.shift_sessions && data.shift_sessions.length > 0) await db.shift_sessions.bulkAdd(data.shift_sessions);
             if (data.shift_closings && data.shift_closings.length > 0) await db.shift_closings.bulkAdd(data.shift_closings);
             if (data.cash_payouts && data.cash_payouts.length > 0) await db.cash_payouts.bulkAdd(data.cash_payouts);
             if (data.customers && data.customers.length > 0) await db.customers.bulkAdd(data.customers);
             if (data.parked_orders && data.parked_orders.length > 0) await db.parked_orders.bulkAdd(data.parked_orders);
             if (data.timecards && data.timecards.length > 0) await db.timecards.bulkAdd(data.timecards);
             if (data.employee_payroll && data.employee_payroll.length > 0) await db.employee_payroll.bulkAdd(data.employee_payroll);
             if (data.cancelled_orders_log && data.cancelled_orders_log.length > 0) await db.cancelled_orders_log.bulkAdd(data.cancelled_orders_log);
          });
          
          flash('Backup restored successfully. Reloading...');
          setTimeout(() => window.location.reload(), 1500);
        },
        'danger'
      );
    } catch (err) {
      flash(err.message);
    }
    e.target.value = '';
  };

  const handleFactoryReset = () => {
    showConfirm(
      '⚠️ Factory Reset',
      'This will PERMANENTLY DELETE ALL DATA including sales history, products, staff accounts, and uploaded QR codes. This action CANNOT be undone. Are you absolutely sure?',
      () => {
        closeConfirm();
        // Double confirmation for destructive action
        showConfirm(
          'Final Confirmation',
          'Last chance: All data will be destroyed. Continue?',
          async () => {
            closeConfirm();
            await db.delete();
            window.location.reload();
          },
          'danger'
        );
      },
      'danger'
    );
  };

  // --- OTP GATEWAY HANDLERS ---
  const handleSaveOtpGateways = async () => {
    try {
      const current = await db.app_settings.get('default') || {};
      await db.app_settings.put({
        ...current,
        googleAppsScriptUrl: otpGatewayForm.googleAppsScriptUrl.trim(),
        emailWebhookUrl: otpGatewayForm.emailWebhookUrl.trim(),
        emailSenderAddress: 'airlunacreations@gmail.com',
        smsWebhookUrl: otpGatewayForm.smsWebhookUrl.trim()
      });
      flash('OTP Gateway settings saved successfully');
    } catch (err) {
      flash(err.message || 'Failed to save gateway settings');
    }
  };

  const handleTestSendEmail = async () => {
    if (!testEmailTo) {
      flash('Enter a destination email address for testing');
      return;
    }
    setIsTestingEmail(true);
    try {
      // First save current form so test uses latest values
      await handleSaveOtpGateways();
      const res = await testSendEmail(testEmailTo);
      flash(`Test email sent successfully to ${testEmailTo}!`);
    } catch (err) {
      flash(err.message || 'Email test failed');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestSendSms = async () => {
    if (!testSmsTo) {
      flash('Enter a destination mobile number for testing');
      return;
    }
    setIsTestingSms(true);
    try {
      // First save current form so test uses latest values
      await handleSaveOtpGateways();
      const res = await testSendSms(testSmsTo);
      flash(`Test SMS dispatched successfully to ${testSmsTo}!`);
    } catch (err) {
      flash(err.message || 'SMS test failed');
    } finally {
      setIsTestingSms(false);
    }
  };

  const googleAppsScriptSnippet = `/**
 * Aster POS — Multi-Branch Two-Way Cloud Relay & OTP Mailer
 * --------------------------------------------------------------------------------
 * Fully supports isolated multi-shop branches and free Gmail OTP.
 */
var FOLDER_NAME = "AsterPOS_Sync_Branches";

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = (params && params.action) ? params.action : "";
    var branch = normalizeBranch(params ? params.branch : "default");

    if (action === "TEST_CONNECTION" || action === "PING") {
      return createJsonResponse({
        success: true,
        status: "active",
        service: "Aster POS Multi-Branch Cloud Relay",
        branch: branch,
        message: "Successfully connected to Aster Cloud Relay for branch [" + branch + "] ✓",
        timestamp: Date.now()
      });
    }

    if (action === "GET_SYNC_DATA") {
      var snapshot = loadBranchSnapshot(branch);
      var metadata = loadBranchMetadata(branch);
      return createJsonResponse({
        success: true,
        branch: branch,
        snapshot: snapshot,
        source: metadata.lastSource || "POS",
        mutationTimestamp: metadata.mutationTimestamp || 0,
        updatedAt: metadata.updatedAt || null
      });
    }

    if (action === "LIST_BRANCHES") {
      return createJsonResponse({
        success: true,
        branches: listAllBranches()
      });
    }

    return createJsonResponse({
      status: "active",
      service: "Aster POS Multi-Branch Cloud Relay",
      poweredBy: "AirLuna Creations",
      sender: "airlunacreations@gmail.com"
    });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "{}";
    var data = {};
    try { data = JSON.parse(raw); } catch (err) { data = {}; }

    var action = data.action || (e.parameter ? e.parameter.action : "");
    var branch = normalizeBranch(data.branch || (e.parameter ? e.parameter.branch : "default"));

    if (action === "PUSH_SYNC_DATA" || action === "PUSH_WEB_UPDATE") {
      var source = data.source || (action === "PUSH_WEB_UPDATE" ? "WEB" : "POS");
      var timestamp = data.timestamp || Date.now();
      saveBranchSnapshot(branch, data, source, timestamp);
      return createJsonResponse({
        success: true,
        branch: branch,
        source: source,
        message: "Branch [" + branch + "] saved successfully (" + source + ")"
      });
    }

    if (action === "SEND_OTP" || data.to) {
      MailApp.sendEmail({
        to: data.to,
        subject: data.subject || ("Aster POS Verification: " + data.code),
        body: "Aster POS Verification Code: " + data.code + "\\nAction: " + (data.actionName || "Override") + "\\nBranch: " + branch,
        name: "Aster POS (" + branch + ")"
      });
      return createJsonResponse({ success: true, message: "Email sent to " + data.to });
    }

    return createJsonResponse({ success: false, message: "Unrecognized action: " + action });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeBranch(str) {
  if (!str) return "default";
  var clean = String(str).toLowerCase().trim();
  clean = clean.replace(/[^a-z0-9_@.-]/g, "_");
  return clean || "default";
}

function getBranchFolder() {
  try {
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  } catch (e) { return null; }
}

function saveBranchSnapshot(branchKey, dataObj, source, timestamp) {
  var safeKey = normalizeBranch(branchKey);
  var payloadString = JSON.stringify(dataObj);
  var metaObj = { branch: safeKey, updatedAt: new Date().toISOString(), lastSource: source, mutationTimestamp: timestamp };
  try {
    var folder = getBranchFolder();
    if (folder) {
      var f = folder.getFilesByName("branch_" + safeKey + ".json");
      if (f.hasNext()) { f.next().setContent(payloadString); }
      else { folder.createFile("branch_" + safeKey + ".json", payloadString, MimeType.PLAIN_TEXT); }

      var mf = folder.getFilesByName("meta_" + safeKey + ".json");
      if (mf.hasNext()) { mf.next().setContent(JSON.stringify(metaObj)); }
      else { folder.createFile("meta_" + safeKey + ".json", JSON.stringify(metaObj), MimeType.PLAIN_TEXT); }
      return;
    }
  } catch (e) {}
}

function loadBranchSnapshot(branchKey) {
  var safeKey = normalizeBranch(branchKey);
  try {
    var folder = getBranchFolder();
    if (folder) {
      var f = folder.getFilesByName("branch_" + safeKey + ".json");
      if (f.hasNext()) { return JSON.parse(f.next().getBlob().getDataAsString()); }
    }
  } catch (e) {}
  return null;
}

function loadBranchMetadata(branchKey) {
  var safeKey = normalizeBranch(branchKey);
  try {
    var folder = getBranchFolder();
    if (folder) {
      var f = folder.getFilesByName("meta_" + safeKey + ".json");
      if (f.hasNext()) { return JSON.parse(f.next().getBlob().getDataAsString()); }
    }
  } catch (e) {}
  return {};
}

function listAllBranches() {
  var list = [];
  try {
    var folder = getBranchFolder();
    if (folder) {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var n = files.next().getName();
        if (n.indexOf("meta_") === 0 && n.indexOf(".json") > 0) {
          list.push(n.replace("meta_", "").replace(".json", ""));
        }
      }
    }
  } catch (e) {}
  return list;
}`;

  const handleCopyGoogleScript = () => {
    navigator.clipboard.writeText(googleAppsScriptSnippet);
    flash('Google Apps Script code copied to clipboard!');
  };

  const handleTestCloudConnection = async () => {
    setIsTestingSync(true);
    setSyncTestResult(null);
    try {
      const result = await cloudSyncService.testConnection(cloudRelayUrl, branchIdentifier);
      setSyncTestResult(result);
      if (result.ok) {
        flash(result.message);
      } else {
        flash(result.message || 'Connection failed');
      }
    } catch (err) {
      setSyncTestResult({ ok: false, message: err.message || 'Error testing connection' });
      flash('Connection test failed');
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleSaveBranchSettings = async () => {
    const cleanKey = normalizeBranchKey(branchIdentifier);
    await cloudSyncService.setBranch(cleanKey);
    const current = await db.app_settings.get('default') || {};
    await db.app_settings.put({
      ...current,
      id: 'default',
      branchIdentifier: cleanKey,
      googleAppsScriptUrl: (cloudRelayUrl || '').trim() || current.googleAppsScriptUrl
    });
    flash(`Branch isolation saved: ${cleanKey}`);
  };

  const handleTriggerBranchSync = async () => {
    setIsSyncingNow(true);
    try {
      await cloudSyncService.syncAll();
      flash('Sync completed successfully!');
    } catch (err) {
      flash('Sync error: ' + (err.message || 'Failed'));
    } finally {
      setIsSyncingNow(false);
    }
  };

  const sections = [
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'branding', label: 'Branding', icon: Store, tourId: 'audit-store-name' },
    { id: 'qrcodes', label: 'QR Codes', icon: QrCode },
    { id: 'users', label: 'Staff', icon: Users, tourId: 'audit-staff-btn' },
    { id: 'cloud_sync', label: 'Multi-Branch Sync', icon: Wifi },
    { id: 'otp', label: 'OTP Gateways', icon: Send },
    { id: 'system', label: 'System', icon: DatabaseBackup, tourId: 'audit-logs' },
    { id: 'license', label: 'License', icon: KeyRound }
  ];

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super_admin': return 'bg-amber-500/15 text-amber-600 border-amber-500/25';
      case 'manager': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-surface-hover text-text-light border-border';
    }
  };

  const getRoleIcon = (role) => {
    if (role === 'super_admin') return <Crown size={13} />;
    return <Shield size={13} />;
  };

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

      {/* Header */}
      <div className="mb-4 sm:mb-6 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Crown size={20} className="text-amber-500" />
          <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Super Admin Settings</h2>
        </div>
        <p className="text-text-light font-medium text-sm">System branding, QR codes, staff management & database controls</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 sm:mb-6 flex-shrink-0 pb-0.5">
        {sections.map(s => (
          <button
            key={s.id}
            id={s.tourId}
            onClick={() => setActiveSection(s.id)}
            className={`min-h-[40px] sm:min-h-[44px] px-4 sm:px-5 rounded-xl whitespace-nowrap font-semibold flex items-center gap-2 transition-all border text-sm ${
              activeSection === s.id
                ? 'bg-primary border-primary text-white shadow-md'
                : 'bg-surface border-border text-text-main hover:border-primary/50'
            }`}
          >
            <s.icon size={16} /> {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ===== CATEGORIES SECTION ===== */}
        {activeSection === 'categories' && (
          <div className="max-w-2xl space-y-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-text-light font-medium">Manage POS menu categories</p>
              <button
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="min-h-[40px] px-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center gap-2 text-sm transition-all active:scale-95"
              >
                <Layers size={16} /> Add Category
              </button>
            </div>

            {showAddCategory && (
              <div className="bg-surface p-5 rounded-2xl border-2 border-primary/30 shadow-lg mb-4">
                <h4 className="font-semibold text-text-main mb-4 flex items-center gap-2">
                  <Layers size={18} /> New Category
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Icon/Emoji (e.g. ☕)"
                      value={newCategory.icon}
                      onChange={e => setNewCategory({ ...newCategory, icon: e.target.value })}
                      className="min-h-[44px] w-24 px-3 bg-background border border-border rounded-xl text-text-main text-sm text-center"
                      maxLength={5}
                    />
                    <input
                      type="text"
                      placeholder="Category Name"
                      value={newCategory.name}
                      onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                      className="min-h-[44px] flex-1 px-4 bg-background border border-border rounded-xl text-text-main text-sm"
                      maxLength={50}
                    />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="Sort Order"
                      value={newCategory.sort_order}
                      onChange={e => setNewCategory({ ...newCategory, sort_order: e.target.value })}
                      className="min-h-[44px] flex-1 px-4 bg-background border border-border rounded-xl text-text-main text-sm"
                    />
                    <select
                      value={newCategory.status}
                      onChange={e => setNewCategory({ ...newCategory, status: e.target.value })}
                      className="min-h-[44px] flex-1 px-3 bg-background border border-border rounded-xl text-text-main text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowAddCategory(false); setNewCategory({ name: '', icon: '☕', status: 'Active', sort_order: 99 }); }} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
                    <button onClick={handleAddCategory} className="flex-1 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all active:scale-95">Save Category</button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {dbCategories.map(cat => (
                <div key={cat.id} className={`bg-surface p-4 rounded-xl border flex items-center gap-3 transition-colors ${cat.status === 'Active' ? 'border-border hover:border-primary/20' : 'border-dashed border-border opacity-60'}`}>
                  <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 text-lg">
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-main text-sm truncate">{cat.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {cat.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-light mt-0.5">Sort Order: {cat.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleCategoryStatus(cat)}
                      className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors border ${cat.status === 'Active' ? 'bg-surface-hover text-text-light border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white'}`}
                    >
                      {cat.status === 'Active' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background hover:bg-red-500/10 hover:text-red-500 text-text-light border border-border transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== BRANDING SECTION ===== */}
        {activeSection === 'branding' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border">
              <h3 className="text-lg font-semibold text-text-main mb-5 flex items-center gap-2">
                <Store size={20} /> Store Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-1">App / Café Name</label>
                  <input
                    type="text"
                    value={brandForm.cafeName}
                    onChange={e => setBrandForm({ ...brandForm, cafeName: e.target.value })}
                    className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main font-medium"
                    placeholder="e.g. Aster POS"
                    maxLength={50}
                  />
                  <p className="text-xs text-text-light mt-1">This name appears in the header, lock screen, and receipts</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-light mb-1">Tax/VAT Rate (%)</label>
                    <input
                      type="number"
                      value={brandForm.taxRate}
                      onChange={e => setBrandForm({ ...brandForm, taxRate: parseFloat(e.target.value) || 0 })}
                      className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-light mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      value={brandForm.currency}
                      onChange={e => setBrandForm({ ...brandForm, currency: e.target.value })}
                      className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                      maxLength={5}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-1">Receipt Footer Message</label>
                  <input
                    type="text"
                    value={brandForm.receiptFooter}
                    onChange={e => setBrandForm({ ...brandForm, receiptFooter: e.target.value })}
                    className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                    maxLength={100}
                    placeholder="e.g. Thank you for visiting!"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Store Details */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border">
              <h3 className="text-lg font-semibold text-text-main mb-2 flex items-center gap-2">
                <Receipt size={20} /> Receipt Details
              </h3>
              <p className="text-sm text-text-light mb-5">These details appear on printed receipts and PDF exports below the store name.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-1">Store Address</label>
                  <input
                    type="text"
                    value={brandForm.storeAddress}
                    onChange={e => setBrandForm({ ...brandForm, storeAddress: e.target.value })}
                    className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                    placeholder="e.g. 123 Main St, Makati City"
                    maxLength={120}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-light mb-1">Contact Number</label>
                    <input
                      type="text"
                      value={brandForm.storeContact}
                      onChange={e => setBrandForm({ ...brandForm, storeContact: e.target.value })}
                      className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                      placeholder="e.g. 0917-123-4567"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-light mb-1">TIN / Tax ID</label>
                    <input
                      type="text"
                      value={brandForm.storeTIN}
                      onChange={e => setBrandForm({ ...brandForm, storeTIN: e.target.value })}
                      className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-text-main"
                      placeholder="e.g. 000-123-456-789"
                      maxLength={30}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Logo & Icon Upload */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border">
              <h3 className="text-lg font-semibold text-text-main mb-5 flex items-center gap-2">
                <ImageIcon size={20} /> Logo & Icon
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Header Logo */}
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-2">Header Logo</label>
                  <div className="bg-background border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] relative group hover:border-primary/50 transition-colors">
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo preview" className="max-h-20 max-w-full object-contain rounded-lg" />
                        <button
                          onClick={() => setLogoPreview('')}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="text-text-light text-center">
                        <Upload size={28} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-medium">Upload logo image</p>
                      </div>
                    )}
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                    <button onClick={() => logoInputRef.current?.click()} className="mt-3 min-h-[36px] px-4 bg-surface-hover hover:bg-border border border-border text-text-main rounded-lg font-semibold text-xs transition-colors">
                      {logoPreview ? 'Replace' : 'Choose File'}
                    </button>
                  </div>
                </div>

                {/* App Icon */}
                <div>
                  <label className="block text-sm font-semibold text-text-light mb-2">App Icon</label>
                  <div className="bg-background border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] relative group hover:border-primary/50 transition-colors">
                    {iconPreview ? (
                      <>
                        <img src={iconPreview} alt="Icon preview" className="w-16 h-16 object-cover rounded-2xl shadow-md" />
                        <button
                          onClick={() => setIconPreview('')}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="text-text-light text-center">
                        <Upload size={28} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-medium">Upload app icon</p>
                      </div>
                    )}
                    <input ref={iconInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleIconUpload} className="hidden" />
                    <button onClick={() => iconInputRef.current?.click()} className="mt-3 min-h-[36px] px-4 bg-surface-hover hover:bg-border border border-border text-text-main rounded-lg font-semibold text-xs transition-colors">
                      {iconPreview ? 'Replace' : 'Choose File'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleSaveBranding} className="min-h-[48px] px-8 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-all active:scale-95">
              <Save size={18} /> Save All Branding
            </button>
          </div>
        )}

        {/* ===== QR CODES SECTION ===== */}
        {activeSection === 'qrcodes' && (
          <div className="max-w-2xl space-y-4">
            <p className="text-sm text-text-light font-medium mb-2">
              Upload QR code images for each payment method. These will appear in the Payment Modal when processing cashless payments.
            </p>
            {qrCodes.map(qr => (
              <div key={qr.id} className="bg-surface p-5 sm:p-6 rounded-2xl border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-main">{qr.label || qr.methodName}</h4>
                    <p className="text-xs text-text-light">Payment QR for {qr.methodName}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  {/* QR Image */}
                  <div className="sm:w-40 flex-shrink-0">
                    <div className="bg-background border-2 border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center min-h-[140px] relative group hover:border-primary/50 transition-colors">
                      {qr.qrDataUrl ? (
                        <>
                          <img src={qr.qrDataUrl} alt={`${qr.methodName} QR`} className="max-h-24 max-w-full object-contain rounded-lg" />
                          <button
                            onClick={() => handleRemoveQr(qr.id)}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <div className="text-text-light text-center">
                          <QrCode size={32} className="mx-auto mb-1 opacity-30" />
                          <p className="text-[10px] font-medium">No QR uploaded</p>
                        </div>
                      )}
                      <input
                        ref={el => { qrInputRefs.current[qr.id] = el; }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleQrUpload(qr.id, e)}
                        className="hidden"
                      />
                      <button
                        onClick={() => qrInputRefs.current[qr.id]?.click()}
                        className="mt-2 min-h-[32px] px-3 bg-surface-hover hover:bg-border border border-border text-text-main rounded-lg font-semibold text-[11px] transition-colors"
                      >
                        {qr.qrDataUrl ? 'Replace' : 'Upload'}
                      </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1">Display Label</label>
                      <input
                        type="text"
                        defaultValue={qr.label}
                        onBlur={e => handleQrFieldUpdate(qr.id, 'label', e.target.value)}
                        className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-text-main text-sm"
                        maxLength={30}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1">Account Name</label>
                      <input
                        type="text"
                        defaultValue={qr.accountName}
                        onBlur={e => handleQrFieldUpdate(qr.id, 'accountName', e.target.value)}
                        className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-text-main text-sm"
                        placeholder="e.g. Juan D. Cruz"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1">Account Number</label>
                      <input
                        type="text"
                        defaultValue={qr.accountNumber}
                        onBlur={e => handleQrFieldUpdate(qr.id, 'accountNumber', e.target.value)}
                        className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-text-main text-sm"
                        placeholder="e.g. 09XX XXX XXXX"
                        maxLength={30}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== USER MANAGEMENT SECTION ===== */}
        {activeSection === 'users' && (
          <div className="max-w-2xl space-y-4">
            {/* Add User Button */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-text-light font-medium">Manage all staff accounts and PINs</p>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="min-h-[40px] px-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center gap-2 text-sm transition-all active:scale-95"
              >
                <UserPlus size={16} /> Add Staff
              </button>
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <div className="bg-surface p-5 rounded-2xl border-2 border-primary/30 shadow-lg">
                <h4 className="font-semibold text-text-main mb-4 flex items-center gap-2">
                  <UserPlus size={18} /> New Staff Account
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Staff Full Name *"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    className="min-h-[44px] w-full px-4 bg-background border border-border rounded-xl text-text-main text-sm"
                    maxLength={50}
                  />
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="6-Digit PIN *"
                      value={newUser.pin}
                      onChange={e => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      className="min-h-[44px] flex-1 px-4 bg-background border border-border rounded-xl text-text-main text-sm font-semibold tracking-wider"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="\d{6}"
                    />
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                      className="min-h-[44px] w-36 px-3 bg-background border border-border rounded-xl text-text-main text-sm font-semibold"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      {currentUser.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                    </select>
                  </div>

                  {/* Manager Web Portal Credentials (Username & Password for Website) */}
                  {(newUser.role === 'manager' || newUser.role === 'super_admin') && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2.5">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Key size={14} /> Website Login Credentials (For Manager Web Portal)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-light mb-1">
                            Web Username
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. manager1"
                            value={newUser.username}
                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                            className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-light mb-1">
                            Web Password
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. secret123"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-text-light">Used to log in to the Manager Web Portal (not numeric PIN).</p>
                    </div>
                  )}

                  {/* Contact fields for all roles (mandatory for manager/super_admin, optional for cashier) */}
                  <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5">
                    <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Shield size={14} /> Contact Details &amp; PIN Reset Recovery
                      {newUser.role === 'cashier' ? (
                        <span className="text-[10px] text-text-light font-normal">(Optional for Cashiers)</span>
                      ) : (
                        <span className="text-[10px] text-primary font-bold">(Required for Override)</span>
                      )}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">
                          Email Address (Gmail) {newUser.role !== 'cashier' && '*'}
                        </label>
                        <input
                          type="email"
                          placeholder={newUser.role === 'cashier' ? "cashier@gmail.com (for Forgot PIN)" : "manager@airlunacreations.com"}
                          value={newUser.email}
                          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                          className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">
                          Mobile Phone (SMS) {newUser.role !== 'cashier' && '*'}
                        </label>
                        <input
                          type="tel"
                          placeholder="+639123456789"
                          value={newUser.phone_number}
                          onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })}
                          className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-text-light mb-1">OTP Delivery Preference</label>
                      <select
                        value={newUser.otp_delivery_preference}
                        onChange={e => setNewUser({ ...newUser, otp_delivery_preference: e.target.value })}
                        className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main font-semibold"
                      >
                        <option value="BOTH">Both (Gmail &amp; SMS)</option>
                        <option value="GMAIL">Gmail Email Only</option>
                        <option value="SMS">SMS Text Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowAddUser(false); setNewUser({ name: '', pin: '', role: 'cashier', email: '', phone_number: '', otp_delivery_preference: 'BOTH' }); }} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm transition-colors">Cancel</button>
                    <button onClick={handleAddUser} className="flex-1 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all active:scale-95">Add Staff</button>
                  </div>
                </div>
              </div>
            )}

            {/* Profile & PIN Edit Modal */}
            {editingUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in">
                  <div className="p-5 border-b border-border bg-surface-hover flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-text-main flex items-center gap-2"><Edit2 size={18} /> Edit Staff Profile</h3>
                      <p className="text-xs text-text-light mt-0.5">Manage details and recovery contact for {editingUser.name}</p>
                    </div>
                    <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded-full hover:bg-border flex items-center justify-center text-text-light">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editingUser.name}
                        onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                        className="min-h-[42px] w-full px-3 bg-background border border-border rounded-xl text-text-main text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1">New 6-Digit PIN (Optional)</label>
                      <input
                        type="text"
                        placeholder="Leave blank to keep existing"
                        value={editingUser.newPin}
                        onChange={e => setEditingUser({ ...editingUser, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        className="min-h-[44px] w-full px-4 bg-background border border-border rounded-xl text-text-main font-semibold tracking-wider text-sm"
                        maxLength={6}
                        inputMode="numeric"
                      />
                    </div>

                    {/* Manager Web Portal Credentials */}
                    {(editingUser.role === 'manager' || editingUser.role === 'super_admin') && (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2.5">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Key size={14} /> Website Login Credentials (For Manager Web Portal)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-light mb-1">
                              Web Username
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. manager1"
                              value={editingUser.username || ''}
                              onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                              className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-text-light mb-1">
                              Web Password
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. secret123"
                              value={editingUser.password || ''}
                              onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                              className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-text-light">Used to log in to the Manager Web Portal (not numeric PIN).</p>
                      </div>
                    )}

                    <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Shield size={14} /> Contact Details &amp; PIN Reset Recovery
                        {editingUser.role === 'cashier' ? (
                          <span className="text-[10px] text-text-light font-normal">(Optional for Cashiers)</span>
                        ) : (
                          <span className="text-[10px] text-primary font-bold">(Required for Override)</span>
                        )}
                      </p>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">
                          Email Address (Gmail) {editingUser.role !== 'cashier' && '*'}
                        </label>
                        <input
                          type="email"
                          value={editingUser.email || ''}
                          onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                          className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                          placeholder={editingUser.role === 'cashier' ? "cashier@gmail.com (for Forgot PIN)" : "manager@airlunacreations.com"}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">
                          Mobile Phone (SMS) {editingUser.role !== 'cashier' && '*'}
                        </label>
                        <input
                          type="tel"
                          value={editingUser.phone_number || ''}
                          onChange={e => setEditingUser({ ...editingUser, phone_number: e.target.value })}
                          className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main"
                          placeholder="+639123456789"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-light mb-1">OTP Delivery Preference</label>
                        <select
                          value={editingUser.otp_delivery_preference || 'BOTH'}
                          onChange={e => setEditingUser({ ...editingUser, otp_delivery_preference: e.target.value })}
                          className="min-h-[40px] w-full px-3 bg-background border border-border rounded-lg text-xs text-text-main font-semibold"
                        >
                          <option value="BOTH">Both (Gmail &amp; SMS)</option>
                          <option value="GMAIL">Gmail Email Only</option>
                          <option value="SMS">SMS Text Only</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setEditingUser(null)} className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm">Cancel</button>
                      <button onClick={handleSaveUserDetails} className="flex-1 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-all active:scale-95">Save Changes</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User List */}
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="bg-surface p-4 rounded-xl border border-border flex items-center gap-3 hover:border-primary/20 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getRoleBadgeClass(u.role)}`}>
                    {getRoleIcon(u.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-main text-sm truncate">{u.name}</p>
                      {u.id === currentUser.id && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">YOU</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeClass(u.role)}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                      <button
                        onClick={() => setShowPin({ ...showPin, [u.id]: !showPin[u.id] })}
                        className="text-[11px] text-text-light hover:text-text-main flex items-center gap-1 transition-colors"
                      >
                        {showPin[u.id] ? <><EyeOff size={10} /> {u.pin}</> : <><Eye size={10} /> ••••</>}
                      </button>
                      {(u.email || u.phone_number) && (
                        <span className="text-[10px] text-text-light font-medium bg-background px-2 py-0.5 rounded border border-border">
                          OTP: {u.otp_delivery_preference || 'BOTH'}
                        </span>
                      )}
                    </div>
                    {(u.email || u.phone_number) && (
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-text-light font-medium">
                        {u.email && <span>✉️ {maskEmail(u.email)}</span>}
                        {u.phone_number && <span>📱 {maskPhone(u.phone_number)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Status Toggle */}
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => handleToggleUserActive(u)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${u.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/20'}`}
                        title={u.is_active ? "Deactivate Account" : "Activate Account"}
                      >
                        {u.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                      </button>
                    )}
                    
                    {/* Role selector */}
                    {u.id !== currentUser.id && (
                      <select
                        value={u.role}
                        onChange={e => handleUpdateUserRole(u.id, e.target.value)}
                        className="h-8 px-2 bg-background border border-border rounded-lg text-[11px] font-semibold text-text-main"
                      >
                        <option value="cashier">Cashier</option>
                        <option value="manager">Manager</option>
                        {currentUser.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                      </select>
                    )}
                    <button
                      onClick={() => handleEditUser(u)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background hover:bg-primary/10 hover:text-primary text-text-light border border-border transition-colors"
                      title="Edit Profile & Credentials"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background hover:bg-red-500/10 hover:text-red-500 text-text-light border border-border transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== MULTI-BRANCH CLOUD SYNC SECTION ===== */}
        {activeSection === 'cloud_sync' && (
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface p-5 rounded-2xl border border-border">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Building2 className="text-primary" size={20} /> Multi-Branch Cloud Sync &amp; Isolation
                </h3>
                <p className="text-xs text-text-light mt-0.5">
                  Isolate shop data by <strong>Manager Email</strong> or unique <strong>Branch Code</strong>. No data leaks between branches.
                </p>
              </div>
              <button
                onClick={handleSaveBranchSettings}
                className="min-h-[44px] px-5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold flex items-center gap-2 text-sm shadow-md transition-all active:scale-95"
              >
                <Save size={16} /> Save Branch Config
              </button>
            </div>

            {/* Active Partition Info */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-light uppercase tracking-wider">Active Shop Partition</span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {cloudSyncService.getBranchKey()}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  Shop Branch Identifier / Manager Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={branchIdentifier}
                  onChange={e => setBranchIdentifier(e.target.value)}
                  placeholder="e.g. manager.downtown@cafe.com or BRANCH-001"
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm font-semibold text-text-main focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-text-light mt-1.5">
                  This POS terminal will exclusively sync products, sales, stock, and staff with this partition. Use the same email to log into the Web Manager portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                  Cloud Relay Endpoint (Google Apps Script Web App URL)
                </label>
                <input
                  type="url"
                  value={cloudRelayUrl}
                  onChange={e => setCloudRelayUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              {syncTestResult && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
                  syncTestResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {syncTestResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{syncTestResult.message}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleTestCloudConnection}
                  disabled={isTestingSync || !branchIdentifier.trim()}
                  className="min-h-[42px] px-4 rounded-xl border border-border bg-background hover:bg-surface-hover text-text-main text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Wifi size={14} className={isTestingSync ? 'animate-pulse text-primary' : 'text-primary'} />
                  <span>{isTestingSync ? 'Connecting to Cloud...' : 'Test Cloud Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTriggerBranchSync}
                  disabled={isSyncingNow}
                  className="min-h-[42px] px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncingNow ? 'animate-spin' : ''} />
                  <span>{isSyncingNow ? 'Syncing...' : 'Sync Now with Cloud'}</span>
                </button>
              </div>
            </div>

            {/* Google Apps Script Deployment Instructions */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Globe size={16} className="text-primary" /> Google Apps Script Cloud Relay Setup
                  </h4>
                  <p className="text-xs text-text-light mt-0.5">
                    Free, permanent backend for both multi-branch sync and OTP delivery.
                  </p>
                </div>
                <button
                  onClick={handleCopyGoogleScript}
                  className="px-3 py-1.5 bg-background hover:bg-surface-hover border border-border rounded-lg text-xs font-bold text-text-main flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={13} /> Copy Relay Code
                </button>
              </div>

              <div className="bg-background rounded-xl p-4 border border-border text-xs text-text-light space-y-2 leading-relaxed">
                <p className="font-bold text-text-main">To update your Google Apps Script for Multi-Branch support:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Open <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-primary font-semibold underline">script.google.com</a> under <strong>airlunacreations@gmail.com</strong>.</li>
                  <li>Click on your existing <strong>Aster POS</strong> script project.</li>
                  <li>Click <strong>Copy Relay Code</strong> above, paste it into <code>Code.gs</code>, replacing everything.</li>
                  <li>Click <strong>Deploy &gt; Manage deployments</strong> &gt; Edit (pencil icon).</li>
                  <li>Change Version to <strong>New version</strong> and click <strong>Deploy</strong>.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ===== OTP GATEWAYS SECTION ===== */}
        {activeSection === 'otp' && (
          <div className="max-w-3xl space-y-6">
            {/* Header & Save Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface p-5 rounded-2xl border border-border">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Send className="text-primary" size={20} /> OTP & Notification Gateways
                </h3>
                <p className="text-xs text-text-light mt-0.5">
                  Configure free real email delivery from <strong>airlunacreations@gmail.com</strong> and cellular SMS text delivery.
                </p>
              </div>
              <button
                onClick={handleSaveOtpGateways}
                className="min-h-[44px] px-5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold flex items-center gap-2 text-sm shadow-md transition-all active:scale-95"
              >
                <Save size={16} /> Save Gateway Settings
              </button>
            </div>

            {/* GATEWAY 1: GMAIL DISPATCH (airlunacreations@gmail.com) */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border space-y-5">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                    <Mail size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-main">Gmail Email Dispatch</h4>
                    <p className="text-xs text-text-light">
                      Sender account: <strong className="text-text-main">{maskEmail(otpGatewayForm.emailSenderAddress || 'airlunacreations@gmail.com')}</strong>
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  otpGatewayForm.googleAppsScriptUrl
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {otpGatewayForm.googleAppsScriptUrl ? 'Connected' : 'Setup Required'}
                </span>
              </div>

              {/* Google Apps Script Option */}
              <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-500" /> Free Google Apps Script Web App (Direct from Gmail)
                  </span>
                  <button
                    onClick={handleCopyGoogleScript}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Copy size={12} /> Copy Script Code
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-light mb-1">
                    Google Apps Script Web App URL
                  </label>
                  <input
                    type="url"
                    value={otpGatewayForm.googleAppsScriptUrl}
                    onChange={e => setOtpGatewayForm({ ...otpGatewayForm, googleAppsScriptUrl: e.target.value })}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="w-full h-11 px-3 bg-surface border border-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-3 bg-surface-hover/60 border border-border rounded-lg text-[11px] text-text-light space-y-1.5">
                  <p className="font-bold text-text-main">Quick 1-Minute Setup Guide (100% Free):</p>
                  <ol className="list-decimal list-inside space-y-1 text-text-light">
                    <li>Sign into <strong>airlunacreations@gmail.com</strong> and open <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-primary underline">script.google.com</a>.</li>
                    <li>Click <strong>+ New project</strong> and paste the copied script code (or file <code className="bg-background px-1 py-0.5 rounded text-text-main">google_apps_script_mailer.gs</code>).</li>
                    <li>Click <strong>Deploy &gt; New deployment</strong> &gt; Select type: <strong>Web app</strong>.</li>
                    <li>Set <em>Execute as:</em> <strong>Me (airlunacreations@gmail.com)</strong> and <em>Who has access:</em> <strong>Anyone</strong>.</li>
                    <li>Click <strong>Deploy</strong>, grant permission, and paste the generated Web App URL above!</li>
                  </ol>
                </div>
              </div>

              {/* Optional Custom Webhook */}
              <div>
                <label className="block text-[11px] font-semibold text-text-light mb-1">
                  Optional Alternative Webhook (Resend / Brevo / Custom API)
                </label>
                <input
                  type="url"
                  value={otpGatewayForm.emailWebhookUrl}
                  onChange={e => setOtpGatewayForm({ ...otpGatewayForm, emailWebhookUrl: e.target.value })}
                  placeholder="https://your-api.com/send-email (Optional)"
                  className="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs text-text-main"
                />
              </div>

              {/* Live Test Email */}
              <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                  placeholder="Test recipient email (e.g. manager@gmail.com)"
                  className="flex-1 w-full h-10 px-3 bg-background border border-border rounded-xl text-xs text-text-main"
                />
                <button
                  onClick={handleTestSendEmail}
                  disabled={isTestingEmail || !otpGatewayForm.googleAppsScriptUrl}
                  className="w-full sm:w-auto min-h-[40px] px-4 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Send size={13} /> {isTestingEmail ? 'Sending Test...' : 'Send Test Email'}
                </button>
              </div>
            </div>

            {/* GATEWAY 2: SMS DISPATCH (Native Device Cellular SMS - Free & Universal) */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border space-y-5">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <MessageSquare size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-main">Cellular SMS Text Delivery</h4>
                    <p className="text-xs text-text-light">
                      Universal native cellular messaging (100% Free, no Semaphore required)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-green-500/10 text-green-500 border-green-500/20">
                  Ready (Native Device SIM)
                </span>
              </div>

              {/* Native SMS Info */}
              <div className="bg-background border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
                  <CheckCircle2 size={14} className="text-green-500" /> Direct Device SIM &amp; Messaging App
                </div>
                <p className="text-[11px] text-text-light leading-relaxed">
                  When a manager override SMS OTP is requested, Aster POS automatically launches your device's native SMS application (Messages / Android Messages) with the recipient's phone number and the exact verification code prefilled. It sends over your phone or tablet's regular cellular SIM card—<strong>zero third-party service fees, no registration, and unlimited texts</strong>.
                </p>
              </div>

              {/* Optional Custom SMS Webhook */}
              <div>
                <label className="block text-[11px] font-semibold text-text-light mb-1">
                  Optional Alternative SMS Webhook URL (For automated headless SMS relays)
                </label>
                <input
                  type="url"
                  value={otpGatewayForm.smsWebhookUrl}
                  onChange={e => setOtpGatewayForm({ ...otpGatewayForm, smsWebhookUrl: e.target.value })}
                  placeholder="https://your-api.com/send-sms (Optional)"
                  className="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs text-text-main"
                />
              </div>

              {/* Live Test SMS */}
              <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="tel"
                  value={testSmsTo}
                  onChange={e => setTestSmsTo(e.target.value)}
                  placeholder="Test recipient phone (e.g. +639123456789 or 09123456789)"
                  className="flex-1 w-full h-10 px-3 bg-background border border-border rounded-xl text-xs text-text-main"
                />
                <button
                  onClick={handleTestSendSms}
                  disabled={isTestingSms}
                  className="w-full sm:w-auto min-h-[40px] px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Send size={13} /> {isTestingSms ? 'Launching Test...' : 'Test Device SMS'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SYSTEM SECTION ===== */}
        {activeSection === 'system' && (
          <div className="max-w-2xl space-y-6">
            
            {/* Module Management */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border">
              <h3 className="text-lg font-semibold text-text-main mb-1 flex items-center gap-2">
                <ToggleRight size={20} /> Module Access Control
              </h3>
              <p className="text-sm text-text-light mb-5">Enable or disable modules for each role. Modules marked <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[10px] font-bold">ELEVATED</span> grant access beyond the role's default scope.</p>
              <div className="space-y-8">

                {/* ── Cashier Modules ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><UserIcon size={16} className="text-blue-500" /></div>
                    <div>
                      <h4 className="text-sm font-bold text-text-main">Cashier Modules</h4>
                      <p className="text-xs text-text-light">Controls what cashier accounts can see and access</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'pos', label: 'POS Register', desc: 'Process orders and checkout', icon: LayoutDashboard, elevated: false },
                      { id: 'shift', label: 'Shift Report', desc: 'Clock in/out & shift summary', icon: ClipboardList, elevated: false },
                      { id: 'inventory', label: 'Inventory', desc: 'View stock levels', icon: Package, elevated: false },
                      { id: 'sales', label: 'Sales History', desc: 'Transaction logs & receipts', icon: Receipt, elevated: false },
                      { id: 'account', label: 'My Account', desc: 'Profile & PIN settings', icon: UserIcon, elevated: false },
                      { id: 'dashboard', label: 'Dashboard', desc: 'Analytics & revenue reports', icon: BarChart3, elevated: true },
                      { id: 'menu', label: 'Menu Editor', desc: 'Add/edit menu products', icon: UtensilsCrossed, elevated: true },
                      { id: 'network', label: 'Wi-Fi Sync', desc: 'Multi-device sync settings', icon: Wifi, elevated: true },
                      { id: 'settings', label: 'Store Settings', desc: 'Tax, receipt & payment config', icon: SettingsGear, elevated: true }
                    ].map(mod => {
                      const isActive = settingsData?.cashierModules?.[mod.id] === true;
                      return (
                        <div key={mod.id} className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${
                          isActive ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-background'
                        }`}>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-green-500/15 text-green-600' : 'bg-surface-hover text-text-light'
                          }`}>
                            <mod.icon size={17} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-text-main truncate">{mod.label}</span>
                              {mod.elevated && <span className="inline-flex px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[9px] font-bold flex-shrink-0 leading-none">ELEVATED</span>}
                            </div>
                            <p className="text-[11px] text-text-light truncate">{mod.desc}</p>
                          </div>
                          <button 
                            onClick={async () => {
                              const defaults = { pos: true, shift: true, sales: true, account: true, inventory: true, dashboard: false, menu: false, network: false, settings: false };
                              const currentModules = settingsData?.cashierModules || defaults;
                              await db.app_settings.update('default', {
                                cashierModules: { ...currentModules, [mod.id]: !isActive }
                              });
                              flash(`Cashier ${mod.label} ${!isActive ? 'enabled' : 'disabled'}`);
                            }}
                            className={`w-11 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
                              isActive ? 'bg-green-500 justify-end' : 'bg-surface-hover border border-border justify-start'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full shadow-sm transition-all ${isActive ? 'bg-white' : 'bg-white border border-border'}`}></div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border"></div>

                {/* ── Manager Modules ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Shield size={16} className="text-primary" /></div>
                    <div>
                      <h4 className="text-sm font-bold text-text-main">Manager Modules</h4>
                      <p className="text-xs text-text-light">Controls what manager accounts can see and access</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'pos', label: 'POS Register', desc: 'Process orders and checkout', icon: LayoutDashboard },
                      { id: 'shift', label: 'Shift Report', desc: 'Clock in/out & shift summary', icon: ClipboardList },
                      { id: 'dashboard', label: 'Dashboard', desc: 'Analytics & revenue reports', icon: BarChart3 },
                      { id: 'inventory', label: 'Inventory', desc: 'Manage stock & ingredients', icon: Package },
                      { id: 'sales', label: 'Sales History', desc: 'Transactions, voids & audit', icon: Receipt },
                      { id: 'menu', label: 'Menu Editor', desc: 'Add/edit menu products', icon: UtensilsCrossed },
                      { id: 'network', label: 'Wi-Fi Sync', desc: 'Multi-device sync settings', icon: Wifi },
                      { id: 'settings', label: 'Store Settings', desc: 'Tax, receipt & payment config', icon: SettingsGear },
                      { id: 'account', label: 'My Account', desc: 'Profile & PIN settings', icon: UserIcon }
                    ].map(mod => {
                      const isActive = settingsData?.managerModules?.[mod.id] !== false;
                      return (
                        <div key={mod.id} className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${
                          isActive ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-background'
                        }`}>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-green-500/15 text-green-600' : 'bg-surface-hover text-text-light'
                          }`}>
                            <mod.icon size={17} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-text-main truncate block">{mod.label}</span>
                            <p className="text-[11px] text-text-light truncate">{mod.desc}</p>
                          </div>
                          <button 
                            onClick={async () => {
                              const defaults = { pos: true, shift: true, dashboard: true, sales: true, menu: true, network: true, settings: true, account: true, inventory: true };
                              const currentModules = settingsData?.managerModules || defaults;
                              await db.app_settings.update('default', {
                                managerModules: { ...currentModules, [mod.id]: !isActive }
                              });
                              flash(`Manager ${mod.label} ${!isActive ? 'enabled' : 'disabled'}`);
                            }}
                            className={`w-11 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
                              isActive ? 'bg-green-500 justify-end' : 'bg-surface-hover border border-border justify-start'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full shadow-sm transition-all ${isActive ? 'bg-white' : 'bg-white border border-border'}`}></div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* Backup */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-border">
              <h3 className="text-lg font-semibold text-text-main mb-2 flex items-center gap-2">
                <Download size={20} /> Database Backup & Migration
              </h3>
              <p className="text-sm text-text-light mb-4">Export a complete JSON backup of all data, or import a previous backup to restore data (or migrate to a new device). PINs are reset to '1234' on import if masked.</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handleExportBackup} className="flex-1 min-h-[48px] bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                  <Download size={18} /> Export Backup
                </button>
                
                <input ref={importBackupRef} type="file" accept=".json,application/json" onChange={handleImportBackup} className="hidden" />
                <button onClick={() => importBackupRef.current?.click()} className="flex-1 min-h-[48px] bg-surface-hover border border-border hover:bg-border text-text-main rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95">
                  <Upload size={18} /> Restore / Import Backup
                </button>
              </div>
            </div>

            {/* Factory Reset */}
            <div className="bg-surface p-5 sm:p-6 rounded-2xl border-2 border-red-500/20">
              <div className="flex items-center gap-2 mb-2 text-red-500">
                <AlertTriangle size={20} />
                <h3 className="text-lg font-semibold">Danger Zone</h3>
              </div>
              <p className="text-sm text-text-light mb-4">Perform a complete factory reset. This will delete ALL data including sales, products, staff, and uploaded images. This cannot be undone.</p>
              <button onClick={handleFactoryReset} className="min-h-[48px] px-6 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 rounded-xl font-semibold flex items-center gap-2 transition-colors">
                <RotateCcw size={18} /> Factory Reset
              </button>
            </div>
          </div>
        )}

        {activeSection === 'license' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-surface border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-text-main flex items-center gap-2 mb-4">
                <KeyRound className="text-primary" /> Device License
              </h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center bg-background border border-border rounded-xl p-4">
                  <div>
                    <p className="text-sm text-text-light font-medium">Status</p>
                    <p className="font-semibold text-green-500 mt-0.5">ACTIVE</p>
                  </div>
                  <Shield className="text-green-500" size={24} />
                </div>
                
                <div className="flex justify-between items-center bg-background border border-border rounded-xl p-4">
                  <div>
                    <p className="text-sm text-text-light font-medium">Hardware ID</p>
                    <p className="font-mono font-bold text-text-main text-sm mt-0.5">{localStorage.getItem('device_id')}</p>
                  </div>
                  <Monitor className="text-text-light" size={20} />
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <h4 className="text-red-500 font-semibold mb-2 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> Deactivate Device
                </h4>
                <p className="text-xs text-red-500/80 mb-4 leading-relaxed">
                  Deactivating this device will lock the application immediately. You will need the Master Activation Code to unlock it again.
                </p>
                <button
                  onClick={() => {
                    const code = prompt('Enter Master Activation Code to deactivate:');
                    if (code === 'AIRL092918') {
                       localStorage.setItem('is_device_activated', 'false');
                       window.location.reload();
                    } else if (code !== null) {
                       alert('Invalid code.');
                    }
                  }}
                  className="w-full min-h-[44px] bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                >
                  <Lock size={16} /> Deactivate License
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

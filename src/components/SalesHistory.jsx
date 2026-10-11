import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Download, Receipt, TrendingUp, CreditCard, Banknote, FileSpreadsheet,
  FileJson, Check, X, ShieldAlert, Ban, ChevronDown, ChevronUp, RotateCcw,
  AlertTriangle, Delete, Printer
} from 'lucide-react';
import ReceiptPrinter from './ReceiptPrinter';
import SalesReportGenerator from './SalesReportGenerator';
import { downloadOrShareFile } from '../utils/fileDownloader';
import cloudSyncService from '../services/cloudSyncService';

// --- Confirm Dialog ---
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, variant = 'primary' }) => {
  if (!isOpen) return null;
  const btnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-primary hover:bg-primary-dark text-white';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm overflow-hidden animate-in">
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
const Toast = ({ message, isVisible, type = 'success' }) => {
  if (!isVisible) return null;
  const bgClass = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className={`fixed top-4 right-4 z-[70] ${bgClass} text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2 animate-in`}>
      {type === 'error' ? <X size={16} /> : <Check size={16} />} {message}
    </div>
  );
};

import { requestManagerOtp, verifyManagerOtp, getManagerOtpStatus, maskEmail, maskPhone } from '../services/OtpService';
import { Mail, MessageSquare, Clock, KeyRound, CheckCircle2 } from 'lucide-react';

// --- Manager Override Modal for Void (PIN & Multi-Channel OTP) ---
const VoidOverrideModal = ({ isOpen, onClose, onSuccess, orderId }) => {
  const [pin, setPin] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [step, setStep] = useState('reason'); // 'reason' | 'auth'
  const [authMode, setAuthMode] = useState('pin'); // 'pin' | 'otp'

  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      setPin('');
      setOtpCode('');
      setError(false);
      setErrorMessage('');
      setVoidReason('');
      setStep('reason');
      setAuthMode('pin');
      setIsSendingOtp(false);
      setOtpSuccessMsg('');
      setSecondsRemaining(0);
      setCooldownSeconds(0);
      setIsLocked(false);
      setPendingConfirmation(null);

      db.users
        .where('role')
        .anyOf('manager', 'super_admin')
        .toArray()
        .then(list => {
          const active = list.filter(u => u.is_active !== 0);
          setManagers(active);
          if (active.length > 0) {
            setSelectedManagerId(active[0].id.toString());
          }
        });
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || step !== 'auth' || authMode !== 'otp') return;
    const timer = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
      setCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, step, authMode]);

  const triggerError = (msg) => {
    setError(true);
    setErrorMessage(msg);
    setTimeout(() => {
      setError(false);
    }, 800);
  };

  const handleKeyPress = (key) => {
    if (pin.length < 6) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 6) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => setPin(pin.slice(0, -1));

  const verifyPin = async (enteredPin) => {
    const users = await db.users.toArray();
    const manager = users.find(u =>
      u.pin === enteredPin &&
      (u.role === 'manager' || u.role === 'super_admin') &&
      u.is_active !== 0
    );
    if (manager) {
      setPendingConfirmation({
        manager,
        authType: 'PIN'
      });
    } else {
      triggerError('Invalid Manager PIN');
      setTimeout(() => {
        setPin('');
      }, 500);
    }
  };

  const handleSendOtp = async (channel) => {
    if (!selectedManagerId) {
      triggerError('Select a manager first');
      return;
    }
    setIsSendingOtp(true);
    setErrorMessage('');
    setOtpSuccessMsg('');
    try {
      const res = await requestManagerOtp({
        managerId: selectedManagerId,
        channel,
        actionName: `Void Order #${orderId}`
      });

      if (!res.success) {
        if (res.cooldownRemaining) setCooldownSeconds(res.cooldownRemaining);
        if (res.isLocked) setIsLocked(true);
        triggerError(res.message);
        return;
      }

      setSecondsRemaining(300);
      setCooldownSeconds(60);
      setIsLocked(false);
      setOtpCode('');
      setOtpSuccessMsg(res.message);
    } catch (err) {
      triggerError(err.message || 'Failed to dispatch OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otpCode;
    if (code.length !== 6) {
      triggerError('Enter all 6 digits of OTP code');
      return;
    }
    try {
      const res = await verifyManagerOtp({
        managerId: selectedManagerId,
        enteredCode: code
      });

      if (res.valid) {
        setPendingConfirmation({
          manager: res.manager,
          authType: res.authType
        });
      } else {
        if (res.isLocked) setIsLocked(true);
        triggerError(res.message);
        setOtpCode('');
      }
    } catch (err) {
      triggerError(err.message || 'OTP Verification failed');
    }
  };

  const handleConfirmAndProceed = () => {
    if (!pendingConfirmation) return;
    const { manager, authType } = pendingConfirmation;
    onSuccess(manager, voidReason, authType);
    onClose();
  };

  const currentManager = managers.find(m => m.id.toString() === selectedManagerId);
  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4" onClick={onClose}>
      <div
        className={`bg-surface rounded-3xl shadow-2xl border border-border w-full max-w-sm max-h-[92vh] overflow-y-auto flex flex-col ${error ? 'animate-shake' : 'animate-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 text-center border-b border-border bg-red-500/10">
          <div className="w-14 h-14 bg-red-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-red-500/30">
            <Ban size={28} />
          </div>
          <h2 className="text-lg font-semibold text-text-main mb-1">Void Order #{orderId}</h2>
          <p className="text-sm font-medium text-text-light">Requires Manager or Super Admin authorization</p>
        </div>

        {pendingConfirmation ? (
          <div className="p-6 flex flex-col items-center bg-surface animate-in space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-text-main">Confirm Void Authorization</h3>
              <p className="text-sm text-text-light leading-relaxed">
                Manager verification approved via <strong className="text-primary font-bold">{pendingConfirmation.authType === 'PIN' ? '6-Digit PIN' : pendingConfirmation.authType === 'SMS_OTP' ? 'SMS Text OTP' : 'Gmail Email OTP'}</strong>.
              </p>
            </div>

            <div className="w-full bg-background border border-border rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Order:</span>
                <span className="font-bold text-red-500">#{orderId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Void Reason:</span>
                <span className="font-bold text-text-main">{voidReason}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Authorizing Manager:</span>
                <span className="font-bold text-text-main">{pendingConfirmation.manager?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Auth Method:</span>
                <span className="font-semibold text-text-main">{pendingConfirmation.authType}</span>
              </div>
            </div>

            <p className="text-[11px] text-text-light text-center">
              Are you sure you want to permanently void this transaction? This action will be recorded in the audit trail.
            </p>

            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={() => setPendingConfirmation(null)}
                className="flex-1 min-h-[46px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-bold text-xs transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirmAndProceed}
                className="flex-[2] min-h-[46px] bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check size={16} /> Confirm & Void Order
              </button>
            </div>
          </div>
        ) : step === 'reason' ? (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-light mb-2">Void Reason</label>
              <select
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                className="min-h-[48px] w-full px-4 bg-background border border-border rounded-xl text-text-main text-sm"
              >
                <option value="">Select a reason...</option>
                <option value="Customer Request">Customer Request</option>
                <option value="Wrong Order">Wrong Order</option>
                <option value="Duplicate Transaction">Duplicate Transaction</option>
                <option value="Payment Error">Payment Error</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 min-h-[44px] bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (voidReason) setStep('auth'); }}
                disabled={!voidReason}
                className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 disabled:bg-border disabled:text-text-light text-white rounded-xl font-semibold text-sm transition-all active:scale-95"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col bg-surface">
            {/* Context & Back */}
            <div className="px-4 py-2 bg-surface-hover/70 border-b border-border flex items-center justify-between text-xs">
              <span className="font-semibold text-text-light">Reason: <strong className="text-text-main">{voidReason}</strong></span>
              <button onClick={() => setStep('reason')} className="text-primary font-bold hover:underline">Change Reason</button>
            </div>

            {/* Sub-tabs: Enter PIN vs OTP */}
            <div className="p-2.5 bg-surface-hover/30 border-b border-border flex gap-2">
              <button
                onClick={() => { setAuthMode('pin'); setErrorMessage(''); }}
                className={`flex-1 min-h-[36px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'pin'
                    ? 'bg-surface shadow text-primary border border-border'
                    : 'text-text-light hover:text-text-main'
                }`}
              >
                <KeyRound size={14} /> Enter PIN
              </button>
              <button
                onClick={() => { setAuthMode('otp'); setErrorMessage(''); }}
                className={`flex-1 min-h-[36px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'otp'
                    ? 'bg-surface shadow text-primary border border-border'
                    : 'text-text-light hover:text-text-main'
                }`}
              >
                <Mail size={14} /> Multi-Channel OTP
              </button>
            </div>

            {/* PIN Keypad Mode */}
            {authMode === 'pin' && (
              <div className="p-5 flex flex-col items-center">
                <div className="flex gap-3 mb-4">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-all ${pin.length > i ? 'bg-red-500 scale-110' : 'bg-border scale-100'}`} />
                  ))}
                </div>
                {error
                  ? <p className="text-red-500 font-bold text-xs mb-3">{errorMessage || 'Invalid Manager/Admin PIN'}</p>
                  : <p className="text-text-light font-medium text-xs mb-3">Enter Manager PIN to confirm void</p>
                }
                <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handleKeyPress(num.toString())}
                      className="min-h-[50px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-lg font-bold text-text-main hover:bg-border transition-colors active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => setStep('reason')}
                    className="min-h-[50px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-text-light hover:text-primary transition-colors active:scale-95 text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleKeyPress('0')}
                    className="min-h-[50px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-lg font-bold text-text-main hover:bg-border transition-colors active:scale-95"
                  >
                    0
                  </button>
                  <button
                    onClick={handleBackspace}
                    className="min-h-[50px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-text-main hover:bg-border transition-colors active:scale-95"
                  >
                    <Delete size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* OTP Mode */}
            {authMode === 'otp' && (
              <div className="p-4 flex flex-col space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-text-light mb-1">Authorizing Manager</label>
                  <select
                    value={selectedManagerId}
                    onChange={e => {
                      setSelectedManagerId(e.target.value);
                      setOtpCode('');
                      setErrorMessage('');
                    }}
                    className="w-full h-10 px-3 bg-background border border-border rounded-xl font-semibold text-xs text-text-main"
                  >
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                  {currentManager && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-text-light font-medium">
                      <span>✉️ {maskEmail(currentManager.email) || 'No email'}</span>
                      <span>•</span>
                      <span>📱 {maskPhone(currentManager.phone_number) || 'No phone'}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSendOtp('GMAIL')}
                    disabled={isSendingOtp || isLocked || cooldownSeconds > 0 || !currentManager?.email}
                    className="min-h-[42px] px-2 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    <Mail size={14} className="text-red-500" /> Send Gmail OTP
                  </button>
                  <button
                    onClick={() => handleSendOtp('SMS')}
                    disabled={isSendingOtp || isLocked || cooldownSeconds > 0 || !currentManager?.phone_number}
                    className="min-h-[42px] px-2 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    <MessageSquare size={14} className="text-blue-500" /> Send SMS OTP
                  </button>
                </div>

                {secondsRemaining > 0 && !isLocked && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1"><Clock size={13} /> {formatTimer(secondsRemaining)}</span>
                    {cooldownSeconds > 0 && <span className="text-[10px] text-text-light">Resend in {cooldownSeconds}s</span>}
                  </div>
                )}

                {otpSuccessMsg && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center text-xs font-semibold text-emerald-600">
                    ✓ {otpSuccessMsg}
                  </div>
                )}

                {error && <p className="text-red-500 font-bold text-xs text-center">{errorMessage}</p>}

                {/* 6-box input */}
                <div className="flex justify-center gap-1.5 py-1">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`w-8 h-10 rounded-lg border flex items-center justify-center font-bold text-sm ${
                        otpCode.length > i ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-text-light'
                      }`}
                    >
                      {otpCode[i] || '•'}
                    </div>
                  ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-1.5 w-full max-w-[240px] mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        if (otpCode.length < 6) {
                          const next = otpCode + num;
                          setOtpCode(next);
                          if (next.length === 6) handleVerifyOtp(next);
                        }
                      }}
                      className="min-h-[42px] rounded-lg bg-surface-hover border border-border flex items-center justify-center text-base font-bold text-text-main hover:bg-border transition-colors active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => setOtpCode('')}
                    className="min-h-[42px] rounded-lg bg-surface-hover border border-border flex items-center justify-center text-[11px] font-bold text-text-light"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      if (otpCode.length < 6) {
                        const next = otpCode + '0';
                        setOtpCode(next);
                        if (next.length === 6) handleVerifyOtp(next);
                      }
                    }}
                    className="min-h-[42px] rounded-lg bg-surface-hover border border-border flex items-center justify-center text-base font-bold text-text-main hover:bg-border transition-colors active:scale-95"
                  >
                    0
                  </button>
                  <button
                    onClick={() => setOtpCode(prev => prev.slice(0, -1))}
                    className="min-h-[42px] rounded-lg bg-surface-hover border border-border flex items-center justify-center text-text-main"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Order Row with Expandable Items + Void Button ---
const OrderRow = ({ order, onVoidRequest, onPrintRequest, isVoided }) => {
  const [expanded, setExpanded] = useState(false);

  const methodBadgeClass = order.paymentMethod === 'Cash'
    ? 'bg-green-500/10 text-green-600 border-green-500/20'
    : 'bg-blue-500/10 text-blue-600 border-blue-500/20';

  return (
    <div className={`border rounded-xl sm:rounded-2xl overflow-hidden transition-colors ${isVoided ? 'border-red-500/30 bg-red-500/5 opacity-70' : 'border-border bg-background hover:border-primary/20'}`}>
      {/* Main Row */}
      <div className="p-3 sm:p-4 flex items-center gap-3">
        {/* Order ID */}
        <div className="flex-shrink-0 w-12 sm:w-14">
          <span className={`text-sm font-semibold ${isVoided ? 'text-red-500 line-through' : 'text-text-main'}`}>#{order.id}</span>
          {isVoided && <p className="text-[9px] font-semibold text-red-500 uppercase">Voided</p>}
        </div>

        {/* Time */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <p className="text-sm font-medium text-text-light">{new Date(order.timestamp).toLocaleString()}</p>
        </div>

        {/* Mobile time */}
        <div className="flex-1 min-w-0 sm:hidden">
          <p className="text-[11px] text-text-light">{new Date(order.timestamp).toLocaleTimeString()}</p>
          <p className="text-[10px] text-text-light opacity-70">{new Date(order.timestamp).toLocaleDateString()}</p>
        </div>

        {/* Payment Method */}
        <div className="flex-shrink-0 hidden sm:block">
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg border ${methodBadgeClass}`}>
            {order.paymentMethod}
          </span>
        </div>

        {/* Ref */}
        <div className="flex-shrink-0 text-sm text-text-light hidden md:block min-w-[80px] truncate">
          {order.paymentRef || '-'}
        </div>

        {/* Total */}
        <div className="flex-shrink-0 text-right">
          <span className={`font-semibold text-base ${isVoided ? 'text-red-500 line-through' : 'text-primary'}`}>
            ₱{order.total.toFixed(2)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1 ml-1 print:hidden">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover hover:bg-border border border-border transition-colors text-text-light"
            title="View items"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => onPrintRequest(order, isVoided)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover hover:bg-border border border-border transition-colors text-text-light"
            title="Print Receipt"
          >
            <Printer size={14} />
          </button>
          {!isVoided && (
            <button
              onClick={() => onVoidRequest(order)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-colors"
              title="Void Order"
            >
              <Ban size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Items */}
      {(expanded) && (
        <div className="border-t border-border bg-surface p-3 sm:p-4 space-y-1.5 print:block">
          <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-2">
            {order.items?.length || 0} Item(s)
          </p>
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-text-main font-medium">
                {item.quantity}× {item.productName || `Product #${item.productId}`}
                {item.modifications && Object.keys(item.modifications).length > 0 && (
                  <span className="text-text-light text-xs ml-1">
                    ({Object.entries(item.modifications).map(([k, v]) => `${k}: ${v}`).join(', ')})
                  </span>
                )}
              </span>
              <span className="text-text-light font-medium">₱{((item.price || 0) * item.quantity).toFixed(2)}</span>
            </div>
          )) || <p className="text-xs text-text-light">No item details recorded</p>}
        </div>
      )}
    </div>
  );
};

export default function SalesHistory({ currentUser }) {
  const orders = useLiveQuery(() => db.orders.orderBy('timestamp').reverse().toArray()) || [];
  const auditLogs = useLiveQuery(() => db.audit_logs.orderBy('timestamp').reverse().toArray()) || [];
  const cancelledLogs = useLiveQuery(() =>
    db.cancelled_orders_log ? db.cancelled_orders_log.orderBy('timestamp').reverse().toArray() : Promise.resolve([])
  ) || [];

  const [filter, setFilter] = useState('Today');
  const [activeTab, setActiveTab] = useState('sales');
  const [voidTarget, setVoidTarget] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });
  const [toastConfig, setToastConfig] = useState({ isVisible: false, message: '', type: 'success' });
  
  const isCashier = currentUser.role === 'cashier';

  const flash = (message, type = 'success') => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig({ isVisible: false, message: '', type: 'success' }), 2500);
  };

  const showConfirm = (title, message, onConfirm, variant = 'primary') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  };
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const getFilteredOrders = () => {
    const now = new Date();
    if (filter === 'Today' || isCashier) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return orders.filter(o => o.timestamp >= today);
    }
    if (filter === 'This Week') {
      const day = now.getDay();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
      return orders.filter(o => o.timestamp >= weekStart);
    }
    if (filter === 'This Month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return orders.filter(o => o.timestamp >= monthStart);
    }
    return orders;
  };

  const filteredOrders = getFilteredOrders();
  const activeOrders = filteredOrders.filter(o => o.status !== 'voided');
  const voidedOrders = filteredOrders.filter(o => o.status === 'voided');

  const totalSales = activeOrders.reduce((sum, o) => sum + o.total, 0);
  const cashSales = activeOrders.filter(o => o.paymentMethod === 'Cash').reduce((sum, o) => sum + o.total, 0);
  const cashlessSales = totalSales - cashSales;
  const orderCount = activeOrders.length;
  const voidCount = voidedOrders.length;

  // --- Void Handler ---
  const handleVoidRequest = (order) => {
    setVoidTarget(order);
  };

  const handleVoidConfirmed = async (manager, reason, authType = 'PIN') => {
    if (!voidTarget) return;
    const now = new Date().getTime();

    try {
      // 1. Mark order as voided
      await db.orders.update(voidTarget.id, { status: 'voided' });

      // 2. Record to cancelled_orders_log
      await db.cancelled_orders_log.add({
        order_id: voidTarget.id,
        timestamp: now,
        original_total: voidTarget.total,
        payment_method: voidTarget.paymentMethod,
        payment_ref: voidTarget.paymentRef || '',
        void_reason: reason,
        voided_by_manager_id: manager.id,
        voided_by_manager_name: manager.name,
        cashier_id: voidTarget.cashierId,
        auth_type: authType,
        items: voidTarget.items || []
      });

      // 3. Record to audit_logs
      await db.audit_logs.add({
        timestamp: now,
        actionType: 'Order Void',
        itemName: `Order #${voidTarget.id} — ₱${voidTarget.total.toFixed(2)} (${reason})`,
        cashierId: voidTarget.cashierId || 'N/A',
        managerId: manager.id,
        approvingManagerId: manager.id,
        auth_type: authType
      });

      // 4. Attempt inventory restoration if items exist
      if (voidTarget.items && voidTarget.items.length > 0) {
        for (const item of voidTarget.items) {
          const recipes = await db.recipes.where('productId').equals(item.productId).toArray();
          for (const recipe of recipes) {
            if (recipe.ingredients) {
              for (const ing of recipe.ingredients) {
                const ingredient = await db.ingredients.get(ing.ingredientId);
                if (ingredient) {
                  await db.ingredients.update(ing.ingredientId, {
                    currentStock: ingredient.currentStock + (ing.quantity * item.quantity)
                  });
                }
              }
            }
          }
        }
      }

      setVoidTarget(null);
      flash(`Order #${voidTarget.id} has been voided successfully`);
      try { cloudSyncService.triggerAutoSync(); } catch {}
    } catch (err) {
      flash('Failed to void order. Please try again.', 'error');
    }
  };


  const handleExportJSON = () => {
    showConfirm('Export Backup / Template', 'Download sales data & order JSON backup?', async () => {
      closeConfirm();
      const exportData = {
        exportDate: new Date().toISOString(),
        filter,
        summary: { totalSales, cashSales, cashlessSales, orderCount, voidCount },
        orders: filteredOrders,
        cancelledOrders: cancelledLogs
      };
      
      const fileName = `aster_sales_backup_${filter.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      const jsonData = JSON.stringify(exportData, null, 2);

      try {
        await downloadOrShareFile({
          fileName,
          data: jsonData,
          mimeType: 'application/json',
          shareTitle: 'Aster POS Sales Backup',
          shareText: `Aster POS Sales Data (${filter})`
        });
        flash('Backup exported successfully');
      } catch (err) {
        console.error(err);
        flash('Failed to export backup', 'error');
      }
    });
  };

  const tabs = [
    { id: 'sales', label: 'Sales', icon: Receipt },
    { id: 'voided', label: `Voided (${voidedOrders.length})`, icon: Ban },
    { id: 'cancelled_log', label: 'Void Log', icon: RotateCcw },
    { id: 'audit', label: 'Audit', icon: ShieldAlert },
  ].filter(t => !isCashier || (t.id === 'sales' || t.id === 'voided'));

  const handlePrintRequest = (order, isVoided) => {
    setPrintTarget({ order, isVoided });
  };

  return (
    <div className="p-3 sm:p-5 lg:p-8 h-full flex flex-col bg-background overflow-hidden relative">
      {printTarget && (
        <ReceiptPrinter
          order={printTarget.order}
          isVoided={printTarget.isVoided}
          onClose={() => setPrintTarget(null)}
        />
      )}
      <div className="print:hidden">
        <Toast {...toastConfig} />
        <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
        <VoidOverrideModal
          isOpen={!!voidTarget}
          onClose={() => setVoidTarget(null)}
          onSuccess={handleVoidConfirmed}
          orderId={voidTarget?.id}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4 sm:mb-6 flex-shrink-0 print:hidden">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-text-main">Sales & History</h2>
          <p className="text-text-light font-medium text-sm">Audit logs, financial reports & void management</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 w-full lg:w-auto min-w-0 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex bg-surface-hover border border-border rounded-xl p-1 gap-1 overflow-x-auto scrollbar-hide w-full max-w-[100vw] sm:max-w-full snap-x">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 px-4 h-10 sm:h-11 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 snap-start ${
                  activeTab === tab.id
                    ? tab.id === 'audit' || tab.id === 'voided' || tab.id === 'cancelled_log'
                      ? 'bg-surface shadow text-red-500'
                      : 'bg-surface shadow text-primary'
                    : 'text-text-light hover:text-text-main'
                }`}
              >
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'sales' && !isCashier && (
            <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="h-10 sm:h-11 px-3 rounded-xl bg-surface border border-border font-semibold text-sm text-text-main w-full sm:w-auto"
              >
                <option>Today</option>
                <option>This Week</option>
                <option>This Month</option>
                <option>All Time</option>
              </select>
              <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                <button onClick={() => setShowReportModal(true)} className="justify-center h-10 sm:h-11 px-3 sm:px-5 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-semibold flex items-center gap-1.5 text-sm transition-colors">
                  <FileSpreadsheet size={16} /><span className="hidden sm:inline">Download Sales Report</span><span className="sm:hidden">Report</span>
                </button>
                <button onClick={handleExportJSON} className="justify-center h-10 sm:h-11 px-3 sm:px-5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-lg text-sm transition-colors">
                  <FileJson size={16} />JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {(activeTab === 'sales' || activeTab === 'voided') && !isCashier && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 flex-shrink-0">
          <div className="bg-surface p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><TrendingUp size={18} className="sm:w-5 sm:h-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Net Sales</p>
              <p className="text-base sm:text-xl lg:text-2xl font-semibold truncate">₱{totalSales.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-surface p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center flex-shrink-0"><Banknote size={18} className="sm:w-5 sm:h-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Cash</p>
              <p className="text-base sm:text-xl lg:text-2xl font-semibold truncate">₱{cashSales.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-surface p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0"><CreditCard size={18} className="sm:w-5 sm:h-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Cashless</p>
              <p className="text-base sm:text-xl lg:text-2xl font-semibold truncate">₱{cashlessSales.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-surface p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 lg:col-span-1">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0"><Ban size={18} className="sm:w-5 sm:h-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-text-light uppercase tracking-wider">Voided</p>
              <p className="text-base sm:text-xl lg:text-2xl font-semibold">{voidCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 bg-surface border border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 print:border-none print:shadow-none print:h-auto print:overflow-visible">

        {/* ===== SALES TAB ===== */}
        {activeTab === 'sales' && (
          <>
            <div className="hidden sm:grid p-3 sm:p-4 bg-surface-hover border-b border-border grid-cols-[60px_1fr_100px_100px_80px_90px] gap-3 font-semibold text-xs text-text-light uppercase tracking-wider print:grid">
              <div>Order</div>
              <div>Date & Time</div>
              <div>Method</div>
              <div>Ref #</div>
              <div className="text-right">Total</div>
              <div className="text-right print:hidden">Actions</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2 print:overflow-visible print:h-auto">
              {activeOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                  <Receipt size={44} className="mb-2" />
                  <p className="font-semibold text-sm">No transactions found</p>
                </div>
              ) : (
                activeOrders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onVoidRequest={handleVoidRequest}
                    onPrintRequest={handlePrintRequest}
                    isVoided={false}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ===== VOIDED TAB ===== */}
        {activeTab === 'voided' && (
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2">
            {voidedOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                <Ban size={44} className="mb-2" />
                <p className="font-semibold text-sm">No voided orders</p>
              </div>
            ) : (
              voidedOrders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onVoidRequest={handleVoidRequest}
                  onPrintRequest={handlePrintRequest}
                  isVoided={true}
                />
              ))
            )}
          </div>
        )}

        {/* ===== CANCELLED VOID LOG TAB ===== */}
        {activeTab === 'cancelled_log' && (
          <>
            <div className="hidden sm:grid p-3 sm:p-4 bg-surface-hover border-b border-border grid-cols-[80px_1fr_100px_100px_120px] gap-3 font-semibold text-xs text-text-light uppercase tracking-wider">
              <div>Order ID</div>
              <div>Void Time</div>
              <div>Amount</div>
              <div>Reason</div>
              <div>Authorized By</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-2">
              {cancelledLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                  <RotateCcw size={44} className="mb-2" />
                  <p className="font-semibold text-sm">No void records found</p>
                </div>
              ) : (
                cancelledLogs.map(log => (
                  <div key={log.id} className="bg-background border border-red-500/20 rounded-xl p-4 border-l-4 border-l-red-500">
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-red-500">Order #{log.order_id}</span>
                        <span className="font-semibold text-sm text-text-main">₱{log.original_total?.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-text-light">{new Date(log.timestamp).toLocaleString()}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">{log.void_reason}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-surface-hover text-text-light rounded-full border border-border">{log.payment_method}</span>
                      </div>
                      <p className="text-xs text-text-light font-medium">By: <span className="text-text-main font-semibold">{log.voided_by_manager_name || `#${log.voided_by_manager_id}`}</span></p>
                    </div>
                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-[80px_1fr_100px_100px_120px] gap-3 items-center">
                      <div>
                        <span className="font-semibold text-red-500">#{log.order_id}</span>
                        <p className="text-[10px] text-text-light">{log.payment_method}</p>
                      </div>
                      <div className="text-sm font-medium text-text-light">{new Date(log.timestamp).toLocaleString()}</div>
                      <div className="font-semibold text-text-main">₱{log.original_total?.toFixed(2)}</div>
                      <div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">{log.void_reason}</span>
                      </div>
                      <div className="text-sm font-semibold text-text-main truncate">{log.voided_by_manager_name || `Manager #${log.voided_by_manager_id}`}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ===== AUDIT LOGS TAB ===== */}
        {activeTab === 'audit' && (
          <>
            <div className="hidden sm:grid p-3 sm:p-4 bg-surface-hover border-b border-border grid-cols-6 gap-3 font-semibold text-xs text-text-light uppercase tracking-wider">
              <div className="col-span-2">Time</div>
              <div className="col-span-1">Action</div>
              <div className="col-span-1">Item/Details</div>
              <div className="col-span-1">Cashier ID</div>
              <div className="col-span-1">Manager ID</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:p-4 space-y-1.5 sm:space-y-2">
              {auditLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-light opacity-50 py-12">
                  <ShieldAlert size={44} className="mb-2" />
                  <p className="font-semibold text-sm">No override logs found</p>
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="bg-background border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 border-l-4 border-l-red-500">
                    <div className="sm:hidden flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-red-500">{log.actionType}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-hover text-text-light border border-border">
                            {log.auth_type || 'PIN'}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-light font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-semibold text-text-main">{log.itemName}</p>
                      <div className="flex gap-4 mt-1 text-[11px] text-text-light font-medium">
                        <span>Cashier: {log.cashierId}</span>
                        <span>Manager: {log.managerId || log.approvingManagerId}</span>
                      </div>
                    </div>
                    <div className="hidden sm:grid grid-cols-6 gap-3 items-center">
                      <div className="col-span-2 text-sm font-medium text-text-light">{new Date(log.timestamp).toLocaleString()}</div>
                      <div className="font-semibold text-sm text-red-500 flex items-center gap-1.5">
                        <span>{log.actionType}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-hover text-text-light border border-border">
                          {log.auth_type || 'PIN'}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-text-main truncate">{log.itemName}</div>
                      <div className="text-sm text-text-light">#{log.cashierId}</div>
                      <div className="text-sm text-text-light">#{log.managerId || log.approvingManagerId}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

      </div>
      {showReportModal && (
        <SalesReportGenerator 
          orders={filteredOrders} 
          filter={filter} 
          onComplete={() => setShowReportModal(false)} 
        />
      )}
    </div>
  );
}

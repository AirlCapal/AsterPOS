import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, KeyRound, Mail, MessageSquare, Clock, AlertTriangle, CheckCircle2, Send, Check } from 'lucide-react';
import { db } from '../db';
import { requestManagerOtp, verifyManagerOtp, getManagerOtpStatus, maskEmail, maskPhone } from '../services/OtpService';

export default function ManagerOverrideModal({ isOpen, onClose, onSuccess, actionName }) {
  const [authMode, setAuthMode] = useState('pin'); // 'pin' | 'otp'
  const [pin, setPin] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  
  // OTP states
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Final confirmation modal state before executing override
  const [pendingConfirmation, setPendingConfirmation] = useState(null); // { manager, authType }

  // Load active managers
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setOtpCode('');
      setErrorMessage('');
      setShake(false);
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

  // Countdown timer for 5-minute validity & 60-second cooldown
  useEffect(() => {
    if (!isOpen || authMode !== 'otp') return;

    const timer = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
      setCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, authMode]);

  // Sync manager active session
  useEffect(() => {
    if (selectedManagerId && authMode === 'otp') {
      const status = getManagerOtpStatus(selectedManagerId);
      if (status) {
        setIsLocked(status.isLocked);
        setSecondsRemaining(status.timeRemaining);
        setCooldownSeconds(status.cooldownRemaining);
      }
    }
  }, [selectedManagerId, authMode]);

  const triggerShake = (msg) => {
    setErrorMessage(msg);
    setShake(true);
    setTimeout(() => {
      setShake(false);
    }, 600);
  };

  // PIN Keypad Handlers
  const handlePinKeyPress = (key) => {
    if (pin.length < 6) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 6) {
        verifyPin(newPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const verifyPin = async (enteredPin) => {
    const users = await db.users.toArray();
    const manager = users.find(u =>
      u.pin === enteredPin &&
      (u.role === 'manager' || u.role === 'super_admin') &&
      u.is_active !== 0
    );

    if (manager) {
      // Prompt confirmation before executing override
      setPendingConfirmation({
        manager,
        authType: 'PIN'
      });
    } else {
      triggerShake('Invalid Manager PIN');
      setTimeout(() => setPin(''), 500);
    }
  };

  // OTP Handlers
  const handleSendOtp = async (channel) => {
    if (!selectedManagerId) {
      triggerShake('Please select a manager');
      return;
    }

    setIsSendingOtp(true);
    setErrorMessage('');
    setOtpSuccessMsg('');

    try {
      const result = await requestManagerOtp({
        managerId: selectedManagerId,
        channel,
        actionName: actionName || 'POS Override'
      });

      if (!result.success) {
        if (result.cooldownRemaining) {
          setCooldownSeconds(result.cooldownRemaining);
        }
        if (result.isLocked) {
          setIsLocked(true);
        }
        triggerShake(result.message);
        return;
      }

      setSecondsRemaining(300); // 5 minutes (05:00)
      setCooldownSeconds(60); // 60s cooldown
      setIsLocked(false);
      setOtpCode('');
      setOtpSuccessMsg(result.message);
    } catch (err) {
      triggerShake(err.message || 'Failed to dispatch OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otpCode;
    if (code.length !== 6) {
      triggerShake('Please enter all 6 digits of the OTP code');
      return;
    }

    try {
      const res = await verifyManagerOtp({
        managerId: selectedManagerId,
        enteredCode: code
      });

      if (res.valid) {
        // Prompt confirmation before executing override
        setPendingConfirmation({
          manager: res.manager,
          authType: res.authType
        });
      } else {
        if (res.isLocked) {
          setIsLocked(true);
        }
        triggerShake(res.message);
        setOtpCode('');
      }
    } catch (err) {
      triggerShake(err.message || 'Verification error');
    }
  };

  const handleOtpInputKeyPress = (num) => {
    if (otpCode.length < 6) {
      const next = otpCode + num;
      setOtpCode(next);
      if (next.length === 6) {
        handleVerifyOtp(next);
      }
    }
  };

  const handleConfirmAndProceed = () => {
    if (!pendingConfirmation) return;
    const { manager, authType } = pendingConfirmation;
    onSuccess(manager, authType);
    onClose();
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentManager = managers.find(m => m.id.toString() === selectedManagerId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4" onClick={onClose}>
      <div
        className={`bg-surface rounded-3xl shadow-2xl border border-border w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col ${shake ? 'animate-shake' : 'animate-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 text-center border-b border-border bg-red-500/10 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-hover hover:bg-border flex items-center justify-center text-text-light transition-colors"
          >
            <X size={18} />
          </button>
          <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-red-500/30">
            <ShieldAlert size={26} />
          </div>
          <h2 className="text-lg font-bold text-text-main">Authorization Required</h2>
          <p className="text-xs font-medium text-text-light mt-0.5">
            Manager or Super Admin required to <span className="font-bold text-red-500">{actionName}</span>
          </p>
        </div>

        {/* ======================================================== */}
        {/* FINAL CONFIRMATION OVERLAY (CONFIRM BEFORE PROCEEDING)   */}
        {/* ======================================================== */}
        {pendingConfirmation ? (
          <div className="p-6 flex flex-col items-center bg-surface animate-in space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-text-main">Confirm Authorization</h3>
              <p className="text-sm text-text-light leading-relaxed">
                Manager verification was approved via <strong className="text-primary font-bold">{pendingConfirmation.authType === 'PIN' ? '6-Digit PIN' : pendingConfirmation.authType === 'SMS_OTP' ? 'SMS Text OTP' : 'Gmail Email OTP'}</strong>.
              </p>
            </div>

            <div className="w-full bg-background border border-border rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Action:</span>
                <span className="font-bold text-red-500">{actionName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Authorizing Manager:</span>
                <span className="font-bold text-text-main">{pendingConfirmation.manager.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-light font-medium">Verification Method:</span>
                <span className="font-semibold text-text-main">{pendingConfirmation.authType}</span>
              </div>
            </div>

            <p className="text-[11px] text-text-light text-center">
              Are you sure you want to execute this action? This will be permanently logged to the system audit trail.
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
                className="flex-[2] min-h-[46px] bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check size={16} /> Confirm & Proceed
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Switcher: PIN vs OTP */}
            <div className="p-3 bg-surface-hover/50 border-b border-border flex gap-2">
              <button
                onClick={() => { setAuthMode('pin'); setErrorMessage(''); }}
                className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'pin'
                    ? 'bg-surface shadow text-primary border border-border'
                    : 'text-text-light hover:text-text-main'
                }`}
              >
                <KeyRound size={15} /> Enter PIN
              </button>
              <button
                onClick={() => { setAuthMode('otp'); setErrorMessage(''); }}
                className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'otp'
                    ? 'bg-surface shadow text-primary border border-border'
                    : 'text-text-light hover:text-text-main'
                }`}
              >
                <Mail size={15} /> Multi-Channel OTP
              </button>
            </div>

            {/* MODE 1: 6-DIGIT PIN */}
            {authMode === 'pin' && (
              <div className="p-6 flex flex-col items-center bg-surface">
                <div className="flex gap-3 mb-6">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full transition-all ${
                        pin.length > i ? 'bg-red-500 scale-110' : 'bg-border scale-100'
                      }`}
                    />
                  ))}
                </div>

                {errorMessage ? (
                  <p className="text-red-500 font-bold text-xs mb-4">{errorMessage}</p>
                ) : (
                  <p className="text-text-light font-medium text-xs mb-4">Enter 6-digit Manager PIN</p>
                )}

                <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handlePinKeyPress(num.toString())}
                      className="min-h-[54px] rounded-2xl bg-surface-hover border border-border flex items-center justify-center text-xl font-bold text-text-main hover:bg-border transition-colors active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={onClose}
                    className="min-h-[54px] rounded-2xl bg-surface-hover border border-border flex items-center justify-center text-text-light hover:text-red-500 transition-colors active:scale-95"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={() => handlePinKeyPress('0')}
                    className="min-h-[54px] rounded-2xl bg-surface-hover border border-border flex items-center justify-center text-xl font-bold text-text-main hover:bg-border transition-colors active:scale-95"
                  >
                    0
                  </button>
                  <button
                    onClick={handlePinBackspace}
                    className="min-h-[54px] rounded-2xl bg-surface-hover border border-border flex items-center justify-center text-text-main hover:bg-border transition-colors active:scale-95"
                  >
                    <span className="text-lg">⌫</span>
                  </button>
                </div>
              </div>
            )}

            {/* MODE 2: MULTI-CHANNEL OTP (GMAIL & SMS) */}
            {authMode === 'otp' && (
              <div className="p-5 flex flex-col bg-surface space-y-4">
                {/* Manager Selector */}
                <div>
                  <label className="block text-xs font-semibold text-text-light mb-1">Select Authorizing Manager</label>
                  <select
                    value={selectedManagerId}
                    onChange={e => {
                      setSelectedManagerId(e.target.value);
                      setOtpCode('');
                      setErrorMessage('');
                      setOtpSuccessMsg('');
                    }}
                    disabled={isSendingOtp}
                    className="w-full h-11 px-3 bg-background border border-border rounded-xl font-semibold text-sm text-text-main"
                  >
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role === 'super_admin' ? 'Super Admin' : 'Manager'})
                      </option>
                    ))}
                  </select>
                  {currentManager && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-text-light font-medium">
                      {(currentManager.otp_delivery_preference === 'GMAIL' || currentManager.otp_delivery_preference === 'BOTH' || !currentManager.otp_delivery_preference) && currentManager.email && (
                        <span>✉️ {maskEmail(currentManager.email)}</span>
                      )}
                      {((currentManager.otp_delivery_preference === 'BOTH' || !currentManager.otp_delivery_preference) && currentManager.email && currentManager.phone_number) && (
                        <span>•</span>
                      )}
                      {(currentManager.otp_delivery_preference === 'SMS' || currentManager.otp_delivery_preference === 'BOTH' || !currentManager.otp_delivery_preference) && currentManager.phone_number && (
                        <span>📱 {maskPhone(currentManager.phone_number)}</span>
                      )}
                      <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Pref: {currentManager.otp_delivery_preference === 'GMAIL' ? 'Gmail Only' : currentManager.otp_delivery_preference === 'SMS' ? 'SMS Only' : 'Both (Gmail & SMS)'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dispatch Buttons: Rendered dynamically based on Manager's preferred OTP delivery setting */}
                {(() => {
                  const pref = currentManager?.otp_delivery_preference || 'BOTH';

                  if (pref === 'GMAIL') {
                    return (
                      <div className="w-full">
                        <button
                          onClick={() => handleSendOtp('GMAIL')}
                          disabled={isSendingOtp || isLocked || cooldownSeconds > 0 || !currentManager?.email}
                          className="w-full min-h-[46px] px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        >
                          <Mail size={16} />
                          <span>{isSendingOtp ? 'Sending...' : 'Send Gmail OTP'}</span>
                        </button>
                      </div>
                    );
                  }

                  if (pref === 'SMS') {
                    return (
                      <div className="w-full">
                        <button
                          onClick={() => handleSendOtp('SMS')}
                          disabled={isSendingOtp || isLocked || cooldownSeconds > 0 || !currentManager?.phone_number}
                          className="w-full min-h-[46px] px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-500 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        >
                          <MessageSquare size={16} />
                          <span>{isSendingOtp ? 'Sending...' : 'Send SMS OTP'}</span>
                        </button>
                      </div>
                    );
                  }

                  // Both preferred: show both Gmail and SMS buttons side-by-side
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSendOtp('GMAIL')}
                        disabled={isSendingOtp || isLocked || cooldownSeconds > 0 || !currentManager?.email}
                        className="min-h-[46px] px-3 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                      >
                        <Mail size={16} className="text-red-500" />
                        <span>{isSendingOtp ? 'Sending...' : 'Send Gmail OTP'}</span>
                      </button>
                      <button
                        onClick={() => handleSendOtp('SMS')}
                        disabled={isSendingOtp || isLocked || cooldownSeconds > 0 || !currentManager?.phone_number}
                        className="min-h-[46px] px-3 bg-surface-hover hover:bg-border border border-border text-text-main rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                      >
                        <MessageSquare size={16} className="text-blue-500" />
                        <span>{isSendingOtp ? 'Sending...' : 'Send SMS OTP'}</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Cooldown or Active Timer Indicator */}
                {secondsRemaining > 0 && !isLocked && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between text-xs font-semibold text-primary">
                    <div className="flex items-center gap-1.5">
                      <Clock size={15} />
                      <span>OTP Code Valid: {formatTimer(secondsRemaining)}</span>
                    </div>
                    {cooldownSeconds > 0 && (
                      <span className="text-text-light font-medium text-[11px]">
                        Resend in {cooldownSeconds}s
                      </span>
                    )}
                  </div>
                )}

                {/* Success Dispatch Banner */}
                {otpSuccessMsg && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-600 font-medium">
                    <Send size={15} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                    <span>{otpSuccessMsg}</span>
                  </div>
                )}

                {/* Lockout Banner */}
                {isLocked && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-red-500">
                    <AlertTriangle size={16} />
                    <span>Override locked for 5 minutes due to 3 invalid attempts.</span>
                  </div>
                )}

                {errorMessage && !isLocked && (
                  <p className="text-red-500 font-bold text-xs text-center">{errorMessage}</p>
                )}

                {/* 6-Digit Code Input Box */}
                <div className="pt-1 flex flex-col items-center">
                  <div className="flex gap-2 mb-3">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={`w-9 h-11 rounded-xl border flex items-center justify-center text-lg font-bold transition-all ${
                          otpCode.length > i
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-text-light'
                        }`}
                      >
                        {otpCode[i] || '•'}
                      </div>
                    ))}
                  </div>

                  {/* Numeric Input Keypad */}
                  <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button
                        key={num}
                        onClick={() => handleOtpInputKeyPress(num.toString())}
                        disabled={isLocked}
                        className="min-h-[46px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-lg font-bold text-text-main hover:bg-border transition-colors active:scale-95 disabled:opacity-30"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => setOtpCode('')}
                      disabled={isLocked || otpCode.length === 0}
                      className="min-h-[46px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-xs font-bold text-text-light hover:text-red-500 transition-colors active:scale-95 disabled:opacity-30"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handleOtpInputKeyPress('0')}
                      disabled={isLocked}
                      className="min-h-[46px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-lg font-bold text-text-main hover:bg-border transition-colors active:scale-95 disabled:opacity-30"
                    >
                      0
                    </button>
                    <button
                      onClick={() => setOtpCode(prev => prev.slice(0, -1))}
                      disabled={isLocked || otpCode.length === 0}
                      className="min-h-[46px] rounded-xl bg-surface-hover border border-border flex items-center justify-center text-text-main hover:bg-border transition-colors active:scale-95 disabled:opacity-30"
                    >
                      <span className="text-base">⌫</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleVerifyOtp()}
                    disabled={isLocked || otpCode.length !== 6}
                    className="w-full mt-3 min-h-[46px] bg-primary hover:bg-primary-dark disabled:bg-border disabled:text-text-light text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={16} /> Verify OTP Code
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

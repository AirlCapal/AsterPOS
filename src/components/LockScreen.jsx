import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ROLE_LABELS } from '../db';
import { Lock, Delete, Coffee, Crown, ShieldCheck, KeyRound, ArrowLeft, Mail, User, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requestPinResetOtp, verifyPinResetOtp, maskEmail } from '../services/OtpService';

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot PIN state
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1=select user, 2=verify OTP, 3=new PIN
  const [selectedUser, setSelectedUser] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotMsgType, setForgotMsgType] = useState(''); // 'success' | 'error' | 'info'
  const [isLoading, setIsLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resetSuccess, setResetSuccess] = useState(false);

  const users = useLiveQuery(() => db.users.toArray()) || [];
  const settings = useLiveQuery(() => db.app_settings.get('default')) || {};

  // Active users for selection (only those with an email)
  const activeUsers = users.filter(u => u.is_active === 1);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // PIN auto-submit for login
  useEffect(() => {
    if (pin.length === 6) {
      const user = users.find(u => u.pin === pin);
      if (user) {
        if (user.is_active === 0) {
          setError(true);
          setErrorMsg('Account Inactive. Please contact your Manager or Super Admin.');
          setTimeout(() => {
            setPin('');
            setError(false);
            setErrorMsg('');
          }, 2000);
          return;
        }
        setPin('');
        setError(false);
        setErrorMsg('');
        onUnlock(user);
      } else {
        setError(true);
        setErrorMsg('Invalid PIN');
        setTimeout(() => {
          setPin('');
          setError(false);
          setErrorMsg('');
        }, 1000);
      }
    }
  }, [pin, users, onUnlock]);

  const handleKeypad = (num) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDel = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // ── Forgot PIN Handlers ──
  const resetForgotState = useCallback(() => {
    setShowForgotPin(false);
    setForgotStep(1);
    setSelectedUser(null);
    setOtpCode('');
    setNewPin('');
    setConfirmPin('');
    setForgotMsg('');
    setForgotMsgType('');
    setIsLoading(false);
    setMaskedEmail('');
    setCooldown(0);
    setResetSuccess(false);
  }, []);

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setForgotMsg('');

    const email = user.email?.trim();
    if (!email) {
      setForgotMsg('No email configured for this account. Contact your manager to reset your PIN.');
      setForgotMsgType('error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPinResetOtp({ userId: user.id });
      if (result.success) {
        setMaskedEmail(result.maskedEmail || maskEmail(email));
        setForgotStep(2);
        setForgotMsg(result.message);
        setForgotMsgType('success');
      } else {
        if (result.cooldownRemaining) {
          setCooldown(result.cooldownRemaining);
        }
        setForgotMsg(result.message);
        setForgotMsgType('error');
      }
    } catch (err) {
      setForgotMsg(err.message);
      setForgotMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || !selectedUser) return;
    setIsLoading(true);
    setForgotMsg('');
    try {
      const result = await requestPinResetOtp({ userId: selectedUser.id });
      if (result.success) {
        setForgotMsg('New code sent to your email.');
        setForgotMsgType('success');
        setCooldown(60);
        setOtpCode('');
      } else {
        if (result.cooldownRemaining) setCooldown(result.cooldownRemaining);
        setForgotMsg(result.message);
        setForgotMsgType('error');
      }
    } catch (err) {
      setForgotMsg(err.message);
      setForgotMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6 || !selectedUser) return;
    setIsLoading(true);
    setForgotMsg('');
    try {
      const result = await verifyPinResetOtp({ userId: selectedUser.id, enteredCode: otpCode });
      if (result.valid) {
        setForgotStep(3);
        setForgotMsg('');
        setForgotMsgType('');
      } else {
        setForgotMsg(result.message);
        setForgotMsgType('error');
        if (result.isLocked) {
          setCooldown(300);
        }
      }
    } catch (err) {
      setForgotMsg(err.message);
      setForgotMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPin = async () => {
    if (newPin.length !== 6) {
      setForgotMsg('PIN must be exactly 6 digits.');
      setForgotMsgType('error');
      return;
    }
    if (newPin !== confirmPin) {
      setForgotMsg('PINs do not match.');
      setForgotMsgType('error');
      return;
    }
    // Check PIN uniqueness
    const existingUser = users.find(u => u.pin === newPin && u.id !== selectedUser.id);
    if (existingUser) {
      setForgotMsg('This PIN is already in use. Choose a different PIN.');
      setForgotMsgType('error');
      return;
    }
    setIsLoading(true);
    try {
      await db.users.update(selectedUser.id, { pin: newPin });
      setResetSuccess(true);
      setForgotMsg('PIN has been reset successfully!');
      setForgotMsgType('success');
      // Auto-close after 2.5 seconds
      setTimeout(() => {
        resetForgotState();
      }, 2500);
    } catch (err) {
      setForgotMsg('Failed to update PIN. Please try again.');
      setForgotMsgType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    if (role === 'super_admin') return <ShieldCheck size={14} className="text-amber-400" />;
    if (role === 'manager') return <Crown size={14} className="text-blue-400" />;
    return <User size={14} className="text-text-light" />;
  };

  // ── Forgot PIN Modal ──
  const renderForgotPinModal = () => {
    if (!showForgotPin) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden" style={{ maxHeight: '90vh' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-4 border-b border-border flex items-center gap-3">
            {forgotStep > 1 && !resetSuccess && (
              <button
                onClick={() => {
                  if (forgotStep === 3) { setForgotStep(2); setNewPin(''); setConfirmPin(''); }
                  else if (forgotStep === 2) { setForgotStep(1); setSelectedUser(null); setOtpCode(''); }
                  setForgotMsg('');
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-light"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                <KeyRound size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-text-main text-base">
                  {resetSuccess ? 'PIN Reset Complete' : forgotStep === 1 ? 'Forgot PIN' : forgotStep === 2 ? 'Verify Code' : 'Set New PIN'}
                </h3>
                <p className="text-xs text-text-light">
                  {resetSuccess ? 'Your PIN has been updated' : forgotStep === 1 ? 'Select your account' : forgotStep === 2 ? `Code sent to ${maskedEmail}` : 'Enter a new 6-digit PIN'}
                </p>
              </div>
            </div>
            <button
              onClick={resetForgotState}
              className="text-text-light hover:text-text-main text-xl font-bold p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Status Message */}
          {forgotMsg && (
            <div className={`mx-4 mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
              forgotMsgType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              forgotMsgType === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              {forgotMsgType === 'success' ? <CheckCircle2 size={16} /> : forgotMsgType === 'error' ? <AlertTriangle size={16} /> : <Mail size={16} />}
              {forgotMsg}
            </div>
          )}

          {/* Content */}
          <div className="p-5 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {/* Step 1: Select Account */}
            {forgotStep === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-text-light mb-3">Choose the account you want to reset the PIN for:</p>
                {activeUsers.length === 0 ? (
                  <p className="text-center text-text-light py-8">No active accounts found.</p>
                ) : (
                  activeUsers.map(user => {
                    const hasEmail = !!user.email?.trim();
                    return (
                      <button
                        key={user.id}
                        onClick={() => hasEmail ? handleSelectUser(user) : null}
                        disabled={!hasEmail || isLoading}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${
                          hasEmail
                            ? 'border-border hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] cursor-pointer'
                            : 'border-border/50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {getRoleIcon(user.role)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-text-main text-sm truncate">{user.name}</p>
                          <p className="text-xs text-text-light">
                            {ROLE_LABELS[user.role] || user.role}
                            {hasEmail ? ` · ${maskEmail(user.email)}` : ' · No email configured'}
                          </p>
                        </div>
                        {hasEmail ? (
                          <Mail size={16} className="text-primary shrink-0" />
                        ) : (
                          <Lock size={14} className="text-text-light/30 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Step 2: Verify OTP Code */}
            {forgotStep === 2 && !resetSuccess && (
              <div className="space-y-5">
                <p className="text-sm text-text-light">
                  A 6-digit verification code has been sent to your email. Enter it below to proceed.
                </p>

                {/* OTP Input */}
                <div>
                  <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-2">Verification Code</label>
                  <div className="flex gap-2 justify-center">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-11 h-13 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                          otpCode.length > i
                            ? 'border-primary bg-primary/10 text-primary'
                            : otpCode.length === i
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border bg-surface-hover'
                        }`}
                      >
                        {otpCode[i] || ''}
                      </div>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(val);
                    }}
                    className="w-full mt-2 px-4 py-3 rounded-xl bg-surface-hover border border-border text-text-main text-center text-lg font-mono tracking-[0.3em] focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter 6-digit code"
                    autoFocus
                  />
                </div>

                {/* Verify button */}
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpCode.length !== 6 || isLoading}
                  className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Verify Code
                    </>
                  )}
                </button>

                {/* Resend */}
                <div className="text-center">
                  <button
                    onClick={handleResendCode}
                    disabled={cooldown > 0 || isLoading}
                    className="text-xs font-semibold text-primary hover:underline disabled:text-text-light disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive it? Resend code"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Set New PIN */}
            {forgotStep === 3 && !resetSuccess && (
              <div className="space-y-5">
                <p className="text-sm text-text-light">
                  Create a new 6-digit PIN for <span className="font-bold text-text-main">{selectedUser?.name}</span>.
                </p>

                <div>
                  <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-2">New PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3.5 rounded-xl bg-surface-hover border border-border text-text-main text-center text-lg font-mono tracking-[0.3em] focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="● ● ● ● ● ●"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-light uppercase tracking-wider mb-2">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3.5 rounded-xl bg-surface-hover border border-border text-text-main text-center text-lg font-mono tracking-[0.3em] focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="● ● ● ● ● ●"
                  />
                  {newPin.length === 6 && confirmPin.length === 6 && newPin !== confirmPin && (
                    <p className="text-xs text-red-400 mt-1.5 font-semibold flex items-center gap-1">
                      <AlertTriangle size={12} /> PINs do not match
                    </p>
                  )}
                  {newPin.length === 6 && confirmPin.length === 6 && newPin === confirmPin && (
                    <p className="text-xs text-emerald-400 mt-1.5 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> PINs match
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSetNewPin}
                  disabled={newPin.length !== 6 || confirmPin.length !== 6 || newPin !== confirmPin || isLoading}
                  className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound size={16} />
                      Reset PIN
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Success State */}
            {resetSuccess && (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text-main">PIN Reset Successful</p>
                  <p className="text-sm text-text-light mt-1">You can now log in with your new PIN.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col md:flex-row z-50">
      {/* Left Side (Brand Identity Panel) */}
      <div className="flex-1 bg-[#1e1b18] text-white flex flex-col items-center justify-center p-8 md:p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 opacity-50 blur-3xl rounded-full scale-150"></div>
        <div className="relative z-10 flex flex-col items-center max-w-md text-center">
          <div className="w-20 h-20 sm:w-28 sm:h-28 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-primary/30">
            <Coffee size={48} className="text-white" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-3 tracking-tight">{settings?.cafeName || 'Aster POS'}</h1>
          <p className="text-[#a8a29e] font-medium text-sm sm:text-lg">Intelligent Point of Sale Terminal</p>
        </div>
      </div>

      {/* Right Side (Compact Numeric PIN Keypad) */}
      <div className="flex-1 bg-surface flex flex-col items-center justify-center p-6 md:p-12 shadow-[-20px_0_40px_rgba(0,0,0,0.05)] z-20">
        <div className="w-full max-w-[280px]">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-text-main mb-2">Welcome Back</h2>
            {errorMsg ? (
              <p className="text-red-500 font-bold text-sm bg-red-500/10 px-3 py-1.5 rounded-lg inline-block animate-shake">{errorMsg}</p>
            ) : (
              <p className="text-text-light font-medium text-sm h-[30px] flex items-center justify-center">Enter your PIN to unlock</p>
            )}
          </div>

          <div className="flex justify-center gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                  pin.length > i 
                    ? 'bg-primary scale-110 shadow-md shadow-primary/40' 
                    : 'bg-border'
                } ${error ? 'bg-red-500 animate-shake' : ''}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 w-full mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleKeypad(num.toString())}
                className="h-14 sm:h-16 text-xl sm:text-2xl font-bold bg-surface-hover hover:bg-border rounded-full shadow-sm border border-border transition-all active:scale-95 flex items-center justify-center text-text-main"
              >
                {num}
              </button>
            ))}
            <div />
            <button
              onClick={() => handleKeypad('0')}
              className="h-14 sm:h-16 text-xl sm:text-2xl font-bold bg-surface-hover hover:bg-border rounded-full shadow-sm border border-border transition-all active:scale-95 flex items-center justify-center text-text-main"
            >
              0
            </button>
            <button
              onClick={handleDel}
              className="h-14 sm:h-16 flex items-center justify-center text-text-light hover:text-red-500 bg-surface-hover hover:bg-red-500/10 rounded-full shadow-sm border border-border transition-all active:scale-95"
            >
              <Delete size={22} />
            </button>
          </div>

          {/* Forgot PIN link */}
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setShowForgotPin(true)}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary/5"
            >
              <KeyRound size={12} />
              Forgot PIN?
            </button>
          </div>
          
          <div className="mt-4 flex justify-center">
            <p className="text-xs font-bold text-text-light flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover border border-border rounded-lg">
              <Lock size={12} /> Terminal Locked
            </p>
          </div>
        </div>
      </div>

      {/* Forgot PIN Modal */}
      {renderForgotPinModal()}
    </div>
  );
}

import { db } from '../db';
import { Capacitor } from '@capacitor/core';

/**
 * OTP Configuration and in-memory store
 */
const OTP_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;

/**
 * Active OTP sessions keyed by managerId
 * {
 *   [managerId]: {
 *     code: string,
 *     expiresAt: number,
 *     lastSentAt: number,
 *     attempts: number,
 *     isLocked: boolean,
 *     actionName: string,
 *     channel: 'GMAIL' | 'SMS' | 'BOTH'
 *   }
 * }
 */
const activeOtps = new Map();

/**
 * Generates a cryptographically secure 6-digit numeric token
 */
export function generateSecureOtpToken() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Guarantee 6 digits: 100000 to 999999
  const token = 100000 + (array[0] % 900000);
  return token.toString();
}

export const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxLClbcVO3RN8tKsiyxs_RsKYNbYxQ1FonuyIMxLuu-CBpgwyEOzZDWT21tO9aXUm578w/exec';

/**
 * Dispatches an email via Google Apps Script Webhook (from airlunacreations@gmail.com), EmailJS, or webhook
 */
async function sendGmailEmail({ to, subject, body, otpCode, actionName }) {
  console.log(`[OtpService] Dispatching Gmail OTP to ${to} (Sender: airlunacreations@gmail.com)`);

  const settings = await db.app_settings.get('default');
  const googleScriptUrl = settings?.googleAppsScriptUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
  const emailWebhookUrl = settings?.emailWebhookUrl?.trim();
  const emailjsServiceId = settings?.emailjsServiceId?.trim();
  const emailjsTemplateId = settings?.emailjsTemplateId?.trim();
  const emailjsPublicKey = settings?.emailjsPublicKey?.trim();

  // 1. Google Apps Script Webhook (Direct free dispatch from airlunacreations@gmail.com)
  if (googleScriptUrl) {
    try {
      // mode: 'no-cors' allows browser dispatch to Google Apps Script without CORS blockage
      await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          to,
          subject,
          code: otpCode,
          actionName: actionName || 'Authorization Override',
          sender: 'airlunacreations@gmail.com'
        })
      });

      return {
        success: true,
        channel: 'GMAIL',
        recipient: to,
        sender: 'airlunacreations@gmail.com',
        timestamp: Date.now()
      };
    } catch (err) {
      console.error('[OtpService] Google Apps Script dispatch failed:', err);
      throw new Error(`Failed to send email via Google Apps Script: ${err.message}`);
    }
  }

  // 2. EmailJS REST API
  if (emailjsServiceId && emailjsPublicKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId || 'template_aster_pos',
          user_id: emailjsPublicKey,
          template_params: {
            to_email: to,
            otp_code: otpCode,
            action_name: actionName || 'Authorization Override',
            from_email: 'airlunacreations@gmail.com'
          }
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`EmailJS error: ${text || response.statusText}`);
      }

      return {
        success: true,
        channel: 'GMAIL',
        recipient: to,
        sender: 'airlunacreations@gmail.com',
        timestamp: Date.now()
      };
    } catch (err) {
      console.error('[OtpService] EmailJS dispatch failed:', err);
      throw new Error(`Failed to send email via EmailJS: ${err.message}`);
    }
  }

  // 3. Custom Generic Webhook
  if (emailWebhookUrl) {
    try {
      const response = await fetch(emailWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text: body,
          code: otpCode,
          actionName,
          from: 'airlunacreations@gmail.com'
        })
      });
      if (!response.ok) {
        throw new Error(`Email webhook returned HTTP ${response.status}`);
      }
      return { success: true, channel: 'GMAIL', recipient: to, timestamp: Date.now() };
    } catch (err) {
      console.error('[OtpService] Custom email webhook error:', err);
      throw new Error(`Email webhook failed: ${err.message}`);
    }
  }

  return { success: true, channel: 'GMAIL', recipient: to, timestamp: Date.now() };
}

/**
 * Dispatches an SMS via Automatic Native Android SMS (Direct background sending via SIM),
 * Custom SMS Webhook, or Universal Native Device SMS app
 */
async function sendSmsMessage({ to, body, otpCode, actionName }) {
  console.log(`[OtpService] Dispatching SMS OTP to ${to}:`, { body });

  const cleanPhone = to.replace(/[\s\-\(\)]/g, '');
  const smsMessage = `Aster POS: Verification OTP is ${otpCode} for ${actionName || 'Manager Override'}. Valid for 5 mins. Do not share.`;

  // 1. Automatic Silent Android Native SMS (Direct SIM sending via Android SmsManager inside APK)
  if (typeof Capacitor !== 'undefined' && Capacitor.isPluginAvailable && Capacitor.isPluginAvailable('NativeSms')) {
    try {
      console.log('[OtpService] Sending automated background SMS via NativeSmsPlugin...');
      const nativeRes = await Capacitor.Plugins.NativeSms.sendSms({
        phoneNumber: cleanPhone,
        message: smsMessage
      });
      console.log('[OtpService] Automatic SMS response:', nativeRes);
      return {
        success: true,
        channel: 'SMS',
        recipient: to,
        method: 'AUTOMATIC_ANDROID_SMS',
        timestamp: Date.now()
      };
    } catch (pluginErr) {
      console.warn('[OtpService] NativeSmsPlugin failed or permission required, checking fallbacks:', pluginErr);
    }
  }

  // 2. Custom SMS Webhook if configured
  const settings = await db.app_settings.get('default');
  const smsWebhookUrl = settings?.smsWebhookUrl?.trim();
  if (smsWebhookUrl) {
    try {
      const response = await fetch(smsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanPhone,
          message: smsMessage,
          code: otpCode,
          actionName
        })
      });
      if (!response.ok) {
        throw new Error(`SMS webhook returned HTTP ${response.status}`);
      }
      return { success: true, channel: 'SMS', recipient: to, timestamp: Date.now() };
    } catch (err) {
      console.error('[OtpService] Custom SMS webhook failed:', err);
      throw new Error(`SMS webhook failed: ${err.message}`);
    }
  }

  // 3. Fallback: Universal Native Device SMS App Launcher
  try {
    const isApple = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent));
    const separator = isApple ? '&' : '?';
    const smsUri = `sms:${cleanPhone}${separator}body=${encodeURIComponent(smsMessage)}`;

    if (typeof window !== 'undefined') {
      try {
        // Direct assignment reliably launches native SMS without opening blank popup tabs
        window.location.href = smsUri;
      } catch (e) {
        const link = document.createElement('a');
        link.href = smsUri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      if (navigator.clipboard) {
        navigator.clipboard.writeText(smsMessage).catch(() => {});
      }
    }

    return {
      success: true,
      channel: 'SMS',
      recipient: to,
      method: 'DEVICE_SIM',
      timestamp: Date.now()
    };
  } catch (err) {
    console.error('[OtpService] Device SMS trigger failed:', err);
    throw new Error(`Failed to send SMS: ${err.message}`);
  }
}

/**
 * Request an OTP for a manager
 * @param {Object} options
 * @param {number|string} options.managerId
 * @param {'GMAIL'|'SMS'|'BOTH'} options.channel
 * @param {string} [options.actionName]
 * @returns {Promise<{ success: boolean, message: string, cooldownRemaining?: number, expiresAt: number }>}
 */
export async function requestManagerOtp({ managerId, channel = 'GMAIL', actionName = 'Authorization Override' }) {
  const manager = await db.users.get(Number(managerId));
  if (!manager) {
    throw new Error('Manager account not found.');
  }

  if (manager.role !== 'manager' && manager.role !== 'super_admin') {
    throw new Error('Selected user does not have manager authorization privileges.');
  }

  if (manager.is_active === 0) {
    throw new Error('This manager account is currently deactivated.');
  }

  const now = Date.now();
  const existing = activeOtps.get(manager.id);

  // Rate Limiting: 60-second cooldown
  if (existing && !existing.isLocked) {
    const elapsed = now - existing.lastSentAt;
    if (elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        cooldownRemaining: waitSec,
        message: `Please wait ${waitSec}s before requesting a new OTP code.`
      };
    }
  }

  // Check Lockout
  if (existing?.isLocked) {
    // If locked, check if 5 minutes passed since lock
    if (now < existing.expiresAt) {
      const remainingSec = Math.ceil((existing.expiresAt - now) / 1000);
      return {
        success: false,
        isLocked: true,
        message: `Too many invalid attempts. Manager override is locked for ${remainingSec}s.`
      };
    }
  }

  // Generate 6-digit code
  const otpCode = generateSecureOtpToken();
  const expiresAt = now + OTP_EXPIRATION_MS;

  const targetChannel = channel === 'BOTH' ? (manager.otp_delivery_preference || 'BOTH') : channel;

  // Validate contact info
  const email = manager.email?.trim();
  const phone = manager.phone_number?.trim();

  if ((targetChannel === 'GMAIL' || targetChannel === 'BOTH') && !email) {
    if (targetChannel === 'GMAIL') {
      throw new Error(`Manager ${manager.name} does not have an email address configured.`);
    }
  }

  if ((targetChannel === 'SMS' || targetChannel === 'BOTH') && !phone) {
    if (targetChannel === 'SMS') {
      throw new Error(`Manager ${manager.name} does not have a mobile phone number configured.`);
    }
  }

  // Dispatch payloads
  const dispatchPromises = [];

  if ((targetChannel === 'GMAIL' || targetChannel === 'BOTH') && email) {
    const subject = `[Aster POS] Manager Override OTP: ${otpCode}`;
    const body = `A manager override (${actionName}) was requested at Main Counter. Your verification code is ${otpCode}. This code expires in 5 minutes.`;
    dispatchPromises.push(sendGmailEmail({ to: email, subject, body, otpCode, actionName }));
  }

  if ((targetChannel === 'SMS' || targetChannel === 'BOTH') && phone) {
    const body = `Aster POS Alert: Override code for ${actionName} is ${otpCode}. Valid for 5 mins.`;
    dispatchPromises.push(sendSmsMessage({ to: phone, body, otpCode, actionName }));

    // If manager has an email, send a silent background backup copy so the manager receives the code
    // even if the POS register device has no cellular carrier SIM card or no SMS signal!
    if (email && targetChannel === 'SMS') {
      sendGmailEmail({
        to: email,
        subject: `[Aster POS] Verification OTP: ${otpCode}`,
        body: `A manager override (${actionName}) was requested. Verification code: ${otpCode}. Valid for 5 minutes.`,
        otpCode,
        actionName
      }).catch(err => console.warn('[OtpService] Background backup email failed:', err));
    }
  }

  if (dispatchPromises.length === 0) {
    throw new Error(`No valid contact details (email or phone) configured for Manager ${manager.name}.`);
  }

  const results = await Promise.all(dispatchPromises);
  const smsResult = results.find(r => r?.channel === 'SMS');
  const wasAutomaticSms = smsResult?.method === 'AUTOMATIC_ANDROID_SMS';

  // Store in active store
  activeOtps.set(manager.id, {
    code: otpCode,
    expiresAt,
    lastSentAt: now,
    attempts: 0,
    isLocked: false,
    actionName,
    channel: targetChannel
  });

  const maskedPhone = maskPhone(phone);
  const maskedEmail = maskEmail(email);

  let successMsg = `OTP dispatched to ${manager.name}.`;
  if (targetChannel === 'GMAIL') {
    successMsg = `OTP sent to ${maskedEmail || manager.name + "'s email"}.`;
  } else if (targetChannel === 'SMS') {
    successMsg = wasAutomaticSms
      ? `OTP sent automatically via SMS to ${maskedPhone}.`
      : `SMS text dispatched to ${maskedPhone}.`;
  }

  return {
    success: true,
    message: successMsg,
    expiresAt,
    recipientEmail: maskedEmail || null,
    recipientPhone: maskedPhone || null
  };
}

/**
 * Masks an email for privacy (e.g. manager@airlunacreations.com -> m***r@airlunacreations.com)
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 1) return trimmed;
  const username = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex);
  if (username.length <= 2) {
    return `${username[0]}***${domain}`;
  }
  return `${username[0]}***${username[username.length - 1]}${domain}`;
}

/**
 * Masks a phone number for privacy (e.g. +639123456789 -> +63 9••••••789)
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length <= 4) return trimmed;

  if (trimmed.startsWith('+63')) {
    return `+63 9••••••${digits.slice(-3)}`;
  } else if (trimmed.startsWith('09')) {
    return `09••••••${digits.slice(-3)}`;
  } else if (trimmed.startsWith('+')) {
    const prefix = trimmed.slice(0, 4);
    const suffix = trimmed.slice(-3);
    return `${prefix}••••••${suffix}`;
  } else {
    const prefix = trimmed.slice(0, 2);
    const suffix = trimmed.slice(-3);
    return `${prefix}••••••${suffix}`;
  }
}

/**
 * Verifies an OTP code entered for a manager
 * @param {Object} options
 * @param {number|string} options.managerId
 * @param {string} options.enteredCode
 * @returns {Promise<{ valid: boolean, manager?: Object, message: string, isLocked?: boolean, attemptsLeft?: number }>}
 */
export async function verifyManagerOtp({ managerId, enteredCode }) {
  const manager = await db.users.get(Number(managerId));
  if (!manager) {
    return { valid: false, message: 'Manager not found.' };
  }

  const session = activeOtps.get(manager.id);
  const now = Date.now();

  if (!session) {
    return { valid: false, message: 'No active OTP request found. Please request a new code.' };
  }

  if (session.isLocked) {
    if (now < session.expiresAt) {
      return { valid: false, isLocked: true, message: 'Override is locked due to too many failed attempts.' };
    } else {
      activeOtps.delete(manager.id);
      return { valid: false, message: 'Session expired. Please request a new OTP.' };
    }
  }

  if (now > session.expiresAt) {
    activeOtps.delete(manager.id);
    return { valid: false, message: 'OTP has expired. Please request a new code.' };
  }

  // Check code
  const cleanEntered = enteredCode.trim();
  if (cleanEntered === session.code) {
    const authChannel = session.channel;
    activeOtps.delete(manager.id);
    return {
      valid: true,
      manager,
      authType: authChannel === 'SMS' ? 'SMS_OTP' : 'GMAIL_OTP',
      message: 'OTP verified successfully.'
    };
  }

  // Increment failed attempts
  session.attempts += 1;
  const attemptsLeft = MAX_ATTEMPTS - session.attempts;

  if (session.attempts >= MAX_ATTEMPTS) {
    session.isLocked = true;
    session.expiresAt = now + OTP_EXPIRATION_MS; // Lock for 5 minutes
    return {
      valid: false,
      isLocked: true,
      attemptsLeft: 0,
      message: '3 invalid attempts. Override locked for 5 minutes.'
    };
  }

  return {
    valid: false,
    attemptsLeft,
    message: `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
  };
}

/**
 * Returns current status of manager OTP (cooldown, expiration)
 */
export function getManagerOtpStatus(managerId) {
  const session = activeOtps.get(Number(managerId));
  if (!session) return null;
  const now = Date.now();
  const cooldownRemaining = Math.max(0, Math.ceil((COOLDOWN_MS - (now - session.lastSentAt)) / 1000));
  const timeRemaining = Math.max(0, Math.ceil((session.expiresAt - now) / 1000));
  return {
    isLocked: session.isLocked,
    cooldownRemaining,
    timeRemaining,
    isExpired: now > session.expiresAt
  };
}

/**
 * Separate in-memory store for PIN reset OTPs (keyed by userId)
 * Kept separate from manager override OTPs to avoid interference.
 */
const pinResetOtps = new Map();

/**
 * Request a PIN reset OTP for any user (all roles).
 * Sends a 6-digit code to the user's registered email.
 * @param {Object} options
 * @param {number|string} options.userId - The user ID requesting the reset
 * @returns {Promise<{ success: boolean, message: string, maskedEmail?: string, expiresAt?: number, cooldownRemaining?: number }>}
 */
export async function requestPinResetOtp({ userId }) {
  const user = await db.users.get(Number(userId));
  if (!user) {
    throw new Error('User account not found.');
  }

  if (user.is_active === 0) {
    throw new Error('This account is currently deactivated. Contact your manager.');
  }

  const email = user.email?.trim();
  if (!email) {
    throw new Error('No email address is configured for this account. Please contact your manager to reset your PIN.');
  }

  const now = Date.now();
  const existing = pinResetOtps.get(user.id);

  // Rate Limiting: 60-second cooldown
  if (existing && !existing.isLocked) {
    const elapsed = now - existing.lastSentAt;
    if (elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        cooldownRemaining: waitSec,
        message: `Please wait ${waitSec}s before requesting a new code.`
      };
    }
  }

  // Check lockout from too many failed attempts
  if (existing?.isLocked) {
    if (now < existing.expiresAt) {
      const remainingSec = Math.ceil((existing.expiresAt - now) / 1000);
      return {
        success: false,
        isLocked: true,
        message: `Too many invalid attempts. PIN reset is locked for ${remainingSec}s.`
      };
    }
  }

  // Generate 6-digit code
  const otpCode = generateSecureOtpToken();
  const expiresAt = now + OTP_EXPIRATION_MS;

  const subject = `[Aster POS] PIN Reset Code: ${otpCode}`;
  const body = `A PIN reset was requested for your account "${user.name}". Your verification code is ${otpCode}. This code expires in 5 minutes. If you did not request this, please ignore this email.`;

  await sendGmailEmail({ to: email, subject, body, otpCode, actionName: 'PIN Reset' });

  // Store in PIN reset store
  pinResetOtps.set(user.id, {
    code: otpCode,
    expiresAt,
    lastSentAt: now,
    attempts: 0,
    isLocked: false
  });

  const maskedAddr = maskEmail(email);

  return {
    success: true,
    message: `Reset code sent to ${maskedAddr}.`,
    maskedEmail: maskedAddr,
    expiresAt
  };
}

/**
 * Verify a PIN reset OTP code for any user.
 * @param {Object} options
 * @param {number|string} options.userId
 * @param {string} options.enteredCode
 * @returns {Promise<{ valid: boolean, message: string, isLocked?: boolean, attemptsLeft?: number }>}
 */
export async function verifyPinResetOtp({ userId, enteredCode }) {
  const user = await db.users.get(Number(userId));
  if (!user) {
    return { valid: false, message: 'User not found.' };
  }

  const session = pinResetOtps.get(user.id);
  const now = Date.now();

  if (!session) {
    return { valid: false, message: 'No active reset request found. Please request a new code.' };
  }

  if (session.isLocked) {
    if (now < session.expiresAt) {
      return { valid: false, isLocked: true, message: 'Reset is locked due to too many failed attempts.' };
    } else {
      pinResetOtps.delete(user.id);
      return { valid: false, message: 'Session expired. Please request a new code.' };
    }
  }

  if (now > session.expiresAt) {
    pinResetOtps.delete(user.id);
    return { valid: false, message: 'Code has expired. Please request a new one.' };
  }

  const cleanEntered = enteredCode.trim();
  if (cleanEntered === session.code) {
    pinResetOtps.delete(user.id);
    return {
      valid: true,
      message: 'Code verified successfully. You can now set a new PIN.'
    };
  }

  // Increment failed attempts
  session.attempts += 1;
  const attemptsLeft = MAX_ATTEMPTS - session.attempts;

  if (session.attempts >= MAX_ATTEMPTS) {
    session.isLocked = true;
    session.expiresAt = now + OTP_EXPIRATION_MS;
    return {
      valid: false,
      isLocked: true,
      attemptsLeft: 0,
      message: 'Too many invalid attempts. PIN reset locked for 5 minutes.'
    };
  }

  return {
    valid: false,
    attemptsLeft,
    message: `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
  };
}

/**
 * Test email dispatch from settings
 */
export async function testSendEmail(targetEmail) {
  const code = '123456';
  const subject = '[Aster POS Test] Verification Code: ' + code;
  const body = 'This is a test notification from Aster POS. Your email gateway is operational and verified.';
  return await sendGmailEmail({
    to: targetEmail,
    subject,
    body,
    otpCode: code,
    actionName: 'Gateway Configuration Test'
  });
}

/**
 * Test SMS dispatch from settings
 */
export async function testSendSms(targetPhone) {
  const code = '123456';
  const body = 'Aster POS Test: Your SMS gateway is working properly. Verification test code is 123456.';
  return await sendSmsMessage({
    to: targetPhone,
    body,
    otpCode: code,
    actionName: 'Gateway Test'
  });
}


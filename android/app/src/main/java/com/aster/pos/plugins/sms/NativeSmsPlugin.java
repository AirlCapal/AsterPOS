package com.aster.pos.plugins.sms;

import android.Manifest;
import android.os.Build;
import android.telephony.SmsManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "NativeSms",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.SEND_SMS }
        )
    }
)
public class NativeSmsPlugin extends Plugin {

    private static final String TAG = "NativeSmsPlugin";

    @PluginMethod
    public void sendSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");

        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            call.reject("Phone number is required");
            return;
        }

        if (message == null || message.trim().isEmpty()) {
            call.reject("Message is required");
            return;
        }

        // Check SEND_SMS runtime permission
        if (getPermissionState("sms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }

        executeSendSms(call, phoneNumber, message);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED) {
            String phoneNumber = call.getString("phoneNumber");
            String message = call.getString("message");
            executeSendSms(call, phoneNumber, message);
        } else {
            call.reject("Permission to send SMS automatically was denied");
        }
    }

    private void executeSendSms(PluginCall call, String phoneNumber, String message) {
        try {
            SmsManager smsManager;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getContext().getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            if (smsManager == null) {
                call.reject("SMS service is not available on this device (No SIM card or telephony detected)");
                return;
            }

            // Split into parts if message length > 160 characters
            ArrayList<String> parts = smsManager.divideMessage(message);
            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            }

            Log.i(TAG, "SMS successfully sent automatically to: " + phoneNumber);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("recipient", phoneNumber);
            ret.put("method", "AUTOMATIC_ANDROID_SMS");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS automatically", e);
            call.reject("Failed to send SMS automatically: " + e.getMessage());
        }
    }
}

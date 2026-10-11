/**
 * Aster POS - Free Cloud Relay & OTP Mailer (Google Apps Script)
 * -------------------------------------------------------------------
 * This Google Apps Script acts as both:
 *  1. Free Gmail OTP Sender (Email verification / manager override)
 *  2. Free Cloud Sync Relay (Transmits POS sales, stock & menu data to the Manager Web Portal)
 * 
 * 100% Free - Runs on Google Apps Script with zero server or subscription costs.
 * 
 * INSTRUCTIONS TO UPDATE / DEPLOY:
 * 1. Go to https://script.google.com while signed in to airlunacreations@gmail.com
 * 2. Open your "Aster POS OTP Mailer" project (or create a new project)
 * 3. Replace all code in Code.gs with this script
 * 4. Click "Deploy" > "Manage deployments" > Edit (pencil icon) > Version: "New version" > Deploy
 *    (Ensure "Execute as: Me" and "Who has access: Anyone")
 * 5. If creating a new deployment, copy the Web App URL and paste it in Aster POS Settings.
 */

function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    // -------------------------------------------------------------
    // ACTION 1: CLOUD DATA SYNC (POS -> Manager Website)
    // -------------------------------------------------------------
    if (data.action === "PUSH_SYNC_DATA") {
      saveSnapshot(JSON.stringify(data));
      return ContentService
        .createTextOutput(JSON.stringify({ 
          success: true, 
          message: "POS snapshot successfully synced to cloud", 
          syncedAt: new Date().toISOString() 
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 2: EMAIL OTP DISPATCH
    // -------------------------------------------------------------
    var recipient = data.to;
    var subject = data.subject || ("Aster POS Verification Code: " + (data.code || ""));
    var otpCode = data.code || "";
    var actionName = data.actionName || "Authorization Override";

    if (!recipient) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: "Missing recipient email" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var htmlTemplate = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 22px;">Aster POS Authorization</h2>
          <p style="color: #64748b; margin: 0; font-size: 13px;">Security verification requested from Main Register</p>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>Action:</strong> ${actionName}</p>
          <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Requested:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div style="text-align: center; margin: 28px 0; padding: 20px; background: #eff6ff; border-radius: 12px; border: 1px dashed #3b82f6;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; margin-bottom: 6px;">Your 6-Digit One-Time PIN</div>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; font-family: monospace;">${otpCode}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Valid for 5 minutes. Do not share this code.</div>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Powered by AirLuna Creations</p>
      </div>
    `;

    var plainText = "Aster POS Verification Code: " + otpCode + "\nAction: " + actionName + "\nValid for 5 minutes.\n\nPowered by AirLuna Creations";

    // Send email with masked display name
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: plainText,
      htmlBody: htmlTemplate,
      name: "Aster POS (a***s@gmail.com)"
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: "Email sent successfully from airlunacreations@gmail.com" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    
    // Fetch snapshot for Manager Website
    if (params && params.action === "GET_SYNC_DATA") {
      var snapshot = loadSnapshot();
      var props = PropertiesService.getScriptProperties();
      var updatedAt = props.getProperty("UPDATED_AT") || null;

      return ContentService
        .createTextOutput(JSON.stringify({ 
          success: true, 
          snapshot: snapshot, 
          updatedAt: updatedAt 
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "active", 
        service: "Aster POS Cloud Relay & OTP Service", 
        poweredBy: "AirLuna Creations" 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Storage Helpers using ScriptProperties (Chunked for payload sizes > 9KB)
 */
function saveSnapshot(snapshotJson) {
  var props = PropertiesService.getScriptProperties();
  
  // Clear existing chunks
  var oldChunkCount = parseInt(props.getProperty("CHUNK_COUNT") || "0", 10);
  for (var i = 0; i < oldChunkCount; i++) {
    props.deleteProperty("CHUNK_" + i);
  }

  var chunkSize = 8000;
  var count = Math.ceil(snapshotJson.length / chunkSize);
  props.setProperty("CHUNK_COUNT", count.toString());
  props.setProperty("UPDATED_AT", new Date().toISOString());

  for (var j = 0; j < count; j++) {
    props.setProperty("CHUNK_" + j, snapshotJson.substring(j * chunkSize, (j + 1) * chunkSize));
  }
}

function loadSnapshot() {
  var props = PropertiesService.getScriptProperties();
  var count = parseInt(props.getProperty("CHUNK_COUNT") || "0", 10);
  if (!count || count === 0) return null;

  var json = "";
  for (var i = 0; i < count; i++) {
    json += (props.getProperty("CHUNK_" + i) || "");
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

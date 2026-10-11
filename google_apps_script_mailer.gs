/**
 * Aster POS - Free Gmail OTP Mailer (Google Apps Script)
 * -----------------------------------------------------------
 * INSTRUCTIONS TO DEPLOY:
 * 1. Go to https://script.google.com while signed in to airlunacreations@gmail.com
 * 2. Click "+ New project"
 * 3. Replace all default code with this script
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Set:
 *    - Description: "Aster POS OTP Mailer"
 *    - Execute as: "Me (airlunacreations@gmail.com)"
 *    - Who has access: "Anyone"
 * 7. Click "Deploy" and authorize the permissions when prompted
 * 8. Copy the Web App URL (starts with https://script.google.com/macros/s/...)
 * 9. Paste the URL into Aster POS under:
 *    Super Admin Settings > OTP Gateways > Google Apps Script Web App URL
 */

function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

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
  return ContentService
    .createTextOutput(JSON.stringify({ status: "active", sender: "airlunacreations@gmail.com" }))
    .setMimeType(ContentService.MimeType.JSON);
}

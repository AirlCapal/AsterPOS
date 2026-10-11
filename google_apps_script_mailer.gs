/**
 * Aster POS — Multi-Branch Two-Way Cloud Relay & OTP Mailer (Google Apps Script)
 * --------------------------------------------------------------------------------
 * This Google Apps Script powers:
 *  1. Multi-Branch Store Synchronization:
 *     - Completely separate data partitions for different shops / branches!
 *     - Partitioned by Manager Email (e.g. manager@branch1.com) or Branch Code (e.g. BRANCH-001).
 *     - Unlimited payload capacity using Google Drive files (no 9KB Properties limit!).
 *     - Full two-way sync: POS -> Web (orders, revenue, stocks) and Web -> POS (menu, prices, inventory edits).
 *  2. Free Gmail OTP Sender (Manager override & password recovery).
 * 
 * 100% Free — Runs directly on Google Apps Script under your Google account with zero server fees.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open https://script.google.com while signed in to airlunacreations@gmail.com
 * 2. Open your "Aster POS" script project
 * 3. Replace all code in Code.gs with this script
 * 4. Click "Deploy" > "Manage deployments" > Edit (pencil icon) > Version: "New version" > Deploy
 *    (IMPORTANT: Set "Execute as: Me" and "Who has access: Anyone")
 */

// ── Configuration ──
var FOLDER_NAME = "AsterPOS_Sync_Branches";

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = (params && params.action) ? params.action : "";
    var branch = normalizeBranch(params ? params.branch : "default");

    // 1. Ping / Test Connection
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

    // 2. Fetch Sync Data for a specific branch
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

    // 3. List all registered branches (for franchise owners)
    if (action === "LIST_BRANCHES") {
      var branches = listAllBranches();
      return createJsonResponse({
        success: true,
        branches: branches,
        total: branches.length
      });
    }

    // Default status endpoint
    return createJsonResponse({
      status: "active",
      service: "Aster POS Multi-Branch Two-Way Cloud Relay & OTP Service",
      poweredBy: "AirLuna Creations",
      sender: "airlunacreations@gmail.com",
      timestamp: Date.now()
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "{}";
    var data = {};
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      data = {};
    }

    var action = data.action || (e.parameter ? e.parameter.action : "");
    var branch = normalizeBranch(data.branch || (e.parameter ? e.parameter.branch : "default"));

    // -------------------------------------------------------------
    // ACTION 1: MULTI-BRANCH TWO-WAY CLOUD SYNC
    // -------------------------------------------------------------
    if (action === "PUSH_SYNC_DATA" || action === "PUSH_WEB_UPDATE") {
      var source = data.source || (action === "PUSH_WEB_UPDATE" ? "WEB" : "POS");
      var timestamp = data.timestamp || Date.now();

      var saveResult = saveBranchSnapshot(branch, data, source, timestamp);

      return createJsonResponse({
        success: true,
        branch: branch,
        source: source,
        storage: saveResult.storage,
        message: "Branch [" + branch + "] snapshot synced successfully (" + source + ")",
        timestamp: timestamp
      });
    }

    // -------------------------------------------------------------
    // ACTION 2: EMAIL OTP DISPATCH
    // -------------------------------------------------------------
    if (action === "SEND_OTP" || data.to) {
      var recipient = data.to;
      var subject = data.subject || ("Aster POS Verification Code: " + (data.code || ""));
      var otpCode = data.code || "";
      var actionName = data.actionName || "Authorization Override";

      if (!recipient) {
        return createJsonResponse({ success: false, message: "Missing recipient email" });
      }

      var htmlTemplate = [
        '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">',
        '  <div style="text-align: center; margin-bottom: 24px;">',
        '    <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 22px;">Aster POS Authorization</h2>',
        '    <p style="color: #64748b; margin: 0; font-size: 13px;">Security verification requested from Main Register</p>',
        '  </div>',
        '  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">',
        '    <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>Action:</strong> ' + actionName + '</p>',
        '    <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>Branch:</strong> ' + branch + '</p>',
        '    <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Requested:</strong> ' + new Date().toLocaleString() + '</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 28px 0; padding: 20px; background: #eff6ff; border-radius: 12px; border: 1px dashed #3b82f6;">',
        '    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; margin-bottom: 6px;">Your 6-Digit One-Time PIN</div>',
        '    <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; font-family: monospace;">' + otpCode + '</div>',
        '    <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Valid for 5 minutes. Do not share this code.</div>',
        '  </div>',
        '  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Powered by AirLuna Creations</p>',
        '</div>'
      ].join('\n');

      var plainText = "Aster POS Verification Code: " + otpCode + "\nAction: " + actionName + "\nBranch: " + branch + "\nValid for 5 minutes.\n\nPowered by AirLuna Creations";

      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        body: plainText,
        htmlBody: htmlTemplate,
        name: "Aster POS (" + branch + ")"
      });

      return createJsonResponse({
        success: true,
        message: "Email sent successfully to " + recipient
      });
    }

    return createJsonResponse({
      success: false,
      message: "Unrecognized action: " + action
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

// ── Helper: Normalized JSON Response with CORS ──
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeBranch(str) {
  if (!str) return "default";
  var clean = String(str).toLowerCase().trim();
  clean = clean.replace(/[^a-z0-9_@.-]/g, "_");
  return clean || "default";
}

// ── Storage Engine 1: Google Drive (Isolated files per branch, unlimited capacity) ──
function getBranchFolder() {
  try {
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) {
      return folders.next();
    }
    return DriveApp.createFolder(FOLDER_NAME);
  } catch (e) {
    return null;
  }
}

function saveBranchSnapshot(branchKey, dataObj, source, timestamp) {
  var safeKey = normalizeBranch(branchKey);
  var payloadString = JSON.stringify(dataObj);
  var metaObj = {
    branch: safeKey,
    updatedAt: new Date().toISOString(),
    lastSource: source || "POS",
    mutationTimestamp: timestamp || Date.now()
  };

  // Primary: Google Drive file
  try {
    var folder = getBranchFolder();
    if (folder) {
      var fileName = "branch_" + safeKey + ".json";
      var metaName = "meta_" + safeKey + ".json";

      // Write data file
      var files = folder.getFilesByName(fileName);
      if (files.hasNext()) {
        files.next().setContent(payloadString);
      } else {
        folder.createFile(fileName, payloadString, MimeType.PLAIN_TEXT);
      }

      // Write metadata file
      var metaFiles = folder.getFilesByName(metaName);
      var metaString = JSON.stringify(metaObj);
      if (metaFiles.hasNext()) {
        metaFiles.next().setContent(metaString);
      } else {
        folder.createFile(metaName, metaString, MimeType.PLAIN_TEXT);
      }

      return { storage: "drive", branch: safeKey };
    }
  } catch (driveErr) {
    // DriveApp fallback
  }

  // Fallback: PropertiesService chunking per branch
  try {
    var props = PropertiesService.getScriptProperties();
    var chunkSize = 7500;
    var count = Math.ceil(payloadString.length / chunkSize);

    // Clear old chunks
    var oldCount = parseInt(props.getProperty(safeKey + "_COUNT") || "0", 10);
    for (var k = 0; k < oldCount; k++) {
      props.deleteProperty(safeKey + "_C" + k);
    }

    props.setProperty(safeKey + "_COUNT", count.toString());
    props.setProperty(safeKey + "_UPDATED_AT", metaObj.updatedAt);
    props.setProperty(safeKey + "_SRC", metaObj.lastSource);
    props.setProperty(safeKey + "_TS", metaObj.mutationTimestamp.toString());

    for (var i = 0; i < count; i++) {
      props.setProperty(safeKey + "_C" + i, payloadString.substring(i * chunkSize, (i + 1) * chunkSize));
    }

    return { storage: "properties", branch: safeKey };
  } catch (propErr) {
    return { storage: "failed", error: propErr.toString() };
  }
}

function loadBranchSnapshot(branchKey) {
  var safeKey = normalizeBranch(branchKey);

  // 1. Try Google Drive file
  try {
    var folder = getBranchFolder();
    if (folder) {
      var fileName = "branch_" + safeKey + ".json";
      var files = folder.getFilesByName(fileName);
      if (files.hasNext()) {
        var str = files.next().getBlob().getDataAsString();
        return JSON.parse(str);
      }
    }
  } catch (driveErr) {}

  // 2. Try PropertiesService fallback
  try {
    var props = PropertiesService.getScriptProperties();
    var count = parseInt(props.getProperty(safeKey + "_COUNT") || "0", 10);
    if (count > 0) {
      var json = "";
      for (var i = 0; i < count; i++) {
        json += (props.getProperty(safeKey + "_C" + i) || "");
      }
      return JSON.parse(json);
    }
  } catch (propErr) {}

  return null;
}

function loadBranchMetadata(branchKey) {
  var safeKey = normalizeBranch(branchKey);

  try {
    var folder = getBranchFolder();
    if (folder) {
      var metaName = "meta_" + safeKey + ".json";
      var metaFiles = folder.getFilesByName(metaName);
      if (metaFiles.hasNext()) {
        var str = metaFiles.next().getBlob().getDataAsString();
        return JSON.parse(str);
      }
    }
  } catch (driveErr) {}

  try {
    var props = PropertiesService.getScriptProperties();
    return {
      updatedAt: props.getProperty(safeKey + "_UPDATED_AT") || null,
      lastSource: props.getProperty(safeKey + "_SRC") || "POS",
      mutationTimestamp: parseInt(props.getProperty(safeKey + "_TS") || "0", 10)
    };
  } catch (propErr) {
    return {};
  }
}

function listAllBranches() {
  var list = [];
  try {
    var folder = getBranchFolder();
    if (folder) {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var name = file.getName();
        if (name.indexOf("meta_") === 0 && name.indexOf(".json") > 0) {
          var branchName = name.replace("meta_", "").replace(".json", "");
          list.push(branchName);
        }
      }
    }
  } catch (e) {}
  return list;
}

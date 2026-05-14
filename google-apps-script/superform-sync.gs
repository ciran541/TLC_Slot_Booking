/**
 * TLC Superform Lead Sync — Google Apps Script
 * ──────────────────────────────────────────────────────────────────────────────
 * Sheet: "Sheet1" (update if your sheet is named differently)
 * Column E (5) = name
 * Column F (6) = email
 * Column G (7) = contactNumber
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
var TLC_SYNC_CONFIG = {
  SUPABASE_URL: "https://your-project.supabase.co", // ← your Supabase Project URL
  SUPABASE_KEY: "your-supabase-service-role-key",   // ← your Supabase Service Role Key
  SHEET_NAME:   "Sheet1",                           // ← Update this if your sheet has a different name (e.g. "Form Responses 1")
  COL_NAME:     5,  // Column E
  COL_EMAIL:    6,  // Column F
  COL_PHONE:    7,  // Column G
};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise the phone number coming from the sheet.
 * Input examples:  "p:+6592296875"  |  "+6592296875"  |  "6592296875"
 * Output:          "+6592296875"
 */
function normalisePhone(raw) {
  if (!raw) return "";
  var s = String(raw).trim();

  // Strip leading "p:" prefix (case-insensitive)
  s = s.replace(/^p:/i, "");

  // Strip spaces, dashes, parentheses
  s = s.replace(/[\s\-\(\)]/g, "");

  return s;
}

/**
 * onChange installable trigger handler.
 * Fires whenever a new row is appended to the sheet.
 */
function onLeadAdded(e) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TLC_SYNC_CONFIG.SHEET_NAME);

    if (!sheet) {
      Logger.log("[TLC] Sheet not found: " + TLC_SYNC_CONFIG.SHEET_NAME + ". Falling back to active sheet.");
      sheet = ss.getActiveSheet();
    }

    // Determine the newly added row
    var row;
    if (e && e.range) {
      row = e.range.getRow();
    } else {
      row = sheet.getLastRow();
    }

    // Skip header row
    if (row <= 1) return;

    // Read the full row (columns 1→7 = A→G)
    var values = sheet.getRange(row, 1, 1, 7).getValues()[0];

    var name   = values[TLC_SYNC_CONFIG.COL_NAME  - 1] ? String(values[TLC_SYNC_CONFIG.COL_NAME  - 1]).trim() : "";
    var email  = values[TLC_SYNC_CONFIG.COL_EMAIL - 1] ? String(values[TLC_SYNC_CONFIG.COL_EMAIL - 1]).trim() : "";
    var phone  = normalisePhone(values[TLC_SYNC_CONFIG.COL_PHONE - 1]);

    // Validate required fields
    if (!name || !email || !phone) {
      Logger.log("[TLC] Row " + row + " — missing required fields. name=" + name + " email=" + email + " phone=" + phone + ". Skipping.");
      return;
    }

    var payload = JSON.stringify({
      name:   name,
      email:  email.toLowerCase(),
      phone:  phone,
      source: "superform",
    });

    // We use Supabase REST API's UPSERT feature.
    // The "Prefer" header "resolution=merge-duplicates" combined with the unique
    // constraint on "phone" column will update existing leads or insert new ones.
    var options = {
      method:          "post",
      contentType:     "application/json",
      headers: { 
        "apikey": TLC_SYNC_CONFIG.SUPABASE_KEY,
        "Authorization": "Bearer " + TLC_SYNC_CONFIG.SUPABASE_KEY,
        "Prefer": "resolution=merge-duplicates"
      },
      payload:         payload,
      muteHttpExceptions: true,
    };

    var response   = UrlFetchApp.fetch(TLC_SYNC_CONFIG.SUPABASE_URL + "/rest/v1/leads", options);
    var statusCode = response.getResponseCode();
    var body       = response.getContentText();

    if (statusCode === 200 || statusCode === 201) {
      Logger.log("[TLC] ✓ Synced row " + row + " — " + name + " | " + phone);
    } else {
      Logger.log("[TLC] ✗ Sync failed. Status: " + statusCode + " | " + body);
    }

  } catch (err) {
    Logger.log("[TLC] Error in onLeadAdded: " + err.toString());
  }
}

/**
 * Run ONCE to install the installable onChange trigger.
 * Apps Script → Run → setupTrigger
 */
function setupTrigger() {
  // Remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "onLeadAdded") {
      ScriptApp.deleteTrigger(t);
      Logger.log("[TLC] Removed old trigger.");
    }
  });

  ScriptApp.newTrigger("onLeadAdded")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();

  Logger.log("[TLC] ✓ Installable trigger created for onLeadAdded.");
}

/**
 * Test: manually syncs the last row in the sheet.
 * Apps Script → Run → testSyncLastRow
 */
function testSyncLastRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TLC_SYNC_CONFIG.SHEET_NAME) || ss.getActiveSheet();
  
  var lastRow = sheet.getLastRow();
  Logger.log("[TLC] Testing sync for row: " + lastRow);
  onLeadAdded({ range: sheet.getRange(lastRow, 1) });
}

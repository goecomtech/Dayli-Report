/**
 * ============================================================================
 * LIFE FREE PRO - DAILY REPORTING & EMPLOYEE MANAGEMENT SYSTEM
 * Google Apps Script Backend (Code.gs)
 * ============================================================================
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this entire file.
 * 4. Click 'Save' (Ctrl + S).
 * 5. Click 'Deploy' > 'New deployment'.
 * 6. Select type: 'Web app'.
 * 7. Description: 'LFP Daily Reporting API'.
 * 8. Execute as: 'Me' (your email).
 * 9. Who has access: 'Anyone' (IMPORTANT: Must be 'Anyone').
 * 10. Click 'Deploy', authorize the permissions, and copy the Web App URL.
 * 11. Paste that URL into the Web App Setup page.
 * ============================================================================
 */

// Global Sheet Names
var SHEETS = {
  CONFIG: "Config",
  USERS: "Users",
  MASTER_REPORTS: "Reports_Master",
  ATTENDANCE: "Attendance",
  COMMISSIONS: "Commissions_Log",
  ADVANCES: "Advances_Log",
  SCHEDULES: "Schedules"
};

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  return handleRequest(e, "GET");
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  return handleRequest(e, "POST");
}

/**
 * Central Request Router
 */
function handleRequest(e, method) {
  var lock = LockService.getScriptLock();
  try {
    // Wait for up to 30 seconds for concurrent requests
    lock.waitLock(30000);

    var params = {};
    if (method === "GET") {
      params = e.parameter || {};
    } else {
      if (e.postData && e.postData.contents) {
        try {
          params = JSON.parse(e.postData.contents);
        } catch (err) {
          params = e.parameter || {};
        }
      } else {
        params = e.parameter || {};
      }
    }

    var action = params.action || "testConnection";
    var result = { success: false, message: "Invalid action" };

    // Auto-initialize required sheets if not already present
    initSheetsIfMissing();

    switch (action) {
      case "testConnection":
        result = testConnection();
        break;

      case "initSystem":
        result = initSystem(params);
        break;

      case "login":
        result = authenticateUser(params.identifier, params.password);
        break;

      case "getSettings":
        result = getSettings();
        break;

      case "saveSettings":
        result = saveSettings(params.settings);
        break;

      case "getEmployees":
        result = getEmployees();
        break;

      case "saveEmployee":
        result = saveEmployee(params.employee);
        break;

      case "deleteEmployee":
        result = deleteEmployee(params.employeeId);
        break;

      case "submitReport":
        result = submitReport(params.report);
        break;

      case "getReport":
        result = getReport(params.employeeId, params.date);
        break;

      case "getAllReports":
        result = getAllReports(params.filters);
        break;

      case "updateReport":
        result = updateReport(params.report);
        break;

      case "getAttendance":
        result = getAttendance(params.month, params.employeeId);
        break;

      case "getDashboardStats":
        result = getDashboardStats(params.date);
        break;

      case "getSchedule":
        result = getEmployeeSchedule(params.employeeId);
        break;

      case "saveSchedule":
        result = saveEmployeeSchedule(params.employeeId, params.schedule);
        break;

      case "uploadLogo":
        result = uploadLogoToDrive(params.fileData, params.fileName);
        break;

      case "verifyAdminPassword":
        result = verifyAdminPassword(params.password);
        break;

      case "deduplicate":
        result = deduplicateAllSheets();
        break;

      case "getCommissions":
        result = getCommissionsList(params.filters || params);
        break;

      case "updateCommissionStatus":
        result = updateCommissionStatus(params.commissionId, params.deliveryStatus, params.partialAmount, params.notes, params.userRole);
        break;

      case "saveCommissionParcel":
        result = saveCommissionParcel(params.commission, params.userRole);
        break;

      case "payoutCommission":
        result = setCommissionPayout(params.commissionIds, params.payoutStatus, params.adminName);
        break;

      default:
        result = { success: false, message: "Unknown action: " + action };
        break;
    }

    return createJsonResponse(result);

  } catch (error) {
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.toString(),
      stack: error.stack
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to return JSON Response with CORS headers
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Test Connection Endpoint
 */
function testConnection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    success: true,
    message: "Connected to Google Sheet successfully!",
    sheetName: ss.getName(),
    sheetId: ss.getId(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Auto-initialize structure of Google Sheet
 */
function initSheetsIfMissing() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Config Sheet
  var configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEETS.CONFIG);
    configSheet.appendRow(["Key", "Value", "Description", "LastUpdated"]);
    formatHeaderRow(configSheet, 4);

    var defaultConfigs = [
      ["company_name", "Life Free Pro", "প্রতিষ্ঠানের নাম", new Date()],
      ["company_tagline", "Revive Your Body, Refresh Your Life", "স্লোগান", new Date()],
      ["office_hours", "সকাল ১০:০০ – রাত ৮:০০", "অফিস সময়সূচি", new Date()],
      ["company_logo", "", "লোগো URL বা Base64", new Date()],
      ["primary_color", "#007A3D", "প্রধান থিম কালার", new Date()],
      ["secondary_color", "#2e7d32", "সেকেন্ডারি কালার", new Date()],
      ["currency", "৳", "মুদ্রার প্রতীক", new Date()],
      ["admin_phone", "01700000000", "অ্যাডমিন ফোন", new Date()],
      ["admin_email", "admin@lifefreepro.com", "অ্যাডমিন ইমেইল", new Date()]
    ];
    for (var i = 0; i < defaultConfigs.length; i++) {
      configSheet.appendRow(defaultConfigs[i]);
    }
  }

  // 2. Users Sheet (Employees & Admin)
  var usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEETS.USERS);
    usersSheet.appendRow([
      "EmployeeID", "Name", "Phone", "Email", "Password", "Role", "Designation", "Status", "JoinedDate", "CreatedAt"
    ]);
    formatHeaderRow(usersSheet, 10);

    // Initial Admin Account placeholder (will be overwritten or updated during setup)
    usersSheet.appendRow([
      "ADM-001",
      "System Admin",
      "01700000000",
      "admin@lifefreepro.com",
      "admin123",
      "admin",
      "Business Owner / Manager",
      "active",
      formatDateStr(new Date()),
      new Date().toISOString()
    ]);
  }

  // 3. Reports Master Sheet
  var masterSheet = ss.getSheetByName(SHEETS.MASTER_REPORTS);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(SHEETS.MASTER_REPORTS);
    masterSheet.appendRow([
      "ReportID", "Date", "Day", "EmployeeID", "EmployeeName",
      "ArrivalTime", "DepartureTime",
      "TotalConfirmedOrders", "WebsiteConfirmedOrders", "PendingCallsOrders", "CancelledOrders",
      "DiscountOrdersCount", "TotalDiscountAmount", "OldCustomerFollowupCount", "RepeatOrdersCount",
      "FbPostsCount", "PackagingPcs", "CommissionSalesPcs", "AdvanceTotalAmount",
      "CourierIssuesFound", "CourierIssuesSolved", "UnrepliedMessages",
      "OvertimeStart", "OvertimeEnd", "OvertimeTotalHours",
      "EmployeeRemarks", "SupervisorRemarks", "Status",
      "RawReportJSON", "SubmittedAt", "LastUpdatedAt"
    ]);
    formatHeaderRow(masterSheet, 31);
  }

  // 4. Attendance Sheet
  var attSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  if (!attSheet) {
    attSheet = ss.insertSheet(SHEETS.ATTENDANCE);
    attSheet.appendRow([
      "Date", "EmployeeID", "EmployeeName", "ArrivalTime", "DepartureTime",
      "Status", "LateMinutes", "OvertimeHours", "Notes", "RecordedAt"
    ]);
    formatHeaderRow(attSheet, 10);
  }

  // 5. Commissions Log (Auto-upgraded to smart 15-column schema)
  ensureCommissionsSheet();

  // 6. Advances Log
  var advSheet = ss.getSheetByName(SHEETS.ADVANCES);
  if (!advSheet) {
    advSheet = ss.insertSheet(SHEETS.ADVANCES);
    advSheet.appendRow([
      "Date", "EmployeeID", "EmployeeName", "Sl", "CustomerPhone", "PaymentAccount", "Amount", "Notes", "LoggedAt"
    ]);
    formatHeaderRow(advSheet, 9);
  }

  // 7. Schedules Log (Custom task schedule per employee)
  var schedSheet = ss.getSheetByName(SHEETS.SCHEDULES);
  if (!schedSheet) {
    schedSheet = ss.insertSheet(SHEETS.SCHEDULES);
    schedSheet.appendRow(["EmployeeID", "ScheduleJSON", "LastUpdated"]);
    formatHeaderRow(schedSheet, 3);
  }
}

/**
 * Format Header Row nicely with styling
 */
function formatHeaderRow(sheet, colCount) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground("#007A3D");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/**
 * Format Date as YYYY-MM-DD (Spreadsheet Timezone Aware)
 */
function formatDateStr(date) {
  if (!date) return "";
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss ? ss.getSpreadsheetTimeZone() : "Asia/Dhaka";
    var d = (date instanceof Date) ? date : new Date(date);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, tz, "yyyy-MM-dd");
    }
  } catch (e) {}

  var d2 = new Date(date);
  var month = '' + (d2.getMonth() + 1);
  var day = '' + d2.getDate();
  var year = d2.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

/**
 * Universal Safe Date Normalizer
 * Handles Date objects, YYYY-MM-DD strings, ISO strings, timestamps
 */
function normalizeDateStr(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return formatDateStr(val);
  }
  var s = String(val).trim();
  var match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    var y = match[1];
    var m = ("0" + match[2]).slice(-2);
    var d = ("0" + match[3]).slice(-2);
    return y + "-" + m + "-" + d;
  }
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return formatDateStr(parsed);
  }
  return s;
}

/**
 * Universal Safe Time Normalizer (Converts Google Sheets Date/1899 epoch to HH:mm)
 */
function formatTimeStr(val) {
  if (!val && val !== 0) return "";
  var ss = null;
  var tz = "Asia/Dhaka";
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) tz = ss.getSpreadsheetTimeZone();
  } catch (e) {}

  if (val instanceof Date) {
    try {
      return Utilities.formatDate(val, tz, "HH:mm");
    } catch (e) {
      var hh = ("0" + val.getHours()).slice(-2);
      var mm = ("0" + val.getMinutes()).slice(-2);
      return hh + ":" + mm;
    }
  }

  var s = String(val).trim();
  if (!s || s === "-") return "";

  // Check if it's an ISO timestamp string (e.g. 1899-12-30T04:06:40.000Z)
  if (s.indexOf("T") !== -1) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      try {
        return Utilities.formatDate(d, tz, "HH:mm");
      } catch (e) {
        var hh2 = ("0" + d.getHours()).slice(-2);
        var mm2 = ("0" + d.getMinutes()).slice(-2);
        return hh2 + ":" + mm2;
      }
    }
  }

  // Check if standard HH:mm or H:mm:ss
  var match = s.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    var h = ("0" + match[1]).slice(-2);
    var m = match[2];
    return h + ":" + m;
  }

  return s;
}

/**
 * User Authentication (Login)
 */
function authenticateUser(identifier, password) {
  if (!identifier || !password) {
    return { success: false, message: "ফোন/ইমেইল এবং পাসওয়ার্ড প্রদান করুন।" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();

  var cleanIdentifier = String(identifier).trim().toLowerCase();
  var cleanPassword = String(password).trim();

  for (var i = 1; i < data.length; i++) {
    var empId = String(data[i][0]).trim();
    var name = String(data[i][1]).trim();
    var phone = String(data[i][2]).trim().toLowerCase();
    var email = String(data[i][3]).trim().toLowerCase();
    var pass = String(data[i][4]).trim();
    var role = String(data[i][5]).trim().toLowerCase();
    var designation = String(data[i][6]).trim();
    var status = String(data[i][7]).trim().toLowerCase();

    if ((phone === cleanIdentifier || email === cleanIdentifier || empId.toLowerCase() === cleanIdentifier || (cleanIdentifier === "admin" && role === "admin")) && pass === cleanPassword) {
      if (status !== "active") {
        return { success: false, message: "আপনার একাউন্টটি নিষ্ক্রিয় (Inactive) রয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।" };
      }

      return {
        success: true,
        message: "লগইন সফল হয়েছে!",
        user: {
          employeeId: empId,
          name: name,
          phone: phone,
          email: email,
          role: role,
          designation: designation,
          status: status
        }
      };
    }
  }

  return { success: false, message: "ভুল ফোন/ইমেইল অথবা পাসওয়ার্ড!" };
}

/**
 * Get Settings
 */
function getSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.CONFIG);
  var data = sheet.getDataRange().getValues();
  var settings = {};

  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];
    if (key) {
      settings[key] = val;
    }
  }

  return { success: true, settings: settings };
}

/**
 * Save Settings
 */
function saveSettings(newSettings) {
  if (!newSettings) return { success: false, message: "কোনো ডাটা প্রদান করা হয়নি।" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.CONFIG);
  var data = sheet.getDataRange().getValues();

  var existingKeys = {};
  for (var i = 1; i < data.length; i++) {
    existingKeys[data[i][0]] = i + 1; // row index (1-based)
  }

  for (var key in newSettings) {
    if (newSettings.hasOwnProperty(key)) {
      var val = newSettings[key];
      if (existingKeys[key]) {
        var row = existingKeys[key];
        sheet.getRange(row, 2).setValue(val);
        sheet.getRange(row, 4).setValue(new Date());
      } else {
        sheet.appendRow([key, val, "Custom Setting", new Date()]);
      }
    }
  }

  return { success: true, message: "সেটিংস সফলভাবে সংরক্ষিত হয়েছে!", settings: newSettings };
}

/**
 * Get All Employees
 */
function getEmployees() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var employees = [];

  for (var i = 1; i < data.length; i++) {
    employees.push({
      employeeId: String(data[i][0]),
      name: String(data[i][1]),
      phone: String(data[i][2]),
      email: String(data[i][3]),
      password: String(data[i][4]), // Visible to admin
      role: String(data[i][5]),
      designation: String(data[i][6]),
      status: String(data[i][7]),
      joinedDate: data[i][8] instanceof Date ? formatDateStr(data[i][8]) : String(data[i][8]),
      createdAt: data[i][9]
    });
  }

  return { success: true, employees: employees };
}

/**
 * Save or Update Employee
 */
function saveEmployee(emp) {
  if (!emp || !emp.name || !emp.phone) {
    return { success: false, message: "সহকর্মীর নাম এবং ফোন নাম্বার আবশ্যক।" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();

  var empId = emp.employeeId;
  if (!empId) {
    // Generate new ID like EMP-101, EMP-102
    empId = "EMP-" + (100 + data.length);
    emp.employeeId = empId;
  }

  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === empId.trim()) {
      foundRow = i + 1;
      break;
    }
  }

  var rowData = [
    emp.employeeId,
    emp.name,
    emp.phone,
    emp.email || "",
    emp.password || "123456",
    emp.role || "employee",
    emp.designation || "Executive",
    emp.status || "active",
    emp.joinedDate || formatDateStr(new Date()),
    foundRow > 0 ? data[foundRow - 1][9] : new Date().toISOString()
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  // Ensure individual employee tab exists
  ensureEmployeePersonalSheet(emp.employeeId, emp.name);

  return { success: true, message: "সহকর্মী তথ্য সফলভাবে সংরক্ষিত হয়েছে!", employee: emp };
}

/**
 * Delete Employee
 */
function deleteEmployee(empId) {
  if (!empId) return { success: false, message: "সহকর্মী আইডি পাওয়া যায়নি।" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === empId.trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "সহকর্মী সফলভাবে মুছে ফেলা হয়েছে!" };
    }
  }

  return { success: false, message: "সহকর্মী পাওয়া যায়নি।" };
}

/**
 * Ensure individual employee dedicated tab in Google Sheet
 */
function ensureEmployeePersonalSheet(empId, empName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cleanId = String(empId || "EMP").trim();
  var cleanName = (empName || "").replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, "");
  var safeName = (cleanId + "_" + cleanName).substring(0, 30);
  var sheet = ss.getSheetByName(safeName);

  if (!sheet) {
    // Also check if sheet exists with prefix match
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sName = sheets[i].getName();
      if (sName.indexOf(cleanId) === 0) {
        sheet = sheets[i];
        break;
      }
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(safeName);
    sheet.appendRow([
      "Date", "Day", "Arrival", "Departure", "ConfirmedOrders", "CancelOrders",
      "DiscountTotal", "Followups", "RepeatOrders", "FbPosts", "PackagingPcs",
      "CommissionPcs", "AdvanceAmount", "CourierFound", "CourierSolved", "UnrepliedMsg",
      "OvertimeHours", "Status", "SubmittedAt", "ReportID"
    ]);
    formatHeaderRow(sheet, 20);
  }

  return sheet;
}

/**
 * Submit Daily Report (With strict in-place update & auto-deduplication)
 */
function submitReport(report) {
  if (!report || !report.employeeId || !report.date) {
    return { success: false, message: "রিপোর্টে সহকর্মী আইডি এবং তারিখ আবশ্যক।" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var normDate = normalizeDateStr(report.date);
  var normEmpId = String(report.employeeId).trim();
  var normEmpName = String(report.employeeName || "").trim();
  var reportId = report.reportId || (normEmpId + "_" + normDate);
  report.reportId = reportId;
  report.date = normDate;

  var cleanArrival = formatTimeStr(report.arrivalTime);
  var cleanDeparture = formatTimeStr(report.departureTime);

  var nowIso = new Date().toISOString();
  var eod = report.endOfDay || {};
  var resp = report.responsibilities || {};

  // 1. Reports Master Sheet: Update in-place & remove any duplicate rows for this date+employee
  var masterSheet = ss.getSheetByName(SHEETS.MASTER_REPORTS);
  if (!masterSheet) {
    initSheetsIfMissing();
    masterSheet = ss.getSheetByName(SHEETS.MASTER_REPORTS);
  }
  var mData = masterSheet.getDataRange().getValues();
  var mMatchingRows = [];

  for (var i = 1; i < mData.length; i++) {
    var rowRepId = String(mData[i][0]).trim();
    var rowDate = normalizeDateStr(mData[i][1]);
    var rowEmp = String(mData[i][3]).trim();
    var rowEmpName = String(mData[i][4]).trim();

    var matchesEmp = (normEmpId && (rowEmp === normEmpId || rowEmpName === normEmpId)) ||
                     (normEmpName && (rowEmp === normEmpName || rowEmpName === normEmpName));

    if (rowRepId === reportId || (rowDate === normDate && matchesEmp)) {
      mMatchingRows.push(i + 1);
    }
  }

  // Sort matching rows descending
  mMatchingRows.sort(function(a, b) { return b - a; });

  var mTargetRow = -1;
  if (mMatchingRows.length > 0) {
    mTargetRow = mMatchingRows[mMatchingRows.length - 1]; // Smallest row index (topmost)
    // Delete any older duplicate rows from highest to lowest index
    for (var md = 0; md < mMatchingRows.length - 1; md++) {
      masterSheet.deleteRow(mMatchingRows[md]);
    }
  }

  var rowData = [
    reportId,
    normDate,
    report.day || "",
    normEmpId,
    report.employeeName,
    cleanArrival ? "'" + cleanArrival : "",
    cleanDeparture ? "'" + cleanDeparture : "",
    Number(eod.totalConfirmedOrders || 0),
    Number(eod.websiteConfirmedOrders || 0),
    Number(eod.pendingCallsOrders || 0),
    Number(eod.cancelledOrders || 0),
    Number(eod.discountOrdersCount || 0),
    Number(eod.totalDiscountAmount || 0),
    Number(eod.oldCustomerFollowupCount || 0),
    Number(eod.repeatOrdersCount || 0),
    Number(eod.fbPostsCount || 0),
    Number(eod.packagingPcs || 0),
    Number(eod.commissionSalesPcs || 0),
    Number(eod.advanceTotalAmount || 0),
    Number(resp.courierIssuesFound || 0),
    Number(resp.courierIssuesSolved || 0),
    Number(resp.unrepliedMessages || 0),
    eod.overtimeStart || "",
    eod.overtimeEnd || "",
    Number(eod.overtimeTotalHours || 0),
    eod.employeeRemarks || "",
    eod.supervisorRemarks || "",
    report.status || "Submitted",
    JSON.stringify(report),
    mTargetRow > 0 ? (mData[mTargetRow - 1] ? mData[mTargetRow - 1][29] : nowIso) : nowIso,
    nowIso
  ];

  if (mTargetRow > 0) {
    masterSheet.getRange(mTargetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    masterSheet.appendRow(rowData);
  }

  // 2. Employee's Dedicated Personal Tab: Update in-place & delete all duplicate rows for this date!
  var personalSheet = ensureEmployeePersonalSheet(normEmpId, report.employeeName);
  var pData = personalSheet.getDataRange().getValues();
  var pMatchingRows = [];

  for (var j = 1; j < pData.length; j++) {
    var pDate = normalizeDateStr(pData[j][0]);
    var pRepId = String(pData[j][19] || "").trim();
    if (pDate === normDate || pRepId === reportId) {
      pMatchingRows.push(j + 1);
    }
  }

  pMatchingRows.sort(function(a, b) { return b - a; });

  var pTargetRow = -1;
  if (pMatchingRows.length > 0) {
    pTargetRow = pMatchingRows[pMatchingRows.length - 1]; // Smallest row index (topmost)
    // Delete any older duplicate rows in this personal sheet for this date!
    for (var pd = 0; pd < pMatchingRows.length - 1; pd++) {
      personalSheet.deleteRow(pMatchingRows[pd]);
    }
  }

  var pRowData = [
    normDate,
    report.day || "",
    cleanArrival ? "'" + cleanArrival : "",
    cleanDeparture ? "'" + cleanDeparture : "",
    Number(eod.totalConfirmedOrders || 0),
    Number(eod.cancelledOrders || 0),
    Number(eod.totalDiscountAmount || 0),
    Number(eod.oldCustomerFollowupCount || 0),
    Number(eod.repeatOrdersCount || 0),
    Number(eod.fbPostsCount || 0),
    Number(eod.packagingPcs || 0),
    Number(eod.commissionSalesPcs || 0),
    Number(eod.advanceTotalAmount || 0),
    Number(resp.courierIssuesFound || 0),
    Number(resp.courierIssuesSolved || 0),
    Number(resp.unrepliedMessages || 0),
    Number(eod.overtimeTotalHours || 0),
    report.status || "Submitted",
    nowIso,
    reportId
  ];

  if (pTargetRow > 0) {
    personalSheet.getRange(pTargetRow, 1, 1, pRowData.length).setValues([pRowData]);
  } else {
    personalSheet.appendRow(pRowData);
  }

  // 3. Record Attendance (only when final submitted, never duplicates)
  if (report.status !== "Draft") {
    recordAttendance(report);
  }

  // 4. Record Commission Items (always clears old rows for date+empId, never duplicates)
  recordCommissions(normDate, normEmpId, report.employeeName, report.commissions || []);

  // 5. Record Advance Items (always clears old rows for date+empId, never duplicates)
  recordAdvances(normDate, normEmpId, report.employeeName, report.advances || []);

  return {
    success: true,
    message: report.status === "Draft" ? "ড্রাফট সংরক্ষিত হয়েছে!" : "দৈনিক রিপোর্ট সফলভাবে সাবমিট করা হয়েছে!",
    reportId: reportId
  };
}

/**
 * Record Attendance entry (In-place update & delete duplicates)
 */
function recordAttendance(report) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var normDate = normalizeDateStr(report.date);
  var normEmpId = String(report.employeeId || "").trim();
  var normEmpName = String(report.employeeName || "").trim();
  var cleanArrival = formatTimeStr(report.arrivalTime);
  var cleanDeparture = formatTimeStr(report.departureTime);

  var matchingRows = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = normalizeDateStr(data[i][0]);
    var rowEmpId = String(data[i][1] || "").trim();
    var rowEmpName = String(data[i][2] || "").trim();

    var matchesEmp = false;
    if (normEmpId && (rowEmpId === normEmpId || rowEmpName === normEmpId)) matchesEmp = true;
    if (normEmpName && (rowEmpName === normEmpName || rowEmpId === normEmpName)) matchesEmp = true;

    if (rowDate === normDate && matchesEmp) {
      matchingRows.push(i + 1);
    }
  }

  // Sort matching rows descending
  matchingRows.sort(function(a, b) { return b - a; });

  var targetRow = -1;
  if (matchingRows.length > 0) {
    targetRow = matchingRows[matchingRows.length - 1]; // Smallest row index (topmost)
    for (var d = 0; d < matchingRows.length - 1; d++) {
      sheet.deleteRow(matchingRows[d]);
    }
  }

  // Determine late arrival (default official arrival is 10:00 AM)
  var lateMin = 0;
  if (cleanArrival) {
    var parts = cleanArrival.split(":");
    if (parts.length >= 2) {
      var arrHour = parseInt(parts[0], 10);
      var arrMin = parseInt(parts[1], 10);
      var totalArrivalMinutes = arrHour * 60 + arrMin;
      var standardMinutes = 10 * 60; // 10:00 AM
      if (totalArrivalMinutes > standardMinutes) {
        lateMin = totalArrivalMinutes - standardMinutes;
      }
    }
  }

  var otHours = (report.endOfDay && report.endOfDay.overtimeTotalHours) ? Number(report.endOfDay.overtimeTotalHours) : 0;
  var status = lateMin > 15 ? "Late" : "Present";

  var rowData = [
    normDate,
    normEmpId,
    normEmpName,
    cleanArrival ? "'" + cleanArrival : "",
    cleanDeparture ? "'" + cleanDeparture : "",
    status,
    lateMin,
    otHours,
    report.endOfDay && report.endOfDay.employeeRemarks ? report.endOfDay.employeeRemarks : "",
    new Date().toISOString()
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/**
 * Ensure Commissions Sheet with Modern 15-Column Schema
 * Auto-migrates older 9-column sheet smoothly without data loss.
 */
function ensureCommissionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.COMMISSIONS);
  var newHeaders = [
    "CommissionID", "Date", "EmployeeID", "EmployeeName", "Sl", "CustomerPhone",
    "ProductDetails", "Pieces", "CommissionAmount", "DeliveryStatus", "PartialAmount",
    "PayoutStatus", "PayoutDate", "Notes", "UpdatedAt"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.COMMISSIONS);
    sheet.appendRow(newHeaders);
    formatHeaderRow(sheet, newHeaders.length);
    return sheet;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length > 0 && String(data[0][0]).trim() !== "CommissionID") {
    // Migrate old 9-column sheet
    var upgraded = [newHeaders];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var rDate = normalizeDateStr(row[0]);
      var rEmpId = String(row[1] || "").trim();
      var rEmpName = String(row[2] || "").trim();
      var rSl = row[3] || r;
      var rPhone = String(row[4] || "").trim();
      var rPcs = Number(row[5] || 0);
      var rSource = String(row[6] || "").trim();
      var rNotes = String(row[7] || "").trim();
      var rLoggedAt = row[8] ? new Date(row[8]).toISOString() : new Date().toISOString();
      var commId = "COM_" + (rEmpId || "EMP") + "_" + rDate.replace(/-/g, "") + "_" + rSl;

      upgraded.push([
        commId, rDate, rEmpId, rEmpName, rSl, rPhone,
        rSource || "আপসেল পণ্য", rPcs, 0, "Processing", 0,
        "Unpaid", "", rNotes, rLoggedAt
      ]);
    }

    sheet.clear();
    sheet.getRange(1, 1, upgraded.length, newHeaders.length).setValues(upgraded);
    formatHeaderRow(sheet, newHeaders.length);
  }

  return sheet;
}

/**
 * Record Commissions from Daily Report (Preserves existing delivery and payout status!)
 */
function recordCommissions(date, empId, empName, commissions) {
  var sheet = ensureCommissionsSheet();
  if (!sheet) return;
  var now = new Date().toISOString();
  var normDate = normalizeDateStr(date);
  var normEmpId = String(empId || "").trim();
  var normEmpName = String(empName || "").trim();

  var data = sheet.getDataRange().getValues();
  var existingMap = {}; // Key: sl or phone

  for (var i = 1; i < data.length; i++) {
    var rDate = normalizeDateStr(data[i][1]);
    var rEmpId = String(data[i][2] || "").trim();
    var rEmpName = String(data[i][3] || "").trim();
    var rSl = String(data[i][4] || "").trim();
    var rPhone = String(data[i][5] || "").trim();

    var matchesEmp = (normEmpId && (rEmpId === normEmpId || rEmpName === normEmpId)) ||
                     (normEmpName && (rEmpName === normEmpName || rEmpId === normEmpName));

    if (rDate === normDate && matchesEmp) {
      existingMap[rSl] = { rowIndex: i + 1, rowData: data[i] };
      if (rPhone) existingMap[rPhone] = { rowIndex: i + 1, rowData: data[i] };
    }
  }

  if (!commissions || !Array.isArray(commissions)) return;

  for (var k = 0; k < commissions.length; k++) {
    var c = commissions[k];
    var sl = String(c.sl || (k + 1)).trim();
    var phone = String(c.phone || "").trim();
    var pcs = Number(c.pieces || 0);
    var product = String(c.source || c.product || "").trim();
    var note = String(c.note || "").trim();
    var commAmount = Number(c.commissionAmount || 0);

    if (!phone && pcs === 0) continue;

    var existing = existingMap[sl] || (phone ? existingMap[phone] : null);

    if (existing) {
      // In-place update preserving DeliveryStatus, PartialAmount, PayoutStatus, PayoutDate!
      var rRow = existing.rowIndex;
      var orig = existing.rowData;
      var preservedCommId = orig[0] || ("COM_" + normEmpId + "_" + normDate.replace(/-/g, "") + "_" + sl);
      var preservedDelivery = orig[9] || "Processing";
      var preservedPartial = Number(orig[10] || 0);
      var preservedPayout = orig[11] || "Unpaid";
      var preservedPayoutDate = orig[12] || "";

      var updatedRow = [
        preservedCommId,
        normDate,
        normEmpId,
        normEmpName,
        sl,
        phone,
        product || orig[6] || "আপসেল পণ্য",
        pcs,
        commAmount || orig[8] || 0,
        preservedDelivery,
        preservedPartial,
        preservedPayout,
        preservedPayoutDate,
        note || orig[13] || "",
        now
      ];
      sheet.getRange(rRow, 1, 1, updatedRow.length).setValues([updatedRow]);
    } else {
      // Append new commission item
      var newCommId = "COM_" + normEmpId + "_" + normDate.replace(/-/g, "") + "_" + sl + "_" + Utilities.formatDate(new Date(), "GMT+6", "mmss");
      var newRow = [
        newCommId,
        normDate,
        normEmpId,
        normEmpName,
        sl,
        phone,
        product || "আপসেল পণ্য",
        pcs,
        commAmount,
        "Processing",
        0,
        "Unpaid",
        "",
        note,
        now
      ];
      sheet.appendRow(newRow);
    }
  }
}

/**
 * Get Commissions List with Advanced Filters & Full Analytics
 */
function getCommissionsList(filters) {
  filters = filters || {};
  var sheet = ensureCommissionsSheet();
  if (!sheet) return { success: true, items: [], stats: {} };
  var data = sheet.getDataRange().getValues();

  var items = [];
  var stats = {
    totalParcels: 0,
    processingCount: 0,
    deliveredCount: 0,
    partialCount: 0,
    cancelledCount: 0,
    totalPieces: 0,
    totalCommission: 0,
    paidCommission: 0,
    unpaidCommission: 0,
    totalPartialAmount: 0
  };

  var filterEmp = String(filters.employeeId || "").trim();
  var filterMonth = String(filters.month || "").trim();
  var filterStatus = String(filters.deliveryStatus || "").trim();
  var filterPayout = String(filters.payoutStatus || "").trim();
  var filterSearch = String(filters.search || "").trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var commId = String(data[i][0] || "").trim();
    var dateStr = normalizeDateStr(data[i][1]);
    var empId = String(data[i][2] || "").trim();
    var empName = String(data[i][3] || "").trim();
    var sl = data[i][4] || i;
    var phone = String(data[i][5] || "").trim();
    var product = String(data[i][6] || "").trim();
    var pieces = Number(data[i][7] || 0);
    var commAmount = Number(data[i][8] || 0);
    var deliveryStatus = String(data[i][9] || "Processing").trim();
    var partialAmount = Number(data[i][10] || 0);
    var payoutStatus = String(data[i][11] || "Unpaid").trim();
    var payoutDate = data[i][12] ? (data[i][12] instanceof Date ? Utilities.formatDate(data[i][12], "Asia/Dhaka", "yyyy-MM-dd HH:mm") : String(data[i][12])) : "";
    var notes = String(data[i][13] || "").trim();
    var updatedAt = data[i][14] || "";

    if (!commId && !phone && pieces === 0) continue;

    // Filter checks
    if (filterEmp && filterEmp !== "all" && empId !== filterEmp && empName !== filterEmp) {
      continue;
    }
    if (filterMonth && !dateStr.startsWith(filterMonth)) {
      continue;
    }
    if (filterStatus && filterStatus !== "all" && deliveryStatus.toLowerCase() !== filterStatus.toLowerCase()) {
      continue;
    }
    if (filterPayout && filterPayout !== "all" && payoutStatus.toLowerCase() !== filterPayout.toLowerCase()) {
      continue;
    }
    if (filterSearch) {
      var searchCorpus = (phone + " " + product + " " + empName + " " + empId + " " + notes).toLowerCase();
      if (searchCorpus.indexOf(filterSearch) === -1) {
        continue;
      }
    }

    // Accumulate Stats
    stats.totalParcels++;
    stats.totalPieces += pieces;
    stats.totalCommission += commAmount;
    stats.totalPartialAmount += partialAmount;

    if (deliveryStatus === "Delivered") stats.deliveredCount++;
    else if (deliveryStatus === "Partial") stats.partialCount++;
    else if (deliveryStatus === "Cancelled") stats.cancelledCount++;
    else stats.processingCount++;

    if (payoutStatus === "Paid") {
      stats.paidCommission += commAmount;
    } else {
      stats.unpaidCommission += commAmount;
    }

    items.push({
      commissionId: commId || ("COM_" + empId + "_" + dateStr + "_" + sl),
      date: dateStr,
      employeeId: empId,
      employeeName: empName,
      sl: sl,
      customerPhone: phone,
      productDetails: product,
      pieces: pieces,
      commissionAmount: commAmount,
      deliveryStatus: deliveryStatus,
      partialAmount: partialAmount,
      payoutStatus: payoutStatus,
      payoutDate: payoutDate,
      notes: notes,
      updatedAt: updatedAt
    });
  }

  // Sort by date descending
  items.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  return {
    success: true,
    items: items,
    stats: stats
  };
}

/**
 * Update Commission Parcel Status (Employee & Admin)
 * Rule: If payoutStatus is 'Paid', an employee CANNOT modify it!
 */
function updateCommissionStatus(commissionId, deliveryStatus, partialAmount, notes, userRole) {
  if (!commissionId) {
    return { success: false, message: "পার্সেল আইডি পাওয়া যায়নি।" };
  }

  var sheet = ensureCommissionsSheet();
  if (!sheet) return { success: false, message: "Commissions sheet not found" };
  var data = sheet.getDataRange().getValues();
  var targetRow = -1;
  var currentRowData = null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(commissionId).trim()) {
      targetRow = i + 1;
      currentRowData = data[i];
      break;
    }
  }

  if (targetRow <= 0) {
    return { success: false, message: "পার্সেল রেকর্ডটি খুঁজে পাওয়া যায়নি।" };
  }

  var currentPayoutStatus = String(currentRowData[11] || "Unpaid").trim();

  // Strict Security: Employees cannot edit parcels that have been paid!
  if (userRole !== "admin" && currentPayoutStatus === "Paid") {
    return {
      success: false,
      message: "⚠️ এই পার্সেলের কমিশন অ্যাডমিন কর্তৃক ইতিমধ্যে পরিশোধ করা হয়েছে। এটি আর এডিট বা পরিবর্তন করা যাবে না।"
    };
  }

  var validStatuses = ["Processing", "Delivered", "Cancelled", "Partial"];
  var cleanStatus = deliveryStatus || currentRowData[9] || "Processing";
  if (validStatuses.indexOf(cleanStatus) === -1) {
    cleanStatus = "Processing";
  }

  var cleanPartial = Number(partialAmount || 0);
  var cleanNotes = notes !== undefined ? String(notes).trim() : String(currentRowData[13] || "");
  var now = new Date().toISOString();

  sheet.getRange(targetRow, 10).setValue(cleanStatus);
  sheet.getRange(targetRow, 11).setValue(cleanPartial);
  sheet.getRange(targetRow, 14).setValue(cleanNotes);
  sheet.getRange(targetRow, 15).setValue(now);

  return {
    success: true,
    message: "পার্সেল ডেলিভারি স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে!",
    updated: {
      commissionId: commissionId,
      deliveryStatus: cleanStatus,
      partialAmount: cleanPartial,
      notes: cleanNotes
    }
  };
}

/**
 * Save Single Commission Parcel (Add or Edit)
 */
function saveCommissionParcel(parcel, userRole) {
  if (!parcel || !parcel.customerPhone) {
    return { success: false, message: "কাস্টমারের ফোন নাম্বার আবশ্যক।" };
  }

  var sheet = ensureCommissionsSheet();
  if (!sheet) return { success: false, message: "Commissions sheet not found" };
  var data = sheet.getDataRange().getValues();

  var commId = String(parcel.commissionId || "").trim();
  var dateStr = normalizeDateStr(parcel.date || new Date());
  var empId = String(parcel.employeeId || "").trim();
  var empName = String(parcel.employeeName || "").trim();
  var phone = String(parcel.customerPhone || "").trim();
  var product = String(parcel.productDetails || "আপসেল পণ্য").trim();
  var pieces = Number(parcel.pieces || 1);
  var commAmount = Number(parcel.commissionAmount || 0);
  var deliveryStatus = String(parcel.deliveryStatus || "Processing").trim();
  var partialAmount = Number(parcel.partialAmount || 0);
  var notes = String(parcel.notes || "").trim();
  var now = new Date().toISOString();

  var targetRow = -1;
  if (commId) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === commId) {
        targetRow = i + 1;
        // Check if employee trying to edit paid parcel
        if (userRole !== "admin" && String(data[i][11] || "").trim() === "Paid") {
          return {
            success: false,
            message: "⚠️ এই পার্সেলের কমিশন পরিশোধ করা হয়েছে। এটি আর এডিট করা যাবে না।"
          };
        }
        break;
      }
    }
  }

  if (targetRow > 0) {
    // In-place update
    var existingPayout = data[targetRow - 1][11] || "Unpaid";
    var existingPayoutDate = data[targetRow - 1][12] || "";
    var updatedRow = [
      commId, dateStr, empId, empName, data[targetRow - 1][4] || 1, phone,
      product, pieces, commAmount, deliveryStatus, partialAmount,
      existingPayout, existingPayoutDate, notes, now
    ];
    sheet.getRange(targetRow, 1, 1, updatedRow.length).setValues([updatedRow]);
  } else {
    // New parcel
    var sl = data.length;
    var newId = "COM_" + empId + "_" + dateStr.replace(/-/g, "") + "_" + Utilities.formatDate(new Date(), "GMT+6", "mmssSSS");
    var rowData = [
      newId, dateStr, empId, empName, sl, phone,
      product, pieces, commAmount, deliveryStatus, partialAmount,
      "Unpaid", "", notes, now
    ];
    sheet.appendRow(rowData);
    commId = newId;
  }

  return {
    success: true,
    message: "আপসেল পার্সেল সফলভাবে সংরক্ষিত হয়েছে!",
    commissionId: commId
  };
}

/**
 * Set Commission Payout Status (Admin Only)
 * Marks parcels as 'Paid' (with payout date) or 'Unpaid'.
 */
function setCommissionPayout(commissionIds, payoutStatus, adminName) {
  if (!commissionIds) {
    return { success: false, message: "কোনো পার্সেল আইডি পাওয়া যায়নি।" };
  }

  var idList = Array.isArray(commissionIds) ? commissionIds : [commissionIds];
  var idSet = {};
  for (var k = 0; k < idList.length; k++) {
    idSet[String(idList[k]).trim()] = true;
  }

  var sheet = ensureCommissionsSheet();
  if (!sheet) return { success: false, message: "Commissions sheet not found" };
  var data = sheet.getDataRange().getValues();
  var updatedCount = 0;
  var nowStr = Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd HH:mm");
  var targetPayout = (payoutStatus === "Paid") ? "Paid" : "Unpaid";

  for (var i = 1; i < data.length; i++) {
    var cId = String(data[i][0]).trim();
    if (idSet[cId]) {
      var row = i + 1;
      sheet.getRange(row, 12).setValue(targetPayout); // Col 12: PayoutStatus
      sheet.getRange(row, 13).setValue(targetPayout === "Paid" ? nowStr : ""); // Col 13: PayoutDate
      sheet.getRange(row, 15).setValue(new Date().toISOString()); // Col 15: UpdatedAt
      updatedCount++;
    }
  }

  return {
    success: true,
    updatedCount: updatedCount,
    message: targetPayout === "Paid"
      ? (updatedCount + " টি পার্সেলের কমিশন সফলভাবে পরিশোধিত (Paid) হিসেবে চিহ্নিত করা হয়েছে!")
      : (updatedCount + " টি পার্সেল বকেয়া (Unpaid) হিসেবে চিহ্নিত করা হয়েছে!")
  };
}

/**
 * Record Advances (Clean delete-before-reinsert to prevent duplicates)
 */
function recordAdvances(date, empId, empName, advances) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ADVANCES);
  if (!sheet) return;
  var now = new Date().toISOString();
  var normDate = normalizeDateStr(date);
  var normEmpId = String(empId || "").trim();
  var normEmpName = String(empName || "").trim();

  // Clear existing items for this date & employee to prevent duplicates on update
  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = normalizeDateStr(data[i][0]);
    var rowEmpId = String(data[i][1] || "").trim();
    var rowEmpName = String(data[i][2] || "").trim();
    var matchesEmp = (normEmpId && (rowEmpId === normEmpId || rowEmpName === normEmpId)) ||
                     (normEmpName && (rowEmpName === normEmpName || rowEmpId === normEmpName));
    if (rowDate === normDate && matchesEmp) {
      rowsToDelete.push(i + 1);
    }
  }

  // Delete from bottom to top so indices do not shift
  rowsToDelete.sort(function(a, b) { return b - a; });
  for (var d = 0; d < rowsToDelete.length; d++) {
    sheet.deleteRow(rowsToDelete[d]);
  }

  if (!advances || !Array.isArray(advances)) return;

  for (var k = 0; k < advances.length; k++) {
    var a = advances[k];
    if (a.phone || a.amount) {
      sheet.appendRow([
        normDate, normEmpId, normEmpName, a.sl || (k + 1), a.phone || "", a.paymentAccount || "", Number(a.amount || 0), a.note || "", now
      ]);
    }
  }
}

/**
 * Get Specific Report
 */
function getReport(empId, date) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MASTER_REPORTS);
  if (!sheet) return { success: true, found: false, message: "Reports_Master sheet not found" };
  var data = sheet.getDataRange().getValues();
  var targetDate = normalizeDateStr(date);
  var targetEmpId = String(empId || "").trim();

  // Search backwards to get the latest record if duplicates exist
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = normalizeDateStr(data[i][1]);
    var rowEmpId = String(data[i][3] || "").trim();
    var rowEmpName = String(data[i][4] || "").trim();

    var matchesEmp = (targetEmpId && (rowEmpId === targetEmpId || rowEmpName === targetEmpId));

    if (rowDate === targetDate && matchesEmp) {
      var rawJson = data[i][28];
      var reportObj = null;
      try {
        reportObj = JSON.parse(rawJson);
      } catch (err) {
        reportObj = null;
      }

      var cleanArr = formatTimeStr(data[i][5]);
      var cleanDep = formatTimeStr(data[i][6]);

      return {
        success: true,
        found: true,
        report: reportObj,
        summary: {
          reportId: data[i][0],
          date: rowDate,
          day: data[i][2],
          employeeId: rowEmpId,
          employeeName: rowEmpName,
          arrivalTime: cleanArr,
          departureTime: cleanDep,
          totalConfirmedOrders: data[i][7],
          status: data[i][27]
        }
      };
    }
  }

  return { success: true, found: false, message: "এই তারিখে কোনো রিপোর্ট পাওয়া যায়নি।" };
}

/**
 * Get All Reports (For Admin Dashboard & History - Strictly Deduplicated)
 */
function getAllReports(filters) {
  filters = filters || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MASTER_REPORTS);
  if (!sheet) return { success: true, reports: [] };
  var data = sheet.getDataRange().getValues();

  var reportMap = {};
  var orderKeys = [];

  for (var i = 1; i < data.length; i++) {
    var rowDate = normalizeDateStr(data[i][1]);
    var rowEmpId = String(data[i][3] || "").trim();
    var rowEmpName = String(data[i][4] || "").trim();

    if (!rowDate) continue;

    // Check filters
    if (filters.employeeId && filters.employeeId !== "all" && rowEmpId !== filters.employeeId && rowEmpName !== filters.employeeId) {
      continue;
    }
    if (filters.startDate && rowDate < filters.startDate) {
      continue;
    }
    if (filters.endDate && rowDate > filters.endDate) {
      continue;
    }

    var rawJson = data[i][28];
    var reportObj = null;
    try {
      reportObj = JSON.parse(rawJson);
    } catch (e) {
      reportObj = null;
    }

    var cleanArr = formatTimeStr(data[i][5]);
    var cleanDep = formatTimeStr(data[i][6]);

    var repItem = {
      reportId: data[i][0],
      date: rowDate,
      day: data[i][2],
      employeeId: rowEmpId,
      employeeName: rowEmpName,
      arrivalTime: cleanArr,
      departureTime: cleanDep,
      totalConfirmedOrders: Number(data[i][7] || 0),
      websiteConfirmedOrders: Number(data[i][8] || 0),
      pendingCallsOrders: Number(data[i][9] || 0),
      cancelledOrders: Number(data[i][10] || 0),
      discountOrdersCount: Number(data[i][11] || 0),
      totalDiscountAmount: Number(data[i][12] || 0),
      oldCustomerFollowupCount: Number(data[i][13] || 0),
      repeatOrdersCount: Number(data[i][14] || 0),
      fbPostsCount: Number(data[i][15] || 0),
      packagingPcs: Number(data[i][16] || 0),
      commissionSalesPcs: Number(data[i][17] || 0),
      advanceTotalAmount: Number(data[i][18] || 0),
      courierIssuesFound: Number(data[i][19] || 0),
      courierIssuesSolved: Number(data[i][20] || 0),
      unrepliedMessages: Number(data[i][21] || 0),
      overtimeHours: Number(data[i][24] || 0),
      status: data[i][27] || "Submitted",
      details: reportObj,
      submittedAt: data[i][29],
      lastUpdatedAt: data[i][30]
    };

    var dedupeKey = rowDate + "_" + (rowEmpId || rowEmpName);
    if (!reportMap[dedupeKey]) {
      orderKeys.push(dedupeKey);
    }
    // Keep latest row
    reportMap[dedupeKey] = repItem;
  }

  var reports = [];
  for (var k = 0; k < orderKeys.length; k++) {
    reports.push(reportMap[orderKeys[k]]);
  }

  // Sort by date descending
  reports.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  return { success: true, reports: reports };
}

/**
 * Update Report (Admin Action)
 */
function updateReport(report) {
  // Re-submit with update
  return submitReport(report);
}

/**
 * Get Attendance (Clean formatted times & Strictly Deduplicated)
 */
function getAttendance(month, empId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  if (!sheet) return { success: true, records: [] };
  var data = sheet.getDataRange().getValues();

  var recordsMap = {};
  var orderKeys = [];

  for (var i = 1; i < data.length; i++) {
    var dateStr = normalizeDateStr(data[i][0]);
    var rowEmpId = String(data[i][1] || "").trim();
    var rowEmpName = String(data[i][2] || "").trim();

    if (!dateStr) continue;
    if (month && !dateStr.startsWith(month)) {
      continue;
    }
    if (empId && empId !== "all" && rowEmpId !== empId && rowEmpName !== empId) {
      continue;
    }

    var cleanArrival = formatTimeStr(data[i][3]);
    var cleanDeparture = formatTimeStr(data[i][4]);

    var recordObj = {
      date: dateStr,
      employeeId: rowEmpId,
      employeeName: rowEmpName,
      arrivalTime: cleanArrival,
      departureTime: cleanDeparture,
      status: data[i][5] || "Present",
      lateMinutes: Number(data[i][6] || 0),
      overtimeHours: Number(data[i][7] || 0),
      notes: data[i][8] || "",
      recordedAt: data[i][9] || ""
    };

    var dedupeKey = dateStr + "_" + (rowEmpId || rowEmpName);
    if (!recordsMap[dedupeKey]) {
      orderKeys.push(dedupeKey);
    }
    // Always keep latest row
    recordsMap[dedupeKey] = recordObj;
  }

  var records = [];
  for (var k = 0; k < orderKeys.length; k++) {
    records.push(recordsMap[orderKeys[k]]);
  }

  // Sort descending by date
  records.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  return { success: true, records: records };
}

/**
 * Get Dashboard Stats & Averages for Admin (Deduplication Safeguarded)
 */
function getDashboardStats(date) {
  date = normalizeDateStr(date || new Date());
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MASTER_REPORTS);
  if (!sheet) return { success: true, today: {}, averages: {} };
  var data = sheet.getDataRange().getValues();

  var todayStats = {
    totalReports: 0,
    totalConfirmedOrders: 0,
    totalWebsiteOrders: 0,
    totalPendingCalls: 0,
    totalCancelledOrders: 0,
    totalDiscountAmount: 0,
    totalFollowups: 0,
    totalRepeatOrders: 0,
    totalPackaging: 0,
    totalCommissionPcs: 0,
    totalAdvanceAmount: 0,
    totalOvertimeHours: 0
  };

  var overallStats = {
    totalReports: 0,
    totalConfirmedOrders: 0,
    totalCancelledOrders: 0,
    totalPackaging: 0,
    totalCommissionPcs: 0,
    totalAdvanceAmount: 0
  };

  // Keep only the latest row per (date + emp) to prevent double counting
  var uniqueRows = {};
  for (var i = 1; i < data.length; i++) {
    var rDate = normalizeDateStr(data[i][1]);
    var rEmp = String(data[i][3] || data[i][4] || "").trim();
    if (!rDate || !rEmp) continue;
    uniqueRows[rDate + "_" + rEmp] = data[i];
  }

  for (var key in uniqueRows) {
    var row = uniqueRows[key];
    var rowDate = normalizeDateStr(row[1]);

    var conf = Number(row[7] || 0);
    var web = Number(row[8] || 0);
    var pend = Number(row[9] || 0);
    var canc = Number(row[10] || 0);
    var disc = Number(row[12] || 0);
    var fup = Number(row[13] || 0);
    var rep = Number(row[14] || 0);
    var pack = Number(row[16] || 0);
    var comm = Number(row[17] || 0);
    var adv = Number(row[18] || 0);
    var ot = Number(row[24] || 0);

    overallStats.totalReports++;
    overallStats.totalConfirmedOrders += conf;
    overallStats.totalCancelledOrders += canc;
    overallStats.totalPackaging += pack;
    overallStats.totalCommissionPcs += comm;
    overallStats.totalAdvanceAmount += adv;

    if (rowDate === date) {
      todayStats.totalReports++;
      todayStats.totalConfirmedOrders += conf;
      todayStats.totalWebsiteOrders += web;
      todayStats.totalPendingCalls += pend;
      todayStats.totalCancelledOrders += canc;
      todayStats.totalDiscountAmount += disc;
      todayStats.totalFollowups += fup;
      todayStats.totalRepeatOrders += rep;
      todayStats.totalPackaging += pack;
      todayStats.totalCommissionPcs += comm;
      todayStats.totalAdvanceAmount += adv;
      todayStats.totalOvertimeHours += ot;
    }
  }

  // Calculate Averages and conversion ratios
  var avgOrdersPerReport = overallStats.totalReports > 0 ? (overallStats.totalConfirmedOrders / overallStats.totalReports).toFixed(1) : 0;
  var cancellationRatio = (overallStats.totalConfirmedOrders + overallStats.totalCancelledOrders) > 0
    ? ((overallStats.totalCancelledOrders / (overallStats.totalConfirmedOrders + overallStats.totalCancelledOrders)) * 100).toFixed(1)
    : 0;

  return {
    success: true,
    date: date,
    today: todayStats,
    overall: overallStats,
    averages: {
      avgOrdersPerReport: avgOrdersPerReport,
      cancellationRatioPercent: cancellationRatio
    }
  };
}

/**
 * Get Custom Work Schedule for an Employee
 */
function getEmployeeSchedule(employeeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SCHEDULES);
  if (!sheet) return { success: true, found: false, schedule: null };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(employeeId).trim()) {
      try {
        var sched = JSON.parse(data[i][1]);
        return { success: true, found: true, schedule: sched };
      } catch (e) {
        return { success: true, found: false, schedule: null };
      }
    }
  }

  return { success: true, found: false, schedule: null };
}

/**
 * Save Custom Work Schedule for an Employee
 */
function saveEmployeeSchedule(employeeId, schedule) {
  if (!employeeId || !schedule) {
    return { success: false, message: "সহকর্মী আইডি এবং কাজের তালিকা আবশ্যক।" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SCHEDULES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.SCHEDULES);
    sheet.appendRow(["EmployeeID", "ScheduleJSON", "LastUpdated"]);
    formatHeaderRow(sheet, 3);
  }

  var data = sheet.getDataRange().getValues();
  var foundRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(employeeId).trim()) {
      foundRow = i + 1;
      break;
    }
  }

  var jsonStr = typeof schedule === 'string' ? schedule : JSON.stringify(schedule);
  var now = new Date().toISOString();

  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(jsonStr);
    sheet.getRange(foundRow, 3).setValue(now);
  } else {
    sheet.appendRow([employeeId, jsonStr, now]);
  }

  return { success: true, message: "কাজের সময়সূচি সফলভাবে সংরক্ষিত হয়েছে!" };
}

/**
 * Upload Business Logo to Google Drive and Save to Config
 */
function uploadLogoToDrive(fileData, fileName) {
  if (!fileData) {
    return { success: false, message: "ফাইল ডাটা পাওয়া যায়নি।" };
  }

  try {
    var contentType = "image/png";
    var base64Data = "";

    if (fileData.indexOf("data:") === 0) {
      var parts = fileData.split(",");
      var meta = parts[0];
      base64Data = parts[1];
      contentType = meta.split(";")[0].replace("data:", "");
    } else {
      base64Data = fileData;
    }

    var decodedBytes = Utilities.base64Decode(base64Data);
    var cleanName = (fileName || "business_logo.png").replace(/[^a-zA-Z0-9._-]/g, "_");
    var blob = Utilities.newBlob(decodedBytes, contentType, cleanName);

    // Save in or create Assets folder in Google Drive
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var parentFolders = DriveApp.getFileById(ss.getId()).getParents();
    var rootFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();

    var subFolders = rootFolder.getFoldersByName("LFP_Branding_Assets");
    var assetFolder = subFolders.hasNext() ? subFolders.next() : rootFolder.createFolder("LFP_Branding_Assets");

    var file = assetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Direct Google CDN image URL
    var directUrl = "https://lh3.googleusercontent.com/d/" + file.getId();

    // Auto-save to Config sheet
    saveSettings({ company_logo: directUrl });

    return {
      success: true,
      message: "লোগো সফলভাবে গুগল ড্রাইভে আপলোড হয়েছে এবং সকল পেজে আপডেট করা হয়েছে!",
      logoUrl: directUrl,
      fileId: file.getId()
    };

  } catch (err) {
    return {
      success: false,
      message: "গুগল ড্রাইভে আপলোড করতে ব্যর্থ: " + err.toString()
    };
  }
}

/**
 * Verify Admin Password directly against Users sheet
 */
function verifyAdminPassword(password) {
  if (!password) {
    return { success: false, message: "পাসওয়ার্ড প্রদান করুন।" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    return { success: false, message: "Users sheet পাওয়া যায়নি।" };
  }

  var data = sheet.getDataRange().getValues();
  var cleanPass = String(password).trim();

  for (var i = 1; i < data.length; i++) {
    var role = String(data[i][5]).trim().toLowerCase();
    var pass = String(data[i][4]).trim();
    var status = String(data[i][7]).trim().toLowerCase();

    if (role === "admin" && pass === cleanPass) {
      if (status !== "active") {
        return { success: false, message: "অ্যাডমিন একাউন্টটি নিষ্ক্রিয় রয়েছে।" };
      }
      return {
        success: true,
        message: "অ্যাডমিন নিরাপত্তা যাচাই সফল হয়েছে!",
        admin: {
          employeeId: String(data[i][0]),
          name: String(data[i][1]),
          phone: String(data[i][2]),
          email: String(data[i][3])
        }
      };
    }
  }

  return { success: false, message: "ভুল অ্যাডমিন পাসওয়ার্ড! অ্যাক্সেস প্রত্যাখ্যাত।" };
}

/**
 * Deduplicate All Sheets in the Entire Spreadsheet
 * Scans every sheet and deletes all duplicate rows:
 * - Every employee's personal tab (EMP-*, keeps 1 latest row per date)
 * - Reports_Master (keeps 1 row per date & employee, cleans time format)
 * - Attendance (keeps 1 row per date & employee, cleans 1899-12-30 time format)
 * - Commissions_Log (keeps 1 row per date & employee & sl)
 * - Advances_Log (keeps 1 row per date & employee & sl)
 * - Schedules (keeps 1 row per employee)
 * - Users (keeps 1 row per employeeId)
 */
function deduplicateAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var totalCleaned = 0;
  var details = [];

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName();

    // 1. Employee personal tabs (EMP-* or ADM-* or EMP_* or ADM_*)
    if (sheetName.indexOf("EMP-") === 0 || sheetName.indexOf("ADM-") === 0 || sheetName.indexOf("EMP_") === 0 || sheetName.indexOf("ADM_") === 0) {
      var data = sheet.getDataRange().getValues();
      if (data.length > 2) {
        var seenDates = {};
        var rowsToDelete = [];
        // Scan backwards: keep latest, collect earlier rows to delete
        for (var r = data.length - 1; r >= 1; r--) {
          var dateKey = normalizeDateStr(data[r][0]);
          if (!dateKey) continue;
          if (seenDates[dateKey]) {
            rowsToDelete.push(r + 1);
          } else {
            seenDates[dateKey] = true;
            // Clean arrival and departure times in place
            try {
              var arr = formatTimeStr(data[r][2]);
              var dep = formatTimeStr(data[r][3]);
              if (arr && arr !== String(data[r][2])) sheet.getRange(r + 1, 3).setValue("'" + arr);
              if (dep && dep !== String(data[r][3])) sheet.getRange(r + 1, 4).setValue("'" + dep);
            } catch (e1) {}
          }
        }
        // rowsToDelete is naturally descending (highest row first)
        for (var d = 0; d < rowsToDelete.length; d++) {
          sheet.deleteRow(rowsToDelete[d]);
          totalCleaned++;
        }
        if (rowsToDelete.length > 0) {
          details.push(sheetName + ": " + rowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }

    // 2. Reports_Master
    if (sheetName === SHEETS.MASTER_REPORTS) {
      var mData = sheet.getDataRange().getValues();
      if (mData.length > 2) {
        var seenMaster = {};
        var mRowsToDelete = [];
        for (var mr = mData.length - 1; mr >= 1; mr--) {
          var repId = String(mData[mr][0]).trim();
          var dateKey = normalizeDateStr(mData[mr][1]);
          var empKey = String(mData[mr][3] || mData[mr][4] || "").trim().toLowerCase();
          var key = (dateKey && empKey) ? (empKey + "_" + dateKey) : repId;
          if (!key) continue;
          if (seenMaster[key]) {
            mRowsToDelete.push(mr + 1);
          } else {
            seenMaster[key] = true;
            // Clean arrival & departure times in place
            try {
              var arr = formatTimeStr(mData[mr][5]);
              var dep = formatTimeStr(mData[mr][6]);
              if (arr && arr !== String(mData[mr][5])) sheet.getRange(mr + 1, 6).setValue("'" + arr);
              if (dep && dep !== String(mData[mr][6])) sheet.getRange(mr + 1, 7).setValue("'" + dep);
            } catch (e2) {}
          }
        }
        for (var md = 0; md < mRowsToDelete.length; md++) {
          sheet.deleteRow(mRowsToDelete[md]);
          totalCleaned++;
        }
        if (mRowsToDelete.length > 0) {
          details.push("Reports_Master: " + mRowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }

    // 3. Attendance
    if (sheetName === SHEETS.ATTENDANCE) {
      var aData = sheet.getDataRange().getValues();
      if (aData.length > 2) {
        var seenAtt = {};
        var aRowsToDelete = [];
        for (var ar = aData.length - 1; ar >= 1; ar--) {
          var dateKey = normalizeDateStr(aData[ar][0]);
          var empKey = String(aData[ar][1] || aData[ar][2] || "").trim().toLowerCase();
          var key = empKey + "_" + dateKey;
          if (!dateKey) continue;
          if (seenAtt[key]) {
            aRowsToDelete.push(ar + 1);
          } else {
            seenAtt[key] = true;
            // Clean arrival & departure times in place (removes 1899-12-30T... epoch strings)
            try {
              var arr = formatTimeStr(aData[ar][3]);
              var dep = formatTimeStr(aData[ar][4]);
              if (arr && arr !== String(aData[ar][3])) sheet.getRange(ar + 1, 4).setValue("'" + arr);
              if (dep && dep !== String(aData[ar][4])) sheet.getRange(ar + 1, 5).setValue("'" + dep);
            } catch (e3) {}
          }
        }
        for (var ad = 0; ad < aRowsToDelete.length; ad++) {
          sheet.deleteRow(aRowsToDelete[ad]);
          totalCleaned++;
        }
        if (aRowsToDelete.length > 0) {
          details.push("Attendance: " + aRowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }

    // 4. Commissions Log
    if (sheetName === SHEETS.COMMISSIONS) {
      var cData = sheet.getDataRange().getValues();
      if (cData.length > 2) {
        var seenComm = {};
        var cRowsToDelete = [];
        var isNewSchema = (String(cData[0][0]).trim() === "CommissionID");

        for (var cr = cData.length - 1; cr >= 1; cr--) {
          var cId = isNewSchema ? String(cData[cr][0] || "").trim() : "";
          var dKey = normalizeDateStr(isNewSchema ? cData[cr][1] : cData[cr][0]);
          var eKey = String(isNewSchema ? (cData[cr][2] || cData[cr][3]) : (cData[cr][1] || cData[cr][2])).trim().toLowerCase();
          var slKey = String(isNewSchema ? cData[cr][4] : cData[cr][3]).trim();
          var phKey = String(isNewSchema ? cData[cr][5] : cData[cr][4]).trim();
          var cKey = cId || (dKey + "_" + eKey + "_" + (slKey || phKey));

          if (!cKey) continue;
          if (seenComm[cKey]) {
            cRowsToDelete.push(cr + 1);
          } else {
            seenComm[cKey] = true;
          }
        }
        for (var cd = 0; cd < cRowsToDelete.length; cd++) {
          sheet.deleteRow(cRowsToDelete[cd]);
          totalCleaned++;
        }
        if (cRowsToDelete.length > 0) {
          details.push("Commissions_Log: " + cRowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }

    // 5. Advances Log
    if (sheetName === SHEETS.ADVANCES) {
      var advData = sheet.getDataRange().getValues();
      if (advData.length > 2) {
        var seenAdv = {};
        var advRowsToDelete = [];
        for (var advR = advData.length - 1; advR >= 1; advR--) {
          var dKey = normalizeDateStr(advData[advR][0]);
          var eKey = String(advData[advR][1] || advData[advR][2] || "").trim().toLowerCase();
          var slKey = String(advData[advR][3] || "").trim();
          var phKey = String(advData[advR][4] || "").trim();
          var aKey = dKey + "_" + eKey + "_" + (slKey || phKey);
          if (!dKey) continue;
          if (seenAdv[aKey]) {
            advRowsToDelete.push(advR + 1);
          } else {
            seenAdv[aKey] = true;
          }
        }
        for (var advD = 0; advD < advRowsToDelete.length; advD++) {
          sheet.deleteRow(advRowsToDelete[advD]);
          totalCleaned++;
        }
        if (advRowsToDelete.length > 0) {
          details.push("Advances_Log: " + advRowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }

    // 6. Schedules
    if (sheetName === SHEETS.SCHEDULES) {
      var sData = sheet.getDataRange().getValues();
      if (sData.length > 2) {
        var seenSched = {};
        var sRowsToDelete = [];
        for (var sr = sData.length - 1; sr >= 1; sr--) {
          var empKey = String(sData[sr][0]).trim().toLowerCase();
          if (!empKey) continue;
          if (seenSched[empKey]) {
            sRowsToDelete.push(sr + 1);
          } else {
            seenSched[empKey] = true;
          }
        }
        for (var sd = 0; sd < sRowsToDelete.length; sd++) {
          sheet.deleteRow(sRowsToDelete[sd]);
          totalCleaned++;
        }
        if (sRowsToDelete.length > 0) {
          details.push("Schedules: " + sRowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }

    // 7. Users
    if (sheetName === SHEETS.USERS) {
      var uData = sheet.getDataRange().getValues();
      if (uData.length > 2) {
        var seenUsers = {};
        var uRowsToDelete = [];
        for (var ur = uData.length - 1; ur >= 1; ur--) {
          var empKey = String(uData[ur][0]).trim().toLowerCase();
          if (!empKey) continue;
          if (seenUsers[empKey]) {
            uRowsToDelete.push(ur + 1);
          } else {
            seenUsers[empKey] = true;
          }
        }
        for (var ud = 0; ud < uRowsToDelete.length; ud++) {
          sheet.deleteRow(uRowsToDelete[ud]);
          totalCleaned++;
        }
        if (uRowsToDelete.length > 0) {
          details.push("Users: " + uRowsToDelete.length + " টি ডুপ্লিকেট সারি মুছে ফেলা হয়েছে");
        }
      }
    }
  }

  return {
    success: true,
    totalCleaned: totalCleaned,
    details: details,
    message: totalCleaned > 0 
      ? "মোট " + totalCleaned + "টি ডুপ্লিকেট সারি গুগল শিট থেকে সফলভাবে মুছে ফেলা হয়েছে এবং সময়সূচি পরিচ্ছন্ন করা হয়েছে!" 
      : "কোনো ডুপ্লিকেট ডাটা পাওয়া যায়নি। সমস্ত শিট সম্পূর্ণ পরিচ্ছন্ন রয়েছে।"
  };
}

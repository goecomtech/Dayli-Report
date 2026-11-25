/**
 * Life Free Pro - Main Application Logic (js/app.js)
 * High-Fidelity Official Daily Reporting Sheet & Employee Management
 * Features: Real-time Auto-Save (Draft), Dynamic Commission & Advance Rows,
 * Mobile Responsive Layouts, Admin Custom Work Schedule per Employee.
 */

// Bengali Day Names
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

// Default Standard 13-item Schedule from Official Document
const DEFAULT_SCHEDULE_ITEMS = [
  { id: 1, time: '১০:০০ – ১০:৩০', task: 'অফিস গোছানো ও পরিচ্ছন্নতা  —  ডেস্ক, কম্পিউটার, ফোন ও প্রোডাক্ট শেলফ পরিষ্কার; গতকালের পেন্ডিং ও আজকের টার্গেট দেখা', isBreak: false },
  { id: 2, time: '১০:৩০ – ১২:০০', task: 'ফেসবুক পোস্ট: ডিজাইন, লেখা ও পোস্ট করা  —  আজকের পোস্ট ডিজাইন, ক্যাপশন লেখা ও পেজে পোস্ট', isBreak: false },
  { id: 3, time: '১২:০০ – ১:০০', task: 'ওয়েবসাইট অর্ডার কনফার্মেশন (১ম রাউন্ড)  —  ১২টার পর কাস্টমাররা কল ধরেন, তাই জমে থাকা সব নতুন অর্ডারে প্রথম কল; ঠিকানা ও পরিমাণ যাচাই', isBreak: false },
  { id: 4, time: '১:০০ – ২:০০', task: 'লাঞ্চ ব্রেক', isBreak: true },
  { id: 5, time: '২:০০ – ৩:৩০', task: 'ওয়েবসাইট অর্ডার কনফার্মেশন (২য় রাউন্ড)  —  ১ম রাউন্ডে যারা ধরেননি তাদের আবার কল; নতুন আসা অর্ডার কনফার্ম', isBreak: false },
  { id: 6, time: '৩:৩০ – ৪:০০', task: 'পুরনো কাস্টমার ফলো-আপ  —  আগের কাস্টমারদের খোঁজখবর ও ব্যবহারের অগ্রগতি, রিপিট অর্ডারের কথা', isBreak: false },
  { id: 7, time: '৪:০০ – ৪:১৫', task: 'নামাজের বিরতি', isBreak: true },
  { id: 8, time: '৪:১৫ – ৫:১৫', task: 'ওয়েবসাইট অর্ডার কনফার্মেশন (৩য় রাউন্ড)  —  আছরের পর বাকি অর্ডার ও না-ধরা কাস্টমারদের কল; না ধরলে মেসেজ দিয়ে রাখা', isBreak: false },
  { id: 9, time: '৫:১৫ – ৬:০০', task: 'প্যাকেজিং ও প্রোডাকশন সহায়তা  —  কনফার্ম অর্ডারের প্যাকেজিং, লেবেলিং, কুরিয়ার পার্সেল প্রস্তুত, স্টক গোছানো', isBreak: false },
  { id: 10, time: '৬:০০ – ৬:১৫', task: 'মাগরিবের নামাজের বিরতি  —  ওয়াক্ত বদলালে ১৫ মিনিট ওয়াক্ত অনুযায়ী নিন', isBreak: true },
  { id: 11, time: '৬:১৫ – ৭:১৫', task: 'ওয়েবসাইট অর্ডার কনফার্মেশন (৪র্থ রাউন্ড, চূড়ান্ত)  —  সন্ধ্যায় বাকিদের কল; কল ধরলে আগে জেনে নিন কথা বলার সুবিধা আছে কিনা (প্রাইভেসি); কনফার্ম না হলে কারণ নোট', isBreak: false },
  { id: 12, time: '৭:১৫ – ৭:৪৫', task: 'পুরনো কাস্টমার ফলো-আপ ও টুকটাক কাজ  —  রাতের ফলো-আপ রাউন্ড, ডেটা এন্ট্রি, ইনভেন্টরি, পরদিনের পোস্টের আইডিয়া', isBreak: false },
  { id: 13, time: '৭:৪৫ – ৮:০০', task: 'দিনের হিসাব মেলানো ও রিপোর্ট পূরণ  —  নিচের হিসাব পূরণ করে ডেস্ক গুছিয়ে যাওয়া', isBreak: false }
];

class LfpApp {
  constructor() {
    this.currentUser = null;
    this.settings = DefaultSettings;
    this.currentViewMode = 'form';
    this.currentReport = null;
    this.isFormLocked = false;
    this.signaturePadCanvas = null;
    this.autoSaveTimer = null;
    this.employeeSchedule = DEFAULT_SCHEDULE_ITEMS;
    this.editorScheduleList = [];
    this.currentEmpTab = 'form';
    this.adminCommSelectedIds = new Set();
  }

  /* Universal Time Formatter for UI display */
  formatTimeDisplay(val) {
    if (!val && val !== 0) return '-';
    var s = String(val).trim();
    if (s === '' || s === '-') return '-';

    // If it's an ISO timestamp like 1899-12-30T04:06:40.000Z
    if (s.indexOf('T') !== -1) {
      try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        }
      } catch (e) {}
    }

    // Match HH:mm or H:mm
    const match = s.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }

    return s;
  }

  async init() {
    // 0. Auto-sync server configuration so ANY device or phone connects live instantly!
    await window.lfpApi.initConfig();

    // 1. Load Settings
    await this.loadSettings();

    // 2. Check Connection status banner
    this.updateConnectionBanner();

    // 3. Check Current User
    this.currentUser = window.lfpApi.getCurrentUser();
    this.updateAuthUi();

    if (this.currentUser) {
      if (this.currentUser.role === 'admin') {
        this.switchAdminTab('dashboard');
      } else {
        await this.initEmployeeForm();
      }
    } else {
      this.showLoginModal();
      if (!window.lfpApi.isConfigured()) {
        const errBox = document.getElementById('loginErrorNotice');
        if (errBox) {
          errBox.innerHTML = `<span>⚠️ <strong>গুগল শিট কানেক্ট করা নেই:</strong> লাইভ সিস্টেমটি চালু করতে প্রথমে গুগল শিট কানেক্ট করুন।</span> <br><a href="setup.html" class="btn btn-sm btn-primary" style="margin-top:8px; display:inline-block; color:#fff; text-decoration:none;">গুগল শিট সেটআপ উইজার্ড ➔</a>`;
          errBox.style.display = 'block';
        }
      }
    }

    this.bindEvents();
  }

  async loadSettings() {
    try {
      const res = await window.lfpApi.request('getSettings');
      if (res.success && res.settings) {
        this.settings = { ...DefaultSettings, ...res.settings };
        this.applyBranding();
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  applyBranding() {
    if (this.settings.primary_color) {
      document.documentElement.style.setProperty('--primary', this.settings.primary_color);
      document.documentElement.style.setProperty('--sheet-border', this.settings.primary_color);
    }
    document.querySelectorAll('.branding-company-name').forEach(el => el.textContent = this.settings.company_name);
    document.querySelectorAll('.branding-tagline').forEach(el => el.textContent = this.settings.company_tagline);
    document.querySelectorAll('.branding-office-hours').forEach(el => el.textContent = this.settings.office_hours);

    const logoSrc = this.settings.company_logo || 'images/logo.svg';
    document.querySelectorAll('.branding-logo').forEach(el => {
      el.src = logoSrc;
    });
  }

  updateConnectionBanner() {
    const banner = document.getElementById('connectionBanner');
    if (!banner) return;

    const config = window.lfpApi.getConfig();
    if (!config.isConfigured) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
          <span>⚠️ <strong>গুগল শিট কানেক্ট করা নেই:</strong> লাইভ সিস্টেমটি চালু করতে অনুগ্রহ করে প্রথমে গুগল শিটের সাথে কানেক্ট করুন।</span>
          <a href="setup.html" class="btn btn-sm btn-primary" style="color:#fff; text-decoration:none; margin-left:12px;">👉 গুগল শিট সেটআপ করুন (Setup Wizard)</a>
        </div>
      `;
    } else {
      banner.style.display = 'none';
    }
  }

  updateAuthUi() {
    const headerUser = document.getElementById('headerUserBadge');
    const employeeNav = document.getElementById('employeeNavTabs');
    const adminNav = document.getElementById('adminNavTabs');

    if (this.currentUser) {
      headerUser.style.display = 'flex';
      document.getElementById('headerUserName').textContent = this.currentUser.name;
      document.getElementById('headerUserRole').textContent = this.currentUser.role === 'admin' ? 'অ্যাডমিন' : 'সহকর্মী';

      if (this.currentUser.role === 'admin') {
        if (employeeNav) employeeNav.style.display = 'none';
        if (adminNav) adminNav.style.display = 'flex';
      } else {
        if (employeeNav) employeeNav.style.display = 'flex';
        if (adminNav) adminNav.style.display = 'none';
      }
    } else {
      headerUser.style.display = 'none';
      if (employeeNav) employeeNav.style.display = 'none';
      if (adminNav) adminNav.style.display = 'none';
    }
  }

  showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
  }

  hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
  }

  async handleLogin(identifier, password) {
    const btn = document.getElementById('btnLoginSubmit');
    const errBox = document.getElementById('loginErrorNotice');
    errBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'লগইন হচ্ছে...';

    try {
      const res = await window.lfpApi.request('login', { identifier, password });
      if (res.success && res.user) {
        window.lfpApi.setCurrentUser(res.user);
        this.currentUser = res.user;
        this.hideLoginModal();
        this.updateAuthUi();

        if (res.user.role === 'admin') {
          this.switchAdminTab('dashboard');
        } else {
          await this.initEmployeeForm();
        }
      } else {
        if (res.notConfigured) {
          errBox.innerHTML = `<span>${res.message}</span> <br><a href="setup.html" class="btn btn-sm btn-primary" style="margin-top:8px; display:inline-block; color:#fff; text-decoration:none;">গুগল শিট সেটআপ উইজার্ড ➔</a>`;
        } else {
          errBox.textContent = res.message || 'ভুল ইউজারনেম বা পাসওয়ার্ড!';
        }
        errBox.style.display = 'block';
      }
    } catch (e) {
      errBox.textContent = 'কানেকশন ত্রুটি: ' + e.message;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'লগইন করুন';
    }
  }

  handleLogout() {
    if (confirm('আপনি কি নিশ্চিত যে লগআউট করতে চান?')) {
      window.lfpApi.logout();
      this.currentUser = null;
      this.updateAuthUi();
      this.showLoginModal();
    }
  }

  /* =========================================================================
     EMPLOYEE REPORTING FORM & REAL-TIME AUTO-SAVE
     ========================================================================= */
  /* Switch Employee Workspace Tabs (Report Form vs Commission Tracker) */
  async switchEmployeeTab(tabName) {
    this.currentEmpTab = tabName;
    const formSection = document.getElementById('employeeReportSection');
    const commSection = document.getElementById('employeeCommissionSection');
    const adminSection = document.getElementById('adminPanelSection');
    if (adminSection) adminSection.style.display = 'none';

    document.querySelectorAll('#employeeNavTabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.empTab === tabName);
    });

    if (tabName === 'commissions') {
      if (formSection) formSection.style.display = 'none';
      if (commSection) commSection.style.display = 'block';
      await this.loadEmployeeCommissions();
    } else {
      if (commSection) commSection.style.display = 'none';
      if (formSection) formSection.style.display = 'block';
    }
  }

  async initEmployeeForm(dateOverride = null, isViewOnly = false, reportData = null) {
    this.currentEmpTab = 'form';
    const formSection = document.getElementById('employeeReportSection');
    const commSection = document.getElementById('employeeCommissionSection');
    const adminSection = document.getElementById('adminPanelSection');
    if (formSection) formSection.style.display = 'block';
    if (commSection) commSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';

    document.querySelectorAll('#employeeNavTabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.empTab === 'form');
    });

    const targetEmpId = reportData ? reportData.employeeId : this.currentUser.employeeId;
    const targetEmpName = reportData ? reportData.employeeName : this.currentUser.name;

    const todayDate = dateOverride || new Date().toISOString().split('T')[0];
    const today = new Date(todayDate);
    const dayName = BN_DAYS[today.getDay()];

    // Fill Meta
    document.getElementById('reportDate').value = todayDate;
    document.getElementById('reportDay').value = dayName;
    document.getElementById('reportEmpName').value = targetEmpName;
    document.getElementById('reportEmpId').value = targetEmpId;

    // Load custom schedule for this employee from Google Sheets
    await this.fetchEmployeeSchedule(targetEmpId);

    // 1. Check if report already exists in Google Sheet
    let existing = reportData;
    if (!existing) {
      const res = await window.lfpApi.request('getReport', {
        employeeId: targetEmpId,
        date: todayDate
      });
      if (res.success && res.found) {
        existing = res.report;
      }
    }

    // 2. Check local draft storage if not in Google Sheet or if draft is newer
    const localDraftKey = `lfp_draft_${targetEmpId}_${todayDate}`;
    if (!existing || existing.status === 'Draft') {
      try {
        const localDraft = localStorage.getItem(localDraftKey);
        if (localDraft) {
          const parsedDraft = JSON.parse(localDraft);
          // Prefer whichever is available
          existing = existing || parsedDraft;
        }
      } catch (e) {
        console.warn('Local draft parse error:', e);
      }
    }

    const lockBanner = document.getElementById('reportLockBanner');
    const submitBtn = document.getElementById('btnSubmitReport');
    const saveDraftBtn = document.getElementById('btnSaveDraftManual');
    const autoSaveIndicator = document.getElementById('autoSaveIndicator');

    if (existing && existing.status === 'Submitted' && this.currentUser.role !== 'admin' && !isViewOnly) {
      // Form is locked for employee after submission!
      this.isFormLocked = true;
      lockBanner.style.display = 'flex';
      submitBtn.style.display = 'none';
      if (saveDraftBtn) saveDraftBtn.style.display = 'none';
      if (autoSaveIndicator) autoSaveIndicator.style.display = 'none';
      this.populateFormFields(existing, true);
    } else if (existing && existing.status === 'Submitted') {
      // Admin reviewing or editing
      this.isFormLocked = isViewOnly;
      lockBanner.style.display = 'none';
      if (this.currentUser.role === 'admin') {
        submitBtn.style.display = 'inline-flex';
        submitBtn.textContent = 'পরিবর্তন সংরক্ষণ করুন (Admin Update)';
        if (saveDraftBtn) saveDraftBtn.style.display = 'none';
      } else {
        submitBtn.style.display = 'none';
      }
      this.populateFormFields(existing, isViewOnly && this.currentUser.role !== 'admin');
    } else if (existing) {
      // In-progress draft! Restore and keep live editing
      this.isFormLocked = false;
      lockBanner.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
      submitBtn.textContent = '✅ আজকের চূড়ান্ত রিপোর্ট সাবমিট করুন';
      if (saveDraftBtn) saveDraftBtn.style.display = 'inline-flex';
      if (autoSaveIndicator) {
        autoSaveIndicator.style.display = 'inline-flex';
        autoSaveIndicator.className = 'autosave-badge autosave-saved';
        autoSaveIndicator.innerHTML = '✅ খসড়া সংরক্ষিত রয়েছে';
      }
      this.populateFormFields(existing, false);
    } else {
      // Fresh new report for today
      this.isFormLocked = false;
      lockBanner.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
      submitBtn.textContent = '✅ আজকের চূড়ান্ত রিপোর্ট সাবমিট করুন';
      if (saveDraftBtn) saveDraftBtn.style.display = 'inline-flex';
      if (autoSaveIndicator) {
        autoSaveIndicator.style.display = 'inline-flex';
        autoSaveIndicator.className = 'autosave-badge autosave-saved';
        autoSaveIndicator.innerHTML = '🟢 নতুন রিপোর্ট চালু';
      }
      this.renderFreshForm();
    }
  }

  async fetchEmployeeSchedule(empId) {
    try {
      const res = await window.lfpApi.request('getSchedule', { employeeId: empId });
      if (res.success && res.found && Array.isArray(res.schedule) && res.schedule.length > 0) {
        this.employeeSchedule = res.schedule;
      } else {
        this.employeeSchedule = DEFAULT_SCHEDULE_ITEMS;
      }
    } catch (e) {
      this.employeeSchedule = DEFAULT_SCHEDULE_ITEMS;
    }
  }

  renderFreshForm() {
    // Arrival / Departure defaults
    document.getElementById('reportArrival').value = '10:00';
    document.getElementById('reportDeparture').value = '20:00';

    // Render Schedule Rows from employeeSchedule
    this.renderScheduleTable(this.employeeSchedule);

    // Clear EOD inputs
    const eodInputs = [
      'eodConfirmedOrders', 'eodWebsiteOrders', 'eodPendingOrders', 'eodCancelledOrders',
      'eodDiscountOrders', 'eodDiscountAmount', 'eodOldFollowups', 'eodRepeatOrders',
      'eodFbPosts', 'eodPackagingPcs', 'eodCommissionPcs', 'eodAdvanceTotal',
      'eodOtStart', 'eodOtEnd', 'eodOtHours', 'eodEmployeeRemarks', 'eodSupervisorRemarks'
    ];
    eodInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Responsibilities
    document.getElementById('respCourierFound').value = '0';
    document.getElementById('respCourierSolved').value = '0';
    document.getElementById('respUnrepliedMsg').value = '0';

    // Render minimum 3 clean rows by default (user can add unlimited rows with + button)
    this.renderCommissionRows([], 3, false);
    this.renderAdvanceRows([], 3, false);

    // Init Signature Canvas
    this.initSignatureCanvas();
  }

  populateFormFields(data, isLocked) {
    const rawArr = data.arrivalTime || '';
    const rawDep = data.departureTime || '';
    const cleanArr = this.formatTimeDisplay(rawArr);
    const cleanDep = this.formatTimeDisplay(rawDep);
    document.getElementById('reportArrival').value = cleanArr === '-' ? '' : cleanArr;
    document.getElementById('reportDeparture').value = cleanDep === '-' ? '' : cleanDep;

    // Schedule
    const sched = data.schedule && data.schedule.length > 0 ? data.schedule : this.employeeSchedule;
    this.renderScheduleTable(sched, isLocked);

    // Responsibilities
    const resp = data.responsibilities || {};
    document.getElementById('respCourierFound').value = resp.courierIssuesFound || 0;
    document.getElementById('respCourierSolved').value = resp.courierIssuesSolved || 0;
    document.getElementById('respUnrepliedMsg').value = resp.unrepliedMessages || 0;

    // EOD
    const eod = data.endOfDay || {};
    document.getElementById('eodConfirmedOrders').value = eod.totalConfirmedOrders ?? '';
    document.getElementById('eodWebsiteOrders').value = eod.websiteConfirmedOrders ?? '';
    document.getElementById('eodPendingOrders').value = eod.pendingCallsOrders ?? '';
    document.getElementById('eodCancelledOrders').value = eod.cancelledOrders ?? '';
    document.getElementById('eodDiscountOrders').value = eod.discountOrdersCount ?? '';
    document.getElementById('eodDiscountAmount').value = eod.totalDiscountAmount ?? '';
    document.getElementById('eodOldFollowups').value = eod.oldCustomerFollowupCount ?? '';
    document.getElementById('eodRepeatOrders').value = eod.repeatOrdersCount ?? '';
    document.getElementById('eodFbPosts').value = eod.fbPostsCount ?? '';
    document.getElementById('eodPackagingPcs').value = eod.packagingPcs ?? '';
    document.getElementById('eodCommissionPcs').value = eod.commissionSalesPcs ?? '';
    document.getElementById('eodAdvanceTotal').value = eod.advanceTotalAmount ?? '';
    document.getElementById('eodOtStart').value = eod.overtimeStart || '';
    document.getElementById('eodOtEnd').value = eod.overtimeEnd || '';
    document.getElementById('eodOtHours').value = eod.overtimeTotalHours ?? '';
    document.getElementById('eodEmployeeRemarks').value = eod.employeeRemarks || '';
    document.getElementById('eodSupervisorRemarks').value = eod.supervisorRemarks || '';

    // Commissions & Advances (Render all existing rows, minimum 3)
    this.renderCommissionRows(data.commissions || [], 3, isLocked);
    this.renderAdvanceRows(data.advances || [], 3, isLocked);

    // Signatures
    if (data.employeeSignature) {
      document.getElementById('empSignatureDisplay').innerHTML = `
        <img src="${data.employeeSignature}" class="signature-img" alt="সহকর্মীর স্বাক্ষর" />
      `;
    }
    if (data.supervisorSignature) {
      document.getElementById('supervisorSignatureDisplay').innerHTML = `
        <img src="${data.supervisorSignature}" class="signature-img" alt="অনুমোদনকারীর স্বাক্ষর" />
      `;
    }

    // Toggle readonly
    document.querySelectorAll('#employeeReportSection input, #employeeReportSection textarea').forEach(el => {
      if (isLocked) {
        el.setAttribute('readonly', 'true');
        if (el.type === 'checkbox') el.setAttribute('disabled', 'true');
      } else {
        el.removeAttribute('readonly');
        el.removeAttribute('disabled');
      }
    });

    const addCommBtn = document.getElementById('btnAddCommRow');
    const addAdvBtn = document.getElementById('btnAddAdvRow');
    if (addCommBtn) addCommBtn.style.display = isLocked ? 'none' : 'inline-flex';
    if (addAdvBtn) addAdvBtn.style.display = isLocked ? 'none' : 'inline-flex';
  }

  renderScheduleTable(items, isLocked = false) {
    const tbody = document.getElementById('scheduleTableBody');
    tbody.innerHTML = '';

    items.forEach((item, index) => {
      const tr = document.createElement('tr');
      if (item.isBreak) {
        tr.className = 'break-row';
        tr.innerHTML = `
          <td class="text-center font-bold" style="width:14%;"><span class="schedule-time-badge">${item.time}</span></td>
          <td colspan="3" class="text-center font-semibold">☕ ${item.task}</td>
        `;
      } else {
        tr.innerHTML = `
          <td class="text-center font-bold" style="white-space:nowrap; width:14%;">
            <span class="schedule-time-badge">${item.time}</span>
          </td>
          <td style="width:52%;">
            <div class="schedule-task-desc">${item.task}</div>
          </td>
          <td class="text-center" style="width:12%;">
            <div class="sheet-checkbox-wrapper">
              <label class="schedule-touch-checkbox-label">
                <input type="checkbox" class="sheet-checkbox schedule-check" data-id="${item.id || index + 1}" ${item.completed ? 'checked' : ''} ${isLocked ? 'disabled' : ''} />
              </label>
            </div>
          </td>
          <td style="width:22%;">
            <input type="text" class="sheet-input schedule-comment" data-id="${item.id || index + 1}" value="${item.comment || ''}" placeholder="মন্তব্য লিখুন..." ${isLocked ? 'readonly' : ''} />
          </td>
        `;
      }
      tbody.appendChild(tr);
    });
  }

  /* Commission Rows (Dynamic Add & Remove) */
  renderCommissionRows(existingList = [], minRows = 3, isLocked = false) {
    const tbody = document.getElementById('commissionTableBody');
    tbody.innerHTML = '';

    const count = Math.max(minRows, existingList.length);
    for (let i = 0; i < count; i++) {
      const rowData = existingList[i] || {};
      this.createCommissionRowElement(tbody, i + 1, rowData, isLocked);
    }

    this.calculateCommissionTotals();
  }

  createCommissionRowElement(tbody, sl, rowData = {}, isLocked = false) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center font-bold" style="width:6%;">${sl}</td>
      <td style="width:28%;">
        <input type="tel" class="sheet-input comm-phone" value="${rowData.phone || ''}" placeholder="017xxxxxxxx" ${isLocked ? 'readonly' : ''} />
      </td>
      <td style="width:16%;">
        <input type="number" class="sheet-input sheet-number-input comm-pcs" value="${rowData.pieces || ''}" placeholder="0" min="0" ${isLocked ? 'readonly' : ''} />
      </td>
      <td style="width:20%;">
        <input type="text" class="sheet-input comm-source" value="${rowData.source || ''}" placeholder="Facebook / Website" ${isLocked ? 'readonly' : ''} />
      </td>
      <td style="width:22%;">
        <input type="text" class="sheet-input comm-note" value="${rowData.note || ''}" placeholder="নোট..." ${isLocked ? 'readonly' : ''} />
      </td>
      <td class="text-center no-print" style="width:8%;">
        ${!isLocked ? `<button type="button" class="btn-icon-del" onclick="window.lfpApp.removeCommissionRow(this)" title="সারি মুছুন">✖</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  }

  addCommissionRow() {
    if (this.isFormLocked) return;
    const tbody = document.getElementById('commissionTableBody');
    const sl = tbody.children.length + 1;
    this.createCommissionRowElement(tbody, sl, {}, false);
    this.triggerAutoSave();
  }

  removeCommissionRow(btn) {
    if (this.isFormLocked) return;
    const tr = btn.closest('tr');
    tr.remove();
    this.reindexCommissionRows();
    this.calculateCommissionTotals();
    this.triggerAutoSave();
  }

  reindexCommissionRows() {
    const rows = document.querySelectorAll('#commissionTableBody tr');
    rows.forEach((tr, i) => {
      const tdFirst = tr.querySelector('td:first-child');
      if (tdFirst) tdFirst.textContent = i + 1;
    });
  }

  /* Advance Rows (Dynamic Add & Remove) */
  renderAdvanceRows(existingList = [], minRows = 3, isLocked = false) {
    const tbody = document.getElementById('advanceTableBody');
    tbody.innerHTML = '';

    const count = Math.max(minRows, existingList.length);
    for (let i = 0; i < count; i++) {
      const rowData = existingList[i] || {};
      this.createAdvanceRowElement(tbody, i + 1, rowData, isLocked);
    }

    this.calculateAdvanceTotals();
  }

  createAdvanceRowElement(tbody, sl, rowData = {}, isLocked = false) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center font-bold" style="width:6%;">${sl}</td>
      <td style="width:26%;">
        <input type="tel" class="sheet-input adv-cust-phone" value="${rowData.phone || ''}" placeholder="017xxxxxxxx" ${isLocked ? 'readonly' : ''} />
      </td>
      <td style="width:26%;">
        <input type="text" class="sheet-input adv-pay-phone" value="${rowData.paymentAccount || ''}" placeholder="বিকাশ / নগদ / একাউন্ট" ${isLocked ? 'readonly' : ''} />
      </td>
      <td style="width:16%;">
        <input type="number" class="sheet-input sheet-number-input adv-amount" value="${rowData.amount || ''}" placeholder="0" min="0" ${isLocked ? 'readonly' : ''} />
      </td>
      <td style="width:18%;">
        <input type="text" class="sheet-input adv-note" value="${rowData.note || ''}" placeholder="নোট..." ${isLocked ? 'readonly' : ''} />
      </td>
      <td class="text-center no-print" style="width:8%;">
        ${!isLocked ? `<button type="button" class="btn-icon-del" onclick="window.lfpApp.removeAdvanceRow(this)" title="সারি মুছুন">✖</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  }

  addAdvanceRow() {
    if (this.isFormLocked) return;
    const tbody = document.getElementById('advanceTableBody');
    const sl = tbody.children.length + 1;
    this.createAdvanceRowElement(tbody, sl, {}, false);
    this.triggerAutoSave();
  }

  removeAdvanceRow(btn) {
    if (this.isFormLocked) return;
    const tr = btn.closest('tr');
    tr.remove();
    this.reindexAdvanceRows();
    this.calculateAdvanceTotals();
    this.triggerAutoSave();
  }

  reindexAdvanceRows() {
    const rows = document.querySelectorAll('#advanceTableBody tr');
    rows.forEach((tr, i) => {
      const tdFirst = tr.querySelector('td:first-child');
      if (tdFirst) tdFirst.textContent = i + 1;
    });
  }

  calculateCommissionTotals() {
    let custCount = 0;
    let totalPcs = 0;

    const rows = document.querySelectorAll('#commissionTableBody tr');
    rows.forEach(tr => {
      const phone = tr.querySelector('.comm-phone')?.value.trim();
      const pcs = Number(tr.querySelector('.comm-pcs')?.value || 0);

      if (phone || pcs > 0) {
        custCount++;
      }
      totalPcs += pcs;
    });

    document.getElementById('commTotalCustomers').textContent = custCount;
    document.getElementById('commTotalPcs').textContent = totalPcs;

    // Sync to End of Day row
    const eodComm = document.getElementById('eodCommissionPcs');
    if (eodComm && !eodComm.hasAttribute('readonly')) {
      eodComm.value = totalPcs;
    }
  }

  calculateAdvanceTotals() {
    let custCount = 0;
    let totalTk = 0;

    const rows = document.querySelectorAll('#advanceTableBody tr');
    rows.forEach(tr => {
      const phone = tr.querySelector('.adv-cust-phone')?.value.trim();
      const amt = Number(tr.querySelector('.adv-amount')?.value || 0);

      if (phone || amt > 0) {
        custCount++;
      }
      totalTk += amt;
    });

    document.getElementById('advTotalCustomers').textContent = custCount;
    document.getElementById('advTotalAmount').textContent = totalTk;

    // Sync to End of Day row
    const eodAdv = document.getElementById('eodAdvanceTotal');
    if (eodAdv && !eodAdv.hasAttribute('readonly')) {
      eodAdv.value = totalTk;
    }
  }

  calculateOvertime() {
    const start = document.getElementById('eodOtStart').value;
    const end = document.getElementById('eodOtEnd').value;
    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      let diffMin = endMin - startMin;
      if (diffMin < 0) diffMin += 24 * 60;
      const hours = (diffMin / 60).toFixed(1);
      document.getElementById('eodOtHours').value = hours;
    }
  }

  initSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let painting = false;

    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 100;

    ctx.strokeStyle = '#007A3D';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    function startPos(e) {
      painting = true;
      draw(e);
    }
    function endPos() {
      painting = false;
      ctx.beginPath();
    }
    function draw(e) {
      if (!painting) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    canvas.addEventListener('mousedown', startPos);
    canvas.addEventListener('mouseup', endPos);
    canvas.addEventListener('mousemove', draw);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startPos(e); });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); endPos(); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });

    document.getElementById('btnClearSignature')?.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.triggerAutoSave();
    });

    this.signaturePadCanvas = canvas;
  }

  getCollectedReportData(status = 'Draft') {
    const date = document.getElementById('reportDate').value;
    const day = document.getElementById('reportDay').value;
    const empName = document.getElementById('reportEmpName').value;
    const empId = document.getElementById('reportEmpId').value;
    const arrivalTime = document.getElementById('reportArrival').value;
    const departureTime = document.getElementById('reportDeparture').value;

    // Schedule
    const schedule = [];
    const schedRows = document.querySelectorAll('#scheduleTableBody tr');
    schedRows.forEach((tr, idx) => {
      const item = this.employeeSchedule[idx] || {};
      if (tr.classList.contains('break-row')) {
        schedule.push({ id: item.id || idx + 1, time: item.time || '', task: item.task || '', isBreak: true });
      } else {
        const completed = tr.querySelector('.schedule-check')?.checked || false;
        const comment = tr.querySelector('.schedule-comment')?.value || '';
        schedule.push({ id: item.id || idx + 1, time: item.time || '', task: item.task || '', completed, comment, isBreak: false });
      }
    });

    // Responsibilities
    const responsibilities = {
      courierIssuesFound: Number(document.getElementById('respCourierFound').value || 0),
      courierIssuesSolved: Number(document.getElementById('respCourierSolved').value || 0),
      unrepliedMessages: Number(document.getElementById('respUnrepliedMsg').value || 0)
    };

    // End of day
    const endOfDay = {
      totalConfirmedOrders: Number(document.getElementById('eodConfirmedOrders').value || 0),
      websiteConfirmedOrders: Number(document.getElementById('eodWebsiteOrders').value || 0),
      pendingCallsOrders: Number(document.getElementById('eodPendingOrders').value || 0),
      cancelledOrders: Number(document.getElementById('eodCancelledOrders').value || 0),
      discountOrdersCount: Number(document.getElementById('eodDiscountOrders').value || 0),
      totalDiscountAmount: Number(document.getElementById('eodDiscountAmount').value || 0),
      oldCustomerFollowupCount: Number(document.getElementById('eodOldFollowups').value || 0),
      repeatOrdersCount: Number(document.getElementById('eodRepeatOrders').value || 0),
      fbPostsCount: Number(document.getElementById('eodFbPosts').value || 0),
      packagingPcs: Number(document.getElementById('eodPackagingPcs').value || 0),
      commissionSalesPcs: Number(document.getElementById('eodCommissionPcs').value || 0),
      advanceTotalAmount: Number(document.getElementById('eodAdvanceTotal').value || 0),
      overtimeStart: document.getElementById('eodOtStart').value || '',
      overtimeEnd: document.getElementById('eodOtEnd').value || '',
      overtimeTotalHours: Number(document.getElementById('eodOtHours').value || 0),
      employeeRemarks: document.getElementById('eodEmployeeRemarks').value || '',
      supervisorRemarks: document.getElementById('eodSupervisorRemarks').value || ''
    };

    // Commissions
    const commissions = [];
    document.querySelectorAll('#commissionTableBody tr').forEach((tr, i) => {
      const phone = tr.querySelector('.comm-phone')?.value.trim();
      const pcs = Number(tr.querySelector('.comm-pcs')?.value || 0);
      const source = tr.querySelector('.comm-source')?.value.trim();
      const note = tr.querySelector('.comm-note')?.value.trim();
      if (phone || pcs > 0) {
        commissions.push({ sl: i + 1, phone, pieces: pcs, source, note });
      }
    });

    // Advances
    const advances = [];
    document.querySelectorAll('#advanceTableBody tr').forEach((tr, i) => {
      const phone = tr.querySelector('.adv-cust-phone')?.value.trim();
      const payAcc = tr.querySelector('.adv-pay-phone')?.value.trim();
      const amount = Number(tr.querySelector('.adv-amount')?.value || 0);
      const note = tr.querySelector('.adv-note')?.value.trim();
      if (phone || amount > 0) {
        advances.push({ sl: i + 1, phone, paymentAccount: payAcc, amount, note });
      }
    });

    // Signature
    let empSignature = '';
    if (this.signaturePadCanvas) {
      empSignature = this.signaturePadCanvas.toDataURL();
    }

    return {
      reportId: `${empId}_${date}`,
      date,
      day,
      employeeId: empId,
      employeeName: empName,
      arrivalTime,
      departureTime,
      schedule,
      responsibilities,
      endOfDay,
      commissions,
      advances,
      employeeSignature: empSignature,
      status: status
    };
  }

  /* Real-Time Auto-Save Function */
  triggerAutoSave() {
    if (this.isFormLocked) return;

    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
      indicator.className = 'autosave-badge autosave-saving';
      indicator.innerHTML = '💾 সংরক্ষণ হচ্ছে...';
    }

    const reportData = this.getCollectedReportData('Draft');

    // 1. Instantly persist to localStorage
    const localKey = `lfp_draft_${reportData.employeeId}_${reportData.date}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(reportData));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. Debounce background sync to Google Sheets (5s debounce to prevent burst saves)
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(async () => {
      try {
        const res = await window.lfpApi.request('submitReport', { report: reportData });
        if (indicator) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          indicator.className = 'autosave-badge autosave-saved';
          indicator.innerHTML = `✅ স্বয়ংক্রিয়ভাবে সংরক্ষিত (${timeStr})`;
        }
      } catch (err) {
        if (indicator) {
          indicator.className = 'autosave-badge autosave-saved';
          indicator.innerHTML = '✅ ফোনে ড্রাফট সংরক্ষিত';
        }
      }
    }, 5000);
  }

  async saveDraftManual() {
    if (this.isFormLocked) return;
    const btn = document.getElementById('btnSaveDraftManual');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'সংরক্ষণ হচ্ছে...';
    }

    const reportData = this.getCollectedReportData('Draft');
    const localKey = `lfp_draft_${reportData.employeeId}_${reportData.date}`;
    localStorage.setItem(localKey, JSON.stringify(reportData));

    try {
      const res = await window.lfpApi.request('submitReport', { report: reportData });
      alert(res.message || 'খসড়া (Draft) সফলভাবে গুগল শিটে সংরক্ষিত হয়েছে!');
      const indicator = document.getElementById('autoSaveIndicator');
      if (indicator) {
        indicator.className = 'autosave-badge autosave-saved';
        indicator.innerHTML = '✅ খসড়া সংরক্ষিত রয়েছে';
      }
    } catch (e) {
      alert('লোকালি সংরক্ষিত হয়েছে: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 ড্রাফট সেভ';
      }
    }
  }

  /* Final Submit */
  async submitReport() {
    const reportData = this.getCollectedReportData('Submitted');

    if (!reportData.arrivalTime) {
      alert('অনুগ্রহ করে আগমন সময় উল্লেখ করুন।');
      return;
    }

    if (!confirm('আপনি কি নিশ্চিত যে আজকের চূড়ান্ত দৈনিক রিপোর্ট সাবমিট করতে চান?\n\nচূড়ান্ত সাবমিট করার পর এটি লক হয়ে যাবে এবং আপনি আর এডিট করতে পারবেন না।')) {
      return;
    }

    const btn = document.getElementById('btnSubmitReport');
    btn.disabled = true;
    btn.textContent = 'সাবমিট হচ্ছে...';

    try {
      const res = await window.lfpApi.request('submitReport', { report: reportData });
      if (res.success) {
        // Clear local draft key
        localStorage.removeItem(`lfp_draft_${reportData.employeeId}_${reportData.date}`);
        alert('অভিনন্দন! আজকের দৈনিক রিপোর্ট সফলভাবে চূড়ান্ত সাবমিট হয়েছে।');
        // Re-initialize to lock
        await this.initEmployeeForm(reportData.date);
      } else {
        alert('রিপোর্ট জমা দিতে সমস্যা হয়েছে: ' + res.message);
      }
    } catch (err) {
      alert('ত্রুটি: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* =========================================================================
     ADMIN PANEL & ANALYTICS
     ========================================================================= */
  async switchAdminTab(tabName) {
    this.currentViewMode = tabName;
    const empSection = document.getElementById('employeeReportSection');
    const commSection = document.getElementById('employeeCommissionSection');
    const adminSection = document.getElementById('adminPanelSection');
    if (empSection) empSection.style.display = 'none';
    if (commSection) commSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'block';

    document.querySelectorAll('#adminNavTabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const views = ['dashboard', 'reports', 'commissions', 'employees', 'attendance', 'schedule_manager', 'settings'];
    views.forEach(v => {
      const el = document.getElementById(`adminView_${v}`);
      if (el) el.style.display = (v === tabName) ? 'block' : 'none';
    });

    try {
      if (tabName === 'dashboard') {
        await this.loadAdminDashboard();
      } else if (tabName === 'reports') {
        await this.loadAdminReports();
      } else if (tabName === 'commissions') {
        await this.loadAdminCommissions();
      } else if (tabName === 'employees') {
        await this.loadAdminEmployees();
      } else if (tabName === 'attendance') {
        await this.loadAdminAttendance();
      } else if (tabName === 'schedule_manager') {
        await this.loadScheduleManager();
      } else if (tabName === 'settings') {
        this.loadAdminSettings();
      }
    } catch (tabErr) {
      console.error(`Tab loading error for ${tabName}:`, tabErr);
    }
  }

  async loadAdminDashboard() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await window.lfpApi.request('getDashboardStats', { date: today });

      if (res.success) {
        const t = res.today || {};
        const avg = res.averages || {};

        document.getElementById('dashTodayReports').textContent = t.totalReports || 0;
        document.getElementById('dashConfirmedOrders').textContent = t.totalConfirmedOrders || 0;
        document.getElementById('dashSalesPieces').textContent = t.totalCommissionPcs || 0;
        document.getElementById('dashAdvanceAmount').textContent = `৳ ${t.totalAdvanceAmount || 0}`;
        document.getElementById('dashPackagingPcs').textContent = t.totalPackaging || 0;
        document.getElementById('dashOvertimeHours').textContent = `${t.totalOvertimeHours || 0} ঘঃ`;

        document.getElementById('dashAvgOrders').textContent = avg.avgOrdersPerReport || 0;
        document.getElementById('dashCancelRatio').textContent = `${avg.cancellationRatioPercent || 0}%`;

        const reportsRes = await window.lfpApi.request('getAllReports');
        const allReports = (reportsRes.success && reportsRes.reports) ? reportsRes.reports : [];

        this.renderCharts(res, allReports);
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
    }
  }

  renderCharts(statsData, allReports = []) {
    if (typeof Chart === 'undefined') return;

    const ctx1 = document.getElementById('ordersChart')?.getContext('2d');
    if (ctx1) {
      if (window.ordersChartInstance) window.ordersChartInstance.destroy();
      const t = statsData.today || {};
      const conf = t.totalConfirmedOrders || 0;
      const pend = t.totalPendingCalls || 0;
      const canc = t.totalCancelledOrders || 0;
      const rep = t.totalRepeatOrders || 0;
      const hasData = (conf + pend + canc + rep) > 0;

      window.ordersChartInstance = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['কনফার্ম অর্ডার', 'পেন্ডিং / না-ধরা', 'বাতিল অর্ডার', 'রিপিট অর্ডার'],
          datasets: [{
            data: hasData ? [conf, pend, canc, rep] : [0, 0, 0, 0],
            backgroundColor: ['#007A3D', '#F5A623', '#dc2626', '#0284c7']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    const ctx2 = document.getElementById('trendChart')?.getContext('2d');
    if (ctx2) {
      if (window.trendChartInstance) window.trendChartInstance.destroy();

      const labels = [];
      const confirmedData = [];
      const cancelledData = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = (i === 0) ? 'আজ' : BN_DAYS[d.getDay()];
        labels.push(dayLabel);

        const dayReports = allReports.filter(r => r.date === dateStr);
        const dayConfirmed = dayReports.reduce((sum, r) => sum + (Number(r.totalConfirmedOrders) || 0), 0);
        const dayCancelled = dayReports.reduce((sum, r) => sum + (Number(r.cancelledOrders) || 0), 0);

        confirmedData.push(dayConfirmed);
        cancelledData.push(dayCancelled);
      }

      window.trendChartInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'কনফার্ম অর্ডার',
              data: confirmedData,
              backgroundColor: '#007A3D'
            },
            {
              label: 'বাতিল অর্ডার',
              data: cancelledData,
              backgroundColor: '#dc2626'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }
  }

  async loadAdminReports() {
    const empSelect = document.getElementById('filterReportEmployee');
    const tbody = document.getElementById('adminReportsTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">লোড হচ্ছে...</td></tr>';

    const empRes = await window.lfpApi.request('getEmployees');
    if (empRes.success && empRes.employees) {
      empSelect.innerHTML = '<option value="all">সকল সহকর্মী</option>';
      empRes.employees.forEach(e => {
        empSelect.innerHTML += `<option value="${e.employeeId}">${e.name} (${e.employeeId})</option>`;
      });
    }

    const filters = {
      employeeId: empSelect.value,
      startDate: document.getElementById('filterReportStartDate').value,
      endDate: document.getElementById('filterReportEndDate').value
    };

    const res = await window.lfpApi.request('getAllReports', { filters });
    if (res.success && res.reports) {
      if (res.reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">কোনো রিপোর্ট পাওয়া যায়নি।</td></tr>';
        return;
      }

      // Frontend deduplication safeguard for reports
      const seenReports = new Set();
      const uniqueReports = [];
      res.reports.forEach(r => {
        const key = `${r.date}_${r.employeeId || r.employeeName}`;
        if (!seenReports.has(key)) {
          seenReports.add(key);
          uniqueReports.push(r);
        }
      });

      tbody.innerHTML = '';
      uniqueReports.forEach(r => {
        const tr = document.createElement('tr');
        const isDraft = r.status === 'Draft';
        const arrDisp = this.formatTimeDisplay(r.arrivalTime);
        const depDisp = this.formatTimeDisplay(r.departureTime);
        const timeSpan = (arrDisp !== '-' || depDisp !== '-') ? `${arrDisp} – ${depDisp}` : '-';
        tr.innerHTML = `
          <td><strong>${r.date}</strong><br><small class="text-muted">${r.day || ''}</small></td>
          <td><strong>${r.employeeName}</strong><br><small>${r.employeeId}</small></td>
          <td>${timeSpan}</td>
          <td class="font-bold text-success">${r.totalConfirmedOrders}</td>
          <td class="text-danger font-semibold">${r.cancelledOrders}</td>
          <td>${r.packagingPcs} পিস</td>
          <td>৳ ${r.advanceTotalAmount}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="window.lfpApp.openReportForReview('${r.employeeId}', '${r.date}')">
              ${isDraft ? '✏️ ড্রাফট দেখুন' : '👁️ দেখুন ও এডিট'}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  async openReportForReview(empId, date) {
    const res = await window.lfpApi.request('getReport', { employeeId: empId, date });
    if (res.success && res.found) {
      document.getElementById('adminPanelSection').style.display = 'none';
      document.getElementById('employeeReportSection').style.display = 'block';
      document.getElementById('btnBackToAdmin').style.display = 'inline-flex';
      this.initEmployeeForm(date, false, res.report);
    }
  }

  backToAdminPanel() {
    document.getElementById('btnBackToAdmin').style.display = 'none';
    this.switchAdminTab('reports');
  }

  /* Employees CRUD */
  async loadAdminEmployees() {
    const tbody = document.getElementById('employeeListTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">লোড হচ্ছে...</td></tr>';

    const res = await window.lfpApi.request('getEmployees');
    if (res.success && res.employees) {
      tbody.innerHTML = '';
      res.employees.forEach(emp => {
        const tr = document.createElement('tr');
        const isAct = emp.status === 'active';
        tr.innerHTML = `
          <td><strong>${emp.employeeId}</strong></td>
          <td><strong>${emp.name}</strong><br><small class="text-muted">${emp.designation || ''}</small></td>
          <td>${emp.phone}</td>
          <td><code>${emp.password || '******'}</code></td>
          <td><span class="user-role-badge">${emp.role}</span></td>
          <td>
            <span class="total-badge" style="background:${isAct ? '#dcfce7' : '#fee2e2'}; color:${isAct ? '#166534' : '#991b1b'};">
              ${isAct ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Inactive)'}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="window.lfpApp.editEmployeeModal('${emp.employeeId}')">✏️ এডিট</button>
            ${emp.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="window.lfpApp.deleteEmployee('${emp.employeeId}')">🗑️ মুছুন</button>` : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  openAddEmployeeModal() {
    document.getElementById('empModalTitle').textContent = 'নতুন সহকর্মী যোগ করুন';
    document.getElementById('modalEmpId').value = '';
    document.getElementById('modalEmpName').value = '';
    document.getElementById('modalEmpPhone').value = '';
    document.getElementById('modalEmpEmail').value = '';
    document.getElementById('modalEmpPass').value = '';
    document.getElementById('modalEmpRole').value = 'employee';
    document.getElementById('modalEmpDesignation').value = 'সেলস অ্যান্ড কাস্টমার সাপোর্ট';
    document.getElementById('modalEmpStatus').value = 'active';

    document.getElementById('employeeModal').classList.add('active');
  }

  async editEmployeeModal(empId) {
    const res = await window.lfpApi.request('getEmployees');
    const emp = res.employees.find(e => e.employeeId === empId);
    if (!emp) return;

    document.getElementById('empModalTitle').textContent = 'সহকর্মী তথ্য সম্পাদনা';
    document.getElementById('modalEmpId').value = emp.employeeId;
    document.getElementById('modalEmpName').value = emp.name;
    document.getElementById('modalEmpPhone').value = emp.phone;
    document.getElementById('modalEmpEmail').value = emp.email || '';
    document.getElementById('modalEmpPass').value = emp.password;
    document.getElementById('modalEmpRole').value = emp.role;
    document.getElementById('modalEmpDesignation').value = emp.designation || '';
    document.getElementById('modalEmpStatus').value = emp.status;

    document.getElementById('employeeModal').classList.add('active');
  }

  async saveEmployeeFromModal() {
    const emp = {
      employeeId: document.getElementById('modalEmpId').value.trim(),
      name: document.getElementById('modalEmpName').value.trim(),
      phone: document.getElementById('modalEmpPhone').value.trim(),
      email: document.getElementById('modalEmpEmail').value.trim(),
      password: document.getElementById('modalEmpPass').value.trim(),
      role: document.getElementById('modalEmpRole').value,
      designation: document.getElementById('modalEmpDesignation').value.trim(),
      status: document.getElementById('modalEmpStatus').value
    };

    if (!emp.name || !emp.phone) {
      alert('নাম এবং ফোন নাম্বার অবশ্যই দিন।');
      return;
    }

    const res = await window.lfpApi.request('saveEmployee', { employee: emp });
    if (res.success) {
      document.getElementById('employeeModal').classList.remove('active');
      this.loadAdminEmployees();
      alert('সহকর্মী তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
    } else {
      alert('ত্রুটি: ' + res.message);
    }
  }

  async deleteEmployee(empId) {
    if (confirm(`আপনি কি নিশ্চিত যে আইডি ${empId} মুছে ফেলতে চান?`)) {
      const res = await window.lfpApi.request('deleteEmployee', { employeeId: empId });
      if (res.success) {
        this.loadAdminEmployees();
        alert('সহকর্মী সফলভাবে মুছে ফেলা হয়েছে!');
      } else {
        alert('মুছতে ব্যর্থ: ' + res.message);
      }
    }
  }

  /* Attendance */
  async loadAdminAttendance() {
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">লোড হচ্ছে...</td></tr>';

    const month = document.getElementById('attendanceMonthFilter').value || new Date().toISOString().slice(0, 7);
    const res = await window.lfpApi.request('getAttendance', { month, employeeId: 'all' });

    if (res.success && res.records) {
      if (res.records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">এই মাসে কোনো হাজিরা রেকর্ড নেই।</td></tr>';
        return;
      }

      // Frontend deduplication safeguard (keeps 1 record per employee per date)
      const seenAtt = new Set();
      const uniqueRecords = [];
      res.records.forEach(r => {
        const key = `${r.date}_${r.employeeId || r.employeeName}`;
        if (!seenAtt.has(key)) {
          seenAtt.add(key);
          uniqueRecords.push(r);
        }
      });

      tbody.innerHTML = '';
      uniqueRecords.forEach(r => {
        const tr = document.createElement('tr');
        const isLate = r.status === 'Late';
        const displayArrival = this.formatTimeDisplay(r.arrivalTime);
        const displayDeparture = this.formatTimeDisplay(r.departureTime);
        tr.innerHTML = `
          <td><strong>${r.date}</strong></td>
          <td><strong>${r.employeeName}</strong></td>
          <td>${displayArrival}</td>
          <td>${displayDeparture}</td>
          <td>
            <span class="total-badge" style="background:${isLate ? '#fee2e2' : '#dcfce7'}; color:${isLate ? '#991b1b' : '#166534'};">
              ${isLate ? `লেট (${r.lateMinutes} মিনিট)` : 'উপস্থিত'}
            </span>
          </td>
          <td>${r.overtimeHours ? `${r.overtimeHours} ঘণ্টা` : '-'}</td>
          <td>${r.notes || ''}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  /* =========================================================================
     UPSELL & COMMISSION PARCEL TRACKING (EMPLOYEE & ADMIN)
     ========================================================================= */

  /* 1. EMPLOYEE COMMISSION TRACKER */
  async loadEmployeeCommissions() {
    const tbody = document.getElementById('empCommTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px;">লোড হচ্ছে...</td></tr>';

    if (!this.currentUser) return;

    const month = document.getElementById('empCommMonthFilter')?.value || '';
    const deliveryStatus = document.getElementById('empCommStatusFilter')?.value || 'all';
    const payoutStatus = document.getElementById('empCommPayoutFilter')?.value || 'all';
    const search = document.getElementById('empCommSearchInput')?.value.trim() || '';

    try {
      const res = await window.lfpApi.request('getCommissions', {
        employeeId: this.currentUser.employeeId,
        month,
        deliveryStatus,
        payoutStatus,
        search
      });

      if (res.success && res.items) {
        // Update metric stats
        const st = res.stats || {};
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setVal('empCommTotalParcels', st.totalParcels || 0);
        setVal('empCommProcessing', st.processingCount || 0);
        setVal('empCommDelivered', st.deliveredCount || 0);
        setVal('empCommPartial', st.partialCount || 0);
        setVal('empCommCancelled', st.cancelledCount || 0);
        setVal('empCommPaidAmount', `৳ ${st.paidCommission || 0}`);
        setVal('empCommUnpaidAmount', `৳ ${st.unpaidCommission || 0}`);

        if (res.items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:24px;">কোনো আপসেল পার্সেল রেকর্ড পাওয়া যায়নি।</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        res.items.forEach(item => {
          const tr = document.createElement('tr');
          const isPaid = item.payoutStatus === 'Paid';
          const isPartial = item.deliveryStatus === 'Partial';

          // Delivery status select or locked badge
          let deliveryCellHtml = '';
          if (isPaid) {
            let label = 'প্রসেসিং';
            let badgeClass = 'badge-processing';
            if (item.deliveryStatus === 'Delivered') { label = 'ডেলিভার্ড'; badgeClass = 'badge-delivered'; }
            else if (item.deliveryStatus === 'Partial') { label = 'পার্শিয়াল ডেলিভারি'; badgeClass = 'badge-partial'; }
            else if (item.deliveryStatus === 'Cancelled') { label = 'ক্যানসেলড'; badgeClass = 'badge-cancelled'; }

            deliveryCellHtml = `
              <span class="badge-status ${badgeClass}">${label}</span>
              <span class="text-muted" style="display:block; font-size:0.75rem; margin-top:2px;" title="কমিশন পরিশোধ হয়ে যাওয়ায় এটি লকড রয়েছে">🔒 লকড</span>
            `;
          } else {
            deliveryCellHtml = `
              <select class="status-dropdown" onchange="window.lfpApp.onEmpChangeCommissionStatus('${item.commissionId}', this.value)">
                <option value="Processing" ${item.deliveryStatus === 'Processing' ? 'selected' : ''}>🚚 প্রসেসিং (Processing)</option>
                <option value="Delivered" ${item.deliveryStatus === 'Delivered' ? 'selected' : ''}>✅ ডেলিভার্ড (Delivered)</option>
                <option value="Partial" ${item.deliveryStatus === 'Partial' ? 'selected' : ''}>⚠️ পার্শিয়াল ডেলিভারি (Partial)</option>
                <option value="Cancelled" ${item.deliveryStatus === 'Cancelled' ? 'selected' : ''}>❌ ক্যানসেলড (Cancelled)</option>
              </select>
            `;
          }

          // Partial amount cell
          let partialCellHtml = '-';
          if (isPartial) {
            if (isPaid) {
              partialCellHtml = `<span class="partial-amt-pill">৳ ${item.partialAmount || 0}</span>`;
            } else {
              partialCellHtml = `
                <span class="partial-amt-pill" style="cursor:pointer;" title="টাকা এডিট করতে ক্লিক করুন" onclick="window.lfpApp.promptEditPartialAmount('${item.commissionId}', ${item.partialAmount || 0})">
                  ৳ ${item.partialAmount || 0} ✏️
                </span>
              `;
            }
          }

          // Payout Status badge
          const payoutHtml = isPaid
            ? `<span class="badge-status badge-paid" title="পরিশোধের তারিখ: ${item.payoutDate || ''}">🔒 পরিশোধিত (Paid)</span>`
            : `<span class="badge-status badge-unpaid">⏳ বকেয়া (Unpaid)</span>`;

          tr.innerHTML = `
            <td><strong>${item.date}</strong></td>
            <td><strong>${item.customerPhone || '-'}</strong></td>
            <td>${item.productDetails || 'আপসেল পণ্য'}<br><small class="text-muted">${item.notes || ''}</small></td>
            <td>${item.pieces || 1} পিস</td>
            <td><strong class="text-primary">৳ ${item.commissionAmount || 0}</strong></td>
            <td>${deliveryCellHtml}</td>
            <td>${partialCellHtml}</td>
            <td>${payoutHtml}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger" style="padding:20px;">লোড করতে ত্রুটি: ${e.message}</td></tr>`;
    }
  }

  /* Employee updates status of a parcel */
  async onEmpChangeCommissionStatus(commissionId, newStatus) {
    let partialAmount = 0;
    if (newStatus === 'Partial') {
      const inputVal = prompt('এই পার্সেলে কত টাকা পার্শিয়াল ডেলিভারি / কালেকশন হয়েছে? (টাকার অংক লিখুন):', '300');
      if (inputVal === null) {
        await this.loadEmployeeCommissions();
        return;
      }
      partialAmount = Number(inputVal) || 0;
    }

    try {
      const res = await window.lfpApi.request('updateCommissionStatus', {
        commissionId,
        deliveryStatus: newStatus,
        partialAmount,
        userRole: 'employee'
      });

      if (res.success) {
        await this.loadEmployeeCommissions();
      } else {
        alert(res.message || 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে!');
        await this.loadEmployeeCommissions();
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
      await this.loadEmployeeCommissions();
    }
  }

  async promptEditPartialAmount(commissionId, currentAmt) {
    const inputVal = prompt('পার্শিয়াল কালেকশনের নতুন টাকার অংক লিখুন:', String(currentAmt || 0));
    if (inputVal === null) return;
    const partialAmount = Number(inputVal) || 0;

    try {
      const res = await window.lfpApi.request('updateCommissionStatus', {
        commissionId,
        deliveryStatus: 'Partial',
        partialAmount,
        userRole: 'employee'
      });
      if (res.success) {
        await this.loadEmployeeCommissions();
      } else {
        alert(res.message);
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
    }
  }

  /* Modal to Add a new Upsell Commission parcel directly */
  openAddCommissionModal() {
    const modal = document.getElementById('modalAddCommission');
    if (!modal) return;
    document.getElementById('modalCommId').value = '';
    document.getElementById('modalCommDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalCommPhone').value = '';
    document.getElementById('modalCommProduct').value = '';
    document.getElementById('modalCommPieces').value = 1;
    document.getElementById('modalCommAmount').value = '';
    document.getElementById('modalCommDeliveryStatus').value = 'Processing';
    document.getElementById('modalCommPartialAmount').value = '';
    document.getElementById('modalCommNotes').value = '';
    document.getElementById('modalCommPartialWrap').style.display = 'none';
    modal.classList.add('active');
  }

  onModalCommStatusChange(status) {
    const wrap = document.getElementById('modalCommPartialWrap');
    if (wrap) {
      wrap.style.display = (status === 'Partial') ? 'block' : 'none';
    }
  }

  async saveNewCommissionParcel() {
    const phone = document.getElementById('modalCommPhone').value.trim();
    if (!phone) {
      alert('অনুগ্রহ করে কাস্টমারের ফোন নাম্বার প্রদান করুন।');
      return;
    }

    const commId = document.getElementById('modalCommId').value.trim();
    const date = document.getElementById('modalCommDate').value;
    const product = document.getElementById('modalCommProduct').value.trim() || 'আপসেল পণ্য';
    const pieces = Number(document.getElementById('modalCommPieces').value) || 1;
    const commissionAmount = Number(document.getElementById('modalCommAmount').value) || 0;
    const deliveryStatus = document.getElementById('modalCommDeliveryStatus').value;
    const partialAmount = Number(document.getElementById('modalCommPartialAmount').value) || 0;
    const notes = document.getElementById('modalCommNotes').value.trim();

    const parcel = {
      commissionId: commId,
      date,
      employeeId: this.currentUser.employeeId,
      employeeName: this.currentUser.name,
      customerPhone: phone,
      productDetails: product,
      pieces,
      commissionAmount,
      deliveryStatus,
      partialAmount,
      notes
    };

    const btn = document.getElementById('btnSaveCommModal');
    if (btn) { btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...'; }

    try {
      const res = await window.lfpApi.request('saveCommissionParcel', {
        commission: parcel,
        userRole: this.currentUser.role
      });

      if (res.success) {
        document.getElementById('modalAddCommission').classList.remove('active');
        if (this.currentUser.role === 'admin') {
          await this.loadAdminCommissions();
        } else {
          await this.loadEmployeeCommissions();
        }
      } else {
        alert(res.message || 'সংরক্ষণ করতে সমস্যা হয়েছে!');
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; }
    }
  }

  /* 2. ADMIN COMMISSIONS & SETTLEMENT MANAGER */
  async loadAdminCommissions() {
    const tbody = document.getElementById('adminCommTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding:20px;">লোড হচ্ছে...</td></tr>';

    const empSelect = document.getElementById('adminCommEmpSelect');
    if (empSelect && empSelect.options.length <= 1) {
      try {
        const empRes = await window.lfpApi.request('getEmployees');
        if (empRes.success && empRes.employees) {
          empSelect.innerHTML = '<option value="all">সকল সহকর্মী</option>';
          empRes.employees.forEach(e => {
            empSelect.innerHTML += `<option value="${e.employeeId}">${e.name} (${e.employeeId})</option>`;
          });
        }
      } catch (err) {}
    }

    const employeeId = empSelect?.value || 'all';
    const month = document.getElementById('adminCommMonthFilter')?.value || '';
    const deliveryStatus = document.getElementById('adminCommStatusFilter')?.value || 'all';
    const payoutStatus = document.getElementById('adminCommPayoutFilter')?.value || 'all';
    const search = document.getElementById('adminCommSearchInput')?.value.trim() || '';

    try {
      const res = await window.lfpApi.request('getCommissions', {
        employeeId,
        month,
        deliveryStatus,
        payoutStatus,
        search
      });

      if (res.success && res.items) {
        const st = res.stats || {};
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setVal('adminCommTotalParcels', st.totalParcels || 0);
        setVal('adminCommProcessing', st.processingCount || 0);
        setVal('adminCommDelivered', st.deliveredCount || 0);
        setVal('adminCommPartial', st.partialCount || 0);
        setVal('adminCommCancelled', st.cancelledCount || 0);
        setVal('adminCommTotalPaid', `৳ ${st.paidCommission || 0}`);
        setVal('adminCommTotalUnpaid', `৳ ${st.unpaidCommission || 0}`);

        if (res.items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted" style="padding:24px;">কোনো পার্সেল বা কমিশন রেকর্ড পাওয়া যায়নি।</td></tr>';
          return;
        }

        const masterCb = document.getElementById('adminCommSelectAll');
        if (masterCb) masterCb.checked = false;
        this.adminCommSelectedIds.clear();

        tbody.innerHTML = '';
        res.items.forEach(item => {
          const tr = document.createElement('tr');
          const isPaid = item.payoutStatus === 'Paid';
          const isPartial = item.deliveryStatus === 'Partial';

          let deliveryLabel = 'প্রসেসিং';
          let badgeClass = 'badge-processing';
          if (item.deliveryStatus === 'Delivered') { deliveryLabel = 'ডেলিভার্ড'; badgeClass = 'badge-delivered'; }
          else if (item.deliveryStatus === 'Partial') { deliveryLabel = 'পার্শিয়াল ডেলিভারি'; badgeClass = 'badge-partial'; }
          else if (item.deliveryStatus === 'Cancelled') { deliveryLabel = 'ক্যানসেলড'; badgeClass = 'badge-cancelled'; }

          const partialHtml = isPartial ? `<span class="partial-amt-pill">৳ ${item.partialAmount || 0}</span>` : '-';

          let actionHtml = '';
          if (isPaid) {
            actionHtml = `
              <span class="badge-status badge-paid" title="পরিশোধ: ${item.payoutDate || ''}">✅ পরিশোধিত</span>
              <button type="button" class="btn btn-sm btn-outline text-muted" style="padding:2px 6px; font-size:0.75rem; margin-top:3px;" onclick="window.lfpApp.setCommissionPayoutSingle('${item.commissionId}', 'Unpaid')">
                ↩️ বকেয়া করুন
              </button>
            `;
          } else {
            actionHtml = `
              <button type="button" class="btn btn-sm btn-success" style="font-weight:700;" onclick="window.lfpApp.setCommissionPayoutSingle('${item.commissionId}', 'Paid')">
                💸 পেইড মার্ক করুন
              </button>
            `;
          }

          tr.innerHTML = `
            <td class="text-center">
              <input type="checkbox" class="admin-comm-cb" data-comm-id="${item.commissionId}" ${isPaid ? 'disabled' : ''} />
            </td>
            <td><strong>${item.date}</strong></td>
            <td><strong>${item.employeeName}</strong><br><small class="text-muted">${item.employeeId}</small></td>
            <td><strong>${item.customerPhone || '-'}</strong></td>
            <td>${item.productDetails || 'আপসেল পণ্য'}<br><small class="text-muted">${item.notes || ''}</small></td>
            <td>${item.pieces || 1} পিস</td>
            <td><strong class="text-primary font-bold">৳ ${item.commissionAmount || 0}</strong></td>
            <td><span class="badge-status ${badgeClass}">${deliveryLabel}</span></td>
            <td>${partialHtml}</td>
            <td>${actionHtml}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger" style="padding:20px;">লোড করতে ত্রুটি: ${e.message}</td></tr>`;
    }
  }

  toggleAdminCommSelectAll(masterCb) {
    const cbs = document.querySelectorAll('#adminCommTableBody .admin-comm-cb:not(:disabled)');
    cbs.forEach(cb => {
      cb.checked = masterCb.checked;
    });
  }

  async setCommissionPayoutSingle(commissionId, targetStatus) {
    const isPaid = (targetStatus === 'Paid');
    const confirmMsg = isPaid 
      ? 'আপনি কি এই পার্সেলের কমিশন সফলভাবে পরিশোধ করা হয়েছে (Paid) মর্মে নিশ্চিত করতে চান?\n\n(পেইড করার পর সংশ্লিষ্ট কর্মী এই পার্সেলের তথ্য আর পরিবর্তন করতে পারবে না)'
      : 'আপনি কি এই পার্সেলটি পুনরায় বকেয়া (Unpaid) করতে চান?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await window.lfpApi.request('payoutCommission', {
        commissionIds: [commissionId],
        payoutStatus: targetStatus,
        adminName: this.currentUser.name
      });

      if (res.success) {
        await this.loadAdminCommissions();
      } else {
        alert(res.message || 'ব্যর্থ হয়েছে!');
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
    }
  }

  async adminBulkPayoutSelected() {
    const checkedBoxes = document.querySelectorAll('#adminCommTableBody .admin-comm-cb:checked');
    if (checkedBoxes.length === 0) {
      alert('অনুগ্রহ করে যে পার্সেলগুলোর কমিশন পরিশোধ করতে চান সেগুলোর বক্স সিলেক্ট করুন।');
      return;
    }

    const selectedIds = [];
    checkedBoxes.forEach(cb => {
      selectedIds.push(cb.dataset.commId);
    });

    if (!confirm(`আপনি কি নির্বাচিত ${selectedIds.length}টি পার্সেলের কমিশন পরিশোধিত (Paid) মার্ক করতে চান?\n\nপেইড করার পর কর্মীরা এগুলোর স্ট্যাটাস আর এডিট করতে পারবে না।`)) {
      return;
    }

    const btn = document.getElementById('btnAdminBulkPayout');
    if (btn) { btn.disabled = true; btn.textContent = 'প্রসেসিং হচ্ছে...'; }

    try {
      const res = await window.lfpApi.request('payoutCommission', {
        commissionIds: selectedIds,
        payoutStatus: 'Paid',
        adminName: this.currentUser.name
      });

      if (res.success) {
        alert(res.message || 'কমিশন সফলভাবে পরিশোধিত হিসেবে চিহ্নিত করা হয়েছে!');
        await this.loadAdminCommissions();
      } else {
        alert(res.message || 'ব্যর্থ হয়েছে!');
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💸 নির্বাচিত পার্সেলগুলো পেইড মার্ক করুন'; }
    }
  }

  /* =========================================================================
     ADMIN SCHEDULE MANAGER (Custom tasks per employee)
     ========================================================================= */
  async loadScheduleManager() {
    const empSelect = document.getElementById('schedTargetEmployee');
    if (!empSelect) return;
    empSelect.innerHTML = '<option value="">সহকর্মী লোড হচ্ছে...</option>';

    try {
      const res = await window.lfpApi.request('getEmployees');
      if (res.success && res.employees && res.employees.length > 0) {
        empSelect.innerHTML = '';
        res.employees.forEach(emp => {
          empSelect.innerHTML += `<option value="${emp.employeeId}">${emp.name} (${emp.employeeId})</option>`;
        });

        const targetId = empSelect.value || res.employees[0].employeeId;
        empSelect.value = targetId;
        await this.loadEmployeeScheduleForEditing(targetId);
      } else {
        empSelect.innerHTML = '<option value="">(কোনো সহকর্মী পাওয়া যায়নি)</option>';
        this.editorScheduleList = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
        this.renderScheduleEditorItems();
      }
    } catch (e) {
      console.warn('loadScheduleManager fallback:', e);
      empSelect.innerHTML = '<option value="">ডিফল্ট শিডিউল</option>';
      this.editorScheduleList = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
      this.renderScheduleEditorItems();
    }
  }

  async loadEmployeeScheduleForEditing(empId) {
    const container = document.getElementById('schedEditorList');
    if (!container) return;
    container.innerHTML = '<p class="text-center text-muted" style="padding: 24px;">শিডিউল লোড হচ্ছে...</p>';

    try {
      const res = await window.lfpApi.request('getSchedule', { employeeId: empId });
      if (res.success && res.found && Array.isArray(res.schedule) && res.schedule.length > 0) {
        this.editorScheduleList = JSON.parse(JSON.stringify(res.schedule));
      } else {
        this.editorScheduleList = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
      }
    } catch (err) {
      console.warn('getSchedule failed, using default:', err);
      this.editorScheduleList = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
    }

    this.renderScheduleEditorItems();
  }

  renderScheduleEditorItems() {
    const container = document.getElementById('schedEditorList');
    container.innerHTML = '';

    if (this.editorScheduleList.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">কোনো কাজের ধাপ নেই। নিচের বাটনে চাপ দিয়ে যোগ করুন।</p>';
      return;
    }

    this.editorScheduleList.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `sched-manager-card ${item.isBreak ? 'is-break' : ''}`;
      card.innerHTML = `
        <span class="font-bold" style="color:var(--gray); width:24px;">#${index + 1}</span>
        <div style="width:160px;">
          <input type="text" class="form-control form-control-sm sched-time-input font-bold" data-idx="${index}" value="${item.time || ''}" placeholder="সময় (যেমন: ১০:০০ – ১১:০০)" />
        </div>
        <div style="flex:1;">
          <textarea class="form-control form-control-sm sched-task-input" rows="2" data-idx="${index}" placeholder="কাজের বিবরণ...">${item.task || ''}</textarea>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" class="sched-break-check" data-idx="${index}" ${item.isBreak ? 'checked' : ''} />
            <span>বিরতি (Break)</span>
          </label>
        </div>
        <div style="display:flex; gap:4px;">
          <button type="button" class="btn btn-sm btn-outline" onclick="window.lfpApp.moveScheduleEditorRow(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="উপরে নিন">⬆️</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="window.lfpApp.moveScheduleEditorRow(${index}, 1)" ${index === this.editorScheduleList.length - 1 ? 'disabled' : ''} title="নিচে নিন">⬇️</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="window.lfpApp.deleteScheduleEditorRow(${index})" title="মুছে ফেলুন">🗑️</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Bind inputs to array
    container.querySelectorAll('.sched-time-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.idx);
        this.editorScheduleList[idx].time = e.target.value;
      });
    });
    container.querySelectorAll('.sched-task-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.idx);
        this.editorScheduleList[idx].task = e.target.value;
      });
    });
    container.querySelectorAll('.sched-break-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.idx);
        this.editorScheduleList[idx].isBreak = e.target.checked;
        const card = e.target.closest('.sched-manager-card');
        card.classList.toggle('is-break', e.target.checked);
      });
    });
  }

  addScheduleEditorRow() {
    this.editorScheduleList.push({
      id: Date.now(),
      time: 'সময় নির্ধারণ করুন',
      task: 'নতুন কাজের করণীয় ও লক্ষ্য...',
      isBreak: false
    });
    this.renderScheduleEditorItems();
  }

  deleteScheduleEditorRow(index) {
    this.editorScheduleList.splice(index, 1);
    this.renderScheduleEditorItems();
  }

  moveScheduleEditorRow(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.editorScheduleList.length) return;
    const temp = this.editorScheduleList[index];
    this.editorScheduleList[index] = this.editorScheduleList[targetIdx];
    this.editorScheduleList[targetIdx] = temp;
    this.renderScheduleEditorItems();
  }

  resetScheduleEditorToDefault() {
    if (confirm('আপনি কি এই কর্মীর শিডিউল ডিফল্ট ১৩টি কাজের রুটিনে রিসেট করতে চান?')) {
      this.editorScheduleList = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
      this.renderScheduleEditorItems();
    }
  }

  async saveCustomSchedule() {
    const empSelect = document.getElementById('schedTargetEmployee');
    const empId = empSelect ? empSelect.value : null;
    if (!empId) {
      alert('দয়া করে প্রথমে সহকর্মী নির্বাচন করুন।');
      return;
    }

    const saveBtn = document.getElementById('btnSaveSchedule');
    const origText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'সংরক্ষণ হচ্ছে...';
    }

    try {
      const res = await window.lfpApi.request('saveSchedule', {
        employeeId: empId,
        schedule: this.editorScheduleList
      });

      if (res.success) {
        alert('অভিনন্দন! নির্বাচিত সহকর্মীর কাজের সময়সূচি সফলভাবে গুগল শিটে সংরক্ষিত হয়েছে। এই কর্মী তার পোর্টালে এই পরিবর্তিত কাজগুলো দেখতে পাবে।');
      } else {
        alert('সংরক্ষণ ব্যর্থ: ' + res.message);
      }
    } catch (err) {
      alert('সংরক্ষণ ত্রুটি: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = origText;
      }
    }
  }

  /* Settings */
  loadAdminSettings() {
    document.getElementById('setCompanyName').value = this.settings.company_name;
    document.getElementById('setTagline').value = this.settings.company_tagline;
    document.getElementById('setOfficeHours').value = this.settings.office_hours;
    document.getElementById('setPrimaryColor').value = this.settings.primary_color || '#007A3D';
    document.getElementById('setSecondaryColor').value = this.settings.secondary_color || '#2e7d32';

    const logoPreview = document.getElementById('setLogoPreview');
    if (logoPreview) {
      logoPreview.src = this.settings.company_logo || 'images/logo.svg';
    }

    const cfg = window.lfpApi.getConfig();
    document.getElementById('setGasUrl').value = cfg.gasUrl;
    document.getElementById('setUseProxy').checked = cfg.useProxy;
    this.updateDbLiveStatus();
  }

  async updateDbLiveStatus() {
    const badge = document.getElementById('dbLiveStatusBadge');
    if (!badge) return;
    try {
      const res = await fetch('api.php?action=getConfig&t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        const db = data.db || {};
        if (db.connected) {
          const drvName = db.driver === 'mysql' ? 'MySQL / MariaDB' : 'SQLite (Local)';
          const pending = db.pendingSync || 0;
          badge.style.background = '#dcfce7';
          badge.style.color = '#166534';
          badge.innerHTML = `⚡ লোকাল ডেটাবেস: সক্রিয় (${drvName}) | 🔄 শিট কিউ: ${pending} টি`;
        } else {
          badge.style.background = '#fee2e2';
          badge.style.color = '#991b1b';
          badge.innerHTML = '⚠️ লোকাল ডেটাবেস অফলাইন (সরাসরি গুগল শিট সক্রিয়)';
        }
      }
    } catch (e) {
      badge.textContent = '⚡ লোকাল ডেটাবেস সক্রিয়';
    }
  }

  async triggerSyncNow() {
    const btn = document.getElementById('btnSyncNow');
    const statusEl = document.getElementById('syncActionStatus');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerHTML = '<span class="text-primary">⏳ গুগল শিটের সাথে সিঙ্ক হচ্ছে...</span>';

    try {
      const res = await fetch('sync.php?action=processQueue&limit=50&t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        if (statusEl) statusEl.innerHTML = `<span class="text-success">✅ ${data.message}</span>`;
        alert(data.message);
      } else {
        if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ${data.message}</span>`;
        alert('সিঙ্ক ব্যর্থ: ' + data.message);
      }
      await this.updateDbLiveStatus();
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ত্রুটি: ${e.message}</span>`;
      alert('ত্রুটি: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async pullAllFromGoogle() {
    if (!confirm('আপনি কি গুগল শিট থেকে সমস্ত কর্মীর তালিকা, রিপোর্ট ও কমিশন হিস্ট্রি লোকাল ডেটাবেসে ইম্পোর্ট ও সিঙ্ক করতে চান?')) {
      return;
    }
    const btn = document.getElementById('btnPullFromGoogle');
    const statusEl = document.getElementById('syncActionStatus');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerHTML = '<span class="text-primary">⏳ গুগল শিট থেকে সকল তথ্য ইম্পোর্ট হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>';

    try {
      const res = await fetch('sync.php?action=pullFromGoogle&t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        const stats = data.stats || {};
        let statMsg = `\n• কর্মী: ${stats.users || 0} জন\n• কমিশন পার্সেল: ${stats.commissions || 0} টি\n• হাজিরা: ${stats.attendance || 0} টি\n• সেটিংস: সম্পন্ন`;
        if (statusEl) statusEl.innerHTML = `<span class="text-success">✅ ইম্পোর্ট ও সিঙ্ক সফল!</span>`;
        alert(data.message + statMsg);
        await this.updateDbLiveStatus();
      } else {
        if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ${data.message}</span>`;
        alert('ইম্পোর্ট ব্যর্থ: ' + data.message);
      }
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ত্রুটি: ${e.message}</span>`;
      alert('ত্রুটি: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async checkGithubUpdate() {
    const btn = document.getElementById('btnCheckGithubUpdate');
    const applyBtn = document.getElementById('btnApplyGithubUpdate');
    const statusEl = document.getElementById('githubUpdateStatus');
    const badge = document.getElementById('githubVersionBadge');

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerHTML = '<span class="text-primary">⏳ গিটহাব এপিআই থেকে নতুন ভার্সন চেক করা হচ্ছে...</span>';

    try {
      const res = await fetch('deploy.php?action=checkUpdate&t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        if (data.hasUpdate) {
          if (badge) {
            badge.style.background = '#fef08a';
            badge.style.color = '#854d0e';
            badge.textContent = `🚀 নতুন আপডেট: ${data.latestCommit}`;
          }
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-success font-bold">✨ নতুন আপডেট উপলব্ধ: "${data.commitMessage || data.latestCommit}" (${data.latestCommit})</span>`;
          }
          if (applyBtn) applyBtn.style.display = 'inline-flex';
        } else {
          if (badge) {
            badge.style.background = '#dcfce7';
            badge.style.color = '#166534';
            badge.textContent = `✅ আপ-টু-ডেট (${data.latestCommit || 'v3.5'})`;
          }
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-success">✅ আপনার সিস্টেম সম্পূর্ণ আপ-টু-ডেট আছে!</span>`;
          }
          if (applyBtn) applyBtn.style.display = 'none';
        }
      } else {
        if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ${data.message}</span>`;
      }
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ চেক ব্যর্থ: ${e.message}</span>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async applyGithubUpdate() {
    if (!confirm('আপনি কি নিশ্চিত যে গিটহাব থেকে সর্বশেষ কোড ডাউনলোড করে এই সাইটে লাইভ ইনস্টল করতে চান?')) {
      return;
    }
    const applyBtn = document.getElementById('btnApplyGithubUpdate');
    const statusEl = document.getElementById('githubUpdateStatus');
    if (applyBtn) applyBtn.disabled = true;
    if (statusEl) statusEl.innerHTML = '<span class="text-primary">⬇️ গিটহাব থেকে ফাইল ডাউনলোড ও আপডেট হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন...</span>';

    try {
      const res = await fetch('deploy.php?action=applyUpdateApi&token=lfp_github_deploy_2026&t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'আপডেট সফলভাবে ইনস্টল হয়েছে!');
        window.location.reload();
      } else {
        alert('আপডেট ব্যর্থ: ' + (data.message || 'ত্রুটি'));
        if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ${data.message}</span>`;
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
      if (statusEl) statusEl.innerHTML = `<span class="text-danger">❌ ত্রুটি: ${e.message}</span>`;
    } finally {
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  async runDeduplication() {
    if (!confirm('আপনি কি গুগল শিটের সমস্ত ডুপ্লিকেট এন্ট্রি মুছে সম্পূর্ণ পরিচ্ছন্ন করতে চান? (প্রতিদিনের রিপোর্টের সর্বশেষ ও নির্ভুল কপিটি অক্ষত থাকবে)')) {
      return;
    }
    const btn = document.getElementById('btnRunDeduplication');
    const origText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🧹 ডুপ্লিকেট পরিষ্কার হচ্ছে...';
    }

    try {
      const res = await window.lfpApi.request('deduplicate');
      if (res.success) {
        let msg = res.message;
        if (res.details && res.details.length > 0) {
          msg += '\n\nপরিষ্কারকৃত শিটের বিবরণ:\n• ' + res.details.join('\n• ');
        }
        alert(msg);

        // Auto-refresh whichever admin view is currently active
        if (this.currentAdminTab === 'attendance') {
          await this.loadAdminAttendance();
        } else if (this.currentAdminTab === 'reports') {
          await this.loadAdminReports();
        } else if (this.currentAdminTab === 'dashboard') {
          await this.loadAdminDashboard();
        }
      } else {
        alert('ডুপ্লিকেট পরিষ্কার করতে সমস্যা হয়েছে: ' + (res.message || 'ত্রুটি'));
      }
    } catch (e) {
      alert('ত্রুটি: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }
  }

  async uploadBusinessLogo() {
    const fileInput = document.getElementById('inputLogoFile');
    const statusEl = document.getElementById('logoUploadStatus');
    const btn = document.getElementById('btnUploadLogo');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('অনুগ্রহ করে প্রথমে আপনার ডিভাইস থেকে একটি লোগো ছবি সিলেক্ট করুন।');
      return;
    }

    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert('ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট (5MB) হতে পারবে।');
      return;
    }

    statusEl.innerHTML = '<span class="text-primary">☁️ ছবিটি গুগল ড্রাইভে আপলোড হচ্ছে, অপেক্ষা করুন...</span>';
    btn.disabled = true;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      try {
        const res = await window.lfpApi.request('uploadLogo', {
          fileData: base64Data,
          fileName: file.name
        });

        if (res.success && res.logoUrl) {
          this.settings.company_logo = res.logoUrl;
          this.applyBranding();
          const logoPreview = document.getElementById('setLogoPreview');
          if (logoPreview) logoPreview.src = res.logoUrl;

          statusEl.innerHTML = `<span class="text-success">✅ ${res.message}</span>`;
          alert('অভিনন্দন! আপনার প্রতিষ্ঠানের লোগো সফলভাবে গুগল ড্রাইভে সেভ হয়েছে এবং সব পেজে আপডেট হয়েছে।');
        } else {
          statusEl.innerHTML = `<span class="text-danger">❌ আপলোড ব্যর্থ: ${res.message || 'অজানা ত্রুটি'}</span>`;
          alert('আপলোড ত্রুটি: ' + res.message);
        }
      } catch (err) {
        statusEl.innerHTML = `<span class="text-danger">❌ ত্রুটি: ${err.message}</span>`;
        alert('ত্রুটি: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    };
    reader.readAsDataURL(file);
  }

  async resetLogoToDefault() {
    if (confirm('আপনি কি ডিফল্ট Life Free Pro লোগোতে ফিরে যেতে চান?')) {
      const defaultLogo = 'images/logo.svg';
      this.settings.company_logo = defaultLogo;
      await window.lfpApi.request('saveSettings', { settings: { company_logo: defaultLogo } });
      this.applyBranding();
      const logoPreview = document.getElementById('setLogoPreview');
      if (logoPreview) logoPreview.src = defaultLogo;
      document.getElementById('logoUploadStatus').innerHTML = '<span class="text-success">✅ ডিফল্ট লোগো সক্রিয় করা হয়েছে।</span>';
    }
  }

  async saveAdminSettings() {
    const newSettings = {
      ...this.settings,
      company_name: document.getElementById('setCompanyName').value.trim(),
      company_tagline: document.getElementById('setTagline').value.trim(),
      office_hours: document.getElementById('setOfficeHours').value.trim(),
      primary_color: document.getElementById('setPrimaryColor').value,
      secondary_color: document.getElementById('setSecondaryColor').value
    };

    const gasUrl = document.getElementById('setGasUrl').value.trim();
    const useProxy = document.getElementById('setUseProxy').checked;
    window.lfpApi.saveConfig(gasUrl, useProxy);

    const res = await window.lfpApi.request('saveSettings', { settings: newSettings });
    if (res.success) {
      this.settings = newSettings;
      this.applyBranding();
      this.updateConnectionBanner();
      alert('সেটিংস এবং গুগল শিট কনফিগারেশন সংরক্ষিত হয়েছে!');
    } else {
      alert('সংরক্ষণ ব্যর্থ হয়েছে: ' + res.message);
    }
  }

  bindEvents() {
    // Dynamic recalculations
    document.getElementById('commissionTableBody')?.addEventListener('input', () => this.calculateCommissionTotals());
    document.getElementById('advanceTableBody')?.addEventListener('input', () => this.calculateAdvanceTotals());
    document.getElementById('eodOtStart')?.addEventListener('input', () => this.calculateOvertime());
    document.getElementById('eodOtEnd')?.addEventListener('input', () => this.calculateOvertime());

    // REAL-TIME AUTO-SAVE LISTENERS (Save draft on any input change)
    document.getElementById('employeeReportSection')?.addEventListener('input', (e) => {
      this.triggerAutoSave();
    });
    document.getElementById('employeeReportSection')?.addEventListener('change', (e) => {
      this.triggerAutoSave();
    });

    // Add Commission Row (Unlimited rows)
    document.getElementById('btnAddCommRow')?.addEventListener('click', () => {
      this.addCommissionRow();
    });

    // Add Advance Row (Unlimited rows)
    document.getElementById('btnAddAdvRow')?.addEventListener('click', () => {
      this.addAdvanceRow();
    });

    // Manual Draft Save button
    document.getElementById('btnSaveDraftManual')?.addEventListener('click', () => {
      this.saveDraftManual();
    });

    // Final Submit Report
    document.getElementById('btnSubmitReport')?.addEventListener('click', () => {
      this.submitReport();
    });

    // Print Button
    document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

    // Employee Past History Date Picker
    document.getElementById('historyDateSelect')?.addEventListener('change', async (e) => {
      const date = e.target.value;
      if (date) {
        await this.initEmployeeForm(date, true);
      }
    });

    // Login Form Submit
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('loginIdentifier').value;
      const pass = document.getElementById('loginPassword').value;
      this.handleLogin(id, pass);
    });

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => this.handleLogout());

    // Admin Tabs Click
    document.querySelectorAll('#adminNavTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchAdminTab(btn.dataset.tab);
      });
    });

    // Schedule manager employee dropdown change
    document.getElementById('schedTargetEmployee')?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadEmployeeScheduleForEditing(e.target.value);
      }
    });

    // Logo file live preview on select
    document.getElementById('inputLogoFile')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const logoPreview = document.getElementById('setLogoPreview');
          if (logoPreview) logoPreview.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // Back to Admin button
    document.getElementById('btnBackToAdmin')?.addEventListener('click', () => this.backToAdminPanel());

    // Employee Navigation Tabs (Report Form vs Commission Tracker)
    document.querySelectorAll('#employeeNavTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchEmployeeTab(btn.dataset.empTab);
      });
    });

    // Employee Commission Filters & Search
    document.getElementById('empCommMonthFilter')?.addEventListener('change', () => this.loadEmployeeCommissions());
    document.getElementById('empCommStatusFilter')?.addEventListener('change', () => this.loadEmployeeCommissions());
    document.getElementById('empCommPayoutFilter')?.addEventListener('change', () => this.loadEmployeeCommissions());
    document.getElementById('empCommSearchInput')?.addEventListener('input', () => this.loadEmployeeCommissions());

    // Admin Commission Filters & Actions
    document.getElementById('adminCommEmpSelect')?.addEventListener('change', () => this.loadAdminCommissions());
    document.getElementById('adminCommMonthFilter')?.addEventListener('change', () => this.loadAdminCommissions());
    document.getElementById('adminCommStatusFilter')?.addEventListener('change', () => this.loadAdminCommissions());
    document.getElementById('adminCommPayoutFilter')?.addEventListener('change', () => this.loadAdminCommissions());
    document.getElementById('adminCommSearchInput')?.addEventListener('input', () => this.loadAdminCommissions());
    document.getElementById('adminCommSelectAll')?.addEventListener('change', (e) => this.toggleAdminCommSelectAll(e.target.checked));
    document.getElementById('btnAdminBulkPayout')?.addEventListener('click', () => this.adminBulkPayoutSelected());
  }
}

// Instantiate and start
window.addEventListener('DOMContentLoaded', () => {
  window.lfpApp = new LfpApp();
  window.lfpApp.init();
});

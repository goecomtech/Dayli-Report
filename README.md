# Life Free Pro - Daily Reporting & Employee Management System

A high-fidelity web application built to mirror the exact official **Daily Reporting Sheet** Word document format for **Life Free Pro**, backed by a real-time serverless Google Sheets database engine.

---

## Key Features

- **Pixel-Perfect Word Document Replication:**
  - Official brand typography, colors, and layout.
  - Daily Work Schedule (13 time slots with interactive status tracking).
  - All-Day Responsibilities (Courier Monitoring & Message Replies).
  - End-of-Day Report (Confirmed orders, cancellations, discounts, follow-ups, packaging, overtime).
  - Commission Sales & Customer Advance tables with live auto-calculating totals.
  - Digital signature pad and print/PDF-ready styling (`@media print`).

- **Employee Portal:**
  - Login via Phone / Email and Password.
  - Complete and submit daily reports.
  - Submission locking: reports become read-only once submitted.
  - Historical report viewer by date selection.

- **Admin Control Center:**
  - Analytics & Sales Metrics (KPI counters, Chart.js trends, conversion and cancellation ratios).
  - Employee Management (Add, edit, deactivate, or reset passwords).
  - Daily Report Inspector & Editor (Review and edit any employee's submitted report).
  - Attendance Ledger (Arrival/Departure time tracking, late minutes, overtime calculation).
  - Branding Customizer (Live edit company name, logo, colors, and working hours).
  - Google Sheet Connection Wizard & Diagnostics.

- **Google Sheets as Cloud Database:**
  - Powered by Google Apps Script (`Code.gs`) Web App.
  - Auto-initializes structured tabs (`Config`, `Users`, `Reports_Master`, `Attendance`, `Commissions_Log`, `Advances_Log`, and individual employee tabs `EMP_xxx`).
  - Zero database hosting or subscription fees.

---

## Directory Structure

```
├── index.html              # Main Application (Login, Employee Form, History, Admin Dashboard)
├── setup.html              # Google Sheets Connection Wizard & Admin Setup
├── Code.gs                 # Google Apps Script Web App source code
├── api.php                 # Optional PHP proxy bridge for shared cPanel hosting
├── css/
│   └── style.css           # Styling, Bengali fonts, and Print media rules
├── js/
│   ├── api.js              # Real-time API communication layer for Google Apps Script Web App
│   └── app.js              # Core application logic, event handlers & calculations
├── images/
│   └── logo.svg            # Life Free Pro official emblem and typography
├── SETUP_GUIDE_BN.md       # Complete step-by-step setup guide in Bengali
└── README.md               # English project documentation
```

---

## Quick Start

1. Upload all files into your subdomain directory (e.g. `public_html/report/`).
2. Create a new Google Sheet at [sheets.new](https://sheets.new).
3. Open **Extensions > Apps Script**, paste `Code.gs`, click **Deploy > New Deployment > Web app** (Execute as: Me, Access: Anyone).
4. Open `setup.html` in your browser, paste the Web App URL, and connect!

For full Bengali instructions, see [SETUP_GUIDE_BN.md](SETUP_GUIDE_BN.md).

/**
 * Life Free Pro - Real-Time API Communication Layer (js/api.js)
 * Connects exclusively and in real-time with Google Apps Script Web App
 * No demo mode, no fake mock data. 100% Live Database.
 */

const LFP_STORAGE_KEYS = {
  GAS_URL: 'lfp_gas_url',
  USE_PROXY: 'lfp_use_proxy',
  CURRENT_USER: 'lfp_current_user',
  SETTINGS: 'lfp_settings'
};

const DefaultSettings = {
  company_name: 'Life Free Pro',
  company_tagline: 'Revive Your Body, Refresh Your Life',
  office_hours: 'সকাল ১০:০০ – রাত ৮:০০',
  company_logo: 'images/logo.svg',
  primary_color: '#007A3D',
  secondary_color: '#2e7d32',
  currency: '৳',
  admin_phone: '',
  admin_email: ''
};

class LfpApi {
  constructor() {
    this.gasUrl = localStorage.getItem(LFP_STORAGE_KEYS.GAS_URL) || '';
    this.useProxy = localStorage.getItem(LFP_STORAGE_KEYS.USE_PROXY) === 'true';
    this._initPromise = null;
  }

  /**
   * Auto-fetch server-wide configuration from config.json or api.php
   * Ensures that ANY new device or employee phone connects instantly to Google Sheets!
   */
  async initConfig() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      // 1. Try reading config.json directly from web server
      try {
        const res = await fetch('config.json?t=' + Date.now());
        if (res.ok) {
          const cfg = await res.json();
          if (cfg && cfg.googleWebAppUrl && cfg.googleWebAppUrl.trim().length > 15) {
            this.gasUrl = cfg.googleWebAppUrl.trim();
            this.useProxy = cfg.useProxy !== undefined ? Boolean(cfg.useProxy) : true;
            localStorage.setItem(LFP_STORAGE_KEYS.GAS_URL, this.gasUrl);
            localStorage.setItem(LFP_STORAGE_KEYS.USE_PROXY, this.useProxy ? 'true' : 'false');
            return true;
          }
        }
      } catch (e) {
        // Fallback to api.php
      }

      // 2. Try fetching from api.php?action=getConfig
      try {
        const pRes = await fetch('api.php?action=getConfig&t=' + Date.now());
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData && pData.configured && pData.gasUrl) {
            this.gasUrl = pData.gasUrl.trim();
            this.useProxy = Boolean(pData.useProxy);
            this.dbInfo = pData.db || null;
            localStorage.setItem(LFP_STORAGE_KEYS.GAS_URL, this.gasUrl);
            localStorage.setItem(LFP_STORAGE_KEYS.USE_PROXY, this.useProxy ? 'true' : 'false');
            return true;
          }
        }
      } catch (e) {
        // Fallback to existing localStorage if any
      }

      return this.isConfigured();
    })();

    return this._initPromise;
  }

  isConfigured() {
    return Boolean(this.gasUrl && this.gasUrl.trim().length > 15);
  }

  async saveConfig(url, useProxy = true, dbConfig = null) {
    this.gasUrl = (url || '').trim();
    this.useProxy = Boolean(useProxy);
    localStorage.setItem(LFP_STORAGE_KEYS.GAS_URL, this.gasUrl);
    localStorage.setItem(LFP_STORAGE_KEYS.USE_PROXY, this.useProxy ? 'true' : 'false');

    // Also persist to server's config.json via api.php so ALL devices get it automatically!
    try {
      const payload = {
        action: 'saveProxyConfig',
        googleWebAppUrl: this.gasUrl,
        useProxy: this.useProxy,
        useLocalDb: true
      };
      if (dbConfig) {
        payload.db = dbConfig;
      }
      await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Could not save config to server:', e);
    }
  }

  getConfig() {
    return {
      gasUrl: this.gasUrl,
      useProxy: this.useProxy,
      isConfigured: this.isConfigured()
    };
  }

  /**
   * Request dispatcher: Sends real request to Google Apps Script Web App
   * Includes automatic self-healing fallback between PHP Proxy and Direct Google Fetch
   */
  async request(action, params = {}) {
    const payload = { action, ...params };

    if (!this.isConfigured()) {
      await this.initConfig();
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        notConfigured: true,
        message: 'গুগল শিট কানেক্ট করা নেই। অনুগ্রহ করে প্রথমে সেটআপ সম্পন্ন করুন।'
      };
    }

    // Try configured method first
    let result = await this.executeFetch(payload, this.useProxy);

    // If proxy failed with cURL error or HTTP/2 reset, automatically fallback to direct Google Sheets fetch
    if (this.useProxy && (!result.success && (result.curlError || (result.message && result.message.includes('cURL error'))))) {
      console.warn('Proxy cURL error detected, automatically falling back to direct Google Sheets connection...');
      const directResult = await this.executeFetch(payload, false);
      if (directResult.success) {
        // Auto-save direct mode for future requests
        this.saveConfig(this.gasUrl, false);
        return directResult;
      }
    } else if (!this.useProxy && (!result.success && result.networkError)) {
      // If direct fetch had network error, try proxy fallback
      console.warn('Direct connection failed, trying PHP proxy bridge...');
      const proxyResult = await this.executeFetch(payload, true);
      if (proxyResult.success) {
        this.saveConfig(this.gasUrl, true);
        return proxyResult;
      }
    }

    return result;
  }

  async executeFetch(payload, useProxy) {
    try {
      let endpoint = this.gasUrl;
      let fetchOptions = {};

      if (useProxy) {
        endpoint = `api.php?gasUrl=${encodeURIComponent(this.gasUrl)}`;
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        };
      } else {
        // Direct to Google Apps Script Web App
        // GAS Web App handles POST with text/plain to avoid preflight CORS blockage in browsers
        fetchOptions = {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        };
      }

      const res = await fetch(endpoint, fetchOptions);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return data;

    } catch (err) {
      return {
        success: false,
        networkError: true,
        message: `গুগল শিটের সাথে সংযোগে সমস্যা হয়েছে: ${err.message}`
      };
    }
  }

  // Auth session methods
  setCurrentUser(user) {
    localStorage.setItem(LFP_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  getCurrentUser() {
    try {
      const u = localStorage.getItem(LFP_STORAGE_KEYS.CURRENT_USER);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  logout() {
    localStorage.removeItem(LFP_STORAGE_KEYS.CURRENT_USER);
  }
}

// Global API instance
window.lfpApi = new LfpApi();

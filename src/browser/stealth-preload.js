'use strict';

/**
 * DT - 指纹浏览器: 深度抗爬虫检测与隐身注入脚本 (Stealth Preload)
 * 在所有网页主框架及子框架初始化时（Document Start）于 Main World 中优先执行，
 * 专门规避 Cloudflare Turnstile, Akamai Bot Manager, DataDome, Kasada, CreepJS 等顶级反爬系统检测。
 */

const { webFrame } = require('electron');

const stealthCode = `
(() => {
  try {
    // =========================================================================
    // 1. 深度隐藏与重构 navigator.webdriver 特征 (规避原型链检测)
    // =========================================================================
    try {
      if ('webdriver' in navigator || 'webdriver' in Navigator.prototype) {
        delete Navigator.prototype.webdriver;
      }
    } catch (_) {}

    try {
      const getter = function webdriver() {
        return undefined;
      };
      Object.defineProperty(getter, 'name', { value: 'get webdriver' });
      Object.defineProperty(getter, 'toString', {
        value: function toString() {
          return 'function get webdriver() { [native code] }';
        }
      });

      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: getter,
        set: () => {},
        enumerable: false,
        configurable: true
      });
    } catch (_) {}

    // =========================================================================
    // 2. 补齐原生 window.chrome 运行上下文 (包含 runtime, loadTimes, csi, app)
    // =========================================================================
    if (!window.chrome) {
      window.chrome = {};
    }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
        OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
        PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
        RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" }
      };
    }
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function loadTimes() {
        const now = Date.now() / 1000;
        return {
          requestTime: now - 0.4,
          startLoadTime: now - 0.35,
          commitLoadTime: now - 0.15,
          finishDocumentLoadTime: now - 0.05,
          finishLoadTime: now,
          firstPaintTime: now - 0.08,
          firstPaintAfterLoadTime: 0,
          navigationType: "Other",
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: "h2",
          wasAlternateProtocolAvailable: false,
          connectionInfo: "h2"
        };
      };
    }
    if (!window.chrome.csi) {
      window.chrome.csi = function csi() {
        return { startE: Date.now() - 50, onloadT: Date.now(), pageT: 50, tran: 15 };
      };
    }
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
        RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" }
      };
    }

    // =========================================================================
    // 3. 规避 Permissions API 对通知权限的无头探测
    // =========================================================================
    if (window.navigator && window.navigator.permissions && typeof window.navigator.permissions.query === 'function') {
      const origPermissionsQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
      window.navigator.permissions.query = function query(parameters) {
        if (parameters && parameters.name === 'notifications') {
          const state = (window.Notification && window.Notification.permission === 'denied')
            ? 'default'
            : (window.Notification?.permission || 'default');
          return Promise.resolve({
            state,
            name: 'notifications',
            onchange: null
          });
        }
        return origPermissionsQuery(parameters);
      };
    }

    // =========================================================================
    // 4. 模拟真实 Chrome 默认 Plugins 与 MimeTypes 列表
    // =========================================================================
    if (window.navigator && (!window.navigator.plugins || window.navigator.plugins.length === 0)) {
      const mockPlugins = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ];
      try {
        Object.defineProperty(navigator, 'plugins', {
          get: () => mockPlugins,
          enumerable: true,
          configurable: true
        });
      } catch (_) {}
    }

    // =========================================================================
    // 5. 抹除 Chromedriver / CDP 自动化驱动特征污染 (cdc_ 变量)
    // =========================================================================
    const cleanAutomationProps = () => {
      try {
        for (const prop of Object.getOwnPropertyNames(window)) {
          if (/^cdc_[a-z0-9]/i.test(prop) || /^__puppeteer/i.test(prop) || /^__playwright/i.test(prop)) {
            try { delete window[prop]; } catch (_) {}
          }
        }
      } catch (_) {}
    };
    cleanAutomationProps();
    window.addEventListener('DOMContentLoaded', cleanAutomationProps, { once: true });

  } catch (err) {
    // 保证静默安全，绝不阻断正常业务逻辑
  }
})();
`;

try {
  webFrame.executeJavaScript(stealthCode);
} catch (_) {}


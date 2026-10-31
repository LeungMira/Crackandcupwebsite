/**
 * CRACK & CUP — RAGE ROOM & COFFEE SHOP
 * 100% Server-Authoritative Menu & Pricing via Supabase PostgreSQL
 */

// 1. CONFIGURATION (Retrieved from Cloudflare Pages Functions `/api/*` or GitHub Actions `window.__CNC_CONFIG__` — NOT hardcoded!)
const SUPABASE_URL = ((window.__CNC_CONFIG__ && (window.__CNC_CONFIG__.SUPABASE_URL || window.__CNC_CONFIG__.supabaseUrl)) || '').trim();
const SUPABASE_PUBLISHABLE_KEY = ((window.__CNC_CONFIG__ && (
  window.__CNC_CONFIG__.SUPABASE_PUBLISHABLE_KEY ||
  window.__CNC_CONFIG__.SUPABASE_ANON_KEY ||
  window.__CNC_CONFIG__.SUPABASE_KEY ||
  window.__CNC_CONFIG__.supabaseKey
)) || '').trim();

// Menu is strictly obtained from the server (Zero hardcoded client fallback menu!)
let MENU_ITEMS = [];
let menuLoadState = 'loading'; // 'loading' | 'loaded' | 'error'
let isStoreOpen = true; // Controlled live by the Staff Handler App via Supabase (`system-store-closed`)

// 2. APPLICATION STATE
let orderRows = [];
let activeCategory = 'all';
let cardQuantities = {};
let cardSizes = {};
let orderReference = ''; // Referral Code is 100% server-generated upon order submission
let isManualMobilePreview = false;
let activeMobilePage = 'menu'; // 'menu' | 'order'

function initCardQuantities() {
  MENU_ITEMS.forEach(item => {
    if (!cardQuantities[item.id]) {
      cardQuantities[item.id] = 1;
    }
    if (!cardSizes[item.id]) {
      cardSizes[item.id] = 'Regular';
    }
  });
}

// 3. DOM ELEMENTS
const menuGrid = document.getElementById('menuGrid');
const menuSection = document.getElementById('menu-section');
const orderTableSection = document.getElementById('order-table-section');
const orderNowPromptBox = document.getElementById('orderNowPromptBox');
const quickItemSelect = document.getElementById('quickItemSelect');
const quickSizeSelect = document.getElementById('quickSizeSelect');
const builderQtyMinus = document.getElementById('builderQtyMinus');
const builderQtyPlus = document.getElementById('builderQtyPlus');
const builderQtyInput = document.getElementById('builderQtyInput');
const builderComputedAmount = document.getElementById('builderComputedAmount');
const addToTableBtn = document.getElementById('addToTableBtn');
const addBlankRowBtn = document.getElementById('addBlankRowBtn');
const tableFooterAddBtn = document.getElementById('tableFooterAddBtn');
const orderTableBody = document.getElementById('orderTableBody');
const summaryTotalQty = document.getElementById('summaryTotalQty');
const summaryTotalAmount = document.getElementById('summaryTotalAmount');
const headerCartCount = document.getElementById('headerCartCount');
const mobileOrderCountBadge = document.getElementById('mobileOrderCountBadge');
const orderRefCode = document.getElementById('orderRefCode');
const orderDateStamp = document.getElementById('orderDateStamp');
const orderConfirmationCard = document.getElementById('orderConfirmationCard');
const confirmedOrderRef = document.getElementById('confirmedOrderRef');
const copyReferralIdBtn = document.getElementById('copyReferralIdBtn');

// Mobile Corner Buttons & Logo Loader (Matches User's Bare-Bones Mobile UI Sketch)
const mobileLogoLoader = document.getElementById('mobileLogoLoader');
const mobileCornerMenuBtn = document.getElementById('mobileCornerMenuBtn');
const mobileCornerOrderBtn = document.getElementById('mobileCornerOrderBtn');
const exitMobilePreviewBtn = document.getElementById('exitMobilePreviewBtn');
let hasShownMobileSplash = false;
let mobileLoaderTimer = null;

function triggerMobileLogoLoader() {
  if (!mobileLogoLoader) return;
  clearTimeout(mobileLoaderTimer);
  mobileLogoLoader.classList.remove('hidden', 'loader-fade-out');

  // Restart fill bar animation cleanly
  const fillEl = mobileLogoLoader.querySelector('.mobile-loader-fill');
  if (fillEl) {
    fillEl.style.animation = 'none';
    void fillEl.offsetWidth;
    fillEl.style.animation = '';
  }

  mobileLoaderTimer = setTimeout(() => {
    mobileLogoLoader.classList.add('loader-fade-out');
    setTimeout(() => {
      mobileLogoLoader.classList.add('hidden');
    }, 340);
  }, 850);
}

// Contact & Location Inputs at Bottom of Table (All Required, No Preferred Time)
const custName = document.getElementById('custName');
const custPhone = document.getElementById('custPhone');
const phoneVerifyBadge = document.getElementById('phoneVerifyBadge');
const custSocial = document.getElementById('custSocial');
const custFulfillment = document.getElementById('custFulfillment');
const custPayment = document.getElementById('custPayment');
const custLocation = document.getElementById('custLocation');
const custLandmark = document.getElementById('custLandmark');
const detectLocationBtn = document.getElementById('detectLocationBtn');

// 4. MOBILE DETECTION & BARE-BONES MOBILE UI SWITCHER
function detectIfMobileDevice() {
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  const smallViewport = window.innerWidth <= 768;
  const touchTablet = (navigator.maxTouchPoints > 1 && window.innerWidth <= 900);
  return uaMobile || smallViewport || touchTablet;
}

function applyMobileModeState(forceLoader = false) {
  const isMobile = isManualMobilePreview || detectIfMobileDevice();
  const wasMobile = document.body.classList.contains('mobile-mode');
  document.body.classList.toggle('mobile-mode', isMobile);

  const mobileModeLabel = document.getElementById('mobileModeLabel');
  if (mobileModeLabel) {
    mobileModeLabel.textContent = isMobile ? 'MOBILE' : 'AUTO';
  }

  if (exitMobilePreviewBtn) {
    const showExitBtn = isManualMobilePreview && !detectIfMobileDevice();
    exitMobilePreviewBtn.classList.toggle('hidden', !showExitBtn);
  }

  if (isMobile) {
    if (forceLoader || !hasShownMobileSplash || !wasMobile) {
      hasShownMobileSplash = true;
      triggerMobileLogoLoader();
    }
    setMobilePage(activeMobilePage);
  } else {
    document.body.classList.remove('mobile-page-menu', 'mobile-page-order');
    if (mobileLogoLoader) {
      mobileLogoLoader.classList.add('hidden');
    }
  }
}

function setMobilePage(page) {
  activeMobilePage = page === 'order' ? 'order' : 'menu';
  document.body.classList.toggle('mobile-page-menu', activeMobilePage === 'menu');
  document.body.classList.toggle('mobile-page-order', activeMobilePage === 'order');

  if (mobileCornerMenuBtn) {
    mobileCornerMenuBtn.classList.toggle('active', activeMobilePage === 'menu');
  }
  if (mobileCornerOrderBtn) {
    mobileCornerOrderBtn.classList.toggle('active', activeMobilePage === 'order');
  }

  if (document.body.classList.contains('mobile-mode')) {
    if (activeMobilePage === 'order') {
      orderTableSection.classList.remove('hidden');
    } else {
      orderTableSection.classList.add('hidden');
    }
  }
}

// 5. GOOGLE LIBPHONENUMBER PH PHONE NUMBER VERIFICATION & FORMATTING
function verifyAndFormatPHPhone(rawInput) {
  const cleaned = String(rawInput || '').trim();
  if (!cleaned) {
    return { valid: false, error: 'Phone number is required.' };
  }

  // Reject obvious fake repeating numbers like 09000000000 or 09111111111
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (/(\d)\1{7,}/.test(digitsOnly)) {
    return { valid: false, error: 'Invalid phone number (repeating digits).' };
  }

  // 1. Primary Verification via Google's libphonenumber (libphonenumber-js max bundle)
  if (window.libphonenumber && typeof window.libphonenumber.parsePhoneNumberFromString === 'function') {
    try {
      const phoneObj = window.libphonenumber.parsePhoneNumberFromString(cleaned, 'PH');
      if (!phoneObj || !phoneObj.isValid() || phoneObj.country !== 'PH') {
        return {
          valid: false,
          error: 'Must be a valid Philippine phone number (e.g. 0917 123 4567 or +63 917 123 4567).'
        };
      }

      const numType = phoneObj.getType ? phoneObj.getType() : 'MOBILE';
      if (numType && !['MOBILE', 'FIXED_LINE', 'FIXED_LINE_OR_MOBILE'].includes(numType)) {
        return {
          valid: false,
          error: 'Please enter a valid PH mobile or landline number.'
        };
      }

      return {
        valid: true,
        e164: phoneObj.number, // +639171234567
        formattedNational: phoneObj.formatNational(), // 0917 123 4567
        formattedInternational: phoneObj.formatInternational() // +63 917 123 4567
      };
    } catch {
      return { valid: false, error: 'Invalid Philippine phone number format.' };
    }
  }

  // 2. Strict PH Regex Fallback if CDN fails to load
  let normalizedDigits = digitsOnly;
  if (normalizedDigits.startsWith('639') && normalizedDigits.length === 12) {
    normalizedDigits = '0' + normalizedDigits.slice(2);
  } else if (normalizedDigits.startsWith('9') && normalizedDigits.length === 10) {
    normalizedDigits = '0' + normalizedDigits;
  }

  // Valid PH mobile prefixes: 0905-0999 (excluding 0900-0904)
  if (/^09(0[5-9]|[1-9]\d)\d{7}$/.test(normalizedDigits)) {
    const p1 = normalizedDigits.slice(0, 4);
    const p2 = normalizedDigits.slice(4, 7);
    const p3 = normalizedDigits.slice(7, 11);
    return {
      valid: true,
      e164: `+63${normalizedDigits.slice(1)}`,
      formattedNational: `${p1} ${p2} ${p3}`,
      formattedInternational: `+63 ${normalizedDigits.slice(1, 4)} ${p2} ${p3}`
    };
  }

  return {
    valid: false,
    error: 'Must be a valid PH number (e.g. 0917 123 4567 or +63 917 123 4567).'
  };
}

function updatePhoneValidationUI(formatValueOnValid = false) {
  const raw = custPhone.value.trim();
  if (!raw) {
    if (phoneVerifyBadge) {
      phoneVerifyBadge.textContent = 'PH Format (09XX / +639XX)';
      phoneVerifyBadge.className = 'phone-verify-badge';
    }
    custPhone.classList.remove('input-valid', 'input-invalid');
    return false;
  }

  const check = verifyAndFormatPHPhone(raw);
  if (check.valid) {
    if (formatValueOnValid) {
      custPhone.value = check.formattedNational;
    }
    if (phoneVerifyBadge) {
      phoneVerifyBadge.textContent = `✓ VERIFIED PH (${check.e164})`;
      phoneVerifyBadge.className = 'phone-verify-badge badge-valid';
    }
    custPhone.classList.add('input-valid');
    custPhone.classList.remove('input-invalid');
    return true;
  } else {
    if (phoneVerifyBadge) {
      phoneVerifyBadge.textContent = '✕ INVALID PH FORMAT';
      phoneVerifyBadge.className = 'phone-verify-badge badge-invalid';
    }
    custPhone.classList.add('input-invalid');
    custPhone.classList.remove('input-valid');
    return false;
  }
}

// 6. INITIALIZATION & STRICT SERVER MENU RETRIEVAL
let turnstileWidgetId = null;

function initTurnstile() {
  const container = document.getElementById('cfTurnstileWidget');
  const wrapper = document.getElementById('turnstileContainer');
  if (!container) return;

  const siteKey = ((window.__CNC_CONFIG__ && window.__CNC_CONFIG__.TURNSTILE_SITE_KEY) || '').trim();
  if (!siteKey) {
    if (wrapper) wrapper.classList.add('hidden');
    return;
  }

  if (!window.turnstile || turnstileWidgetId !== null) return;
  if (wrapper) wrapper.classList.remove('hidden');

  try {
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: siteKey,
      theme: 'light'
    });
  } catch (err) {
    console.warn('Turnstile render notice:', err);
  }
}

window.onloadTurnstileCallback = function() {
  initTurnstile();
};

document.addEventListener('DOMContentLoaded', async () => {
  if (orderRefCode) orderRefCode.textContent = 'Assigned on submit';
  orderDateStamp.textContent = `DATE: ${new Date().toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })}`;

  // Apply Mobile Detection immediately on load & on resize
  applyMobileModeState(true);
  window.addEventListener('resize', () => applyMobileModeState(false));

  attachEventListeners();

  if (window.turnstile) {
    initTurnstile();
  }

  // Render initial loading state and fetch menu strictly from server
  renderMenuGrid();
  renderOrderTable();
  setOrderControlsEnabled(false);

  await syncMenuFromServer();

  // Periodically check if the Handler App toggled Store Open / Closed status
  setInterval(syncStoreStatusOnly, 15000);
  window.addEventListener('focus', syncStoreStatusOnly);
});

function setOrderControlsEnabled(enabled) {
  const effectiveEnabled = Boolean(enabled && isStoreOpen);
  [quickItemSelect, quickSizeSelect, builderQtyMinus, builderQtyPlus, builderQtyInput, addToTableBtn, addBlankRowBtn, tableFooterAddBtn].forEach(el => {
    if (el) el.disabled = !effectiveEnabled;
  });
  const sampleBtn = document.getElementById('loadSampleOrderBtn');
  if (sampleBtn) sampleBtn.disabled = !effectiveEnabled;
  const submitBtn = document.getElementById('sendOrderDirectBtn');
  if (submitBtn && !isSubmittingOrder) {
    submitBtn.disabled = !effectiveEnabled;
    submitBtn.innerHTML = isStoreOpen ? '🚀 SUBMIT ORDER NOW' : '⛔ CLOSED FOR ORDERS';
  }
}

function applyStoreOpenState() {
  document.body.classList.toggle('store-closed-mode', !isStoreOpen);

  const badge = document.getElementById('storeStatusBadge');
  if (badge) {
    badge.textContent = isStoreOpen ? '★ OPEN FOR ORDERS ★' : '⛔ CLOSED FOR ORDERS';
    badge.classList.toggle('status-closed-badge', !isStoreOpen);
  }

  const closedBanner = document.getElementById('storeClosedBanner');
  if (closedBanner) {
    closedBanner.classList.toggle('hidden', isStoreOpen);
  }

  const heroBtn = document.getElementById('heroOrderNowBtn');
  if (heroBtn) {
    heroBtn.innerHTML = isStoreOpen
      ? '<span>★ ORDER NOW</span><span class="btn-arrow">↓</span>'
      : '<span>⛔ CLOSED FOR ORDERS</span>';
  }

  const menuBtn = document.getElementById('menuSectionOrderNowBtn');
  if (menuBtn) {
    menuBtn.textContent = isStoreOpen ? '★ ORDER NOW (OPEN TABLE)' : '⛔ CLOSED FOR ORDERS';
  }

  const bannerBtn = document.getElementById('bannerOrderNowBtn');
  if (bannerBtn) {
    bannerBtn.innerHTML = isStoreOpen
      ? '<span>✎ ORDER NOW — FILL OUT TABLE</span><span class="btn-arrow">↓</span>'
      : '<span>⛔ STORE CLOSED FOR ORDERS</span>';
  }

  document.querySelectorAll('.card-add-btn').forEach(btn => {
    btn.disabled = !isStoreOpen;
    btn.textContent = isStoreOpen ? '+ ADD TO TABLE' : '⛔ CLOSED FOR ORDERS';
  });

  setOrderControlsEnabled(menuLoadState === 'loaded' && MENU_ITEMS.length > 0);
}

async function syncStoreStatusOnly() {
  try {
    let closedFlagFound = false;
    if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');
      const res = await fetch(
        `${cleanBaseUrl}/rest/v1/menu_items?select=id,is_available&id=eq.system-store-closed`,
        {
          headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
          },
          cache: 'no-store'
        }
      );
      if (!res.ok) return isStoreOpen;
      const rows = await res.json();
      closedFlagFound = Array.isArray(rows) && rows.some(r => r && r.id === 'system-store-closed' && r.is_available !== false);
    } else {
      const res = await fetch('/api/menu', { cache: 'no-store' });
      if (!res.ok) return isStoreOpen;
      const rows = await res.json();
      closedFlagFound = Array.isArray(rows) && rows.some(r => r && r.id === 'system-store-closed' && r.is_available !== false);
    }

    const nextOpen = !closedFlagFound;
    if (nextOpen !== isStoreOpen) {
      isStoreOpen = nextOpen;
      applyStoreOpenState();
      showToast(
        isStoreOpen
          ? '🟢 Crack & Cup is now OPEN for orders!'
          : '⛔ Crack & Cup is now CLOSED for orders.'
      );
    }
    return isStoreOpen;
  } catch {
    return isStoreOpen;
  }
}

async function syncMenuFromServer() {
  menuLoadState = 'loading';
  renderMenuGrid();
  renderOrderTable();
  setOrderControlsEnabled(false);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    let res;
    if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      // GitHub Pages / GitHub Actions runtime config mode
      const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');
      const headers = {
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      };
      // Note: Do NOT append arbitrary params like `&_t=` because PostgREST treats them as column filters!
      res = await fetch(
        `${cleanBaseUrl}/rest/v1/menu_items?select=*&order=sort_order.asc`,
        {
          headers,
          signal: controller.signal,
          cache: 'no-store'
        }
      );
    } else {
      // Cloudflare Pages Function mode (Reads SUPABASE_URL & SUPABASE_PUBLISHABLE_KEY from Cloudflare Environment Variables)
      res = await fetch('/api/menu', {
        signal: controller.signal,
        cache: 'no-store'
      });
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[Crack & Cup] Supabase menu query failed (${res.status}):`, errText);
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const rawItems = await res.json();
    if (!Array.isArray(rawItems)) {
      throw new Error('Malformed menu returned from server');
    }

    // Check if Staff Handler App has marked the store as CLOSED (`system-store-closed`)
    const storeClosedFlag = rawItems.some(r => r && r.id === 'system-store-closed' && r.is_available !== false);
    isStoreOpen = !storeClosedFlag;

    // STRICT: Every name, price, upsize price, image & description comes ONLY from Supabase.
    // Rows with missing/invalid data or system config flags are dropped — nothing is invented on the client.
    MENU_ITEMS = rawItems
      .filter(r => r && r.is_available !== false && r.id !== 'system-store-closed' && r.category !== 'System Config')
      .map(normalizeServerMenuRow)
      .filter(Boolean);

    if (MENU_ITEMS.length === 0) {
      throw new Error('Empty menu returned from server');
    }

    menuLoadState = 'loaded';
    initCardQuantities();
    renderCategoryTabs();
    renderMenuPriceBadges();
    populateQuickItemSelect();
    updateBuilderBarPreview();

    setOrderControlsEnabled(true);
    renderMenuGrid();
    renderOrderTable();
    applyStoreOpenState();
  } catch (err) {
    console.error('[Crack & Cup] Error syncing menu from server:', err);
    // NO client-side fallback menu: if the server menu can't be loaded, ordering is disabled.
    MENU_ITEMS = [];
    orderRows = [];
    menuLoadState = 'error';
    setOrderControlsEnabled(false);
    renderCategoryTabs();
    renderMenuPriceBadges();
    populateQuickItemSelect();
    renderMenuGrid();
    renderOrderTable();
  }
}

// Validate a single Supabase `menu_items` row. Returns null if anything is invalid.
function normalizeServerMenuRow(row) {
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const category = typeof row.category === 'string' ? row.category.trim() : '';
  const price = Number(row.price);
  if (!/^[a-z0-9-]{1,64}$/.test(id) || !name || !category) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  let upsizePrice = null;
  if (row.upsize_price !== null && row.upsize_price !== undefined) {
    const up = Number(row.upsize_price);
    if (Number.isFinite(up) && up > price) upsizePrice = up;
  }

  return {
    id,
    name,
    category,
    price,
    upsizePrice,
    image: sanitizeImageUrl(row.image),
    desc: typeof row.description === 'string' ? row.description : ''
  };
}

// Only allow images from our own /assets folder or HTTPS URLs.
function sanitizeImageUrl(url) {
  if (typeof url !== 'string') return '';
  const u = url.trim();
  if (/^assets\/[A-Za-z0-9._\-\/%() ]+$/.test(u) && !u.includes('..')) return u;
  if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
  return '';
}

// Unit price for a given size — always from server data (Upsize only if the server offers it).
function getUnitPrice(item, size) {
  if (size === 'Upsize' && item && item.upsizePrice !== null && item.upsizePrice !== undefined) {
    return item.upsizePrice;
  }
  return item ? item.price : 0;
}

function hasUpsize(item) {
  return !!item && item.upsizePrice !== null && item.upsizePrice !== undefined;
}

// Category tabs are generated from the categories returned by the server.
function renderCategoryTabs() {
  const tabsEl = document.getElementById('categoryTabs');
  if (!tabsEl) return;
  const categories = [...new Set(MENU_ITEMS.map(i => i.category))];
  if (activeCategory !== 'all' && !categories.includes(activeCategory)) {
    activeCategory = 'all';
  }
  const allTab = `<button type="button" class="cat-tab ${activeCategory === 'all' ? 'active' : ''}" data-category="all">★ ALL (${MENU_ITEMS.length})</button>`;
  const catTabs = categories.map(cat => {
    const count = MENU_ITEMS.filter(i => i.category === cat).length;
    const safeCat = escapeHtml(cat);
    return `<button type="button" class="cat-tab ${activeCategory === cat ? 'active' : ''}" data-category="${safeCat}">${escapeHtml(cat.toUpperCase())} (${count})</button>`;
  }).join('');
  tabsEl.innerHTML = allTab + catTabs;
}

// Header price badges are computed from server prices (hidden if the menu didn't load).
function renderMenuPriceBadges() {
  const priceBadge = document.getElementById('menuPriceBadge');
  const upsizeBadge = document.getElementById('menuUpsizeBadge');
  if (!priceBadge || !upsizeBadge) return;

  if (MENU_ITEMS.length === 0) {
    priceBadge.classList.add('hidden');
    upsizeBadge.classList.add('hidden');
    return;
  }

  const prices = MENU_ITEMS.map(i => i.price);
  const minPrice = Math.min(...prices);
  const allSame = prices.every(p => p === minPrice);
  priceBadge.textContent = allSame ? `EVERYTHING ₱${minPrice}` : `FROM ₱${minPrice}`;
  priceBadge.classList.remove('hidden');

  const diffs = MENU_ITEMS.filter(hasUpsize).map(i => i.upsizePrice - i.price);
  if (diffs.length > 0 && diffs.every(d => d === diffs[0])) {
    upsizeBadge.textContent = `MEAL UPSIZE +₱${diffs[0]}`;
    upsizeBadge.classList.remove('hidden');
  } else if (diffs.length > 0) {
    upsizeBadge.textContent = 'MEAL UPSIZE AVAILABLE';
    upsizeBadge.classList.remove('hidden');
  } else {
    upsizeBadge.classList.add('hidden');
  }
}

function cryptoRowId() {
  return 'row-' + Math.random().toString(36).substring(2, 9);
}

// Look up authoritative item object from MENU_ITEMS by ID
function getMenuItemById(itemId) {
  return MENU_ITEMS.find(m => m.id === itemId) || MENU_ITEMS[0] || { id: '', name: 'Unavailable', price: 0 };
}

// Reveal / Hide Ordering Table
function openOrderingTable(scrollToIt = true) {
  if (!isStoreOpen) {
    showToast('⛔ Sorry, Crack & Cup is currently CLOSED for orders.');
    return;
  }
  if (document.body.classList.contains('mobile-mode')) {
    setMobilePage('order');
    return;
  }
  orderTableSection.classList.remove('hidden');
  if (orderNowPromptBox) {
    orderNowPromptBox.classList.add('hidden');
  }
  if (scrollToIt) {
    orderTableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function hideOrderingTable() {
  if (document.body.classList.contains('mobile-mode')) {
    setMobilePage('menu');
    return;
  }
  orderTableSection.classList.add('hidden');
  if (orderNowPromptBox) {
    orderNowPromptBox.classList.remove('hidden');
  }
  menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 7. POPULATE QUICK SELECT DROPDOWN (Only Server-Verified Menu Items)
function populateQuickItemSelect() {
  if (menuLoadState !== 'loaded' || MENU_ITEMS.length === 0) {
    quickItemSelect.innerHTML = `<option value="">ERROR MENU FAILED TO RETRIEVE</option>`;
    return;
  }

  const categories = [...new Set(MENU_ITEMS.map(i => i.category))];
  let html = '';

  categories.forEach(cat => {
    html += `<optgroup label="★ ${escapeHtml(cat.toUpperCase())}">`;
    MENU_ITEMS.filter(i => i.category === cat).forEach(item => {
      html += `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} — ₱${Number(item.price)}</option>`;
    });
    html += `</optgroup>`;
  });

  quickItemSelect.innerHTML = html;
}

// 8. RENDER VISUAL MENU CARDS (Or Server Error Message on Failure!)
function renderMenuGrid() {
  if (menuLoadState === 'loading') {
    menuGrid.innerHTML = `
      <div class="server-menu-status-box loading-box">
        <p class="server-status-title">⏳ RETRIEVING MENU FROM SERVER...</p>
      </div>
    `;
    return;
  }

  if (menuLoadState === 'error' || MENU_ITEMS.length === 0) {
    menuGrid.innerHTML = `
      <div class="server-menu-status-box error-box" role="alert">
        <p class="server-error-text">ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.</p>
        <button type="button" class="btn-brutal btn-primary retry-menu-btn" data-action="retry-menu">
          ↻ TRY AGAIN
        </button>
      </div>
    `;
    return;
  }

  const filtered = activeCategory === 'all'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === activeCategory);

  const cardsHtml = filtered.map(item => {
    const qty = cardQuantities[item.id] || 1;
    const canUpsize = hasUpsize(item);
    const isUpsize = canUpsize && (cardSizes[item.id] || 'Regular') === 'Upsize';
    const unitPrice = getUnitPrice(item, isUpsize ? 'Upsize' : 'Regular');
    const lineAmt = qty * unitPrice;
    const sizePillHtml = canUpsize ? `
          <div class="card-size-pill" title="Choose Regular portion or Meal Upsize">
            <button type="button" class="card-size-btn ${!isUpsize ? 'active' : ''}" data-action="card-size" data-id="${escapeHtml(item.id)}" data-size="Regular">REGULAR ₱${item.price}</button>
            <button type="button" class="card-size-btn ${isUpsize ? 'active' : ''}" data-action="card-size" data-id="${escapeHtml(item.id)}" data-size="Upsize">★ UPSIZE +₱${item.upsizePrice - item.price} (₱${item.upsizePrice})</button>
          </div>` : '';
    const safeId = escapeHtml(item.id);
    const safeName = escapeHtml(item.name);
    const safeCat = escapeHtml(item.category);
    const safeDesc = escapeHtml(item.desc);
    const safeImg = escapeHtml(item.image);

    return `
      <article class="menu-card" data-item-id="${safeId}">
        <div class="menu-card-top">
          <img src="${safeImg}" alt="${safeName}" class="menu-card-img" loading="lazy" />
          <span class="menu-price-sticker">₱${unitPrice}</span>
          <span class="menu-cat-tag">${safeCat}</span>
        </div>
        <div class="menu-card-body">
          <h3 class="menu-item-title">${safeName}</h3>
          <p class="menu-item-desc">${safeDesc}</p>
${sizePillHtml}

          <div class="menu-card-actions">
            <button type="button" class="card-add-btn" data-action="card-add" data-id="${safeId}" ${!isStoreOpen ? 'disabled' : ''}>
              ${isStoreOpen ? '+ ADD TO TABLE' : '⛔ CLOSED FOR ORDERS'}
            </button>
            <div class="card-qty-amt-box" title="Quantity & Total Amount for this item">
              <button type="button" class="card-qty-btn" data-action="card-minus" data-id="${safeId}" aria-label="Decrease quantity">−</button>
              <span class="card-qty-val">${qty}</span>
              <button type="button" class="card-qty-btn" data-action="card-plus" data-id="${safeId}" aria-label="Increase quantity">+</button>
              <span class="card-amt-badge">₱${lineAmt}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const moreSoonCardHtml = `
    <article class="more-soon-card">
      <span class="more-soon-badge">★ STAY TUNED ★</span>
      <h3 class="more-soon-title">(More items soon!)</h3>
      <p class="more-soon-sub">
        Signature Crack &amp; Cup Brews, Iced Lattes, Snacks &amp; new photos dropping soon!
      </p>
    </article>
  `;

  menuGrid.innerHTML = cardsHtml + moreSoonCardHtml;
}

// 9. UPDATE TOP BUILDER BAR
function updateBuilderBarPreview() {
  if (menuLoadState !== 'loaded' || MENU_ITEMS.length === 0) {
    builderComputedAmount.textContent = '₱0';
    return;
  }
  const item = getMenuItemById(quickItemSelect.value);
  populateQuickSizeSelect(item);
  const size = quickSizeSelect ? quickSizeSelect.value : 'Regular';
  const unitPrice = getUnitPrice(item, size);
  const qty = Math.max(1, Math.min(30, parseInt(builderQtyInput.value, 10) || 1));
  const amount = unitPrice * qty;
  builderComputedAmount.textContent = `₱${amount.toLocaleString()}`;
}

// Size dropdown options are built from the selected item's server prices.
function populateQuickSizeSelect(item) {
  if (!quickSizeSelect) return;
  const previous = quickSizeSelect.value;
  if (!item || menuLoadState !== 'loaded') {
    quickSizeSelect.innerHTML = '<option value="Regular">Regular</option>';
    return;
  }
  let html = `<option value="Regular">Regular (₱${item.price})</option>`;
  if (hasUpsize(item)) {
    html += `<option value="Upsize">★ Upsize +₱${item.upsizePrice - item.price} (₱${item.upsizePrice})</option>`;
  }
  quickSizeSelect.innerHTML = html;
  quickSizeSelect.value = (previous === 'Upsize' && hasUpsize(item)) ? 'Upsize' : 'Regular';
}

// 10. ADD ITEM TO ORDER TABLE
function addItemToOrderTable(itemId, qty = 1, size = 'Regular', notes = '') {
  if (!isStoreOpen) {
    showToast('⛔ Sorry, Crack & Cup is currently CLOSED for orders.');
    return;
  }
  if (menuLoadState !== 'loaded') {
    showToast('ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.');
    return;
  }
  const cleanQty = Math.max(1, Math.min(30, parseInt(qty, 10) || 1));
  const menuObj = MENU_ITEMS.find(m => m.id === itemId);
  if (!menuObj) return;
  const cleanSize = (size === 'Upsize' && hasUpsize(menuObj)) ? 'Upsize' : 'Regular';

  const existingRow = orderRows.find(r => r.itemId === itemId && (r.size || 'Regular') === cleanSize && (!notes || r.notes === notes));
  const unitPrice = getUnitPrice(menuObj, cleanSize);

  if (existingRow) {
    existingRow.qty = Math.min(30, existingRow.qty + cleanQty);
    renderOrderTable();
    showToast(`Updated: ${existingRow.qty}x ${menuObj.name} [${cleanSize}] (₱${existingRow.qty * unitPrice})`);
    return;
  }

  if (orderRows.length >= 20) {
    showToast('⚠ Submission limiter: Maximum 20 line items per order.');
    return;
  }

  orderRows.push({
    rowId: cryptoRowId(),
    itemId: menuObj.id,
    size: cleanSize,
    qty: cleanQty,
    notes: notes || ''
  });
  renderOrderTable();
  showToast(`Added to table: ${cleanQty}x ${menuObj.name} [${cleanSize}] (₱${cleanQty * unitPrice})`);
}

// 11. RENDER THE ORDER FILLOUT TABLE
function buildRowSelectOptions(selectedId) {
  let html = '';
  const categories = [...new Set(MENU_ITEMS.map(i => i.category))];
  categories.forEach(cat => {
    html += `<optgroup label="★ ${escapeHtml(cat.toUpperCase())}">`;
    MENU_ITEMS.filter(i => i.category === cat).forEach(item => {
      const sel = item.id === selectedId ? 'selected' : '';
      html += `<option value="${escapeHtml(item.id)}" ${sel}>${escapeHtml(item.name)} (₱${Number(item.price)})</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

function renderOrderTable() {
  if (menuLoadState === 'loading') {
    orderTableBody.innerHTML = `
      <tr class="table-status-row">
        <td colspan="5" class="table-status-cell">
          ⏳ Retrieving official menu &amp; prices from server...
        </td>
      </tr>
    `;
    updateTotalsAndTemplate();
    return;
  }

  if (menuLoadState === 'error' || MENU_ITEMS.length === 0) {
    orderTableBody.innerHTML = `
      <tr class="table-status-row">
        <td colspan="5" class="table-status-cell">
          <div class="table-error-banner">
            <p>ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.</p>
            <button type="button" class="btn-brutal btn-primary retry-menu-btn" data-row-action="retry-menu" style="margin-top:10px;">
              ↻ TRY AGAIN
            </button>
          </div>
        </td>
      </tr>
    `;
    updateTotalsAndTemplate();
    return;
  }

  if (orderRows.length === 0) {
    orderTableBody.innerHTML = `
      <tr class="table-status-row">
        <td colspan="5" class="table-status-cell">
          No items in your order yet! Click <strong>+ ADD ANOTHER ITEM ROW</strong> below or pick from <strong>MENU</strong>.
        </td>
      </tr>
    `;
  } else {
    orderTableBody.innerHTML = orderRows.map((row, idx) => {
      const menuObj = getMenuItemById(row.itemId);
      if (row.size === 'Upsize' && !hasUpsize(menuObj)) row.size = 'Regular';
      const isUpsize = row.size === 'Upsize';
      const unitPrice = getUnitPrice(menuObj, row.size);
      const lineTotal = row.qty * unitPrice;

      return `
        <tr data-row-id="${row.rowId}">
          <td class="col-num">${idx + 1}</td>

          <td class="col-item">
            <div class="row-item-wrap">
              <select class="row-select" data-row-action="select-item" data-row-id="${row.rowId}" aria-label="Select item for row ${idx + 1}">
                ${buildRowSelectOptions(menuObj.id)}
              </select>
              <div class="row-size-wrap">
                <label class="row-size-label">SIZE:</label>
                <select class="row-size-select" data-row-action="select-size" data-row-id="${row.rowId}" aria-label="Select size for row ${idx + 1}">
                  <option value="Regular" ${!isUpsize ? 'selected' : ''}>Regular (₱${menuObj.price})</option>
                  ${hasUpsize(menuObj) ? `<option value="Upsize" ${isUpsize ? 'selected' : ''}>★ Upsize +₱${menuObj.upsizePrice - menuObj.price} (₱${menuObj.upsizePrice})</option>` : ''}
                </select>
              </div>
            </div>
          </td>

          <td class="col-notes">
            <input
              type="text"
              class="row-notes-input"
              data-row-action="edit-notes"
              data-row-id="${row.rowId}"
              value="${escapeHtml(row.notes)}"
              maxlength="100"
              placeholder="e.g. Extra chili, no scallions..."
            />
          </td>

          <td class="col-qty-amt">
            <div class="row-qty-amt-control">
              <div class="row-stepper" title="Change Quantity">
                <button type="button" class="row-step-btn" data-row-action="qty-minus" data-row-id="${row.rowId}" aria-label="Decrease quantity">−</button>
                <input type="number" class="row-qty-input" data-row-action="qty-input" data-row-id="${row.rowId}" value="${row.qty}" min="1" max="30" aria-label="Quantity" />
                <button type="button" class="row-step-btn" data-row-action="qty-plus" data-row-id="${row.rowId}" aria-label="Increase quantity">+</button>
              </div>

              <div class="row-amount-box" title="Server Price × Quantity = Line Amount">
                <span class="unit-price-tag">₱${unitPrice}</span>
                <span class="row-line-total">₱${lineTotal.toLocaleString()}</span>
              </div>
            </div>
          </td>

          <td class="col-action">
            <button type="button" class="btn-del-row" data-row-action="delete-row" data-row-id="${row.rowId}" title="Remove item">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  updateTotalsAndTemplate();
}

function updateTotalsAndTemplate() {
  const totalQty = orderRows.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
  const totalAmount = orderRows.reduce((acc, r) => {
    const item = getMenuItemById(r.itemId);
    const unitPrice = getUnitPrice(item, r.size);
    return acc + ((parseInt(r.qty, 10) || 0) * unitPrice);
  }, 0);

  summaryTotalQty.textContent = `${totalQty} ${totalQty === 1 ? 'item' : 'items'}`;
  summaryTotalAmount.textContent = `₱${totalAmount.toLocaleString()}`;
  if (headerCartCount) headerCartCount.textContent = totalQty;
  if (mobileOrderCountBadge) mobileOrderCountBadge.textContent = totalQty;
}

// 13. EVENT LISTENERS
function attachEventListeners() {
  // Mobile Corner Switcher Buttons ("Menu" on Top-Left, "Order" on Top-Right)
  if (mobileCornerMenuBtn) {
    mobileCornerMenuBtn.addEventListener('click', () => setMobilePage('menu'));
  }
  if (mobileCornerOrderBtn) {
    mobileCornerOrderBtn.addEventListener('click', () => setMobilePage('order'));
  }

  if (exitMobilePreviewBtn) {
    exitMobilePreviewBtn.addEventListener('click', () => {
      isManualMobilePreview = false;
      applyMobileModeState();
      showToast('🖥️ Returned to Desktop View');
    });
  }

  ['headerOrderNowBtn', 'heroOrderNowBtn', 'menuSectionOrderNowBtn', 'bannerOrderNowBtn'].forEach(btnId => {
    const el = document.getElementById(btnId);
    if (el) {
      el.addEventListener('click', () => openOrderingTable(true));
    }
  });

  const hideOrderTableBtn = document.getElementById('hideOrderTableBtn');
  if (hideOrderTableBtn) {
    hideOrderTableBtn.addEventListener('click', hideOrderingTable);
  }

  // Category tabs are generated from server categories, so use event delegation.
  const categoryTabsEl = document.getElementById('categoryTabs');
  if (categoryTabsEl) {
    categoryTabsEl.addEventListener('click', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      categoryTabsEl.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category || 'all';
      renderMenuGrid();
    });
  }

  const toggleMobileModeBtn = document.getElementById('toggleMobileModeBtn');
  if (toggleMobileModeBtn) {
    toggleMobileModeBtn.addEventListener('click', () => {
      isManualMobilePreview = !isManualMobilePreview;
      applyMobileModeState(isManualMobilePreview);
      showToast(
        document.body.classList.contains('mobile-mode')
          ? '📱 Bare-Bones Mobile UI active (Menu / Order corner tabs)'
          : '🖥️ Desktop View active'
      );
    });
  }

  const togglePhotoModeBtn = document.getElementById('togglePhotoModeBtn');
  const photoModeLabel = document.getElementById('photoModeLabel');
  if (togglePhotoModeBtn && photoModeLabel) {
    togglePhotoModeBtn.addEventListener('click', () => {
      const isColor = document.body.classList.toggle('color-photos');
      photoModeLabel.textContent = isColor ? 'FULL COLOR' : 'B&W INK';
    });
  }

  // Refresh a single card's price sticker, quantity, and amount from server prices (no re-render).
  const refreshCardPricing = (card, id) => {
    const item = MENU_ITEMS.find(m => m.id === id);
    if (!card || !item) return;
    const size = (cardSizes[id] === 'Upsize' && hasUpsize(item)) ? 'Upsize' : 'Regular';
    const unitPrice = getUnitPrice(item, size);
    const qty = cardQuantities[id] || 1;
    card.querySelectorAll('.card-size-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.size === size);
    });
    const sticker = card.querySelector('.menu-price-sticker');
    if (sticker) sticker.textContent = `₱${unitPrice}`;
    const val = card.querySelector('.card-qty-val');
    if (val) val.textContent = qty;
    const badge = card.querySelector('.card-amt-badge');
    if (badge) badge.textContent = `₱${qty * unitPrice}`;
  };

  menuGrid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'retry-menu') {
      syncMenuFromServer();
      return;
    }

    const card = btn.closest('.menu-card');

    if (action === 'card-size') {
      const item = MENU_ITEMS.find(m => m.id === id);
      cardSizes[id] = (btn.dataset.size === 'Upsize' && hasUpsize(item)) ? 'Upsize' : 'Regular';
      refreshCardPricing(card, id);
    } else if (action === 'card-minus') {
      cardQuantities[id] = Math.max(1, (cardQuantities[id] || 1) - 1);
      refreshCardPricing(card, id);
    } else if (action === 'card-plus') {
      cardQuantities[id] = Math.min(30, (cardQuantities[id] || 1) + 1);
      refreshCardPricing(card, id);
    } else if (action === 'card-add') {
      addItemToOrderTable(id, cardQuantities[id] || 1, cardSizes[id] || 'Regular');
      cardQuantities[id] = 1;
      refreshCardPricing(card, id);
      openOrderingTable(true);
    }
  });

  quickItemSelect.addEventListener('change', updateBuilderBarPreview);
  if (quickSizeSelect) {
    quickSizeSelect.addEventListener('change', updateBuilderBarPreview);
  }

  builderQtyMinus.addEventListener('click', () => {
    builderQtyInput.value = Math.max(1, (parseInt(builderQtyInput.value, 10) || 1) - 1);
    updateBuilderBarPreview();
  });

  builderQtyPlus.addEventListener('click', () => {
    builderQtyInput.value = Math.min(30, (parseInt(builderQtyInput.value, 10) || 1) + 1);
    updateBuilderBarPreview();
  });

  builderQtyInput.addEventListener('input', updateBuilderBarPreview);

  addToTableBtn.addEventListener('click', () => {
    if (menuLoadState !== 'loaded') return;
    const item = getMenuItemById(quickItemSelect.value);
    const qty = Math.max(1, Math.min(30, parseInt(builderQtyInput.value, 10) || 1));
    const size = quickSizeSelect ? quickSizeSelect.value : 'Regular';
    addItemToOrderTable(item.id, qty, size);
    builderQtyInput.value = 1;
    updateBuilderBarPreview();
  });

  const insertBlankRow = () => {
    if (menuLoadState !== 'loaded' || MENU_ITEMS.length === 0) return;
    if (orderRows.length >= 20) {
      showToast('⚠ Submission limiter: Maximum 20 line items per order.');
      return;
    }
    const firstItem = MENU_ITEMS[0];
    orderRows.push({
      rowId: cryptoRowId(),
      itemId: firstItem.id,
      size: 'Regular',
      qty: 1,
      notes: ''
    });
    renderOrderTable();
    showToast('Inserted a new item row into the table!');
  };

  addBlankRowBtn.addEventListener('click', insertBlankRow);
  tableFooterAddBtn.addEventListener('click', insertBlankRow);

  orderTableBody.addEventListener('click', e => {
    const btn = e.target.closest('[data-row-action]');
    if (!btn) return;
    const action = btn.dataset.rowAction;
    if (action === 'retry-menu') {
      syncMenuFromServer();
      return;
    }

    const rowId = btn.dataset.rowId;
    const row = orderRows.find(r => r.rowId === rowId);
    if (!row) return;

    if (action === 'qty-minus') {
      row.qty = Math.max(1, row.qty - 1);
      renderOrderTable();
    } else if (action === 'qty-plus') {
      row.qty = Math.min(30, row.qty + 1);
      renderOrderTable();
    } else if (action === 'delete-row') {
      orderRows = orderRows.filter(r => r.rowId !== rowId);
      renderOrderTable();
      showToast('Item removed from table.');
    }
  });

  orderTableBody.addEventListener('change', e => {
    const el = e.target;
    const action = el.dataset.rowAction;
    const rowId = el.dataset.rowId;
    const row = orderRows.find(r => r.rowId === rowId);
    if (!row) return;

    if (action === 'select-item') {
      const found = MENU_ITEMS.find(m => m.id === el.value);
      if (found) {
        row.itemId = found.id;
        if (row.size === 'Upsize' && !hasUpsize(found)) {
          row.size = 'Regular';
        }
      }
      renderOrderTable();
    } else if (action === 'select-size') {
      const item = getMenuItemById(row.itemId);
      row.size = (el.value === 'Upsize' && hasUpsize(item)) ? 'Upsize' : 'Regular';
      renderOrderTable();
    } else if (action === 'qty-input') {
      row.qty = Math.max(1, Math.min(30, parseInt(el.value, 10) || 1));
      renderOrderTable();
    }
  });

  orderTableBody.addEventListener('input', e => {
    const el = e.target;
    const action = el.dataset.rowAction;
    const rowId = el.dataset.rowId;
    const row = orderRows.find(r => r.rowId === rowId);
    if (!row) return;

    if (action === 'edit-notes') {
      row.notes = el.value.slice(0, 100);
      updateTotalsAndTemplate();
    }
  });

  // Live PH Phone Verification via Google libphonenumber
  custPhone.addEventListener('input', () => {
    updatePhoneValidationUI(false);
    updateTotalsAndTemplate();
  });

  custPhone.addEventListener('blur', () => {
    updatePhoneValidationUI(true);
    updateTotalsAndTemplate();
  });

  [custName, custSocial, custFulfillment, custPayment, custLocation, custLandmark].forEach(input => {
    if (!input) return;
    input.addEventListener('input', updateTotalsAndTemplate);
    input.addEventListener('change', updateTotalsAndTemplate);
  });

  detectLocationBtn.addEventListener('click', () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      showToast('⚠ Geolocation requires a secure HTTPS connection and browser permission.');
      return;
    }
    if (detectLocationBtn.disabled) return;

    detectLocationBtn.disabled = true;
    detectLocationBtn.textContent = '⏳ LOCATING...';

    navigator.geolocation.getCurrentPosition(
      pos => {
        const rawLat = Number(pos && pos.coords && pos.coords.latitude);
        const rawLng = Number(pos && pos.coords && pos.coords.longitude);

        if (
          !Number.isFinite(rawLat) ||
          !Number.isFinite(rawLng) ||
          rawLat < -90 ||
          rawLat > 90 ||
          rawLng < -180 ||
          rawLng > 180
        ) {
          detectLocationBtn.disabled = false;
          detectLocationBtn.textContent = '📍 PIN MY CURRENT GPS LOCATION';
          showToast('⚠ Invalid GPS coordinates received. Please type your address manually.');
          return;
        }

        const lat = rawLat.toFixed(6);
        const lng = rawLng.toFixed(6);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        // Strip any previous GPS Pin / Google Maps URL so repeated clicks never duplicate
        const cleanedExisting = custLocation.value
          .replace(/\s*\(https?:\/\/(?:www\.)?google\.com\/maps[^\s)]*\)/gi, '')
          .replace(/\s*\(https?:\/\/maps\.google\.com\/[^\s)]*\)/gi, '')
          .replace(/^GPS Pin:\s*https?:\/\/[^\s]+$/i, '')
          .trim();

        const combined = cleanedExisting ? `${cleanedExisting} (${mapsUrl})` : `GPS Pin: ${mapsUrl}`;
        custLocation.value = combined.slice(0, 280);

        detectLocationBtn.textContent = '✓ GPS PINNED!';
        updateTotalsAndTemplate();
        showToast(
          cleanedExisting
            ? '✓ Pinned your GPS coordinates to the Location field!'
            : '✓ GPS Pinned! Please also add your street / house details.'
        );
        setTimeout(() => {
          detectLocationBtn.disabled = false;
          detectLocationBtn.textContent = '📍 PIN MY CURRENT GPS LOCATION';
        }, 2500);
      },
      err => {
        detectLocationBtn.disabled = false;
        detectLocationBtn.textContent = '📍 PIN MY CURRENT GPS LOCATION';
        if (err && err.code === 1) {
          showToast('⚠ Location permission denied. Please allow location access or type your address.');
        } else if (err && err.code === 3) {
          showToast('⚠ GPS location timed out. Please try again or type your address manually.');
        } else {
          showToast('⚠ Could not auto-detect GPS. Please type your address manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });

  document.getElementById('loadSampleOrderBtn').addEventListener('click', () => {
    if (menuLoadState !== 'loaded' || MENU_ITEMS.length === 0) {
      showToast('ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.');
      return;
    }
    const secondItem = MENU_ITEMS[7] || MENU_ITEMS[1] || MENU_ITEMS[0];
    orderRows = [
      {
        rowId: cryptoRowId(),
        itemId: MENU_ITEMS[0].id,
        size: 'Regular',
        qty: 2,
        notes: 'Extra sunny egg'
      },
      {
        rowId: cryptoRowId(),
        itemId: secondItem.id,
        size: hasUpsize(secondItem) ? 'Upsize' : 'Regular',
        qty: 1,
        notes: 'Spicy chili oil on side'
      }
    ];
    custName.value = 'Alex Rivera';
    custPhone.value = '0917 888 4321';
    updatePhoneValidationUI(true);
    custSocial.value = '@alexrivera_ph';
    custFulfillment.value = 'Delivery';
    custPayment.value = 'Cash on Delivery (COD)';
    custLocation.value = 'Blk 4 Lot 12 Patio Jacinto, Molino 3, Bacoor, Cavite';
    custLandmark.value = 'White minimalist gate near the clubhouse';
    renderOrderTable();
    showToast('Loaded sample auto-template order!');
  });

  document.getElementById('clearTableBtn').addEventListener('click', () => {
    orderRows = [];
    orderReference = '';
    if (orderRefCode) orderRefCode.textContent = 'Assigned on submit';
    if (orderTableSection) {
      orderTableSection.classList.remove('order-submitted-view');
    }
    if (orderConfirmationCard) {
      orderConfirmationCard.classList.add('hidden');
    }
    if (window.turnstile && turnstileWidgetId !== null) {
      try {
        window.turnstile.reset(turnstileWidgetId);
      } catch {}
    }
    renderOrderTable();
    showToast('Order table cleared.');
  });

  const newOrderBtn = document.getElementById('newOrderBtn');
  if (newOrderBtn) {
    newOrderBtn.addEventListener('click', () => {
      orderRows = [];
      orderReference = '';
      if (orderRefCode) orderRefCode.textContent = 'Assigned on submit';
      if (orderTableSection) {
        orderTableSection.classList.remove('order-submitted-view');
      }
      if (orderConfirmationCard) {
        orderConfirmationCard.classList.add('hidden');
      }
      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          window.turnstile.reset(turnstileWidgetId);
        } catch {}
      }
      renderOrderTable();
      if (document.body.classList.contains('mobile-mode')) {
        setMobilePage('menu');
      } else {
        openOrderingTable(false);
      }
      showToast('Order form reset. You can now place a new order!');
    });
  }

  if (copyReferralIdBtn) {
    copyReferralIdBtn.addEventListener('click', async () => {
      const code = (confirmedOrderRef && confirmedOrderRef.textContent) || orderReference;
      await copyToClipboard(code);
      showToast(`✓ Order Code copied: ${code}`);
    });
  }

  document.getElementById('sendOrderDirectBtn').addEventListener('click', handleOrderSubmit);
}

// 14. SUBMISSION LIMITERS & ALL-FIELDS VALIDATION
let isSubmittingOrder = false;
let lastSubmittedFingerprint = '';

function getCooldownUntil() {
  return Number(sessionStorage.getItem('cnc_cooldown_until') || 0);
}

function setCooldownUntil(ts) {
  sessionStorage.setItem('cnc_cooldown_until', String(ts));
}

function checkHourlySubmissionLimit() {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const raw = JSON.parse(localStorage.getItem('cnc_hourly_submits') || '[]');
    const recent = Array.isArray(raw) ? raw.filter(ts => Number(ts) > oneHourAgo) : [];
    localStorage.setItem('cnc_hourly_submits', JSON.stringify(recent));
    return recent.length < 6;
  } catch {
    return true;
  }
}

function recordHourlySubmission() {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const raw = JSON.parse(localStorage.getItem('cnc_hourly_submits') || '[]');
    const recent = Array.isArray(raw) ? raw.filter(ts => Number(ts) > oneHourAgo) : [];
    recent.push(now);
    localStorage.setItem('cnc_hourly_submits', JSON.stringify(recent));
  } catch {
    // ignore storage errors
  }
}

// Verify that an input string does not contain arbitrary external links (only verified Google Maps GPS pin allowed)
function hasUnsafeUrl(text) {
  const withoutSafeGps = String(text || '').replace(
    /https:\/\/(?:www\.)?google\.com\/maps\?q=-?\d{1,2}\.\d{1,8},-?\d{1,3}\.\d{1,8}|https:\/\/maps\.google\.com\/\?q=-?\d{1,2}\.\d{1,8},-?\d{1,3}\.\d{1,8}/g,
    ''
  );
  return /https?:\/\/|javascript:|data:/i.test(withoutSafeGps);
}

function validateOrderForm() {
  const honeypot = document.getElementById('websiteHoneypot');
  if (honeypot && honeypot.value.trim() !== '') {
    return false;
  }

  if (!isStoreOpen) {
    showToast('⛔ Sorry, Crack & Cup is currently CLOSED for orders.');
    return false;
  }

  if (menuLoadState !== 'loaded' || MENU_ITEMS.length === 0) {
    showToast('ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.');
    return false;
  }

  const now = Date.now();
  const cooldownUntil = getCooldownUntil();
  if (now < cooldownUntil) {
    const secsLeft = Math.ceil((cooldownUntil - now) / 1000);
    showToast(`⏳ Submission limiter: Please wait ${secsLeft}s before placing another order.`);
    return false;
  }

  if (!checkHourlySubmissionLimit()) {
    showToast('⏳ Submission limiter: Maximum orders per hour reached. Please try again later.');
    return false;
  }

  if (orderRows.length === 0) {
    showToast('⚠ Please add at least 1 item to your order table first!');
    return false;
  }

  const totalQty = orderRows.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
  if (totalQty < 1 || totalQty > 50) {
    showToast('⚠ Submission limiter: Total quantity must be between 1 and 50 items.');
    return false;
  }

  // 1. Customer Name (Required, 2–80 chars)
  const nameVal = custName.value.trim();
  if (nameVal.length < 2 || nameVal.length > 80 || hasUnsafeUrl(nameVal)) {
    custName.focus();
    showToast('⚠ Please enter a valid Name / Nickname (2–80 characters, no links).');
    return false;
  }

  // 2. PH Phone Number (Required, Verified PH Format via Google libphonenumber)
  const phoneCheck = verifyAndFormatPHPhone(custPhone.value);
  if (!phoneCheck.valid) {
    custPhone.focus();
    updatePhoneValidationUI(false);
    showToast(`⚠ ${phoneCheck.error}`);
    return false;
  }
  custPhone.value = phoneCheck.formattedNational;
  updatePhoneValidationUI(false);

  // 3. Social Handle (Required — All fields must be filled to submit!)
  const socialVal = custSocial.value.trim();
  if (socialVal.length < 2 || socialVal.length > 80) {
    custSocial.focus();
    showToast('⚠ Please enter your FB Messenger / IG Handle (All fields are required).');
    return false;
  }

  // 4. Order Type & Payment (Delivery & COD Only!)
  if (custFulfillment.value !== 'Delivery') {
    custFulfillment.focus();
    showToast('⚠ Only Delivery orders are accepted right now.');
    return false;
  }

  if (!['Cash on Delivery (COD)', 'Payment on Delivery'].includes(custPayment.value)) {
    custPayment.focus();
    showToast('⚠ Only Cash on Delivery (COD) / Payment on Delivery is accepted right now.');
    return false;
  }

  // 5. Complete Location / Address (Required, 4–280 chars, no arbitrary external links)
  const locVal = custLocation.value.trim();
  if (locVal.length < 4 || locVal.length > 280 || hasUnsafeUrl(locVal)) {
    custLocation.focus();
    showToast('⚠ Please enter your Complete Delivery Address / Location (4–280 characters, no external links).');
    return false;
  }

  // 6. Landmark / Gate # (Required — All fields must be filled to submit!)
  const landmarkVal = custLandmark.value.trim();
  if (landmarkVal.length < 2 || landmarkVal.length > 160 || hasUnsafeUrl(landmarkVal)) {
    custLandmark.focus();
    showToast('⚠ Please enter your Landmark / Gate # (2–160 characters, no links).');
    return false;
  }

  // 7. Cloudflare Turnstile Anti-Bot Security Check
  if (window.turnstile && turnstileWidgetId !== null) {
    const token = window.turnstile.getResponse(turnstileWidgetId);
    if (!token) {
      showToast('⚠ Please complete the security check (Turnstile) before submitting.');
      return false;
    }
  }

  return true;
}

async function submitOrderToSupabaseServer(rpcArgs) {
  if (!SUPABASE_URL || SUPABASE_URL.trim() === '') {
    const proxyRes = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcArgs),
      cache: 'no-store'
    });
    if (!proxyRes.ok) {
      const errText = (await proxyRes.text().catch(() => '')).slice(0, 300);
      throw new Error(errText || `Order rejected (${proxyRes.status})`);
    }
    return await proxyRes.json();
  }

  const cleanBaseUrl = SUPABASE_URL.trim().replace(/\/+$/, '');
  const rpcEndpoint = `${cleanBaseUrl}/rest/v1/rpc/submit_order`;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
  };

  const payload = {
    p_customer_name: rpcArgs.p_customer_name,
    p_phone: rpcArgs.p_phone,
    p_social_handle: rpcArgs.p_social_handle,
    p_fulfillment_mode: rpcArgs.p_fulfillment_mode,
    p_payment_method: rpcArgs.p_payment_method,
    p_location: rpcArgs.p_location,
    p_landmark: rpcArgs.p_landmark,
    p_items: rpcArgs.p_items,
    p_turnstile_token: rpcArgs.turnstile_token || rpcArgs.p_turnstile_token || null
  };

  const res = await fetch(rpcEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = (errData && errData.message) ? errData.message : `Order rejected (${res.status})`;
    throw new Error(msg);
  }
  return await res.json();
}

async function handleOrderSubmit() {
  if (isSubmittingOrder) return;
  const currentlyOpen = await syncStoreStatusOnly();
  if (!currentlyOpen) {
    showToast('⛔ Sorry, Crack & Cup is currently CLOSED for orders.');
    return;
  }
  if (!validateOrderForm()) return;

  const phoneCheck = verifyAndFormatPHPhone(custPhone.value);
  const verifiedE164Phone = phoneCheck.e164;

  const currentFingerprint = JSON.stringify({
    name: custName.value.trim().toLowerCase(),
    phone: verifiedE164Phone,
    social: custSocial.value.trim().toLowerCase(),
    location: custLocation.value.trim().toLowerCase(),
    landmark: custLandmark.value.trim().toLowerCase(),
    items: orderRows.map(r => `${r.itemId}:${r.size || 'Regular'}:${r.qty}:${r.notes}`)
  });

  if (currentFingerprint === lastSubmittedFingerprint) {
    showToast('✓ This exact order was already submitted! Edit items if sending a new order.');
    return;
  }

  isSubmittingOrder = true;
  const btn = document.getElementById('sendOrderDirectBtn');
  const originalLabel = '🚀 SUBMIT ORDER NOW';
  btn.innerHTML = '⏳ VERIFYING & SAVING...';
  btn.disabled = true;

  let turnstileToken = '';
  if (window.turnstile && turnstileWidgetId !== null) {
    turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
  }

  // Client sends ONLY customer inputs and items (No client-generated ID!)
  // Referral code is generated and guaranteed unique 100% by Supabase.
  const rpcPayload = {
    p_customer_name: custName.value.trim(),
    p_phone: verifiedE164Phone,
    p_social_handle: custSocial.value.trim(),
    p_fulfillment_mode: custFulfillment.value,
    p_payment_method: custPayment.value || 'Cash on Delivery (COD)',
    p_location: custLocation.value.trim(),
    p_landmark: custLandmark.value.trim(),
    p_items: orderRows.map(r => {
      const item = getMenuItemById(r.itemId);
      const validSize = (r.size === 'Upsize' && hasUpsize(item)) ? 'Upsize' : 'Regular';
      return {
        item_id: r.itemId,
        size: validSize,
        qty: parseInt(r.qty, 10) || 1,
        notes: (r.notes || '').trim().slice(0, 100)
      };
    }),
    turnstile_token: turnstileToken,
    p_turnstile_token: turnstileToken
  };

  try {
    const serverResult = await submitOrderToSupabaseServer(rpcPayload);

    const serverAssignedRef = (serverResult && serverResult.order_ref) || 'CONFIRMED';
    const verifiedTotal = (serverResult && serverResult.verified_total !== undefined)
      ? `₱${Number(serverResult.verified_total).toLocaleString()}`
      : summaryTotalAmount.textContent;

    orderReference = serverAssignedRef;
    if (orderRefCode) orderRefCode.textContent = serverAssignedRef;

    // Populate and display Referral Order ID Confirmation Box (Replaces form in central box)
    const confCard = document.getElementById('orderConfirmationCard');
    const confRef = document.getElementById('confirmedOrderRef');
    const confCust = document.getElementById('confCustomerName');
    const confQty = document.getElementById('confTotalQty');
    const confAmt = document.getElementById('confTotalAmount');
    const confFul = document.getElementById('confFulfillment');
    const confPay = document.getElementById('confPayment');
    const confStatusPill = document.getElementById('confStatusPill');
    const confStatusDetail = document.getElementById('confStatusDetail');

    if (confRef) confRef.textContent = serverAssignedRef;
    if (confCust) confCust.textContent = custName.value.trim();
    if (confQty) confQty.textContent = summaryTotalQty.textContent;
    if (confAmt) confAmt.textContent = verifiedTotal;
    if (confFul) confFul.textContent = custFulfillment.value;
    if (confPay) confPay.textContent = custPayment.value;

    const initialStatus = 'Pending';
    if (confStatusPill) {
      confStatusPill.textContent = 'STATUS: PENDING CONFIRMATION';
      confStatusPill.className = 'confirmation-status-pill status-pending';
    }
    if (confStatusDetail) {
      confStatusDetail.textContent = 'Pending';
      confStatusDetail.className = 'status-pill status-pending';
    }

    if (orderTableSection) {
      orderTableSection.classList.add('order-submitted-view');
    }
    if (confCard) {
      confCard.classList.remove('hidden');
    }

    if (document.body.classList.contains('mobile-mode')) {
      setMobilePage('order');
      const posterFrame = document.getElementById('mainPosterFrame');
      if (posterFrame) {
        posterFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (confCard) {
        confCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    lastSubmittedFingerprint = currentFingerprint;
    setCooldownUntil(Date.now() + 30000);
    recordHourlySubmission();

    // Copy ONLY the Order Code to clipboard
    await copyToClipboard(serverAssignedRef);

    showToast(`🎉 Order received! Status: Pending Confirmation. Order Code: ${serverAssignedRef} (copied).`);

    let remaining = 30;
    const cdInterval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        btn.textContent = `✓ SENT (${serverAssignedRef}) • WAIT ${remaining}s`;
      } else {
        clearInterval(cdInterval);
        btn.textContent = originalLabel;
        btn.disabled = false;
      }
    }, 1000);
  } catch (err) {
    const errMsg = err && err.message ? err.message : 'Network busy, please try again';
    showToast(`⚠ ${errMsg}`);
    btn.textContent = originalLabel;
    btn.disabled = false;
  } finally {
    isSubmittingOrder = false;
  }
}

// 15. HELPERS
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastNotice');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4500);
}

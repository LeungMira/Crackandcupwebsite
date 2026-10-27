/**
 * CRACK & CUP — RAGE ROOM & COFFEE SHOP
 * 100% Server-Authoritative Menu & Pricing via Supabase PostgreSQL
 */

// 1. CONFIGURATION (Retrieved from Cloudflare Pages Functions `/api/*` or GitHub Actions `window.__CNC_CONFIG__` — NOT hardcoded!)
const SUPABASE_URL = ((window.__CNC_CONFIG__ && window.__CNC_CONFIG__.SUPABASE_URL) || '').trim();
const SUPABASE_PUBLISHABLE_KEY = ((window.__CNC_CONFIG__ && window.__CNC_CONFIG__.SUPABASE_PUBLISHABLE_KEY) || '').trim();

// Menu is strictly obtained from the server (Zero hardcoded client fallback menu!)
let MENU_ITEMS = [];
let menuLoadState = 'loading'; // 'loading' | 'loaded' | 'error'

// 2. APPLICATION STATE
let orderRows = [];
let activeCategory = 'all';
let cardQuantities = {};
let orderReference = generateOrderRef();
let isManualMobilePreview = false;
let activeMobilePage = 'menu'; // 'menu' | 'order'

function initCardQuantities() {
  MENU_ITEMS.forEach(item => {
    if (!cardQuantities[item.id]) {
      cardQuantities[item.id] = 1;
    }
  });
}

function generateOrderRef() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `#CNC-${num}`;
}

// 3. DOM ELEMENTS
const menuGrid = document.getElementById('menuGrid');
const menuSection = document.getElementById('menu-section');
const orderTableSection = document.getElementById('order-table-section');
const orderNowPromptBox = document.getElementById('orderNowPromptBox');
const quickItemSelect = document.getElementById('quickItemSelect');
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
const liveOrderTemplatePreview = document.getElementById('liveOrderTemplatePreview');

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
document.addEventListener('DOMContentLoaded', async () => {
  orderRefCode.textContent = orderReference;
  orderDateStamp.textContent = `DATE: ${new Date().toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })}`;

  // Apply Mobile Detection immediately on load & on resize
  applyMobileModeState(true);
  window.addEventListener('resize', () => applyMobileModeState(false));

  attachEventListeners();

  // Render initial loading state and fetch menu strictly from server
  renderMenuGrid();
  renderOrderTable();
  setOrderControlsEnabled(false);

  await syncMenuFromServer();
});

function setOrderControlsEnabled(enabled) {
  [quickItemSelect, builderQtyMinus, builderQtyPlus, builderQtyInput, addToTableBtn, addBlankRowBtn, tableFooterAddBtn].forEach(el => {
    if (el) el.disabled = !enabled;
  });
  const sampleBtn = document.getElementById('loadSampleOrderBtn');
  if (sampleBtn) sampleBtn.disabled = !enabled;
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
      const headers = { 'apikey': SUPABASE_PUBLISHABLE_KEY };
      if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
      }
      res = await fetch(
        `${cleanBaseUrl}/rest/v1/menu_items?select=*&order=sort_order.asc`,
        { headers, signal: controller.signal }
      );
    } else {
      // Cloudflare Pages Function mode (Reads SUPABASE_URL & SUPABASE_PUBLISHABLE_KEY from Cloudflare Environment Variables)
      res = await fetch('/api/menu', { signal: controller.signal });
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const rawItems = await res.json();
    const serverItems = Array.isArray(rawItems)
      ? rawItems.filter(r => r.is_available !== false && r.available !== false)
      : [];

    if (serverItems.length === 0) {
      throw new Error('Empty menu returned from server');
    }

    const defaultVisuals = {
      'bowl-pork-bbq': { image: 'assets/pork-bbq-bowl.png', desc: 'Smoky glazed grilled pork belly slices over wok-charred egg chao fan.' },
      'bowl-sisig': { image: 'assets/sisig-bowl.jpg', desc: 'Savory sizzling sisig topped with a sunny-side egg, scallions & sesame.' },
      'bowl-cheesy-poppers': { image: 'assets/cheesy-poppers-bowl.jpg', desc: 'Crunchy golden chicken poppers drizzled with rich melted cheese sauce.' },
      'bowl-hungarian': { image: 'assets/hungarian-bowl.jpg', desc: 'Juicy char-grilled Hungarian sausage with smoky cheese drizzle over chao fan.' },
      'bowl-creamy-chicken': { image: 'assets/creamy-chicken-bowl.jpg', desc: 'Tender chicken bites in herbed garlic-cream glaze over egg fried rice.' },
      'bowl-adobo': { image: 'assets/adobo-bowl.jpg', desc: 'Slow-braised savory garlic pork adobo cubes with bay leaf & sesame.' },
      'bowl-liempo': { image: 'assets/liempo-bowl.jpg', desc: 'Char-grilled marinated pork belly strips served over signature chao fan.' },
      'b1': { image: 'assets/pork-bbq-bowl.png', desc: 'Smoky glazed grilled pork belly slices over wok-charred egg chao fan.' },
      'b2': { image: 'assets/sisig-bowl.jpg', desc: 'Savory sizzling sisig topped with a sunny-side egg, scallions & sesame.' },
      'b3': { image: 'assets/cheesy-poppers-bowl.jpg', desc: 'Crunchy golden chicken poppers drizzled with rich melted cheese sauce.' },
      'b4': { image: 'assets/hungarian-bowl.jpg', desc: 'Juicy char-grilled Hungarian sausage with smoky cheese drizzle over chao fan.' },
      'b5': { image: 'assets/creamy-chicken-bowl.jpg', desc: 'Tender chicken bites in herbed garlic-cream glaze over egg fried rice.' },
      'b6': { image: 'assets/adobo-bowl.jpg', desc: 'Slow-braised savory garlic pork adobo cubes with bay leaf & sesame.' },
      'b7': { image: 'assets/liempo-bowl.jpg', desc: 'Char-grilled marinated pork belly strips served over signature chao fan.' }
    };

    MENU_ITEMS = serverItems.map(row => {
      const vis = defaultVisuals[row.id] || { image: 'assets/sisig-bowl.jpg', desc: 'Freshly prepared Crack & Cup signature rice bowl.' };
      return {
        id: row.id,
        name: row.name,
        category: row.category || 'Chao Fan Bowls',
        price: Number(row.price),
        image: row.image || vis.image,
        desc: row.description || vis.desc
      };
    });

    menuLoadState = 'loaded';
    initCardQuantities();
    populateQuickItemSelect();
    updateBuilderBarPreview();

    setOrderControlsEnabled(true);
    renderMenuGrid();
    renderOrderTable();
  } catch {
    MENU_ITEMS = [];
    menuLoadState = 'error';
    setOrderControlsEnabled(false);
    renderMenuGrid();
    renderOrderTable();
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
    const lineAmt = qty * Number(item.price);
    const safeId = escapeHtml(item.id);
    const safeName = escapeHtml(item.name);
    const safeCat = escapeHtml(item.category);
    const safeDesc = escapeHtml(item.desc);
    const safeImg = escapeHtml(item.image);

    return `
      <article class="menu-card" data-item-id="${safeId}">
        <div class="menu-card-top">
          <img src="${safeImg}" alt="${safeName}" class="menu-card-img" loading="lazy" />
          <span class="menu-price-sticker">₱${Number(item.price)}</span>
          <span class="menu-cat-tag">${safeCat}</span>
        </div>
        <div class="menu-card-body">
          <h3 class="menu-item-title">${safeName}</h3>
          <p class="menu-item-desc">${safeDesc}</p>

          <div class="menu-card-actions">
            <button type="button" class="card-add-btn" data-action="card-add" data-id="${safeId}">
              + ADD TO TABLE
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
  const qty = Math.max(1, Math.min(30, parseInt(builderQtyInput.value, 10) || 1));
  const amount = item.price * qty;
  builderComputedAmount.textContent = `₱${amount.toLocaleString()}`;
}

// 10. ADD ITEM TO ORDER TABLE
function addItemToOrderTable(itemId, qty = 1, notes = '') {
  if (menuLoadState !== 'loaded') {
    showToast('ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.');
    return;
  }
  const cleanQty = Math.max(1, Math.min(30, parseInt(qty, 10) || 1));
  const menuObj = MENU_ITEMS.find(m => m.id === itemId);
  if (!menuObj) return;

  const existingRow = orderRows.find(r => r.itemId === itemId && (!notes || r.notes === notes));
  if (existingRow) {
    existingRow.qty = Math.min(30, existingRow.qty + cleanQty);
    renderOrderTable();
    showToast(`Updated: ${existingRow.qty}x ${menuObj.name} (₱${existingRow.qty * menuObj.price})`);
    return;
  }

  if (orderRows.length >= 20) {
    showToast('⚠ Submission limiter: Maximum 20 line items per order.');
    return;
  }

  orderRows.push({
    rowId: cryptoRowId(),
    itemId: menuObj.id,
    qty: cleanQty,
    notes: notes || ''
  });
  renderOrderTable();
  showToast(`Added to table: ${cleanQty}x ${menuObj.name} (₱${cleanQty * menuObj.price})`);
}

// 11. RENDER THE ORDER FILLOUT TABLE
function buildRowSelectOptions(selectedId) {
  let html = '';
  const categories = [...new Set(MENU_ITEMS.map(i => i.category))];
  categories.forEach(cat => {
    html += `<optgroup label="${escapeHtml(cat)}">`;
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
      const lineTotal = row.qty * menuObj.price;

      return `
        <tr data-row-id="${row.rowId}">
          <td class="col-num">${idx + 1}</td>

          <td class="col-item">
            <div class="row-item-wrap">
              <select class="row-select" data-row-action="select-item" data-row-id="${row.rowId}" aria-label="Select item for row ${idx + 1}">
                ${buildRowSelectOptions(menuObj.id)}
              </select>
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
                <span class="unit-price-tag">@₱${menuObj.price}</span>
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
    return acc + ((parseInt(r.qty, 10) || 0) * item.price);
  }, 0);

  summaryTotalQty.textContent = `${totalQty} ${totalQty === 1 ? 'item' : 'items'}`;
  summaryTotalAmount.textContent = `₱${totalAmount.toLocaleString()}`;
  if (headerCartCount) headerCartCount.textContent = totalQty;
  if (mobileOrderCountBadge) mobileOrderCountBadge.textContent = totalQty;

  liveOrderTemplatePreview.textContent = generateOrderTemplateText();
}

// 12. LOCAL PREVIEW TICKET (All Required Fields Outputted, No Preferred Time)
function generateOrderTemplateText() {
  const totalQty = orderRows.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
  const totalAmount = orderRows.reduce((acc, r) => {
    const item = getMenuItemById(r.itemId);
    return acc + ((parseInt(r.qty, 10) || 0) * item.price);
  }, 0);

  const name = custName.value.trim() || '[Required: Customer Name]';
  const phoneCheck = verifyAndFormatPHPhone(custPhone.value);
  const phoneDisplay = phoneCheck.valid ? phoneCheck.e164 : (custPhone.value.trim() || '[Required: Verified PH Phone #]');
  const social = custSocial.value.trim() || '[Required: FB / IG Handle]';
  const mode = custFulfillment.value;
  const payment = custPayment.value || 'Cash on Delivery (COD)';
  const location = custLocation.value.trim() || '[Required: Complete Delivery Address / Location]';
  const landmark = custLandmark.value.trim() || '[Required: Landmark / Gate #]';

  const itemsLines = orderRows.length > 0
    ? orderRows.map((r, i) => {
      const item = getMenuItemById(r.itemId);
      const lineAmt = r.qty * item.price;
      const noteStr = r.notes ? ` (${r.notes})` : '';
      return `${i + 1}. [${r.qty}x] ${item.name}${noteStr} — ₱${lineAmt.toLocaleString()} (@₱${item.price})`;
    }).join('\n')
    : '   (No items added yet)';

  return [
    `=========================================`,
    `★ CRACK & CUP — OFFICIAL ORDER TICKET ★`,
    `"Come to lose the blues, stay for the brews."`,
    `=========================================`,
    `ORDER REF : ${orderReference}`,
    `TIMESTAMP : ${new Date().toLocaleString('en-PH')}`,
    `-----------------------------------------`,
    `📋 ORDER ITEMS TABLE:`,
    itemsLines,
    `-----------------------------------------`,
    `TOTAL QUANTITY : ${totalQty} item(s)`,
    `GRAND TOTAL    : ₱${totalAmount.toLocaleString()}`,
    `=========================================`,
    `📍 CUSTOMER CONTACT & LOCATION:`,
    `• Name      : ${name}`,
    `• Contact # : ${phoneDisplay}`,
    `• FB / IG   : ${social}`,
    `• Order Mode: ${mode}`,
    `• Payment   : ${payment}`,
    `• Location  : ${location}`,
    `• Landmark  : ${landmark}`,
    `=========================================`
  ].join('\n');
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

  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category;
      renderMenuGrid();
    });
  });

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

  menuGrid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'retry-menu') {
      syncMenuFromServer();
      return;
    }

    if (action === 'card-minus') {
      cardQuantities[id] = Math.max(1, (cardQuantities[id] || 1) - 1);
      renderMenuGrid();
    } else if (action === 'card-plus') {
      cardQuantities[id] = Math.min(30, (cardQuantities[id] || 1) + 1);
      renderMenuGrid();
    } else if (action === 'card-add') {
      const qtyToAdd = cardQuantities[id] || 1;
      addItemToOrderTable(id, qtyToAdd);
      cardQuantities[id] = 1;
      renderMenuGrid();
      openOrderingTable(true);
    }
  });

  quickItemSelect.addEventListener('change', updateBuilderBarPreview);

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
    addItemToOrderTable(item.id, qty);
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
      }
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
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.');
      return;
    }
    detectLocationBtn.textContent = '⏳ LOCATING...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        const existing = custLocation.value.trim();
        custLocation.value = existing ? `${existing} (${mapsUrl})` : `GPS Pin: ${mapsUrl}`;
        detectLocationBtn.textContent = '✓ GPS PINNED!';
        updateTotalsAndTemplate();
        showToast('Pinned your GPS coordinates to the Location field!');
        setTimeout(() => {
          detectLocationBtn.textContent = '📍 PIN MY CURRENT GPS LOCATION';
        }, 3000);
      },
      () => {
        detectLocationBtn.textContent = '📍 PIN MY CURRENT GPS LOCATION';
        showToast('Could not auto-detect GPS. Please type your address manually.');
      }
    );
  });

  document.getElementById('loadSampleOrderBtn').addEventListener('click', () => {
    if (menuLoadState !== 'loaded' || MENU_ITEMS.length === 0) {
      showToast('ERROR MENU FAILED TO RETRIEVE, Please check your connection and try again.');
      return;
    }
    orderRows = [
      {
        rowId: cryptoRowId(),
        itemId: MENU_ITEMS[0].id,
        qty: 2,
        notes: 'Spicy chili oil on side'
      },
      {
        rowId: cryptoRowId(),
        itemId: (MENU_ITEMS[1] || MENU_ITEMS[0]).id,
        qty: 1,
        notes: 'Extra crispy'
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
    orderReference = generateOrderRef();
    orderRefCode.textContent = orderReference;
    renderOrderTable();
    showToast('Order table cleared.');
  });

  document.getElementById('copyOrderTemplateBtn').addEventListener('click', async () => {
    const text = liveOrderTemplatePreview.textContent || generateOrderTemplateText();
    await copyToClipboard(text);
    showToast('✓ Order template copied to clipboard!');
  });

  document.getElementById('downloadReceiptTxtBtn').addEventListener('click', () => {
    const text = liveOrderTemplatePreview.textContent || generateOrderTemplateText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CrackAndCup-Order-${orderReference.replace('#', '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded order ticket (.txt)!');
  });

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

function validateOrderForm() {
  const honeypot = document.getElementById('websiteHoneypot');
  if (honeypot && honeypot.value.trim() !== '') {
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
  if (nameVal.length < 2 || nameVal.length > 80) {
    custName.focus();
    showToast('⚠ Please enter your Name / Nickname (2–80 characters).');
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

  // 4. Order Type & Payment (COD / Payment on Delivery Only!)
  if (!['Delivery', 'Pick-Up', 'Dine-In'].includes(custFulfillment.value)) {
    custFulfillment.focus();
    showToast('⚠ Please select a valid Order Mode.');
    return false;
  }

  if (!['Cash on Delivery (COD)', 'Payment on Delivery'].includes(custPayment.value)) {
    custPayment.focus();
    showToast('⚠ Only Cash on Delivery (COD) / Payment on Delivery is accepted right now.');
    return false;
  }

  // 5. Complete Location / Address (Required, 4–280 chars)
  const locVal = custLocation.value.trim();
  if (locVal.length < 4 || locVal.length > 280) {
    custLocation.focus();
    showToast('⚠ Please enter your Complete Delivery Address / Location (min 4 characters).');
    return false;
  }

  // 6. Landmark / Gate # (Required — All fields must be filled to submit!)
  const landmarkVal = custLandmark.value.trim();
  if (landmarkVal.length < 2 || landmarkVal.length > 160) {
    custLandmark.focus();
    showToast('⚠ Please enter your Landmark / Gate # (All fields are required).');
    return false;
  }

  return true;
}

async function submitOrderToSupabaseServer(rpcArgs, maxRetries = 3) {
  if (!SUPABASE_URL || SUPABASE_URL.trim() === '') {
    const proxyRes = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcArgs)
    });
    if (!proxyRes.ok) {
      const errText = await proxyRes.text();
      throw new Error(errText || `Order rejected (${proxyRes.status})`);
    }
    return await proxyRes.json();
  }

  const cleanBaseUrl = SUPABASE_URL.trim().replace(/\/+$/, '');
  const rpcEndpoint = `${cleanBaseUrl}/rest/v1/rpc/submit_order`;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_PUBLISHABLE_KEY
  };
  if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(rpcEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcArgs)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.message || `Order rejected (${res.status})`;
        if (res.status >= 400 && res.status < 500) {
          throw new Error(msg);
        }
        throw new Error(msg);
      }
      return await res.json();
    } catch (err) {
      if (
        attempt === maxRetries ||
        String(err.message).includes('limit') ||
        String(err.message).includes('Invalid') ||
        String(err.message).includes('required')
      ) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 350);
      await new Promise(r => setTimeout(r, attempt * 900 + jitter));
    }
  }
}

async function handleOrderSubmit() {
  if (isSubmittingOrder) return;
  if (!validateOrderForm()) return;

  const phoneCheck = verifyAndFormatPHPhone(custPhone.value);
  const verifiedE164Phone = phoneCheck.e164;

  const currentFingerprint = JSON.stringify({
    name: custName.value.trim().toLowerCase(),
    phone: verifiedE164Phone,
    social: custSocial.value.trim().toLowerCase(),
    location: custLocation.value.trim().toLowerCase(),
    landmark: custLandmark.value.trim().toLowerCase(),
    items: orderRows.map(r => `${r.itemId}:${r.qty}:${r.notes}`)
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

  const submittedRef = orderReference;

  // Client sends ONLY verified fields + item_id, qty, notes (9 arguments — Preferred Time removed, COD enforced)
  const rpcPayload = {
    p_order_ref: submittedRef,
    p_customer_name: custName.value.trim(),
    p_phone: verifiedE164Phone,
    p_social_handle: custSocial.value.trim(),
    p_fulfillment_mode: custFulfillment.value,
    p_payment_method: 'Cash on Delivery (COD)',
    p_location: custLocation.value.trim(),
    p_landmark: custLandmark.value.trim(),
    p_items: orderRows.map(r => ({
      item_id: r.itemId,
      qty: parseInt(r.qty, 10) || 1,
      notes: (r.notes || '').trim().slice(0, 100)
    }))
  };

  try {
    const serverResult = await submitOrderToSupabaseServer(rpcPayload);

    const serverAssignedRef = (serverResult && serverResult.order_ref)
      ? serverResult.order_ref
      : submittedRef;
    const verifiedReceipt = (serverResult && serverResult.verified_receipt)
      ? serverResult.verified_receipt
      : generateOrderTemplateText();
    const verifiedTotal = (serverResult && serverResult.verified_total !== undefined)
      ? `₱${Number(serverResult.verified_total).toLocaleString()}`
      : summaryTotalAmount.textContent;

    orderReference = serverAssignedRef;
    orderRefCode.textContent = serverAssignedRef;
    liveOrderTemplatePreview.textContent = verifiedReceipt;
    lastSubmittedFingerprint = currentFingerprint;
    setCooldownUntil(Date.now() + 30000);
    recordHourlySubmission();
    await copyToClipboard(verifiedReceipt);

    showToast(`🎉 Order ${serverAssignedRef} verified (${verifiedTotal}) & saved! Receipt copied.`);

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

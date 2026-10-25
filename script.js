/**
 * CRACK & CUP — RAGE ROOM & COFFEE SHOP
 * Interactive Auto-Template Order Table, Menu Quick-Add & No-VPS Order Sender
 */

// 1. CONFIGURATION
// Permanent Google Sheets Apps Script Webhook URL (Serverless Order Logging)
const GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzQuLoWNTYeV6tNPpuCvTpCvGVlz0kJ6kYbhQH7jB5tDUv6IgYMhcbVMifCg65hp5XzCQ/exec';

// 2. MENU CATALOG (Only Pictured Food Items — No Smash Room Add-ons; Unpictured items replaced with "More items soon!")
const MENU_ITEMS = [
  {
    id: 'bowl-pork-bbq',
    name: 'Pork BBQ Chao Fan Bowl',
    category: 'Chao Fan Bowls',
    price: 120,
    image: 'assets/pork-bbq-bowl.png',
    desc: 'Smoky glazed grilled pork belly slices over wok-charred egg chao fan.'
  },
  {
    id: 'bowl-sisig',
    name: 'Crispy Pork Sisig Rice Bowl',
    category: 'Chao Fan Bowls',
    price: 99,
    image: 'assets/sisig-bowl.jpg',
    desc: 'Savory sizzling sisig topped with a sunny-side egg, scallions & sesame.'
  },
  {
    id: 'bowl-cheesy-poppers',
    name: 'Cheesy Chicken Poppers Chao Fan',
    category: 'Chao Fan Bowls',
    price: 79,
    image: 'assets/cheesy-poppers-bowl.jpg',
    desc: 'Crunchy golden chicken poppers drizzled with rich melted cheese sauce.'
  },
  {
    id: 'bowl-hungarian',
    name: 'Cheesy Hungarian Sausage Bowl',
    category: 'Chao Fan Bowls',
    price: 89,
    image: 'assets/hungarian-bowl.jpg',
    desc: 'Juicy char-grilled Hungarian sausage with smoky cheese drizzle over chao fan.'
  },
  {
    id: 'bowl-creamy-chicken',
    name: 'Creamy Garlic Chicken Bowl',
    category: 'Chao Fan Bowls',
    price: 95,
    image: 'assets/creamy-chicken-bowl.jpg',
    desc: 'Tender chicken bites in herbed garlic-cream glaze over egg fried rice.'
  },
  {
    id: 'bowl-adobo',
    name: 'Classic Pork Adobo Glaze Bowl',
    category: 'Chao Fan Bowls',
    price: 99,
    image: 'assets/adobo-bowl.jpg',
    desc: 'Slow-braised savory garlic pork adobo cubes with bay leaf & sesame.'
  },
  {
    id: 'bowl-liempo',
    name: 'Grilled Liempo Chao Fan',
    category: 'Chao Fan Bowls',
    price: 115,
    image: 'assets/liempo-bowl.jpg',
    desc: 'Char-grilled marinated pork belly strips served over signature chao fan.'
  }
];

// 2. APPLICATION STATE
let orderRows = [];
let activeCategory = 'all';
let cardQuantities = {}; // tracks quick-add card qty before adding
let orderReference = generateOrderRef();

// Initialize default card quantities to 1
MENU_ITEMS.forEach(item => {
  cardQuantities[item.id] = 1;
});

function generateOrderRef() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `#CNC-${num}`;
}

// 3. DOM ELEMENTS
const menuGrid = document.getElementById('menuGrid');
const orderTableSection = document.getElementById('order-table-section');
const orderNowPromptBox = document.getElementById('orderNowPromptBox');
const quickItemSelect = document.getElementById('quickItemSelect');
const customItemInputs = document.getElementById('customItemInputs');
const customItemName = document.getElementById('customItemName');
const customItemPrice = document.getElementById('customItemPrice');
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
const orderRefCode = document.getElementById('orderRefCode');
const orderDateStamp = document.getElementById('orderDateStamp');
const liveOrderTemplatePreview = document.getElementById('liveOrderTemplatePreview');

// Contact & Location Inputs at Bottom of Table
const custName = document.getElementById('custName');
const custPhone = document.getElementById('custPhone');
const custSocial = document.getElementById('custSocial');
const custFulfillment = document.getElementById('custFulfillment');
const custPayment = document.getElementById('custPayment');
const custLocation = document.getElementById('custLocation');
const custLandmark = document.getElementById('custLandmark');
const custTime = document.getElementById('custTime');
const detectLocationBtn = document.getElementById('detectLocationBtn');

// 4. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  orderRefCode.textContent = orderReference;
  orderDateStamp.textContent = `DATE: ${new Date().toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })}`;

  populateQuickItemSelect();
  renderMenuGrid();
  updateBuilderBarPreview();
  orderRows = [
    {
      rowId: cryptoRowId(),
      itemId: 'bowl-sisig',
      customName: 'Crispy Pork Sisig Rice Bowl',
      unitPrice: 99,
      qty: 1,
      notes: ''
    }
  ];

  renderOrderTable();
  attachEventListeners();
});

function cryptoRowId() {
  return 'row-' + Math.random().toString(36).substring(2, 9);
}

// Helper to reveal the Ordering Table when any ORDER NOW button is clicked
function openOrderingTable(scrollToIt = true) {
  orderTableSection.classList.remove('hidden');
  if (orderNowPromptBox) {
    orderNowPromptBox.classList.add('hidden');
  }
  if (scrollToIt) {
    orderTableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function hideOrderingTable() {
  orderTableSection.classList.add('hidden');
  if (orderNowPromptBox) {
    orderNowPromptBox.classList.remove('hidden');
  }
  document.getElementById('menu-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 5. POPULATE QUICK SELECT DROPDOWN
function populateQuickItemSelect() {
  const categories = [...new Set(MENU_ITEMS.map(i => i.category))];
  let html = '';

  categories.forEach(cat => {
    html += `<optgroup label="★ ${cat.toUpperCase()}">`;
    MENU_ITEMS.filter(i => i.category === cat).forEach(item => {
      html += `<option value="${item.id}">${item.name} — ₱${item.price}</option>`;
    });
    html += `</optgroup>`;
  });

  html += `<optgroup label="★ CUSTOM FOOD / DRINK ITEM">`;
  html += `<option value="custom">✎ Custom Item / Drink (Type Name & Price)...</option>`;
  html += `</optgroup>`;

  quickItemSelect.innerHTML = html;
}

// 6. RENDER VISUAL MENU CARDS (Only Pictured Items + "(More items soon!)" Card)
function renderMenuGrid() {
  const filtered = activeCategory === 'all'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === activeCategory);

  const cardsHtml = filtered.map(item => {
    const qty = cardQuantities[item.id] || 1;
    const lineAmt = qty * item.price;

    return `
      <article class="menu-card" data-item-id="${item.id}">
        <div class="menu-card-top">
          <img src="${item.image}" alt="${item.name}" class="menu-card-img" loading="lazy" />
          <span class="menu-price-sticker">₱${item.price}</span>
          <span class="menu-cat-tag">${item.category}</span>
        </div>
        <div class="menu-card-body">
          <h3 class="menu-item-title">${item.name}</h3>
          <p class="menu-item-desc">${item.desc}</p>

          <!-- Button that adds item to table + button next to it for Quantity & Amount -->
          <div class="menu-card-actions">
            <button type="button" class="card-add-btn" data-action="card-add" data-id="${item.id}">
              + ADD TO TABLE
            </button>
            <div class="card-qty-amt-box" title="Quantity & Total Amount for this item">
              <button type="button" class="card-qty-btn" data-action="card-minus" data-id="${item.id}" aria-label="Decrease quantity">−</button>
              <span class="card-qty-val">${qty}</span>
              <button type="button" class="card-qty-btn" data-action="card-plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
              <span class="card-amt-badge">₱${lineAmt}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Always include the "(More items soon!)" card in the menu grid
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

// 7. UPDATE TOP BUILDER BAR (Quantity & Amount Pill next to Add Item button)
function getSelectedBuilderItem() {
  const val = quickItemSelect.value;
  if (val === 'custom') {
    const name = customItemName.value.trim() || 'Custom Order Item';
    const price = Math.max(0, parseFloat(customItemPrice.value) || 0);
    return { id: 'custom', name, price };
  }
  const found = MENU_ITEMS.find(i => i.id === val) || MENU_ITEMS[0];
  return { id: found.id, name: found.name, price: found.price };
}

function updateBuilderBarPreview() {
  const isCustom = quickItemSelect.value === 'custom';
  customItemInputs.classList.toggle('hidden', !isCustom);

  const item = getSelectedBuilderItem();
  const qty = Math.max(1, parseInt(builderQtyInput.value, 10) || 1);
  const amount = item.price * qty;
  builderComputedAmount.textContent = `₱${amount.toLocaleString()}`;
}

// 8. ADD ITEM TO ORDER TABLE
function addItemToOrderTable(itemId, qty = 1, customName = '', customPrice = 0, notes = '') {
  const cleanQty = Math.max(1, parseInt(qty, 10) || 1);

  if (itemId !== 'custom') {
    const menuObj = MENU_ITEMS.find(m => m.id === itemId);
    if (!menuObj) return;

    const existingRow = orderRows.find(r => r.itemId === itemId && (!notes || r.notes === notes));
    if (existingRow) {
      existingRow.qty += cleanQty;
      renderOrderTable();
      showToast(`Updated: ${existingRow.qty}x ${menuObj.name} (₱${existingRow.qty * existingRow.unitPrice})`);
      return;
    }

    orderRows.push({
      rowId: cryptoRowId(),
      itemId: menuObj.id,
      customName: menuObj.name,
      unitPrice: menuObj.price,
      qty: cleanQty,
      notes: notes || ''
    });
    renderOrderTable();
    showToast(`Added to table: ${cleanQty}x ${menuObj.name} (₱${cleanQty * menuObj.price})`);
  } else {
    const finalName = customName || 'Custom Item';
    const finalPrice = Math.max(0, parseFloat(customPrice) || 0);
    orderRows.push({
      rowId: cryptoRowId(),
      itemId: 'custom',
      customName: finalName,
      unitPrice: finalPrice,
      qty: cleanQty,
      notes: notes || ''
    });
    renderOrderTable();
    showToast(`Added custom item: ${cleanQty}x ${finalName}`);
  }
}

// 9. RENDER THE ORDER FILLOUT TABLE
function buildRowSelectOptions(selectedId) {
  let html = '';
  const categories = [...new Set(MENU_ITEMS.map(i => i.category))];
  categories.forEach(cat => {
    html += `<optgroup label="${cat}">`;
    MENU_ITEMS.filter(i => i.category === cat).forEach(item => {
      const sel = item.id === selectedId ? 'selected' : '';
      html += `<option value="${item.id}" ${sel}>${item.name} (₱${item.price})</option>`;
    });
    html += `</optgroup>`;
  });
  const isCustom = selectedId === 'custom' ? 'selected' : '';
  html += `<optgroup label="Custom"><option value="custom" ${isCustom}>✎ Custom Item / Drink...</option></optgroup>`;
  return html;
}

function renderOrderTable() {
  if (orderRows.length === 0) {
    orderTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 26px; font-family: var(--font-mono);">
          No items in your order table yet! Click <strong>+ ADD ITEM TO TABLE</strong> above or <strong>+ ADD ANOTHER ITEM ROW</strong> below.
        </td>
      </tr>
    `;
  } else {
    orderTableBody.innerHTML = orderRows.map((row, idx) => {
      const lineTotal = row.qty * row.unitPrice;
      const isCustom = row.itemId === 'custom';

      return `
        <tr data-row-id="${row.rowId}">
          <td class="col-num">${idx + 1}</td>

          <!-- Item Template Selection -->
          <td class="col-item">
            <div class="row-item-wrap">
              <select class="row-select" data-row-action="select-item" data-row-id="${row.rowId}" aria-label="Select item for row ${idx + 1}">
                ${buildRowSelectOptions(row.itemId)}
              </select>
              ${isCustom ? `
                <div style="display:flex; gap:6px;">
                  <input type="text" class="row-custom-input" data-row-action="custom-name" data-row-id="${row.rowId}" value="${escapeHtml(row.customName)}" placeholder="Custom item name..." />
                  <input type="number" class="row-custom-input" style="width:95px;" data-row-action="custom-price" data-row-id="${row.rowId}" value="${row.unitPrice}" min="0" placeholder="₱ Price" />
                </div>
              ` : ''}
            </div>
          </td>

          <!-- Notes / Add-ons -->
          <td class="col-notes">
            <input
              type="text"
              class="row-notes-input"
              data-row-action="edit-notes"
              data-row-id="${row.rowId}"
              value="${escapeHtml(row.notes)}"
              placeholder="e.g. Extra chili, +Egg, no scallions..."
            />
          </td>

          <!-- Quantity & Amount Button/Controls Right Next to It -->
          <td class="col-qty-amt">
            <div class="row-qty-amt-control">
              <div class="row-stepper" title="Change Quantity">
                <button type="button" class="row-step-btn" data-row-action="qty-minus" data-row-id="${row.rowId}" aria-label="Decrease quantity">−</button>
                <input type="number" class="row-qty-input" data-row-action="qty-input" data-row-id="${row.rowId}" value="${row.qty}" min="1" max="99" aria-label="Quantity" />
                <button type="button" class="row-step-btn" data-row-action="qty-plus" data-row-id="${row.rowId}" aria-label="Increase quantity">+</button>
              </div>

              <div class="row-amount-box" title="Unit Price × Quantity = Line Amount">
                <span class="unit-price-tag">@₱${row.unitPrice}</span>
                <span class="row-line-total">₱${lineTotal.toLocaleString()}</span>
              </div>
            </div>
          </td>

          <!-- Remove Row -->
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
  const totalAmount = orderRows.reduce((acc, r) => acc + ((parseInt(r.qty, 10) || 0) * (parseFloat(r.unitPrice) || 0)), 0);

  summaryTotalQty.textContent = `${totalQty} ${totalQty === 1 ? 'item' : 'items'}`;
  summaryTotalAmount.textContent = `₱${totalAmount.toLocaleString()}`;
  headerCartCount.textContent = totalQty;

  liveOrderTemplatePreview.textContent = generateOrderTemplateText();
}

// 10. GENERATE AUTO-TEMPLATE TEXT FOR POSTING / MESSENGER / GOOGLE SHEETS
function generateOrderTemplateText() {
  const totalQty = orderRows.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
  const totalAmount = orderRows.reduce((acc, r) => acc + ((parseInt(r.qty, 10) || 0) * (parseFloat(r.unitPrice) || 0)), 0);

  const name = custName.value.trim() || '[Your Name]';
  const phone = custPhone.value.trim() || '[Your Contact #]';
  const social = custSocial.value.trim() || 'N/A';
  const mode = custFulfillment.value;
  const payment = custPayment.value;
  const location = custLocation.value.trim() || '[Your Complete Delivery Address / Location]';
  const landmark = custLandmark.value.trim() || 'N/A';
  const timeNote = custTime.value.trim() || 'ASAP';

  const itemsLines = orderRows.length > 0
    ? orderRows.map((r, i) => {
        const lineAmt = r.qty * r.unitPrice;
        const noteStr = r.notes ? ` (${r.notes})` : '';
        return `${i + 1}. [${r.qty}x] ${r.customName}${noteStr} — ₱${lineAmt.toLocaleString()} (@₱${r.unitPrice})`;
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
    `• Contact # : ${phone}`,
    `• FB / IG   : ${social}`,
    `• Order Mode: ${mode} (${payment})`,
    `• Location  : ${location}`,
    `• Landmark  : ${landmark}`,
    `• Time/Note : ${timeNote}`,
    `=========================================`
  ].join('\n');
}

// 11. EVENT LISTENERS
function attachEventListeners() {
  // ORDER NOW Buttons -> Reveal the Auto-Template Fillout Order Table!
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

  // Category Tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category;
      renderMenuGrid();
    });
  });

  // Photo B&W vs Color Toggle
  const togglePhotoModeBtn = document.getElementById('togglePhotoModeBtn');
  const photoModeLabel = document.getElementById('photoModeLabel');
  togglePhotoModeBtn.addEventListener('click', () => {
    const isColor = document.body.classList.toggle('color-photos');
    photoModeLabel.textContent = isColor ? 'FULL COLOR' : 'B&W INK';
  });

  // Menu Grid Delegated Actions (Card +Add, Card Qty -, Card Qty +)
  menuGrid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'card-minus') {
      cardQuantities[id] = Math.max(1, (cardQuantities[id] || 1) - 1);
      renderMenuGrid();
    } else if (action === 'card-plus') {
      cardQuantities[id] = Math.min(99, (cardQuantities[id] || 1) + 1);
      renderMenuGrid();
    } else if (action === 'card-add') {
      const qtyToAdd = cardQuantities[id] || 1;
      addItemToOrderTable(id, qtyToAdd);
      cardQuantities[id] = 1;
      renderMenuGrid();
      openOrderingTable(true);
    }
  });

  // Top Builder Bar Controls
  quickItemSelect.addEventListener('change', updateBuilderBarPreview);
  customItemName.addEventListener('input', updateBuilderBarPreview);
  customItemPrice.addEventListener('input', updateBuilderBarPreview);

  builderQtyMinus.addEventListener('click', () => {
    builderQtyInput.value = Math.max(1, (parseInt(builderQtyInput.value, 10) || 1) - 1);
    updateBuilderBarPreview();
  });

  builderQtyPlus.addEventListener('click', () => {
    builderQtyInput.value = Math.min(99, (parseInt(builderQtyInput.value, 10) || 1) + 1);
    updateBuilderBarPreview();
  });

  builderQtyInput.addEventListener('input', updateBuilderBarPreview);

  addToTableBtn.addEventListener('click', () => {
    const item = getSelectedBuilderItem();
    const qty = Math.max(1, parseInt(builderQtyInput.value, 10) || 1);
    addItemToOrderTable(item.id, qty, item.name, item.price);
    builderQtyInput.value = 1;
    updateBuilderBarPreview();
  });

  // Add New Blank/Default Row Button
  const insertBlankRow = () => {
    const firstItem = MENU_ITEMS[0];
    orderRows.push({
      rowId: cryptoRowId(),
      itemId: firstItem.id,
      customName: firstItem.name,
      unitPrice: firstItem.price,
      qty: 1,
      notes: ''
    });
    renderOrderTable();
    showToast('Inserted a new item row into the table!');
  };

  addBlankRowBtn.addEventListener('click', insertBlankRow);
  tableFooterAddBtn.addEventListener('click', insertBlankRow);

  // Order Table Row Delegated Events
  orderTableBody.addEventListener('click', e => {
    const btn = e.target.closest('[data-row-action]');
    if (!btn) return;
    const action = btn.dataset.rowAction;
    const rowId = btn.dataset.rowId;
    const row = orderRows.find(r => r.rowId === rowId);
    if (!row) return;

    if (action === 'qty-minus') {
      row.qty = Math.max(1, row.qty - 1);
      renderOrderTable();
    } else if (action === 'qty-plus') {
      row.qty = Math.min(99, row.qty + 1);
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
      const val = el.value;
      row.itemId = val;
      if (val !== 'custom') {
        const found = MENU_ITEMS.find(m => m.id === val);
        if (found) {
          row.customName = found.name;
          row.unitPrice = found.price;
        }
      } else {
        row.customName = 'Custom Item';
        row.unitPrice = 89;
      }
      renderOrderTable();
    } else if (action === 'qty-input') {
      row.qty = Math.max(1, Math.min(99, parseInt(el.value, 10) || 1));
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
      row.notes = el.value;
      updateTotalsAndTemplate();
    } else if (action === 'custom-name') {
      row.customName = el.value;
      updateTotalsAndTemplate();
    } else if (action === 'custom-price') {
      row.unitPrice = Math.max(0, parseFloat(el.value) || 0);
      renderOrderTable();
    }
  });

  // Contact & Location Live Template Sync
  [custName, custPhone, custSocial, custFulfillment, custPayment, custLocation, custLandmark, custTime].forEach(input => {
    input.addEventListener('input', updateTotalsAndTemplate);
    input.addEventListener('change', updateTotalsAndTemplate);
  });

  // GPS Location Pin Button
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

  // Sample Fill & Reset Buttons
  document.getElementById('loadSampleOrderBtn').addEventListener('click', () => {
    orderRows = [
      {
        rowId: cryptoRowId(),
        itemId: 'bowl-pork-bbq',
        customName: 'Pork BBQ Chao Fan Bowl',
        unitPrice: 120,
        qty: 2,
        notes: 'Spicy chili oil on side'
      },
      {
        rowId: cryptoRowId(),
        itemId: 'bowl-sisig',
        customName: 'Crispy Pork Sisig Rice Bowl',
        unitPrice: 99,
        qty: 1,
        notes: 'Extra crispy'
      },
      {
        rowId: cryptoRowId(),
        itemId: 'bowl-cheesy-poppers',
        customName: 'Cheesy Chicken Poppers Chao Fan',
        unitPrice: 79,
        qty: 2,
        notes: 'Extra cheese drizzle'
      }
    ];
    custName.value = 'Alex Rivera';
    custPhone.value = '0917 888 4321';
    custSocial.value = '@alexrivera_ph';
    custFulfillment.value = 'Delivery';
    custPayment.value = 'GCash';
    custLocation.value = 'Blk 4 Lot 12 Patio Jacinto, Molino 3, Bacoor, Cavite';
    custLandmark.value = 'White minimalist gate near the clubhouse';
    custTime.value = 'Deliver food by 5:00 PM';
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

  // Copy Auto-Template Button
  document.getElementById('copyOrderTemplateBtn').addEventListener('click', async () => {
    const text = generateOrderTemplateText();
    await copyToClipboard(text);
    showToast('✓ Order template copied to clipboard! Ready to paste anywhere.');
  });

  // Save .TXT Receipt Button
  document.getElementById('downloadReceiptTxtBtn').addEventListener('click', () => {
    const text = generateOrderTemplateText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CrackAndCup-Order-${orderReference.replace('#', '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded order ticket (.txt)!');
  });

  // Direct Submit Button (Sends to Google Sheets)
  document.getElementById('sendOrderDirectBtn').addEventListener('click', handleNoVpsOrderSubmit);
}

function validateOrderForm() {
  if (orderRows.length === 0) {
    showToast('⚠ Please add at least 1 item to your order table first!');
    return false;
  }
  if (!custName.value.trim()) {
    custName.focus();
    showToast('⚠ Please enter your Name at the bottom of the table.');
    return false;
  }
  if (!custPhone.value.trim()) {
    custPhone.focus();
    showToast('⚠ Please enter your Contact Number at the bottom of the table.');
    return false;
  }
  if (!custLocation.value.trim()) {
    custLocation.focus();
    showToast('⚠ Please enter your Location / Delivery Address at the bottom of the table.');
    return false;
  }
  return true;
}

async function handleNoVpsOrderSubmit() {
  if (!validateOrderForm()) return;

  const btn = document.getElementById('sendOrderDirectBtn');
  const originalLabel = btn.innerHTML;
  btn.innerHTML = '⏳ SENDING ORDER...';
  btn.disabled = true;

  const templateText = generateOrderTemplateText();
  const totalQty = orderRows.reduce((acc, r) => acc + (parseInt(r.qty, 10) || 0), 0);
  const totalAmount = orderRows.reduce((acc, r) => acc + ((parseInt(r.qty, 10) || 0) * (parseFloat(r.unitPrice) || 0)), 0);

  const discordWebhook = localStorage.getItem('cnc_discord_webhook') || '';
  const web3FormsKey = localStorage.getItem('cnc_web3forms_key') || '';
  const customWebhook = localStorage.getItem('cnc_custom_webhook') || '';

  let sentChannels = [];

  try {
    // Channel A: Permanent Google Sheets Apps Script Webhook
    const targetGoogleSheetsUrl = GOOGLE_SHEETS_WEBHOOK_URL || customWebhook;
    if (targetGoogleSheetsUrl) {
      await fetch(targetGoogleSheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          orderRef: orderReference,
          timestamp: new Date().toLocaleString('en-PH'),
          items: orderRows,
          itemsSummary: orderRows.map(r => `${r.qty}x ${r.customName}${r.notes ? ' (' + r.notes + ')' : ''} [₱${r.qty * r.unitPrice}]`).join(', '),
          totalQty,
          totalAmount,
          customer: {
            name: custName.value.trim(),
            phone: custPhone.value.trim(),
            social: custSocial.value.trim(),
            fulfillment: custFulfillment.value,
            payment: custPayment.value,
            location: custLocation.value.trim(),
            landmark: custLandmark.value.trim(),
            timeNote: custTime.value.trim()
          },
          formattedReceipt: templateText
        })
      });
      sentChannels.push('Google Sheets');
    }

    // Channel B: Discord Webhook (if optionally configured)
    if (discordWebhook) {
      const res = await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'CRACK & CUP Order Bot',
          content: `🔔 **NEW ORDER RECEIVED (${orderReference})** — **₱${totalAmount.toLocaleString()}**\n\`\`\`\n${templateText}\n\`\`\``
        })
      });
      if (res.ok) sentChannels.push('Discord Staff Channel');
    }

    // Channel C: Web3Forms (Direct to Email Inbox)
    if (web3FormsKey) {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: web3FormsKey,
          subject: `New Crack & Cup Order ${orderReference} from ${custName.value.trim()} (₱${totalAmount})`,
          from_name: 'Crack & Cup Ordering Website',
          customer_name: custName.value.trim(),
          customer_phone: custPhone.value.trim(),
          customer_location: custLocation.value.trim(),
          total_items: totalQty,
          total_amount: `₱${totalAmount}`,
          message: templateText
        })
      });
      if (res.ok) sentChannels.push('Shop Email (Web3Forms)');
    }

    // Always copy the formatted template to clipboard so the customer has it ready
    await copyToClipboard(templateText);

    if (sentChannels.length > 0) {
      showToast(`🎉 Order ${orderReference} logged to Google Sheets! Receipt copied.`);
    } else {
      showToast(`✓ Order ${orderReference} formatted & copied to clipboard!`);
    }
  } catch (err) {
    await copyToClipboard(templateText);
    showToast(`Order copied to clipboard! (Logging encountered network hiccup)`);
  } finally {
    btn.innerHTML = originalLabel;
    btn.disabled = false;
  }
}

// 13. HELPERS
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
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastNotice');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4200);
}

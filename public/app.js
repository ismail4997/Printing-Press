// PRINT PRESS MASTER - FRONTEND APPLICATION CONTROLLER

document.addEventListener('DOMContentLoaded', () => {

  // =============================================================
  // TOAST NOTIFICATION SYSTEM
  // =============================================================
  const TOAST_ICONS = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info'
  };

  function showToast(title, message, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.position = 'relative';
    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${TOAST_ICONS[type] || 'info'}"></i></div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-text">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.classList.add('toast-out'); setTimeout(()=>this.parentElement.remove(),350);">
        <i data-lucide="x"></i>
      </button>
      <div class="toast-progress" style="animation-duration:${duration}ms;"></div>
    `;
    container.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // =============================================================
  // CUSTOM CONFIRM DIALOG (Promise-based)
  // =============================================================
  function showConfirm({ title, message, details, confirmText, confirmClass }) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('confirm-dialog');
      document.getElementById('confirm-title').textContent = title || 'Are you sure?';
      document.getElementById('confirm-message').textContent = message || 'This action cannot be undone.';

      const detailsEl = document.getElementById('confirm-details');
      if (details && details.length) {
        detailsEl.style.display = 'block';
        if (details[0]) {
          document.getElementById('confirm-label-1').textContent = details[0].label;
          document.getElementById('confirm-value-1').textContent = details[0].value;
          document.getElementById('confirm-label-1').parentElement.style.display = 'flex';
        }
        if (details[1]) {
          document.getElementById('confirm-label-2').textContent = details[1].label;
          document.getElementById('confirm-value-2').textContent = details[1].value;
          document.getElementById('confirm-label-2').parentElement.style.display = 'flex';
        } else {
          document.getElementById('confirm-label-2').parentElement.style.display = 'none';
        }
      } else {
        detailsEl.style.display = 'none';
      }

      const yesBtn = document.getElementById('confirm-yes-btn');
      yesBtn.innerHTML = `<i data-lucide="trash-2"></i> ${confirmText || 'Delete'}`;
      yesBtn.className = `btn ${confirmClass || 'btn-danger'}`;

      dialog.style.display = 'flex';
      lucide.createIcons({ nodes: [dialog] });

      function cleanup() {
        dialog.style.display = 'none';
        yesBtn.removeEventListener('click', onYes);
        document.getElementById('confirm-cancel-btn').removeEventListener('click', onNo);
      }
      function onYes() { cleanup(); resolve(true); }
      function onNo() { cleanup(); resolve(false); }

      yesBtn.addEventListener('click', onYes);
      document.getElementById('confirm-cancel-btn').addEventListener('click', onNo);
    });
  }


  // Global State
  const state = {
    activeTab: 'dashboard',
    dashboard: null,
    inventory: [],
    vendors: [],
    clients: [],
    jobs: [],
    client_products: [],
    tax_invoices: [],
    company_profile: null,
    employees: [],
    attendance: [],
    expenses: [],
    selectedVendor: null,
    selectedClient: null,
    currentImposition: null
  };

  // -------------------------------------------------------------
  // INITIALIZATION & EVENT LISTENERS
  // -------------------------------------------------------------
  let isInitialized = false;
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    setupTabNavigation();
    setupFormListeners();
    setupSearchFilters();
    setupStockPriceCalculator();
    loadAllData();
    lucide.createIcons();

    window.addEventListener('resize', () => {
      if (state.activeTab === 'calculator' && state.currentImposition && state.currentImposition.bestOption) {
        drawImpositionCanvas(state.currentImposition.bestOption, state.currentImposition.input);
      }
    });
  }

  // Live Stock Price Calculator (L Ã— W Ã— GSM / 15500 Ã— Rate Ã— Pkts)
  function setupStockPriceCalculator() {
    const DIVISOR = 15500;
    
    function recalcStockPrice() {
      const L = parseFloat(document.getElementById('receive-w')?.value) || 0;
      const W = parseFloat(document.getElementById('receive-h')?.value) || 0;
      const gsm = parseFloat(document.getElementById('receive-gsm')?.value) || 0;
      const rateKg = parseFloat(document.getElementById('receive-rate-kg')?.value) || 0;
      const pkts = parseFloat(document.getElementById('receive-pkts')?.value) || 0;

              const isWindow = document.getElementById('receive-order-summary')?.innerText.includes('PVC Window Film');
        const weightPerPkt = isWindow ? 0 : (L * W * gsm) / DIVISOR;
        const pricePerPkt = isWindow ? rateKg : weightPerPkt * rateKg;
        const totalAmount = pricePerPkt * pkts;

        const formulaEl = document.querySelector('#receive-price-breakdown .pb-formula');
        if (formulaEl) {
          formulaEl.innerText = isWindow 
            ? '( Rate × Sheets )' 
            : '( L × W × GSM ) ÷ 15,500 × Rate/KG × Pkts';
        }

      const weightEl = document.getElementById('calc-weight-pkt');
      const priceEl = document.getElementById('calc-price-pkt');
      const totalEl = document.getElementById('calc-total-amount');
      
              if (weightEl) {
          weightEl.textContent = weightPerPkt.toFixed(2) + ' KG';
          weightEl.parentElement.style.display = isWindow ? 'none' : 'flex';
        }
      if (priceEl) priceEl.textContent = 'Rs. ' + Math.round(pricePerPkt).toLocaleString();
      if (totalEl) totalEl.textContent = 'Rs. ' + Math.round(totalAmount).toLocaleString();
    }

    // Attach listeners to all calc inputs
    document.querySelectorAll('.stock-calc-input').forEach(input => {
      input.addEventListener('input', recalcStockPrice);
    });

    // Run once on load
    recalcStockPrice();
  }

  function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.nav-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));

    const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    const activePage = document.getElementById(`tab-${tabName}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePage) activePage.classList.add('active');

    // Refresh tab data
    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'calculator') populateDropdowns();
    if (tabName === 'inventory') renderInventory();
    if (tabName === 'vendors') renderVendors();
    if (tabName === 'clients') renderClients();
    if (tabName === 'production') renderProduction();
    if (tabName === 'costing') renderCosting();
      if (tabName === 'hr') { const isHR = currentUser && ['CEO', 'CTO'].includes(currentUser.role); if(isHR) { renderEmployees(); } if(window.renderAttendanceChart) window.renderAttendanceChart(); }
      if (tabName === 'expenses') renderExpenses();

    lucide.createIcons();
  }

  function setupSearchFilters() {
    const vSearch = document.getElementById('vendor-search');
    if (vSearch) {
      vSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        renderVendors(query);
      });
    }

    const cSearch = document.getElementById('client-search');
    if (cSearch) {
      cSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        renderClients(query);
      });
    }
  }

  // -------------------------------------------------------------
  // DATA FETCHING FROM REST API
  // -------------------------------------------------------------
  async function loadAllData() {
    try {
      const [dashRes, invRes, venRes, cliRes, jobRes, poRes, clientProductsRes, empRes, attRes, expRes, taxInvoicesRes, companyProfileRes] = await Promise.all([
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/inventory').then(r => r.json()),
        fetch('/api/vendors').then(r => r.json()),
        fetch('/api/clients').then(r => r.json()),
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/purchase-orders').then(r => r.json()),
        fetch('/api/client-products').then(r => r.json()),
          fetch('/api/employees').then(r => r.json()),
          fetch('/api/attendance').then(r => r.json()),
          fetch('/api/expenses').then(r => r.json())
      ]);

      state.dashboard = dashRes;
      state.inventory = invRes || [];
      state.vendors = venRes || [];
      state.clients = cliRes || [];
      state.jobs = jobRes || [];
      state.purchaseOrders = poRes || [];
      state.client_products = clientProductsRes || [];
      state.employees = empRes || [];
      state.attendance = attRes || [];
      state.expenses = expRes || [];
      state.tax_invoices = taxInvoicesRes || [];
      state.company_profile = companyProfileRes || null;

      if (state.vendors.length > 0 && !state.selectedVendor) {
        state.selectedVendor = state.vendors[0];
      }
      if (state.clients.length > 0 && !state.selectedClient) {
        state.selectedClient = state.clients[0];
      }

      renderDashboard();
      renderInventory();
      renderPurchaseOrders();
      renderVendors();
      renderClients();
      renderProduction();
      renderCosting();
      renderEmployees();
      renderExpenses();
      if(window.renderAttendanceChart) window.renderAttendanceChart();
      populateDropdowns();

    } catch (err) {
      console.error("Error loading app data:", err);
    }
  }

  function populateDropdowns() {
    const issueClientSelect = document.getElementById('issue-client-id');
    if (issueClientSelect) {
      issueClientSelect.innerHTML = '<option value="">-- Select Customer --</option>' + state.clients.map(c => 
        `<option value="${c.id}">${c.name} (${c.company || 'Customer'})</option>`
      ).join('');
    }

    // Calculator client selector
    const calcClientSelect = document.getElementById('calc-client-id');
    if (calcClientSelect) {
      const currentVal = calcClientSelect.value;
      calcClientSelect.innerHTML = '<option value="">-- Select Client --</option>' + 
        state.clients.map(c => 
          `<option value="${c.id}">${c.name} (${c.company || 'Customer'})</option>`
        ).join('');
      if (currentVal) calcClientSelect.value = currentVal;
    }

    const stockVendorSelect = document.getElementById('order-vendor-id');
    if (stockVendorSelect) {
      const paperVendors = state.vendors.filter(v => v.category === 'paper_supplier' || v.category === 'all');
      stockVendorSelect.innerHTML = (paperVendors.length ? paperVendors : state.vendors).map(v => 
        `<option value="${v.id}">${v.name}</option>`
      ).join('');
    }

    const pastingVendorSelect = document.getElementById('pasting-vendor-id');
    if (pastingVendorSelect) {
      const pastingVendors = state.vendors.filter(v => v.category === 'pasting_vendor');
      pastingVendorSelect.innerHTML = (pastingVendors.length ? pastingVendors : state.vendors).map(v => 
        `<option value="${v.id}">${v.name}</option>`
      ).join('');
    }
  }

  // -------------------------------------------------------------
  // TAB 1: DASHBOARD RENDERER
  // -------------------------------------------------------------
  function renderDashboard() {
    if (!state.dashboard) return;
    const d = state.dashboard;

    document.getElementById('stat-active-jobs').innerText = d.activeJobsCount;
    document.getElementById('stat-solna-split').innerText = `Solna #1: ${d.solna1Jobs} | Solna #2: ${d.solna2Jobs}`;
    document.getElementById('stat-inventory-pkts').innerText = `${d.totalInventoryPkts} Pkts`;
    document.getElementById('stat-client-receivables').innerText = `Rs. ${d.totalClientReceivables.toLocaleString()}`;
    document.getElementById('stat-vendor-payables').innerText = `Rs. ${d.totalVendorPayables.toLocaleString()}`;

    // Machine floor status queues
    const solna1Jobs = state.jobs.filter(j => j.current_stage === 'printing' && j.solna_machine === 1);
    const solna2Jobs = state.jobs.filter(j => j.current_stage === 'printing' && j.solna_machine === 2);
    const pastingJobs = state.jobs.filter(j => j.current_stage === 'outside_pasting');

    document.getElementById('solna-1-queue').innerHTML = solna1Jobs.length ? 
      solna1Jobs.map(j => `<div class="mini-job-item"><strong>${j.job_no}</strong>: ${j.job_title} (${j.order_qty} pcs)</div>`).join('') :
      `<div class="text-muted text-sm">No active job printing</div>`;

    document.getElementById('solna-2-queue').innerHTML = solna2Jobs.length ? 
      solna2Jobs.map(j => `<div class="mini-job-item"><strong>${j.job_no}</strong>: ${j.job_title} (${j.order_qty} pcs)</div>`).join('') :
      `<div class="text-muted text-sm">No active job printing</div>`;

    document.getElementById('pasting-dispatch-queue').innerHTML = pastingJobs.length ? 
      pastingJobs.map(j => `<div class="mini-job-item"><strong>${j.job_no}</strong>: ${j.job_title} (${j.pasting_received_qty}/${j.order_qty} received)</div>`).join('') :
      `<div class="text-muted text-sm">No job in outside pasting</div>`;

    // Stock alerts
    const lowStockItems = state.inventory.filter(i => i.pkt_qty <= i.min_alert_pkts);
    document.getElementById('dashboard-stock-alerts').innerHTML = lowStockItems.length ?
      lowStockItems.map(i => `
        <div class="mini-job-item" style="border-left-color: var(--amber);">
          <strong>${i.paper_type} ${i.gsm}${i.paper_type === 'PVC Window Film' ? 'microns' : 'gsm'}</strong> (${i.size_w}x${i.size_h}")<br>
          Current Stock: <span style="color: var(--amber); font-weight: bold;">${i.pkt_qty} Pkts (${i.sheet_qty} sheets)</span>
        </div>
      `).join('') :
      `<div class="text-muted text-sm" style="color: var(--emerald);">All stock levels normal</div>`;
  }

  // -------------------------------------------------------------
  // TAB 2: BOX & PAPER CALCULATOR (with Client & Product)
  // -------------------------------------------------------------

  // Load saved products when client is selected
  async function loadClientProducts(clientId) {
    if (!clientId) {
      document.getElementById('calc-saved-product').innerHTML = '<option value="">-- New Product --</option>';
      return;
    }
    try {
      const products = await fetch(`/api/clients/${clientId}/products`).then(r => r.json());
      state.clientProducts = products;
      const select = document.getElementById('calc-saved-product');
      select.innerHTML = '<option value="">-- New Product --</option>' +
        products.map(p => `<option value="${p.id}">${p.name} (${p.box_w}" Ã— ${p.box_l}")</option>`).join('');
    } catch (err) {
      console.error("Error loading client products:", err);
    }
  }

  // Auto-fill dimensions when saved product is selected
  function onSavedProductSelected(productId) {
    if (!productId || !state.clientProducts) return;
    const product = state.clientProducts.find(p => p.id == productId);
    if (product) {
      document.getElementById('calc-product-name').value = product.name || '';
      if (product.paper_size) document.getElementById('calc-paper-size').value = product.paper_size;
      if (product.ups) document.getElementById('calc-ups-machine').value = product.ups;
      if (product.colors) document.getElementById('calc-colors').value = product.colors;
    }
  }

  // Save product to client's saved list
  async function saveClientProduct(clientId, name, boxW, boxL, paperSize, ups) {
    if (!clientId || !name) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, box_w: boxW, box_l: boxL, paper_size: paperSize, ups: ups })
      });
      if (res.ok) {
        const saved = await res.json();
        if (state.clientProducts && state.clientProducts[0] && state.clientProducts[0].client_id == clientId) {
           const existingIdx = state.clientProducts.findIndex(p => p.id === saved.id);
           if (existingIdx > -1) state.clientProducts[existingIdx] = saved;
           else state.clientProducts.push(saved);
        }
        
        showToast('Success', 'Product saved successfully!', 'success');
        
        const calcClientSelect = document.getElementById('calc-client-id');
        if (calcClientSelect && calcClientSelect.value == clientId) {
          loadClientProducts(clientId);
        }
      } else {
        showToast('Error', 'Failed to save product', 'error');
      }
    } catch (err) {
      console.error("Error saving client product:", err);
    }
  }

  async function loadClientProductsForIssue(clientId) {
    const select = document.getElementById('issue-product-select');
    if (!select) return;
    
    if (!clientId) {
      select.innerHTML = '<option value="">-- Select Product --</option>';
      document.getElementById('btn-add-client-product').style.display = 'none';
      return;
    }
    
    try {
      const products = await fetch(`/api/clients/${clientId}/products`).then(r => r.json());
      window.issueProductsList = products;
      
      select.innerHTML = '<option value="">-- Select Product --</option>' +
        products.map(p => `<option value="${p.id}">${p.name} (${p.paper_size})</option>`).join('');
        
      if (document.getElementById('c-detail-name') && state.selectedClient && state.selectedClient.id == clientId) {
         renderClientProductsTable(products);
         document.getElementById('btn-add-client-product').style.display = 'inline-flex';
      }
    } catch (err) {
      console.error("Error loading products for issue modal:", err);
    }
  }
  
  function renderClientProductsTable(products) {
    const tbody = document.getElementById('table-client-products-body');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No products saved for this client.</td></tr>';
      return;
    }
    
    tbody.innerHTML = products.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.paper_size || '-'}</td>
        <td>${p.ups || '-'}</td>
        <td>${p.colors || 1}</td>
        <td>${p.description || '-'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editClientProduct(${p.id})"><i data-lucide="edit"></i> Edit</button>
        </td>
      </tr>
    `).join('');
    lucide.createIcons();
  }

  window.editClientProduct = function(prodId) {
    if (!state.selectedClient) return;
    const products = window.issueProductsList || [];
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    document.getElementById('prod-client-id').value = state.selectedClient.id;
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-name').value = prod.name || '';
    document.getElementById('prod-sheet-size').value = prod.paper_size || '';
    document.getElementById('prod-ups').value = prod.ups || '';
    document.getElementById('prod-colors').value = prod.colors || 1;
    document.getElementById('prod-rate').value = prod.rate_per_box || '';
    document.getElementById('prod-desc').value = prod.description || '';
    
    openModal('modal-add-product');
  };

  async function runCalculator() {
    const orderQty = parseInt(document.getElementById('calc-order-qty').value);
    const paperSize = document.getElementById('calc-paper-size').value;
    const upsMachine = parseInt(document.getElementById('calc-ups-machine').value);
    const colors = parseInt(document.getElementById('calc-colors').value) || 1;

    if (!orderQty || !upsMachine || !paperSize) {
      showToast('Missing Fields', 'Please enter order quantity, paper size, and ups.', 'warning');
      return;
    }

    // Auto-save product if client is selected
    const clientId = document.getElementById('calc-client-id').value;
    const productName = document.getElementById('calc-product-name').value;
    if (clientId && productName) {
      saveClientProduct(clientId, productName, null, null, paperSize, upsMachine);
    }

    // Manual Calculation Logic
    const totalUpsPerMillSheet = upsMachine;
    const sheetsRequired = Math.ceil(orderQty / totalUpsPerMillSheet);
    const pktsRequired = Math.ceil(sheetsRequired / 100);
    const totalImpressions = sheetsRequired * colors;

    state.currentImposition = {
      paperSize,
      upsMachine,
      totalUpsPerMillSheet,
      sheetsRequired,
      pktsRequired,
      totalImpressions,
      colors
    };

    renderCalculatorResults();
  }

  function renderCalculatorResults() {
    const best = state.currentImposition;
    if (!best) return;

    const resCard = document.getElementById('calc-results-card');
    if (resCard) resCard.style.display = 'block';

    document.getElementById('res-parent-size').innerText = `${best.paperSize}"`;
    document.getElementById('res-total-ups').innerText = `${best.totalUpsPerMillSheet} Boxes`;
    document.getElementById('res-sheets-needed').innerText = `${best.sheetsRequired} Sheets`;
    document.getElementById('res-pkts-needed').innerText = `${best.pktsRequired} Pkts`;
    document.getElementById('res-impressions').innerText = `${best.totalImpressions.toLocaleString()} (${best.colors} colors)`;
  }

  window.orderMaterialFromManual = function() {
    if (!state.currentImposition) {
        showToast('Calculate First', 'Please run the calculator before ordering material.', 'warning');
        return;
    }
    
    // Auto-fill the purchase order modal
    const calcData = state.currentImposition;
    const paperType = document.getElementById('calc-paper-type').value;
    const gsm = document.getElementById('calc-gsm').value;
    
    // Parse parent size (e.g. "25x36" or "25*36" -> 25 and 36)
    const sizeParts = (calcData.paperSize || '').toLowerCase().replace(/\*/g, 'x').split('x');
    const sizeW = sizeParts[0] || '';
    const sizeH = sizeParts[1] || '';

    // The purchase order modal has dynamic rows, we will just fill the first one
    const container = document.getElementById('order-items-container');
    if (container) {
      const rows = container.querySelectorAll('.order-item-row');
      if (rows.length > 0) {
        const firstRow = rows[0];
        firstRow.querySelector('.order-paper-type').value = paperType || 'Bleach Card';
        firstRow.querySelector('.order-gsm').value = gsm || 300;
        firstRow.querySelector('.order-w').value = sizeW;
        firstRow.querySelector('.order-h').value = sizeH;
        firstRow.querySelector('.order-pkts').value = calcData.pktsRequired;
      }
    }

    openModal('modal-order');
    
    // Hide the results container and clear state
    const resCard = document.getElementById('calc-results-card');
    if (resCard) resCard.style.display = 'none';
    state.currentImposition = null;
  };

  // -------------------------------------------------------------
  // TAB 3: INVENTORY RENDERER
  // -------------------------------------------------------------
  function renderPurchaseOrders() {
    const tbody = document.getElementById('table-orders-body');
    if (!tbody) return;

    tbody.innerHTML = state.purchaseOrders.map(order => {
      const isReceived = order.status === 'received';
      return `
        <tr>
          <td><strong>${order.order_no}</strong></td>
          <td>${order.date}</td>
          <td>${order.vendor_name}</td>
          <td>${order.paper_type} ${order.gsm}${order.paper_type === 'PVC Window Film' ? 'microns' : 'gsm'}<br><small>${order.size_w}x${order.size_h}"</small></td>
          <td>${order.ordered_pkts} ${order.paper_type === 'PVC Window Film' ? 'Sheets' : 'Pkts'}</td>
          <td>Rs. ${order.rate_per_kg}${order.paper_type === 'PVC Window Film' ? '' : '/KG'}</td>
          <td>${isReceived ? '<span class="badge badge-success">RECEIVED</span>' : '<span class="badge badge-warning">ORDERED</span>'}</td>
          <td>
            <div style="display:flex; gap:0.25rem;">
              ${!isReceived ? `<button class="btn btn-primary btn-sm" onclick="openReceiveGoods(${order.id})">Receive</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="openEditPO(${order.id})"><i data-lucide="edit"></i></button>
              ${!isReceived ? `<button class="btn btn-sm" style="background:#ef4444; color:white; border:none;" onclick="deletePO(${order.id})"><i data-lucide="trash"></i></button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    lucide.createIcons();
  }

  window.openReceiveGoods = function(orderId) {
    const order = state.purchaseOrders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('receive-order-id').value = order.id;
    const isWindow = (order.paper_type === 'PVC Window Film');
    const unit = isWindow ? 'microns' : 'gsm';
    document.getElementById('receive-order-summary').innerText = `Receiving Order ${order.order_no}: ${order.paper_type} ${order.gsm}${unit}`;

    const lblPkts = document.getElementById('lbl-receive-pkts');
    if (lblPkts) lblPkts.innerText = isWindow ? 'Actual Sheets Received' : 'Actual Packets Received';

    const lblPrice = document.getElementById('lbl-receive-price-pkt');
    if (lblPrice) lblPrice.innerText = isWindow ? 'PRICE PER SHEET' : 'PRICE PER PKT';

    
    document.getElementById('receive-pkts').value = order.ordered_pkts;
    document.getElementById('receive-rate-kg').value = order.rate_per_kg;
    document.getElementById('receive-w').value = order.size_w;
    document.getElementById('receive-h').value = order.size_h;
    document.getElementById('receive-gsm').value = order.gsm;

    openModal('modal-receive-goods');
    // Trigger price recalc
    document.getElementById('receive-pkts').dispatchEvent(new Event('input'));
  };

  window.openEditPO = function(orderId) {
    const order = state.purchaseOrders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('edit-po-id').value = order.id;
    document.getElementById('edit-po-type').value = order.paper_type;
    document.getElementById('edit-po-gsm').value = order.gsm;
    document.getElementById('edit-po-w').value = order.size_w;
    document.getElementById('edit-po-h').value = order.size_h;
    document.getElementById('edit-po-qty').value = order.ordered_pkts;
    document.getElementById('edit-po-rate').value = order.rate_per_kg;

    openModal('modal-edit-po');
  };

  window.deletePO = async function(orderId) {
    const confirmed = await showConfirm({
      title: 'Delete Purchase Order?',
      message: 'This will permanently remove this purchase order. This action cannot be undone.',
      details: [
        { label: 'Order ID', value: 'PO-' + orderId }
      ],
      confirmText: 'Delete Order'
    });
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      
      showToast('Deleted', data.message, 'success');
      await loadAllData();
    } catch (e) {
      showToast('Error', e.message, 'error');
    }
  };
  function renderInventory() {
    const tbody = document.getElementById('table-inventory-body');
    if (!tbody) return;

    const activeInventory = state.inventory.filter(item => item.pkt_qty > 0);
    tbody.innerHTML = activeInventory.map(item => {
      const isLow = item.pkt_qty <= item.min_alert_pkts;
      return `
        <tr>
          <td><strong>${item.paper_type}</strong></td>
          <td>${item.gsm} ${item.paper_type === 'PVC Window Film' ? 'MICRONS' : 'GSM'}</td>
          <td>${item.size_w}" x ${item.size_h}"</td>
          <td><strong style="font-size: 1.1rem; color: ${isLow ? 'var(--amber)' : 'var(--cyan)'};">${item.pkt_qty} ${item.paper_type === 'PVC Window Film' ? 'Sheets' : 'Pkts'}</strong></td>
          <td>${item.paper_type === 'PVC Window Film' ? '-' : item.sheet_qty.toLocaleString() + ' sheets'}</td>
          <td>${isLow ? '<span class="badge badge-warning">Low Stock</span>' : '<span class="badge badge-success">In Stock</span>'}</td>
          <td>
            <div style="display:flex; gap:0.25rem;">
              <button class="btn btn-primary btn-sm" onclick="openCutStockModal(${item.id})"><i data-lucide="scissors" style="width: 14px; height: 14px;"></i> Cut</button>
              <button class="btn btn-emerald btn-sm" onclick="openIssueStockModal(${item.id})">Issue to Production</button>
              <button class="btn btn-secondary btn-sm" onclick="quickAddStock(${item.id})">Add Stock</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.openCutStockModal = function(invId) {
    const item = state.inventory.find(i => i.id === invId);
    if (!item) return;

    if (item.pkt_qty <= 0) {
      showToast('No Stock', 'Cannot cut an empty stock item.', 'warning');
      return;
    }

    document.getElementById('cut-source-id').value = item.id;
    document.getElementById('cut-source-w').value = item.size_w;
    document.getElementById('cut-source-h').value = item.size_h;
    document.getElementById('cut-source-info').innerText = `Master: ${item.paper_type} ${item.gsm}${item.paper_type === 'PVC Window Film' ? 'MICRONS' : 'GSM'} (${item.size_w}" x ${item.size_h}") - ${item.pkt_qty} pkts available`;
    document.getElementById('cut-pkts').max = item.pkt_qty;
    document.getElementById('cut-pkts').value = '';
    document.getElementById('cut-target-pkts').value = '';
    document.getElementById('cut-pieces').value = '';
    document.getElementById('cut-new-w').value = '';
    document.getElementById('cut-new-h').value = '';
    openModal('modal-cut-stock');
  };

  window.openIssueStockModal = function(invId) {
    const item = state.inventory.find(i => i.id === invId);
    if (!item) return;
    
    if (item.pkt_qty <= 0) {
      showToast('No Stock', 'Cannot issue from an empty stock.', 'warning');
      return;
    }

    document.getElementById('issue-stock-id').value = item.id;
    document.getElementById('issue-stock-info').innerText = `Issuing: ${item.paper_type} ${item.gsm}${item.paper_type === 'PVC Window Film' ? 'MICRONS' : 'GSM'} (${item.size_w}x${item.size_h}") - ${item.pkt_qty} pkts available`;
    document.getElementById('issue-pkts-qty').max = item.pkt_qty;
    document.getElementById('issue-pkts-qty').value = '';
    document.getElementById('issue-job-title').value = '';
    document.getElementById('issue-order-qty').value = '';
    // Reset pricing fields
    document.getElementById('issue-colors').value = '1';
    document.getElementById('issue-total-amount').value = '';
    document.getElementById('issue-material-cost').value = '0';
    document.getElementById('issue-material-cost').dataset.ratePerKg = item.rate_per_kg || 0;
    document.getElementById('issue-material-cost').dataset.w = item.size_w || 0;
    document.getElementById('issue-material-cost').dataset.h = item.size_h || 0;
    document.getElementById('issue-material-cost').dataset.gsm = item.gsm || 0;
    
    // Clear any extra color fields
    const extraColorsContainer = document.getElementById('extra-colors-container');
    if (extraColorsContainer) {
      extraColorsContainer.innerHTML = '';
      extraColorsContainer.style.display = 'none';
    }

    openModal('modal-issue-stock');
  };

  window.quickAddStock = function(invId) {
    const item = state.inventory.find(i => i.id === invId);
    if (!item) return;

    const container = document.getElementById('order-items-container');
    if (container) {
        const rows = container.querySelectorAll('.order-item-row');
        for(let i = 1; i < rows.length; i++) rows[i].remove();
        
        const firstRow = container.querySelector('.order-item-row');
        if (firstRow) {
            firstRow.querySelector('.order-paper-type').value = item.paper_type;
            firstRow.querySelector('.order-gsm').value = item.gsm;
            firstRow.querySelector('.order-w').value = item.size_w;
            firstRow.querySelector('.order-h').value = item.size_h;
        }
    }
    openModal('modal-order');
  };

  // -------------------------------------------------------------
  // TAB 4: VENDOR ACCOUNTS RENDERER
  // -------------------------------------------------------------
  function renderVendors(searchQuery = '') {
    const vendorList = document.getElementById('vendor-list');
    if (!vendorList) return;

    const filtered = state.vendors.filter(v => v.name.toLowerCase().includes(searchQuery));

    vendorList.innerHTML = filtered.map(v => `
      <div class="list-item-card ${state.selectedVendor && state.selectedVendor.id === v.id ? 'active' : ''}" onclick="selectVendor(${v.id})">
        <div class="name">${v.name}</div>
        <div class="sub">${v.category.replace('_', ' ').toUpperCase()} â€¢ ${v.phone || 'No phone'}</div>
        <div class="balance">Rs. ${v.balance.toLocaleString()} Payable</div>
      </div>
    `).join('');

    if (state.selectedVendor) {
      loadVendorLedger(state.selectedVendor.id);
    }
  }

  window.selectVendor = function(vId) {
    state.selectedVendor = state.vendors.find(v => v.id === vId);
    renderVendors();
  };

  async function loadVendorLedger(vId) {
    try {
      const [ledgerRes, bills] = await Promise.all([
        fetch(`/api/vendors/${vId}/ledger`).then(r => r.json()),
        fetch(`/api/vendors/${vId}/bills`).then(r => r.json())
      ]);
      const v = ledgerRes.vendor;
      const txs = ledgerRes.transactions;
      const today = new Date().toISOString().split('T')[0];

      document.getElementById('v-detail-name').innerText = v.name;
      document.getElementById('v-detail-category').innerText = v.category.replace('_', ' ').toUpperCase();
      document.getElementById('v-detail-phone').innerText = v.phone ? `Phone: ${v.phone}` : '';
      
      const vBalanceLbl = document.getElementById('v-detail-balance-lbl');
      const vBalanceVal = document.getElementById('v-detail-balance');
      if (v.balance < 0) {
        vBalanceLbl.innerText = 'Advance Payment (They Owe You)';
        vBalanceVal.innerText = `Rs. ${Math.abs(v.balance).toLocaleString()}`;
        vBalanceVal.style.color = '#10b981'; // Green for advance
      } else {
        vBalanceLbl.innerText = 'Payable Balance (Money Owed)';
        vBalanceVal.innerText = `Rs. ${v.balance.toLocaleString()}`;
        vBalanceVal.style.color = '#f59e0b'; // Orange/Yellow for owed
      }

      // Vendor Stats
      const cashBills = bills.filter(b => b.payment_type === 'cash');
      const creditBills = bills.filter(b => b.payment_type === 'credit');
      const overdueBills = bills.filter(b => b.status !== 'paid' && b.due_date < today);

      document.getElementById('vs-total-bills').textContent = bills.length;
      document.getElementById('vs-cash').textContent = cashBills.length;
      document.getElementById('vs-credit').textContent = creditBills.length;
      document.getElementById('vs-overdue').textContent = overdueBills.length;

      // Bills Table
      const billsTbody = document.getElementById('table-vendor-bills-body');
      billsTbody.innerHTML = bills.length ? bills.map(b => {
        const isOverdue = b.status !== 'paid' && b.due_date < today;
        const statusClass = isOverdue ? 'badge-overdue' : `badge-${b.status}`;
        const statusText = isOverdue ? 'OVERDUE' : b.status.toUpperCase();
        const daysLeft = b.status !== 'paid' ? Math.ceil((new Date(b.due_date) - new Date()) / 86400000) : null;
        
        return `
        <tr>
          <td><strong>${b.bill_no}</strong></td>
          <td>${b.date}</td>
          <td style="max-width:200px;font-size:0.82rem;">${b.description}</td>
          <td><strong>Rs. ${b.total_amount.toLocaleString()}</strong></td>
          <td style="color:var(--emerald);font-weight:600;">Rs. ${b.paid_amount.toLocaleString()}</td>
          <td style="color:${b.remaining_amount > 0 ? 'var(--rose)' : 'var(--emerald)'};font-weight:600;">Rs. ${b.remaining_amount.toLocaleString()}</td>
          <td><span class="badge badge-${b.payment_type}">${b.payment_type.toUpperCase()}</span></td>
          <td>${b.due_date}${daysLeft !== null ? (daysLeft > 0 ? ` <small style="color:var(--text-muted);">(${daysLeft}d left)</small>` : ` <small style="color:var(--rose);">(${Math.abs(daysLeft)}d ago)</small>`) : ''}</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td class="print-hide">
            <div style="display:flex; gap:0.25rem;">
              ${b.status !== 'paid' ? `<button class="btn-pay-bill" onclick="openBillPayModal(${v.id}, ${b.id})">ðŸ’° Pay</button>` : '<span style="color:var(--emerald);font-size:0.8rem;">âœ“ Cleared</span>'}
              <button class="btn btn-sm" style="background:#ef4444; color:white; border:none;" onclick="deleteVendorBill(${v.id}, ${b.id})" title="Delete Bill & Reverse Stock"><i data-lucide="trash"></i></button>
            </div>
          </td>
        </tr>`;
      }).join('') : `<tr><td colspan="10" class="text-center text-muted">No purchase bills found</td></tr>`;

      // Transaction Ledger
      const tbody = document.getElementById('table-vendor-ledger-body');
      tbody.innerHTML = txs.length ? txs.map(t => `
        <tr>
          <td>${t.date}</td>
          <td><span class="badge ${t.type === 'PAYMENT' ? 'badge-success' : 'badge-warning'}">${t.type}</span></td>
          <td>${t.description}</td>
          <td style="color: var(--emerald); font-weight: bold;">${t.debit > 0 ? 'Rs. ' + t.debit.toLocaleString() : '-'}</td>
          <td style="color: var(--amber); font-weight: bold;">${t.credit > 0 ? 'Rs. ' + t.credit.toLocaleString() : '-'}</td>
          <td><strong>Rs. ${t.balance_after.toLocaleString()}</strong></td>
          <td class="print-hide"><button class="btn-delete-row" onclick="deleteVendorTx(${v.id}, ${t.id}, '${t.type}', ${t.debit || t.credit})">ðŸ—‘ Delete</button></td>
        </tr>
      `).join('') : `<tr><td colspan="7" class="text-center text-muted">No transactions found</td></tr>`;

      lucide.createIcons();
    } catch (err) {
      console.error("Error loading vendor ledger:", err);
    }
  }
  // DELETE TRANSACTION HANDLERS
  window.deleteVendorTx = async function(vendorId, txId, txType, amount) {
    const confirmed = await showConfirm({
      title: 'Delete Vendor Transaction?',
      message: 'This will permanently remove this record and automatically reverse the vendor balance.',
      details: [
        { label: 'Transaction Type', value: txType },
        { label: 'Amount', value: 'Rs. ' + amount.toLocaleString() }
      ],
      confirmText: 'Delete Record'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/vendors/${vendorId}/transaction/${txId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.error) {
        showToast('Error', res.error, 'error');
        return;
      }
      await loadAllData();
      showToast('Deleted', 'Transaction removed and vendor balance recalculated.', 'success');
    } catch (err) {
      console.error("Error deleting vendor transaction:", err);
      showToast('Error', 'Failed to delete transaction.', 'error');
    }
  };

  window.openEditOpeningBalanceModal = function(type) {
    let currentBalance = 0;
    if (type === 'vendor' && state.selectedVendor) {
      currentBalance = state.selectedVendor.initial_balance || 0;
    } else if (type === 'client' && state.selectedClient) {
      currentBalance = state.selectedClient.initial_balance || 0;
    } else {
      return;
    }
    document.getElementById('edit-ob-type').value = type;
    document.getElementById('edit-ob-amount').value = currentBalance;
    openModal('modal-edit-opening-balance');
  };

  window.deleteVendorBill = async function(vendorId, billId) {
    const confirmed = await showConfirm({
      title: 'Delete Vendor Bill?',
      message: 'This will reverse the inventory stock added by this bill and deduct the amount from the vendor balance. Warning: Cannot be undone.',
      details: [
        { label: 'Bill ID', value: 'VB-' + billId }
      ],
      confirmText: 'Delete Bill'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/vendors/${vendorId}/bill/${billId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete bill');
      
      showToast('Deleted', data.message, 'success');
      await loadAllData();
    } catch (e) {
      showToast('Error', e.message, 'error');
    }
  };

  window.deleteClientTx = async function(clientId, txId, txType, amount) {
    const confirmed = await showConfirm({
      title: 'Delete Customer Transaction?',
      message: 'This will permanently remove this record and automatically reverse the customer balance.',
      details: [
        { label: 'Transaction Type', value: txType },
        { label: 'Amount', value: 'Rs. ' + amount.toLocaleString() }
      ],
      confirmText: 'Delete Record'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/clients/${clientId}/transaction/${txId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.error) {
        showToast('Error', res.error, 'error');
        return;
      }
      await loadAllData();
      showToast('Deleted', 'Transaction removed and customer balance recalculated.', 'success');
    } catch (err) {
      console.error("Error deleting client transaction:", err);
      showToast('Error', 'Failed to delete transaction.', 'error');
    }
  };
  // BILL PAY MODAL
  window.openBillPayModal = async function(vendorId, billId) {
    try {
      const bills = await fetch(`/api/vendors/${vendorId}/bills`).then(r => r.json());
      const bill = bills.find(b => b.id === billId);
      if (!bill) return;

      document.getElementById('bp-vendor-id').value = vendorId;
      document.getElementById('bp-bill-id').value = billId;
      document.getElementById('bp-bill-no').textContent = bill.bill_no;
      document.getElementById('bp-total').textContent = `Rs. ${bill.total_amount.toLocaleString()}`;
      document.getElementById('bp-paid').textContent = `Rs. ${bill.paid_amount.toLocaleString()}`;
      document.getElementById('bp-remaining').textContent = `Rs. ${bill.remaining_amount.toLocaleString()}`;
      document.getElementById('bp-amount').value = bill.remaining_amount;
      document.getElementById('bp-amount').max = bill.remaining_amount;
      document.getElementById('bp-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('bp-cheque').value = '';

      openModal('modal-bill-pay');
    } catch (err) {
      console.error("Error opening bill pay modal:", err);
    }
  };

  // -------------------------------------------------------------
  // TAB 5: CUSTOMER ACCOUNTS RENDERER
  // -------------------------------------------------------------
  function renderClients(searchQuery = '') {
    const clientList = document.getElementById('client-list');
    if (!clientList) return;

    const filtered = state.clients.filter(c => c.name.toLowerCase().includes(searchQuery) || (c.company && c.company.toLowerCase().includes(searchQuery)));

    clientList.innerHTML = filtered.map(c => `
      <div class="list-item-card ${state.selectedClient && state.selectedClient.id === c.id ? 'active' : ''}" onclick="selectClient(${c.id})">
        <div class="name">${c.name}</div>
        <div class="sub">${c.company || 'Customer'} â€¢ ${c.phone || 'No phone'}</div>
        <div class="balance positive">Rs. ${c.balance.toLocaleString()} Receivable</div>
      </div>
    `).join('');

    if (state.selectedClient) {
      loadClientLedger(state.selectedClient.id);
    }
  }

  window.selectClient = function(cId) {
    state.selectedClient = state.clients.find(c => c.id === cId);
    renderClients();
  };

    async function loadClientLedger(cId) {
    try {
      const res = await fetch(`/api/clients/${cId}/ledger`).then(r => r.json());
      const c = res.client;
      const txs = res.transactions;

      document.getElementById('c-detail-name').innerText = c.name;
      const ntnStr = c.ntn ? ` • NTN: ${c.ntn}` : '';
      const addrStr = c.address ? ` • Address: ${c.address}` : '';
      document.getElementById('c-detail-company').innerText = (c.company ? `${c.company} • ` : '') + `Phone: ${c.phone || 'N/A'}` + ntnStr + addrStr;
      
      const cBalanceLbl = document.getElementById('c-detail-balance-lbl');
      const cBalanceVal = document.getElementById('c-detail-balance');
      if (c.balance < 0) {
        cBalanceLbl.innerText = 'Advance Received (You Owe Them)';
        cBalanceVal.innerText = `Rs. ${Math.abs(c.balance).toLocaleString()}`;
        cBalanceVal.style.color = '#ef4444'; // Red for you owe
      } else {
        cBalanceLbl.innerText = 'Receivable Balance (Money Due)';
        cBalanceVal.innerText = `Rs. ${c.balance.toLocaleString()}`;
        cBalanceVal.style.color = '#10b981'; // Green for they owe
      }

      loadClientProductsForIssue(c.id);
      if (window.renderTaxInvoices) window.renderTaxInvoices(c.id);

      // Reset selection state
      const selectAll = document.getElementById('client-ledger-select-all');
      if (selectAll) selectAll.checked = false;
      const combinedBtn = document.getElementById('btn-combined-tax-invoice');
      if (combinedBtn) combinedBtn.style.display = 'none';
      const countSpan = document.getElementById('selected-deliveries-count');
      if (countSpan) countSpan.textContent = '0';

      const tbody = document.getElementById('table-client-ledger-body');
      tbody.innerHTML = txs.length ? txs.map(t => {
        const isInvoice = (t.type === 'INVOICE');
        const descEscaped = (t.description || '').replace(/'/g, "\\'");
        return `
        <tr>
          <td style="text-align: center;">
            ${isInvoice ? `<input type="checkbox" class="client-ledger-checkbox" data-job="${t.job_no || ''}" data-amount="${t.debit || 0}" data-desc="${descEscaped}" data-date="${t.date}" onchange="updateSelectedLedgerItems()">` : ''}
          </td>
          <td>${t.date}</td>
          <td><strong>${t.job_no || '-'}</strong></td>
          <td><span class="badge ${t.type === 'PAYMENT' ? 'badge-success' : 'badge-warning'}">${t.type}</span></td>
          <td>${t.description}</td>
          <td style="color: var(--amber); font-weight: bold;">${t.debit > 0 ? 'Rs. ' + t.debit.toLocaleString() : '-'}</td>
          <td style="color: var(--emerald); font-weight: bold;">${t.credit > 0 ? 'Rs. ' + t.credit.toLocaleString() : '-'}</td>
          <td><strong>Rs. ${t.balance_after.toLocaleString()}</strong></td>
          <td style="white-space: nowrap;">
            ${isInvoice ? `<button class="btn btn-primary btn-sm" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; margin-right: 4px;" onclick="openTaxInvoiceForJob('${t.job_no || ''}', ${c.id}, ${t.debit || 0}, '${descEscaped}')"><i data-lucide="printer"></i> Tax Invoice</button>` : ''}
            <button class="btn-delete-row" onclick="deleteClientTx(${c.id}, ${t.id}, '${t.type}', ${t.debit || t.credit})">🗑 Delete</button>
          </td>
        </tr>
      `;
      }).join('') : `<tr><td colspan="9" class="text-center text-muted">No transactions found</td></tr>`;

      if (window.lucide) { window.lucide.createIcons(); }

    } catch (err) {
      console.error("Error loading client ledger:", err);
    }
  }

  // -------------------------------------------------------------
  // TAB 6: PRODUCTION PIPELINE RENDERER
  // -------------------------------------------------------------
  function renderCosting() {
    const tbody = document.getElementById('table-costing');
    if (!tbody) return;

    if (state.jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem;">No jobs found.</td></tr>';
      return;
    }

    tbody.innerHTML = state.jobs.map(job => {
      // Find rate
      let rate = 0;
      const product = state.client_products.find(p => p.client_id === job.client_id && p.name === job.job_title);
      if (product) rate = product.rate_per_box;

      const revenue = job.delivered_qty * rate;

      const stages = ['queue', 'printing', 'lamination', 'die_cutting', 'outside_pasting', 'delivered'];
      const stageIdx = stages.indexOf(job.current_stage);
      const laminationCost = stageIdx >= stages.indexOf('lamination') ? (job.lamination_cost || 0) : 0;
      const diecutCost = stageIdx >= stages.indexOf('die_cutting') ? (job.diecut_cost || 0) : 0;
      const pastingCost = stageIdx >= stages.indexOf('outside_pasting') ? (job.pasting_cost || 0) : 0;
        const windowCost = job.window_cost || 0;

      const totalCost = (job.material_cost || 0) + (job.print_cost || 0) + laminationCost + diecutCost + pastingCost + windowCost;
      const profit = revenue - totalCost;

      const isCompleted = job.status === 'completed';

      return `
        <tr style="opacity: ${isCompleted ? 1 : 0.7}">
          <td>${job.job_no} ${!isCompleted ? '<span class="badge badge-warning" style="font-size:0.6rem">WIP</span>' : '<span class="badge badge-success" style="font-size:0.6rem">Done</span>'}</td>
          <td>${job.job_title} <small>(${job.delivered_qty}/${job.order_qty} del)</small></td>
          <td style="color:var(--emerald)">Rs. ${revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td>Rs. ${(job.material_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td>Rs. ${(job.print_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td>Rs. ${laminationCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td>Rs. ${diecutCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td>Rs. ${pastingCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td style="font-weight:bold; color:var(--red)">Rs. ${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td style="font-weight:bold; color:${profit >= 0 ? 'var(--emerald)' : 'var(--red)'}">Rs. ${profit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        </tr>
      `;
    }).join('');
  }

  function renderProduction() {
    const stages = ['queue', 'cutting', 'printing', 'lamination', 'die_cutting', 'outside_pasting', 'delivered'];


    stages.forEach(stage => {
      const stageJobs = state.jobs.filter(j => j.current_stage === stage);
      const container = document.getElementById(`cards-${stage}`);
      const countBadge = document.getElementById(`count-${stage}`);

      if (countBadge) countBadge.innerText = stageJobs.length;

      if (container) {
        container.innerHTML = stageJobs.map(job => `
          <div class="job-card">
            <div class="job-card-header">
              <span>${job.job_no}</span>
              <span>Solna #${job.solna_machine}</span>
            </div>
            <div class="job-card-title">${job.job_title}</div>
            <div class="job-card-meta">
              Order: <strong>${job.order_qty.toLocaleString()} pcs</strong><br>
              Stock: ${job.pkts_required} Pkts (${job.paper_type} ${job.gsm}g)<br>
              Colors: ${job.colors || 1} Colors ${job.extra_colors && job.extra_colors.length ? `<span style="font-size: 0.8rem; color: var(--amber);"><br>&rarr; Includes: ${job.extra_colors.map(c => c.label).join(', ')}</span>` : ''}<br>
              Print Cost: <strong style="color: var(--emerald);">Rs. ${job.print_cost ? job.print_cost.toLocaleString() : 0}</strong>
              ${(() => {
                const stages = ['queue', 'printing', 'lamination', 'die_cutting', 'outside_pasting', 'delivered'];
                const stageIdx = stages.indexOf(job.current_stage);
                let html = '';
                if (stageIdx >= stages.indexOf('lamination') && job.lamination_type && job.lamination_type !== 'none') {
                  html += `<br>Lamination: <strong>${job.lamination_type.toUpperCase()}</strong> (Cost: Rs. ${job.lamination_cost ? job.lamination_cost.toLocaleString() : 0})`;
                }
                if (stageIdx >= stages.indexOf('die_cutting') && job.diecut_cost) {
                  html += `<br>Die Cut: (Cost: Rs. ${job.diecut_cost.toLocaleString()})`;
                }
                if (stageIdx >= stages.indexOf('outside_pasting') && job.pasting_cost) {
                  html += `<br>Pasting: (Cost: Rs. ${job.pasting_cost.toLocaleString()})`;
                }
                return html;
              })()}
            </div>

            ${stage === 'outside_pasting' ? `
              <div class="job-card-meta" style="margin-top: 0.4rem; color: var(--amber);">
                Pasting Recv: ${job.pasting_received_qty} / ${job.pasting_sent_qty || job.order_qty}
              </div>
            ` : ''}

            <div class="job-card-actions">
              ${getPrevStageBtn(job)}
              ${getNextStageBtn(job)}
              ${stage === 'outside_pasting' ? `<button class="btn btn-secondary btn-sm" onclick="openPastingModal(${job.id})">Pasting Dispatch</button>` : ''}
              ${stage !== 'delivered' ? `<button class="btn btn-emerald btn-sm" onclick="quickDeliver(${job.id})">Deliver</button>` : ''}
            </div>
          </div>
        `).join('');
      }
    });
  }

  function getPrevStageBtn(job) {
    const prevMap = {
      'printing': 'queue',
      'lamination': 'printing',
      'die_cutting': 'lamination',
      'outside_pasting': 'die_cutting',
      'delivered': 'outside_pasting'
    };
    const prev = prevMap[job.current_stage];
    if (prev) {
      return `<button class="btn btn-secondary btn-sm" onclick="moveJobStage(${job.id}, '${prev}')" title="Undo Stage" style="padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; background-color: transparent; border: 1px solid var(--border-color);">&larr; Undo</button>`;
    }
    return '';
  }

  function getNextStageBtn(job) {
    if (job.current_stage === 'queue') {
      return `<button class="btn btn-primary btn-sm" onclick="moveJobStage(${job.id}, 'printing')">Start Printing</button>`;
    }

    if (job.current_stage === 'printing') {
      return `<button class="btn btn-primary btn-sm" onclick="openLaminationModal(${job.id})">Send Lamination</button>`;
    }

    if (job.current_stage === 'lamination') {
      return `<button class="btn btn-primary btn-sm" onclick="openDieCutModal(${job.id})">Send Die Cut</button>`;
    }

    if (job.current_stage === 'die_cutting') {
      return `<button class="btn btn-primary btn-sm" onclick="openSendPastingModal(${job.id})">Send Pasting</button>`;
    }



    const stageFlow = {};

    const current = stageFlow[job.current_stage];
    if (!current) return '';

    return `<button class="btn btn-primary btn-sm" onclick="moveJobStage(${job.id}, '${current.next}')">${current.label}</button>`;
  }

  window.moveJobStage = async function(jobId, newStage) {
    try {
      await fetch(`/api/jobs/${jobId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      });
      await loadAllData();
    } catch (err) {
      console.error("Error moving job stage:", err);
    }
  };

  window.issueJobPaper = async function(jobId) {
    if (!confirm("Are you sure you want to issue paper for this job? This will deduct stock from your inventory.")) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/issue-paper`, { method: 'POST' }).then(r => r.json());
      if (res.error) {
        showToast('Error', res.error, 'error');
        return;
      }
      showToast('Success', 'Paper issued and stock deducted.', 'success');
      await loadAllData();
    } catch (err) {
      console.error("Error issuing paper:", err);
    }
  };
  window.openSendPastingModal = function(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;
    document.getElementById('send-pasting-job-id').value = job.id;
    document.getElementById('send-pasting-job-info').innerText = `${job.job_no} - ${job.job_title} (${job.order_qty} pcs)`;
    document.getElementById('send-pasting-rate').value = job.pasting_rate_per_box || '';
    openModal('modal-send-pasting');
  };

  window.openPastingModal = function(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('pasting-job-id').value = job.id;
    document.getElementById('pasting-dispatch-job-info').innerText = `${job.job_no} - ${job.job_title} (${job.order_qty} pcs)`;
    document.getElementById('pasting-sent-qty').value = job.pasting_sent_qty || job.order_qty;
    document.getElementById('pasting-received-qty').value = job.pasting_received_qty || 0;
    document.getElementById('pasting-rate-1000').value = job.pasting_rate_per_1000 || 1200;

    openModal('modal-pasting');
  };

  window.openDieCutModal = function(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('diecut-job-id').value = job.id;
    document.getElementById('diecut-job-info').innerText = `${job.job_no} - ${job.job_title} (${job.order_qty} pcs)`;
    document.getElementById('diecut-rate').value = '0';
    document.getElementById('diecut-total-amount').value = '0';

    openModal('modal-diecut');
  };

  window.openLaminationModal = function(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('lamination-job-id').value = job.id;
    document.getElementById('lamination-job-info').innerText = `${job.job_no} - ${job.job_title} (${job.order_qty} pcs)`;
    
    // Parse dimensions from machine_sheet_size (e.g. "18x23") if available
    let w = 18, h = 23;
    if (job.machine_sheet_size && (job.machine_sheet_size.includes('x') || job.machine_sheet_size.includes('X') || job.machine_sheet_size.includes('*'))) {
      const parts = job.machine_sheet_size.toLowerCase().replace(/\*/g, 'x').split('x');
      w = parseFloat(parts[0]);
      h = parseFloat(parts[1]);
    }
    document.getElementById('lamination-sheet-w').value = w;
    document.getElementById('lamination-sheet-h').value = h;
    document.getElementById('lamination-type').value = 'none';
    document.getElementById('lamination-rate').value = '0';
    document.getElementById('lamination-total-amount').value = '0';

    openModal('modal-lamination');
  };

  window.quickDeliver = async function(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('deliver-job-id').value = job.id;
    document.getElementById('deliver-job-info').innerText = `Enter delivered quantity for ${job.job_no} (Order Qty: ${job.order_qty}):`;
    document.getElementById('deliver-qty').value = job.order_qty - (job.delivered_qty || 0);

    openModal('modal-deliver');
  };

  // -------------------------------------------------------------
  // FORM SUBMISSION HANDLERS
  // -------------------------------------------------------------
  function setupFormListeners() {
    const formEditOB = document.getElementById('form-edit-opening-balance');
    if (formEditOB) {
      formEditOB.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('edit-ob-type').value;
        const amount = parseFloat(document.getElementById('edit-ob-amount').value) || 0;
        
        const id = type === 'vendor' ? state.selectedVendor?.id : state.selectedClient?.id;
        if (!id) return;
        
        try {
          const res = await fetch(`/api/${type}s/${id}/opening-balance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initial_balance: amount })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to update opening balance');
          
          showToast('Updated', 'Opening balance updated successfully.', 'success');
          closeModal('modal-edit-opening-balance');
          await loadAllData();
          if (type === 'vendor') renderVendors();
          else renderClients();
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      });
    }

    document.getElementById('form-imposition').addEventListener('submit', (e) => {
      e.preventDefault();
      runCalculator();
    });

    // Calculator: Client selector loads saved products
    document.getElementById('calc-client-id').addEventListener('change', (e) => {
      loadClientProducts(e.target.value);
      // Reset product fields
      document.getElementById('calc-product-name').value = '';
      document.getElementById('calc-box-w').value = '';
      document.getElementById('calc-box-l').value = '';
    });

    // Calculator: Saved product auto-fills dimensions
    document.getElementById('calc-saved-product').addEventListener('change', (e) => {
      onSavedProductSelected(e.target.value);
    });

    document.getElementById('btn-order-material').addEventListener('click', () => {
      orderMaterialFromManual();
    });

    // Auto-calculate total print cost based on colors and packets issued
    function calculatePrintCost() {
      const colors = parseInt(document.getElementById('issue-colors').value) || 0;
      const pkts = parseInt(document.getElementById('issue-pkts-qty').value) || 0;
      const materialCostInput = document.getElementById('issue-material-cost');
      
      if (pkts > 0) {
        const rateKg = parseFloat(materialCostInput.dataset.ratePerKg) || 0;
        const w = parseFloat(materialCostInput.dataset.w) || 0;
        const h = parseFloat(materialCostInput.dataset.h) || 0;
        const gsm = parseFloat(materialCostInput.dataset.gsm) || 0;
        
        if (rateKg > 0 && w > 0 && h > 0 && gsm > 0) {
          const weight = (w * h * gsm) / 15500;
          const cost = weight * rateKg * pkts;
          materialCostInput.value = cost.toFixed(2);
        }
      } else if (pkts === 0) {
        materialCostInput.value = '0';
      }
      
      if (colors <= 0 || pkts <= 0) {
        document.getElementById('issue-total-amount').value = '';
        return;
      }
      
      const standardColors = Math.min(colors, 4);
      let extraRatesTotal = 0;
      
      if (colors > 4) {
        for (let i = 5; i <= colors; i++) {
          const rateInput = document.getElementById(`extra-color-rate-${i}`);
          if (rateInput) {
            extraRatesTotal += parseFloat(rateInput.value) || 0;
          }
        }
      }
      
      const ratePer1000 = (standardColors * 700) + extraRatesTotal;
      const sheets = pkts * 100; // 1 packet = 100 sheets
      
      const totalCost = (sheets / 1000) * ratePer1000;
      document.getElementById('issue-total-amount').value = totalCost.toFixed(2);
    }
    
    // Handle dynamic extra color inputs
    function renderExtraColorInputs() {
      const colors = parseInt(document.getElementById('issue-colors').value) || 0;
      const container = document.getElementById('extra-colors-container');
      
      if (colors <= 4) {
        container.style.display = 'none';
        container.innerHTML = '';
        calculatePrintCost();
        return;
      }
      
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      
      // We need inputs for colors 5, 6, ..., colors
      let html = '<div style="font-weight:bold; color:var(--amber); margin-bottom: 0.2rem; font-size: 0.9rem;">Extra Colors (Cost per 1000 sheets)</div>';
      
      for (let i = 5; i <= colors; i++) {
        // preserve existing values if they are already in the DOM
        const existingLabel = document.getElementById(`extra-color-label-${i}`)?.value || `Special Color ${i}`;
        const existingRate = document.getElementById(`extra-color-rate-${i}`)?.value || 2500;
        
        html += `
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" id="extra-color-label-${i}" value="${existingLabel}" placeholder="Color Label (e.g. Gold)" style="flex: 2;" required>
            <input type="number" id="extra-color-rate-${i}" value="${existingRate}" placeholder="Rate (e.g. 2500)" style="flex: 1;" step="1" min="0" required oninput="document.getElementById('issue-pkts-qty').dispatchEvent(new Event('input'))">
          </div>
        `;
      }
      container.innerHTML = html;
      calculatePrintCost();
    }

    document.getElementById('issue-colors').addEventListener('input', () => {
      renderExtraColorInputs();
    });
    document.getElementById('issue-pkts-qty').addEventListener('input', calculatePrintCost);

    // Smart Auto Calculation for Issue Stock Modal
    const issueClientSelect = document.getElementById('issue-client-id');
    const issueProductSelect = document.getElementById('issue-product-select');
    const issueOrderQty = document.getElementById('issue-order-qty');
    const issuePktsQty = document.getElementById('issue-pkts-qty');
    const issueUpsInput = document.getElementById('issue-product-ups');
    const issueJobTitle = document.getElementById('issue-job-title');
    const issueColors = document.getElementById('issue-colors');

    if (issueClientSelect) {
      issueClientSelect.addEventListener('change', (e) => {
        loadClientProductsForIssue(e.target.value);
      });
    }

    if (issueProductSelect) {
      issueProductSelect.addEventListener('change', (e) => {
        const prodId = e.target.value;
        if (!prodId || !window.issueProductsList) return;
        const prod = window.issueProductsList.find(p => p.id == prodId);
        if (prod) {
          issueJobTitle.value = prod.name;
          issueUpsInput.value = prod.ups || 1;
          issueColors.value = prod.colors || 1;
          renderExtraColorInputs();
          
          // Re-calculate pkts if order qty is already there
          if (issueOrderQty.value) {
            const qty = parseFloat(issueOrderQty.value);
            const ups = parseFloat(prod.ups) || 1;
            const sheetsNeeded = qty / ups;
            issuePktsQty.value = Math.ceil(sheetsNeeded / 100);
            calculatePrintCost();
          }
        }
      });
    }

    if (issueOrderQty) {
      issueOrderQty.addEventListener('input', (e) => {
        const qty = parseFloat(e.target.value);
        const ups = parseFloat(issueUpsInput.value) || 1;
        if (qty > 0 && ups > 0) {
          const sheetsNeeded = qty / ups;
          issuePktsQty.value = Math.ceil(sheetsNeeded / 100);
          calculatePrintCost();
        } else {
          issuePktsQty.value = '';
          calculatePrintCost();
        }
      });
    }

    if (issuePktsQty) {
      issuePktsQty.addEventListener('input', (e) => {
        const pkts = parseFloat(e.target.value);
        const ups = parseFloat(issueUpsInput.value) || 1;
        if (pkts > 0 && ups > 0) {
          issueOrderQty.value = pkts * 100 * ups;
        } else {
          issueOrderQty.value = '';
        }
        calculatePrintCost();
      });
    }

    function calculateCutMath() {
      const W = parseFloat(document.getElementById('cut-source-w').value) || 0;
      const H = parseFloat(document.getElementById('cut-source-h').value) || 0;
      const w = parseFloat(document.getElementById('cut-new-w').value) || 0;
      const h = parseFloat(document.getElementById('cut-new-h').value) || 0;
      const targetPkts = parseFloat(document.getElementById('cut-target-pkts').value) || 0;

      if (W > 0 && H > 0 && w > 0 && h > 0) {
        const piecesA = Math.floor(W / w) * Math.floor(H / h);
        const piecesB = Math.floor(W / h) * Math.floor(H / w);
        const cutsPerSheet = Math.max(piecesA, piecesB);
        
        document.getElementById('cut-pieces').value = cutsPerSheet > 0 ? cutsPerSheet : 0;

        if (cutsPerSheet > 0 && targetPkts > 0) {
          const masterPkts = Math.ceil(targetPkts / cutsPerSheet);
          document.getElementById('cut-pkts').value = masterPkts;
        } else {
          document.getElementById('cut-pkts').value = '';
        }
      }
    }

    document.getElementById('cut-new-w').addEventListener('input', calculateCutMath);
    document.getElementById('cut-new-h').addEventListener('input', calculateCutMath);
    document.getElementById('cut-target-pkts').addEventListener('input', calculateCutMath);

    document.getElementById('form-cut-stock').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        source_id: document.getElementById('cut-source-id').value,
        pkts_to_cut: document.getElementById('cut-pkts').value,
        cuts_per_sheet: document.getElementById('cut-pieces').value,
        new_size_w: document.getElementById('cut-new-w').value,
        new_size_h: document.getElementById('cut-new-h').value
      };

      try {
        const res = await fetch('/api/inventory/cut', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cut stock');
        
        closeModal('modal-cut-stock');
        await loadAllData();
        renderInventory();
        showToast('Success', 'Stock has been cut and added to inventory!', 'success');
      } catch (err) {
        alert(err.message);
      }
    });


    document.getElementById('form-issue-stock').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const colors = parseInt(document.getElementById('issue-colors').value) || 1;
      const extra_colors = [];
      if (colors > 4) {
        for (let i = 5; i <= colors; i++) {
          const label = document.getElementById(`extra-color-label-${i}`)?.value || `Color ${i}`;
          const rate = parseFloat(document.getElementById(`extra-color-rate-${i}`)?.value) || 0;
          extra_colors.push({ label, rate });
        }
      }
      
      const payload = {
        stock_id: document.getElementById('issue-stock-id').value,
        client_id: document.getElementById('issue-client-id').value,
        job_title: document.getElementById('issue-job-title').value,
        order_qty: document.getElementById('issue-order-qty').value,
        pkts_issued: document.getElementById('issue-pkts-qty').value,
        colors: colors,
        extra_colors: extra_colors,
        material_cost: document.getElementById('issue-material-cost').value,
        total_amount: document.getElementById('issue-total-amount').value
      };

      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.error) {
          showToast('Error', res.error, 'error');
          return;
        }

        closeModal('modal-issue-stock');
        await loadAllData();
        renderProduction();
        renderInventory();
        showToast('Success', 'Stock issued and Job started in Cutting!', 'success');
      } catch (err) {
        console.error("Error issuing stock:", err);
      }
    });

    // Place Purchase Order form
    const placeOrderBtn = document.getElementById('btn-place-order');
    if (placeOrderBtn) placeOrderBtn.addEventListener('click', () => openModal('modal-order'));

    const btnAddOrderItem = document.getElementById('btn-add-order-item');
    if (btnAddOrderItem) {
      btnAddOrderItem.addEventListener('click', () => {
        const container = document.getElementById('order-items-container');
        const itemHtml = `
          <div class="order-item-row bg-slate-800/80 border border-slate-700/60 p-4 rounded-xl relative hover:border-cyan-500/50 transition-colors mt-4">
            <button type="button" class="btn remove-item-btn flex items-center justify-center absolute -top-2 -right-2 w-7 h-7 bg-red-500/20 text-red-400 border border-red-500/50 rounded-full hover:bg-red-500 hover:text-white transition-colors p-0 font-bold" title="Remove Item">&times;</button>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              <div class="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Material Type</label>
                <select class="order-paper-type bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full" required>
                  <optgroup label="Paper & Boards">
                    <option value="Bleach Card">Bleach Card</option>
                    <option value="Art Paper">Art Paper</option>
                    <option value="Sticker Paper">Sticker Paper</option>
                    <option value="Duplex Board">Duplex Board</option>
                    <option value="Reel">Reel</option>
                  </optgroup>
                  <optgroup label="Plastics & Films">
                    <option value="PVC Window Film">PVC Window Film</option>
                  </optgroup>
                </select>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase lbl-order-gsm">GSM / MICRONS</label>
                <input type="number" class="order-gsm bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="300" required>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Length (inches)</label>
                <input type="number" class="order-w bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="25" step="0.5" required>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Width (inches)</label>
                <input type="number" class="order-h bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="36" step="0.5" required>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase lbl-order-qty">PACKETS / QTY</label>
                <input type="number" class="order-pkts bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="20" required>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Rate</label>
                <input type="number" class="order-rate-kg bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="145" step="1" required>
              </div>

            </div>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHtml);
        
        // Add remove listener to new button
        const removeBtns = container.querySelectorAll('.remove-item-btn');
        const lastBtn = removeBtns[removeBtns.length - 1];
        lastBtn.addEventListener('click', (e) => {
          e.target.closest('.order-item-row').remove();
        });
      });
    }

    const orderItemsContainer = document.getElementById('order-items-container');
    if (orderItemsContainer) {
      orderItemsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('order-paper-type')) {
          const row = e.target.closest('.order-item-row');
          if (!row) return;
          const isPVC = e.target.value === 'PVC Window Film';
          const lblGsm = row.querySelector('.lbl-order-gsm');
          const lblQty = row.querySelector('.lbl-order-qty');
          
          if (lblGsm) lblGsm.innerText = isPVC ? 'MICRONS' : 'GSM / MICRONS';
          if (lblQty) lblQty.innerText = isPVC ? 'SHEETS' : 'PACKETS / QTY';
        }
      });
    }


    document.getElementById('form-order').addEventListener('submit', async (e) => {
      e.preventDefault();
      const vendorId = document.getElementById('order-vendor-id').value;
      if (!vendorId) {
        showToast('Missing Vendor', 'Please select or add a paper vendor first!', 'warning');
        return;
      }

      const itemRows = document.querySelectorAll('.order-item-row');
      const items = [];
      
      itemRows.forEach(row => {
        items.push({
          paper_type: row.querySelector('.order-paper-type').value,
          gsm: row.querySelector('.order-gsm').value,
          size_w: row.querySelector('.order-w').value,
          size_h: row.querySelector('.order-h').value,
          ordered_pkts: row.querySelector('.order-pkts').value,
          rate_per_kg: row.querySelector('.order-rate-kg').value
        });
      });

      if (items.length === 0) {
        showToast('No Items', 'Please add at least one item to order.', 'warning');
        return;
      }

      const payload = {
        vendor_id: vendorId,
        items: items
      };

      try {
        const res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.error) {
          showToast('Error', 'Error placing order: ' + res.error, 'error');
          return;
        }

        closeModal('modal-order');
        await loadAllData();
        renderPurchaseOrders();
        showToast('Order Placed', 'Purchase order registered successfully.', 'success');
        
        // Reset dynamic rows (keep first)
        const container = document.getElementById('order-items-container');
        if (container) {
          const rows = container.querySelectorAll('.order-item-row');
          for (let i = 1; i < rows.length; i++) {
            rows[i].remove();
          }
          // Reset first row
          const firstRow = rows[0];
          if (firstRow) {
            firstRow.querySelector('.order-gsm').value = 300;
            firstRow.querySelector('.order-w').value = 25;
            firstRow.querySelector('.order-h').value = 36;
            firstRow.querySelector('.order-pkts').value = 20;
            firstRow.querySelector('.order-rate-kg').value = 145;
          }
        }

      } catch (err) {
        console.error("Error placing order:", err);
      }
    });

    // Receive Goods form
    document.getElementById('form-edit-po').addEventListener('submit', async (e) => {
      e.preventDefault();
      const poId = document.getElementById('edit-po-id').value;
      const payload = {
        paper_type: document.getElementById('edit-po-type').value,
        gsm: document.getElementById('edit-po-gsm').value,
        size_w: document.getElementById('edit-po-w').value,
        size_h: document.getElementById('edit-po-h').value,
        ordered_pkts: document.getElementById('edit-po-qty').value,
        rate_per_kg: document.getElementById('edit-po-rate').value
      };

      try {
        const res = await fetch(`/api/purchase-orders/${poId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update order');
        
        showToast("Order updated successfully!");
        closeModal('modal-edit-po');
        await loadInitialData();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('form-receive-goods').addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('receive-order-id').value;

      const payload = {
        received_pkts: document.getElementById('receive-pkts').value,
        rate_per_kg: document.getElementById('receive-rate-kg').value,
        size_w: document.getElementById('receive-w').value,
        size_h: document.getElementById('receive-h').value,
        gsm: document.getElementById('receive-gsm').value,
        payment_type: document.getElementById('receive-payment-type').value,
        credit_days: document.getElementById('receive-credit-days').value
      };

      try {
        const res = await fetch(`/api/purchase-orders/${orderId}/receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.error) {
          showToast('Error', 'Error receiving goods: ' + res.error, 'error');
          return;
        }

        closeModal('modal-receive-goods');
        await loadAllData();
        renderPurchaseOrders();
        renderInventory();
        showToast('Goods Received', 'Stock added and vendor bill created.', 'success');
      } catch (err) {
        console.error("Error receiving goods:", err);
      }
    });

    // Add Vendor Triggers & Form Submit
    const addVendorBtn = document.getElementById('btn-add-vendor');
    if (addVendorBtn) addVendorBtn.addEventListener('click', () => openModal('modal-add-vendor'));

    const addVendorFromInvBtn = document.getElementById('btn-add-vendor-from-inv');
    if (addVendorFromInvBtn) addVendorFromInvBtn.addEventListener('click', () => openModal('modal-add-vendor'));

    const quickNewVendorBtn = document.getElementById('btn-quick-new-vendor');
    if (quickNewVendorBtn) quickNewVendorBtn.addEventListener('click', () => openModal('modal-add-vendor'));

    document.getElementById('form-add-vendor').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('av-name').value,
        category: document.getElementById('av-category').value,
        phone: document.getElementById('av-phone').value,
        initial_balance: document.getElementById('av-balance').value
      };

      try {
        const newVendor = await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        closeModal('modal-add-vendor');
        await loadAllData();
        state.selectedVendor = newVendor;
        renderVendors();
        populateDropdowns();
        
        // Auto select in stock modal if open
        const stockVendorSelect = document.getElementById('stock-vendor-id');
        if (stockVendorSelect) stockVendorSelect.value = newVendor.id;
      } catch (err) {
        console.error("Error adding vendor:", err);
      }
    });

    // Add Customer Triggers & Form Submit
    const addClientBtn = document.getElementById('btn-add-client');
    if (addClientBtn) addClientBtn.addEventListener('click', () => openModal('modal-add-client'));

    document.getElementById('form-add-client').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('ac-name').value,
        company: document.getElementById('ac-company').value,
        phone: document.getElementById('ac-phone').value,
        initial_balance: document.getElementById('ac-balance').value
      };

      try {
        const newClient = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        closeModal('modal-add-client');
        await loadAllData();
        state.selectedClient = newClient;
        renderClients();
        populateDropdowns();
      } catch (err) {
        console.error("Error adding customer:", err);
      }
    });

    const recordVendorPaymentBtn = document.getElementById('btn-record-vendor-payment');
    if (recordVendorPaymentBtn) {
      recordVendorPaymentBtn.addEventListener('click', () => openModal('modal-v-payment'));
    }

    // Add Client Product Modal
    const btnAddClientProduct = document.getElementById('btn-add-client-product');
    if (btnAddClientProduct) {
      btnAddClientProduct.addEventListener('click', () => {
        if (!state.selectedClient) return;
        document.getElementById('prod-client-id').value = state.selectedClient.id;
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-sheet-size').value = '';
        document.getElementById('prod-ups').value = '';
        document.getElementById('prod-colors').value = '1';
        document.getElementById('prod-rate').value = '';
        document.getElementById('prod-desc').value = '';
        openModal('modal-add-product');
      });
    }

    const formAddProduct = document.getElementById('form-add-product');
    if (formAddProduct) {
      formAddProduct.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientId = document.getElementById('prod-client-id').value;
        const prodId = document.getElementById('prod-id').value;
        const payload = {
          name: document.getElementById('prod-name').value,
          paper_size: document.getElementById('prod-sheet-size').value,
          ups: document.getElementById('prod-ups').value,
          colors: document.getElementById('prod-colors').value,
          rate_per_box: document.getElementById('prod-rate').value,
          description: document.getElementById('prod-desc').value
        };

        try {
          const url = prodId ? `/api/clients/${clientId}/products/${prodId}` : `/api/clients/${clientId}/products`;
          const method = prodId ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            showToast('Success', 'Product saved!', 'success');
            closeModal('modal-add-product');
            loadClientProductsForIssue(clientId);
          }
        } catch (err) {
          console.error("Error saving product:", err);
        }
      });
    }

    const formVPayment = document.getElementById('form-v-payment');
    if (formVPayment) {
      formVPayment.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.selectedVendor) return;

        const payload = {
          amount: document.getElementById('vp-amount').value,
          payment_method: document.getElementById('vp-method').value,
          description: document.getElementById('vp-desc').value
        };

        try {
          await fetch(`/api/vendors/${state.selectedVendor.id}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          closeModal('modal-v-payment');
          await loadAllData();
          renderVendors();
          showToast('Payment Recorded', 'Vendor payment posted to ledger.', 'success');
        } catch (err) {
          console.error("Error posting vendor payment:", err);
        }
      });
    }



    // Bill Pay Form
    document.getElementById('form-bill-pay').addEventListener('submit', async (e) => {
      e.preventDefault();
      const vendorId = document.getElementById('bp-vendor-id').value;
      const billId = document.getElementById('bp-bill-id').value;

      const payload = {
        amount: document.getElementById('bp-amount').value,
        payment_method: document.getElementById('bp-method').value,
        cheque_no: document.getElementById('bp-cheque').value,
        date: document.getElementById('bp-date').value
      };

      try {
        const res = await fetch(`/api/vendors/${vendorId}/bill/${billId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.error) {
          showToast('Error', res.error, 'error');
          return;
        }

        closeModal('modal-bill-pay');
        await loadAllData();
        renderVendors();
        showToast('Payment Recorded', `Payment of Rs. ${parseFloat(payload.amount).toLocaleString()} recorded against bill. ${res.bill.status === 'paid' ? 'Bill is now fully cleared! âœ“' : ''}`, 'success');
      } catch (err) {
        console.error("Error paying bill:", err);
        showToast('Error', 'Failed to record payment.', 'error');
      }
    });

    document.getElementById('btn-record-client-payment').addEventListener('click', () => openModal('modal-c-payment'));
    
    if (document.getElementById('form-send-pasting')) {
      document.getElementById('form-send-pasting').addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = document.getElementById('send-pasting-job-id').value;
        const rate = parseFloat(document.getElementById('send-pasting-rate').value) || 0;
        
        try {
          await fetch(`/api/jobs/${jobId}/stage`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: 'outside_pasting', pasting_rate_per_box: rate })
          });
          closeModal('modal-send-pasting');
          await loadAllData();
        } catch (err) {
          console.error(err);
        }
      });
    }

    if (document.getElementById('form-deliver')) {
      document.getElementById('form-deliver').addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = document.getElementById('deliver-job-id').value;
        const deliverQty = parseInt(document.getElementById('deliver-qty').value);
        
        const job = state.jobs.find(j => j.id == jobId);
        if (job && deliverQty > job.order_qty) {
           showToast("Invalid Quantity", `You cannot deliver ${deliverQty} boxes. It exceeds the total order quantity of ${job.order_qty}.`, 'error');
           return;
        }

        const isConfirmed = await showConfirm({
           title: "Confirm Delivery",
           message: "Are you sure you want to finalize delivery? This will update the invoice in Customer Accounts.",
           details: [
              { label: "Job Number", value: job ? job.job_no : jobId },
              { label: "Quantity", value: `${deliverQty} boxes` }
           ],
           confirmText: "Deliver",
           confirmClass: "btn-emerald"
        });

        if (!isConfirmed) {
           return;
        }
        
        try {
          await fetch(`/api/jobs/${jobId}/deliver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliver_qty: deliverQty })
          });
          closeModal('modal-deliver');
          await loadAllData();
        } catch (err) {
          console.error("Error updating delivery:", err);
        }
      });
    }

    document.getElementById('form-c-payment').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.selectedClient) return;

      const payload = {
        amount: document.getElementById('cp-amount').value,
        payment_method: document.getElementById('cp-method').value,
        description: document.getElementById('cp-desc').value
      };

      try {
        await fetch(`/api/clients/${state.selectedClient.id}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal('modal-c-payment');
        await loadAllData();
        renderClients();
      } catch (err) {
        console.error("Error posting client payment:", err);
      }
    });

      window.openWindowModal = function(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('window-job-id').value = job.id;
    document.getElementById('window-job-info').innerText = job.job_no + ' - ' + job.job_title + ' (' + job.order_qty + ' pcs)';
    document.getElementById('window-w').value = '';
    document.getElementById('window-h').value = '';
    document.getElementById('window-total-amount').value = '0';

    openModal('modal-window');
  };

  function calculateWindowCost() {
    const w = parseFloat(document.getElementById('window-w').value) || 0;
    const h = parseFloat(document.getElementById('window-h').value) || 0;
    const rate = parseFloat(document.getElementById('window-rate').value) || 0;
    const jobId = document.getElementById('window-job-id').value;
    
    if (w <= 0 || h <= 0 || rate <= 0 || !jobId) {
      document.getElementById('window-total-amount').value = '0';
      return;
    }
    
    const job = state.jobs.find(j => j.id == jobId);
    if (!job) return;
    
    // Total cost = w * h * rate * order_qty
    const totalCost = w * h * rate * (job.order_qty || 0);
    document.getElementById('window-total-amount').value = totalCost.toFixed(2);
  }

  document.getElementById('window-w').addEventListener('input', calculateWindowCost);
  document.getElementById('window-h').addEventListener('input', calculateWindowCost);
  document.getElementById('window-rate').addEventListener('input', calculateWindowCost);

  document.getElementById('form-window').addEventListener('submit', async (e) => {
    e.preventDefault();
    const jobId = document.getElementById('window-job-id').value;
    const payload = {
      window_w: parseFloat(document.getElementById('window-w').value) || 0,
      window_h: parseFloat(document.getElementById('window-h').value) || 0,
      window_rate: parseFloat(document.getElementById('window-rate').value) || 0,
      window_cost: parseFloat(document.getElementById('window-total-amount').value) || 0
    };

    try {
      await fetch('/api/jobs/' + jobId + '/window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      closeModal('modal-window');
      await loadAllData();
      switchTab('production');
    } catch (err) {
      console.error("Error processing window:", err);
    }
  });


    // Lamination auto-calculation
    function calculateLaminationCost() {
      const type = document.getElementById('lamination-type').value;
      const rateInput = document.getElementById('lamination-rate');
      
      // Auto-set rate if type changes (optional, but requested by user)
      if (document.activeElement.id === 'lamination-type') {
        if (type === 'matte') rateInput.value = 3.50;
        else if (type === 'shine') rateInput.value = 2.30;
        else if (type === 'uv') rateInput.value = 1.20;
        else if (type === 'spot_uv') rateInput.value = 3.40;
        else if (type === 'both') rateInput.value = 5.80;
        else if (type === 'none') rateInput.value = 0;
        // if 3d, leave whatever they put or set a default
      }
      
      const rate = parseFloat(rateInput.value) || 0;
      const w = parseFloat(document.getElementById('lamination-sheet-w').value) || 0;
      const h = parseFloat(document.getElementById('lamination-sheet-h').value) || 0;
      const jobId = document.getElementById('lamination-job-id').value;
      
      if (w <= 0 || h <= 0 || !jobId) {
        document.getElementById('lamination-total-amount').value = '0';
        return;
      }
      
      const job = state.jobs.find(j => j.id == jobId);
      if (!job) return;
      
      const sheets = (job.pkts_required || 0) * 100;
      const costPerSheet = (w * h / 144) * rate;
      const totalCost = costPerSheet * sheets;
      
      document.getElementById('lamination-total-amount').value = totalCost.toFixed(2);
    }
    
    document.getElementById('lamination-type').addEventListener('change', calculateLaminationCost);
    document.getElementById('lamination-rate').addEventListener('input', calculateLaminationCost);
    document.getElementById('lamination-sheet-w').addEventListener('input', calculateLaminationCost);
    document.getElementById('lamination-sheet-h').addEventListener('input', calculateLaminationCost);

    document.getElementById('form-lamination').addEventListener('submit', async (e) => {
      e.preventDefault();
      const jobId = document.getElementById('lamination-job-id').value;
      const payload = {
        lamination_type: document.getElementById('lamination-type').value,
        lamination_rate: document.getElementById('lamination-rate').value,
        lamination_sheet_w: document.getElementById('lamination-sheet-w').value,
        lamination_sheet_h: document.getElementById('lamination-sheet-h').value,
        lamination_cost: document.getElementById('lamination-total-amount').value
      };

      try {
        await fetch(`/api/jobs/${jobId}/lamination`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal('modal-lamination');
        await loadAllData();
        switchTab('production');
      } catch (err) {
        console.error("Error processing lamination:", err);
      }
    });

    // Die Cut calculation
    document.getElementById('diecut-rate').addEventListener('input', () => {
      const jobId = document.getElementById('diecut-job-id').value;
      const rate = parseFloat(document.getElementById('diecut-rate').value) || 0;
      const job = state.jobs.find(j => j.id == jobId);
      if (!job || rate <= 0) {
        document.getElementById('diecut-total-amount').value = '0';
        return;
      }
      const sheets = (job.pkts_required || 0) * 100;
      const totalCost = sheets * rate;
      document.getElementById('diecut-total-amount').value = totalCost.toFixed(2);
    });

    document.getElementById('form-diecut').addEventListener('submit', async (e) => {
      e.preventDefault();
      const jobId = document.getElementById('diecut-job-id').value;
      const payload = {
        diecut_rate: document.getElementById('diecut-rate').value,
        diecut_cost: document.getElementById('diecut-total-amount').value
      };

      try {
        await fetch(`/api/jobs/${jobId}/diecut`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal('modal-diecut');
        await loadAllData();
        switchTab('production');
      } catch (err) {
        console.error("Error processing die cut:", err);
      }
    });

    document.getElementById('form-pasting').addEventListener('submit', async (e) => {
      e.preventDefault();
      const jobId = document.getElementById('pasting-job-id').value;
      const payload = {
        vendor_id: document.getElementById('pasting-vendor-id').value,
        sent_qty: document.getElementById('pasting-sent-qty').value,
        received_qty: document.getElementById('pasting-received-qty').value,
        rate_per_1000: document.getElementById('pasting-rate-1000').value,
        is_completed: document.getElementById('pasting-completed').checked
      };

      try {
        await fetch(`/api/jobs/${jobId}/pasting-dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        closeModal('modal-pasting');
        await loadAllData();
        switchTab('production');
      } catch (err) {
        console.error("Error updating pasting dispatch:", err);
      }
    });
  }

  // -------------------------------------------------------------
  // MODAL CONTROLLER
  // -------------------------------------------------------------
  window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  };

  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  };

  // =============================================================
  // HR & PAYROLL LOGIC
  // =============================================================

  
  window.renderEmployees = function() {
    const tbody = document.getElementById('table-employees');
    if (!tbody) return;
    
    const employees = state.employees || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = new Date().toISOString().substring(0, 7);

    // Calculate Summary Metrics
    const totalStaff = employees.length;
    const activeStaff = employees.filter(e => e.status === 'active').length;
    
    // Present Today
    const todayAtt = (state.attendance || []).filter(a => a.date === todayStr);
    const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'half-day').length;

    // Monthly Payroll Total
    const totalPayroll = employees.reduce((sum, e) => sum + (parseFloat(e.base_salary) || 0), 0);

    // Monthly Overtime Total
    const monthAtt = (state.attendance || []).filter(a => a.date && a.date.startsWith(currentMonthStr));
    const totalOvertime = monthAtt.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0);

    // Update Metric Cards if they exist
    const staffEl = document.getElementById('hr-total-staff');
    if (staffEl) staffEl.textContent = totalStaff;

    const presentEl = document.getElementById('hr-present-today');
    if (presentEl) presentEl.textContent = `${presentToday} / ${activeStaff}`;

    const payrollEl = document.getElementById('hr-monthly-payroll');
    if (payrollEl) payrollEl.textContent = `Rs. ${totalPayroll.toLocaleString()}`;

    const otEl = document.getElementById('hr-month-overtime');
    if (otEl) otEl.textContent = `${totalOvertime.toFixed(1)} Hrs`;

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding:2rem;">No employees registered yet. Click "New Employee" to add staff.</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map(e => {
      const initial = (e.name || 'E').trim().charAt(0).toUpperCase();
      return `
        <tr>
          <td>
            <div class="emp-name-cell">
              <div class="avatar-circle">${initial}</div>
              <div>
                <strong>${e.name}</strong>
              </div>
            </div>
          </td>
          <td><span style="font-weight:500; color:var(--text-main);">${e.role}</span></td>
          <td>${e.phone || '<span style="color:var(--text-muted);">-</span>'}</td>
          <td><span class="badge" style="background:rgba(255,255,255,0.05); text-transform:capitalize; border:1px solid rgba(255,255,255,0.1);">${e.salary_type || 'monthly'}</span></td>
          <td><strong style="color:var(--cyan);">Rs. ${(e.base_salary || 0).toLocaleString()}</strong></td>
          <td>
            <span class="badge badge-${e.status === 'active' ? 'success' : 'danger'}">
              ${(e.status || 'active').toUpperCase()}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size:0.8rem;" onclick="editEmployee(${e.id})">
              <i data-lucide="edit-3"></i> Edit
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    lucide.createIcons({ nodes: Array.from(tbody.querySelectorAll('.lucide')) });
  };


  window.openAddEmployeeModal = function() {
    document.getElementById('modal-employee-title').innerHTML = '<i data-lucide="user-plus"></i> Add Employee';
    document.getElementById('form-employee').reset();
    document.getElementById('emp-id').value = '';
    openModal('modal-employee');
  };

  window.editEmployee = function(id) {
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return;
    document.getElementById('modal-employee-title').innerHTML = '<i data-lucide="user-plus"></i> Edit Employee';
    document.getElementById('emp-id').value = emp.id;
    document.getElementById('emp-name').value = emp.name;
    document.getElementById('emp-role').value = emp.role;
    document.getElementById('emp-phone').value = emp.phone;
    document.getElementById('emp-salary-type').value = emp.salary_type;
    document.getElementById('emp-base-salary').value = emp.base_salary;
    openModal('modal-employee');
  };

  const formEmp = document.getElementById('form-employee');
  if (formEmp) {
    formEmp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('emp-id').value;
      const payload = {
        name: document.getElementById('emp-name').value,
        role: document.getElementById('emp-role').value,
        phone: document.getElementById('emp-phone').value,
        salary_type: document.getElementById('emp-salary-type').value,
        base_salary: document.getElementById('emp-base-salary').value
      };
      
      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? '/api/employees/' + id : '/api/employees';
        const res = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Success', id ? 'Employee updated' : 'Employee added', 'success');
          closeModal('modal-employee');
          await loadAllData();
        } else {
          showToast('Error', 'Failed to save employee', 'error');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Attendance Logic
  window.openAttendanceModal = function() {
    const dateInput = document.getElementById('att-date');
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    renderAttendanceRoster();
    openModal('modal-attendance');
  };

  window.renderAttendanceRoster = function() {
    const date = document.getElementById('att-date').value;
    const tbody = document.getElementById('attendance-roster');
    if (!tbody || !state.employees || state.employees.length === 0) return;

    const todaysAttendance = (state.attendance || []).filter(a => a.date === date);

    tbody.innerHTML = state.employees.filter(e => e.status === 'active').map(emp => {
      const att = todaysAttendance.find(a => a.employee_id === emp.id) || {};
      const status = att.status || 'present';
      
      const hasRecord = Object.keys(att).length > 0;
      const checkIn = hasRecord ? (att.check_in || '') : '10:00';
      const checkOut = hasRecord ? (att.check_out || '') : '18:00';

      return `
        <tr data-emp-id="${emp.id}">
          <td><strong>${emp.name}</strong><br><small class="text-slate-400">${emp.role}</small></td>
          <td>
            <select class="input-field att-status" style="padding: 0.2rem; min-width: 100px;">
              <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
              <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
              <option value="half-day" ${status === 'half-day' ? 'selected' : ''}>Half Day</option>
              <option value="leave" ${status === 'leave' ? 'selected' : ''}>Leave</option>
            </select>
          </td>
          <td><input type="time" class="input-field att-in" value="${checkIn}" style="padding: 0.2rem;"></td>
          <td><input type="time" class="input-field att-out" value="${checkOut}" style="padding: 0.2rem;"></td>
          <td><input type="number" class="input-field att-ot" value="${att.overtime_hours || 0}" min="0" step="0.5" style="padding: 0.2rem; width: 60px;"></td>
        </tr>
      `;
    }).join('');
  };

  const attDate = document.getElementById('att-date');
  if (attDate) attDate.addEventListener('change', renderAttendanceRoster);

  const formAtt = document.getElementById('form-attendance');
  if (formAtt) {
    formAtt.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('att-date').value;
      const records = [];
      document.querySelectorAll('#attendance-roster tr').forEach(row => {
        records.push({
          employee_id: parseInt(row.getAttribute('data-emp-id')),
          status: row.querySelector('.att-status').value,
          check_in: row.querySelector('.att-in').value,
          check_out: row.querySelector('.att-out').value,
          overtime_hours: row.querySelector('.att-ot').value
        });
      });

      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, records })
        });
        if (res.ok) {
          showToast('Success', 'Attendance saved', 'success');
          closeModal('modal-attendance');
          await loadAllData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // =============================================================
  // EXPENSES LOGIC
  // =============================================================

  window.renderExpenses = function() {
    const tbody = document.getElementById('table-expenses');
    if (!tbody) return;
    
    if (!state.expenses || state.expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--slate-400);">No expenses found.</td></tr>';
      return;
    }

    const sorted = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(exp => `
      <tr>
        <td>${exp.date}</td>
        <td><span class="badge badge-warning">${exp.category}</span></td>
        <td>${exp.description}</td>
        <td><strong style="color: var(--amber);">Rs. ${parseFloat(exp.amount).toLocaleString()}</strong></td>
        <td>
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; color: var(--red);" onclick="deleteExpense(${exp.id})">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `).join('');
    
    lucide.createIcons({ nodes: Array.from(tbody.querySelectorAll('.lucide')) });
  };

  window.openAddExpenseModal = function() {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-expense');
  };

  const formExp = document.getElementById('form-expense');
  if (formExp) {
    formExp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value,
        description: document.getElementById('exp-desc').value,
        amount: document.getElementById('exp-amount').value
      };
      
      try {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Success', 'Expense recorded', 'success');
          closeModal('modal-expense');
          await loadAllData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  window.deleteExpense = async function(id) {
    const confirm = await showConfirm({
      title: 'Delete Expense?',
      message: 'Are you sure you want to delete this expense record?',
      confirmText: 'Delete',
      confirmClass: 'btn-danger'
    });
    if (!confirm) return;

    try {
      const res = await fetch('/api/expenses/' + id, { method: 'DELETE' });
      if (res.ok) {
        showToast('Deleted', 'Expense record deleted', 'success');
        await loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };



  // =============================================================
  // ATTENDANCE CHART LOGIC
  // =============================================================
  
  window.renderAttendanceChart = function() {
    const head = document.getElementById('attendance-chart-head');
    const body = document.getElementById('attendance-chart-body');
    if (!head || !body) return;

    const monthPicker = document.getElementById('attendance-month-picker');
    if (!monthPicker.value) {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      monthPicker.value = `${now.getFullYear()}-${mm}`;
    }

    const selectedMonth = monthPicker.value; // "YYYY-MM"
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Row 1: Numbers & Summary Titles
    let row1 = `<tr><th class="sticky-col" rowspan="2" style="vertical-align:bottom; padding-bottom:0.6rem; min-width:180px; text-align:left; padding-left:1rem;">Employee</th>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const isSunday = dateObj.getDay() === 0;
      const classAttr = isSunday ? 'att-weekend-header' : '';
      row1 += `<th class="${classAttr}" style="text-align: center; width: 34px; padding: 0.3rem 0.1rem; font-size:0.8rem;">${d}</th>`;
    }
    row1 += `<th style="text-align: center; min-width: 40px; color:#34d399; background:rgba(16,185,129,0.08);" title="Total Present">P</th>`;
    row1 += `<th style="text-align: center; min-width: 40px; color:#fb7185; background:rgba(244,63,94,0.08);" title="Total Absent">A</th>`;
    row1 += `<th style="text-align: center; min-width: 40px; color:#fbbf24; background:rgba(245,158,11,0.08);" title="Total Half Days">H</th>`;
    row1 += `<th style="text-align: center; min-width: 50px; color:#38bdf8; background:rgba(56,189,248,0.08);" title="Total Overtime Hours">OT</th>`;
    row1 += `</tr>`;

    // Row 2: Day names (Su, Mo, Tu, ...)
    let row2 = `<tr>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayIdx = dateObj.getDay();
      const isSunday = dayIdx === 0;
      const classAttr = isSunday ? 'att-weekend-header' : '';
      row2 += `<th class="${classAttr}" style="text-align: center; font-size: 0.68rem; font-weight: 500; padding: 0.2rem 0.1rem; color:var(--text-muted);">${dayNames[dayIdx]}</th>`;
    }
    row2 += `<th style="background:rgba(16,185,129,0.08);"></th><th style="background:rgba(244,63,94,0.08);"></th><th style="background:rgba(245,158,11,0.08);"></th><th style="background:rgba(56,189,248,0.08);"></th>`;
    row2 += `</tr>`;

    head.innerHTML = row1 + row2;

    const employees = state.employees || [];
    if (employees.length === 0) {
      body.innerHTML = `<tr><td colspan="${daysInMonth + 5}" style="text-align: center; color:var(--text-muted); padding:2rem;">No employee attendance records to display.</td></tr>`;
      return;
    }

    const attRecords = state.attendance || [];

    let bodyHtml = '';
    employees.forEach(emp => {
      const initial = (emp.name || 'E').trim().charAt(0).toUpperCase();
      let row = `<tr>
        <td class="sticky-col" style="padding-left:1rem;">
          <div class="emp-name-cell">
            <div class="avatar-circle" style="width:26px; height:26px; font-size:0.75rem;">${initial}</div>
            <strong style="font-size:0.85rem; white-space:nowrap;">${emp.name}</strong>
          </div>
        </td>`;
      
      let pCount = 0;
      let aCount = 0;
      let hCount = 0;
      let totalOt = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        const isSunday = dateObj.getDay() === 0;
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const record = attRecords.find(a => a.employee_id === emp.id && a.date === dateStr);
        
        let cellContent = `<span class="att-empty">�</span>`;
        const colClass = isSunday ? 'att-weekend-col' : '';
        
                  if (record) {
            let autoOtHrs = 0;
            if (record.check_in && record.check_out) {
               const t1 = new Date(`1970-01-01T${record.check_in}`);
               const t2 = new Date(`1970-01-01T${record.check_out}`);
               let diffMs = t2 - t1;
               if (diffMs > 8 * 3600000) {
                 autoOtHrs = (diffMs - 8 * 3600000) / 3600000;
               }
            }
            if (autoOtHrs > 0) {
              totalOt += autoOtHrs;
            } else if (record.overtime_hours) {
              totalOt += parseFloat(record.overtime_hours) || 0;
            }
          if (record.status === 'present') {
            pCount++;
            cellContent = `<span class="att-badge att-p">P</span>`;
          } else if (record.status === 'absent') {
            aCount++;
            cellContent = `<span class="att-badge att-a">A</span>`;
          } else if (record.status === 'half-day') {
            hCount++;
            cellContent = `<span class="att-badge att-h">H</span>`;
          } else if (record.status === 'leave') {
            cellContent = `<span class="att-badge att-l">L</span>`;
          }
        }
        
        row += `<td class="${colClass}" title="${dateStr} - ${emp.name}${record ? '\nIn: '+(record.check_in||'--:--')+' | Out: '+(record.check_out||'--:--') : ''}" style="text-align: center; padding: 0.3rem 0.1rem; border-left: 1px solid rgba(255,255,255,0.03);">${cellContent}</td>`;
      }
      
      // Summary Cells
      row += `<td style="text-align: center; font-weight:700; color:#34d399; background:rgba(16,185,129,0.05); font-size:0.85rem;">${pCount}</td>`;
      row += `<td style="text-align: center; font-weight:700; color:#fb7185; background:rgba(244,63,94,0.05); font-size:0.85rem;">${aCount}</td>`;
      row += `<td style="text-align: center; font-weight:700; color:#fbbf24; background:rgba(245,158,11,0.05); font-size:0.85rem;">${hCount}</td>`;
      row += `<td style="text-align: center; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.05); font-size:0.85rem;">${totalOt > 0 ? totalOt.toFixed(1) + 'h' : '-'}</td>`;

      row += '</tr>';
      bodyHtml += row;
    });

    body.innerHTML = bodyHtml;
  };


  
  window.toggleAttView = function(view) {
    const vMonthly = document.getElementById('att-view-monthly');
    const vDaily = document.getElementById('att-view-daily');
    const btnMonthly = document.getElementById('view-toggle-monthly');
    const btnDaily = document.getElementById('view-toggle-daily');
    
    const monthPickerControls = document.getElementById('attendance-month-picker')?.parentElement;
    const markBtn = document.querySelector('button[onclick="openAttendanceModal()"]');
    const legendBar = document.querySelector('.att-legend-item')?.parentElement;
    
    if (view === 'monthly') {
      if(vMonthly) vMonthly.style.display = 'block';
      if(vDaily) vDaily.style.display = 'none';
      if(monthPickerControls) monthPickerControls.style.display = 'flex';
      if(markBtn) markBtn.style.display = 'inline-flex';
      if(legendBar) legendBar.style.display = 'flex';
      
      if(btnMonthly) {
        btnMonthly.style.background = 'rgba(6, 182, 212, 0.2)';
        btnMonthly.style.color = '#06b6d4';
      }
      if(btnDaily) {
        btnDaily.style.background = 'transparent';
        btnDaily.style.color = '#94a3b8';
      }
      if(window.renderAttendanceChart) window.renderAttendanceChart();
    } else {
      if(vMonthly) vMonthly.style.display = 'none';
      if(vDaily) vDaily.style.display = 'block';
      if(monthPickerControls) monthPickerControls.style.display = 'none';
      if(markBtn) markBtn.style.display = 'none';
      if(legendBar) legendBar.style.display = 'none';
      
      if(btnDaily) {
        btnDaily.style.background = 'rgba(6, 182, 212, 0.2)';
        btnDaily.style.color = '#06b6d4';
      }
      if(btnMonthly) {
        btnMonthly.style.background = 'transparent';
        btnMonthly.style.color = '#94a3b8';
      }
      
      const dPicker = document.getElementById('att-daily-date-picker');
      if (dPicker && !dPicker.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dPicker.value = `${yyyy}-${mm}-${dd}`;
      }
      renderAttDailyView();
    }
  };

  window.renderAttDailyView = function() {
    const dPicker = document.getElementById('att-daily-date-picker');
    const tbody = document.getElementById('att-daily-tbody');
    if (!dPicker || !tbody) return;
    
    const selectedDate = dPicker.value;
    const employees = state.employees || [];
    const attRecords = (state.attendance || []).filter(a => a.date === selectedDate);
    
    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color:var(--text-muted); padding:2rem;">No employees found.</td></tr>';
      return;
    }

    let html = '';
    employees.filter(e => e.status === 'active').forEach(emp => {
      const record = attRecords.find(a => a.employee_id === emp.id) || {};
      const status = record.status || 'No Record';
      const checkIn = record.check_in || '--:--';
      const checkOut = record.check_out || '--:--';
      const ot = record.overtime_hours ? `${record.overtime_hours}h` : '-';
      
      let statusBadge = `<span class="badge" style="background: rgba(148,163,184,0.1); color: #94a3b8;">${status}</span>`;
      if (status === 'present') statusBadge = `<span class="badge" style="background: rgba(16,185,129,0.1); color: #34d399;">Present</span>`;
      if (status === 'absent') statusBadge = `<span class="badge" style="background: rgba(244,63,94,0.1); color: #fb7185;">Absent</span>`;
      if (status === 'half-day') statusBadge = `<span class="badge" style="background: rgba(245,158,11,0.1); color: #fbbf24;">Half Day</span>`;
      
      let hoursWorked = '-';
      let autoOtStr = '-';
      if (record.check_in && record.check_out) {
        const t1 = new Date(`1970-01-01T${record.check_in}`);
        const t2 = new Date(`1970-01-01T${record.check_out}`);
        let diffMs = t2 - t1;
        if (diffMs > 0) {
          const h = Math.floor(diffMs / 3600000);
          const m = Math.floor((diffMs % 3600000) / 60000);
          hoursWorked = `${h}h ${m}m`;
          
          const eightHoursMs = 8 * 3600000;
          if (diffMs > eightHoursMs) {
            const otMs = diffMs - eightHoursMs;
            const otH = Math.floor(otMs / 3600000);
            const otM = Math.floor((otMs % 3600000) / 60000);
            autoOtStr = `+ ${otH > 0 ? otH + 'h ' : ''}${otM > 0 ? otM + 'm' : ''}`.trim();
          }
        }
      }
      
      const finalOt = autoOtStr !== '-' ? autoOtStr : (record.overtime_hours ? `${record.overtime_hours}h` : '-');

      html += `
        <tr>
          <td style="text-align:left; padding-left:1.5rem;">
            <strong>${emp.name}</strong><br>
            <small style="color:var(--text-muted)">${emp.role}</small>
          </td>
          <td style="text-align:center;">${statusBadge}</td>
          <td style="text-align:center; font-family: monospace; font-size: 0.95rem;">${checkIn}</td>
          <td style="text-align:center; font-family: monospace; font-size: 0.95rem;">${checkOut}</td>
          <td style="text-align:center; color:#38bdf8;">${hoursWorked}</td>
          <td style="text-align:center; color:#fbbf24; font-weight:600;">${finalOt}</td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
  };
  
  const dailyPickerEl = document.getElementById('att-daily-date-picker');
  if (dailyPickerEl) dailyPickerEl.addEventListener('change', window.renderAttDailyView);

  const monthPickerEl = document.getElementById('attendance-month-picker');
  if (monthPickerEl) {
    monthPickerEl.addEventListener('change', window.renderAttendanceChart);
  }


  window.switchHrSubTab = function(subtab) {
    const staffTab = document.getElementById('hr-subtab-staff');
    const attTab = document.getElementById('hr-subtab-attendance');
    const staffBtn = document.getElementById('btn-subtab-staff');
    const attBtn = document.getElementById('btn-subtab-attendance');
    const isHR = currentUser && ['CEO', 'CTO'].includes(currentUser.role);

    if (subtab === 'staff') {
      // Only CEO/CTO can access staff directory
      if (!isHR) { switchHrSubTab('attendance'); return; }
      if (staffTab) staffTab.style.display = 'block';
      if (attTab) attTab.style.display = 'none';
      if (staffBtn) staffBtn.classList.add('active');
      if (attBtn) attBtn.classList.remove('active');
      renderEmployees();
    } else if (subtab === 'attendance') {
      if (staffTab) staffTab.style.display = 'none';
      if (attTab) attTab.style.display = 'block';
      if (staffBtn) staffBtn.classList.remove('active');
      if (attBtn) attBtn.classList.add('active');
      if (window.renderAttendanceChart) window.renderAttendanceChart();
    }
  };

  window.syncProductionData = async function() {
    if (!confirm('Sync and restore all 7 staff members and attendance records to this database?')) return;
    try {
      const res = await fetch('/api/admin/sync-seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast('Error', data.error || 'Failed to sync data', 'error');
        return;
      }
      showToast('Success', `Synced ${data.employeesCount} staff and ${data.attendanceCount} attendance records!`, 'success');
      await loadAllData();
      renderEmployees();
      if (window.renderAttendanceChart) window.renderAttendanceChart();
    } catch (err) {
      showToast('Error', 'Sync failed: ' + err.message, 'error');
    }
  };


  // =============================================================
  // AUTH / LOGIN SYSTEM
  // =============================================================

  let currentUser = null; // { token, role, name }

  async function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) { showLoginScreen(); return false; }
    try {
      const res = await fetch('/api/me', { headers: { 'x-auth-token': token } });
      if (!res.ok) { localStorage.removeItem('auth_token'); showLoginScreen(); return false; }
      const user = await res.json();
      currentUser = { token, ...user };
      hideLoginScreen();
      applyRoleUI();
      return true;
    } catch {
      showLoginScreen(); return false;
    }
  }

  function showLoginScreen() {
    const ls = document.getElementById('login-screen');
    if (ls) ls.style.display = 'flex';
    const app = document.getElementById('app') || document.querySelector('.app-container');
    if (app) app.style.display = 'none';
    
    // Reset login button and inputs
    const btn = document.getElementById('login-btn');
    if (btn) {
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.style.display = 'none';
    const pass = document.getElementById('login-password');
    if (pass) pass.value = '';
  }

  function hideLoginScreen() {
    const ls = document.getElementById('login-screen');
    if (ls) ls.style.display = 'none';
    const app = document.getElementById('app') || document.querySelector('.app-container');
    if (app) app.style.display = '';
    
    const btn = document.getElementById('login-btn');
    if (btn) {
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
  }

  function applyRoleUI() {
    if (!currentUser) return;
    const isHR = ['CEO', 'CTO'].includes(currentUser.role);

    // HR & Payroll tab is visible to ALL logged-in users
    const hrNavBtn = document.querySelector('.nav-btn[data-tab="hr"]');
    if (hrNavBtn) hrNavBtn.style.display = '';

    // Show user badge in header
    const badge = document.getElementById('user-role-badge');
    if (badge) { badge.textContent = currentUser.name + ' • ' + currentUser.role; badge.style.display = 'inline-flex'; }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (window.lucide) { window.lucide.createIcons(); }

    // Sub-tab logic
    const staffSubBtn = document.getElementById('btn-subtab-staff');
    const staffSubTab = document.getElementById('hr-subtab-staff');
    const attSubBtn = document.getElementById('btn-subtab-attendance');
    const attSubTab = document.getElementById('hr-subtab-attendance');

    if (!isHR) {
      // For operators: hide Staff Directory completely
      if (staffSubBtn) staffSubBtn.style.display = 'none';
      if (staffSubTab) staffSubTab.style.display = 'none';
      if (staffSubBtn) staffSubBtn.classList.remove('active');
      if (attSubBtn) { attSubBtn.classList.add('active'); attSubBtn.style.display = ''; }
      if (attSubTab) attSubTab.style.display = 'block';
      document.body.setAttribute('data-user-role', 'operator');
    } else {
      document.body.setAttribute('data-user-role', currentUser.role);
    }
  }

  window.handleLogin = async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errEl.style.display = 'none';
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Invalid credentials';
        errEl.style.display = 'block';
        btn.textContent = 'Sign In';
        btn.disabled = false;
        return;
      }
      localStorage.setItem('auth_token', data.token);
      currentUser = { token: data.token, role: data.role, name: data.name };
      hideLoginScreen();
      applyRoleUI();
      await loadAllData();
    } catch (err) {
      errEl.textContent = 'Server error. Please try again.';
      errEl.style.display = 'block';
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
  };

  window.handleLogout = async function() {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try { await fetch('/api/logout', { method: 'POST', headers: { 'x-auth-token': token } }); } catch {}
    }
    localStorage.removeItem('auth_token');
    currentUser = null;
    // Reset badge/button
    const badge = document.getElementById('user-role-badge');
    if (badge) badge.style.display = 'none';
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'none';
    showLoginScreen();
  };

  // Patch fetch to always include auth token
  const _origFetch = window.fetch;
  window.fetch = function(url, opts = {}) {
    const token = localStorage.getItem('auth_token');
    if (token && typeof url === 'string' && url.startsWith('/api')) {
      opts.headers = { ...(opts.headers || {}), 'x-auth-token': token };
    }
    return _origFetch(url, opts);
  };

  
  // =============================================================
  // SALE TAX INVOICES CONTROLLER (MEDICINE / ROBINSON / MCLOSN)
  // =============================================================
  
  window.renderTaxInvoices = function(clientId) {
    const tbody = document.getElementById('table-tax-invoices-body');
    if (!tbody) return;

    if (!clientId) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Select a customer from the left list</td></tr>';
      return;
    }

    const invoices = (state.tax_invoices || []).filter(inv => inv.client_id === clientId);

    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">No Sale Tax Invoices generated for this client yet. Click <strong>"Create Sale Tax Invoice"</strong> above.</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(inv => {
      const itemsSummary = (inv.items || []).map(i => `${i.description} (${Number(i.qty).toLocaleString()} @ Rs. ${i.price})`).join('<br>');
      const dateFormatted = inv.date ? inv.date.split('-').reverse().join('-') : 'N/A';

      return `
        <tr>
          <td><strong style="color: #38bdf8;">${inv.invoice_no || 'INV-' + inv.id}</strong></td>
          <td>${dateFormatted}</td>
          <td><span class="badge" style="background: rgba(255,255,255,0.08); font-weight:600;">${inv.po_no || 'N/A'}</span></td>
          <td style="max-width: 250px; font-size: 0.8rem; line-height: 1.3;">${itemsSummary || 'No items'}</td>
          <td class="text-right">Rs. ${Number(inv.total_excl_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td class="text-right" style="color: #38bdf8;">Rs. ${Number(inv.total_sales_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td class="text-right"><strong style="color: #34d399;">Rs. ${Number(inv.total_incl_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-primary btn-sm" onclick="viewTaxInvoice(${inv.id})" title="Print / View A4 Invoice">
              <i data-lucide="printer"></i> View & Print
            </button>
            <button class="btn btn-secondary btn-sm" onclick="deleteTaxInvoice(${inv.id})" style="color: #fb7185;" title="Delete Invoice">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) { window.lucide.createIcons(); }
  };

  window.openCreateTaxInvoiceModal = function(defaultItems = null) {
    const client = state.selectedClient;
    if (!client) {
      showToast('Select Customer', 'Please select a customer first before creating an invoice.', 'warning');
      return;
    }

    const company = state.company_profile || {
      name: "Mahmoodiyah Packages",
      address: "Umer Park, Shahzad Street, Near Bajwa Shadi Hall, Amjad Bilu Road, Lahore Pakistan",
      phone: "+92-323-4866931",
      email: "mahmoodiyah786@gmail.com",
      ntn: "1984936",
      strn: ""
    };

    document.getElementById('inv-client-id').value = client.id;
    document.getElementById('inv-id').value = '';

    const invCount = (state.tax_invoices?.length || 0) + 1;
    document.getElementById('inv-serial-no').value = `000${invCount}(1515)`;
    document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inv-po-no').value = '';

    // Supplier Info
    document.getElementById('inv-supplier-name').textContent = company.name;
    document.getElementById('inv-supplier-address').textContent = company.address;
    document.getElementById('inv-supplier-ntn').textContent = company.ntn || '1984936';
    document.getElementById('inv-supplier-phone').textContent = company.phone || '+92-323-4866931';

    // Buyer Info
    document.getElementById('inv-buyer-name').value = client.name || '';
    document.getElementById('inv-buyer-address').value = client.address || '';
    document.getElementById('inv-buyer-phone').value = client.phone || '';
    document.getElementById('inv-buyer-ntn').value = client.ntn || '';

    // Clear and populate item rows
    const tbody = document.getElementById('invoice-items-body');
    tbody.innerHTML = '';

    if (defaultItems && Array.isArray(defaultItems) && defaultItems.length > 0) {
      defaultItems.forEach(item => addInvoiceItemRow(item));
    } else {
      const clientProds = (state.client_products || []).filter(p => p.client_id === client.id);
      if (clientProds.length > 0) {
        clientProds.forEach(p => {
          addInvoiceItemRow({
            description: `${p.name} Unit Carton`,
            qty: 1000,
            price: p.rate || 5.90,
            tax_rate: 18
          });
        });
      } else {
        addInvoiceItemRow({ description: "Pharmaceutical Packaging / Unit Carton", qty: 1000, price: 5.90, tax_rate: 18 });
      }
    }

    calcTaxInvoiceLiveTotals();
    openModal('modal-tax-invoice');
    if (window.lucide) { window.lucide.createIcons(); }
  };

  window.addInvoiceItemRow = function(item = {}) {
    const tbody = document.getElementById('invoice-items-body');
    const tr = document.createElement('tr');
    tr.className = 'inv-item-row';

    const desc = item.description || '';
    const qty = item.qty !== undefined ? item.qty : '';
    const price = item.price !== undefined ? item.price : '';
    const taxRate = item.tax_rate !== undefined ? item.tax_rate : 18;

    tr.innerHTML = `
      <td><input type="text" class="inv-item-desc" value="${desc}" placeholder="e.g. Unit Carton / Label" required style="padding: 0.35rem 0.5rem;"></td>
      <td><input type="number" step="any" class="inv-item-qty" value="${qty}" placeholder="Qty" required oninput="calcTaxInvoiceLiveTotals()" style="padding: 0.35rem 0.5rem; text-align: right;"></td>
      <td><input type="number" step="any" class="inv-item-price" value="${price}" placeholder="Rate" required oninput="calcTaxInvoiceLiveTotals()" style="padding: 0.35rem 0.5rem; text-align: right;"></td>
      <td class="inv-row-excl" style="font-weight: 600; text-align: right;">Rs. 0.00</td>
      <td><input type="number" step="any" class="inv-item-taxrate" value="${taxRate}" placeholder="18" oninput="calcTaxInvoiceLiveTotals()" style="padding: 0.35rem 0.5rem; width: 60px; text-align: right;">%</td>
      <td class="inv-row-tax" style="color: #38bdf8; text-align: right;">Rs. 0.00</td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove(); calcTaxInvoiceLiveTotals();" style="padding: 0.2rem 0.45rem; color: #fb7185;">&times;</button>
      </td>
    `;

    tbody.appendChild(tr);
    calcTaxInvoiceLiveTotals();
  };

  window.calcTaxInvoiceLiveTotals = function() {
    const rows = document.querySelectorAll('.inv-item-row');
    let totalExcl = 0;
    let totalTax = 0;
    let totalIncl = 0;

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.inv-item-qty')?.value) || 0;
      const price = parseFloat(row.querySelector('.inv-item-price')?.value) || 0;
      const taxRate = parseFloat(row.querySelector('.inv-item-taxrate')?.value) !== undefined ? parseFloat(row.querySelector('.inv-item-taxrate')?.value) : 18;

      const excl = qty * price;
      const tax = excl * (taxRate / 100);
      const incl = excl + tax;

      const exclCell = row.querySelector('.inv-row-excl');
      const taxCell = row.querySelector('.inv-row-tax');

      if (exclCell) exclCell.textContent = 'Rs. ' + Number(excl.toFixed(2)).toLocaleString(undefined, {minimumFractionDigits: 2});
      if (taxCell) taxCell.textContent = 'Rs. ' + Number(tax.toFixed(2)).toLocaleString(undefined, {minimumFractionDigits: 2});

      totalExcl += excl;
      totalTax += tax;
      totalIncl += incl;
    });

    document.getElementById('inv-calc-excl').textContent = 'Rs. ' + Number(totalExcl.toFixed(2)).toLocaleString(undefined, {minimumFractionDigits: 2});
    document.getElementById('inv-calc-tax').textContent = 'Rs. ' + Number(totalTax.toFixed(2)).toLocaleString(undefined, {minimumFractionDigits: 2});
    document.getElementById('inv-calc-incl').textContent = 'Rs. ' + Number(totalIncl.toFixed(2)).toLocaleString(undefined, {minimumFractionDigits: 2});
  };

  // Form submit handler for Tax Invoice
  const formTaxInvoice = document.getElementById('form-tax-invoice');
  if (formTaxInvoice) {
    formTaxInvoice.addEventListener('submit', async (e) => {
      e.preventDefault();

      const clientId = document.getElementById('inv-client-id').value;
      const serialNo = document.getElementById('inv-serial-no').value.trim();
      const date = document.getElementById('inv-date').value;
      const poNo = document.getElementById('inv-po-no').value.trim();

      const buyerName = document.getElementById('inv-buyer-name').value.trim();
      const buyerAddress = document.getElementById('inv-buyer-address').value.trim();
      const buyerPhone = document.getElementById('inv-buyer-phone').value.trim();
      const buyerNtn = document.getElementById('inv-buyer-ntn').value.trim();

      const rows = document.querySelectorAll('.inv-item-row');
      const items = [];

      rows.forEach(row => {
        const desc = row.querySelector('.inv-item-desc').value.trim();
        const qty = parseFloat(row.querySelector('.inv-item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.inv-item-price').value) || 0;
        const taxRate = parseFloat(row.querySelector('.inv-item-taxrate').value) || 18;

        if (desc) {
          items.push({ description: desc, qty, price, tax_rate: taxRate });
        }
      });

      if (items.length === 0) {
        showToast('No Items', 'Please add at least one item to the invoice.', 'warning');
        return;
      }

      const payload = {
        client_id: clientId,
        serial_no: serialNo,
        date: date,
        po_no: poNo,
        buyer_name: buyerName,
        buyer_address: buyerAddress,
        buyer_phone: buyerPhone,
        buyer_ntn: buyerNtn,
        items: items
      };

      try {
        const res = await fetch('/api/tax-invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create invoice');

        closeModal('modal-tax-invoice');
        showToast('Success', 'Sale Tax Invoice created successfully!', 'success');
        await loadAllData();
        if (state.selectedClient) {
          renderTaxInvoices(state.selectedClient.id);
        }
        // Automatically open A4 printable preview immediately with created invoice
        if (data.invoice) {
          viewTaxInvoice(data.invoice);
        }
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }

  // View / Print A4 Invoice
  window.viewTaxInvoice = function(invOrId) {
    let inv = null;
    if (typeof invOrId === 'object' && invOrId !== null) {
      inv = invOrId;
    } else {
      inv = (state.tax_invoices || []).find(i => i.id == invOrId || i.invoice_no == invOrId);
    }

    if (!inv) {
      showToast('Error', 'Invoice not found', 'error');
      return;
    }

    const supplier = inv.supplier_info || {
      name: "Mahmoodiyah Packages",
      tagline: "DEAL IN ALL TYPES OF PACKAGING",
      address: "Umer Park, Shahzad Street, Near Bajwa Shadi Hall, Amjad Bilu Road, Lahore Pakistan",
      phone: "+92-323-4866931",
      email: "mahmoodiyah786@gmail.com",
      ntn: "1984936",
      strn: ""
    };

    const buyer = inv.buyer_info || {
      name: inv.client_name || "Customer",
      address: "",
      phone: "",
      ntn: "",
      strn: ""
    };

    const dateFormatted = inv.date ? inv.date.split('-').reverse().join('-') : '15-09-2026';

    const itemsRowsHtml = (inv.items || []).map(item => {
      return `
        <tr>
          <td style="text-align: left; padding: 8px 10px;">${item.description}</td>
          <td class="text-right" style="padding: 8px 10px;">${Number(item.qty).toLocaleString()}</td>
          <td class="text-right" style="padding: 8px 10px;">${Number(item.price).toFixed(2)}</td>
          <td class="text-right" style="padding: 8px 10px; font-weight:600;">${Number(item.excl_tax).toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
          <td class="text-center" style="padding: 8px 10px;">${item.tax_rate}%</td>
          <td class="text-right" style="padding: 8px 10px;">${Number(item.sales_tax).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td class="text-right" style="padding: 8px 10px; font-weight:700;">${Number(item.incl_tax).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        </tr>
      `;
    }).join('');

    // Ensure at least 4 rows for clean A4 table height
    let emptyRowsHtml = '';
    const emptyRowsCount = Math.max(0, 4 - (inv.items?.length || 0));
    for (let i = 0; i < emptyRowsCount; i++) {
      emptyRowsHtml += `
        <tr>
          <td style="height: 28px;">&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      `;
    }

    const sheetContainer = document.getElementById('printable-tax-invoice-sheet');
    sheetContainer.innerHTML = `
      <!-- HEADER -->
      <div class="inv-header-container">
        <div class="inv-brand-left">
          <div class="inv-brand-logo-icon">M</div>
          <div class="inv-brand-titles">
            <h1>${supplier.name}</h1>
            <div class="inv-brand-tagline-pill">${supplier.tagline || 'DEAL IN ALL TYPES OF PACKAGING'}</div>
            <div class="inv-brand-address">${supplier.address}</div>
          </div>
        </div>
        <div class="inv-header-right">
          <div class="inv-header-right-accent"></div>
          <div><strong>Cell:</strong> ${supplier.phone || '0323-4866931'}</div>
          <div><strong>E-mail:</strong> ${supplier.email || 'mahmoodiyah786@gmail.com'}</div>
        </div>
      </div>

      <!-- TITLE BADGE -->
      <div class="inv-title-badge-wrapper">
        <div class="inv-title-badge">SALE TAX INVOICE</div>
      </div>

      <!-- META ROW -->
      <div class="inv-meta-row">
        <div class="inv-meta-item">Serial No: <span class="inv-meta-val">${inv.invoice_no}</span></div>
        <div class="inv-meta-item">Date: <span class="inv-meta-val">${dateFormatted}</span></div>
        <div class="inv-meta-item">PO #: <span class="inv-meta-val">${inv.po_no || '---'}</span></div>
      </div>

      <!-- TWO COLUMN SUPPLIER / BUYER BOX -->
      <div class="inv-two-col-grid">
        <!-- Supplier Column -->
        <div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">Supplier's Name:</span>
            <span class="inv-col-val">${supplier.name}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">Address:</span>
            <span class="inv-col-val" style="font-size: 9.5px;">${supplier.address}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">Telephone:</span>
            <span class="inv-col-val">${supplier.phone}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">S.Tax Reg. #:</span>
            <span class="inv-col-val">${supplier.strn || ''}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">N.T.N.#:</span>
            <span class="inv-col-val" style="font-weight:700;">${supplier.ntn || '1984936'}</span>
          </div>
        </div>

        <!-- Buyer Column -->
        <div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">Buyer's Name:</span>
            <span class="inv-col-val" style="font-weight:700;">${buyer.name}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">Address:</span>
            <span class="inv-col-val" style="font-size: 9.5px;">${buyer.address || ''}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">Telephone:</span>
            <span class="inv-col-val">${buyer.phone || ''}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">S.Tax Reg. #:</span>
            <span class="inv-col-val">${buyer.strn || ''}</span>
          </div>
          <div class="inv-col-field">
            <span class="inv-col-lbl">N.T.N.#:</span>
            <span class="inv-col-val" style="font-weight:700;">${buyer.ntn || ''}</span>
          </div>
        </div>
      </div>

      <!-- TABLE OF GOODS -->
      <table class="inv-table-goods">
        <thead>
          <tr>
            <th style="width: 36%;">Description of Goods</th>
            <th style="width: 10%;">Qty</th>
            <th style="width: 10%;">Price</th>
            <th style="width: 14%;">Excl-value<br>Sales Tax</th>
            <th style="width: 8%;">Rate<br>Sales Tax</th>
            <th style="width: 11%;">Sales Tax<br>Payable</th>
            <th style="width: 11%;">Incl-value<br>Sales Tax</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
          ${emptyRowsHtml}
          <tr class="inv-table-totals-row">
            <td colspan="3" style="text-align: right; border-right: none;"></td>
            <td class="text-right" style="font-weight: 800; font-size: 11px;">${Number(inv.total_excl_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
            <td class="text-center"></td>
            <td class="text-right" style="font-weight: 800; font-size: 11px;">${Number(inv.total_sales_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="text-right" style="font-weight: 900; font-size: 11.5px; color: #1e3a8a;">${Number(inv.total_incl_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          </tr>
        </tbody>
      </table>

      <!-- BOTTOM SUMMARY & SIGNATURES -->
      <div class="inv-bottom-section">
        <div class="inv-bottom-left">
          <div class="inv-summary-line">
            <span>Sales Tax</span>
            <span class="sum-val">${Number(inv.total_sales_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div class="inv-summary-line" style="margin-top: 14px;">
            <span>Net S.tax inclusive</span>
            <span class="sum-val" style="font-size: 14px; font-weight: 800;">${Number(inv.total_incl_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>

        <div class="inv-bottom-right">
          <div class="inv-signature-block">
            <div style="text-align: right; margin-right: 15px;">
              <div style="font-size: 11px; font-weight: 700; margin-bottom: 25px;">Signature: ______________</div>
              <div style="font-size: 11px; font-weight: 700;">Stamp: __________________</div>
            </div>
            <div class="inv-stamp-circle">
              <span style="font-size: 6.5px; font-weight: 900; letter-spacing: 0.05em;">MAHMOODIYAH</span>
              <span style="font-size: 10px; font-weight: 900;">M</span>
              <span style="font-size: 6px;">PACKAGES</span>
            </div>
          </div>
        </div>
      </div>
    `;

    openModal('modal-tax-invoice-view');
  };

  window.printCurrentTaxInvoice = function() {
    window.print();
  };

  window.deleteTaxInvoice = async function(invId) {
    if (!confirm('Are you sure you want to delete this Sale Tax Invoice?')) return;
    try {
      const res = await fetch(`/api/tax-invoices/${invId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete invoice');
      showToast('Deleted', 'Sale Tax Invoice deleted', 'info');
      await loadAllData();
      if (state.selectedClient) {
        renderTaxInvoices(state.selectedClient.id);
      }
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  // Company Profile Modal
  window.openCompanyProfileModal = function() {
    const cp = state.company_profile || {
      name: "Mahmoodiyah Packages",
      tagline: "DEAL IN ALL TYPES OF PACKAGING",
      address: "Umer Park, Shahzad Street, Near Bajwa Shadi Hall, Amjad Bilu Road, Lahore Pakistan",
      phone: "+92-323-4866931",
      email: "mahmoodiyah786@gmail.com",
      ntn: "1984936",
      strn: ""
    };

    document.getElementById('cp-name').value = cp.name || '';
    document.getElementById('cp-tagline').value = cp.tagline || '';
    document.getElementById('cp-address').value = cp.address || '';
    document.getElementById('cp-phone').value = cp.phone || '';
    document.getElementById('cp-email').value = cp.email || '';
    document.getElementById('cp-ntn').value = cp.ntn || '';
    document.getElementById('cp-strn').value = cp.strn || '';

    openModal('modal-company-profile');
  };

  const formCompanyProfile = document.getElementById('form-company-profile');
  if (formCompanyProfile) {
    formCompanyProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('cp-name').value.trim(),
        tagline: document.getElementById('cp-tagline').value.trim(),
        address: document.getElementById('cp-address').value.trim(),
        phone: document.getElementById('cp-phone').value.trim(),
        email: document.getElementById('cp-email').value.trim(),
        ntn: document.getElementById('cp-ntn').value.trim(),
        strn: document.getElementById('cp-strn').value.trim()
      };

      try {
        const res = await fetch('/api/company-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update company profile');
        state.company_profile = data.profile;
        closeModal('modal-company-profile');
        showToast('Saved', 'Company Profile and Tax details saved!', 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }


  // Start application with authentication check
  checkAuth().then(authed => {
    init();
  });

});














  window.openTaxInvoiceForJob = function(jobNo, clientId, totalAmount, desc) {
    const item = parseJobLedgerItem(jobNo, totalAmount, desc);
    openCreateTaxInvoiceModal([item]);
    if (jobNo) document.getElementById('inv-po-no').value = jobNo;
  };

  window.printCustomerStatement = function() {
    window.print();
  };

  // High-fidelity print for A4 Tax Invoice
  window.printCurrentTaxInvoice = function() {
    const sheetContent = document.getElementById('printable-tax-invoice-sheet').innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sale Tax Invoice - Mahmoodiyah Packages</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', system-ui, sans-serif; background: #ffffff; color: #0f172a; padding: 20px; font-size: 11.5px; }
          .printable-a4-sheet { max-width: 100%; margin: 0 auto; }
          .inv-header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .inv-brand-left { display: flex; gap: 12px; align-items: center; }
          .inv-brand-logo-icon { width: 50px; height: 50px; background: #1e40af; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 24px; font-weight: 900; font-family: 'Outfit', sans-serif; }
          .inv-brand-titles h1 { font-size: 20px; font-weight: 900; color: #1e3a8a; margin: 0; text-transform: uppercase; }
          .inv-brand-tagline-pill { background: #1e293b; color: #ffffff; font-size: 8px; font-weight: 800; padding: 2px 7px; border-radius: 4px; display: inline-block; margin: 3px 0; }
          .inv-brand-address { font-size: 9px; color: #475569; }
          .inv-header-right { text-align: right; font-size: 10.5px; }
          .inv-header-right-accent { width: 80px; height: 6px; background: #2563eb; margin-left: auto; margin-bottom: 6px; border-radius: 2px; }
          .inv-title-badge-wrapper { text-align: center; margin: 8px 0 12px 0; }
          .inv-title-badge { display: inline-block; border: 1.5px solid #1e3a8a; border-radius: 5px; padding: 3px 18px; font-size: 13px; font-weight: 800; color: #1e3a8a; background: #f8fafc; }
          .inv-meta-row { display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 600; margin-bottom: 10px; }
          .inv-meta-val { border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 80px; text-align: center; font-weight: 700; }
          .inv-two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; background: #fcfdfd; }
          .inv-col-field { margin-bottom: 5px; font-size: 10px; display: flex; align-items: baseline; gap: 6px; }
          .inv-col-lbl { font-weight: 700; color: #1e293b; white-space: nowrap; }
          .inv-col-val { border-bottom: 1px dotted #94a3b8; flex: 1; color: #0f172a; font-weight: 600; }
          .inv-table-goods { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
          .inv-table-goods th { background: #1e40af; color: #ffffff; font-weight: 700; padding: 6px 5px; text-align: center; border: 1px solid #1e3a8a; }
          .inv-table-goods td { border: 1px solid #cbd5e1; padding: 5px 6px; }
          .inv-table-totals-row td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #1e40af; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .inv-bottom-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; }
          .inv-bottom-left { width: 48%; }
          .inv-summary-line { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; font-weight: 700; }
          .inv-summary-line .sum-val { border-bottom: 2px solid #0f172a; min-width: 100px; text-align: right; font-size: 12px; }
          .inv-bottom-right { text-align: right; width: 45%; }
          .inv-signature-block { display: flex; justify-content: flex-end; gap: 12px; align-items: center; }
          .inv-stamp-circle { width: 65px; height: 65px; border: 2px solid #1e40af; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #1e40af; font-size: 7px; font-weight: 800; transform: rotate(-10deg); }
          @page { size: A4 portrait; margin: 10mm; }
        </style>
      </head>
      <body>
        <div class="printable-a4-sheet">
          ${sheetContent}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // =============================================================
  // MULTI-JOB DELIVERIES & COMBINED TAX INVOICE GENERATOR
  // =============================================================

  window.parseJobLedgerItem = function(jobNo, totalAmount, desc) {
    let qty = 1000;
    let rate = 5.90;
    let title = desc || "Packaging Material";

    // Extract quantity (e.g. Delivered 8,700 boxes / 9,000 labels)
    const qtyMatch = desc.match(/(?:Delivered\s+)?([\d,]+)\s*(?:boxes|labels|pcs|items|cartons|leaflets|sheets)?/i);
    if (qtyMatch) {
      const parsed = parseFloat(qtyMatch[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) qty = parsed;
    }

    // Extract unit rate (e.g. @ Rs. 5.90)
    const rateMatch = desc.match(/@\s*Rs\.?\s*([\d.]+)/i);
    if (rateMatch) {
      rate = parseFloat(rateMatch[1]);
    } else if (qty > 0 && totalAmount > 0) {
      rate = parseFloat((totalAmount / qty).toFixed(2));
    }

    // Extract product category / title
    let itemType = 'Unit Carton';
    if (/label/i.test(desc)) itemType = 'Bottle Labels';
    else if (/leaflet|insert/i.test(desc)) itemType = 'Pack Leaflet';
    else if (/carton|box/i.test(desc)) itemType = 'Unit Carton';

    const ofMatch = desc.match(/of\s+(.*?)(?:\s*@|$)/i);
    if (ofMatch) {
      title = `${ofMatch[1].trim()} ${itemType}`;
    } else {
      title = desc.replace(/Delivered\s+[\d,]+\s+(?:boxes|labels|cartons|pcs)?\s*/i, '').replace(/@.*$/, '').trim() || (jobNo ? `${jobNo} ${itemType}` : `Pharmaceutical ${itemType}`);
    }

    return {
      description: title,
      qty: qty,
      price: rate,
      tax_rate: 18,
      jobNo: jobNo,
      amount: totalAmount
    };
  };

  window.toggleSelectAllClientLedger = function(isChecked) {
    const checkboxes = document.querySelectorAll('.client-ledger-checkbox');
    checkboxes.forEach(cb => cb.checked = isChecked);
    updateSelectedLedgerItems();
  };

  window.updateSelectedLedgerItems = function() {
    const checked = document.querySelectorAll('.client-ledger-checkbox:checked');
    const btn = document.getElementById('btn-combined-tax-invoice');
    const countSpan = document.getElementById('selected-deliveries-count');
    const selectAll = document.getElementById('client-ledger-select-all');
    const allCheckboxes = document.querySelectorAll('.client-ledger-checkbox');

    if (countSpan) countSpan.textContent = checked.length;
    if (selectAll) selectAll.checked = (allCheckboxes.length > 0 && checked.length === allCheckboxes.length);

    if (btn) {
      btn.style.display = checked.length > 0 ? 'inline-flex' : 'none';
    }
  };

  window.createCombinedTaxInvoiceFromSelected = function() {
    const checked = document.querySelectorAll('.client-ledger-checkbox:checked');
    if (checked.length === 0) {
      showToast('No Deliveries Selected', 'Please check at least one delivered job to include.', 'warning');
      return;
    }

    const items = [];
    const jobNos = [];

    checked.forEach(cb => {
      const jobNo = cb.getAttribute('data-job') || '';
      const amount = parseFloat(cb.getAttribute('data-amount')) || 0;
      const desc = cb.getAttribute('data-desc') || '';

      const item = parseJobLedgerItem(jobNo, amount, desc);
      items.push(item);
      if (jobNo && !jobNos.includes(jobNo)) {
        jobNos.push(jobNo);
      }
    });

    openCreateTaxInvoiceModal(items);
    if (jobNos.length > 0) {
      document.getElementById('inv-po-no').value = jobNos.join(', ');
    }
  };

  // Import Delivered Jobs Checklist Modal
  window.openImportDeliveredJobsModal = async function() {
    const client = state.selectedClient;
    if (!client) {
      showToast('Select Customer', 'Please select a customer first.', 'warning');
      return;
    }

    const tbody = document.getElementById('table-import-jobs-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading delivered jobs...</td></tr>';
    openModal('modal-import-delivered-jobs');

    try {
      const res = await fetch(`/api/clients/${client.id}/ledger`).then(r => r.json());
      const deliveredTxs = (res.transactions || []).filter(t => t.type === 'INVOICE');

      if (deliveredTxs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 1.5rem;">No delivered jobs found for this customer.</td></tr>';
        return;
      }

      tbody.innerHTML = deliveredTxs.map(t => {
        const descEscaped = (t.description || '').replace(/'/g, "\\'");
        const parsed = parseJobLedgerItem(t.job_no || '', t.debit || 0, t.description || '');

        return `
          <tr>
            <td style="text-align: center;">
              <input type="checkbox" class="import-job-checkbox" data-job="${t.job_no || ''}" data-desc="${descEscaped}" data-qty="${parsed.qty}" data-rate="${parsed.price}" data-title="${parsed.description.replace(/"/g, '&quot;')}">
            </td>
            <td><strong>${t.job_no || '-'}</strong></td>
            <td>${t.date}</td>
            <td style="max-width: 220px; font-size: 0.8rem;">${parsed.description}</td>
            <td style="text-align: right;">${Number(parsed.qty).toLocaleString()}</td>
            <td style="text-align: right;">Rs. ${Number(parsed.price).toFixed(2)}</td>
            <td style="text-align: right; font-weight: 700; color: #38bdf8;">Rs. ${Number(t.debit || 0).toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      const selectAll = document.getElementById('import-jobs-select-all');
      if (selectAll) selectAll.checked = false;
      if (window.lucide) { window.lucide.createIcons(); }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-rose">Failed to load: ${err.message}</td></tr>`;
    }
  };

  window.toggleSelectAllImportJobs = function(isChecked) {
    const checkboxes = document.querySelectorAll('.import-job-checkbox');
    checkboxes.forEach(cb => cb.checked = isChecked);
  };

  window.insertSelectedDeliveredJobs = function() {
    const checked = document.querySelectorAll('.import-job-checkbox:checked');
    if (checked.length === 0) {
      showToast('Select Items', 'Please check at least one delivered item to insert.', 'warning');
      return;
    }

    const jobNos = [];
    checked.forEach(cb => {
      const jobNo = cb.getAttribute('data-job');
      const desc = cb.getAttribute('data-title');
      const qty = parseFloat(cb.getAttribute('data-qty')) || 1000;
      const price = parseFloat(cb.getAttribute('data-rate')) || 5.90;

      addInvoiceItemRow({
        description: desc,
        qty: qty,
        price: price,
        tax_rate: 18
      });

      if (jobNo && !jobNos.includes(jobNo)) {
        jobNos.push(jobNo);
      }
    });

    const poInput = document.getElementById('inv-po-no');
    if (poInput && jobNos.length > 0) {
      const existingPO = poInput.value.trim();
      poInput.value = existingPO ? `${existingPO}, ${jobNos.join(', ')}` : jobNos.join(', ');
    }

    closeModal('modal-import-delivered-jobs');
    calcTaxInvoiceLiveTotals();
    showToast('Items Added', `${checked.length} item(s) added to invoice table!`, 'success');
  };

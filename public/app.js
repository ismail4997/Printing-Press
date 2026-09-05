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
    selectedVendor: null,
    selectedClient: null,
    currentImposition: null
  };

  // -------------------------------------------------------------
  // INITIALIZATION & EVENT LISTENERS
  // -------------------------------------------------------------
  function init() {
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

  // Live Stock Price Calculator (L × W × GSM / 15500 × Rate × Pkts)
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
            ? '( Rate � Sheets )' 
            : '( L � W � GSM ) � 15,500 � Rate/KG � Pkts';
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
      const [dashRes, invRes, venRes, cliRes, jobRes, poRes, clientProductsRes] = await Promise.all([
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/inventory').then(r => r.json()),
        fetch('/api/vendors').then(r => r.json()),
        fetch('/api/clients').then(r => r.json()),
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/purchase-orders').then(r => r.json()),
        fetch('/api/client-products').then(r => r.json())
      ]);

      state.dashboard = dashRes;
      state.inventory = invRes || [];
      state.vendors = venRes || [];
      state.clients = cliRes || [];
      state.jobs = jobRes || [];
      state.purchaseOrders = poRes || [];
      state.client_products = clientProductsRes || [];

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
          <strong>${i.paper_type} ${i.gsm}gsm</strong> (${i.size_w}x${i.size_h}")<br>
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
        products.map(p => `<option value="${p.id}">${p.name} (${p.box_w}" × ${p.box_l}")</option>`).join('');
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
          <td>${order.paper_type} ${order.gsm}gsm<br><small>${order.size_w}x${order.size_h}"</small></td>
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
          <td>${item.gsm} GSM</td>
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
    document.getElementById('cut-source-info').innerText = `Master: ${item.paper_type} ${item.gsm}GSM (${item.size_w}" x ${item.size_h}") - ${item.pkt_qty} pkts available`;
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
    document.getElementById('issue-stock-info').innerText = `Issuing: ${item.paper_type} ${item.gsm}GSM (${item.size_w}x${item.size_h}") - ${item.pkt_qty} pkts available`;
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
        <div class="sub">${v.category.replace('_', ' ').toUpperCase()} • ${v.phone || 'No phone'}</div>
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
              ${b.status !== 'paid' ? `<button class="btn-pay-bill" onclick="openBillPayModal(${v.id}, ${b.id})">💰 Pay</button>` : '<span style="color:var(--emerald);font-size:0.8rem;">✓ Cleared</span>'}
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
          <td class="print-hide"><button class="btn-delete-row" onclick="deleteVendorTx(${v.id}, ${t.id}, '${t.type}', ${t.debit || t.credit})">🗑 Delete</button></td>
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
        <div class="sub">${c.company || 'Customer'} • ${c.phone || 'No phone'}</div>
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
      document.getElementById('c-detail-company').innerText = c.company ? `${c.company} • Phone: ${c.phone}` : (c.phone || '');
      
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

      const tbody = document.getElementById('table-client-ledger-body');
      tbody.innerHTML = txs.length ? txs.map(t => `
        <tr>
          <td>${t.date}</td>
          <td><strong>${t.job_no || '-'}</strong></td>
          <td><span class="badge ${t.type === 'PAYMENT' ? 'badge-success' : 'badge-warning'}">${t.type}</span></td>
          <td>${t.description}</td>
          <td style="color: var(--amber); font-weight: bold;">${t.debit > 0 ? 'Rs. ' + t.debit.toLocaleString() : '-'}</td>
          <td style="color: var(--emerald); font-weight: bold;">${t.credit > 0 ? 'Rs. ' + t.credit.toLocaleString() : '-'}</td>
          <td><strong>Rs. ${t.balance_after.toLocaleString()}</strong></td>
          <td><button class="btn-delete-row" onclick="deleteClientTx(${c.id}, ${t.id}, '${t.type}', ${t.debit || t.credit})">🗑 Delete</button></td>
        </tr>
      `).join('') : `<tr><td colspan="8" class="text-center text-muted">No transactions found</td></tr>`;

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
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Paper Grade</label>
                <select class="order-paper-type bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full" required>
                  <option value="Bleach Card">Bleach Card</option>
                  <option value="Art Paper">Art Paper</option>
                  <option value="Sticker Paper">Sticker Paper</option>
                  <option value="Duplex Board">Duplex Board</option>
                  <option value="Reel">Reel</option>
                </select>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">GSM</label>
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
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Packets</label>
                <input type="number" class="order-pkts bg-slate-900 border border-slate-600 rounded p-2 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="20" required>
              </div>
              
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-slate-300 font-semibold tracking-wide uppercase">Est. Rate/KG</label>
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
        showToast('Payment Recorded', `Payment of Rs. ${parseFloat(payload.amount).toLocaleString()} recorded against bill. ${res.bill.status === 'paid' ? 'Bill is now fully cleared! ✓' : ''}`, 'success');
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

  // Start application
  init();
});















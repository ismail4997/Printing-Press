import http from 'http';
import url from 'url';
import { db } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const PORT = process.env.PORT || 3000;

// Helper to parse JSON request body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        console.warn("Invalid JSON body received:", body);
        resolve({});
      }
    });
  });
}

// Helper to send JSON responses
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Static file server
function serveStaticFile(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS Pre-flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // -------------------------------------------------------------
    // REST API ENDPOINTS
    // -------------------------------------------------------------

    // 1. DASHBOARD METRICS
    if (pathname === '/api/dashboard' && method === 'GET') {
      const activeJobs = db.data.jobs.filter(j => j.status === 'active');
      const solna1Jobs = activeJobs.filter(j => j.current_stage === 'printing' && j.solna_machine === 1).length;
      const solna2Jobs = activeJobs.filter(j => j.current_stage === 'printing' && j.solna_machine === 2).length;
      const pastingJobs = activeJobs.filter(j => j.current_stage === 'outside_pasting').length;
      
      const totalInventoryPkts = db.data.inventory.reduce((sum, item) => sum + item.pkt_qty, 0);
      const totalClientReceivables = db.data.clients.reduce((sum, c) => sum + c.balance, 0);
      const totalVendorPayables = db.data.vendors.reduce((sum, v) => sum + v.balance, 0);

      return sendJSON(res, {
        activeJobsCount: activeJobs.length,
        solna1Jobs,
        solna2Jobs,
        pastingJobs,
        totalInventoryPkts,
        totalClientReceivables,
        totalVendorPayables
      });
    }

    // 2.5 PURCHASE ORDERS
    if (pathname === '/api/purchase-orders' && method === 'GET') {
      let orders = [...(db.data.purchase_orders || [])];
      const statusFilter = parsedUrl.query?.status;
      if (statusFilter) {
        orders = orders.filter(o => o.status === statusFilter);
      }
      // Enrich with vendor name
      orders = orders.map(o => {
        const vendor = db.data.vendors.find(v => v.id === o.vendor_id);
        return { ...o, vendor_name: vendor ? vendor.name : 'Unknown' };
      });
      orders.sort((a, b) => new Date(b.date) - new Date(a.date));
      return sendJSON(res, orders);
    }

    if (pathname === '/api/purchase-orders' && method === 'POST') {
      const body = await parseBody(req);
      const vendor = db.data.vendors.find(v => v.id === parseInt(body.vendor_id));
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return sendJSON(res, { error: "No items provided" }, 400);
      }

      // Generate ONE order number for all items
      // To ensure uniqueness, we can count distinct order numbers or simply use timestamp-based + count
      const uniqueOrders = new Set(db.data.purchase_orders?.map(o => o.order_no) || []);
      const orderNo = `PO-${1000 + uniqueOrders.size + 1}`;
      
      const createdOrders = [];

      for (const item of body.items) {
        const L = parseFloat(item.size_w) || 0;
        const W = parseFloat(item.size_h) || 0;
        const gsm = parseFloat(item.gsm) || 0;
        const rateKg = parseFloat(item.rate_per_kg) || 0;
        const pkts = parseInt(item.ordered_pkts) || 0;
        const weightPerPkt = (L * W * gsm) / 15500;
        const estimatedTotal = Math.round(weightPerPkt * rateKg * pkts);

        const order = {
          id: db.getNextId('purchase_orders'),
          order_no: orderNo,
          vendor_id: vendor.id,
          date: body.date || new Date().toISOString().split('T')[0],
          paper_type: item.paper_type,
          gsm: parseInt(item.gsm),
          size_w: parseFloat(item.size_w),
          size_h: parseFloat(item.size_h),
          ordered_pkts: pkts,
          rate_per_kg: rateKg,
          estimated_total: estimatedTotal,
          status: 'ordered',
          received_pkts: 0,
          received_date: null,
          bill_id: null,
          notes: body.notes || '',
          created_at: new Date().toISOString()
        };
        db.data.purchase_orders.push(order);
        createdOrders.push(order);
      }
      
      await db.save();

      return sendJSON(res, { message: "Order placed successfully", orders: createdOrders, vendor_name: vendor.name });
    }

    const receiveMatch = pathname.match(/^\/api\/purchase-orders\/(\d+)\/receive$/);
    if (receiveMatch && method === 'POST') {
      const orderId = parseInt(receiveMatch[1]);
      const order = (db.data.purchase_orders || []).find(o => o.id === orderId);
      if (!order) return sendJSON(res, { error: "Order not found" }, 404);
      if (order.status === 'received') return sendJSON(res, { error: "Order already received" }, 400);

      const vendor = db.data.vendors.find(v => v.id === order.vendor_id);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const body = await parseBody(req);
      const receivedPkts = parseInt(body.received_pkts) || order.ordered_pkts;
      const actualRateKg = parseFloat(body.rate_per_kg) || order.rate_per_kg;
      const actualSizeW = parseFloat(body.size_w) || order.size_w;
      const actualSizeH = parseFloat(body.size_h) || order.size_h;
      const actualGsm = parseInt(body.gsm) || order.gsm;
      const paymentType = body.payment_type || 'credit';
      const creditDays = parseInt(body.credit_days) || 30;

      const weightPerPkt = (actualSizeW * actualSizeH * actualGsm) / 15500;
      const ratePerPkt = Math.round(weightPerPkt * actualRateKg);
      const totalAmount = ratePerPkt * receivedPkts;
      const sheetQty = receivedPkts * 100;

      // 1. Add to Inventory
      let item = db.data.inventory.find(i => 
        i.paper_type === order.paper_type && 
        i.gsm === actualGsm && 
        i.size_w === actualSizeW && 
        i.size_h === actualSizeH
      );
      if (item) {
        item.pkt_qty += receivedPkts;
        item.sheet_qty += sheetQty;
      } else {
        item = {
          id: db.getNextId('inventory'),
          paper_type: order.paper_type,
          gsm: actualGsm,
          size_w: actualSizeW,
          size_h: actualSizeH,
          pkt_qty: receivedPkts,
          sheet_qty: sheetQty,
          min_alert_pkts: 10,
          vendor_id: vendor.id,
          rate_per_kg: actualRateKg,
          rate_per_pkt: Math.round(actualRateKg * weightPerPkt)
        };
        db.data.inventory.push(item);
      }

      // 2. Record Vendor Transaction (PURCHASE - credit entry, balance goes UP)
      vendor.balance += totalAmount;
      const vTx = {
        id: db.getNextId('vendor_transactions'),
        vendor_id: vendor.id,
        bill_id: null,
        date: new Date().toISOString().split('T')[0],
        type: 'PURCHASE',
        description: `Received ${receivedPkts} Pkts ${order.paper_type} ${actualGsm}gsm (${actualSizeW}x${actualSizeH}) @ Rs. ${actualRateKg}/KG (${weightPerPkt.toFixed(2)} KG/pkt) [${order.order_no}]`,
        debit: 0,
        credit: totalAmount,
        balance_after: vendor.balance
      };
      db.data.vendor_transactions.push(vTx);

      // 3. Create Vendor Bill
      const billNo = `VB-${1000 + (db.data.vendor_bills?.length || 0) + 1}`;
      const dueDate = creditDays > 0 && paymentType === 'credit'
        ? new Date(Date.now() + creditDays * 86400000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const paidNow = paymentType === 'cash' ? totalAmount : 0;

      const bill = {
        id: db.getNextId('vendor_bills'),
        vendor_id: vendor.id,
        bill_no: billNo,
        order_no: order.order_no,
        date: new Date().toISOString().split('T')[0],
        description: `${receivedPkts} Pkts ${order.paper_type} ${actualGsm}gsm (${actualSizeW}x${actualSizeH}) @ Rs. ${actualRateKg}/KG`,
        paper_type: order.paper_type,
        gsm: actualGsm,
        total_amount: totalAmount,
        paid_amount: paidNow,
        remaining_amount: totalAmount - paidNow,
        payment_type: paymentType,
        credit_days: creditDays,
        due_date: dueDate,
        status: paidNow >= totalAmount ? 'paid' : (paidNow > 0 ? 'partial' : 'unpaid'),
        created_at: new Date().toISOString()
      };
      db.data.vendor_bills.push(bill);

      // If cash, auto-record payment
      if (paymentType === 'cash') {
        vendor.balance -= totalAmount;
        db.data.vendor_transactions.push({
          id: db.getNextId('vendor_transactions'),
          vendor_id: vendor.id,
          bill_id: bill.id,
          date: new Date().toISOString().split('T')[0],
          type: 'PAYMENT',
          description: `Cash Payment for ${billNo} [${order.order_no}]`,
          debit: totalAmount,
          credit: 0,
          payment_method: 'Cash',
          balance_after: vendor.balance
        });
      }

      // 4. Update Order status
      order.status = 'received';
      order.received_pkts = receivedPkts;
      order.received_date = new Date().toISOString().split('T')[0];
      order.bill_id = bill.id;
      order.rate_per_kg = actualRateKg;

      // Link bill to transaction
      vTx.bill_id = bill.id;

      await db.save();

      return sendJSON(res, { 
        message: "Goods received! Stock added, bill created, and vendor ledger updated.",
        order, bill, item, transaction: vTx 
      });
    }

    const editPOMatch = pathname.match(/^\/api\/purchase-orders\/(\d+)$/);
    if (editPOMatch && method === 'PUT') {
      const poId = parseInt(editPOMatch[1]);
      const po = (db.data.purchase_orders || []).find(p => p.id === poId);
      if (!po) return sendJSON(res, { error: "Purchase order not found" }, 404);

      const body = await parseBody(req);
      
      if (po.status === 'ordered') {
        // Standard edit for unreceived order
        po.paper_type = body.paper_type;
        po.gsm = parseInt(body.gsm);
        po.size_w = parseFloat(body.size_w);
        po.size_h = parseFloat(body.size_h);
        po.ordered_pkts = parseInt(body.ordered_pkts);
        po.rate_per_kg = parseFloat(body.rate_per_kg);
        await db.save();
        return sendJSON(res, { message: "Purchase order updated", item: po });
      } else if (po.status === 'received') {
        // CASCADE EDIT for received order
        if (!po.bill_id) return sendJSON(res, { error: "Missing bill_id on received order" }, 400);
        
        const vendor = db.data.vendors.find(v => v.id == po.vendor_id);
        const bill = (db.data.vendor_bills || []).find(b => b.id == po.bill_id);
        const tx = (db.data.vendor_transactions || []).find(t => t.bill_id == po.bill_id && t.type === 'PURCHASE');
        
        if (!vendor || !bill || !tx) {
           return sendJSON(res, { error: `Data integrity error: vendor=${!!vendor}, bill=${!!bill}, tx=${!!tx} (po.vendor_id=${po.vendor_id}, po.bill_id=${po.bill_id})` }, 400);
        }
        
        if (bill.paid_amount > 0) {
          return sendJSON(res, { error: "Cannot edit an order that has already been paid for. Delete payments first." }, 400);
        }

        // 1. Revert Old Inventory
        const oldInvItem = (db.data.inventory || []).find(i => 
          i.vendor_id === po.vendor_id && i.paper_type === po.paper_type && i.gsm === po.gsm && i.size_w === po.size_w && i.size_h === po.size_h
        );
        if (oldInvItem) {
          oldInvItem.pkt_qty -= po.received_pkts;
          oldInvItem.sheet_qty -= (po.received_pkts * 100);
          if (oldInvItem.pkt_qty < 0) oldInvItem.pkt_qty = 0;
          if (oldInvItem.sheet_qty < 0) oldInvItem.sheet_qty = 0;
        }

        // 2. Revert Old Ledger
        vendor.balance -= bill.total_amount;

        // 3. Update PO data (Treat ordered_pkts as new received_pkts)
        po.paper_type = body.paper_type;
        po.gsm = parseInt(body.gsm);
        po.size_w = parseFloat(body.size_w);
        po.size_h = parseFloat(body.size_h);
        po.ordered_pkts = parseInt(body.ordered_pkts);
        po.received_pkts = po.ordered_pkts;
        po.rate_per_kg = parseFloat(body.rate_per_kg);

        // 4. Apply New Inventory
        let newInvItem = (db.data.inventory || []).find(i => 
          i.vendor_id === po.vendor_id && i.paper_type === po.paper_type && i.gsm === po.gsm && i.size_w === po.size_w && i.size_h === po.size_h
        );
        if (newInvItem) {
          newInvItem.pkt_qty += po.received_pkts;
          newInvItem.sheet_qty += (po.received_pkts * 100);
        } else {
          newInvItem = {
            id: db.getNextId('inventory'),
            paper_type: po.paper_type,
            gsm: po.gsm,
            size_w: po.size_w,
            size_h: po.size_h,
            pkt_qty: po.received_pkts,
            sheet_qty: po.received_pkts * 100,
            min_alert_pkts: 10,
            vendor_id: po.vendor_id,
            rate_per_kg: po.rate_per_kg,
            rate_per_pkt: Math.round(po.rate_per_kg * ((po.size_w * po.size_h * po.gsm) / 15500))
          };
          db.data.inventory.push(newInvItem);
        }

        // 5. Apply New Bill & Ledger
        const weightPerPkt = (po.size_w * po.size_h * po.gsm) / 15500;
        const newTotal = Math.round(weightPerPkt * po.rate_per_kg * po.received_pkts);
        
        bill.description = `PO-${po.order_no}: ${po.received_pkts} Pkts ${po.paper_type} ${po.gsm}gsm (${po.size_w}x${po.size_h}) @ Rs. ${po.rate_per_kg}/kg`;
        bill.paper_type = po.paper_type;
        bill.gsm = po.gsm;
        bill.total_amount = newTotal;
        bill.remaining_amount = newTotal - bill.paid_amount;
        
        tx.credit = newTotal;
        tx.description = bill.description;

        // Recalculate Vendor Balance
        let currentBalance = 0;
        const vendorTxs = db.data.vendor_transactions
          .filter(t => t.vendor_id === vendor.id)
          .sort((a, b) => a.id - b.id);
          
        vendorTxs.forEach(t => {
          currentBalance += (t.credit || 0);
          currentBalance -= (t.debit || 0);
          t.balance_after = currentBalance;
        });
        
        vendor.balance = currentBalance;
        await db.save();
        return sendJSON(res, { message: "Purchase order and ledger updated successfully", item: po });
      } else {
         return sendJSON(res, { error: "Cannot edit an order in this status" }, 400);
      }
    }

    const deletePOMatch = pathname.match(/^\/api\/purchase-orders\/(\d+)$/);
    if (deletePOMatch && method === 'DELETE') {
      const poId = parseInt(deletePOMatch[1]);
      const poIndex = (db.data.purchase_orders || []).findIndex(p => p.id === poId);
      if (poIndex === -1) return sendJSON(res, { error: "Purchase order not found" }, 404);
      
      const po = db.data.purchase_orders[poIndex];
      if (po.status !== 'ordered') return sendJSON(res, { error: "Cannot delete a received order" }, 400);

      db.data.purchase_orders.splice(poIndex, 1);
      await db.save();
      return sendJSON(res, { message: "Purchase order deleted" });
    }

    // 3. INVENTORY MANAGEMENT
    if (pathname === '/api/inventory' && method === 'GET') {
      return sendJSON(res, db.data.inventory);
    }

    if (pathname === '/api/inventory/cut' && method === 'POST') {
      const body = await parseBody(req);
      const sourceId = parseInt(body.source_id);
      const pktsToCut = parseInt(body.pkts_to_cut);
      const cutsPerSheet = parseInt(body.cuts_per_sheet);
      const newW = parseFloat(body.new_size_w);
      const newH = parseFloat(body.new_size_h);

      if (!sourceId || !pktsToCut || !cutsPerSheet || !newW || !newH) {
        return sendJSON(res, { error: "Missing required fields" }, 400);
      }

      const sourceStock = db.data.inventory.find(i => i.id === sourceId);
      if (!sourceStock) return sendJSON(res, { error: "Source stock not found" }, 404);
      if (sourceStock.pkt_qty < pktsToCut) {
        return sendJSON(res, { error: "Not enough stock to cut" }, 400);
      }

      // Deduct from source
      sourceStock.pkt_qty -= pktsToCut;
      sourceStock.sheet_qty -= (pktsToCut * 100);

      // Add to destination
      const generatedPkts = pktsToCut * cutsPerSheet;
      const generatedSheets = generatedPkts * 100;

      let targetStock = db.data.inventory.find(i => 
        i.paper_type === sourceStock.paper_type &&
        i.gsm === sourceStock.gsm &&
        i.size_w === newW &&
        i.size_h === newH
      );

      if (targetStock) {
        targetStock.pkt_qty += generatedPkts;
        targetStock.sheet_qty += generatedSheets;
      } else {
        targetStock = {
          id: db.getNextId('inventory'),
          paper_type: sourceStock.paper_type,
          gsm: sourceStock.gsm,
          size_w: newW,
          size_h: newH,
          pkt_qty: generatedPkts,
          sheet_qty: generatedSheets,
          min_alert_pkts: 10,
          vendor_id: sourceStock.vendor_id,
          rate_per_pkt: sourceStock.rate_per_pkt ? Math.round(sourceStock.rate_per_pkt / cutsPerSheet) : 0,
          rate_per_kg: sourceStock.rate_per_kg || 0
        };
        db.data.inventory.push(targetStock);
      }

      await db.save();
      return sendJSON(res, { message: "Stock cut successfully", sourceStock, targetStock });
    }

    if (pathname === '/api/inventory/purchase' && method === 'POST') {
      const body = await parseBody(req);
      // body: { vendor_id, paper_type, gsm, size_w, size_h, pkt_qty, rate_per_pkt }
      const vendor = db.data.vendors.find(v => v.id === parseInt(body.vendor_id));
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 400);

      const pktQty = parseInt(body.pkt_qty);
      const sheetQty = pktQty * 100;
      const ratePerPkt = parseFloat(body.rate_per_pkt);
      const totalAmount = pktQty * ratePerPkt;
      const paymentType = body.payment_type || 'cash';
      const creditDays = parseInt(body.credit_days) || 0;

      // Find or create inventory item
      let item = db.data.inventory.find(i => 
        i.paper_type === body.paper_type && 
        i.gsm === parseInt(body.gsm) && 
        i.size_w === parseFloat(body.size_w) && 
        i.size_h === parseFloat(body.size_h)
      );

      if (item) {
        item.pkt_qty += pktQty;
        item.sheet_qty += sheetQty;
      } else {
        item = {
          id: db.getNextId('inventory'),
          paper_type: body.paper_type,
          gsm: parseInt(body.gsm),
          size_w: parseFloat(body.size_w),
          size_h: parseFloat(body.size_h),
          pkt_qty: pktQty,
          sheet_qty: sheetQty,
          min_alert_pkts: 10,
          vendor_id: vendor.id,
          rate_per_pkt: ratePerPkt,
          rate_per_kg: body.rate_per_kg ? parseFloat(body.rate_per_kg) : 0
        };
        db.data.inventory.push(item);
      }

      // Record Vendor Transaction (Bill/Credit)
      vendor.balance += totalAmount;
      const vTx = {
        id: db.getNextId('vendor_transactions'),
        vendor_id: vendor.id,
        date: new Date().toISOString().split('T')[0],
        type: "PURCHASE",
        description: `Purchased ${pktQty} Pkts ${body.paper_type} ${body.gsm}gsm (${body.size_w}x${body.size_h}) @ Rs. ${body.rate_per_kg || ratePerPkt}/KG (${body.weight_per_pkt || '?'} KG/pkt)`,
        debit: 0,
        credit: totalAmount,
        balance_after: vendor.balance
      };
      db.data.vendor_transactions.push(vTx);

      // Create Vendor Bill Record
      const billNo = `VB-${1000 + (db.data.vendor_bills?.length || 0) + 1}`;
      const dueDate = creditDays > 0 
        ? new Date(Date.now() + creditDays * 86400000).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];

      const paidNow = paymentType === 'cash' ? totalAmount : 0;
      const bill = {
        id: db.getNextId('vendor_bills'),
        vendor_id: vendor.id,
        bill_no: billNo,
        date: new Date().toISOString().split('T')[0],
        description: `${pktQty} Pkts ${body.paper_type} ${body.gsm}gsm (${body.size_w}x${body.size_h}) @ Rs. ${body.rate_per_kg || ratePerPkt}/KG`,
        paper_type: body.paper_type,
        gsm: parseInt(body.gsm),
        total_amount: totalAmount,
        paid_amount: paidNow,
        remaining_amount: totalAmount - paidNow,
        payment_type: paymentType,
        credit_days: creditDays,
        due_date: dueDate,
        status: paidNow >= totalAmount ? 'paid' : (paidNow > 0 ? 'partial' : 'unpaid'),
        created_at: new Date().toISOString()
      };
      db.data.vendor_bills.push(bill);

      // If cash purchase, auto-deduct from vendor balance (paid immediately)
      if (paymentType === 'cash') {
        vendor.balance -= totalAmount;
        db.data.vendor_transactions.push({
          id: db.getNextId('vendor_transactions'),
          vendor_id: vendor.id,
          bill_id: bill.id,
          date: new Date().toISOString().split('T')[0],
          type: 'PAYMENT',
          description: `Cash Payment for ${billNo}`,
          debit: totalAmount,
          credit: 0,
          payment_method: 'Cash',
          balance_after: vendor.balance
        });
      }

      await db.save();

      return sendJSON(res, { message: "Stock purchased and vendor ledger updated!", item, vendorTransaction: vTx, bill });
    }

    // 4. VENDORS & LEDGERS
    if (pathname === '/api/vendors' && method === 'GET') {
      return sendJSON(res, db.data.vendors);
    }

    if (pathname === '/api/vendors' && method === 'POST') {
      const body = await parseBody(req);
      const newVendor = {
        id: db.getNextId('vendors'),
        name: body.name,
        category: body.category || 'paper_supplier', // paper_supplier, pasting_vendor, service_vendor
        phone: body.phone || '',
        balance: parseFloat(body.initial_balance) || 0.0,
        initial_balance: parseFloat(body.initial_balance) || 0.0,
        created_at: new Date().toISOString()
      };
      db.data.vendors.push(newVendor);

      if (newVendor.balance > 0) {
        db.data.vendor_transactions.push({
          id: db.getNextId('vendor_transactions'),
          vendor_id: newVendor.id,
          date: new Date().toISOString().split('T')[0],
          type: "OPENING BALANCE",
          description: "Opening Balance",
          debit: 0,
          credit: newVendor.balance,
          balance_after: newVendor.balance
        });
      }

      await db.save();
      return sendJSON(res, newVendor);
    }

    const vendorOBMatch = pathname.match(/^\/api\/vendors\/(\d+)\/opening-balance$/);
    if (vendorOBMatch && method === 'PUT') {
      const vendorId = parseInt(vendorOBMatch[1]);
      const vendor = db.data.vendors.find(v => v.id === vendorId);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const body = await parseBody(req);
      const newAmount = parseFloat(body.initial_balance) || 0;
      vendor.initial_balance = newAmount;

      let obTx = db.data.vendor_transactions.find(t => t.vendor_id === vendorId && t.type === 'OPENING BALANCE');
      if (newAmount > 0) {
        if (obTx) {
          obTx.credit = newAmount;
        } else {
          db.data.vendor_transactions.push({
            id: db.getNextId('vendor_transactions'),
            vendor_id: vendorId,
            date: new Date().toISOString().split('T')[0],
            type: "OPENING BALANCE",
            description: "Opening Balance",
            debit: 0,
            credit: newAmount,
            balance_after: 0
          });
        }
      } else {
        if (obTx) {
          db.data.vendor_transactions = db.data.vendor_transactions.filter(t => t.id !== obTx.id);
        }
      }

      // Recalculate vendor balance
      let runningBalance = 0;
      const vendorTxs = db.data.vendor_transactions
        .filter(t => t.vendor_id === vendorId)
        .sort((a, b) => a.id - b.id);
      
      vendorTxs.forEach(t => {
        runningBalance = runningBalance + t.credit - t.debit;
        t.balance_after = runningBalance;
      });
      vendor.balance = runningBalance;
      await db.save();
      return sendJSON(res, { message: "Opening balance updated", vendor });
    }

    const vendorLedgerMatch = pathname.match(/^\/api\/vendors\/(\d+)\/ledger$/);
    if (vendorLedgerMatch && method === 'GET') {
      const vendorId = parseInt(vendorLedgerMatch[1]);
      const vendor = db.data.vendors.find(v => v.id === vendorId);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const transactions = db.data.vendor_transactions.filter(t => t.vendor_id === vendorId);
      return sendJSON(res, { vendor, transactions });
    }

    const vendorPaymentMatch = pathname.match(/^\/api\/vendors\/(\d+)\/payment$/);
    if (vendorPaymentMatch && method === 'POST') {
      const vendorId = parseInt(vendorPaymentMatch[1]);
      const vendor = db.data.vendors.find(v => v.id === vendorId);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const body = await parseBody(req);
      const amountPaid = parseFloat(body.amount);
      vendor.balance -= amountPaid;

      const vTx = {
        id: db.getNextId('vendor_transactions'),
        vendor_id: vendorId,
        date: body.date || new Date().toISOString().split('T')[0],
        type: "PAYMENT",
        bill_id: null,
        description: body.description || `Payment Paid (${body.payment_method || 'Cash'})`,
        debit: amountPaid,
        credit: 0,
        balance_after: vendor.balance
      };
      db.data.vendor_transactions.push(vTx);
      await db.save();

      return sendJSON(res, { message: "Payment recorded successfully", vendor, transaction: vTx });
    }

    const vendorBillsMatch = pathname.match(/^\/api\/vendors\/(\d+)\/bills$/);
    if (vendorBillsMatch && method === 'GET') {
      const vendorId = parseInt(vendorBillsMatch[1]);
      const bills = (db.data.vendor_bills || []).filter(b => b.vendor_id === vendorId);
      return sendJSON(res, bills);
    }

    const vendorBillPayMatch = pathname.match(/^\/api\/vendors\/(\d+)\/bill\/(\d+)\/pay$/);
    if (vendorBillPayMatch && method === 'POST') {
      const vendorId = parseInt(vendorBillPayMatch[1]);
      const billId = parseInt(vendorBillPayMatch[2]);
      const vendor = db.data.vendors.find(v => v.id === vendorId);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const bill = (db.data.vendor_bills || []).find(b => b.id === billId && b.vendor_id === vendorId);
      if (!bill) return sendJSON(res, { error: "Bill not found" }, 404);

      const body = await parseBody(req);
      const amountPaid = parseFloat(body.amount);
      const paymentMethod = body.payment_method || 'Cash';

      if (amountPaid <= 0) return sendJSON(res, { error: "Amount must be greater than 0" }, 400);
      if (amountPaid > bill.remaining_amount) return sendJSON(res, { error: `Amount exceeds remaining Rs. ${bill.remaining_amount}` }, 400);

      // Update bill
      bill.paid_amount += amountPaid;
      bill.remaining_amount = bill.total_amount - bill.paid_amount;
      bill.status = bill.remaining_amount <= 0 ? 'paid' : 'partial';

      // Update vendor balance
      vendor.balance -= amountPaid;

      // Record transaction
      const vTx = {
        id: db.getNextId('vendor_transactions'),
        vendor_id: vendorId,
        bill_id: bill.id,
        date: body.date || new Date().toISOString().split('T')[0],
        type: 'PAYMENT',
        description: `${paymentMethod} Payment against ${bill.bill_no}${body.cheque_no ? ' (Cheque #' + body.cheque_no + ')' : ''}`,
        debit: amountPaid,
        credit: 0,
        payment_method: paymentMethod,
        balance_after: vendor.balance
      };
      db.data.vendor_transactions.push(vTx);
      await db.save();

      return sendJSON(res, { message: "Payment recorded against bill", vendor, bill, transaction: vTx });
    }

    const deleteVendorBillMatch = pathname.match(/^\/api\/vendors\/(\d+)\/bill\/(\d+)$/);
    if (deleteVendorBillMatch && method === 'DELETE') {
      const vendorId = parseInt(deleteVendorBillMatch[1]);
      const billId = parseInt(deleteVendorBillMatch[2]);
      
      const vendor = db.data.vendors.find(v => v.id === vendorId);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const billIndex = (db.data.vendor_bills || []).findIndex(b => b.id === billId && b.vendor_id === vendorId);
      if (billIndex === -1) return sendJSON(res, { error: "Bill not found" }, 404);
      
      const bill = db.data.vendor_bills[billIndex];
      if (bill.paid_amount > 0) {
        return sendJSON(res, { error: "Cannot delete bill. Payments exist against this bill. Delete payments first." }, 400);
      }

      // Find related PURCHASE transaction
      const txIndex = (db.data.vendor_transactions || []).findIndex(tx => tx.bill_id === billId && tx.type === 'PURCHASE');
      
      // Revert Vendor Balance (deduct total_amount since it's a purchase bill)
      vendor.balance -= bill.total_amount;

      // Revert Inventory (find the item that matches this bill based on paper details)
      // Warning: We don't explicitly link inventory items to bills right now except by paper specs.
      // Actually, wait: when we received the PO or made direct purchase, we increased inventory.
      // We need to decrease it.
      const invItem = db.data.inventory.find(i => 
        i.vendor_id === vendorId &&
        i.paper_type === bill.paper_type &&
        i.gsm === bill.gsm
      );

      // We need to deduce packets added. Wait, direct purchases just had pktQty. We can deduce it from the description or we can just find the PO.
      // Since we don't store pkts_added explicitly on the bill, let's just find the PO linked to this bill!
      const relatedPO = (db.data.purchase_orders || []).find(po => po.bill_id === billId);
      
      if (relatedPO && invItem) {
        invItem.pkt_qty -= relatedPO.received_pkts;
        invItem.sheet_qty = invItem.pkt_qty * 100; // assuming 100 sheets/pkt
        
        // reset PO status
        relatedPO.status = 'ordered';
        relatedPO.received_pkts = 0;
        relatedPO.bill_id = null;
      }

      // Remove the transaction
      if (txIndex !== -1) {
        db.data.vendor_transactions.splice(txIndex, 1);
      }

      // Remove the bill
      db.data.vendor_bills.splice(billIndex, 1);
      
      // Recalculate balances for all subsequent transactions for this vendor to ensure ledger integrity
      let currentBalance = 0;
      const vendorTxs = db.data.vendor_transactions
        .filter(tx => tx.vendor_id === vendorId)
        .sort((a, b) => a.id - b.id);
        
      vendorTxs.forEach(tx => {
        currentBalance += (tx.credit || 0); // purchases increase balance
        currentBalance -= (tx.debit || 0);  // payments decrease balance
        tx.balance_after = currentBalance;
      });
      
      vendor.balance = currentBalance;
      await db.save();
      return sendJSON(res, { message: "Bill and related transactions reversed and deleted successfully" });
    }

    // DELETE VENDOR TRANSACTION
    const vendorTxDeleteMatch = pathname.match(/^\/api\/vendors\/(\d+)\/transaction\/(\d+)$/);
    if (vendorTxDeleteMatch && method === 'DELETE') {
      const vendorId = parseInt(vendorTxDeleteMatch[1]);
      const txId = parseInt(vendorTxDeleteMatch[2]);
      const vendor = db.data.vendors.find(v => v.id === vendorId);
      if (!vendor) return sendJSON(res, { error: "Vendor not found" }, 404);

      const txIndex = db.data.vendor_transactions.findIndex(t => t.id === txId && t.vendor_id === vendorId);
      if (txIndex === -1) return sendJSON(res, { error: "Transaction not found" }, 404);

      const tx = db.data.vendor_transactions[txIndex];

      // Reverse the balance impact
      if (tx.type === 'PAYMENT') {
        // Payment was a debit (reduced balance), so add it back
        vendor.balance += tx.debit;
        
        // Also revert the bill if this payment was against a bill
        if (tx.bill_id) {
          const bill = (db.data.vendor_bills || []).find(b => b.id === tx.bill_id);
          if (bill) {
            bill.paid_amount -= tx.debit;
            if (bill.paid_amount < 0) bill.paid_amount = 0;
            bill.remaining_amount = bill.total_amount - bill.paid_amount;
            bill.status = bill.paid_amount >= bill.total_amount ? 'paid' : (bill.paid_amount > 0 ? 'partial' : 'unpaid');
          }
        }
      } else {
        // Purchase was a credit (increased balance), so subtract it
        vendor.balance -= tx.credit;
      }

      // Remove the transaction
      db.data.vendor_transactions.splice(txIndex, 1);

      // Recalculate balance_after for remaining transactions of this vendor
      let runningBalance = 0;
      const vendorTxs = db.data.vendor_transactions
        .filter(t => t.vendor_id === vendorId)
        .sort((a, b) => a.id - b.id);
      
      vendorTxs.forEach(t => {
        runningBalance = runningBalance + t.credit - t.debit;
        t.balance_after = runningBalance;
      });

      vendor.balance = runningBalance;
      await db.save();

      return sendJSON(res, { message: "Transaction deleted and balance recalculated", vendor });
    }

    // 5. CLIENTS & LEDGERS
    if (pathname === '/api/clients' && method === 'GET') {
      return sendJSON(res, db.data.clients);
    }

    if (pathname === '/api/clients' && method === 'POST') {
      const body = await parseBody(req);
      const newClient = {
        id: db.getNextId('clients'),
        name: body.name,
        company: body.company || '',
        phone: body.phone || '',
        balance: parseFloat(body.initial_balance) || 0.0,
        initial_balance: parseFloat(body.initial_balance) || 0.0,
        created_at: new Date().toISOString()
      };
      db.data.clients.push(newClient);

      if (newClient.balance > 0) {
        db.data.client_transactions.push({
          id: db.getNextId('client_transactions'),
          client_id: newClient.id,
          date: new Date().toISOString().split('T')[0],
          type: "OPENING BALANCE",
          description: "Opening Balance",
          debit: newClient.balance,
          credit: 0,
          balance_after: newClient.balance
        });
      }

      await db.save();
      return sendJSON(res, newClient);
    }

    const clientOBMatch = pathname.match(/^\/api\/clients\/(\d+)\/opening-balance$/);
    if (clientOBMatch && method === 'PUT') {
      const clientId = parseInt(clientOBMatch[1]);
      const client = db.data.clients.find(c => c.id === clientId);
      if (!client) return sendJSON(res, { error: "Client not found" }, 404);

      const body = await parseBody(req);
      const newAmount = parseFloat(body.initial_balance) || 0;
      client.initial_balance = newAmount;

      let obTx = db.data.client_transactions.find(t => t.client_id === clientId && t.type === 'OPENING BALANCE');
      if (newAmount > 0) {
        if (obTx) {
          obTx.debit = newAmount;
        } else {
          db.data.client_transactions.push({
            id: db.getNextId('client_transactions'),
            client_id: clientId,
            date: new Date().toISOString().split('T')[0],
            type: "OPENING BALANCE",
            description: "Opening Balance",
            debit: newAmount,
            credit: 0,
            balance_after: 0
          });
        }
      } else {
        if (obTx) {
          db.data.client_transactions = db.data.client_transactions.filter(t => t.id !== obTx.id);
        }
      }

      // Recalculate client balance
      let runningBalanceC = 0;
      const clientTxs = db.data.client_transactions
        .filter(t => t.client_id === clientId)
        .sort((a, b) => a.id - b.id);
      
      clientTxs.forEach(t => {
        runningBalanceC = runningBalanceC + t.debit - t.credit;
        t.balance_after = runningBalanceC;
      });
      client.balance = runningBalanceC;
      await db.save();
      return sendJSON(res, { message: "Opening balance updated", client });
    }

    const clientLedgerMatch = pathname.match(/^\/api\/clients\/(\d+)\/ledger$/);
    if (clientLedgerMatch && method === 'GET') {
      const clientId = parseInt(clientLedgerMatch[1]);
      const client = db.data.clients.find(c => c.id === clientId);
      if (!client) return sendJSON(res, { error: "Client not found" }, 404);

      const transactions = db.data.client_transactions.filter(t => t.client_id === clientId);
      return sendJSON(res, { client, transactions });
    }

    const clientPaymentMatch = pathname.match(/^\/api\/clients\/(\d+)\/payment$/);
    if (clientPaymentMatch && method === 'POST') {
      const clientId = parseInt(clientPaymentMatch[1]);
      const client = db.data.clients.find(c => c.id === clientId);
      if (!client) return sendJSON(res, { error: "Client not found" }, 404);

      const body = await parseBody(req);
      const amountReceived = parseFloat(body.amount);
      client.balance -= amountReceived;

      const cTx = {
        id: db.getNextId('client_transactions'),
        client_id: clientId,
        job_no: body.job_no || null,
        date: body.date || new Date().toISOString().split('T')[0],
        type: "PAYMENT",
        description: body.description || `Payment Received (${body.payment_method || 'Cash'})`,
        debit: 0,
        credit: amountReceived,
        balance_after: client.balance
      };
      db.data.client_transactions.push(cTx);
      await db.save();

      return sendJSON(res, { message: "Payment received recorded successfully", client, transaction: cTx });
    }

    // DELETE CLIENT TRANSACTION
    const clientTxDeleteMatch = pathname.match(/^\/api\/clients\/(\d+)\/transaction\/(\d+)$/);
    if (clientTxDeleteMatch && method === 'DELETE') {
      const clientId = parseInt(clientTxDeleteMatch[1]);
      const txId = parseInt(clientTxDeleteMatch[2]);
      const client = db.data.clients.find(c => c.id === clientId);
      if (!client) return sendJSON(res, { error: "Client not found" }, 404);

      const txIndex = db.data.client_transactions.findIndex(t => t.id === txId && t.client_id === clientId);
      if (txIndex === -1) return sendJSON(res, { error: "Transaction not found" }, 404);

      const tx = db.data.client_transactions[txIndex];

      // Reverse the balance impact
      if (tx.type === 'PAYMENT') {
        // Payment was a credit (reduced receivable), so add it back
        client.balance += tx.credit;
      } else {
        // Invoice was a debit (increased receivable), so subtract it
        client.balance -= tx.debit;
      }

      // Remove the transaction
      db.data.client_transactions.splice(txIndex, 1);

      // Recalculate balance_after for remaining transactions of this client
      let runningBalance = 0;
      const clientTxs = db.data.client_transactions
        .filter(t => t.client_id === clientId)
        .sort((a, b) => a.id - b.id);
      
      clientTxs.forEach(t => {
        runningBalance = runningBalance + t.debit - t.credit;
        t.balance_after = runningBalance;
      });

      client.balance = runningBalance;
      await db.save();

      return sendJSON(res, { message: "Transaction deleted and balance recalculated", client });
    }

    const clientProductsMatch = pathname.match(/^\/api\/clients\/(\d+)\/products$/);
    if (clientProductsMatch && method === 'GET') {
      const clientId = parseInt(clientProductsMatch[1]);
      const products = (db.data.client_products || []).filter(p => p.client_id === clientId);
      return sendJSON(res, products);
    }

    if (pathname === '/api/client-products' && method === 'GET') {
      return sendJSON(res, db.data.client_products || []);
    }

    const addClientProductMatch = pathname.match(/^\/api\/clients\/(\d+)\/products$/);
    if (addClientProductMatch && method === 'POST') {
      const clientId = parseInt(addClientProductMatch[1]);
      const client = db.data.clients.find(c => c.id === clientId);
      if (!client) return sendJSON(res, { error: 'Client not found' }, 404);

      const body = await parseBody(req);
      
      // Check if product with same name already exists for this client
      const existing = (db.data.client_products || []).find(
        p => p.client_id === clientId && p.name.toLowerCase() === (body.name || '').toLowerCase()
      );
      
      if (existing) {
        // Update existing product dimensions and specs
        existing.box_w = parseFloat(body.box_w);
        existing.box_l = parseFloat(body.box_l);
        existing.paper_size = body.paper_size;
        existing.cuts = parseInt(body.cuts);
        existing.ups = parseInt(body.ups);
        existing.colors = parseInt(body.colors) || 1;
        existing.rate_per_box = parseFloat(body.rate_per_box) || 0;
        existing.updated_at = new Date().toISOString();
        await db.save();
        return sendJSON(res, existing);
      }

      if (!db.data.client_products) db.data.client_products = [];
      const newProduct = {
        id: db.getNextId('client_products'),
        client_id: clientId,
        name: body.name,
        paper_size: body.paper_size,
        ups: parseInt(body.ups) || 1,
        colors: parseInt(body.colors) || 1,
        rate_per_box: parseFloat(body.rate_per_box) || 0,
        description: body.description || ''
      };
      db.data.client_products.push(newProduct);
      await db.save();
      return sendJSON(res, newProduct);
    }

    const editClientProductMatch = pathname.match(/^\/api\/clients\/(\d+)\/products\/(\d+)$/);
    if (editClientProductMatch && (method === 'PUT' || method === 'POST')) {
      const clientId = parseInt(editClientProductMatch[1]);
      const productId = parseInt(editClientProductMatch[2]);
      
      const product = (db.data.client_products || []).find(p => p.id === productId && p.client_id === clientId);
      if (!product) return sendJSON(res, { error: 'Product not found' }, 404);

      const body = await parseBody(req);
      product.name = body.name;
      product.paper_size = body.paper_size;
      product.ups = parseInt(body.ups) || 1;
      product.colors = parseInt(body.colors) || 1;
      product.rate_per_box = parseFloat(body.rate_per_box) || 0;
      if (body.description !== undefined) {
        product.description = body.description;
      }
      
      await db.save();
      return sendJSON(res, product);
    }

    // 6. JOBS & PRODUCTION QUEUE PIPELINE
    if (pathname === '/api/jobs' && method === 'GET') {
      return sendJSON(res, db.data.jobs);
    }

    if (pathname === '/api/jobs' && method === 'POST') {
      const body = await parseBody(req);
      const client = db.data.clients.find(c => c.id === parseInt(body.client_id));
      if (!client) return sendJSON(res, { error: "Client not found" }, 400);

      const stockItem = db.data.inventory.find(i => i.id === parseInt(body.stock_id));
      if (!stockItem) return sendJSON(res, { error: "Stock item not found" }, 404);

      const pktsIssued = parseInt(body.pkts_issued);
      if (pktsIssued <= 0) return sendJSON(res, { error: "Must issue at least 1 packet" }, 400);
      if (stockItem.pkt_qty < pktsIssued) {
        return sendJSON(res, { error: `Insufficient stock! Only ${stockItem.pkt_qty} pkts available.` }, 400);
      }

      // Deduct stock
      stockItem.pkt_qty -= pktsIssued;
      stockItem.sheet_qty = stockItem.pkt_qty * 100;

      const jobNo = `JOB-${1000 + db.data.jobs.length + 1}`;
      const totalAmount = parseFloat(body.total_amount) || 0.0;
      
      const newJob = {
        id: db.getNextId('jobs'),
        job_no: jobNo,
        client_id: client.id,
        job_title: body.job_title,
        paper_type: stockItem.paper_type,
        gsm: stockItem.gsm,
        order_qty: parseInt(body.order_qty),
        pkts_required: pktsIssued,
        colors: parseInt(body.colors) || 1,
        extra_colors: body.extra_colors || [],
        print_cost: totalAmount,
        material_cost: parseFloat(body.material_cost) || 0.0,
        lamination_cost: 0.0,
        die_cut_cost: 0.0,
        current_stage: "queue",
        solna_machine: 1, // default
        produced_qty: 0,
        delivered_qty: 0,
        status: "active",
        created_at: new Date().toISOString()
      };

      db.data.jobs.push(newJob);

      await db.save();
      
      return sendJSON(res, { message: "Stock issued and Job created", job: newJob });
    }


    const jobStageMatch = pathname.match(/^\/api\/jobs\/(\d+)\/stage$/);
    if (jobStageMatch && method === 'PATCH') {
      const jobId = parseInt(jobStageMatch[1]);
      const job = db.data.jobs.find(j => j.id === jobId);
      if (!job) return sendJSON(res, { error: "Job not found" }, 404);

      const body = await parseBody(req);
      if (body.stage && job.current_stage !== body.stage) {
        const stages = ['queue', 'printing', 'lamination', 'die_cutting', 'outside_pasting', 'delivered'];
        const oldIndex = stages.indexOf(job.current_stage);
        const newIndex = stages.indexOf(body.stage);
        
        if (newIndex < oldIndex) {
            // Rollback logic
            if (newIndex < stages.indexOf('delivered')) {
                job.delivered_qty = 0;
                job.status = 'active';
            }
            if (newIndex < stages.indexOf('outside_pasting')) {
                job.pasting_cost = 0;
                job.pasting_received_qty = 0;
                job.pasting_rate_per_box = 0;
            }
            if (newIndex < stages.indexOf('die_cutting')) {
                job.total_amount = (job.total_amount || 0) - (job.diecut_cost || 0);
                job.diecut_cost = 0;
                job.diecut_rate = 0;
            }
            if (newIndex < stages.indexOf('lamination')) {
                job.total_amount = (job.total_amount || 0) - (job.lamination_cost || 0);
                job.lamination_cost = 0;
                job.lamination_rate = 0;
            }
        }
        job.current_stage = body.stage;
      }
      if (body.solna_machine) job.solna_machine = parseInt(body.solna_machine);
      if (body.produced_qty !== undefined) job.produced_qty = parseInt(body.produced_qty);
      if (body.pasting_rate_per_box !== undefined) {
        job.pasting_rate_per_box = parseFloat(body.pasting_rate_per_box);
        job.pasting_sent_qty = job.order_qty; // Initialize tracking when sent
        job.pasting_received_qty = 0;
      }

      await db.save();
      return sendJSON(res, job);
    }

    const laminationMatch = pathname.match(/^\/api\/jobs\/(\d+)\/lamination$/);
    if (laminationMatch && method === 'POST') {
      const jobId = parseInt(laminationMatch[1]);
      const job = db.data.jobs.find(j => j.id === jobId);
      if (!job) return sendJSON(res, { error: "Job not found" }, 404);

      const body = await parseBody(req);
      job.lamination_type = body.lamination_type;
      job.lamination_rate = parseFloat(body.lamination_rate) || 0;
      job.lamination_sheet_w = parseFloat(body.lamination_sheet_w) || 0;
      job.lamination_sheet_h = parseFloat(body.lamination_sheet_h) || 0;
      
      const lamCost = parseFloat(body.lamination_cost) || 0;
      const oldLamCost = job.lamination_cost || 0;
      job.lamination_cost = lamCost;
      job.total_amount = (job.total_amount || 0) - oldLamCost + lamCost;
      job.current_stage = 'lamination';

      // Bill to client ledger logic removed for box-based billing

      await db.save();
      return sendJSON(res, job);
    }

    const diecutMatch = pathname.match(/^\/api\/jobs\/(\d+)\/diecut$/);
    if (diecutMatch && method === 'POST') {
      const jobId = parseInt(diecutMatch[1]);
      const job = db.data.jobs.find(j => j.id === jobId);
      if (!job) return sendJSON(res, { error: "Job not found" }, 404);

      const body = await parseBody(req);
      job.diecut_rate = parseFloat(body.diecut_rate) || 0;
      
      const dieCost = parseFloat(body.diecut_cost) || 0;
      const oldDieCost = job.diecut_cost || 0;
      job.diecut_cost = dieCost;
      job.total_amount = (job.total_amount || 0) - oldDieCost + dieCost;
      job.current_stage = 'die_cutting';

      // Bill to client ledger logic removed for box-based billing

      await db.save();
      return sendJSON(res, job);
    }

    const pastingDispatchMatch = pathname.match(/^\/api\/jobs\/(\d+)\/pasting-dispatch$/);
    if (pastingDispatchMatch && method === 'POST') {
      const jobId = parseInt(pastingDispatchMatch[1]);
      const job = db.data.jobs.find(j => j.id === jobId);
      if (!job) return sendJSON(res, { error: "Job not found" }, 404);

      const body = await parseBody(req);
      const pastingVendor = db.data.vendors.find(v => v.id === parseInt(body.vendor_id));
      if (!pastingVendor) return sendJSON(res, { error: "Pasting Vendor not found" }, 400);

      const sentQty = parseInt(body.sent_qty);
      const receivedQty = parseInt(body.received_qty) || 0;
      const ratePer1000 = parseFloat(body.rate_per_1000);
      const isCompleted = body.is_completed || false;

      job.pasting_vendor_id = pastingVendor.id;
      job.pasting_sent_qty = sentQty;
      job.pasting_received_qty = receivedQty;
      job.pasting_rate_per_1000 = ratePer1000;

      // If pasting completed, calculate bill & record to Vendor Ledger!
      if (isCompleted && receivedQty > 0) {
        const pastingBill = (receivedQty / 1000) * ratePer1000;
        pastingVendor.balance += pastingBill;
        
        db.data.vendor_transactions.push({
          id: db.getNextId('vendor_transactions'),
          vendor_id: pastingVendor.id,
          date: new Date().toISOString().split('T')[0],
          type: "PURCHASE",
          description: `Outside Pasting Bill for ${job.job_no} (${receivedQty} boxes @ Rs. ${ratePer1000}/1000)`,
          debit: 0,
          credit: pastingBill,
          balance_after: pastingVendor.balance
        });
      }

      await db.save();
      return sendJSON(res, { message: "Pasting dispatch updated", job });
    }

    const jobDeliverMatch = pathname.match(/^\/api\/jobs\/(\d+)\/deliver$/);
    if (jobDeliverMatch && method === 'POST') {
      const jobId = parseInt(jobDeliverMatch[1]);
      const job = db.data.jobs.find(j => j.id === jobId);
      if (!job) return sendJSON(res, { error: "Job not found" }, 404);

      const body = await parseBody(req);
      let deliverQty = parseInt(body.deliver_qty) || 0;
      
      if (deliverQty <= 0) return sendJSON(res, { error: "Quantity must be greater than 0" }, 400);
      if (deliverQty > job.order_qty) return sendJSON(res, { error: `Cannot deliver more than total order quantity (${job.order_qty})` }, 400);
      
      if (job.pasting_rate_per_box) {
         const pastingCost = deliverQty * job.pasting_rate_per_box;
         job.pasting_cost = pastingCost;
         job.pasting_received_qty = deliverQty;
      }
      
      // Update delivered qty to the entered amount
      job.delivered_qty = deliverQty;

      // Always mark as delivered and completed, no partial deliveries
      job.current_stage = 'delivered';
      job.status = 'completed';

      // Bill the client based on rate_per_box
      // We need to find the product rate
      let ratePerBox = 0;
      // We find the product by matching job_title which should match product name
      const product = (db.data.client_products || []).find(p => p.client_id === job.client_id && p.name === job.job_title);
      if (product && product.rate_per_box > 0) {
        ratePerBox = product.rate_per_box;
      }

      if (ratePerBox > 0 && deliverQty > 0) {
        const invoiceAmount = deliverQty * ratePerBox;
        const client = db.data.clients.find(c => c.id === job.client_id);
        if (client) {
          if (!job.is_billed) {
            client.balance += invoiceAmount;
            db.data.client_transactions.push({
              id: db.getNextId('client_transactions'),
              client_id: client.id,
              job_no: job.job_no,
              date: new Date().toISOString().split('T')[0],
              type: "INVOICE",
              description: `Delivered ${deliverQty} boxes of ${job.job_title} @ Rs. ${ratePerBox.toFixed(2)}/box`,
              debit: invoiceAmount,
              credit: 0,
              balance_after: client.balance
            });
            job.is_billed = true;
          } else {
            // Find existing invoice and update it
            const invoice = db.data.client_transactions.find(t => t.client_id === client.id && t.job_no === job.job_no && t.type === "INVOICE");
            if (invoice) {
               invoice.description = `Delivered ${deliverQty} boxes of ${job.job_title} @ Rs. ${ratePerBox.toFixed(2)}/box`;
               invoice.debit = invoiceAmount;
               
               // Recalculate client ledger to ensure correctness
               let currentBalance = 0;
               const clientTxs = db.data.client_transactions
                 .filter(t => t.client_id === client.id)
                 .sort((a, b) => a.id - b.id);
                 
               clientTxs.forEach(t => {
                 currentBalance += (t.debit || 0);
                 currentBalance -= (t.credit || 0);
                 t.balance_after = currentBalance;
               });
               
               client.balance = currentBalance;
            }
          }
        }
      }

      await db.save();
      return sendJSON(res, { message: "Delivery and Invoicing recorded successfully", job });
    }

    // -------------------------------------------------------------
    // STATIC FRONTEND SERVING
    // -------------------------------------------------------------
    return serveStaticFile(req, res, pathname);

  } catch (err) {
    console.error("Server Error:", err);
    return sendJSON(res, { error: "Internal Server Error", details: err.message }, 500);
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🖨️  PRINT PRESS MASTER SERVER RUNNING AT:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

export default server;


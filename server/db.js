import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, '..', 'database.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Initial default data structure
const initialData = {
  vendors: [],
  clients: [],
  inventory: [],
  vendor_transactions: [],
  vendor_bills: [],
  purchase_orders: [],
  client_transactions: [],
  jobs: [],
  machines: [],
  client_products: []
};

class Database {
  constructor() {
    this.data = initialData;
  }

  async init() {
    if (SUPABASE_URL && SUPABASE_KEY) {
      console.log("Using Supabase as cloud database");
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.1&select=data`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].data) {
          this.data = rows[0].data;
          this.migrate();
        } else {
           console.log("No Supabase data found, starting fresh.");
        }
      } catch (err) {
        console.error("Error loading from Supabase", err);
      }
    } else {
      console.log("Using local JSON file");
      if (!fs.existsSync(DB_FILE)) {
        this.save();
      } else {
        try {
          const raw = fs.readFileSync(DB_FILE, 'utf-8');
          this.data = JSON.parse(raw);
          this.migrate();
        } catch (err) {
          console.error("Error loading database file, initializing new:", err);
          this.save();
        }
      }
    }
  }

  migrate() {
    let dirty = false;
    // Migrate: add missing collections
    if (!this.data.vendor_bills) { this.data.vendor_bills = []; dirty = true; }
    if (!this.data.purchase_orders) { this.data.purchase_orders = []; dirty = true; }
    if (!this.data.client_products) { this.data.client_products = []; dirty = true; }
    if (dirty) this.save();
  }

  save() {
    if (SUPABASE_URL && SUPABASE_KEY) {
      // Async fire-and-forget save to Supabase
      fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.1`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ data: this.data })
      }).catch(err => console.error("Failed to save to Supabase:", err));
    } else {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (err) {
        console.error("Failed to save database:", err);
      }
    }
  }

  // Helper ID generator
  getNextId(collection) {
    const list = this.data[collection] || [];
    if (list.length === 0) return 1;
    return Math.max(...list.map(item => item.id || 0)) + 1;
  }
}

export const db = new Database();
await db.init();

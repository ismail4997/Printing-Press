import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, '..', 'database.json');

let SUPABASE_URL = process.env.SUPABASE_URL;
if (SUPABASE_URL) {
  // Strip trailing slashes and /rest/v1 if the user pasted the full path
  SUPABASE_URL = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}
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
  client_products: [],
  employees: [],
  attendance: [],
  salaries: [],
  expenses: []
};

class Database {
  constructor() {
    this.data = initialData;
    this._saveTimer = null;
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
    let localData = null;
    try {
      if (fs.existsSync(DB_FILE)) {
        localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error("Could not read local DB_FILE for migration defaults:", e);
    }

    const collections = [
      'vendor_bills', 'purchase_orders', 'client_products',
      'employees', 'attendance', 'salaries', 'expenses',
      'vendors', 'clients', 'inventory', 'jobs', 'machines'
    ];

    for (const col of collections) {
      if (!this.data[col] || this.data[col].length === 0) {
        if (localData && Array.isArray(localData[col]) && localData[col].length > 0) {
          this.data[col] = localData[col];
          dirty = true;
          console.log(`Seeded ${col} with ${localData[col].length} records from database.json`);
        } else if (!this.data[col]) {
          this.data[col] = [];
          dirty = true;
        }
      }
    }
    if (dirty) this.save();
  }

  save() {
    if (SUPABASE_URL && SUPABASE_KEY) {
      // PERFORMANCE: Don't wait for Supabase — update memory instantly,
      // persist to cloud in the background with debouncing.
      // Multiple rapid saves are batched into one network request.
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        const payload = JSON.stringify({ data: this.data });
        fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.1`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: payload
        }).then(res => {
          if (!res.ok) res.text().then(t => console.error("Supabase save failed:", res.status, t));
        }).catch(err => console.error("Failed to save to Supabase:", err));
      }, 300);
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


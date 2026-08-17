import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, '..', 'database.json');

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
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      this.save();
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Migrate: add vendor_bills if missing
        if (!this.data.vendor_bills) {
          this.data.vendor_bills = [];
          this.save();
        }
        if (!this.data.purchase_orders) {
          this.data.purchase_orders = [];
          this.save();
        }
        // Migrate: add client_products if missing
        if (!this.data.client_products) {
          this.data.client_products = [];
          this.save();
        }
      } catch (err) {
        console.error("Error loading database file, initializing new:", err);
        this.save();
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error("Failed to save database:", err);
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

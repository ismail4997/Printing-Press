const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

const anchor = 'const btnAddOrderItem = document.getElementById(\'btn-add-order-item\');';
const beforeAnchor = code.substring(0, code.indexOf(anchor));
let afterAnchor = code.substring(code.indexOf(anchor));

const targetPattern = /const itemHtml = \[\s\S]*?\;/;
const newHtml = "const itemHtml = \" + 
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
          \;"

afterAnchor = afterAnchor.replace(targetPattern, newHtml);

const scriptToAdd = 
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
;

fs.writeFileSync('public/app.js', beforeAnchor + scriptToAdd + afterAnchor);
console.log('done');

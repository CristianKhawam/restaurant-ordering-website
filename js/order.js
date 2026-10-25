/* =========================================================
   order.js — ordering page
   - Builds the menu from MENU_ITEMS
   - Validates quantities (whole numbers 0–20)
   - Updates the total in real time
   - Applies voucher codes (discount before taxes)
   - Generates an itemized receipt and "Download PDF" via print
   - Saves the order in localStorage so a refresh keeps it

   All money is handled in CENTS (whole numbers) to avoid
   floating-point errors such as 0.1 + 0.2 = 0.30000000000000004.
   ========================================================= */

const MIN_QUANTITY = 0;
const MAX_QUANTITY = 20;
const GST_RATE = 0.05;

const MENU_ITEMS = [
  { id: "classic-burger", category: "Burgers", name: "Classic Burger", description: "Smashed beef patty, cheddar, pickles, onions and house sauce.", priceCents: 949, image: "images/menu/classic-burger.webp" },
  { id: "double-cheeseburger", category: "Burgers", name: "Double Cheeseburger", description: "Two beef patties, double cheddar, pickles and ketchup.", priceCents: 1199, image: "images/menu/double-cheeseburger.webp" },
  { id: "spicy-jalapeno", category: "Burgers", name: "Spicy Jalapeño Burger", description: "Pepper jack cheese, jalapeños and sriracha mayo.", priceCents: 1249, image: "images/menu/spicy-jalapeno.webp" },
  { id: "bacon-bbq", category: "Burgers", name: "Bacon BBQ Stack", description: "Triple patty tower with crispy bacon and smoky BBQ sauce.", priceCents: 1399, image: "images/menu/bacon-bbq.webp" },
  { id: "crispy-chicken", category: "Burgers", name: "Crispy Chicken Burger", description: "Crispy fried chicken, lettuce, tomato and chipotle mayo.", priceCents: 1099, image: "images/menu/crispy-chicken.webp" },
  { id: "veggie-burger", category: "Burgers", name: "Veggie Burger", description: "Plant-based patty, avocado, tomato, lettuce and garlic aioli.", priceCents: 1049, image: "images/menu/veggie-burger.webp" },
  { id: "classic-fries", category: "Sides", name: "French Fries (M)", description: "Golden, crispy fries with a pinch of sea salt.", priceCents: 429, image: "images/menu/classic-fries.webp" },
  { id: "onion-rings", category: "Sides", name: "Onion Rings", description: "Crunchy beer-battered onion rings with ranch dip.", priceCents: 549, image: "images/menu/onion-rings.webp" },
  { id: "chicken-nuggets", category: "Sides", name: "Chicken Nuggets (8 pc)", description: "Bite-sized chicken nuggets with your choice of sauce.", priceCents: 699, image: "images/menu/chicken-nuggets.webp" },
  { id: "chocolate-shake", category: "Drinks & Desserts", name: "Chocolate Milkshake", description: "Thick chocolate shake topped with whipped cream.", priceCents: 599, image: "images/menu/chocolate-shake.webp" },
  { id: "lemonade", category: "Drinks & Desserts", name: "Fresh Lemonade", description: "Freshly squeezed lemonade, lightly sweetened.", priceCents: 349, image: "images/menu/lemonade.webp" },
  { id: "cola", category: "Drinks & Desserts", name: "Cola (M)", description: "Ice-cold classic cola served over ice.", priceCents: 279, image: "images/menu/cola.webp" },
  { id: "sundae", category: "Drinks & Desserts", name: "Strawberry Sundae", description: "Vanilla soft-serve with strawberry sauce and sprinkles.", priceCents: 499, image: "images/menu/sundae.webp" },
];

// Voucher codes and their percent discount
const VOUCHERS = {
  WELCOME5: { percent: 5, description: "Welcome discount" },
  ASSIGNMENT1: { percent: 10, description: "Assignment 1 special" },
  "WEB&NODE_WILL": { percent: 20, description: "Web & Node instructor code" },
};

// Add one code per maze level (MAZE5, MAZE10...). These only work after winning that level.
MAZE_LEVELS.forEach((level) => {
  VOUCHERS[level.code] = {
    percent: level.percent,
    description: `Maze ${level.name} reward`,
    requiresMazeWin: true,
    levelName: level.name,
  };
});

const orderForm = document.getElementById("order-form");
const menuContainer = document.getElementById("menu-container");
const formMessage = document.getElementById("form-message");
const voucherInput = document.getElementById("voucher-input");
const voucherMessage = document.getElementById("voucher-message");
const voucherRemoveButton = document.getElementById("voucher-remove");
const receiptElement = document.getElementById("receipt");
const mobileTotalElement = document.getElementById("mobile-total");

// The voucher code currently applied, or null
let appliedVoucherCode = null;
// Receipt number/date are kept so a refresh shows the same receipt
let currentReceiptInfo = null;

/* ---------- Money helpers ---------- */
function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/* ---------- Menu rendering ---------- */
function createMenuCard(item) {
  const card = document.createElement("article");
  card.className = "card menu-card";
  card.dataset.itemId = item.id;

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "menu-card-image";
  const image = document.createElement("img");
  image.alt = item.name;
  image.loading = "lazy";
  useImageFallback(image);
  image.src = item.image;
  imageWrapper.append(image);

  const body = document.createElement("div");
  body.className = "menu-card-body";
  body.innerHTML = `
    <h4 class="menu-card-name">${item.name}</h4>
    <p class="menu-card-description">${item.description}</p>
    <p class="menu-card-price">${formatMoney(item.priceCents)}</p>
    <div class="quantity-control">
      <label for="qty-${item.id}">Qty</label>
      <button class="quantity-btn" type="button" data-step="-1" data-target="qty-${item.id}" aria-label="Remove one ${item.name}">−</button>
      <input class="quantity-input" id="qty-${item.id}" name="${item.id}" type="number"
             inputmode="numeric" min="${MIN_QUANTITY}" max="${MAX_QUANTITY}" step="1" value="0"
             aria-describedby="error-${item.id}">
      <button class="quantity-btn" type="button" data-step="1" data-target="qty-${item.id}" aria-label="Add one ${item.name}">+</button>
    </div>
    <p class="field-error" id="error-${item.id}" aria-live="polite"></p>
  `;

  card.append(imageWrapper, body);
  return card;
}

function renderMenu() {
  // Keep the category order as it first appears in MENU_ITEMS
  const categories = [...new Set(MENU_ITEMS.map((item) => item.category))];

  categories.forEach((categoryName) => {
    const section = document.createElement("section");
    section.className = "menu-category";

    const heading = document.createElement("h3");
    heading.className = "section-title";
    heading.textContent = categoryName;

    const grid = document.createElement("div");
    grid.className = "menu-grid";
    MENU_ITEMS.filter((item) => item.category === categoryName).forEach((item) => {
      grid.append(createMenuCard(item));
    });

    section.append(heading, grid);
    menuContainer.append(section);
  });
}

function getQuantityInput(itemId) {
  return document.getElementById(`qty-${itemId}`);
}

/* ---------- Validation ---------- */
// Returns { isValid, quantity, message } for the raw text of an input
function validateQuantity(rawValue) {
  const trimmedValue = String(rawValue).trim();

  // Only digits allowed: rejects "", "-1", "2.5", "1e3", "abc"
  if (!/^\d+$/.test(trimmedValue)) {
    return { isValid: false, quantity: 0, message: `Enter a whole number from ${MIN_QUANTITY} to ${MAX_QUANTITY}.` };
  }

  const quantity = Number(trimmedValue);
  if (quantity > MAX_QUANTITY) {
    return { isValid: false, quantity: 0, message: `Maximum is ${MAX_QUANTITY}. Larger orders need a manager's approval.` };
  }

  return { isValid: true, quantity, message: "" };
}

// Shows or clears the error under one item and returns the result
function checkItemInput(itemId) {
  const input = getQuantityInput(itemId);
  const result = validateQuantity(input.value);

  input.classList.toggle("is-invalid", !result.isValid);
  input.setAttribute("aria-invalid", !result.isValid);
  document.getElementById(`error-${itemId}`).textContent = result.message;
  input.closest(".menu-card").classList.toggle("is-selected", result.isValid && result.quantity > 0);

  return result;
}

/* ---------- Order calculations ---------- */
// Reads the whole form. Lines only include items with quantity > 0.
function collectOrder() {
  const lines = [];
  const invalidItemIds = [];

  MENU_ITEMS.forEach((item) => {
    const result = checkItemInput(item.id);
    if (!result.isValid) {
      invalidItemIds.push(item.id);
    } else if (result.quantity > 0) {
      lines.push({ item, quantity: result.quantity, lineTotalCents: item.priceCents * result.quantity });
    }
  });

  return { lines, invalidItemIds };
}

function calculateTotals(lines, voucherCode) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const discountPercent = voucherCode ? VOUCHERS[voucherCode].percent : 0;

  // Discount is applied BEFORE taxes; rounding to whole cents
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);
  const taxableCents = subtotalCents - discountCents;
  const gstCents = Math.round(taxableCents * GST_RATE);
  const totalCents = taxableCents + gstCents;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return { itemCount, subtotalCents, discountPercent, discountCents, gstCents, totalCents };
}

/* ---------- Live summary ---------- */
function updateLiveSummary() {
  const { lines, invalidItemIds } = collectOrder();
  const countElement = document.getElementById("summary-count");
  const totalElement = document.getElementById("summary-total");
  const discountRow = document.getElementById("summary-discount-row");

  // Calculations must not run with invalid values
  if (invalidItemIds.length > 0) {
    countElement.textContent = "—";
    document.getElementById("summary-subtotal").textContent = "—";
    document.getElementById("summary-gst").textContent = "—";
    totalElement.textContent = "Fix quantities";
    mobileTotalElement.textContent = "Fix quantities";
    discountRow.hidden = true;
    return;
  }

  const totals = calculateTotals(lines, appliedVoucherCode);
  countElement.textContent = totals.itemCount;
  document.getElementById("summary-subtotal").textContent = formatMoney(totals.subtotalCents);
  document.getElementById("summary-gst").textContent = formatMoney(totals.gstCents);
  totalElement.textContent = formatMoney(totals.totalCents);
  mobileTotalElement.textContent = formatMoney(totals.totalCents);

  discountRow.hidden = !appliedVoucherCode;
  if (appliedVoucherCode) {
    document.getElementById("summary-discount-label").textContent = `Discount (${appliedVoucherCode}, ${totals.discountPercent}%)`;
    document.getElementById("summary-discount").textContent = `-${formatMoney(totals.discountCents)}`;
  }
}

/* ---------- Vouchers ---------- */
// The maze saves only the best code the player has earned
function hasWonMaze(code) {
  return loadFromStorage(STORAGE_KEYS.mazeVoucher, null)?.code === code;
}

function showVoucherMessage(text, type) {
  voucherMessage.textContent = text;
  voucherMessage.classList.toggle("is-success", type === "success");
  voucherMessage.classList.toggle("is-error", type === "error");
}

function applyVoucher() {
  const code = voucherInput.value.trim().toUpperCase();

  if (code === "") {
    voucherInput.classList.add("is-invalid");
    showVoucherMessage("Please type a voucher code first.", "error");
    return;
  }

  const voucher = VOUCHERS[code];
  if (!voucher) {
    voucherInput.classList.add("is-invalid");
    showVoucherMessage(`"${code}" is not a valid code.`, "error");
    return;
  }

  if (voucher.requiresMazeWin && !hasWonMaze(code)) {
    voucherInput.classList.add("is-invalid");
    showVoucherMessage(`Beat the ${voucher.levelName} level of the maze (Play & Save page) to unlock this code!`, "error");
    return;
  }

  appliedVoucherCode = code;
  voucherInput.value = code;
  voucherInput.classList.remove("is-invalid");
  showVoucherMessage(`${voucher.description}: ${voucher.percent}% off applied!`, "success");
  voucherRemoveButton.hidden = false;
  handleOrderChanged();
}

function removeVoucher() {
  appliedVoucherCode = null;
  voucherInput.value = "";
  voucherInput.classList.remove("is-invalid");
  showVoucherMessage("", null);
  voucherRemoveButton.hidden = true;
  handleOrderChanged();
}

/* ---------- Receipt ---------- */
function createReceiptInfo() {
  return {
    // Simple 6-digit order number for display only
    number: String(Math.floor(100000 + Math.random() * 900000)),
    createdAt: new Date().toISOString(),
  };
}

function renderReceipt(lines, totals) {
  const createdDate = new Date(currentReceiptInfo.createdAt);
  document.getElementById("receipt-meta").textContent =
    `Order #${currentReceiptInfo.number} · ${createdDate.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`;

  // One line: name + line total; below it: "quantity @ unit price"
  document.getElementById("receipt-items").innerHTML = lines
    .map(
      (line) => `
        <li class="receipt-item">
          <div class="receipt-item-main">
            <span>${line.item.name}</span>
            <span>${formatMoney(line.lineTotalCents)}</span>
          </div>
          <div class="receipt-item-detail">${line.quantity} @ ${formatMoney(line.item.priceCents)}</div>
        </li>`
    )
    .join("");

  const discountRow = appliedVoucherCode
    ? `<div class="summary-row"><dt>Discount (${appliedVoucherCode}, ${totals.discountPercent}%)</dt><dd class="discount-value">-${formatMoney(totals.discountCents)}</dd></div>
       <div class="summary-row"><dt>Subtotal after discount</dt><dd>${formatMoney(totals.subtotalCents - totals.discountCents)}</dd></div>`
    : "";

  document.getElementById("receipt-totals").innerHTML = `
    <div class="summary-row"><dt>Subtotal (${totals.itemCount} items)</dt><dd>${formatMoney(totals.subtotalCents)}</dd></div>
    ${discountRow}
    <div class="summary-row"><dt>GST (5%)</dt><dd>${formatMoney(totals.gstCents)}</dd></div>
    <div class="summary-row is-total"><dt>TOTAL</dt><dd>${formatMoney(totals.totalCents)}</dd></div>
  `;

  receiptElement.hidden = false;
}

function hideReceipt() {
  receiptElement.hidden = true;
  currentReceiptInfo = null;
}

function handleSubmit(event) {
  // Checkout is simulated: never send the form anywhere
  event.preventDefault();

  const { lines, invalidItemIds } = collectOrder();

  if (invalidItemIds.length > 0) {
    formMessage.textContent = "Please fix the highlighted quantities before generating your receipt.";
    getQuantityInput(invalidItemIds[0]).focus();
    return;
  }

  if (lines.length === 0) {
    formMessage.textContent = "Your order is empty. Select at least one item first.";
    return;
  }

  formMessage.textContent = "";
  currentReceiptInfo = createReceiptInfo();
  renderReceipt(lines, calculateTotals(lines, appliedVoucherCode));
  saveOrder();

  receiptElement.scrollIntoView({ behavior: "smooth", block: "start" });
  receiptElement.focus({ preventScroll: true });
}

// "Download PDF" uses the browser's print dialog ("Save as PDF").
// The print stylesheet hides everything except the receipt, and the
// page title becomes the suggested file name.
function downloadReceiptPdf() {
  const originalTitle = document.title;
  document.title = `Hero-Burger-Receipt-${currentReceiptInfo.number}`;
  window.addEventListener("afterprint", () => (document.title = originalTitle), { once: true });
  window.print();
}

/* ---------- Saving and restoring (localStorage) ---------- */
function saveOrder() {
  const quantities = {};
  MENU_ITEMS.forEach((item) => {
    quantities[item.id] = getQuantityInput(item.id).value;
  });

  saveToStorage(STORAGE_KEYS.order, {
    quantities,
    voucherCode: appliedVoucherCode,
    receiptInfo: currentReceiptInfo,
  });
}

function restoreOrder() {
  const savedOrder = loadFromStorage(STORAGE_KEYS.order, null);

  if (savedOrder) {
    MENU_ITEMS.forEach((item) => {
      const savedValue = savedOrder.quantities?.[item.id];
      if (savedValue !== undefined) {
        getQuantityInput(item.id).value = savedValue;
      }
    });

    // Re-check the saved code in case it is no longer valid
    if (savedOrder.voucherCode) {
      voucherInput.value = savedOrder.voucherCode;
      applyVoucher();
    }
  }

  updateLiveSummary();

  // Show the same receipt again if the order is still valid
  const { lines, invalidItemIds } = collectOrder();
  if (savedOrder?.receiptInfo && invalidItemIds.length === 0 && lines.length > 0) {
    currentReceiptInfo = savedOrder.receiptInfo;
    renderReceipt(lines, calculateTotals(lines, appliedVoucherCode));
    // Re-applying the voucher above cleared the saved receipt, so save it again
    saveOrder();
  }

  // Tell the user about a maze prize they haven't used yet
  const mazeReward = loadFromStorage(STORAGE_KEYS.mazeVoucher, null);
  if (!appliedVoucherCode && VOUCHERS[mazeReward?.code]) {
    voucherInput.value = mazeReward.code;
    showVoucherMessage(`You beat the maze! Press Apply to use your ${VOUCHERS[mazeReward.code].percent}% reward.`, "success");
  }
}

// Any change to the order makes the old receipt out of date
function handleOrderChanged() {
  hideReceipt();
  formMessage.textContent = "";
  updateLiveSummary();
  saveOrder();
}

function clearOrder() {
  MENU_ITEMS.forEach((item) => {
    getQuantityInput(item.id).value = "0";
  });
  removeVoucher(); // also calls handleOrderChanged()
  removeFromStorage(STORAGE_KEYS.order);
}

/* ---------- Events ---------- */
function initOrderPage() {
  renderMenu();
  restoreOrder();

  orderForm.addEventListener("submit", handleSubmit);

  // One listener for all quantity inputs (event delegation)
  orderForm.addEventListener("input", (event) => {
    if (event.target.classList.contains("quantity-input")) {
      handleOrderChanged();
    }
  });

  // One listener for all − / + buttons
  orderForm.addEventListener("click", (event) => {
    const stepButton = event.target.closest(".quantity-btn");
    if (!stepButton) return;

    const input = document.getElementById(stepButton.dataset.target);
    const { isValid, quantity } = validateQuantity(input.value);
    const startingQuantity = isValid ? quantity : 0;
    const newQuantity = startingQuantity + Number(stepButton.dataset.step);

    // Keep the value inside the allowed range
    input.value = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, newQuantity));
    handleOrderChanged();
  });

  document.getElementById("voucher-apply").addEventListener("click", applyVoucher);
  voucherRemoveButton.addEventListener("click", removeVoucher);

  // Enter inside the voucher box applies the code instead of submitting
  voucherInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyVoucher();
    }
  });
  voucherInput.addEventListener("input", () => voucherInput.classList.remove("is-invalid"));

  document.getElementById("clear-order").addEventListener("click", clearOrder);
  document.getElementById("download-pdf").addEventListener("click", downloadReceiptPdf);
  document.getElementById("new-order").addEventListener("click", () => {
    clearOrder();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

initOrderPage();

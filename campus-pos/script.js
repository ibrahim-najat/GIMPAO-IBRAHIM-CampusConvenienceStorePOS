// =====================================================
// Campus Convenience Store POS System - script.js
// =====================================================

// ----- 1. Product data -----
// The product cards and their pictures are written in index.html.
// This list holds the data the cart needs. The id must match the card's data-id.
// The emoji is shown if a picture cannot load.
const products = [
  { id: 1, name: "Instant Noodles",  price: 18.00, emoji: "🍜" },
  { id: 2, name: "Potato Chips",     price: 25.00, emoji: "🥔" },
  { id: 3, name: "Soft Drink (Can)", price: 25.00, emoji: "🥤" },
  { id: 4, name: "Bottled Water",    price: 20.00, emoji: "💧" },
  { id: 5, name: "Ballpen (piece)",  price: 12.00, emoji: "🖊️" },
  { id: 6, name: "Notebook (piece)", price: 35.00, emoji: "📓" }
];

// ----- 2. Application state -----
// cart holds objects like: { id, name, price, quantity }
let cart = [];
// isPaid becomes true after a successful payment.
// While true, the cart is locked until "New Transaction" is clicked.
let isPaid = false;

// Remembers the timers for the "Added ✓" button effect,
// so clicking quickly many times does not stack timers.
const addedTimers = {};

// ----- 3. Get HTML elements by their IDs -----
const productList = document.getElementById("product-list");
const cartItems = document.getElementById("cart-items");
const emptyCartMessage = document.getElementById("empty-cart-message");
const totalItems = document.getElementById("total-items");
const orderTotal = document.getElementById("order-total");
const paymentForm = document.getElementById("payment-form");
const cashInput = document.getElementById("cash-payment");
const payButton = document.getElementById("pay-button");
const paymentMessage = document.getElementById("payment-message");
const receiptSection = document.getElementById("receipt-section");
const receiptContent = document.getElementById("receipt-content");
const newTransactionButton = document.getElementById("new-transaction-button");

// Extra elements used only for the visual design
const cartTableWrap = document.getElementById("cart-table-wrap");
const headerCartCount = document.getElementById("header-cart-count");

// ----- 4. Helper functions -----

// Formats a number as Philippine pesos, e.g. 18 -> "₱18.00"
const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP"
});

function formatPeso(amount) {
  return pesoFormatter.format(amount);
}

// Rounds to 2 decimal places to avoid decimal errors like 0.1 + 0.2 = 0.30000000000000004
function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

// Adds a leading zero to numbers below 10, e.g. 5 -> "05"
function padNumber(number) {
  return String(number).padStart(2, "0");
}

// Returns the total number of items in the cart (sum of all quantities)
function getTotalItems() {
  let count = 0;
  for (const item of cart) {
    count += item.quantity;
  }
  return count;
}

// Returns the overall order total (sum of all subtotals)
function getOrderTotal() {
  let total = 0;
  for (const item of cart) {
    total += item.price * item.quantity;
  }
  return roundMoney(total);
}

// Shows a message under the payment form.
// type is "success" or "error" (these classes are styled in style.css)
function showMessage(text, type) {
  paymentMessage.textContent = text;
  paymentMessage.className = "payment-message " + type;
}

function clearMessage() {
  paymentMessage.textContent = "";
  paymentMessage.className = "payment-message";
}

// ----- 5. Product pictures -----

// Replaces a broken picture with the product's emoji
// instead of showing a broken image icon.
function showImageFallback(img, product) {
  const imageBox = img.parentElement;
  imageBox.innerHTML = `
    <div class="image-fallback" role="img" aria-label="${product.name}">
      <span>${product.emoji}</span>
      Image unavailable
    </div>
  `;
}

// Checks every product picture in index.html.
// A picture may have already failed before this script ran, so we check
// for that first, and also listen for errors that happen later.
function setupProductImages() {
  const images = productList.querySelectorAll(".product-card img");

  for (const img of images) {
    const card = img.closest(".product-card");
    const product = products.find(p => p.id === Number(card.dataset.id));

    if (img.complete && img.naturalWidth === 0) {
      showImageFallback(img, product);         // already failed
    } else {
      img.addEventListener("error", function () {
        showImageFallback(img, product);       // fails later
      });
    }
  }
}

// Enables or disables all "Add to Cart" buttons
function setProductButtonsDisabled(disabled) {
  const buttons = productList.querySelectorAll(".add-button");
  for (const button of buttons) {
    button.disabled = disabled;
  }
  // Dims the product cards while the order is locked
  productList.classList.toggle("is-locked", disabled);
}

// Small visual response when a product is added:
// the button shows "Added ✓" and the card glows green for a moment.
function showAddedFeedback(productId) {
  const card = productList.querySelector(`.product-card[data-id="${productId}"]`);
  const button = card.querySelector(".add-button");

  button.textContent = "Added ✓";
  button.classList.add("added");
  card.classList.add("just-added");

  clearTimeout(addedTimers[productId]);
  addedTimers[productId] = setTimeout(function () {
    button.textContent = "Add to Cart";
    button.classList.remove("added");
    card.classList.remove("just-added");
  }, 800);

  // Make the header cart badge "pop"
  headerCartCount.classList.remove("bump");
  void headerCartCount.offsetWidth; // restarts the CSS animation
  headerCartCount.classList.add("bump");
}

// ----- 6. Cart actions -----

function addToCart(productId) {
  if (isPaid) {
    showMessage("This order is already paid. Click Start New Transaction to begin a new order.", "error");
    return;
  }

  const product = products.find(p => p.id === productId);
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    // Product is already in the cart, so just add 1 to its quantity
    existingItem.quantity += 1;
  } else {
    // New product, add it to the cart with quantity 1
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  clearMessage();
  renderCart();
  showAddedFeedback(productId);
}

function increaseQuantity(productId) {
  if (isPaid) return;
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.quantity += 1;
    renderCart();
  }
}

function decreaseQuantity(productId) {
  if (isPaid) return;
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity -= 1;

  // If quantity reaches 0, remove the item from the cart
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    renderCart();
  }
}

function removeFromCart(productId) {
  if (isPaid) return;
  // Keep every item except the one being removed
  cart = cart.filter(item => item.id !== productId);
  renderCart();
}

// ----- 7. Display the cart and totals -----
// Called every time the cart changes, so totals are always up to date.
function renderCart() {
  cartItems.innerHTML = "";

  // Buttons are disabled after payment so the paid order cannot be changed
  const disabledAttr = isPaid ? "disabled" : "";

  for (const item of cart) {
    const subtotal = roundMoney(item.price * item.quantity);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <span class="cart-name">${item.name}</span>
        <span class="cart-unit">${formatPeso(item.price)} each</span>
      </td>
      <td>
        <div class="qty-controls">
          <button type="button" class="qty-button" data-action="decrease" data-id="${item.id}" aria-label="Decrease ${item.name}" ${disabledAttr}>−</button>
          <span>${item.quantity}</span>
          <button type="button" class="qty-button" data-action="increase" data-id="${item.id}" aria-label="Increase ${item.name}" ${disabledAttr}>+</button>
        </div>
      </td>
      <td>${formatPeso(subtotal)}</td>
      <td>
        <button type="button" class="remove-button" data-action="remove" data-id="${item.id}" ${disabledAttr}>Remove</button>
      </td>
    `;
    cartItems.appendChild(row);
  }

  // Show the table when there are items, otherwise show the friendly empty message
  const isEmpty = cart.length === 0;
  cartTableWrap.hidden = isEmpty;
  emptyCartMessage.hidden = !isEmpty;

  // Update the totals
  const itemCount = getTotalItems();
  totalItems.textContent = itemCount;
  orderTotal.textContent = formatPeso(getOrderTotal());
  headerCartCount.textContent = itemCount;
}

// ----- 8. Payment -----

// Creates a reference like "TXN-20261013-110405-472"
function generateReference(date) {
  const datePart = date.getFullYear() + padNumber(date.getMonth() + 1) + padNumber(date.getDate());
  const timePart = padNumber(date.getHours()) + padNumber(date.getMinutes()) + padNumber(date.getSeconds());
  const randomPart = Math.floor(Math.random() * 900) + 100; // 3-digit number from 100 to 999
  return `TXN-${datePart}-${timePart}-${randomPart}`;
}

function handlePayment(event) {
  // Stop the form from reloading the page
  event.preventDefault();

  if (isPaid) {
    showMessage("This order is already paid. Click Start New Transaction to begin a new order.", "error");
    return;
  }

  // Rule 1: the cart must not be empty
  if (cart.length === 0) {
    showMessage("Your cart is empty. Please add at least one product before paying.", "error");
    return;
  }

  const rawValue = cashInput.value.trim();

  // Rule 2: the input must be a number
  // (badInput is true when the browser could not read the typed text as a number)
  if (cashInput.validity.badInput) {
    showMessage("Invalid amount. Please enter numbers only.", "error");
    return;
  }

  // Rule 3: the input must not be blank
  if (rawValue === "") {
    showMessage("Please enter the cash amount.", "error");
    return;
  }

  const cash = Number(rawValue);

  // Extra check in case the value is still not a valid number
  if (!Number.isFinite(cash)) {
    showMessage("Invalid amount. Please enter numbers only.", "error");
    return;
  }

  // Rule 4: the amount must not be negative
  if (cash < 0) {
    showMessage("Cash amount cannot be negative.", "error");
    return;
  }

  // Rule 5: the cash must cover the total
  const total = getOrderTotal();
  if (cash < total) {
    const shortBy = roundMoney(total - cash);
    showMessage(`Insufficient payment. The total is ${formatPeso(total)}. You still need ${formatPeso(shortBy)}.`, "error");
    return;
  }

  // ----- Payment is valid -----
  const change = roundMoney(cash - total);
  const now = new Date();

  const transaction = {
    reference: generateReference(now),
    dateTime: now.toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }),
    items: cart.map(item => ({ ...item })), // copy of the cart items
    totalItems: getTotalItems(),
    total: total,
    cash: roundMoney(cash),
    change: change
  };

  isPaid = true;

  showMessage(`Payment successful! Change: ${formatPeso(change)}`, "success");
  renderReceipt(transaction);

  // Lock the order so it cannot be changed after payment
  cashInput.disabled = true;
  payButton.disabled = true;
  setProductButtonsDisabled(true);
  renderCart();

  // Show the receipt and scroll to it
  receiptSection.hidden = false;
  receiptSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ----- 9. Receipt -----
function renderReceipt(transaction) {
  let itemRows = "";
  for (const item of transaction.items) {
    const subtotal = roundMoney(item.price * item.quantity);
    itemRows += `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${formatPeso(subtotal)}</td>
      </tr>
    `;
  }

  receiptContent.innerHTML = `
    <div class="receipt-header">
      <strong>Campus Convenience Store</strong>
      <small>Official Digital Receipt</small><br>
      <span class="receipt-paid">PAID</span>
    </div>

    <div class="receipt-meta">
      <div class="receipt-row"><span>Reference</span><span class="receipt-mono">${transaction.reference}</span></div>
      <div class="receipt-row"><span>Date/Time</span><span>${transaction.dateTime}</span></div>
    </div>

    <hr>

    <table class="receipt-items">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <hr>

    <div class="receipt-row"><span>Total Items</span><span>${transaction.totalItems}</span></div>
    <div class="receipt-row receipt-total"><span>Total</span><span>${formatPeso(transaction.total)}</span></div>
    <div class="receipt-row"><span>Cash Paid</span><span>${formatPeso(transaction.cash)}</span></div>
    <div class="receipt-row receipt-change"><span>Change</span><span>${formatPeso(transaction.change)}</span></div>

    <hr>

    <p class="receipt-thanks">Thank you for shopping! Have a great day on campus.</p>
  `;
}

// ----- 10. New transaction -----
function startNewTransaction() {
  cart = [];
  isPaid = false;

  // Clear and re-enable the payment form
  cashInput.value = "";
  cashInput.disabled = false;
  payButton.disabled = false;

  // Clear messages and hide the receipt
  clearMessage();
  receiptContent.innerHTML = "";
  receiptSection.hidden = true;

  setProductButtonsDisabled(false);
  renderCart();

  // Scroll back to the top for the next customer
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ----- 11. Event listeners -----
// Each listener is added only once. The product and cart listeners use
// "event delegation": one listener on the parent handles every button inside it,
// even buttons that are created later by renderCart().

// All "Add to Cart" buttons
productList.addEventListener("click", function (event) {
  const button = event.target.closest(".add-button");
  if (!button || button.disabled) return;
  addToCart(Number(button.dataset.id));
});

// All + / − / Remove buttons in the cart
cartItems.addEventListener("click", function (event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;

  const productId = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === "increase") {
    increaseQuantity(productId);
  } else if (action === "decrease") {
    decreaseQuantity(productId);
  } else if (action === "remove") {
    removeFromCart(productId);
  }
});

paymentForm.addEventListener("submit", handlePayment);
newTransactionButton.addEventListener("click", startNewTransaction);

// ----- 12. Start the app -----
setupProductImages();
renderCart();

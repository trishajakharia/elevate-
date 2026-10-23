"use strict";

/* ELEVATE — Track. Alert. Save.
   Browser-based demo. Data is stored locally on this device.
*/

const $ = id => document.getElementById(id);
const DB_KEY = "greens_demo_v1";
const SESSION_KEY = "greens_session_v1";

const CATEGORIES = {
  "Dairy Products": ["Milk", "Cheese", "Butter", "Curd", "Other"],
  "Fruits": ["Apple", "Banana", "Mango", "Watermelon", "Avocado", "Melon", "Guava", "Other"],
  "Vegetables": ["Tomato", "Potato", "Okra", "Bottle gourd", "Bitter gourd", "Beans", "Peas", "Cucumber", "Onions", "Other"],
  "Poultry": ["Chicken", "Mutton", "Meat", "Beef", "Eggs", "Other"],
  "Seafood": ["Fish", "Prawns", "Other"],
  "Desserts": ["Other"],
  "Beverages": ["Other"],
  "Frozen foods": ["Other"],
  "Packaged and canned foods": ["Other"],
  "Others": ["Other"]
};

const EMOJI = {
  "Dairy Products": "🥛",
  Fruits: "🍎",
  Vegetables: "🥦",
  Poultry: "🍗",
  Seafood: "🐟",
  Desserts: "🍰",
  Beverages: "🧃",
  "Frozen foods": "🧊",
  "Packaged and canned foods": "🥫",
  Others: "🍽️"
};

let users = readDB();
let currentEmail = "";
let mode = "login";
let toastTimer;
let notifiedToday = "";

function readDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    return true;
  } catch (error) {
    toast("Could not save. Your browser storage may be full.");
    console.error(error);
    return false;
  }
}

function currentUser() {
  return users[currentEmail];
}

function inventory() {
  return currentUser()?.items || [];
}

function saveUser() {
  persist();
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(value) {
  if (!value) return null;

  const [y, m, d] = value.split("-").map(Number);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d, 12, 0, 0);
}

function dayDifference(dateString) {
  const date = parseDate(dateString);
  const today = parseDate(todayISO());

  if (!date || !today) return null;

  return Math.round((date - today) / 86400000);
}

function formatDate(value) {
  if (!value) return "No date entered";

  const date = parseDate(value);

  return date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : "No date entered";
}

function number(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(value || 0);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message) {
  const el = $("toast");

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

function emptyState(title, message, action = true) {
  return `<div class="empty-state">
    <div class="empty-icon">🌿</div>
    <b>${escapeHTML(title)}</b>
    <p>${escapeHTML(message)}</p>
    ${action ? '<button class="btn btn-primary" data-action="add">＋ Add your first food item</button>' : ""}
  </div>`;
}

function urgency(item) {
  const diff = dayDifference(item.expiry);

  if (diff === null) {
    return {
      diff: null,
      label: "No date entered",
      cls: ""
    };
  }

  if (diff < 0) {
    return {
      diff,
      label: `${Math.abs(diff)} day(s) past date`,
      cls: "expired"
    };
  }

  if (diff === 0) {
    return {
      diff,
      label: "Date is today",
      cls: "soon"
    };
  }

  if (diff === 1) {
    return {
      diff,
      label: "1 day left",
      cls: "soon"
    };
  }

  if (diff <= 3) {
    return {
      diff,
      label: `${diff} days left`,
      cls: "soon"
    };
  }

  return {
    diff,
    label: `${diff} days left`,
    cls: ""
  };
}

function isExpired(item) {
  return item.expiry && dayDifference(item.expiry) < 0;
}

function isUrgent(item) {
  return item.expiry &&
    dayDifference(item.expiry) >= 0 &&
    dayDifference(item.expiry) <= 1;
}

function activeItems() {
  return inventory().filter(item => item.status === "active");
}

function itemName(item) {
  return item.name || "Unnamed food";
}

function foodRow(item, options = {}) {
  const u = urgency(item);
  const quantity = `${number(item.quantity)} ${escapeHTML(item.unit)}`;
  const details = `${escapeHTML(item.category)} · ${quantity} · Added ${formatDate(item.purchase)}`;

  let buttons = "";

  if (options.actions !== false) {
    buttons = `<div class="row-actions">
      <button class="mini-btn" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>
      <button class="mini-btn" data-action="used" data-id="${escapeHTML(item.id)}">✓ Used</button>
      <button class="mini-btn delete" data-action="wasted" data-id="${escapeHTML(item.id)}">Wasted</button>
      <button class="mini-btn delete" data-action="remove" data-id="${escapeHTML(item.id)}">Remove</button>
    </div>`;
  }

  return `<div class="food-row">
    <div class="food-emoji">${EMOJI[item.category] || "🍽️"}</div>
    <div class="food-main">
      <b>${escapeHTML(itemName(item))}</b>
      <small>${details}</small>
      ${item.expiry ? `<small>Expiry date: ${formatDate(item.expiry)}</small>` : ""}
    </div>
    <span class="food-status ${u.cls}">${escapeHTML(u.label)}</span>
    ${buttons}
  </div>`;
}

function renderList(element, items, title, message, actions = true) {
  $(element).innerHTML = items.length
    ? items.map(item => foodRow(item, { actions })).join("")
    : emptyState(title, message, true);
}

function showView(viewName) {
  const valid = [
    "dashboard",
    "inventory",
    "pantry",
    "urgency",
    "expired",
    "report",
    "add"
  ];

  if (!valid.includes(viewName)) {
    viewName = "dashboard";
  }

  document.querySelectorAll(".view").forEach(el => {
    el.classList.add("hidden");
  });

  $(`${viewName}View`).classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  $("sidebar").classList.remove("open");
  $("notificationPanel").classList.add("hidden");

  if (viewName === "report") {
    requestAnimationFrame(drawReportChart);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function refresh() {
  if (!currentUser()) return;

  const user = currentUser();
  const items = activeItems();
  const expired = items.filter(isExpired);
  const soon = items.filter(isUrgent);
  const saved = user.stats.saved;
  const wasted = user.stats.wasted;

  $("welcomeName").textContent = user.name.split(" ")[0];
  $("headerName").textContent = user.name;
  $("userAvatar").textContent = user.name.trim().charAt(0).toUpperCase();

  $("todayText").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  $("storageLabel").textContent = user.capacity
    ? `Fridge capacity: ${number(user.capacity)} L`
    : "Set up your kitchen to get started";

  $("setupCard").classList.toggle("hidden", !!user.capacity);
  $("capacity").value = user.capacity || "";

  $("statTotal").textContent = items.length;
  $("statSoon").textContent = soon.length;
  $("statExpired").textContent = expired.length;
  $("statSaved").textContent = number(saved);

  const sorted = [...items].sort((a, b) => {
    const da = dayDifference(a.expiry);
    const db = dayDifference(b.expiry);

    return (da === null ? Infinity : da) -
      (db === null ? Infinity : db);
  });

  renderList(
    "dashboardInventory",
    sorted.slice(0, 5),
    "Your fridge is waiting!",
    "Add food items to start tracking your kitchen."
  );

  const alerts = [...items]
    .filter(item => item.expiry)
    .sort((a, b) => dayDifference(a.expiry) - dayDifference(b.expiry))
    .slice(0, 5);

  $("dashboardAlerts").innerHTML = alerts.length
    ? alerts.map(item => {
        const u = urgency(item);
        const symbol = u.cls === "expired"
          ? "⚠️"
          : u.cls === "soon"
            ? "⏳"
            : "🌿";

        return `<div class="alert-row">
          <span class="alert-mark">${symbol}</span>
          <div class="alert-copy">
            <strong>${escapeHTML(itemName(item))}</strong>
            <span>${escapeHTML(u.label)} · ${escapeHTML(item.category)}</span>
          </div>
        </div>`;
      }).join("")
    : `<div class="empty-state">
        <div class="empty-icon">🌱</div>
        <b>Nothing to flag yet</b>
        <p>Add expiry dates to see useful reminders here.</p>
      </div>`;

  renderList(
    "inventoryList",
    filteredInventory(),
    "No food items yet",
    "Add what is currently in your kitchen."
  );

  renderList(
    "urgencyList",
    sorted,
    "No items to track",
    "Add food and enter expiry dates to rank items by urgency."
  );

  renderList(
    "expiredList",
    expired.sort((a, b) => dayDifference(a.expiry) - dayDifference(b.expiry)),
    "No items past their entered date",
    "Your tracked items have no past expiry dates."
  );

  $("dueToday").textContent = items.filter(
    i => dayDifference(i.expiry) === 0
  ).length;

  $("dueTomorrow").textContent = items.filter(
    i => dayDifference(i.expiry) === 1
  ).length;

  $("duePast").textContent = expired.length;

  $("dueUnknown").textContent = items.filter(
    i => !i.expiry
  ).length;

  $("reportWasted").textContent = number(wasted);
  $("reportSaved").textContent = number(saved);

  $("reportRate").textContent = (saved + wasted)
    ? `${Math.round(saved / (saved + wasted) * 100)}%`
    : "0%";

  $("reportUsed").textContent = user.stats.usedCount;

  renderWastePatterns();
  renderNotifications();
  updateNotificationBadge();
  populateFilter();
  renderPantryLog();
}

function filteredInventory() {
  const search = ($("searchItems")?.value || "").trim().toLowerCase();
  const category = $("filterCategory")?.value || "";
  const sort = $("sortInventory")?.value || "expiry";

  return [...activeItems()]
    .filter(item =>
      itemName(item).toLowerCase().includes(search) &&
      (!category || item.category === category)
    )
    .sort((a, b) => {
      if (sort === "name") {
        return itemName(a).localeCompare(itemName(b));
      }

      if (sort === "category") {
        return a.category.localeCompare(b.category);
      }

      const da = dayDifference(a.expiry);
      const db = dayDifference(b.expiry);

      return (da === null ? Infinity : da) -
        (db === null ? Infinity : db);
    });
}

function populateFilter() {
  const select = $("filterCategory");

  if (select.options.length > 1) return;

  Object.keys(CATEGORIES).forEach(category => {
    select.add(new Option(category, category));
  });
}

function renderWastePatterns() {
  const counts = currentUser().stats.wasteByName || {};

  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  $("wastePatterns").innerHTML = ranked.length
    ? ranked.map(([name, count]) => `
        <div class="pattern-row">
          <span>${escapeHTML(name)}</span>
          <strong>${count}× wasted</strong>
        </div>
      `).join("")
    : `<div class="empty-state">
        <div class="empty-icon">🌱</div>
        <b>No patterns yet</b>
        <p>Record a wasted item to discover your habits.</p>
      </div>`;
}

/* Authentication: SHA-256 hash for a small local demo.
   This is NOT a replacement for secure server-side authentication. */

async function passwordHash(password) {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return null;
}

function setAuthMode(nextMode) {
  mode = nextMode;

  const registering = mode === "register";

  $("authTitle").textContent = registering
    ? "Create your account"
    : "Welcome back!";

  $("authSubtitle").textContent = registering
    ? "Let's make your kitchen a little greener."
    : "Sign in to see what's fresh.";

  $("usernameWrap").classList.toggle("hidden", !registering);
  $("confirmWrap").classList.toggle("hidden", !registering);

  $("username").required = registering;
  $("confirmPassword").required = registering;

  $("authSubmit").textContent = registering
    ? "Create account →"
    : "Sign in →";

  $("switchText").textContent = registering
    ? "Already have an account?"
    : "New to Elevate?";

  $("switchAuth").textContent = registering
    ? "Sign in"
    : "Create an account";

  $("password").autocomplete = registering
    ? "new-password"
    : "current-password";

  $("authError").textContent = "";
}

$("switchAuth").addEventListener("click", () => {
  setAuthMode(mode === "login" ? "register" : "login");
});

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  $("authError").textContent = "";

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  const hash = await passwordHash(password);

  if (!hash) {
    $("authError").textContent =
      "Secure password hashing is unavailable. Open this site through VS Code Live Server or a modern browser.";
    return;
  }

  if (mode === "register") {
    const name = $("username").value.trim();

    if (!name) {
      $("authError").textContent = "Please enter your name.";
      return;
    }

    if (password.length < 6) {
      $("authError").textContent =
        "Use at least 6 characters for your password.";
      return;
    }

    if (password !== $("confirmPassword").value) {
      $("authError").textContent = "Your passwords do not match.";
      return;
    }

    if (users[email]) {
      $("authError").textContent =
        "This email already has an account. Please sign in.";
      return;
    }

    users[email] = {
      email,
      name,
      passwordHash: hash,
      capacity: null,
      items: [],
      grocery: [],
      notifications: [],
      stats: {
        saved: 0,
        wasted: 0,
        usedCount: 0,
        wasteByName: {}
      }
    };

    if (!persist()) {
      delete users[email];
      return;
    }

    login(email);
    toast("Welcome to Elevate! Let's set up your kitchen.");
  } else {
    if (!users[email] || users[email].passwordHash !== hash) {
      $("authError").textContent = "Email or password is incorrect.";
      return;
    }

    login(email);
    toast("Welcome back to Elevate!");
  }
});

function login(email) {
  currentEmail = email;

  // Add missing fields for existing accounts created by the old version.
  if (!Array.isArray(currentUser().grocery)) {
    currentUser().grocery = [];
  }

  if (!currentUser().stats) {
    currentUser().stats = {
      saved: 0,
      wasted: 0,
      usedCount: 0,
      wasteByName: {}
    };
  }

  if (!currentUser().stats.wasteByName) {
    currentUser().stats.wasteByName = {};
  }

  try {
    sessionStorage.setItem(SESSION_KEY, email);
  } catch {}

  $("authPage").classList.add("hidden");
  $("app").classList.remove("hidden");

  saveUser();
  refresh();
  showView("dashboard");
  checkExpiryReminders();
}

$("logoutBtn").addEventListener("click", () => {
  currentEmail = "";

  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}

  $("app").classList.add("hidden");
  $("authPage").classList.remove("hidden");

  $("password").value = "";
  $("confirmPassword").value = "";
  $("email").value = "";

  setAuthMode("login");
  toast("You have logged out.");
});

/* Refrigerator capacity */

$("capacityForm").addEventListener("submit", event => {
  event.preventDefault();

  const capacity = Number($("capacity").value);

  if (!Number.isFinite(capacity) || capacity <= 0) {
    toast("Enter a valid capacity in litres.");
    return;
  }

  currentUser().capacity = capacity;

  saveUser();
  refresh();

  toast("Kitchen capacity saved!");
});

/* Food form */

function fillCategoryOptions() {
  $("itemCategory").innerHTML = Object.keys(CATEGORIES)
    .map(category =>
      `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    )
    .join("");

  updateFoodOptions();
}

function updateFoodOptions(selectedName = "") {
  const category = $("itemCategory").value;
  const names = CATEGORIES[category] || ["Other"];

  $("itemName").innerHTML = names.map(name =>
    `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`
  ).join("");

  const isOther = names.includes("Other");

  $("customName").classList.toggle("hidden", !isOther);
  $("itemName").classList.toggle("hidden", false);
  $("customName").required = false;

  if (selectedName && !names.includes(selectedName)) {
    $("itemName").value = "Other";
    $("customName").value = selectedName;
    $("customName").classList.remove("hidden");
    $("customName").required = true;
  } else if (selectedName) {
    $("itemName").value = selectedName;
    $("customName").value = "";
  } else {
    $("customName").value = "";
  }

  $("itemName").onchange = () => {
    const custom = $("itemName").value === "Other";

    $("customName").classList.toggle("hidden", !custom);
    $("customName").required = custom;

    if (!custom) {
      $("customName").value = "";
    }
  };
}

$("itemCategory").addEventListener("change", () => {
  updateFoodOptions();
});

function openAddForm(item = null) {
  $("itemForm").reset();

  $("itemId").value = item?.id || "";
  $("itemFormTitle").textContent = item
    ? "Edit food item"
    : "Add food item";

  $("purchaseDate").value = item?.purchase || todayISO();
  $("expiryDate").value = item?.expiry || "";
  $("itemQuantity").value = item?.quantity ?? 1;
  $("itemUnit").value = item?.unit || "items";
  $("itemNotes").value = item?.notes || "";
  $("itemCategory").value = item?.category || "Fruits";

  updateFoodOptions(item?.name || "");
  showView("add");
}

$("itemForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("itemId").value;
  const category = $("itemCategory").value;
  const chosen = $("itemName").value;
  const name = chosen === "Other"
    ? $("customName").value.trim()
    : chosen;

  const quantity = Number($("itemQuantity").value);
  const purchase = $("purchaseDate").value;
  const expiry = $("expiryDate").value;

  if (!name) {
    return toast("Please enter a food name.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return toast("Enter a valid quantity.");
  }

  if (!purchase) {
    return toast("Please enter the date added.");
  }

  if (expiry && expiry < purchase) {
    const ok = confirm(
      "The expiry date is before the date added. Save these dates anyway?"
    );

    if (!ok) return;
  }

  const oldItem = id
    ? inventory().find(item => item.id === id)
    : null;

  const item = {
    id: id || (
      crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    ),
    category,
    name,
    quantity,
    unit: $("itemUnit").value,
    purchase,
    expiry,
    notes: $("itemNotes").value.trim(),
    status: "active",
    createdAt: oldItem?.createdAt || new Date().toISOString()
  };

  if (oldItem) {
    Object.assign(oldItem, item);
  } else {
    currentUser().items.push(item);
  }

  saveUser();
  refresh();
  showView("inventory");

  toast(
    oldItem
      ? "Food item updated and saved."
      : `${name} added to your inventory!`
  );
});

/* Pantry Log — grocery checklist saved per account */

let groceryFilter = "pending";

function groceries() {
  if (!currentUser()) return [];

  if (!Array.isArray(currentUser().grocery)) {
    currentUser().grocery = [];
  }

  return currentUser().grocery;
}

function renderPantryLog() {
  const list = $("groceryList");

  if (!list || !currentUser()) return;

  const all = groceries();
  const pending = all.filter(item => !item.bought);

  const shown = groceryFilter === "all"
    ? all
    : pending;

  $("groceryCount").textContent = `${pending.length} to buy`;

  $("showPendingGroceries").classList.toggle(
    "active-filter",
    groceryFilter === "pending"
  );

  $("showAllGroceries").classList.toggle(
    "active-filter",
    groceryFilter === "all"
  );

  if (!shown.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🛒</div>
      <b>${groceryFilter === "all" ? "Your list is empty" : "All caught up!"}</b>
      <p>${groceryFilter === "all"
        ? "Add groceries you want to remember."
        : "Add an item above or switch to All items to see bought groceries."}</p>
    </div>`;

    return;
  }

  list.innerHTML = shown.map(item => `
    <div class="grocery-row ${item.bought ? "bought" : ""}">
      <input
        class="grocery-check"
        type="checkbox"
        aria-label="Mark ${escapeHTML(item.name)} as bought"
        data-grocery-action="toggle"
        data-grocery-id="${escapeHTML(item.id)}"
        ${item.bought ? "checked" : ""}
      >

      <div class="grocery-copy">
        <strong>${escapeHTML(item.name)}</strong>
        <span>${escapeHTML(item.quantity || "Quantity not specified")} · Added ${formatDate(item.createdAt)}</span>
      </div>

      <span class="grocery-category">${escapeHTML(item.category || "General")}</span>

      <button
        type="button"
        class="mini-btn delete"
        data-grocery-action="remove"
        data-grocery-id="${escapeHTML(item.id)}"
      >Remove</button>
    </div>
  `).join("");
}

$("groceryForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!currentUser()) return;

  const name = $("groceryName").value.trim();
  const quantity = $("groceryQuantity").value.trim();
  const category = $("groceryCategory").value;

  if (!name) {
    return toast("Enter a grocery item first.");
  }

  const duplicate = groceries().some(item =>
    !item.bought &&
    item.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate && !confirm(
    `${name} is already on your list. Add it again?`
  )) {
    return;
  }

  groceries().unshift({
    id: (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    quantity,
    category,
    bought: false,
    createdAt: todayISO()
  });

  saveUser();

  $("groceryForm").reset();
  $("groceryCategory").value = "General";

  groceryFilter = "pending";

  renderPantryLog();

  toast(`${name} added to Pantry Log.`);
});

$("groceryList").addEventListener("change", event => {
  const control = event.target.closest(
    '[data-grocery-action="toggle"]'
  );

  if (!control || !currentUser()) return;

  const item = groceries().find(
    entry => entry.id === control.dataset.groceryId
  );

  if (!item) return;

  item.bought = control.checked;
  item.boughtAt = item.bought
    ? new Date().toISOString()
    : null;

  saveUser();
  renderPantryLog();

  toast(
    item.bought
      ? `${item.name} marked as bought.`
      : `${item.name} moved back to your list.`
  );
});

$("groceryList").addEventListener("click", event => {
  const button = event.target.closest(
    '[data-grocery-action="remove"]'
  );

  if (!button || !currentUser()) return;

  const item = groceries().find(
    entry => entry.id === button.dataset.groceryId
  );

  if (!item) return;

  if (!confirm(`Remove ${item.name} from Pantry Log?`)) {
    return;
  }

  currentUser().grocery = groceries().filter(
    entry => entry.id !== item.id
  );

  saveUser();
  renderPantryLog();

  toast("Grocery item removed.");
});

$("showPendingGroceries").addEventListener("click", () => {
  groceryFilter = "pending";
  renderPantryLog();
});

$("showAllGroceries").addEventListener("click", () => {
  groceryFilter = "all";
  renderPantryLog();
});

$("clearBoughtGroceries").addEventListener("click", () => {
  if (!currentUser()) return;

  const boughtCount = groceries().filter(
    item => item.bought
  ).length;

  if (!boughtCount) {
    return toast("There are no bought items to clear.");
  }

  if (!confirm(
    `Remove ${boughtCount} bought item(s) from Pantry Log?`
  )) {
    return;
  }

  currentUser().grocery = groceries().filter(
    item => !item.bought
  );

  saveUser();
  renderPantryLog();

  toast("Bought items cleared.");
});

/* Inventory actions */

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  const actionButton = event.target.closest("[data-action]");

  if (viewButton) {
    showView(viewButton.dataset.view);
    return;
  }

  if (!actionButton || !currentUser()) return;

  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id;

  const item = inventory().find(
    entry => entry.id === id
  );

  if (action === "add") {
    openAddForm();
    return;
  }

  if (!item) return;

  if (action === "edit") {
    openAddForm(item);
    return;
  }

  if (action === "used") {
    if (!confirm(
      `Mark ${item.name} as used? This records it as food saved from waste.`
    )) {
      return;
    }

    item.status = "used";
    item.completedAt = new Date().toISOString();

    currentUser().stats.saved += item.quantity;
    currentUser().stats.usedCount += 1;

    saveUser();
    refresh();

    toast(`${item.name} marked as used. Great job!`);
  }

  if (action === "wasted") {
    if (!confirm(`Record ${item.name} as wasted?`)) {
      return;
    }

    item.status = "wasted";
    item.completedAt = new Date().toISOString();

    currentUser().stats.wasted += item.quantity;

    const key = item.name;
    const stats = currentUser().stats.wasteByName;

    stats[key] = (stats[key] || 0) + 1;

    saveUser();
    refresh();

    toast(`${item.name} recorded as wasted.`);
  }

  if (action === "remove") {
    if (!confirm(
      `Remove ${item.name} from your inventory? This won't count as used or wasted.`
    )) {
      return;
    }

    currentUser().items = inventory().filter(
      entry => entry.id !== id
    );

    saveUser();
    refresh();

    toast("Item removed from inventory.");
  }
});

/* Search and sorting */

["searchItems", "filterCategory", "sortInventory"].forEach(id => {
  $(id).addEventListener("input", () => {
    renderList(
      "inventoryList",
      filteredInventory(),
      "No matching food items",
      "Try another search or category."
    );
  });
});

/* Notifications */

function checkExpiryReminders() {
  if (!currentUser()) return;

  const today = todayISO();

  if (notifiedToday === today) return;

  notifiedToday = today;

  const urgent = activeItems().filter(item =>
    item.expiry &&
    dayDifference(item.expiry) >= 0 &&
    dayDifference(item.expiry) <= 1
  );

  const previous = currentUser().notifications || [];

  const newNotifications = urgent
    .filter(item =>
      !previous.some(n =>
        n.date === today && n.itemId === item.id
      )
    )
    .map(item => ({
      id: `${today}-${item.id}`,
      date: today,
      itemId: item.id,
      message: `${item.name} — ${urgency(item).label}`,
      read: false
    }));

  currentUser().notifications = [
    ...newNotifications,
    ...previous
  ].slice(0, 50);

  if (newNotifications.length) {
    saveUser();

    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      newNotifications.forEach(n => {
        try {
          new Notification("Elevate expiry reminder", {
            body: n.message
          });
        } catch {}
      });
    }
  }

  renderNotifications();
  updateNotificationBadge();
}

function renderNotifications() {
  const notes = currentUser()?.notifications || [];

  $("notificationList").innerHTML = notes.length
    ? notes.map(note => `
        <div class="notification-item">
          <strong>${escapeHTML(note.message)}</strong>
          <span>${formatDate(note.date)}</span>
        </div>
      `).join("")
    : `<div class="empty-state">
        <div class="empty-icon">🌱</div>
        <b>All quiet in your kitchen</b>
        <p>Expiry reminders will appear here when needed.</p>
      </div>`;
}

function updateNotificationBadge() {
  const unread = (currentUser()?.notifications || [])
    .filter(note => !note.read).length;

  $("notificationCount").textContent = unread;

  $("notificationCount").classList.toggle(
    "hidden",
    unread === 0
  );
}

$("notificationBtn").addEventListener("click", () => {
  const panel = $("notificationPanel");

  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    currentUser().notifications = (
      currentUser().notifications || []
    ).map(note => ({
      ...note,
      read: true
    }));

    saveUser();
    updateNotificationBadge();
  }
});

$("closeNotifications").addEventListener("click", () => {
  $("notificationPanel").classList.add("hidden");
});

$("enableNotifications").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    toast("This browser does not support desktop notifications.");
    return;
  }

  const result = await Notification.requestPermission();

  toast(
    result === "granted"
      ? "Browser notifications enabled while Elevate is active."
      : "Notifications were not enabled. You can change browser permissions in settings."
  );
});

/* Report chart: no external chart library required */

function drawReportChart() {
  const canvas = $("reportChart");

  if (
    !canvas ||
    $("reportView").classList.contains("hidden")
  ) {
    return;
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  const width = Math.max(250, canvas.clientWidth);
  const height = 220;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const user = currentUser();
  const groups = {};

  for (const item of user.items) {
    if (!item.completedAt) continue;

    const date = new Date(item.completedAt);

    const label = date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    });

    if (!groups[label]) {
      groups[label] = {
        saved: 0,
        wasted: 0,
        sort: date.getTime()
      };
    }

    if (item.status === "used") {
      groups[label].saved += item.quantity;
    }

    if (item.status === "wasted") {
      groups[label].wasted += item.quantity;
    }
  }

  const rows = Object.values(groups)
    .sort((a, b) => a.sort - b.sort)
    .slice(-7);

  const labels = Object.keys(groups)
    .sort((a, b) => groups[a].sort - groups[b].sort)
    .slice(-7);

  const pad = {
    left: 36,
    right: 10,
    top: 20,
    bottom: 38
  };

  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxValue = Math.max(
    1,
    ...rows.map(r => Math.max(r.saved, r.wasted))
  );

  const step = chartW / Math.max(1, rows.length);
  const barWidth = Math.min(18, step * 0.28);

  ctx.font = "10px DM Sans, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - chartH * i / 4;

    ctx.strokeStyle = "#edf0e8";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = "#849087";
    ctx.fillText(number(maxValue * i / 4), pad.left - 7, y);
  }

  rows.forEach((row, index) => {
    const x = pad.left + step * index + step / 2;

    const h1 = row.saved / maxValue * chartH;
    const h2 = row.wasted / maxValue * chartH;

    ctx.fillStyle = "#28664c";
    ctx.fillRect(
      x - barWidth - 2,
      pad.top + chartH - h1,
      barWidth,
      h1
    );

    ctx.fillStyle = "#a9deda";
    ctx.fillRect(
      x + 2,
      pad.top + chartH - h2,
      barWidth,
      h2
    );

    ctx.fillStyle = "#78857c";
    ctx.textAlign = "center";
    ctx.fillText(labels[index] || "", x, height - 19);
  });

  $("chartLegend").innerHTML =
    '<span>Food saved (quantity units)</span><span>Food wasted (quantity units)</span>';

  if (!rows.length) {
    ctx.fillStyle = "#78857c";
    ctx.textAlign = "center";
    ctx.font = "12px DM Sans, sans-serif";

    ctx.fillText(
      "Record food as used or wasted to build your chart.",
      width / 2,
      height / 2
    );
  }
}

window.addEventListener("resize", () => {
  if (
    currentUser() &&
    !$("reportView").classList.contains("hidden")
  ) {
    drawReportChart();
  }
});

/* Export report as a CSV spreadsheet */

$("saveReport").addEventListener("click", () => {
  const user = currentUser();

  if (!user) return;

  const rows = [
    ["Elevate Food Report", user.name],
    ["Generated", new Date().toLocaleString()],
    ["Food saved quantity", user.stats.saved],
    ["Food wasted quantity", user.stats.wasted],
    [
      "Waste prevention rate",
      `${(user.stats.saved + user.stats.wasted)
        ? Math.round(
            user.stats.saved /
            (user.stats.saved + user.stats.wasted) * 100
          )
        : 0}%`
    ],
    [],
    ["Food", "Category", "Quantity", "Unit", "Added", "Expiry", "Status"]
  ];

  user.items.forEach(item => {
    rows.push([
      item.name,
      item.category,
      item.quantity,
      item.unit,
      item.purchase,
      item.expiry,
      item.status
    ]);
  });

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "Elevate-Food-Report.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  toast("Your food report has been exported.");
});

/* Mobile navigation */

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

/* Initialise */

fillCategoryOptions();
setAuthMode("login");

try {
  const savedEmail = sessionStorage.getItem(SESSION_KEY);

  if (savedEmail && users[savedEmail]) {
    login(savedEmail);
  }
} catch (error) {
  console.warn("Session restoration unavailable.", error);
}
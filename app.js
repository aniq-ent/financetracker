const STORAGE_KEY = "finance-tracker-expenses";
const BUDGET_KEY = "finance-tracker-budgets";
const CATEGORY_BUDGET_KEY = "finance-tracker-category-budgets";
const RECURRING_KEY = "finance-tracker-recurring-expenses";

const categories = {
  Food: "#157f5f",
  Housing: "#3276b8",
  Transport: "#c9932f",
  Utilities: "#7c5fb8",
  Health: "#d35b72",
  Shopping: "#b36b2f",
  Entertainment: "#2f8fb3",
  Savings: "#4f8f42",
  Other: "#68746d"
};

const categoryNames = Object.keys(categories);

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const shortFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const els = {
  amount: document.querySelector("#amountInput"),
  applyRecurring: document.querySelector("#applyRecurringButton"),
  budget: document.querySelector("#budgetInput"),
  budgetCaption: document.querySelector("#budgetCaption"),
  budgetLeft: document.querySelector("#budgetLeft"),
  budgetMeter: document.querySelector("#budgetMeter"),
  cancelEdit: document.querySelector("#cancelEditButton"),
  category: document.querySelector("#categoryInput"),
  categoryBudgetList: document.querySelector("#categoryBudgetList"),
  categoryCount: document.querySelector("#categoryCount"),
  categoryList: document.querySelector("#categoryList"),
  categoriesView: document.querySelector("#categoriesView"),
  dailyPace: document.querySelector("#dailyPace"),
  date: document.querySelector("#dateInput"),
  description: document.querySelector("#descriptionInput"),
  emptyCategories: document.querySelector("#emptyCategories"),
  emptyList: document.querySelector("#emptyList"),
  emptyRecurring: document.querySelector("#emptyRecurring"),
  expenseFormTitle: document.querySelector("#expenseFormTitle"),
  expenseSubmit: document.querySelector("#expenseSubmitButton"),
  exportButton: document.querySelector("#exportButton"),
  form: document.querySelector("#expenseForm"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  importStatus: document.querySelector("#importStatus"),
  list: document.querySelector("#expenseList"),
  listView: document.querySelector("#listView"),
  month: document.querySelector("#monthInput"),
  paceCaption: document.querySelector("#paceCaption"),
  recurringAmount: document.querySelector("#recurringAmountInput"),
  recurringCategory: document.querySelector("#recurringCategoryInput"),
  recurringDay: document.querySelector("#recurringDayInput"),
  recurringDescription: document.querySelector("#recurringDescriptionInput"),
  recurringForm: document.querySelector("#recurringForm"),
  recurringList: document.querySelector("#recurringList"),
  spentCaption: document.querySelector("#spentCaption"),
  spentTotal: document.querySelector("#spentTotal"),
  template: document.querySelector("#expenseTemplate"),
  tabs: document.querySelectorAll(".tab")
};

let expenses = ensureArray(readJson(STORAGE_KEY, []));
let budgets = ensureObject(readJson(BUDGET_KEY, {}));
let categoryBudgets = ensureObject(readJson(CATEGORY_BUDGET_KEY, {}));
let recurringExpenses = ensureArray(readJson(RECURRING_KEY, []));
let editingId = null;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function daysElapsed(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const now = new Date();
  const selected = new Date(year, monthIndex - 1, 1);
  const isThisMonth = selected.getFullYear() === now.getFullYear() && selected.getMonth() === now.getMonth();
  return isThisMonth ? now.getDate() : new Date(year, monthIndex, 0).getDate();
}

function daysInMonth(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function dateForMonthDay(month, day) {
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), daysInMonth(month));
  return `${month}-${String(safeDay).padStart(2, "0")}`;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, month, day, rawYear] = slash;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function normalizeCategory(value) {
  const text = String(value || "").trim().toLowerCase();
  return categoryNames.find((category) => category.toLowerCase() === text) || "Other";
}

function normalizeAmount(value) {
  const text = String(value || "").replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const amount = Number(text);
  return Number.isFinite(amount) && amount !== 0 ? Math.abs(amount) : 0;
}

function monthExpenses() {
  return expenses
    .filter((expense) => typeof expense.date === "string" && expense.date.startsWith(els.month.value))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function expensesByCategory(visibleExpenses) {
  return visibleExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});
}

function render() {
  const visibleExpenses = monthExpenses();
  const total = visibleExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const budget = Number(budgets[els.month.value] || 0);
  const left = budget - total;
  const average = total / Math.max(daysElapsed(els.month.value), 1);
  const ratio = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;
  const grouped = expensesByCategory(visibleExpenses);

  els.budget.value = budget || "";
  els.spentTotal.textContent = shortFormatter.format(total);
  els.spentCaption.textContent = `${visibleExpenses.length} expense${visibleExpenses.length === 1 ? "" : "s"} in ${monthLabel(els.month.value)}`;
  els.budgetLeft.textContent = shortFormatter.format(left);
  els.budgetLeft.style.color = left < 0 ? "var(--warn)" : "var(--ink)";
  els.budgetCaption.textContent = budget > 0 ? `${Math.round(ratio)}% of budget used` : "Set a monthly budget";
  els.dailyPace.textContent = formatter.format(average);
  els.paceCaption.textContent = "Average per day";
  els.budgetMeter.style.width = `${ratio}%`;
  els.budgetMeter.style.background = ratio >= 100 ? "var(--warn)" : ratio >= 80 ? "var(--gold)" : "var(--accent)";

  renderExpenseList(visibleExpenses);
  renderCategoryBudgets(grouped);
  renderCategories(grouped, total);
  renderRecurringList();
  renderEditState();
}

function renderExpenseList(visibleExpenses) {
  els.list.replaceChildren();
  els.emptyList.classList.toggle("hidden", visibleExpenses.length > 0);

  visibleExpenses.forEach((expense) => {
    const item = els.template.content.firstElementChild.cloneNode(true);
    const title = item.querySelector("h3");
    const detail = item.querySelector("p");
    const amount = item.querySelector("strong");
    const dot = item.querySelector(".category-dot");
    const editButton = item.querySelector(".edit-expense");
    const deleteButton = item.querySelector(".delete-expense");

    title.textContent = expense.description;
    detail.textContent = `${expense.category} - ${formatDate(expense.date)}`;
    amount.textContent = formatter.format(Number(expense.amount || 0));
    dot.style.background = categories[expense.category] || categories.Other;
    editButton.addEventListener("click", () => beginEdit(expense.id));
    deleteButton.addEventListener("click", () => deleteExpense(expense.id));

    els.list.append(item);
  });
}

function renderCategoryBudgets(grouped) {
  const monthBudgets = ensureObject(categoryBudgets[els.month.value]);
  els.categoryBudgetList.replaceChildren();

  categoryNames.forEach((category) => {
    const spent = Number(grouped[category] || 0);
    const budget = Number(monthBudgets[category] || 0);
    const row = document.createElement("article");
    row.className = "budget-item";

    const copy = document.createElement("div");
    copy.className = "budget-copy";

    const title = document.createElement("strong");
    title.textContent = category;

    const statusText = document.createElement("span");
    copy.append(title, statusText);

    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = "Limit";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "decimal";
    input.placeholder = "0";
    input.value = budget || "";
    label.append(labelText, input);

    const bar = document.createElement("div");
    bar.className = "budget-status";
    const fill = document.createElement("span");
    bar.append(fill);

    input.addEventListener("input", () => {
      saveCategoryBudget(category, input.value);
      updateCategoryBudgetRow(statusText, fill, spent, Number(input.value || 0));
    });

    row.append(copy, label, bar);
    els.categoryBudgetList.append(row);
    updateCategoryBudgetRow(statusText, fill, spent, budget);
  });
}

function updateCategoryBudgetRow(statusText, fill, spent, budget) {
  const remaining = budget - spent;
  const ratio = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  statusText.textContent = budget > 0
    ? `${formatter.format(spent)} spent, ${formatter.format(remaining)} left`
    : `${formatter.format(spent)} spent`;
  statusText.style.color = remaining < 0 && budget > 0 ? "var(--warn)" : "var(--muted)";
  fill.style.width = `${ratio}%`;
  fill.style.background = ratio >= 100 ? "var(--warn)" : ratio >= 80 ? "var(--gold)" : "var(--accent)";
}

function saveCategoryBudget(category, rawValue) {
  const value = Number(rawValue || 0);
  const month = els.month.value;
  categoryBudgets[month] = ensureObject(categoryBudgets[month]);

  if (value > 0) {
    categoryBudgets[month][category] = value;
  } else {
    delete categoryBudgets[month][category];
  }

  if (Object.keys(categoryBudgets[month]).length === 0) {
    delete categoryBudgets[month];
  }

  writeJson(CATEGORY_BUDGET_KEY, categoryBudgets);
}

function renderCategories(grouped, total) {
  els.categoryList.replaceChildren();

  const monthBudgets = ensureObject(categoryBudgets[els.month.value]);
  const rows = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  els.categoryCount.textContent = `${rows.length} categor${rows.length === 1 ? "y" : "ies"}`;
  els.emptyCategories.classList.toggle("hidden", rows.length > 0);

  rows.forEach(([category, amount]) => {
    const row = document.createElement("article");
    row.className = "category-item";

    const name = document.createElement("strong");
    name.textContent = category;

    const value = document.createElement("span");
    const budget = Number(monthBudgets[category] || 0);
    value.textContent = budget > 0
      ? `${formatter.format(amount)} / ${formatter.format(budget)}`
      : formatter.format(amount);
    value.style.color = budget > 0 && amount > budget ? "var(--warn)" : "var(--ink)";

    const bar = document.createElement("div");
    bar.className = "category-bar";

    const fill = document.createElement("span");
    fill.style.width = `${total > 0 ? (amount / total) * 100 : 0}%`;
    fill.style.background = categories[category] || categories.Other;

    bar.append(fill);
    row.append(name, value, bar);
    els.categoryList.append(row);
  });
}

function renderRecurringList() {
  els.recurringList.replaceChildren();
  els.emptyRecurring.classList.toggle("hidden", recurringExpenses.length > 0);

  recurringExpenses.forEach((expense) => {
    const item = document.createElement("article");
    item.className = "recurring-item";

    const copy = document.createElement("div");
    copy.className = "recurring-copy";

    const title = document.createElement("strong");
    title.textContent = expense.description;

    const detail = document.createElement("span");
    detail.textContent = `${formatter.format(Number(expense.amount || 0))} - ${expense.category} - day ${expense.day}`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Remove";
    button.addEventListener("click", () => deleteRecurring(expense.id));

    copy.append(title, detail);
    item.append(copy, button);
    els.recurringList.append(item);
  });
}

function renderEditState() {
  const isEditing = Boolean(editingId);
  els.expenseFormTitle.textContent = isEditing ? "Edit expense" : "Add expense";
  els.expenseSubmit.textContent = isEditing ? "Save changes" : "Add expense";
  els.cancelEdit.classList.toggle("hidden", !isEditing);
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function expenseFromForm(existing = {}) {
  return {
    ...existing,
    id: existing.id || makeId(),
    amount: Number(els.amount.value),
    category: els.category.value,
    createdAt: existing.createdAt || Date.now(),
    date: els.date.value,
    description: els.description.value.trim(),
    updatedAt: Date.now()
  };
}

function resetExpenseForm() {
  editingId = null;
  els.form.reset();
  els.date.value = today();
  renderEditState();
}

function beginEdit(id) {
  const expense = expenses.find((item) => item.id === id);
  if (!expense) return;

  editingId = id;
  els.description.value = expense.description || "";
  els.amount.value = expense.amount || "";
  els.date.value = expense.date || today();
  els.category.value = expense.category || "Other";
  renderEditState();
  document.querySelector(".form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  els.description.focus();
}

function deleteExpense(id) {
  if (editingId === id) {
    resetExpenseForm();
  }

  expenses = expenses.filter((expense) => expense.id !== id);
  writeJson(STORAGE_KEY, expenses);
  render();
}

function addOrUpdateExpense() {
  if (editingId) {
    expenses = expenses.map((expense) => (
      expense.id === editingId ? expenseFromForm(expense) : expense
    ));
  } else {
    expenses.push(expenseFromForm());
  }

  writeJson(STORAGE_KEY, expenses);
  resetExpenseForm();
  render();
  els.description.focus();
}

function addRecurringExpense() {
  recurringExpenses.push({
    id: makeId(),
    amount: Number(els.recurringAmount.value),
    category: els.recurringCategory.value,
    createdAt: Date.now(),
    day: Math.min(Math.max(Number(els.recurringDay.value), 1), 31),
    description: els.recurringDescription.value.trim()
  });

  writeJson(RECURRING_KEY, recurringExpenses);
  els.recurringForm.reset();
  els.recurringDay.value = "1";
  render();
}

function deleteRecurring(id) {
  recurringExpenses = recurringExpenses.filter((expense) => expense.id !== id);
  writeJson(RECURRING_KEY, recurringExpenses);
  render();
}

function applyRecurringToMonth() {
  const month = els.month.value;
  let added = 0;

  recurringExpenses.forEach((recurring) => {
    const alreadyApplied = expenses.some((expense) => (
      expense.recurringId === recurring.id && expense.recurringMonth === month
    ));

    if (alreadyApplied) return;

    expenses.push({
      id: makeId(),
      amount: Number(recurring.amount || 0),
      category: recurring.category,
      createdAt: Date.now(),
      date: dateForMonthDay(month, recurring.day),
      description: recurring.description,
      recurringId: recurring.id,
      recurringMonth: month
    });
    added += 1;
  });

  if (added > 0) {
    writeJson(STORAGE_KEY, expenses);
  }

  flashApplyButton(added);
  render();
}

function flashApplyButton(added) {
  const original = "Apply to month";
  els.applyRecurring.textContent = added > 0 ? `Added ${added}` : "Already applied";
  window.setTimeout(() => {
    els.applyRecurring.textContent = original;
  }, 1400);
}

function exportCsv() {
  const rows = monthExpenses();
  const header = ["Date", "Description", "Category", "Amount"];
  const csv = [header, ...rows.map((expense) => [
    expense.date,
    expense.description,
    expense.category,
    Number(expense.amount || 0).toFixed(2)
  ])]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expenses-${els.month.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function headerIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header.trim().toLowerCase()));
}

function importedExpenseKey(expense) {
  return [
    expense.date,
    String(expense.description || "").trim().toLowerCase(),
    expense.category,
    Number(expense.amount || 0).toFixed(2)
  ].join("|");
}

function importCsvText(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { added: 0, skipped: 0, invalid: 0, error: "No expense rows found" };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexes = {
    amount: headerIndex(headers, ["amount", "cost", "debit", "withdrawal"]),
    category: headerIndex(headers, ["category", "type"]),
    date: headerIndex(headers, ["date", "posted date", "transaction date"]),
    description: headerIndex(headers, ["description", "name", "memo", "payee", "merchant"])
  };

  if (indexes.amount < 0 || indexes.date < 0 || indexes.description < 0) {
    return { added: 0, skipped: 0, invalid: 0, error: "CSV needs Date, Description, and Amount columns" };
  }

  const existing = new Set(expenses.map(importedExpenseKey));
  const imported = [];
  let skipped = 0;
  let invalid = 0;

  rows.slice(1).forEach((row) => {
    const date = normalizeDate(row[indexes.date]);
    const amount = normalizeAmount(row[indexes.amount]);
    const description = String(row[indexes.description] || "").trim();
    const category = indexes.category >= 0 ? normalizeCategory(row[indexes.category]) : "Other";

    if (!date || !amount || !description) {
      invalid += 1;
      return;
    }

    const expense = {
      id: makeId(),
      amount,
      category,
      createdAt: Date.now(),
      date,
      description,
      importedAt: Date.now(),
      source: "csv"
    };

    const key = importedExpenseKey(expense);
    if (existing.has(key)) {
      skipped += 1;
      return;
    }

    existing.add(key);
    imported.push(expense);
  });

  if (imported.length > 0) {
    expenses.push(...imported);
    writeJson(STORAGE_KEY, expenses);
  }

  return { added: imported.length, skipped, invalid, error: "" };
}

function showImportStatus(result) {
  if (result.error) {
    els.importStatus.textContent = result.error;
    els.importStatus.style.color = "var(--warn)";
    return;
  }

  els.importStatus.textContent = `Imported ${result.added}; skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}; ignored ${result.invalid} invalid row${result.invalid === 1 ? "" : "s"}.`;
  els.importStatus.style.color = result.added > 0 ? "var(--accent-dark)" : "var(--muted)";
}

function importCsvFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const result = importCsvText(String(reader.result || ""));
    showImportStatus(result);
    render();
    els.importInput.value = "";
  });
  reader.addEventListener("error", () => {
    showImportStatus({ added: 0, skipped: 0, invalid: 0, error: "Could not read that CSV file" });
    els.importInput.value = "";
  });
  reader.readAsText(file);
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  addOrUpdateExpense();
});

els.recurringForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addRecurringExpense();
});

els.applyRecurring.addEventListener("click", applyRecurringToMonth);
els.cancelEdit.addEventListener("click", resetExpenseForm);

els.budget.addEventListener("input", () => {
  const value = Number(els.budget.value || 0);
  if (value > 0) {
    budgets[els.month.value] = value;
  } else {
    delete budgets[els.month.value];
  }
  writeJson(BUDGET_KEY, budgets);
  render();
});

els.month.addEventListener("change", () => {
  els.date.value = `${els.month.value}-01`;
  editingId = null;
  render();
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    els.listView.classList.toggle("hidden", tab.dataset.view !== "list");
    els.categoriesView.classList.toggle("hidden", tab.dataset.view !== "categories");
  });
});

els.exportButton.addEventListener("click", exportCsv);
els.importButton.addEventListener("click", () => els.importInput.click());
els.importInput.addEventListener("change", () => {
  const [file] = els.importInput.files;
  if (file) {
    importCsvFile(file);
  }
});

els.month.value = currentMonth();
els.date.value = today();
els.recurringDay.value = "1";
render();

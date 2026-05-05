const STORAGE_KEY = "finance-tracker-expenses";
const BUDGET_KEY = "finance-tracker-budgets";

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
  budget: document.querySelector("#budgetInput"),
  budgetCaption: document.querySelector("#budgetCaption"),
  budgetLeft: document.querySelector("#budgetLeft"),
  budgetMeter: document.querySelector("#budgetMeter"),
  category: document.querySelector("#categoryInput"),
  categoryCount: document.querySelector("#categoryCount"),
  categoryList: document.querySelector("#categoryList"),
  categoriesView: document.querySelector("#categoriesView"),
  dailyPace: document.querySelector("#dailyPace"),
  date: document.querySelector("#dateInput"),
  description: document.querySelector("#descriptionInput"),
  emptyCategories: document.querySelector("#emptyCategories"),
  emptyList: document.querySelector("#emptyList"),
  exportButton: document.querySelector("#exportButton"),
  form: document.querySelector("#expenseForm"),
  list: document.querySelector("#expenseList"),
  listView: document.querySelector("#listView"),
  month: document.querySelector("#monthInput"),
  paceCaption: document.querySelector("#paceCaption"),
  spentCaption: document.querySelector("#spentCaption"),
  spentTotal: document.querySelector("#spentTotal"),
  template: document.querySelector("#expenseTemplate"),
  tabs: document.querySelectorAll(".tab")
};

let expenses = readJson(STORAGE_KEY, []);
let budgets = readJson(BUDGET_KEY, {});

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

function monthExpenses() {
  return expenses
    .filter((expense) => expense.date.startsWith(els.month.value))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function render() {
  const visibleExpenses = monthExpenses();
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const budget = Number(budgets[els.month.value] || 0);
  const left = budget - total;
  const average = total / Math.max(daysElapsed(els.month.value), 1);
  const ratio = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;

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
  renderCategories(visibleExpenses, total);
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
    const button = item.querySelector("button");

    title.textContent = expense.description;
    detail.textContent = `${expense.category} • ${formatDate(expense.date)}`;
    amount.textContent = formatter.format(expense.amount);
    dot.style.background = categories[expense.category] || categories.Other;
    button.addEventListener("click", () => deleteExpense(expense.id));

    els.list.append(item);
  });
}

function renderCategories(visibleExpenses, total) {
  els.categoryList.replaceChildren();

  const grouped = visibleExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const rows = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  els.categoryCount.textContent = `${rows.length} categor${rows.length === 1 ? "y" : "ies"}`;
  els.emptyCategories.classList.toggle("hidden", rows.length > 0);

  rows.forEach(([category, amount]) => {
    const row = document.createElement("article");
    row.className = "category-item";

    const name = document.createElement("strong");
    name.textContent = category;

    const value = document.createElement("span");
    value.textContent = formatter.format(amount);

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

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function deleteExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  writeJson(STORAGE_KEY, expenses);
  render();
}

function exportCsv() {
  const rows = monthExpenses();
  const header = ["Date", "Description", "Category", "Amount"];
  const csv = [header, ...rows.map((expense) => [
    expense.date,
    expense.description,
    expense.category,
    expense.amount.toFixed(2)
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

els.form.addEventListener("submit", (event) => {
  event.preventDefault();

  expenses.push({
    id: crypto.randomUUID(),
    amount: Number(els.amount.value),
    category: els.category.value,
    createdAt: Date.now(),
    date: els.date.value,
    description: els.description.value.trim()
  });

  writeJson(STORAGE_KEY, expenses);
  els.form.reset();
  els.date.value = today();
  render();
  els.description.focus();
});

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

els.month.value = currentMonth();
els.date.value = today();
render();

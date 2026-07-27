import Expense from "../models/Expense.js";
import BUDGET_TYPES from '../utils/budgetTypes.js';

// ─── Date Range Helpers ───────────────────────────────────────────────────────

const getDateRange = (view, query) => {
  const { date, month, year } = query;

  switch (view) {
    case "daily": {
      if (!date) return { error: "date is required for daily view" };
      const start = new Date(date);
      if (Number.isNaN(start.getTime())) return { error: "Invalid date" };
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case "weekly": {
      if (!date) return { error: "date is required for weekly view" };
      const inputDate = new Date(date);
      if (Number.isNaN(inputDate.getTime())) return { error: "Invalid date" };

      // Weeks are anchored to calendar-month dates: 1–7, 8–14, 15–21, and 22–month end.
      const week = Math.min(Math.floor((inputDate.getDate() - 1) / 7) + 1, 4);
      const start = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        (week - 1) * 7 + 1,
      );
      start.setHours(0, 0, 0, 0);

      const lastDay = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth() + 1,
        0,
      ).getDate();
      const end = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        week === 4 ? lastDay : Math.min(week * 7, lastDay),
      );
      end.setHours(23, 59, 59, 999);

      return { start, end };
    }

    case "monthly": {
      if (!month || !year) return { error: "month and year are required for monthly view" };
      const m = Number.parseInt(month);
      const y = Number.parseInt(year);
      if (Number.isNaN(m) || Number.isNaN(y) || m < 1 || m > 12) return { error: "Invalid month or year" };

      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999); // last day of month
      return { start, end };
    }

    case "yearly": {
      if (!year) return { error: "year is required for yearly view" };
      const y = Number.parseInt(year);
      if (Number.isNaN(y)) return { error: "Invalid year" };

      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return { start, end };
    }

    default:
      return { error: "Invalid view. Must be daily, weekly, monthly or yearly" };
  }
};

// ─── Period Label Helper ──────────────────────────────────────────────────────

const getPeriodLabel = (view, start, end, query) => {
  const fmt = (date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  switch (view) {
    case "daily":
      return {
        label: start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
        sub: "",
      };
    case "weekly":
      return {
        label: `Wk${Math.min(Math.floor((start.getDate() - 1) / 7) + 1, 4)}, ${start.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`,
        sub: `${fmt(start)} – ${fmt(end)}`,
      };
    case "monthly":
      return {
        label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        sub: `${fmt(start)} – ${fmt(end)}`,
      };
    case "yearly":
      return {
        label: String(query.year),
        sub: `${fmt(start)} – ${fmt(end)}`,
      };
  }
};

// ─── Chart Data Helpers ───────────────────────────────────────────────────────

// Groups weekly expenses by actual month date, preserving the 7–10 day month-anchored range.
const groupByDay = (expenses, start, end) => {
  const result = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    result.push({
      label: String(cursor.getDate()),
      total: 0,
      needs: 0,
      wants: 0,
      investments: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  expenses.forEach((expense) => {
    const date = new Date(expense.date);
    const dayIndex = Math.floor((date - start) / (24 * 60 * 60 * 1000));
    if (!result[dayIndex]) return;
    result[dayIndex].total += expense.amount;
    result[dayIndex][expense.budgetType] += expense.amount;
  });

  return result;
};

// Groups expenses by week number within the month (for monthly view)
const groupByWeek = (expenses, start) => {
  const numWeeks = 4;

  const result = Array.from({ length: numWeeks }, (_, i) => ({
    label: `W${i + 1}`,
    total: 0,
    needs: 0,
    wants: 0,
    investments: 0,
  }));

  expenses.forEach((expense) => {
    const day = new Date(expense.date).getDate();
    const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
    result[weekIndex].total += expense.amount;
    result[weekIndex][expense.budgetType] += expense.amount;
  });

  return result;
};

// Groups expenses by month (for yearly view)
const groupByMonth = (expenses) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const result = months.map((label) => ({
    label,
    total: 0,
    needs: 0,
    wants: 0,
    investments: 0,
  }));

  expenses.forEach((expense) => {
    const monthIndex = new Date(expense.date).getMonth();
    result[monthIndex].total += expense.amount;
    result[monthIndex][expense.budgetType] += expense.amount;
  });

  return result;
};

// Groups expenses by hour (for daily view)
const groupByHour = (expenses) => {
  const result = Array.from({ length: 24 }, (_, i) => ({
    label: `${i}:00`,
    total: 0,
    needs: 0,
    wants: 0,
    investments: 0,
  }));

  expenses.forEach((expense) => {
    const hour = new Date(expense.date).getHours();
    result[hour].total += expense.amount;
    result[hour][expense.budgetType] += expense.amount;
  });

  // Filter out empty hours for cleaner response
  return result.filter((h) => h.total > 0);
};

// ─── Category Breakdown Helper ────────────────────────────────────────────────

const getCategoryBreakdown = (expenses, total) => {
  const categoryMap = {};

  expenses.forEach((expense) => {
    const name = expense.category?.name || "Uncategorized";
    if (!categoryMap[name]) {
      categoryMap[name] = { category: name, total: 0 };
    }
    categoryMap[name].total += expense.amount;
  });

  return Object.values(categoryMap)
    .map((item) => ({
      ...item,
      percentage: total > 0 ? parseFloat(((item.total / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);
};

// ─── Main Controller ──────────────────────────────────────────────────────────

export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { view } = req.query;

    if (!view) {
      return res.status(400).json({ message: "view is required" });
    }

    // Get date range for the requested view
    const range = getDateRange(view, req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const { start, end } = range;

    // Fetch all expenses in the date range for this user
    const expenses = await Expense.find({
      userId,
      date: { $gte: start, $lte: end },
    })
      .populate("category", "name")
      .sort({ date: -1 });

    // ── Summary ──────────────────────────────────────────────────────────────
    const summary = {
      total: 0,
      needs: 0,
      wants: 0,
      investments: 0,
      transactionCount: expenses.length,
    };

    expenses.forEach((expense) => {
      summary.total += expense.amount;
      summary[expense.budgetType] += expense.amount;
    });

    // Round all summary values
    summary.total = parseFloat(summary.total.toFixed(2));
    BUDGET_TYPES.forEach((type) => {
      summary[type] = parseFloat(summary[type].toFixed(2));
    });

    // ── Chart Data ────────────────────────────────────────────────────────────
    let chartData;
    switch (view) {
      case "daily": chartData = groupByHour(expenses); break;
      case "weekly": chartData = groupByDay(expenses, start, end); break;
      case "monthly": chartData = groupByWeek(expenses, start); break;
      case "yearly": chartData = groupByMonth(expenses); break;
    }

    // ── Category Breakdown ────────────────────────────────────────────────────
    const categoryBreakdown = getCategoryBreakdown(expenses, summary.total);

    // ── Period Label ──────────────────────────────────────────────────────────
    const period = {
      view,
      ...getPeriodLabel(view, start, end, req.query),
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };

    // ── Serialize expenses for response ───────────────────────────────────────
    const serializedExpenses = expenses.map((expense) => {
      const obj = expense.toObject();
      return {
        ...obj,
        category: expense.category?.name || "",
        categoryId: expense.category?._id?.toString() || "",
      };
    });

    res.status(200).json({
      period,
      summary,
      chartData,
      categoryBreakdown,
      expenses: serializedExpenses,
    });
  } catch (err) {
    console.error("Error fetching analytics: ", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
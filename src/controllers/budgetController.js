import User from "../models/User.js";
import MonthlyBudget from "../models/MonthlyBudget.js";

// Helper to compute status for a single bucket
const computeBucketStatus = (budget, spent) => {
  if (budget === null) return null;
  const remaining = budget - spent;
  const percentageUsed = Number.parseFloat(((spent / budget) * 100).toFixed(1));
  return { budget, spent, remaining, percentageUsed };
};

// PUT /api/budget
export const setBudget = async (req, res) => {
  try {
    const { needs, wants, investments } = req.body;
    const userId = req.user.id;

    // At least one bucket must be provided
    if (needs === undefined && wants === undefined && investments === undefined) {
      return res.status(400).json({ message: "At least one budget field is required" });
    }

    // Validate each bucket that was provided
    if (needs !== undefined && needs < 1) {
      return res.status(400).json({ message: "Needs budget must be at least 1" });
    }
    if (wants !== undefined && wants < 1) {
      return res.status(400).json({ message: "Wants budget must be at least 1" });
    }
    if (investments !== undefined && investments < 1) {
      return res.status(400).json({ message: "Investments budget must be at least 1" });
    }

    // Build update object dynamically — only update buckets that were sent
    const updateFields = {};
    if (needs !== undefined) updateFields["monthlyBudget.needs"] = needs;
    if (wants !== undefined) updateFields["monthlyBudget.wants"] = wants;
    if (investments !== undefined) updateFields["monthlyBudget.investments"] = investments;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Budget updated successfully",
      monthlyBudget: updatedUser.monthlyBudget
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error setting budget: ", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/budget/status
export const getBudgetStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const user = await User.findById(userId);
    const { monthlyBudget } = user;

    // No budget set at all
    if (!monthlyBudget || (monthlyBudget.needs === null && monthlyBudget.wants === null && monthlyBudget.investments === null)) {
      return res.status(200).json({ message: "No budget set" });
    }

    // Fetch this month's summary — may not exist yet if no expenses this month
    const summary = await MonthlyBudget.findOne({ userId, month, year });
    const spent = {
      needs: summary?.spent?.needs || 0,
      wants: summary?.spent?.wants || 0,
      investments: summary?.spent?.investments || 0,
    };

    res.status(200).json({
      month,
      year,
      needs: computeBucketStatus(monthlyBudget.needs, spent.needs),
      wants: computeBucketStatus(monthlyBudget.wants, spent.wants),
      investments: computeBucketStatus(monthlyBudget.investments, spent.investments),
    });
  } catch (err) {
    console.error("Error fetching budget status: ", err);
    res.status(500).json({ message: "Server error" });
  }
};
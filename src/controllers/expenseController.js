import Expense from "../models/Expense.js";
import RecurringCharge from "../models/RecurringCharge.js";
import Category from "../models/Category.js";
import MonthlySummary from "../models/MonthlyBudget.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import BUDGET_TYPES from '../utils/budgetTypes.js';

// Helper functions

const resolveCategory = async (userId, categoryInput) => { 
  if (!categoryInput) return null;

  const value = String(categoryInput).trim();
  if (!value) return null;

  if (mongoose.isValidObjectId(value)) {
    const byId = await Category.findOne({ _id: value, userId });
    if (byId) return byId;
  }

  const byName = await Category.findOne({ userId, name: value });
  if (byName) return byName;

  return null;
};

const serializeWithCategory = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const populatedCategory =
    obj?.category && typeof obj.category === "object" ? obj.category : null;
  return {
    ...obj,
    category: populatedCategory?.name || "",
    categoryId: populatedCategory?._id?.toString?.() || obj.category?.toString?.() || "",
  };
};

const validateEditRecurringChargeInput = (amount, startDate) => {
  if (amount !== undefined && amount < 1) {
    return "Amount must be at least 1";
  }
  if (startDate !== undefined) {
    const inputStart = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(inputStart.getTime())) {
      return "Invalid start date";
    }
    if (inputStart < today) {
      return "Start date can't be less than today";
    }
  }
  return null;
};

const validateUpdateExpenseInput = (name, amount, category, budgetType) => {
  if (name !== undefined && !name) return "Name cannot be empty";
  if (amount !== undefined && amount < 1) return "Amount must be at least 1";
  if (category !== undefined && !category) return "Category cannot be empty";
  if (budgetType !== undefined && !BUDGET_TYPES.includes(budgetType)) {
    return "Invalid budget type";
  }
  return null;
};

const prepareExpenseUpdateFields = async (userId, updateData) => {
  const updateFields = {};
  const { name, amount, description, category, date, budgetType } = updateData;

  if (name !== undefined) updateFields.name = name;
  if (amount !== undefined) updateFields.amount = amount;
  if (description !== undefined) updateFields.description = description;
  if (date !== undefined) updateFields.date = date;
  if (budgetType !== undefined) updateFields.budgetType = budgetType;

  if (category !== undefined) {
    const resolvedCategory = await resolveCategory(userId, category);
    if (!resolvedCategory) {
      return { error: "Invalid category" };
    }
    updateFields.category = resolvedCategory._id;
    // budgetType is no longer inherited from category
    // only update it if explicitly provided in request
  }

  return updateFields;
};

const handleMonthlySummaryUpdate = async (
  userId,
  oldExpense,
  newBudgetType,
  newAmount,
  newDate = oldExpense.date,
) => {
  const oldExpenseDate = new Date(oldExpense.date);
  const newExpenseDate = new Date(newDate);
  const staysInSameMonth =
    oldExpenseDate.getMonth() === newExpenseDate.getMonth() &&
    oldExpenseDate.getFullYear() === newExpenseDate.getFullYear();

  if (staysInSameMonth && newBudgetType === oldExpense.budgetType) {
    const diff = newAmount - oldExpense.amount;
    if (diff !== 0) {
      await updateMonthlySummary(userId, oldExpense.date, diff, oldExpense.budgetType);
    }
  } else if (staysInSameMonth) {
    await updateMonthlySummary(userId, oldExpense.date, -oldExpense.amount, oldExpense.budgetType);
    await updateMonthlySummary(userId, newDate, newAmount, newBudgetType);
  } else {
    // Moving an expense to another month requires removing the old contribution and adding the new one.
    await updateMonthlySummary(userId, oldExpense.date, -oldExpense.amount, oldExpense.budgetType);
    await updateMonthlySummary(userId, newDate, newAmount, newBudgetType);
  }
};

const updateMonthlySummary = async (userId, date, amountDelta, budgetType) => {
  const expenseDate = new Date(date);
  const month = expenseDate.getMonth() + 1;
  const year = expenseDate.getFullYear();

  const user = await User.findById(userId);

  await MonthlySummary.findOneAndUpdate(
    { userId, month, year },
    {
      $inc: { [`spent.${budgetType}`]: amountDelta },
      $setOnInsert: {
        budget: {
          needs: user.monthlyBudget?.needs || null,
          wants: user.monthlyBudget?.wants || null,
          investments: user.monthlyBudget?.investments || null,
        }
      }
    },
    { upsert: true }
  );
};

// For editRecurringCharge - build update fields object based on provided input, with validation and category resolution
const buildRecurringChargeUpdateFields = async (userId, fields) => {
  const { amount, description, frequency, interval, startDate, endDate, budgetType, category } = fields;
  const updateFields = {};

  if (amount !== undefined) updateFields.amount = amount;
  if (description !== undefined) updateFields.description = description;
  if (frequency !== undefined) updateFields.frequency = frequency;
  if (interval !== undefined) updateFields.interval = interval;
  if (startDate !== undefined) updateFields.startDate = startDate;
  if (endDate !== undefined) updateFields.endDate = endDate || null;
  if (budgetType !== undefined) updateFields.budgetType = budgetType;

  if (category !== undefined) {
    const resolvedCategory = await resolveCategory(userId, category);
    if (!resolvedCategory) return { error: "Invalid category" };
    updateFields.category = resolvedCategory._id;
  }

  return updateFields;
};

const buildDateFilter = (startDate, endDate) => {
  const dateFilter = {};

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.getTime())) return { error: "Invalid startDate" };
    parsedStart.setHours(0, 0, 0, 0);
    dateFilter.$gte = parsedStart;
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedEnd.getTime())) return { error: "Invalid endDate" };
    parsedEnd.setHours(23, 59, 59, 999);
    dateFilter.$lte = parsedEnd;
  }

  return dateFilter;
};

const prepareExpenseInput = async (userId, input) => {
  const {
    name,
    amount,
    description,
    category,
    date,
    budgetType,
  } = input || {};
  const normalizedBudgetType = budgetType || "wants";

  if (!name || !amount || !category || !date) {
    return { error: "Missing required fields" };
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 1) {
    return { error: "Amount must be at least 1" };
  }

  if (!BUDGET_TYPES.includes(normalizedBudgetType)) {
    return { error: "Invalid budget type" };
  }

  if (Number.isNaN(new Date(date).getTime())) {
    return { error: "Invalid date" };
  }

  const resolvedCategory = await resolveCategory(userId, category);
  if (!resolvedCategory) {
    return { error: "Invalid category" };
  }

  return {
    document: {
      name,
      amount: normalizedAmount,
      description: description || "",
      category: resolvedCategory._id,
      budgetType: normalizedBudgetType,
      date,
      userId,
    },
  };
};

// Controller functions

export const createExpense = async (req, res) => {
  try {
    const userId = req.user.id;

    if (Array.isArray(req.body?.expenses)) {
      const preparedItems = await Promise.all(
        req.body.expenses.map((input) => prepareExpenseInput(userId, input)),
      );
      const failed = [];
      const validItems = [];

      preparedItems.forEach((item, index) => {
        if (item.error) {
          failed.push({ index, reason: item.error });
        } else {
          validItems.push(item.document);
        }
      });

      if (validItems.length === 0) {
        return res.status(201).json({ created: [], failed });
      }

      const insertedExpenses = await Expense.insertMany(validItems);
      await Promise.all(
        insertedExpenses.map((expense) =>
          updateMonthlySummary(
            userId,
            expense.date,
            expense.amount,
            expense.budgetType,
          ),
        ),
      );

      const populatedExpenses = await Expense.find({
        _id: { $in: insertedExpenses.map((expense) => expense._id) },
        userId,
      }).populate("category", "name");
      const populatedById = new Map(
        populatedExpenses.map((expense) => [expense._id.toString(), expense]),
      );

      return res.status(201).json({
        created: insertedExpenses.map((expense) =>
          serializeWithCategory(populatedById.get(expense._id.toString()) || expense),
        ),
        failed,
      });
    }

    const prepared = await prepareExpenseInput(userId, req.body);
    if (prepared.error) {
      return res.status(400).json({ message: prepared.error });
    }

    const newExpense = new Expense(prepared.document);
    await newExpense.save();

    await updateMonthlySummary(
      userId,
      newExpense.date,
      newExpense.amount,
      newExpense.budgetType,
    );

    res.status(201).json({ message: "Expense created successfully" });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error creating expense: ", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const createRecurringCharge = async (req, res) => {
  try {
    const { name, amount, description, category, frequency, interval, startDate, endDate, budgetType } = req.body;
    const userId = req.user.id;
    const normalizedBudgetType = budgetType || "wants";

    if (!name || !amount || !category || !frequency || !startDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (amount < 1) {
      return res.status(400).json({ message: "Amount must be at least 1" });
    }

    if (!BUDGET_TYPES.includes(normalizedBudgetType)) {
      return res.status(400).json({ message: "Invalid budget type" });
    }

    const resolvedCategory = await resolveCategory(userId, category);
    if (!resolvedCategory) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const parsedStartDate = new Date(startDate);

    const newRecurringCharge = new RecurringCharge({
      name,
      amount,
      description: description || "",
      category: resolvedCategory._id,
      budgetType: normalizedBudgetType, // from request body, not category
      userId,
      frequency,
      interval: interval || 1,
      startDate,
      nextOccurrence: parsedStartDate,
      endDate,
    });
    const savedRecurringCharge = await newRecurringCharge.save();

    await Expense.findOneAndUpdate(
      {
        recurringCharge: savedRecurringCharge._id,
        occurrenceDate: parsedStartDate,
      },
      {
        $setOnInsert: {
          userId,
          name,
          amount,
          category: resolvedCategory._id,
          budgetType: normalizedBudgetType, // from request body, not category
          description: description || "",
          date: parsedStartDate,
          recurringCharge: savedRecurringCharge._id,
          occurrenceDate: parsedStartDate,
        },
      },
      { upsert: true },
    );

    await updateMonthlySummary(userId, parsedStartDate, amount, normalizedBudgetType);

    res.status(201).json({
      message: "Recurring charge created successfully",
      recurringCharge: serializeWithCategory(
        await RecurringCharge.findById(savedRecurringCharge._id).populate("category", "name")
      ),
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error creating recurring charge: ", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const stopRecurringCharge = async (req, res) => {
  try {
    const { id: recurringChargeId } = req.params;
    const userId = req.user.id;

    if (!recurringChargeId) {
      return res.status(400).json({ message: "Missing recurringChargeId" });
    }

    const charge = await RecurringCharge.findOneAndUpdate(
      { _id: recurringChargeId, userId },
      { isActive: false },
      { new: true },
    );

    if (!charge) {
      return res.status(404).json({ message: "Recurring charge not found" });
    }

    return res.status(200).json({ message: "Stopped charge successfully" });
  } catch (err) {
    console.error("Error stopping recurring charge: ", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getRecurringCharges = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const recurringCharges = await RecurringCharge.find({
      userId,
      isActive: true,
      $or: [{ endDate: null }, { endDate: { $gte: today } }],
    })
      .populate("category", "name")
      .sort({ startDate: 1 });

    res.status(200).json(recurringCharges.map(serializeWithCategory));
  } catch (err) {
    console.error("Error showing recurring charges: ", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};



export const editRecurringCharge = async (req, res) => {
  try {
    const { recurringChargeId, amount, description, frequency, interval, startDate, endDate, category, budgetType } = req.body;
    const userId = req.user.id;

    if (!recurringChargeId) {
      return res.status(400).json({ message: "Missing recurringChargeId" });
    }

    const validationError = validateEditRecurringChargeInput(amount, startDate);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (budgetType !== undefined && !BUDGET_TYPES.includes(budgetType)) {
      return res.status(400).json({ message: "Invalid budget type" });
    }

    const updateFields = await buildRecurringChargeUpdateFields(userId, {
      amount, description, frequency, interval, startDate, endDate, budgetType, category
    });

    if (updateFields.error) {
      return res.status(400).json({ message: updateFields.error });
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const updatedCharge = await RecurringCharge.findOneAndUpdate(
      { _id: recurringChargeId, userId },
      updateFields,
      { new: true }
    );

    if (!updatedCharge) {
      return res.status(404).json({ message: "Recurring charge not found or unauthorized" });
    }

    res.status(200).json({ message: "Recurring charge updated successfully" });
  } catch (err) {
    console.error("Error editing recurring charge: ", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query; // Optional date filters

    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter.error) {
      return res.status(400).json({ message: dateFilter.error });
    }

    const query = { userId };
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }

    const expenses = await Expense.find(query)
      .populate("category", "name")
      .sort({ date: -1 });

    res.status(200).json(expenses.map(serializeWithCategory));
  } catch (err) {
    console.error("Error fetching expenses: ", err);
    res.status(500).json({ message: "Error fetching expenses" });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expense = await Expense.findOne({
      _id: expenseId,
      userId: req.user.id,
    }).populate("category", "name");

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.status(200).json(serializeWithCategory(expense));
  } catch (err) {
    console.error("Error fetching expense: ", err);
    res.status(500).json({ message: "Error fetching expense" });
  }
};

export const getExpensesByCategory = async (req, res) => {
  try {
    const cat = req.params.category;
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const resolvedCategory = await resolveCategory(userId, cat);
    if (!resolvedCategory) {
      return res.status(404).json({ message: `Category not found: ${cat}` });
    }

    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter.error) {
      return res.status(400).json({ message: dateFilter.error });
    }

    const query = {
      userId,
      category: resolvedCategory._id,
    };
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }

    const expenses = await Expense.find(query)
      .populate("category", "name")
      .sort({ date: -1 });

    res.status(200).json(expenses.map(serializeWithCategory));
  } catch (err) {
    console.error("Error fetching expenses by category: ", err);
    res.status(500).json({ message: "Error fetching expenses by category" });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { name, amount, description, category, date, budgetType } = req.body;
    const userId = req.user.id;

    const validationError = validateUpdateExpenseInput(name, amount, category, budgetType);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const oldExpense = await Expense.findOne({ _id: expenseId, userId });
    if (!oldExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const updateFields = await prepareExpenseUpdateFields(userId, {
      name,
      amount,
      description,
      category,
      date,
      budgetType,
    });

    if (updateFields.error) {
      return res.status(400).json({ message: updateFields.error });
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    await Expense.findOneAndUpdate(
      { _id: expenseId, userId },
      updateFields,
      { new: true, runValidators: true }
    );

    const newBudgetType = updateFields.budgetType || oldExpense.budgetType;
    const newAmount = amount ?? oldExpense.amount;
    const newDate = updateFields.date || oldExpense.date;

    if (
      amount !== undefined ||
      updateFields.budgetType !== undefined ||
      updateFields.date !== undefined
    ) {
      await handleMonthlySummaryUpdate(
        userId,
        oldExpense,
        newBudgetType,
        newAmount,
        newDate,
      );
    }

    res.status(200).json({ message: "Expense updated successfully" });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error updating expense: ", err);
    res.status(500).json({ message: "Error updating expense" });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expense = await Expense.findOneAndDelete({
      _id: expenseId,
      userId: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await updateMonthlySummary(req.user.id, expense.date, -expense.amount, expense.budgetType);

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense: ", err);
    res.status(500).json({ message: "Error deleting expense" });
  }
};

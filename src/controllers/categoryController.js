import Category from "../models/Category.js";
import Expense from "../models/Expense.js";
import RecurringCharge from "../models/RecurringCharge.js";

export const getCategories = async (req, res) => {
  try {
    const userId = req.user.id;
    const categories = await Category.find({ userId }).sort({ name: 1 });
    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories: ", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const userId = req.user.id;
    const name = String(req.body?.name || "").trim();
    const budgetType = req.body?.budgetType;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    if (!budgetType) {
      return res.status(400).json({ message: "Budget type is required" });
    }

    const existing = await Category.findOne({ userId, name });
    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await Category.create({ userId, name, budgetType: budgetType });
    res.status(201).json({ message: "Category created successfully", category });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: "Category already exists" });
    }
    console.error("Error creating category: ", err);
    res.status(500).json({ message: "Error creating category" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const userId = req.user.id;
    const categoryId = req.params.id;

    const inExpenses = await Expense.exists({ userId, category: categoryId });
    const inRecurring = await RecurringCharge.exists({ userId, category: categoryId });
    if (inExpenses || inRecurring) {
      return res.status(400).json({
        message: "Category is in use and cannot be deleted",
      });
    }

    const deleted = await Category.findOneAndDelete({ _id: categoryId, userId });
    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category: ", err);
    res.status(500).json({ message: "Error deleting category" });
  }
};


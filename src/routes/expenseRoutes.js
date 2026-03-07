import express from "express";
import { createExpense, createRecurringCharge, getRecurringCharges, stopRecurringCharge, editRecurringCharge, getExpenses, getExpenseById, updateExpense, deleteExpense, getExpensesByCategory } from "../controllers/expenseController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected
router.post("/", authenticateToken, createExpense);
router.post("/recurringCharge", authenticateToken, createRecurringCharge);
router.delete("/recurringCharges/:id", authenticateToken, stopRecurringCharge);
router.get("/recurringCharges", authenticateToken, getRecurringCharges);
router.post("/editRecurringCharge", authenticateToken, editRecurringCharge);
router.get("/", authenticateToken, getExpenses);
router.get("/category/:category", authenticateToken, getExpensesByCategory); //For filtering by category.
router.get("/:id", authenticateToken, getExpenseById); //For detailed expense view.
router.put("/:id", authenticateToken, updateExpense); 
router.delete("/:id", authenticateToken, deleteExpense);

export default router;

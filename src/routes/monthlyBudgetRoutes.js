import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { setBudget, getBudgetStatus } from "../controllers/budgetController.js";

const router = express.Router();

router.put("/", authenticateToken, setBudget);
router.get("/status", authenticateToken, getBudgetStatus);

export default router;
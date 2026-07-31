import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { parseExpenseText } from "../controllers/aiController.js";

const router = express.Router();

router.post("/parse-expenses", authenticateToken, parseExpenseText);

export default router;
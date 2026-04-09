import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getAnalytics } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/", authenticateToken, getAnalytics);

export default router;

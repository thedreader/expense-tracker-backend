import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  createCategory,
  deleteCategory,
  getCategories,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", authenticateToken, getCategories);
router.post("/", authenticateToken, createCategory);
router.delete("/:id", authenticateToken, deleteCategory);

export default router;


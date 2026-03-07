import mongoose from "mongoose";
import BUDGET_TYPES from '../../utils/budgetTypes.js';

const expenseBaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    budgetType: {
      type: String,
      enum: BUDGET_TYPES,
      required: true
    }
  },
  { _id: false },
);

export default expenseBaseSchema;

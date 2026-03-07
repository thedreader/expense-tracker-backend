import mongoose from "mongoose";
import expenseBaseSchema from "./base/expenseBase.schema.js";

const recurringChargeSchema = new mongoose.Schema({
   ...expenseBaseSchema.obj,
   frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
   },

   interval: {
      type: Number,
      default: 1,
   },

   startDate: {
      type: Date,
      required: true,
   },

   nextOccurrence: {
      type: Date,
      required: true,
   },

   endDate: {
      type: Date,
      default: null,
   },

   isActive: {
      type: Boolean,
      default: true,
   },
});

recurringChargeSchema.index({
  nextOccurrence: 1,
  isActive: 1
});

const RecurringCharge = mongoose.model("RecurringCharge", recurringChargeSchema);

export default RecurringCharge;
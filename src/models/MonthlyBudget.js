import mongoose from 'mongoose';

const spentSchema = {
  needs: { type: Number, default: 0 },
  wants: { type: Number, default: 0 },
  investments: { type: Number, default: 0 }
};

const monthlyBudgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  spent: spentSchema
}, { timestamps: true });

monthlyBudgetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const MonthlyBudget = mongoose.model('MonthlyBudget', monthlyBudgetSchema);
export default MonthlyBudget;
import mongoose from 'mongoose';
import expenseBaseSchema from './base/expenseBase.schema.js';

const expenseSchema= new mongoose.Schema({
   ...expenseBaseSchema.obj,
   date : { type: Date, required: true},
   recurringCharge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringCharge'
   },
   occurrenceDate: { type: Date }
}, { timestamps: true })

expenseSchema.index(
  { recurringCharge: 1, occurrenceDate: 1 },
  { unique: true, sparse: true  }
);

expenseSchema.index({ userId: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema)

export default Expense;
import mongoose from 'mongoose';
import BUDGET_TYPES from '../utils/budgetTypes.js';

const categorySchema= new mongoose.Schema({
   userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
   name : { type: String, required: true, trim: true, minlength: 1, maxlength: 60},
   budgetType: { type: String, enum: BUDGET_TYPES, required: true },
}, { timestamps: true })

categorySchema.index(
  { userId: 1, name: 1 },
  { unique: true }
);

const category= mongoose.model('Category', categorySchema)

export default category;

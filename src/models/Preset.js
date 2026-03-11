import mongoose from 'mongoose';
import expenseBaseSchema from './base/expenseBase.schema.js';

const presetSchema= new mongoose.Schema({
    ...expenseBaseSchema.obj,
    date : { type: Date, required: true},
    usageCount: {type: Number, default: 0},
}, { timestamps: true });

presetSchema.index({userId: 1, name: 1}, {unique: true})

presetSchema.index({userId: 1, usageCount: -1})

const Preset= mongoose.model('Preset', userSchema)

export default Preset;
import mongoose from 'mongoose';

const budgetAllocationSchema = {
  needs: { type: Number, default: null, min: [1, "Needs budget must be at least 1"] },
  wants: { type: Number, default: null, min: [1, "Wants budget must be at least 1"] },
  investments: { type: Number, default: null, min: [1, "Investments budget must be at least 1"] }
};

const userSchema= new mongoose.Schema({
   name : { type: String, required: true},
   email : { type: String, required: true, unique: true},
   password : { type: String, required: true},
   monthlyBudget : budgetAllocationSchema,
   refreshToken : { type: String},
})

const User= mongoose.model('User', userSchema)

export default User;
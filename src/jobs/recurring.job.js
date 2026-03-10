import cron from "node-cron";
import RecurringCharge from "../models/RecurringCharge.js";
import Expense from "../models/Expense.js";
import MonthlyBudget from "../models/MonthlyBudget.js";
import User from "../models/User.js";

export const updateMonthlyBudget = async (userId, date, amount, budgetType) => {
  const expenseDate = new Date(date);
  const month = expenseDate.getMonth() + 1;
  const year = expenseDate.getFullYear();

  const user = await User.findById(userId);

  await MonthlyBudget.findOneAndUpdate(
    { userId, month, year },
    {
      $inc: { [`spent.${budgetType}`]: amount },
      $setOnInsert: {
        budget: {
          needs: user.monthlyBudget?.needs || null,
          wants: user.monthlyBudget?.wants || null,
          investments: user.monthlyBudget?.investments || null,
        },
      },
    },
    { upsert: true },
  );
};

export const processCharge = async (charge, now) => {
  // Deactivate charges whose endDate has passed
  if (charge.endDate && charge.endDate < now) {
    charge.isActive = false;
    return charge.save();
  }

  const result = await Expense.findOneAndUpdate(
    {
      recurringCharge: charge._id,
      occurrenceDate: charge.nextOccurrence,
    },
    {
      $setOnInsert: {
        userId: charge.userId,
        name: charge.name,
        amount: charge.amount,
        category: charge.category,
        budgetType: charge.budgetType,
        description: charge.description,
        date: charge.nextOccurrence,
        recurringCharge: charge._id,
        occurrenceDate: charge.nextOccurrence,
      },
    },
    { upsert: true },
  );

  // Only update the budget when a new expense was actually inserted (not a duplicate)
  if (result === null) {
    await updateMonthlyBudget(
      charge.userId,
      charge.nextOccurrence,
      charge.amount,
      charge.budgetType,
    );
  }

  const next = new Date(charge.nextOccurrence);

  switch (charge.frequency) {
    case "daily":
      next.setDate(next.getDate() + charge.interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * charge.interval);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + charge.interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + charge.interval);
      break;
  }

  // Deactivate if the next occurrence would fall after endDate
  if (charge.endDate && next > charge.endDate) {
    charge.isActive = false;
  }

  charge.nextOccurrence = next;
  console.log(charge.name);
  return charge.save();
};

//0 0 * * * => every day at midnight
//*/1 * * * * => every minute (for testing)
const recurringTask = cron.schedule("0 0 * * *", async () => {
  console.log("running this cron now");

  try {
    const now = new Date();

    const dueCharges = await RecurringCharge.find({
      nextOccurrence: { $lte: now },
      isActive: true,
    });

    await Promise.all(dueCharges.map((charge) => processCharge(charge, now)));
  } catch (err) {
    console.error("Recurring Cron Error:", err);
  }
});

recurringTask.start();

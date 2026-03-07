import cron from "node-cron";
import RecurringCharge from "../models/RecurringCharge.js";
import Expense from "../models/Expense.js";

//0 0 * * * => every day at midnight
//*/1 * * * * => every minute (for testing)
const recurringTask = cron.schedule("*/2 * * * *", async () => {
  console.log("running this cron now");
  
  try {
    const now = new Date();

    const dueCharges = await RecurringCharge.find({
      nextOccurrence: { $lte: now },
      isActive: true,
    });

    const promises = dueCharges.map(async (charge) => {
      await Expense.findOneAndUpdate(
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
            description: charge.description,
            date: charge.nextOccurrence,
            recurringCharge: charge._id,
            occurrenceDate: charge.nextOccurrence,
          },
        },
        { upsert: true },
      );

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

      charge.nextOccurrence = next;
      console.log(charge.name);
      return charge.save();
    });

    await Promise.all(promises);
  } catch (err) {
    console.error("Recurring Cron Error:", err);
  }
});

recurringTask.start();

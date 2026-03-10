import { jest } from "@jest/globals";

// Mock all DB models before importing the module under test
jest.unstable_mockModule("../../models/RecurringCharge.js", () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule("../../models/Expense.js", () => ({
  default: { findOneAndUpdate: jest.fn() },
}));

jest.unstable_mockModule("../../models/MonthlyBudget.js", () => ({
  default: { findOneAndUpdate: jest.fn() },
}));

jest.unstable_mockModule("../../models/User.js", () => ({
  default: { findById: jest.fn() },
}));

// node-cron must be mocked so the schedule doesn't actually run
jest.unstable_mockModule("node-cron", () => ({
  default: { schedule: jest.fn(() => ({ start: jest.fn() })) },
}));

const { processCharge, updateMonthlyBudget } = await import(
  "../recurring.job.js"
);
const { default: Expense } = await import("../../models/Expense.js");
const { default: MonthlyBudget } = await import(
  "../../models/MonthlyBudget.js"
);
const { default: User } = await import("../../models/User.js");

// Helper to build a minimal charge object
const makeCharge = (overrides = {}) => {
  const base = {
    _id: "charge-1",
    userId: "user-1",
    name: "Netflix",
    amount: 15,
    category: "cat-1",
    budgetType: "wants",
    description: "",
    frequency: "monthly",
    interval: 1,
    nextOccurrence: new Date("2024-03-01"),
    endDate: null,
    isActive: true,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides };
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({
    monthlyBudget: { needs: 1000, wants: 500, investments: 200 },
  });
  MonthlyBudget.findOneAndUpdate.mockResolvedValue(undefined);
});

describe("processCharge", () => {
  const now = new Date("2024-03-01T12:00:00Z");

  test("deactivates charge when endDate is in the past", async () => {
    const charge = makeCharge({
      endDate: new Date("2024-02-28"),
    });

    await processCharge(charge, now);

    expect(charge.isActive).toBe(false);
    expect(charge.save).toHaveBeenCalledTimes(1);
    expect(Expense.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("creates expense and updates monthly budget on new occurrence", async () => {
    // findOneAndUpdate returns null when a new document is inserted via upsert
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge();

    await processCharge(charge, now);

    expect(Expense.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(MonthlyBudget.findOneAndUpdate).toHaveBeenCalledTimes(1);

    const budgetCall = MonthlyBudget.findOneAndUpdate.mock.calls[0];
    expect(budgetCall[1].$inc["spent.wants"]).toBe(15);
  });

  test("skips budget update when expense already exists (duplicate upsert)", async () => {
    // findOneAndUpdate returns the existing document when no insert happened
    Expense.findOneAndUpdate.mockResolvedValue({ _id: "existing" });
    const charge = makeCharge();

    await processCharge(charge, now);

    expect(Expense.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(MonthlyBudget.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("advances nextOccurrence by one month for monthly frequency", async () => {
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge({ nextOccurrence: new Date("2024-03-01") });

    await processCharge(charge, now);

    expect(charge.nextOccurrence.getMonth()).toBe(3); // April (0-indexed)
    expect(charge.nextOccurrence.getFullYear()).toBe(2024);
  });

  test("advances nextOccurrence by interval days for daily frequency", async () => {
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge({
      frequency: "daily",
      interval: 3,
      nextOccurrence: new Date("2024-03-01"),
    });

    await processCharge(charge, now);

    expect(charge.nextOccurrence.getDate()).toBe(4); // March 4
  });

  test("advances nextOccurrence by 7*interval days for weekly frequency", async () => {
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge({
      frequency: "weekly",
      interval: 2,
      nextOccurrence: new Date("2024-03-01"),
    });

    await processCharge(charge, now);

    // 2024-03-01 + 14 days = 2024-03-15
    expect(charge.nextOccurrence.getDate()).toBe(15);
  });

  test("advances nextOccurrence by interval years for yearly frequency", async () => {
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge({
      frequency: "yearly",
      interval: 1,
      nextOccurrence: new Date("2024-03-01"),
    });

    await processCharge(charge, now);

    expect(charge.nextOccurrence.getFullYear()).toBe(2025);
  });

  test("deactivates charge when next occurrence falls after endDate", async () => {
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge({
      nextOccurrence: new Date("2024-03-01"),
      endDate: new Date("2024-03-15"), // next occurrence (April 1) > endDate
    });

    await processCharge(charge, now);

    expect(charge.isActive).toBe(false);
    expect(charge.save).toHaveBeenCalledTimes(1);
  });

  test("keeps charge active when next occurrence is before endDate", async () => {
    Expense.findOneAndUpdate.mockResolvedValue(null);
    const charge = makeCharge({
      nextOccurrence: new Date("2024-03-01"),
      endDate: new Date("2025-01-01"), // well after next occurrence
    });

    await processCharge(charge, now);

    expect(charge.isActive).toBe(true);
  });
});

describe("updateMonthlyBudget", () => {
  test("increments the correct budget bucket", async () => {
    await updateMonthlyBudget("user-1", new Date("2024-03-15"), 50, "needs");

    expect(MonthlyBudget.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", month: 3, year: 2024 },
      expect.objectContaining({
        $inc: { "spent.needs": 50 },
      }),
      { upsert: true },
    );
  });

  test("seeds budget snapshot from user settings on first insert", async () => {
    User.findById.mockResolvedValue({
      monthlyBudget: { needs: 800, wants: 300, investments: 100 },
    });

    await updateMonthlyBudget("user-1", new Date("2024-03-15"), 20, "wants");

    const call = MonthlyBudget.findOneAndUpdate.mock.calls[0];
    expect(call[1].$setOnInsert.budget).toEqual({
      needs: 800,
      wants: 300,
      investments: 100,
    });
  });
});

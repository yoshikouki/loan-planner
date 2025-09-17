import { describe, expect, it } from "vitest";
import { calculateLoan, type LoanInputs, monthsToYearsMonths, summarizeLoan } from "./loan";

describe("calculateLoan", () => {
  it("computes amortization snapshot with extra payments", () => {
    const inputs: LoanInputs = {
      purchasePrice: 42000000,
      downPayment: 8400000,
      annualInterestRate: 1.2,
      termYears: 35,
      extraMonthlyPayment: 10000,
    };

    const result = calculateLoan(inputs);

    expect(result.principal).toBe(33600000);
    expect(result.base.payoffMonths).toBe(35 * 12);
    expect(result.base.monthlyPayment).toBeGreaterThan(0);
    expect(result.base.totalPayment).toBeGreaterThan(result.principal);
    expect(result.base.schedule.length).toBe(result.base.payoffMonths);
    expect(result.base.schedule[0].balance).toBeLessThan(result.principal);
    expect(result.base.schedule[result.base.schedule.length - 1].balance).toBeCloseTo(0, 5);

    expect(result.accelerated).toBeDefined();
    const accelerated = result.accelerated;
    if (!accelerated) {
      return;
    }

    expect(accelerated.monthlyPaymentWithExtra).toBeCloseTo(
      result.base.monthlyPayment + inputs.extraMonthlyPayment,
      2,
    );
    expect(accelerated.payoffMonths).toBeLessThan(result.base.payoffMonths);
    expect(accelerated.interestSaved).toBeGreaterThan(0);
    expect(accelerated.schedule.length).toBe(accelerated.payoffMonths);
    expect(accelerated.schedule[accelerated.schedule.length - 1]?.balance).toBeCloseTo(0, 5);

    const summary = summarizeLoan(result);
    expect(summary.base.monthlyPayment).toBe(result.base.monthlyPayment);
    expect(summary.base.payoffMonths).toBe(result.base.payoffMonths);
    expect(summary.base).not.toHaveProperty("schedule");
  });

  it("handles zero interest without NaN", () => {
    const inputs: LoanInputs = {
      purchasePrice: 3000000,
      downPayment: 0,
      annualInterestRate: 0,
      termYears: 10,
      extraMonthlyPayment: 0,
    };

    const result = calculateLoan(inputs);

    expect(result.base.monthlyPayment).toBeCloseTo(25000, 2);
    expect(result.base.totalInterest).toBe(0);
    expect(result.base.totalPayment).toBeCloseTo(inputs.purchasePrice, 2);
    expect(result.base.schedule.length).toBe(result.base.payoffMonths);
    expect(result.base.schedule[0].interestPayment).toBe(0);
  });
});

describe("monthsToYearsMonths", () => {
  it("splits months into year/month pair", () => {
    expect(monthsToYearsMonths(15)).toEqual({ years: 1, months: 3 });
    expect(monthsToYearsMonths(0)).toEqual({ years: 0, months: 0 });
    expect(monthsToYearsMonths(Number.POSITIVE_INFINITY)).toEqual({ years: 0, months: 0 });
  });
});

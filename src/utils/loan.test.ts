import { describe, expect, it } from "vitest";
import { calculateLoan, type LoanInputs, monthsToYearsMonths } from "./loan";

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

    expect(result.accelerated).toBeDefined();
    expect(result.accelerated?.monthlyPaymentWithExtra).toBeCloseTo(
      result.base.monthlyPayment + inputs.extraMonthlyPayment,
      2,
    );
    expect(result.accelerated?.payoffMonths).toBeLessThan(result.base.payoffMonths);
    expect(result.accelerated?.interestSaved).toBeGreaterThan(0);
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
  });
});

describe("monthsToYearsMonths", () => {
  it("splits months into year/month pair", () => {
    expect(monthsToYearsMonths(15)).toEqual({ years: 1, months: 3 });
    expect(monthsToYearsMonths(0)).toEqual({ years: 0, months: 0 });
    expect(monthsToYearsMonths(Number.POSITIVE_INFINITY)).toEqual({ years: 0, months: 0 });
  });
});

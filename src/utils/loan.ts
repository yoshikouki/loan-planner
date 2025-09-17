export type CurrencyCode = "JPY" | "USD" | "EUR";

export interface LoanInputs {
  purchasePrice: number;
  downPayment: number;
  annualInterestRate: number;
  termYears: number;
  extraMonthlyPayment: number;
}

export interface AmortizationSnapshot {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  payoffMonths: number;
}

export interface AcceleratedAmortization extends AmortizationSnapshot {
  monthlyPaymentWithExtra: number;
  interestSaved: number;
  monthsSaved: number;
}

export interface LoanComputation {
  principal: number;
  downPaymentRatio: number;
  base: AmortizationSnapshot;
  accelerated?: AcceleratedAmortization;
}

interface AmortizationResult {
  payoffMonths: number;
  totalInterest: number;
  totalPayment: number;
}

const MAX_MONTHS = 1000 * 12;
const EPSILON = 1e-6;

function amortize(
  principal: number,
  monthlyRate: number,
  scheduledPayment: number,
  extraPayment: number,
): AmortizationResult {
  if (principal <= 0) {
    return {
      payoffMonths: 0,
      totalInterest: 0,
      totalPayment: 0,
    };
  }

  const payment = scheduledPayment + Math.max(0, extraPayment);
  if (payment <= 0) {
    return {
      payoffMonths: Number.POSITIVE_INFINITY,
      totalInterest: Number.POSITIVE_INFINITY,
      totalPayment: Number.POSITIVE_INFINITY,
    };
  }

  let balance = principal;
  let payoffMonths = 0;
  let totalInterest = 0;
  let totalPayment = 0;

  while (balance > EPSILON && payoffMonths < MAX_MONTHS) {
    const interest = monthlyRate > 0 ? balance * monthlyRate : 0;
    totalInterest += interest;

    let principalPayment = payment - interest;
    if (monthlyRate === 0) {
      principalPayment = payment;
    }

    if (principalPayment <= 0) {
      return {
        payoffMonths: Number.POSITIVE_INFINITY,
        totalInterest: Number.POSITIVE_INFINITY,
        totalPayment: Number.POSITIVE_INFINITY,
      };
    }

    if (principalPayment > balance) {
      principalPayment = balance;
    }

    const actualPayment = principalPayment + interest;
    totalPayment += actualPayment;
    balance -= principalPayment;
    payoffMonths += 1;
  }

  if (payoffMonths >= MAX_MONTHS) {
    return {
      payoffMonths: Number.POSITIVE_INFINITY,
      totalInterest: Number.POSITIVE_INFINITY,
      totalPayment: Number.POSITIVE_INFINITY,
    };
  }

  return {
    payoffMonths,
    totalInterest,
    totalPayment,
  };
}

export function calculateLoan(inputs: LoanInputs): LoanComputation {
  const purchasePrice = Math.max(0, inputs.purchasePrice);
  const downPayment = Math.min(Math.max(0, inputs.downPayment), purchasePrice);
  const termYears = Math.max(inputs.termYears, 0.1);

  const principal = Math.max(purchasePrice - downPayment, 0);
  const months = Math.max(Math.round(termYears * 12), 1);
  const monthlyRate = Math.max(inputs.annualInterestRate, 0) / 100 / 12;
  const extraPayment = Math.max(inputs.extraMonthlyPayment, 0);

  let scheduledPayment = 0;

  if (principal > 0) {
    if (monthlyRate === 0) {
      scheduledPayment = principal / months;
    } else {
      const rateFactor = (1 + monthlyRate) ** months;
      scheduledPayment = (principal * monthlyRate * rateFactor) / (rateFactor - 1);
    }
  }

  const baseSchedule = amortize(principal, monthlyRate, scheduledPayment, 0);

  let acceleratedSchedule: AmortizationResult | undefined;
  if (extraPayment > 0) {
    acceleratedSchedule = amortize(principal, monthlyRate, scheduledPayment, extraPayment);
  }

  const base: AmortizationSnapshot = {
    monthlyPayment: scheduledPayment,
    totalPayment: baseSchedule.totalPayment,
    totalInterest: baseSchedule.totalInterest,
    payoffMonths: baseSchedule.payoffMonths,
  };

  let accelerated: AcceleratedAmortization | undefined;

  if (acceleratedSchedule && Number.isFinite(acceleratedSchedule.payoffMonths)) {
    const monthlyPaymentWithExtra = scheduledPayment + extraPayment;
    const monthsSaved = Math.max(baseSchedule.payoffMonths - acceleratedSchedule.payoffMonths, 0);
    const interestSaved = Math.max(
      baseSchedule.totalInterest - acceleratedSchedule.totalInterest,
      0,
    );

    accelerated = {
      monthlyPayment: scheduledPayment,
      monthlyPaymentWithExtra,
      totalPayment: acceleratedSchedule.totalPayment,
      totalInterest: acceleratedSchedule.totalInterest,
      payoffMonths: acceleratedSchedule.payoffMonths,
      interestSaved,
      monthsSaved,
    };
  }

  const downPaymentRatio = purchasePrice > 0 ? downPayment / purchasePrice : 0;

  return {
    principal,
    downPaymentRatio,
    base,
    accelerated,
  };
}

export function monthsToYearsMonths(months: number): { years: number; months: number } {
  if (!Number.isFinite(months)) {
    return { years: 0, months: 0 };
  }

  const wholeMonths = Math.max(Math.round(months), 0);
  const years = Math.floor(wholeMonths / 12);
  const remainingMonths = wholeMonths % 12;

  return {
    years,
    months: remainingMonths,
  };
}

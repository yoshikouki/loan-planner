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

export interface AmortizationPoint {
  monthIndex: number;
  yearIndex: number;
  payment: number;
  principalPayment: number;
  interestPayment: number;
  balance: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
}

export interface DetailedAmortization extends AmortizationSnapshot {
  schedule: AmortizationPoint[];
}

export interface AcceleratedAmortization extends DetailedAmortization {
  monthlyPaymentWithExtra: number;
  interestSaved: number;
  monthsSaved: number;
}

export interface AcceleratedAmortizationSummary extends AmortizationSnapshot {
  monthlyPaymentWithExtra: number;
  interestSaved: number;
  monthsSaved: number;
}

export interface LoanSummary {
  principal: number;
  downPaymentRatio: number;
  base: AmortizationSnapshot;
  accelerated?: AcceleratedAmortizationSummary;
}

export interface LoanComputation {
  principal: number;
  downPaymentRatio: number;
  base: DetailedAmortization;
  accelerated?: AcceleratedAmortization;
}

interface AmortizationResult {
  payoffMonths: number;
  totalInterest: number;
  totalPayment: number;
}

interface AmortizationCalculation {
  summary: AmortizationResult;
  schedule: AmortizationPoint[];
}

const MAX_MONTHS = 1000 * 12;
const EPSILON = 1e-6;

function amortize(
  principal: number,
  monthlyRate: number,
  scheduledPayment: number,
  extraPayment: number,
): AmortizationCalculation {
  if (principal <= 0) {
    return {
      summary: {
        payoffMonths: 0,
        totalInterest: 0,
        totalPayment: 0,
      },
      schedule: [],
    };
  }

  const payment = scheduledPayment + Math.max(0, extraPayment);
  if (payment <= 0) {
    return {
      summary: {
        payoffMonths: Number.POSITIVE_INFINITY,
        totalInterest: Number.POSITIVE_INFINITY,
        totalPayment: Number.POSITIVE_INFINITY,
      },
      schedule: [],
    };
  }

  let balance = principal;
  let payoffMonths = 0;
  let totalInterest = 0;
  let totalPayment = 0;
  const schedule: AmortizationPoint[] = [];

  while (balance > EPSILON && payoffMonths < MAX_MONTHS) {
    const interest = monthlyRate > 0 ? balance * monthlyRate : 0;
    totalInterest += interest;

    let principalPayment = payment - interest;
    if (monthlyRate === 0) {
      principalPayment = payment;
    }

    if (principalPayment <= 0) {
      return {
        summary: {
          payoffMonths: Number.POSITIVE_INFINITY,
          totalInterest: Number.POSITIVE_INFINITY,
          totalPayment: Number.POSITIVE_INFINITY,
        },
        schedule: [],
      };
    }

    if (principalPayment > balance) {
      principalPayment = balance;
    }

    const actualPayment = principalPayment + interest;
    totalPayment += actualPayment;
    balance -= principalPayment;
    payoffMonths += 1;

    schedule.push({
      monthIndex: payoffMonths,
      yearIndex: Math.floor((payoffMonths - 1) / 12) + 1,
      payment: actualPayment,
      principalPayment,
      interestPayment: interest,
      balance: Math.max(balance, 0),
      totalPrincipalPaid: principal - Math.max(balance, 0),
      totalInterestPaid: totalInterest,
    });
  }

  if (payoffMonths >= MAX_MONTHS) {
    return {
      summary: {
        payoffMonths: Number.POSITIVE_INFINITY,
        totalInterest: Number.POSITIVE_INFINITY,
        totalPayment: Number.POSITIVE_INFINITY,
      },
      schedule: [],
    };
  }

  return {
    summary: {
      payoffMonths,
      totalInterest,
      totalPayment,
    },
    schedule,
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

  let acceleratedSchedule: AmortizationCalculation | undefined;
  if (extraPayment > 0) {
    acceleratedSchedule = amortize(principal, monthlyRate, scheduledPayment, extraPayment);
  }

  const base: DetailedAmortization = {
    monthlyPayment: scheduledPayment,
    totalPayment: baseSchedule.summary.totalPayment,
    totalInterest: baseSchedule.summary.totalInterest,
    payoffMonths: baseSchedule.summary.payoffMonths,
    schedule: baseSchedule.schedule,
  };

  let accelerated: AcceleratedAmortization | undefined;

  if (acceleratedSchedule && Number.isFinite(acceleratedSchedule.summary.payoffMonths)) {
    const monthlyPaymentWithExtra = scheduledPayment + extraPayment;
    const monthsSaved = Math.max(
      baseSchedule.summary.payoffMonths - acceleratedSchedule.summary.payoffMonths,
      0,
    );
    const interestSaved = Math.max(
      baseSchedule.summary.totalInterest - acceleratedSchedule.summary.totalInterest,
      0,
    );

    accelerated = {
      monthlyPayment: scheduledPayment,
      monthlyPaymentWithExtra,
      totalPayment: acceleratedSchedule.summary.totalPayment,
      totalInterest: acceleratedSchedule.summary.totalInterest,
      payoffMonths: acceleratedSchedule.summary.payoffMonths,
      interestSaved,
      monthsSaved,
      schedule: acceleratedSchedule.schedule,
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

export const summarizeLoan = (details: LoanComputation): LoanSummary => ({
  principal: details.principal,
  downPaymentRatio: details.downPaymentRatio,
  base: {
    monthlyPayment: details.base.monthlyPayment,
    totalPayment: details.base.totalPayment,
    totalInterest: details.base.totalInterest,
    payoffMonths: details.base.payoffMonths,
  },
  accelerated: details.accelerated
    ? {
        monthlyPayment: details.accelerated.monthlyPayment,
        monthlyPaymentWithExtra: details.accelerated.monthlyPaymentWithExtra,
        totalPayment: details.accelerated.totalPayment,
        totalInterest: details.accelerated.totalInterest,
        payoffMonths: details.accelerated.payoffMonths,
        interestSaved: details.accelerated.interestSaved,
        monthsSaved: details.accelerated.monthsSaved,
      }
    : undefined,
});

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

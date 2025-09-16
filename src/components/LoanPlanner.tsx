"use client";

import {
  ArrowRightLeft,
  CalculatorIcon,
  Clock4Icon,
  HistoryIcon,
  RefreshCwIcon,
  Settings2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { motion } from "motion/react";
import { type ChangeEvent, useCallback, useEffect, useId, useMemo, useRef } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  calculateLoan,
  type LoanComputation,
  type LoanInputs,
  monthsToYearsMonths,
} from "../utils/loan";

type CurrencyCode = "JPY" | "USD" | "EUR";

interface LoanSettings {
  locale: string;
  currency: CurrencyCode;
  autoSaveHistory: boolean;
  historyLimit: number;
}

interface LoanHistoryItem {
  id: string;
  createdAt: string;
  inputs: LoanInputs;
  summary: LoanComputation;
}

const STORAGE_KEYS = {
  inputs: "loan-planner:inputs",
  settings: "loan-planner:settings",
  history: "loan-planner:history",
} as const;

const HISTORY_SNAPSHOT_DELAY = 700;

const currencyOptions: Array<{ value: CurrencyCode; label: string }> = [
  { value: "JPY", label: "日本円" },
  { value: "USD", label: "USドル" },
  { value: "EUR", label: "ユーロ" },
];

const localeOptions: Array<{ value: string; label: string }> = [
  { value: "ja-JP", label: "日本語" },
  { value: "en-US", label: "English" },
];

const PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  values: LoanInputs;
}> = [
  {
    id: "first-home",
    label: "はじめての住宅",
    description: "3,500万円の物件 / 頭金15% / 35年固定",
    values: {
      purchasePrice: 35000000,
      downPayment: 5250000,
      annualInterestRate: 1.1,
      termYears: 35,
      extraMonthlyPayment: 0,
    },
  },
  {
    id: "urban-condo",
    label: "都市部マンション",
    description: "5,200万円 / 頭金20% / 30年",
    values: {
      purchasePrice: 52000000,
      downPayment: 10400000,
      annualInterestRate: 1.3,
      termYears: 30,
      extraMonthlyPayment: 10000,
    },
  },
  {
    id: "refinance",
    label: "借り換えトライ",
    description: "残債2,000万円 / 15年 / 繰上げ月2万円",
    values: {
      purchasePrice: 20000000,
      downPayment: 0,
      annualInterestRate: 0.85,
      termYears: 15,
      extraMonthlyPayment: 20000,
    },
  },
];

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
};

const createDefaultInputs = (): LoanInputs => ({
  purchasePrice: 42000000,
  downPayment: 8400000,
  annualInterestRate: 1.2,
  termYears: 35,
  extraMonthlyPayment: 0,
});

const createDefaultSettings = (): LoanSettings => ({
  locale: "ja-JP",
  currency: "JPY",
  autoSaveHistory: true,
  historyLimit: 6,
});

const toCurrencyFormatter = (locale: string, currency: CurrencyCode) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  });

const toNumberFormatter = (locale: string, fractionDigits = 0) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });

const toPercentFormatter = (locale: string, fractionDigits = 1) =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });

const addMonths = (start: Date, months: number) => {
  const result = new Date(start.getTime());
  result.setMonth(result.getMonth() + Math.max(0, Math.round(months)));
  return result;
};

const formatDate = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
  }).format(date);

const formatDateTime = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const isSameInputs = (a: LoanInputs, b: LoanInputs) =>
  a.purchasePrice === b.purchasePrice &&
  a.downPayment === b.downPayment &&
  a.annualInterestRate === b.annualInterestRate &&
  a.termYears === b.termYears &&
  a.extraMonthlyPayment === b.extraMonthlyPayment;

const createHistoryItem = (inputs: LoanInputs, summary: LoanComputation): LoanHistoryItem => {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    createdAt: new Date().toISOString(),
    inputs: { ...inputs },
    summary: {
      principal: summary.principal,
      downPaymentRatio: summary.downPaymentRatio,
      base: { ...summary.base },
      accelerated: summary.accelerated ? { ...summary.accelerated } : undefined,
    },
  };
};

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formattedValue: string;
  description?: string;
  suffix?: string;
  showSlider?: boolean;
}

const NumberField = ({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  formattedValue,
  description,
  suffix,
  showSlider = true,
}: NumberFieldProps) => {
  const generatedId = useId();
  const fieldId = id ? `${id}-${generatedId}` : generatedId;
  const sliderId = `${fieldId}-slider`;

  const handleValueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(Number(event.target.value));
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    if (value < min) {
      onChange(min);
    }

    if (value > max) {
      onChange(max);
    }
  }, [onChange, value, min, max]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-medium text-foreground" htmlFor={fieldId}>
          {label}
        </label>
        <span className="text-xs text-muted-foreground">{formattedValue}</span>
      </div>
      {showSlider ? (
        <input
          aria-label={label}
          className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          id={sliderId}
          max={max}
          min={min}
          onChange={handleValueChange}
          step={step}
          type="range"
          value={value}
        />
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <input
          className="flex-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-right text-sm text-foreground shadow-inner focus:border-primary focus:outline-none"
          id={fieldId}
          inputMode="decimal"
          max={max}
          min={min}
          onBlur={handleBlur}
          onChange={handleValueChange}
          step={step}
          type="number"
          value={Number.isNaN(value) ? "" : value}
        />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
      {description ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
};

const StatTile = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
    <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    <motion.p
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 text-2xl font-semibold text-foreground"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      {value}
    </motion.p>
    {description ? <p className="mt-2 text-xs text-muted-foreground">{description}</p> : null}
  </div>
);

const LoanPlanner = () => {
  const [inputs, setInputs, inputControls] = usePersistentState<LoanInputs>(
    STORAGE_KEYS.inputs,
    () => ({ ...createDefaultInputs() }),
  );
  const [settings, setSettings, settingsControls] = usePersistentState<LoanSettings>(
    STORAGE_KEYS.settings,
    () => ({
      ...createDefaultSettings(),
    }),
  );
  const [history, setHistory, historyControls] = usePersistentState<LoanHistoryItem[]>(
    STORAGE_KEYS.history,
    () => [],
  );

  const purchasePriceId = useId();
  const downPaymentId = useId();
  const interestRateId = useId();
  const termYearsId = useId();
  const extraPaymentId = useId();
  const historyLimitId = useId();

  const allHydrated =
    inputControls.hydrated && settingsControls.hydrated && historyControls.hydrated;

  const computation = useMemo(() => calculateLoan(inputs), [inputs]);

  const currencyFormatter = useMemo(
    () => toCurrencyFormatter(settings.locale, settings.currency),
    [settings.locale, settings.currency],
  );
  const percentFormatter = useMemo(() => toPercentFormatter(settings.locale, 1), [settings.locale]);
  const integerFormatter = useMemo(() => toNumberFormatter(settings.locale, 0), [settings.locale]);

  const basePayoff = monthsToYearsMonths(computation.base.payoffMonths);
  const acceleratedPayoff = computation.accelerated
    ? monthsToYearsMonths(computation.accelerated.payoffMonths)
    : undefined;

  const payoffDate = useMemo(() => {
    if (!Number.isFinite(computation.base.payoffMonths)) {
      return "-";
    }

    const date = addMonths(new Date(), computation.base.payoffMonths);
    return formatDate(date, settings.locale);
  }, [computation.base.payoffMonths, settings.locale]);

  const acceleratedPayoffDate = useMemo(() => {
    if (!computation.accelerated || !Number.isFinite(computation.accelerated.payoffMonths)) {
      return undefined;
    }

    const date = addMonths(new Date(), computation.accelerated.payoffMonths);
    return formatDate(date, settings.locale);
  }, [computation.accelerated, settings.locale]);

  const snapshotTimer = useRef<number | null>(null);

  const pushHistory = useCallback(() => {
    if (!allHydrated) {
      return;
    }

    setHistory((prev) => {
      const nextItem = createHistoryItem(inputs, computation);
      const limit = clamp(Math.round(settings.historyLimit || 5), 1, 20);

      if (prev.length > 0 && isSameInputs(prev[0].inputs, nextItem.inputs)) {
        return prev;
      }

      const nextHistory = [nextItem, ...prev];

      if (nextHistory.length > limit) {
        nextHistory.length = limit;
      }

      return nextHistory;
    });
  }, [allHydrated, computation, inputs, setHistory, settings.historyLimit]);

  useEffect(() => {
    if (!allHydrated || !settings.autoSaveHistory) {
      return;
    }

    if (snapshotTimer.current !== null) {
      window.clearTimeout(snapshotTimer.current);
    }

    snapshotTimer.current = window.setTimeout(() => {
      pushHistory();
    }, HISTORY_SNAPSHOT_DELAY);

    return () => {
      if (snapshotTimer.current !== null) {
        window.clearTimeout(snapshotTimer.current);
        snapshotTimer.current = null;
      }
    };
  }, [allHydrated, pushHistory, settings.autoSaveHistory]);

  const updateInput = useCallback(
    (field: keyof LoanInputs, rawValue: number) => {
      const safeValue = Number.isFinite(rawValue) ? rawValue : 0;

      setInputs((prev) => {
        const next = { ...prev };

        switch (field) {
          case "purchasePrice": {
            const value = clamp(safeValue, 1000000, 200000000);
            next.purchasePrice = value;
            if (next.downPayment > value) {
              next.downPayment = value;
            }
            break;
          }
          case "downPayment": {
            const value = clamp(safeValue, 0, prev.purchasePrice);
            next.downPayment = value;
            break;
          }
          case "annualInterestRate": {
            const value = clamp(safeValue, 0, 20);
            next.annualInterestRate = value;
            break;
          }
          case "termYears": {
            const value = clamp(safeValue, 1, 45);
            next.termYears = value;
            break;
          }
          case "extraMonthlyPayment": {
            const value = clamp(safeValue, 0, 300000);
            next.extraMonthlyPayment = value;
            break;
          }
          default:
            break;
        }

        return next;
      });
    },
    [setInputs],
  );

  const handleClearAll = useCallback(() => {
    inputControls.reset();
    settingsControls.reset();
    historyControls.reset();
  }, [historyControls, inputControls, settingsControls]);

  const handleApplyHistory = useCallback(
    (item: LoanHistoryItem) => {
      setInputs({ ...item.inputs });
    },
    [setInputs],
  );

  const handleDeleteHistoryItem = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((item) => item.id !== id));
    },
    [setHistory],
  );

  const handleHistoryLimitChange = useCallback(
    (value: number) => {
      setSettings((prev) => ({
        ...prev,
        historyLimit: clamp(Math.round(value), 1, 20),
      }));
    },
    [setSettings],
  );

  const handleCurrencyChange = useCallback(
    (value: CurrencyCode) => {
      setSettings((prev) => ({
        ...prev,
        currency: value,
      }));
    },
    [setSettings],
  );

  const handleLocaleChange = useCallback(
    (value: string) => {
      setSettings((prev) => ({
        ...prev,
        locale: value,
      }));
    },
    [setSettings],
  );

  const downPaymentRatio = percentFormatter.format(computation.downPaymentRatio || 0);

  const monthlyPayment = currencyFormatter.format(computation.base.monthlyPayment || 0);
  const totalPayment = currencyFormatter.format(computation.base.totalPayment || 0);
  const totalInterest = currencyFormatter.format(computation.base.totalInterest || 0);

  const acceleratedInterestSaved = computation.accelerated
    ? currencyFormatter.format(computation.accelerated.interestSaved || 0)
    : undefined;

  const extraMonthly = computation.accelerated
    ? currencyFormatter.format(
        computation.accelerated.monthlyPaymentWithExtra - computation.accelerated.monthlyPayment,
      )
    : currencyFormatter.format(0);

  const monthsSavedBreakdown = computation.accelerated
    ? monthsToYearsMonths(computation.accelerated.monthsSaved)
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border/60 bg-card/70 p-8 shadow-lg backdrop-blur"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <SparklesIcon className="h-4 w-4" />
                数字を触るたびに最新のローン推計が手に入ります
              </p>
              <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
                あなたにフィットするローンプランを、少ない操作で。
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                物件価格や金利、繰上げ返済を調整するとリアルタイムに返済額が更新されます。
                好みの設定や試した履歴はブラウザに保存され、いつでも削除できます。
              </p>
            </div>
            <div className="flex h-20 w-full items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-foreground shadow-inner lg:w-64">
              <CalculatorIcon className="mr-3 h-6 w-6 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  現在の毎月返済額
                </p>
                <p className="text-lg font-semibold">{monthlyPayment}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className="group flex items-center gap-3 rounded-full border border-border/60 bg-card/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary hover:bg-card"
                onClick={() => setInputs({ ...preset.values })}
                type="button"
              >
                <SparklesIcon className="h-4 w-4 text-primary transition group-hover:scale-110" />
                <span>
                  {preset.label}
                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                    {preset.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </motion.header>

        <main className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-8">
            <motion.section
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-3 text-lg font-semibold text-foreground">
                  <Settings2Icon className="h-5 w-5 text-primary" /> 借入条件
                </h2>
                <button
                  className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                  onClick={inputControls.reset}
                  type="button"
                >
                  <RefreshCwIcon className="h-4 w-4" /> 元に戻す
                </button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <NumberField
                  description="購入予定の物件価格。下部の数値入力かスライダーで細かく調整できます。"
                  formattedValue={currencyFormatter.format(inputs.purchasePrice)}
                  id={purchasePriceId}
                  label="購入価格"
                  max={200000000}
                  min={1000000}
                  onChange={(value) => updateInput("purchasePrice", value)}
                  step={1000000}
                  suffix="円"
                  value={inputs.purchasePrice}
                />
                <NumberField
                  description="用意できる頭金の金額。物件価格を超えないよう自動で調整されます。"
                  formattedValue={`${currencyFormatter.format(inputs.downPayment)} / ${downPaymentRatio}`}
                  id={downPaymentId}
                  label="頭金"
                  max={inputs.purchasePrice}
                  min={0}
                  onChange={(value) => updateInput("downPayment", value)}
                  step={500000}
                  suffix="円"
                  value={inputs.downPayment}
                />
                <NumberField
                  description="年利（%）。変動幅が小さい場合は数値入力で細かくチューニングできます。"
                  formattedValue={`${inputs.annualInterestRate.toFixed(2)} %`}
                  id={interestRateId}
                  label="年利 (APR)"
                  max={20}
                  min={0}
                  onChange={(value) => updateInput("annualInterestRate", value)}
                  showSlider
                  step={0.05}
                  suffix="%"
                  value={inputs.annualInterestRate}
                />
                <NumberField
                  description="返済年数。ローン期間に合わせて 1〜45 年まで設定できます。"
                  formattedValue={`${inputs.termYears.toFixed(0)} 年`}
                  id={termYearsId}
                  label="返済期間"
                  max={45}
                  min={1}
                  onChange={(value) => updateInput("termYears", value)}
                  showSlider
                  step={1}
                  suffix="年"
                  value={inputs.termYears}
                />
                <NumberField
                  description="毎月の繰上げ返済額。設定すると返済期間や利息が自動で再計算されます。"
                  formattedValue={currencyFormatter.format(inputs.extraMonthlyPayment)}
                  id={extraPaymentId}
                  label="毎月の追加返済"
                  max={300000}
                  min={0}
                  onChange={(value) => updateInput("extraMonthlyPayment", value)}
                  showSlider
                  step={5000}
                  suffix="円"
                  value={inputs.extraMonthlyPayment}
                />
              </div>
            </motion.section>

            <motion.section
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-3 text-lg font-semibold text-foreground">
                  <CalculatorIcon className="h-5 w-5 text-primary" /> 推計結果
                </h2>
                <button
                  className="flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary/70"
                  onClick={pushHistory}
                  type="button"
                >
                  <HistoryIcon className="h-4 w-4" /> 履歴に保存
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <StatTile
                  label="毎月の返済額"
                  value={monthlyPayment}
                  description="追加返済を含まない基本の支払額"
                />
                <StatTile label="総支払額" value={totalPayment} description="元金 + 利息" />
                <StatTile label="支払利息総額" value={totalInterest} />
                <StatTile
                  label="完済までの期間"
                  value={`${integerFormatter.format(basePayoff.years)}年 ${integerFormatter.format(basePayoff.months)}か月`}
                  description={`完済予定: ${payoffDate}`}
                />
              </div>

              <div className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-5">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ArrowRightLeft className="h-4 w-4 text-primary" /> 頭金比率
                </p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{downPaymentRatio}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  頭金 {currencyFormatter.format(inputs.downPayment)} / 借入額{" "}
                  {currencyFormatter.format(computation.principal)}
                </p>
              </div>

              {computation.accelerated ? (
                <div className="mt-8 grid gap-4 rounded-2xl border border-primary/30 bg-primary/20 p-5 md:grid-cols-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary/80">
                      <Clock4Icon className="h-4 w-4" /> 繰上げ返済ありのプラン
                    </p>
                    <p className="mt-4 text-sm text-primary/90">毎月の追加返済 {extraMonthly}</p>
                    <p className="mt-2 text-sm text-primary/90">
                      合計返済額 {currencyFormatter.format(computation.accelerated.totalPayment)}
                    </p>
                    <p className="mt-2 text-xs text-primary/75">
                      完済まで {integerFormatter.format(acceleratedPayoff?.years ?? 0)}年{" "}
                      {integerFormatter.format(acceleratedPayoff?.months ?? 0)}か月（予定:{" "}
                      {acceleratedPayoffDate}）
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/40 bg-card/50 p-4">
                    <p className="text-xs uppercase tracking-widest text-primary/70">
                      期待できる効果
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-primary/90">
                      利息 {acceleratedInterestSaved} 削減
                    </p>
                    <p className="mt-2 text-sm text-primary/90">
                      返済期間 {integerFormatter.format(monthsSavedBreakdown?.years ?? 0)}年{" "}
                      {integerFormatter.format(monthsSavedBreakdown?.months ?? 0)}か月短縮
                    </p>
                  </div>
                </div>
              ) : null}
            </motion.section>
          </section>

          <section className="space-y-8">
            <motion.section
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <HistoryIcon className="h-5 w-5 text-primary" /> シミュレーション履歴
                </h2>
                <button
                  className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
                  onClick={historyControls.reset}
                  type="button"
                >
                  <Trash2Icon className="h-3.5 w-3.5" /> 全削除
                </button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                変更内容は{settings.autoSaveHistory ? "自動的に" : "ボタンから"}保存されます。最大{" "}
                {settings.historyLimit} 件まで保持します。
              </p>

              <ul className="mt-4 space-y-3">
                {history.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-4 text-sm text-muted-foreground">
                    まだ履歴はありません。条件を調整するとここに保存されます。
                  </li>
                ) : (
                  history.map((item) => {
                    const payoff = monthsToYearsMonths(item.summary.base.payoffMonths);
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {currencyFormatter.format(item.summary.base.monthlyPayment)} / 月
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payoff.years}年 {payoff.months}か月・
                              {formatDateTime(item.createdAt, settings.locale)} 保存
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary/70"
                              onClick={() => handleApplyHistory(item)}
                              type="button"
                            >
                              適用
                            </button>
                            <button
                              className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground/80 transition hover:border-destructive hover:text-destructive"
                              onClick={() => handleDeleteHistoryItem(item.id)}
                              type="button"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                          <span>
                            物件 {currencyFormatter.format(item.inputs.purchasePrice)} / 頭金{" "}
                            {currencyFormatter.format(item.inputs.downPayment)}
                          </span>
                          <span>
                            金利 {item.inputs.annualInterestRate.toFixed(2)}% / 期間{" "}
                            {item.inputs.termYears}年
                          </span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </motion.section>

            <motion.section
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.25, duration: 0.3 }}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Settings2Icon className="h-5 w-5 text-primary" /> 表示・保存設定
                </h2>
                <button
                  className="flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
                  onClick={settingsControls.reset}
                  type="button"
                >
                  <RefreshCwIcon className="h-3.5 w-3.5" /> 初期化
                </button>
              </div>

              <div className="mt-4 space-y-4 text-sm text-foreground">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    通貨
                  </span>
                  <select
                    className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    onChange={(event) => handleCurrencyChange(event.target.value as CurrencyCode)}
                    value={settings.currency}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    表示言語
                  </span>
                  <select
                    className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    onChange={(event) => handleLocaleChange(event.target.value)}
                    value={settings.locale}
                  >
                    {localeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">自動保存を有効にする</p>
                    <p className="text-xs text-muted-foreground">
                      入力が止まると約 {HISTORY_SNAPSHOT_DELAY}ms 後に履歴へ保存します。
                    </p>
                  </div>
                  <input
                    checked={settings.autoSaveHistory}
                    className="h-5 w-10 cursor-pointer appearance-none rounded-full border border-border/70 bg-muted transition checked:border-primary checked:bg-primary"
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        autoSaveHistory: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                </label>

                <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <label
                    className="flex items-center justify-between text-sm text-foreground"
                    htmlFor={historyLimitId}
                  >
                    <span>履歴の保存件数（最大 20 件）</span>
                    <span className="text-xs text-muted-foreground">
                      {settings.historyLimit} 件
                    </span>
                  </label>
                  <input
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    id={historyLimitId}
                    max={20}
                    min={1}
                    onChange={(event) => handleHistoryLimitChange(Number(event.target.value))}
                    step={1}
                    type="range"
                    value={settings.historyLimit}
                  />
                </div>
              </div>

              <button
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/80 bg-destructive/20 px-4 py-3 text-sm font-medium text-destructive/80 transition hover:bg-destructive/30"
                onClick={handleClearAll}
                type="button"
              >
                <Trash2Icon className="h-4 w-4" /> 全データを削除
              </button>
            </motion.section>
          </section>
        </main>
      </div>
    </div>
  );
};

export default LoanPlanner;

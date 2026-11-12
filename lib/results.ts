import raw from "./data/results.json";

export type Stat = { mean: number; std: number } | null;
export type Policy = "never" | "always_tent" | "gated_tent" | "gated_bn" | "oracle_tent";

type CoreRow = {
  experiment: string;
  policy: Policy;
  n_streams: number;
  overall_acc: Stat;
  clean_acc: Stat;
  shift_acc: Stat;
  post_shift_clean_acc: Stat;
  adapt_steps: Stat;
  false_alarms: Stat;
  detection_delay_windows: Stat;
  missed_shifts: Stat;
};
type OrderRow = {
  experiment: string;
  order: "correlated" | "shuffled";
  policy: Policy;
  clean_acc: Stat;
  shift_acc: Stat;
};
type DetectorRow = {
  order: string;
  experiment: string;
  detector: string;
  clean_alarm_rate: Stat;
  nominal_p05_clean_alarm_rate: Stat;
};

const data = raw as unknown as {
  core: CoreRow[];
  order: OrderRow[];
  detector: DetectorRow[];
};

export const EXPERIMENTS = [
  { id: "E1_clean", label: "E1 · Clean" },
  { id: "E2_tunnel_bursts", label: "E2 · Tunnel" },
  { id: "E3_fog_bursts", label: "E3 · Fog" },
  { id: "E4_recovery", label: "E4 · Recovery" },
  { id: "E5_slow_fog", label: "E5 · Slow fog" },
] as const;

export const POLICY_LABEL: Record<Policy, string> = {
  never: "Never adapt",
  always_tent: "Always TENT",
  gated_tent: "Gated TENT",
  gated_bn: "Gated BN",
  oracle_tent: "Oracle TENT",
};

export const core = (exp: string, policy: Policy) => {
  const row = data.core.find((r) => r.experiment === exp && r.policy === policy);
  if (!row) throw new Error(`Missing result: ${exp} / ${policy}`);
  return row;
};

export const orderRow = (exp: string, order: "correlated" | "shuffled", policy: Policy) => {
  const row = data.order.find((r) => r.experiment === exp && r.order === order && r.policy === policy);
  if (!row) throw new Error(`Missing result: ${exp} / ${order} / ${policy}`);
  return row;
};

/** Nominal (p < 0.05) vs calibrated alarm rate on the clean stream, for correlated test windows. */
export const detectorRow = (detector: "entropy" | "bbsds") => {
  const row = data.detector.find(
    (r) => r.order === "correlated" && r.experiment === "E1_clean" && r.detector === detector,
  );
  if (!row) throw new Error(`Missing detector result: ${detector}`);
  return row;
};

export const fmt = (s: Stat, digits = 1) => (s ? s.mean.toFixed(digits) : "–");
export const fmtPm = (s: Stat, digits = 1) =>
  s ? `${s.mean.toFixed(digits)} ± ${s.std.toFixed(digits)}` : "–";
export const val = (s: Stat) => (s ? Number(s.mean.toFixed(1)) : 0);

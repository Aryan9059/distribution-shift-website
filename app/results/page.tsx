import BarCompare from "@/components/BarCompare";
import { PageTitle, Table, td, th } from "@/components/ui";
import {
  EXPERIMENTS,
  POLICY_LABEL,
  core,
  detectorRow,
  fmt,
  fmtPm,
  orderRow,
  val,
  type Policy,
} from "@/lib/results";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Info,
  Layers,
  ShieldCheck,
  ShieldOff,
  Shuffle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

/* ─── design tokens ─────────────────────────────────────────── */
const COLORS = { never: "#8da2c4", always: "#f2a65a", gated: "#4f8cff" };
const ALL_POLICIES: Policy[] = ["never", "always_tent", "gated_tent", "gated_bn", "oracle_tent"];

/* ─── small reusable primitives ─────────────────────────────── */

function KeyCallout({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-5">
      <span className="mt-0.5 flex-shrink-0 text-accent">{icon}</span>
      <p className="leading-relaxed text-fg/90">{children}</p>
    </div>
  );
}

function WarnCallout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/5 p-5">
      <Info size={18} className="mt-0.5 flex-shrink-0 text-warn" />
      <p className="text-sm leading-relaxed text-fg/80">{children}</p>
    </div>
  );
}

/** Numbered finding header */
function FindingHeader({
  number,
  icon,
  title,
}: {
  number: number;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        {icon}
      </div>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Finding {number}
        </span>
        <h2 className="text-lg font-semibold leading-snug text-fg">{title}</h2>
      </div>
    </div>
  );
}

/** Stat highlight chip */
function Chip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral" | "accent";
}) {
  const colors = {
    good: "border-good/30 bg-good/10 text-good",
    bad: "border-bad/30 bg-bad/10 text-bad",
    accent: "border-accent/30 bg-accent/10 text-accent",
    neutral: "border-line bg-panel text-fg",
  };
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-center ${colors[tone]}`}>
      <div className="font-mono text-lg font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

/** Card wrapper for each finding */
function FindingCard({ children }: { children: ReactNode }) {
  return (
    <section className="mb-10 rounded-2xl border border-line bg-panel p-6 shadow-sm">
      {children}
    </section>
  );
}

function Divider() {
  return <hr className="my-5 border-line" />;
}

/* ─── page ───────────────────────────────────────────────────── */

export default function ResultsPage() {
  const e1 = EXPERIMENTS[0].id;

  // Finding 1 numbers
  const acc_never = fmt(core(e1, "never").overall_acc);
  const acc_always = fmt(core(e1, "always_tent").overall_acc);
  const acc_gated = fmt(core(e1, "gated_tent").overall_acc);

  // Finding 3 order-chart
  const corrAlways = {
    clean: orderRow("E1_clean", "correlated", "always_tent").clean_acc,
    tunnel: orderRow("E2_tunnel_bursts", "correlated", "always_tent").shift_acc,
    fog: orderRow("E3_fog_bursts", "correlated", "always_tent").shift_acc,
  };
  const shufAlways = {
    clean: orderRow("E1_clean", "shuffled", "always_tent").clean_acc,
    tunnel: orderRow("E2_tunnel_bursts", "shuffled", "always_tent").shift_acc,
    fog: orderRow("E3_fog_bursts", "shuffled", "always_tent").shift_acc,
  };
  const orderChart = [
    { name: "Clean", id: "E1_clean", key: "clean_acc" as const },
    { name: "Tunnel", id: "E2_tunnel_bursts", key: "shift_acc" as const },
    { name: "Fog", id: "E3_fog_bursts", key: "shift_acc" as const },
  ].map((c) => ({
    name: c.name,
    corr: val(orderRow(c.id, "correlated", "always_tent")[c.key]),
    shuf: val(orderRow(c.id, "shuffled", "always_tent")[c.key]),
    never_corr: val(orderRow(c.id, "correlated", "never")[c.key]),
    never_shuf: val(orderRow(c.id, "shuffled", "never")[c.key]),
  }));

  // Finding 4 numbers
  const ent = detectorRow("entropy");
  const bb = detectorRow("bbsds");

  return (
    <>
      <PageTitle
        title="Results & Conclusions"
        lead="What the experiments actually established. All numbers come from the research notebook (mean over three stream realisations, one trained model)."
      />

      {/* ── Summary callout ── */}
      <KeyCallout icon={<ShieldCheck size={20} />}>
        <strong className="font-semibold">Core finding:</strong> Gating makes test-time adaptation
        safer, but whether it helps depends on how incoming batches are composed. On realistic,
        temporally correlated streams it protects the source model but does not improve on it.
      </KeyCallout>

      <div className="mt-10 space-y-0">

        {/* ════════════════════════════════════════════════════════
            Finding 1
        ════════════════════════════════════════════════════════ */}
        <FindingCard>
          <FindingHeader
            number={1}
            icon={<TrendingDown size={18} />}
            title="Always-on TENT is harmful on correlated streams"
          />

          <p className="mb-5 text-sm leading-relaxed text-muted">
            On a clean stream (E1) there is nothing to adapt to, yet continuous adaptation lowers
            accuracy sharply. Frames from the same track arrive together, so each window contains
            only a few distinct signs — TENT normalises these narrow statistics and destroys class
            information.
          </p>

          <div className="mb-5 grid grid-cols-3 gap-3">
            <Chip label="Never adapt" value={`${acc_never}%`} tone="good" />
            <Chip label="Always TENT" value={`${acc_always}%`} tone="bad" />
            <Chip label="Gated TENT" value={`${acc_gated}%`} tone="accent" />
          </div>

          <BarCompare
            label="E1 clean-stream accuracy for never adapt, always TENT and gated TENT"
            data={[
              {
                name: "Clean stream (E1)",
                never: val(core(e1, "never").overall_acc),
                always: val(core(e1, "always_tent").overall_acc),
                gated: val(core(e1, "gated_tent").overall_acc),
              },
            ]}
            series={[
              { key: "never", label: "Never adapt", color: COLORS.never },
              { key: "always", label: "Always TENT", color: COLORS.always },
              { key: "gated", label: "Gated TENT", color: COLORS.gated },
            ]}
          />
        </FindingCard>

        {/* ════════════════════════════════════════════════════════
            Finding 2
        ════════════════════════════════════════════════════════ */}
        <FindingCard>
          <FindingHeader
            number={2}
            icon={<ShieldCheck size={18} />}
            title="Gating prevents most of the damage"
          />

          <p className="mb-5 text-sm leading-relaxed text-muted">
            The gate stays within about half a point of never-adapt in every experiment, while
            always-on TENT loses 13 to 28 points. The gate protects the source model, but it does
            not consistently improve accuracy under shifts.
          </p>

          {/* Overview table */}
          <Table>
            <thead>
              <tr>
                <th className={th}>Experiment</th>
                <th className={th}>Never adapt</th>
                <th className={th}>Always TENT</th>
                <th className={th}>Gated TENT</th>
              </tr>
            </thead>
            <tbody>
              {EXPERIMENTS.map((e) => {
                const never = Number(fmt(core(e.id, "never").overall_acc));
                const always = Number(fmt(core(e.id, "always_tent").overall_acc));
                const gated = Number(fmt(core(e.id, "gated_tent").overall_acc));
                const alwaysDiff = always - never;
                const gatedDiff = gated - never;
                return (
                  <tr key={e.id}>
                    <td className={`${td} font-sans`}>{e.label}</td>
                    <td className={`${td} text-muted`}>{never}%</td>
                    <td className={td}>
                      <span className={alwaysDiff < -2 ? "text-bad" : alwaysDiff > 1 ? "text-good" : ""}>
                        {always}%
                      </span>
                      {alwaysDiff < -2 && (
                        <TrendingDown size={12} className="ml-1 inline text-bad" />
                      )}
                    </td>
                    <td className={td}>
                      <span className={gatedDiff > 0.5 ? "text-good" : ""}>
                        {gated}%
                      </span>
                      {gatedDiff > 0.5 && (
                        <TrendingUp size={12} className="ml-1 inline text-good" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">
            Overall accuracy over the whole stream, track-correlated ordering.
          </p>

          <Divider />

          {/* Expandable full table */}
          <details className="group text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-fg/80 hover:text-fg">
              <Layers size={14} className="text-muted" />
              All five policies and more metrics
              <ChevronDown
                size={14}
                className="ml-auto text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Experiment</th>
                    <th className={th}>Policy</th>
                    <th className={th}>Overall</th>
                    <th className={th}>Clean</th>
                    <th className={th}>Shifted</th>
                    <th className={th}>Adapted windows</th>
                    <th className={th}>False openings</th>
                    <th className={th}>Delay (windows)</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPERIMENTS.flatMap((e) =>
                    ALL_POLICIES.map((p) => {
                      const r = core(e.id, p);
                      const gated =
                        p === "gated_tent" || p === "gated_bn" || p === "oracle_tent";
                      return (
                        <tr key={`${e.id}-${p}`}>
                          <td className={`${td} font-sans`}>{e.label}</td>
                          <td className={`${td} font-sans`}>{POLICY_LABEL[p]}</td>
                          <td className={td}>{fmtPm(r.overall_acc)}</td>
                          <td className={td}>{fmt(r.clean_acc)}</td>
                          <td className={td}>{fmt(r.shift_acc)}</td>
                          <td className={td}>{fmt(r.adapt_steps, 1)}</td>
                          <td className={td}>{gated ? fmt(r.false_alarms) : "–"}</td>
                          <td className={td}>
                            {gated ? fmt(r.detection_delay_windows) : "–"}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </Table>
              <p className="mt-3 text-sm text-muted">
                Even oracle TENT, which knows the true shift boundaries, scores below never-adapt
                on shifted windows of the correlated streams. Mean ± std over three streams.
              </p>
            </div>
          </details>
        </FindingCard>

        {/* ════════════════════════════════════════════════════════
            Finding 3
        ════════════════════════════════════════════════════════ */}
        <FindingCard>
          <FindingHeader
            number={3}
            icon={<Shuffle size={18} />}
            title="Batch composition reverses TENT's effect"
          />

          <p className="mb-5 text-sm leading-relaxed text-muted">
            The same frames were also streamed in{" "}
            <strong className="font-medium text-fg">shuffled order</strong>, so each window holds a
            broad mix of classes. The picture reverses: always-on TENT now helps. TENT normalises
            with the statistics of each window — when a window holds only two or three signs, those
            statistics describe the signs rather than the imaging condition.
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Clean · corr", value: `${fmt(corrAlways.clean)}%`, ref: "Always TENT" },
              { label: "Tunnel · corr", value: `${fmt(corrAlways.tunnel)}%`, ref: "Always TENT" },
              { label: "Fog · corr", value: `${fmt(corrAlways.fog)}%`, ref: "Always TENT" },
            ].map((c) => (
              <Chip key={c.label} label={c.label} value={c.value} tone="neutral" />
            ))}
          </div>

          <BarCompare
            label="Always-TENT accuracy for correlated versus shuffled ordering, with never-adapt for reference"
            height={290}
            data={orderChart}
            series={[
              { key: "never_corr", label: "Never adapt (correlated)", color: "#4a5a78" },
              { key: "corr", label: "Always TENT · correlated", color: COLORS.always },
              { key: "never_shuf", label: "Never adapt (shuffled)", color: "#6d84a8" },
              { key: "shuf", label: "Always TENT · shuffled", color: COLORS.gated },
            ]}
          />

          <Divider />

          <Table>
            <thead>
              <tr>
                <th className={th}>Condition</th>
                <th className={th}>Always TENT · correlated</th>
                <th className={th}>Always TENT · shuffled</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Clean", corrAlways.clean, shufAlways.clean],
                ["Tunnel", corrAlways.tunnel, shufAlways.tunnel],
                ["Fog", corrAlways.fog, shufAlways.fog],
              ].map(([name, c, s]) => (
                <tr key={name as string}>
                  <td className={`${td} font-sans`}>{name as string}</td>
                  <td className={td}>{fmt(c as never)}%</td>
                  <td className={td}>{fmt(s as never)}%</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </FindingCard>

        {/* ════════════════════════════════════════════════════════
            Finding 4
        ════════════════════════════════════════════════════════ */}
        <FindingCard>
          <FindingHeader
            number={4}
            icon={<FlaskConical size={18} />}
            title="Standard KS p-values are unreliable on correlated frames"
          />

          <p className="mb-5 text-sm leading-relaxed text-muted">
            Frames in a track are strongly dependent, so the textbook rule (alarm when{" "}
            <code className="rounded bg-line px-1 py-0.5 font-mono text-xs">p &lt; 0.05</code>)
            fires almost constantly on clean correlated streams. We calibrate the threshold on
            clean validation streams with matching ordering instead.
          </p>

          {/* Before/after alarm rate comparison */}
          <div className="mb-5 grid grid-cols-2 gap-4">
            {/* Entropy-KS */}
            <div className="rounded-xl border border-line bg-bg p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Entropy-KS
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="font-mono text-xl font-bold text-bad">
                    {fmt(ent.nominal_p05_clean_alarm_rate)}%
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted">
                    <ShieldOff size={11} />
                    Nominal p&lt;0.05
                  </div>
                </div>
                <div className="text-muted">→</div>
                <div className="flex-1 text-center">
                  <div className="font-mono text-xl font-bold text-good">
                    {fmt(ent.clean_alarm_rate)}%
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted">
                    <CheckCircle2 size={11} />
                    After calibration
                  </div>
                </div>
              </div>
            </div>

            {/* BBSDs */}
            <div className="rounded-xl border border-line bg-bg p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                BBSDs
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="font-mono text-xl font-bold text-bad">
                    {fmt(bb.nominal_p05_clean_alarm_rate)}%
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted">
                    <ShieldOff size={11} />
                    Nominal p&lt;0.05
                  </div>
                </div>
                <div className="text-muted">→</div>
                <div className="flex-1 text-center">
                  <div className="font-mono text-xl font-bold text-good">
                    {fmt(bb.clean_alarm_rate)}%
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted">
                    <CheckCircle2 size={11} />
                    After calibration
                  </div>
                </div>
              </div>
            </div>
          </div>

          <WarnCallout>
            Per-window alarm rate on the clean correlated test stream. Once calibrated,
            entropy-KS and BBSDs behave almost identically as gate drivers.
          </WarnCallout>
        </FindingCard>

        {/* ════════════════════════════════════════════════════════
            Limitations
        ════════════════════════════════════════════════════════ */}
        <FindingCard>
          <FindingHeader
            number={5}
            icon={<AlertTriangle size={18} />}
            title="Limitations & Future Work"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
                <AlertTriangle size={12} />
                Known limitations
              </p>
              <ul className="space-y-2">
                {[
                  "One model-training seed and three stream seeds.",
                  "Synthetic tunnel and fog corruptions only.",
                  "A single window size of 64.",
                  "Untuned TENT learning rate (default 0.001).",
                  "Calibration tracks cover 33 of the 43 classes.",
                  "Reset logic can flicker under permanent drift (E5).",
                  "No validation on real dash-camera footage.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-fg/80">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warn" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
                <TrendingUp size={12} />
                Future directions
              </p>
              <ul className="space-y-2">
                {[
                  "Place correlation-robust methods (SAR, NOTE, LAME) behind the same gate.",
                  "Try sequential change detectors instead of window-based KS tests.",
                  "Validate on real dash-camera footage.",
                  "Explore adaptive window sizing for varying shift dynamics.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-fg/80">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </FindingCard>
      </div>
    </>
  );
}

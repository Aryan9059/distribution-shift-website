import Image from "next/image";
import BarCompare from "@/components/BarCompare";
import { PageTitle, Table, td, th } from "@/components/ui";
import {
  CONFIG,
  DETECTOR_LABEL,
  EXPERIMENTS,
  N_SEEDS,
  NOMINAL_KS_CLEAN,
  POLICY_LABEL,
  ablation,
  core,
  detector,
  detectorNames,
  fmt,
  fmtPm,
  paired,
  shuffled,
  signed,
  val,
  type AblationPolicy,
  type Policy,
} from "@/lib/results";
import {
  AlertTriangle,
  ChevronDown,
  Gauge,
  Layers,
  Radar,
  Scale,
  ShieldCheck,
  Shuffle,
  Sigma,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

/* ─── design tokens ─────────────────────────────────────────── */
const COLORS = { never: "#8da2c4", always: "#f2a65a", gated: "#4f8cff", ours: "#52c28a" };
const ALL_POLICIES: Policy[] = [
  "never",
  "always_tent",
  "gated_tent",
  "gated_bn",
  "oracle_tent",
  "ours",
  "oracle_ses",
];

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
      <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-warn" />
      <p className="text-sm leading-relaxed text-fg/80">{children}</p>
    </div>
  );
}

function FindingHeader({ number, icon, title }: { number: number; icon: ReactNode; title: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        {icon}
      </div>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Finding {number}</span>
        <h2 className="text-lg font-semibold leading-snug text-fg">{title}</h2>
      </div>
    </div>
  );
}

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

function FindingCard({ children }: { children: ReactNode }) {
  return <section className="mb-10 rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-6">{children}</section>;
}

function Divider() {
  return <hr className="my-5 border-line" />;
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-sm leading-relaxed text-muted">{children}</p>;
}

function Figure({ src, alt, width, height, caption }: { src: string; alt: string; width: number; height: number; caption: string }) {
  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-line bg-white p-2">
        <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" />
      </div>
      <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

function Expand({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-fg/80 hover:text-fg">
        <Layers size={14} className="text-muted" />
        {title}
        <ChevronDown size={14} className="ml-auto text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

const diffClass = (v: number) => (v > 0.5 ? "text-good" : v < -0.5 ? "text-bad" : "");

/* ─── page ───────────────────────────────────────────────────── */

export default function ResultsPage() {
  const summaryChart = EXPERIMENTS.map((e) => ({
    name: e.label.replace(/^E\d · /, ""),
    never: val(core(e.id, "never").overall),
    always: val(core(e.id, "always_tent").overall),
    gated: val(core(e.id, "gated_tent").overall),
    ours: val(core(e.id, "ours").overall),
  }));

  const shiftChips = [
    { id: "E3_fog_bursts", label: "Fog bursts" },
    { id: "E4_recovery", label: "Tunnel → fog" },
    { id: "E5_slow_fog", label: "Slow fog" },
    { id: "E2_tunnel_bursts", label: "Tunnel bursts" },
  ];

  const ABLATION_ROWS: AblationPolicy[] = [
    "ours",
    "old_gate_ses",
    "new_gate_tent",
    "new_gate_bn_ema",
    "new_gate_blend",
    "ses_always_on",
  ];
  const ABLATION_EXPS = EXPERIMENTS.slice(0, 3);

  const DECOMP_ROWS: AblationPolicy[] = ["never", "oracle_tent", "oracle_bn_only", "oracle_grad_only", "oracle_ses"];

  const ent = detector("entropy");
  const ours = detector("stat:all");
  const meanOurs = (EXPERIMENTS.reduce((a, e) => a + val(core(e.id, "ours").overall), 0) / EXPERIMENTS.length).toFixed(1);
  const meanNever = (EXPERIMENTS.reduce((a, e) => a + val(core(e.id, "never").overall), 0) / EXPERIMENTS.length).toFixed(1);

  return (
    <>
      <PageTitle
        title="Results & Conclusions"
        lead={`Held-out test streams, mean over ${N_SEEDS} stream seeds with one trained model. Every setting (detector, gate m = ${CONFIG.m}, k = ${CONFIG.k}, adapter) was chosen on validation tracks and frozen before any test stream was built.`}
      />

      <KeyCallout icon={<ShieldCheck size={20} />}>
        <strong className="font-semibold">Core finding:</strong> once the detector ignores sign content and the
        adapter trusts a window only as far as its evidence goes, test-time adaptation beats the non-adaptive
        model on realistic, filmed-order streams. That had not happened before in this project. Mean accuracy
        over the five experiments rises from {meanNever}% to {meanOurs}%.
      </KeyCallout>

      <div className="mt-6 rounded-2xl border border-line bg-panel p-4 sm:p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Overall accuracy, filmed order
        </p>
        <BarCompare
          label="Overall accuracy per experiment for never adapt, always TENT, the original gated TENT and the new system"
          height={300}
          data={summaryChart}
          series={[
            { key: "never", label: "Never adapt", color: COLORS.never },
            { key: "always", label: "Always TENT", color: COLORS.always },
            { key: "gated", label: "Gated TENT (original)", color: COLORS.gated },
            { key: "ours", label: "Detect–Trust–Adapt (ours)", color: COLORS.ours },
          ]}
        />
      </div>

      <div className="mt-10 space-y-0">
        {/* ── Finding 1 ── */}
        <FindingCard>
          <FindingHeader number={1} icon={<TrendingUp size={18} />} title="Adaptation now beats never-adapt under fog and drift" />
          <Prose>
            Each policy is compared with never-adapt on the same stream. The new system wins on every seed under fog
            bursts, tunnel-then-fog and slow fog that never clears. It loses about half a point on tunnel bursts and
            just over one point on clean streams, where false alarms open the gate.
          </Prose>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shiftChips.map((c) => (
              <Chip
                key={c.id}
                label={`${c.label}: shifted windows`}
                value={`${fmt(core(c.id, "never").shift)} → ${fmt(core(c.id, "ours").shift)}`}
                tone={val(core(c.id, "ours").shift) - val(core(c.id, "never").shift) > 5 ? "good" : "neutral"}
              />
            ))}
          </div>

          <Table>
            <thead>
              <tr>
                <th className={th}>Experiment</th>
                <th className={th}>Never adapt</th>
                <th className={th}>Ours</th>
                <th className={th}>Paired Δ (pp)</th>
                <th className={th}>Min to max</th>
                <th className={th}>Seeds better / worse</th>
                <th className={th}>Ours, perfect timing</th>
              </tr>
            </thead>
            <tbody>
              {EXPERIMENTS.map((e) => {
                const p = paired(e.id, "ours");
                return (
                  <tr key={e.id}>
                    <td className={`${td} font-sans`}>{e.label}</td>
                    <td className={`${td} text-muted`}>{fmt(core(e.id, "never").overall)}%</td>
                    <td className={td}>{fmtPm(core(e.id, "ours").overall)}%</td>
                    <td className={`${td} ${diffClass(p.mean_diff)}`}>{signed(p.mean_diff)}</td>
                    <td className={`${td} text-muted`}>
                      {signed(p.min)} to {signed(p.max)}
                    </td>
                    <td className={td}>
                      {p.better} / {p.worse}
                    </td>
                    <td className={`${td} text-muted`}>{fmt(core(e.id, "oracle_ses").overall)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">
            Overall accuracy over the whole stream. &quot;Perfect timing&quot; runs the same adapter with the true
            shift boundaries, so it shows the ceiling set by the gate.
          </p>

          <Divider />

          <Expand title="All policies and every metric">
            <Table>
              <thead>
                <tr>
                  <th className={th}>Experiment</th>
                  <th className={th}>Policy</th>
                  <th className={th}>Overall</th>
                  <th className={th}>Clean</th>
                  <th className={th}>Shifted</th>
                  <th className={th}>Worst window</th>
                  <th className={th}>Macro-F1</th>
                  <th className={th}>Adapted windows</th>
                  <th className={th}>False openings</th>
                  <th className={th}>Delay</th>
                  <th className={th}>Missed</th>
                </tr>
              </thead>
              <tbody>
                {EXPERIMENTS.flatMap((e) =>
                  ALL_POLICIES.map((p) => {
                    const r = core(e.id, p);
                    return (
                      <tr key={`${e.id}-${p}`} className={p === "ours" ? "bg-good/5" : undefined}>
                        <td className={`${td} font-sans`}>{e.label}</td>
                        <td className={`${td} font-sans`}>{POLICY_LABEL[p]}</td>
                        <td className={td}>{fmtPm(r.overall)}</td>
                        <td className={td}>{fmt(r.clean)}</td>
                        <td className={td}>{fmt(r.shift)}</td>
                        <td className={td}>{fmt(r.worst_window)}</td>
                        <td className={td}>{fmt(r.macro_f1)}</td>
                        <td className={td}>{fmt(r.adapt_steps)}</td>
                        <td className={td}>{fmt(r.false_alarms)}</td>
                        <td className={td}>{fmt(r.delay)}</td>
                        <td className={td}>{fmt(r.missed)}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-muted">
              Accuracy in %, mean ± std over {N_SEEDS} stream seeds. The detection columns (delay and missed bursts
              in windows) are reported for the gated policies only.
            </p>
          </Expand>
        </FindingCard>

        {/* ── Finding 2 ── */}
        <FindingCard>
          <FindingHeader number={2} icon={<Radar size={18} />} title="The original entropy detector was blind to tunnels" />
          <Prose>
            Prediction entropy depends on which signs are in view, so on filmed streams it barely separates darkness
            from content. The new score normalises every BatchNorm statistic by the spread that content alone produces
            on clean windows. It responds to the imaging condition instead. All detectors are thresholded at the 95th
            percentile of clean calibration scores.
          </Prose>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Chip label="Tunnel windows flagged, entropy-KS" value={`${fmt(ent.tunnel)}%`} tone="bad" />
            <Chip label="Tunnel windows flagged, ours" value={`${fmt(ours.tunnel)}%`} tone="good" />
            <Chip
              label="E2 delay, original → ours (windows)"
              value={`${fmt(core("E2_tunnel_bursts", "gated_tent").delay)} → ${fmt(core("E2_tunnel_bursts", "ours").delay)}`}
              tone="accent"
            />
            <Chip
              label="E2 bursts missed, original → ours"
              value={`${fmt(core("E2_tunnel_bursts", "gated_tent").missed)} → ${fmt(core("E2_tunnel_bursts", "ours").missed)}`}
              tone="accent"
            />
          </div>

          <Table>
            <thead>
              <tr>
                <th className={th}>Detector</th>
                <th className={th}>Clean (false alarms)</th>
                <th className={th}>Tunnel</th>
                <th className={th}>Fog</th>
              </tr>
            </thead>
            <tbody>
              {detectorNames().map((d) => {
                const r = detector(d);
                return (
                  <tr key={d} className={d === "stat:all" ? "bg-good/5" : undefined}>
                    <td className={`${td} font-sans`}>{DETECTOR_LABEL[d] ?? d}</td>
                    <td className={td}>{fmtPm(r.clean)}%</td>
                    <td className={td}>{fmtPm(r.tunnel)}%</td>
                    <td className={td}>{fmtPm(r.fog)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 mb-5 text-xs text-muted">
            Per-window alarm rate at the calibrated threshold, filmed order. With the textbook rule (alarm when
            p &lt; 0.05), entropy-KS fires on {fmt(NOMINAL_KS_CLEAN.correlated)}% of clean filmed windows, which is why
            every threshold is calibrated on clean streams. In E5 the new gate opens after{" "}
            {fmt(core("E5_slow_fog", "ours").delay, 0)} windows instead of {fmt(core("E5_slow_fog", "gated_tent").delay, 0)}.
          </p>

          <Figure
            src="/figures/fig_timeline_E3.png"
            alt="E3 fog bursts, seed 0: window accuracy over time for never adapt, gated TENT and the new system, with both detectors' scores and gate openings"
            width={1760}
            height={1120}
            caption="E3 fog bursts, seed 0. Top: accuracy per window, with shaded fog segments. Middle and bottom: entropy-KS score and the new score relative to τ. The coloured bars mark when each gate is open."
          />
          <div className="mt-5">
            <Expand title="Same view for E2 tunnel bursts">
              <Figure
                src="/figures/fig_timeline_E2.png"
                alt="E2 tunnel bursts, seed 0: window accuracy over time with both detectors' scores and gate openings"
                width={1760}
                height={1120}
                caption="E2 tunnel bursts, seed 0."
              />
            </Expand>
          </div>
        </FindingCard>

        {/* ── Finding 3 ── */}
        <FindingCard>
          <FindingHeader number={3} icon={<Layers size={18} />} title="“TENT hurts” is really “batch statistics hurt”" />
          <Prose>
            Always-on TENT lowers clean-stream accuracy from {fmt(core("E1_clean", "never").overall)}% to{" "}
            {fmt(core("E1_clean", "always_tent").overall)}%. To find out why, TENT was split into its two parts and
            both were run with perfect timing. Swapping in the window&apos;s batch statistics reproduces TENT&apos;s
            result exactly. The entropy gradient step contributes nothing in either direction.
          </Prose>
          <Table>
            <thead>
              <tr>
                <th className={th}>Oracle-timed variant</th>
                <th className={th}>Tunnel (shifted windows)</th>
                <th className={th}>Fog (shifted windows)</th>
              </tr>
            </thead>
            <tbody>
              {DECOMP_ROWS.map((p) => (
                <tr key={p} className={p === "oracle_ses" ? "bg-good/5" : undefined}>
                  <td className={`${td} font-sans`}>
                    {p === "oracle_tent"
                      ? "TENT (batch statistics + entropy gradient)"
                      : p === "oracle_ses"
                        ? "Shift-evidence shrinkage (ours)"
                        : POLICY_LABEL[p]}
                  </td>
                  <td className={td}>{fmt(ablation("E2_tunnel_bursts", p).shift)}%</td>
                  <td className={td}>{fmt(ablation("E3_fog_bursts", p).shift)}%</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </FindingCard>

        {/* ── Finding 4 ── */}
        <FindingCard>
          <FindingHeader number={4} icon={<Sigma size={18} />} title="Why: a filmed window holds about 3.5 independent frames" />
          <Prose>
            For each BatchNorm layer, the variance of the window mean was measured on clean validation streams twice:
            once in filmed order and once shuffled. Their ratio gives the window&apos;s effective sample size.
            With 64 frames per window it comes to about <strong className="text-fg">3.5</strong>, and between 3.1 and 4.0
            in every one of the 20 BN layers. Batch statistics from such a window describe the two or three signs in
            view, not the lighting. That is the regime where batch-statistics adaptation is known to fail.
          </Prose>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Chip label="Effective sample size, 64-frame window" value="≈ 3.5" tone="bad" />
            <Chip label="Range over 20 BN layers" value="3.1 – 4.0" tone="neutral" />
            <Chip label="Content noise vs shuffled order" value="≈ 20×" tone="neutral" />
          </div>
          <div className="rounded-xl border border-line bg-bg p-4 text-sm leading-relaxed text-fg/85">
            <p className="mb-2 font-medium text-fg">The trust rule (shift-evidence shrinkage)</p>
            <p className="font-mono text-[13px]">
              d = φ̂ₙ − φ̄, &nbsp; z² = n·d² / V, &nbsp; a = (1 − 1/z²)₊
            </p>
            <p className="font-mono text-[13px]">μ ← μ_src + a·d_μ, &nbsp; σ² ← σ²_src · exp(a·d_σ)</p>
            <p className="mt-3 text-muted">
              φ̂ₙ is the episode average of the window statistics and φ̄, V are their clean mean and content variance.
              With no shift, z² ≈ 1 and a ≈ 0, so the layer keeps its source statistics. Trust grows as the episode
              lengthens. On shuffled streams V is about 20 times smaller, so trust is immediate. This is
              positive-part James–Stein shrinkage towards the source.
            </p>
          </div>
        </FindingCard>

        {/* ── Finding 5 ── */}
        <FindingCard>
          <FindingHeader number={5} icon={<Shuffle size={18} />} title="One rule covers both orderings" />
          <Prose>
            The same corrupted frames were also streamed in shuffled order, so each window holds a broad mix of classes.
            There the new system matches oracle TENT with zero detection delay and beats the original gated TENT, so no
            switch between orderings is needed.
          </Prose>
          <Table>
            <thead>
              <tr>
                <th className={th}>Shuffled stream</th>
                <th className={th}>Never adapt</th>
                <th className={th}>Gated TENT (original)</th>
                <th className={th}>Oracle TENT</th>
                <th className={th}>Ours</th>
                <th className={th}>Delay, original → ours</th>
              </tr>
            </thead>
            <tbody>
              {EXPERIMENTS.slice(0, 3).map((e) => (
                <tr key={e.id}>
                  <td className={`${td} font-sans`}>{e.label}</td>
                  <td className={`${td} text-muted`}>{fmt(shuffled(e.id, "never").overall)}%</td>
                  <td className={td}>{fmt(shuffled(e.id, "gated_tent").overall)}%</td>
                  <td className={td}>{fmt(shuffled(e.id, "oracle_tent").overall)}%</td>
                  <td className={`${td} text-good`}>{fmt(shuffled(e.id, "ours").overall)}%</td>
                  <td className={td}>
                    {shuffled(e.id, "gated_tent").delay
                      ? `${fmt(shuffled(e.id, "gated_tent").delay)} → ${fmt(shuffled(e.id, "ours").delay)}`
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 mb-5 text-xs text-muted">
            The shuffled control was rebuilt so that both orderings contain exactly the same corrupted frames: frames
            are corrupted in filmed order first and then permuted among windows of the same condition. Never-adapt
            therefore scores the same in both orderings.
          </p>
          <Figure
            src="/figures/fig_summary.png"
            alt="Overall accuracy per experiment for all policies, filmed order on the left and shuffled order on the right"
            width={1760}
            height={576}
            caption={`Overall accuracy, filmed order (left) and the same frames shuffled (right). Error bars: std over ${N_SEEDS} seeds.`}
          />
        </FindingCard>

        {/* ── Finding 6 ── */}
        <FindingCard>
          <FindingHeader number={6} icon={<Scale size={18} />} title="Ablations: the detector is the bigger fix" />
          <Table>
            <thead>
              <tr>
                <th className={th}>Variant (filmed order)</th>
                {ABLATION_EXPS.map((e) => (
                  <th key={e.id} className={th}>
                    {e.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ABLATION_ROWS.map((p) => (
                <tr key={p} className={p === "ours" ? "bg-good/5" : undefined}>
                  <td className={`${td} font-sans`}>{p === "ours" ? "New gate + new adapter (ours)" : POLICY_LABEL[p]}</td>
                  {ABLATION_EXPS.map((e) => (
                    <td key={e.id} className={td}>
                      {fmt(ablation(e.id, p).overall)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The old entropy gate caps fog at {fmt(ablation("E3_fog_bursts", "old_gate_ses").overall)}% even with the new
            adapter, so the detector matters most. TENT stays harmful behind any gate. The gate and reset are still
            needed: without them fog drops to {fmt(ablation("E3_fog_bursts", "ses_always_on").overall)}%. The simpler
            BN-EMA adapter behind the new gate is slightly safer on clean and tunnel streams. The shrinkage adapter
            wins on fog and drift, matches TENT on shuffled streams and has nothing to tune.
          </p>
        </FindingCard>

        {/* ── Limitations ── */}
        <FindingCard>
          <FindingHeader number={7} icon={<Gauge size={18} />} title="Limitations & future work" />
          <div className="mb-5">
            <WarnCallout>
              The new detector fires on {fmt(ours.clean)}% of clean test windows against a 5% target, about{" "}
              {fmt(core("E1_clean", "ours").false_alarms, 0)} false openings per clean stream. That costs{" "}
              {Math.abs(paired("E1_clean", "ours").mean_diff).toFixed(1)} points on clean streams. The original
              system&apos;s &quot;never worse&quot; property is traded for recovery under fog and drift.
            </WarnCallout>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
                <AlertTriangle size={12} />
                Known limitations
              </p>
              <ul className="space-y-2">
                {[
                  "Calibration tracks cover 34 of the 43 classes, so the clean threshold transfers imperfectly to test tracks.",
                  `Tunnel bursts do not improve overall (${signed(paired("E2_tunnel_bursts", "ours").mean_diff)} pp). Shifted windows gain, but false alarms cost more. With perfect timing the adapter gains, so the gate is the limit.`,
                  "Exit lag: for about one window after a burst ends, shifted statistics can still be applied to clean frames.",
                  "Three stream seeds, one training seed, synthetic shifts and a single window size of 64.",
                  "Tunnel and fog were re-implemented from the published parameters, so absolute numbers differ slightly from the original run. All comparisons use baselines re-run in the same code.",
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
                Not done yet
              </p>
              <ul className="space-y-2">
                {[
                  "GroupNorm + SAR behind the same gate (needs another training run).",
                  "A photometric-augmentation training baseline (needs another training run).",
                  "Track-level logit averaging.",
                  "More than three seeds, and validation on real dash-camera footage.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-fg/80">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-5 text-sm text-muted">
            Full method, protocol and tables are in the{" "}
            <a href="/report.pdf" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              revised report (PDF)
            </a>
            .
          </p>
        </FindingCard>
      </div>
    </>
  );
}


import Image from "next/image";
import Link from "next/link";
import PipelineDiagram from "@/components/PipelineDiagram";
import { Callout, PageTitle, Section, Stat } from "@/components/ui";
import { core, fmt, staticAcc } from "@/lib/results";

export default function OverviewPage() {
  const clean = staticAcc("clean", 0).toFixed(1);
  const tunnel = staticAcc("tunnel", 2).toFixed(1);
  const fog = staticAcc("fog", 2).toFixed(1);
  const ours = (e: string) => fmt(core(e, "ours").overall);
  const never = (e: string) => fmt(core(e, "never").overall);

  return (
    <>
      <PageTitle
        title="Detect, Trust, then Adapt"
        lead="Evidence-weighted test-time normalisation for temporally correlated traffic-sign streams under tunnel darkness and fog."
      />

      <Section title="Abstract">
        <p>
          A classifier on a vehicle meets temporary shifts such as tunnels and fog. Test-time adaptation can
          recover accuracy without labels, but on streams in filmed order it fails. Always-on TENT lowers
          clean accuracy from {never("E1_clean")}% to {fmt(core("E1_clean", "always_tent").overall)}%, and even
          perfectly timed TENT hurts under tunnel darkness.
        </p>
        <p>
          We trace the failure to two separable causes. First, a window of 64 consecutive frames carries the
          information of only about <strong>3.5 independent frames</strong>, so its batch statistics describe
          which signs are in view, not the lighting. Batch statistics alone reproduce all of TENT&apos;s damage.
          Second, the entropy-based shift detector depends on sign content and misses most tunnel windows.
        </p>
        <p>
          One clean-data calibration fixes both. A content-normalised score of BatchNorm statistics detects every
          shifted segment with near-zero delay. A shift-evidence shrinkage rule moves each BatchNorm channel
          only as far as its displacement exceeds content variation, with no gradients and no tuned
          hyperparameters.
        </p>
        <Callout>
          On held-out filmed-order streams, overall accuracy rises from {never("E3_fog_bursts")}% to{" "}
          {ours("E3_fog_bursts")}% under fog bursts and from {never("E5_slow_fog")}% to {ours("E5_slow_fog")}%
          under fog that never clears. The cost is about one point on clean streams.
        </Callout>
      </Section>

      <Section title="The problem">
        <p>
          A traffic-sign classifier trained on clean images loses accuracy when conditions change. On held-out
          frames, our model drops from {clean}% to {tunnel}% under moderate tunnel darkness and to {fog}% under
          moderate fog. These conditions are temporary: the road returns to normal a few hundred frames later.
        </p>
        <Image
          src="/figures/fig_shifts.png"
          alt="The same traffic signs shown clean, under tunnel darkness and under fog at increasing severity"
          width={1400}
          height={1000}
          className="w-full max-w-2xl rounded-lg border border-line bg-white"
        />
        <p className="text-sm text-muted">Clean images, then tunnel darkness and fog at severities 1 to 3.</p>
      </Section>

      <Section title="Detect → Trust → Adapt → Reset">
        <PipelineDiagram />
        <p className="text-sm text-muted">
          The detector reads only the frozen model, so adaptation can never move its reference. The threshold,
          the reference statistics and the gate settings come from clean validation tracks only. They were
          written to a file before any test stream was built.
        </p>
      </Section>

      <Section title="Dataset and model">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Dataset" value="GTSRB" hint="43 classes, split by track" />
          <Stat label="Classifier" value="ResNet-18" hint="trained on clean data" />
          <Stat label="Input" value="48 × 48" hint="RGB images" />
          <Stat label="Window" value="64 frames" hint="detector and adapter window" />
        </div>
        <p className="text-sm text-muted">
          GTSRB frames come in tracks of about 30 consecutive frames of one sign, so data is split by track to
          avoid near-duplicates between train and test. Full details are in the research report, and the{" "}
          <Link href="/project" className="text-accent hover:underline">
            Project &amp; Files
          </Link>{" "}
          page explains the code, the pipeline and every file in the project package.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/results"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          See the results
        </Link>
        <Link
          href="/demo"
          className="rounded-md border border-line px-4 py-2 text-sm transition-colors hover:border-accent"
        >
          Try the demonstration
        </Link>
        <a
          href="/report.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-line px-4 py-2 text-sm transition-colors hover:border-accent"
        >
          Read the full report (PDF)
        </a>
      </div>
    </>
  );
}

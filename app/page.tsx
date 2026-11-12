import Image from "next/image";
import Link from "next/link";
import PipelineDiagram from "@/components/PipelineDiagram";
import { Callout, PageTitle, Section, Stat } from "@/components/ui";

export default function OverviewPage() {
  return (
    <>
      <PageTitle
        title="Detect, then Adapt"
        lead="Shift-gated test-time adaptation for traffic-sign recognition under tunnel darkness and fog."
      />

      <Section title="Abstract">
        <p>
          A classifier on a vehicle meets temporary changes in its environment, such as tunnels and fog.
          Test-time adaptation can recover accuracy without labels, but adapting all the time can also damage a
          model that was working well. We study whether a shift detector can decide <em>when</em> adaptation
          should run.
        </p>
        <p>
          A ResNet-18 is trained on clean GTSRB images. A frozen copy scores each window of 64 unlabeled frames
          with a Kolmogorov–Smirnov test on prediction entropy. A threshold calibrated on clean validation
          streams drives a persistence gate: while it is open the deployed model adapts with TENT, and when it
          closes the model is reset to its source weights.
        </p>
        <Callout>
          Gating makes test-time adaptation safer, but whether it helps depends on how the incoming batches are
          composed.
        </Callout>
      </Section>

      <Section title="The problem">
        <p>
          A traffic-sign classifier trained on clean images loses accuracy when conditions change. On held-out
          frames, our model drops from 94.1% to 68.6% under moderate tunnel darkness and to 55.5% under
          moderate fog. These conditions are temporary: the road returns to normal a few hundred frames later.
        </p>
        <Image
          src="/figures/fig_shift_examples.png"
          alt="The same traffic signs shown clean, under tunnel darkness at three severities, and under fog at three severities"
          width={2071}
          height={1479}
          className="w-full max-w-2xl rounded-lg border border-line"
        />
        <p className="text-sm text-muted">Clean images, then tunnel darkness and fog at severities 1 to 3.</p>
      </Section>

      <Section title="Detect → Adapt → Reset">
        <PipelineDiagram />
        <p className="text-sm text-muted">
          Everything before the gate uses only the frozen model, so adaptation can never move the detector’s
          reference. The threshold τ and the gate settings come from clean validation data only.
        </p>
      </Section>

      <Section title="Dataset and model">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Dataset" value="GTSRB" hint="43 classes, split by track" />
          <Stat label="Classifier" value="ResNet-18" hint="trained on clean data" />
          <Stat label="Input" value="48 × 48" hint="RGB images" />
          <Stat label="Window" value="64 frames" hint="detector and TENT batch" />
        </div>
        <p className="text-sm text-muted">
          GTSRB frames come in tracks of about 30 consecutive frames of one sign, so data is split by track to
          avoid near-duplicates between train and test. Full details are in the research report.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Try the demonstration
        </Link>
        <Link
          href="/results"
          className="rounded-md border border-line px-4 py-2 text-sm transition-colors hover:border-accent"
        >
          See the results
        </Link>
      </div>
    </>
  );
}

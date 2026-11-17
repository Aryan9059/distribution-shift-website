import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Section, Stat, Table, td, th } from "@/components/ui";
import { CONFIG } from "@/lib/results";

export const metadata: Metadata = {
  title: "Project & Files · Detect, Trust, then Adapt",
  description: "What the project does, how the experiment pipeline runs, and what every file in the project package holds.",
};

/* ─── pipeline: run order, inputs and outputs ───────────────── */
const PIPELINE = [
  {
    cmd: "python train.py",
    title: "Train the classifier",
    body: "ResNet-18 (3×3 stem, no max-pool) for 15 epochs on the clean training tracks, with geometric augmentation. Keeps the checkpoint with the best clean validation accuracy.",
    reads: "GTSRB images",
    writes: "cache/resnet18.pt, out/training_log.csv",
  },
  {
    cmd: "python explore.py",
    title: "Calibrate and explore (validation only)",
    body: "Measures clean-data statistics: thresholds, BN reference statistics and effective sample size. Then compares adapters and detectors on validation streams. Never touches test tracks.",
    reads: "cache/resnet18.pt, ref + calib tracks",
    writes: "cache/calib.pkl, cache/val_streams.pkl, out/explore.log",
  },
  {
    cmd: "python select_cfg.py stat:all ses",
    title: "Choose and freeze the configuration",
    body: "Grid-searches the gate persistence (m, k) for the chosen detector and adapter on the nine validation streams, then writes the winning setting to disk.",
    reads: "cache/calib.pkl, cache/val_streams.pkl",
    writes: "cache/frozen_cfg.json, out/gate_selection_val.csv",
  },
  {
    cmd: "python final.py 0,1,2",
    title: "Run the held-out test streams",
    body: "Builds E1–E5 from test tracks for three stream seeds, in filmed and shuffled order, and runs every policy and ablation. Reads only the frozen configuration. Resumable.",
    reads: "cache/frozen_cfg.json, test tracks",
    writes: "cache/results/*.pkl, out/final.log",
  },
  {
    cmd: "python aggregate.py",
    title: "Tables and figures",
    body: "Collects the per-stream results into mean ± std tables and paired comparisons, and draws the summary bar chart and timelines.",
    reads: "cache/results/*.pkl",
    writes: "out/results.txt, out/fig_summary.png, out/fig_timeline_E2/E3.png",
  },
  {
    cmd: "python static.py",
    title: "Frame-level robustness and report figures",
    body: "Single-frame accuracy under each shift and severity, a HOG + linear-SVM baseline, the training curve, shift examples and calibration histograms.",
    reads: "cache/resnet18.pt, cache/calib.pkl",
    writes: "appends to out/results.txt, out/static_robustness.csv, out/fig_*.png",
  },
];

/* ─── main files ──────────────────────────────────────────────── */
type FileNote = { name: string; note: string; site?: boolean };
type Group = { name: string; files: FileNote[] };

const FILES: Group[] = [
  {
    name: "Code",
    files: [
      { name: "lib.py", note: "Data loading and the track-aware split, the tunnel and fog shifts, and the model definition." },
      {
        name: "core.py",
        note: "The method itself: streams E1–E5, detectors, persistence gate, switchable BatchNorm with the shrinkage adapter, and metrics.",
      },
      { name: "calib.py", note: "Clean-data calibration: thresholds, reference statistics and effective sample size." },
      {
        name: "train.py → final.py",
        note: "The pipeline stages above: train.py, explore.py, select_cfg.py, final.py, aggregate.py and static.py.",
      },
    ],
  },
  {
    name: "Model and configuration",
    files: [
      {
        name: "resnet18_original_geo_aug.pt",
        note: "Trained weights behind every published result. The website's demo runs this model.",
        site: true,
      },
      { name: "normalisation.npz", note: "Per-channel input mean and std of the training split.", site: true },
      { name: "cache/frozen_cfg.json", note: "The validation-selected configuration that final.py reads.", site: true },
    ],
  },
  {
    name: "Results and report",
    files: [
      { name: "out/results.txt", note: "Every result table, mean ± std over three stream seeds.", site: true },
      { name: "out/fig_*.png", note: "Summary chart, E2 and E3 timelines, and shift examples.", site: true },
      { name: "Revised_Report.pdf", note: "The full paper, served on this site as /report.pdf.", site: true },
      { name: "NOVELTY_WRITEUP.md", note: "Plain-language summary of the extension, its results and limitations." },
    ],
  },
];

const SPLIT = [
  { role: "train", images: "15,990", use: "Training the classifier" },
  { role: "ref", images: "2,970", use: "Clean reference statistics for the detector and adapter" },
  { role: "calib", images: "2,310", use: "Thresholds, validation streams and gate selection" },
  { role: "test", images: "5,370", use: "Held-out test streams (179 tracks); used once, by final.py" },
];

function FileGroup({ group }: { group: Group }) {
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted">
        {group.name}
      </div>
      <ul className="divide-y divide-line/60">
        {group.files.map((f) => (
          <li key={f.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-4">
            <span className="break-all font-mono text-[13px] text-fg">
              {f.name}
              {f.site && (
                <span className="ml-2 whitespace-nowrap rounded border border-accent/40 px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wide text-accent">
                  on site
                </span>
              )}
            </span>
            <span className="text-sm leading-relaxed text-muted">{f.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <>
      <PageTitle
        title="Project & Files"
        lead="What the project does, how the experiment pipeline runs from raw images to the published tables, and what every file in the project package holds."
      />

      <Section title="The project in brief">
        <p>
          A traffic-sign classifier on a vehicle meets temporary shifts such as tunnels and fog. We first built a
          detect → adapt → reset loop around TENT. On realistic, filmed-order streams it only matched the
          non-adaptive model. The extension explains why: a 64-frame filmed window holds the information of only
          about 3.5 independent frames, so its batch statistics describe the signs in view rather than the lighting.
        </p>
        <p>
          It then fixes the problem with one clean-data calibration that yields two things: a content-normalised
          shift detector, and a per-channel trust rule (shift-evidence shrinkage) for adapting BatchNorm statistics.
          The resulting <strong>Detect → Trust → Adapt → Reset</strong> system is the first version that beats the
          non-adaptive model under fog and gradual drift.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Dataset" value="GTSRB" hint="43 classes, 48 × 48 RGB" />
          <Stat label="Model" value="ResNet-18" hint="~11 M parameters" />
          <Stat label="Detector" value={CONFIG.detector} hint="content-normalised BN statistics" />
          <Stat label="Gate · adapter" value={`m=${CONFIG.m}, k=${CONFIG.k} · ${CONFIG.adapter.toUpperCase()}`} hint="selected on validation" />
        </div>
      </Section>

      <Section title="Pipeline: how the results are produced">
        <p className="text-sm text-muted">
          Run in this order from the package folder. It takes about 15 minutes on a Colab T4 GPU and about 4 hours on
          CPU. Requirements: <code className="font-mono text-xs">torch torchvision scipy scikit-learn scikit-image pandas matplotlib</code>.
        </p>
        <ol className="space-y-3">
          {PIPELINE.map((s, i) => (
            <li key={s.cmd} className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-accent font-mono text-xs text-accent">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.title}</span>
                <code className="rounded bg-bg px-2 py-0.5 font-mono text-xs text-fg/80">{s.cmd}</code>
              </div>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <p>
                  <span className="text-muted">Reads: </span>
                  <span className="break-words font-mono text-fg/80">{s.reads}</span>
                </p>
                <p>
                  <span className="text-muted">Writes: </span>
                  <span className="break-words font-mono text-fg/80">{s.writes}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-r-lg border-l-2 border-accent bg-panel px-5 py-4 text-sm leading-relaxed">
          <strong>Protocol.</strong> Thresholds, reference statistics and gate settings come from the validation tracks
          (<code className="font-mono text-xs">ref</code>, <code className="font-mono text-xs">calib</code>) only. They are
          written to <code className="font-mono text-xs">cache/frozen_cfg.json</code> before any test stream is built,
          and <code className="font-mono text-xs">final.py</code> reads nothing else. The configuration was kept even
          after its clean-stream cost was seen on test.
        </div>
      </Section>

      <Section title="Data split">
        <p className="text-sm text-muted">
          GTSRB frames come in tracks of about 30 consecutive frames of one sign. The split is made per class over whole
          tracks (seed 42), so no near-duplicate frame appears in two roles.
        </p>
        <Table>
          <thead>
            <tr>
              <th className={th}>Role</th>
              <th className={th}>Images</th>
              <th className={th}>Used for</th>
            </tr>
          </thead>
          <tbody>
            {SPLIT.map((r) => (
              <tr key={r.role}>
                <td className={td}>{r.role}</td>
                <td className={td}>{r.images}</td>
                <td className={`${td} font-sans`}>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="File structure">
        <pre className="overflow-x-auto rounded-lg border border-line bg-panel p-4 font-mono text-xs leading-relaxed text-fg/85">
{`detect_trust_adapt_package/
├── lib.py  core.py  calib.py       shared code and the method
├── train.py … static.py            pipeline stages
├── resnet18_original_geo_aug.pt    trained model
├── normalisation.npz               input mean / std
├── cache/frozen_cfg.json           frozen configuration
├── out/                            results.txt and figures
└── Revised_Report.pdf              the paper`}
        </pre>
        <p className="text-sm text-muted">
          Files marked <span className="text-accent">on site</span> are used directly by this website.
        </p>
        <div className="space-y-4">
          {FILES.map((g) => (
            <FileGroup key={g.name} group={g} />
          ))}
        </div>
      </Section>

      <Section title="How this website uses the package">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg/85">
          <li>
            <code className="font-mono text-xs">out/results.txt</code> is parsed by{" "}
            <code className="font-mono text-xs">backend/scripts/build_results_json.py</code> into the data behind the{" "}
            <Link href="/results" className="text-accent hover:underline">Results</Link> and Overview pages. No number is
            typed by hand.
          </li>
          <li>
            <code className="font-mono text-xs">resnet18_original_geo_aug.pt</code> and{" "}
            <code className="font-mono text-xs">normalisation.npz</code> are installed into the backend by{" "}
            <code className="font-mono text-xs">backend/scripts/export_dta_model.py</code>. It also rebuilds the
            held-out test images for the{" "}
            <Link href="/demo" className="text-accent hover:underline">Demonstration</Link>. Frame-level accuracy there
            matches the published table (clean 94.66%).
          </li>
          <li>
            The figures come from <code className="font-mono text-xs">out/</code>, and the paper is served as{" "}
            <a href="/report.pdf" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              /report.pdf
            </a>
            .
          </li>
        </ul>
      </Section>
    </>
  );
}

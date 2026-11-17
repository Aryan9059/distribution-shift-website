const steps = [
  { n: "1", title: "Incoming window", body: "64 unlabeled frames arrive together, in the order they were filmed." },
  {
    n: "2",
    title: "Frozen ResNet-18",
    body: "A copy of the source model that never changes. It records the per-channel mean and log-variance of every BatchNorm input over the window.",
  },
  {
    n: "3",
    title: "Detect: content-normalised score",
    body: "S = mean z² of those statistics against clean windows, where z divides by the spread that sign content alone produces. Threshold τ = 95th percentile on clean streams.",
  },
  {
    n: "4",
    title: "Persistence gate",
    body: "Opens after m windows above τ and closes after k below it. Validation picked m = 1, k = 1.",
  },
  {
    n: "5",
    title: "Trust, then adapt",
    body: "While open, each BN channel moves from its source statistic by the fraction (1 − 1/z²)₊ of the episode's displacement. No gradients, no learning rate, nothing to tune.",
  },
  {
    n: "6",
    title: "Reset",
    body: "When the gate closes, the episode statistics are discarded and the deployed model is exactly the source model again.",
  },
];

export default function PipelineDiagram() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s) => (
        <li key={s.n} className="relative rounded-lg border border-line bg-panel p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-accent font-mono text-xs text-accent">
              {s.n}
            </span>
            <span className="text-sm font-medium">{s.title}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

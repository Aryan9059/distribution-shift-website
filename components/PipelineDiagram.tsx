const steps = [
  { n: "1", title: "Incoming window", body: "64 unlabeled frames arrive together." },
  { n: "2", title: "Frozen ResNet-18", body: "A copy of the source model that never changes. It scores every frame." },
  { n: "3", title: "Entropy KS detector", body: "Compares the window's prediction entropies with a clean reference: distance D." },
  { n: "4", title: "Persistence gate", body: "Opens after m windows with D above the calibrated threshold τ." },
  { n: "5", title: "Deployed model + TENT", body: "While the gate is open, one TENT step per window updates BatchNorm scale and shift." },
  { n: "6", title: "Reset", body: "When the stream looks clean again, restore the source weights and clear the optimizer." },
];

export default function PipelineDiagram() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s) => (
        <li key={s.n} className="relative rounded-lg border border-line bg-panel p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent font-mono text-xs text-accent">
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

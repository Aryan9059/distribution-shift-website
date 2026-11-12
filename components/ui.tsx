import type { ReactNode } from "react";

export function PageTitle({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <div className="mb-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {lead && <p className="mt-3 max-w-3xl leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}

export function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mb-12">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 leading-relaxed text-fg/90">{children}</div>
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-panel p-5 ${className}`}>{children}</div>;
}

export function Callout({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "warn" }) {
  const border = tone === "accent" ? "border-accent" : "border-warn";
  return (
    <div className={`rounded-r-lg border-l-2 ${border} bg-panel px-5 py-4 text-lg leading-snug`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}

export const th = "border-b border-line bg-panel px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";
export const td = "border-b border-line/60 px-3 py-2 font-mono tabular-nums";

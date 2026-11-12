"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSamples,
  predict,
  type Condition,
  type PredictResponse,
  type Prediction,
  type Sample,
} from "@/lib/api";
import { AlertCircle, Cloud, Moon, Sun, Upload } from "lucide-react";
import type { ReactNode } from "react";

type Source = { kind: "sample"; sample: Sample } | { kind: "upload"; file: File; name: string };

const CONDITIONS: { id: Condition; label: string; icon: ReactNode }[] = [
  { id: "clean", label: "Clean", icon: <Sun size={18} /> },
  { id: "tunnel", label: "Tunnel", icon: <Moon size={18} /> },
  { id: "fog", label: "Fog", icon: <Cloud size={18} /> },
];

function ConditionButton({
  option,
  active,
  onClick,
}: {
  option: { id: Condition; label: string; icon: ReactNode };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-6 py-3 text-sm font-medium transition-all ${
        active
          ? "border-accent bg-accent/10 text-accent shadow-sm"
          : "border-line bg-panel text-muted hover:border-muted hover:text-fg"
      }`}
    >
      <span className={active ? "text-accent" : "text-muted"}>{option.icon}</span>
      <span>{option.label}</span>
    </button>
  );
}

function SeverityDot({ level, active, onClick }: { level: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`Severity ${level}`}
      className={`h-7 w-7 rounded-full border-2 text-xs font-bold transition-all ${
        active
          ? "border-accent bg-accent text-white shadow-sm"
          : "border-line bg-panel text-muted hover:border-muted"
      }`}
    >
      {level}
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-line bg-panel px-4 py-2 text-center">
      <span className="text-xs text-muted">{label}</span>
      <span className="mt-0.5 font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function ConfidenceBar({ prob }: { prob: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-accent transition-all duration-500"
        style={{ width: `${Math.max(1, prob * 100)}%` }}
      />
    </div>
  );
}

function PredictionCard({
  title,
  badge,
  p,
  maxEntropy,
  highlight,
}: {
  title: string;
  badge?: string;
  p: Prediction;
  maxEntropy: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col rounded-2xl border-2 p-5 transition-all ${
        highlight ? "border-accent/40 bg-accent/5" : "border-line bg-panel"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</span>
        {badge && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            {badge}
          </span>
        )}
      </div>

      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image}
          alt={title}
          width={112}
          height={112}
          className="pixelated h-28 w-28 flex-shrink-0 rounded-xl border border-line object-contain"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-3 font-semibold leading-tight">{p.class_name}</div>
          <div className="flex flex-wrap gap-2">
            <StatBadge label="Confidence" value={`${(p.confidence * 100).toFixed(1)}%`} />
            <StatBadge label="Entropy" value={`${p.entropy.toFixed(2)} / ${maxEntropy.toFixed(2)}`} />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Top predictions</p>
        {p.top5.map((t) => (
          <div key={t.class_id}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="truncate text-fg">{t.class_name}</span>
              <span className="ml-2 flex-shrink-0 font-mono text-muted">{(t.prob * 100).toFixed(1)}%</span>
            </div>
            <ConfidenceBar prob={t.prob} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SingleImageDemo() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [condition, setCondition] = useState<Condition>("tunnel");
  const [severity, setSeverity] = useState(2);
  const [result, setResult] = useState<{ key: string; data: PredictResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const sourceKey = !source
    ? ""
    : source.kind === "upload"
      ? `u:${source.name}:${source.file.size}:${source.file.lastModified}`
      : `s:${source.sample.sample_id}`;
  const currentKey = `${sourceKey}|${condition}|${severity}`;
  const loading = result?.key !== currentKey;

  useEffect(() => {
    getSamples()
      .then((s) => {
        setSamples(s);
        setSource((cur) => cur ?? (s[0] ? { kind: "sample", sample: s[0] } : null));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!source) return;
    const id = ++requestId.current;
    predict(
      source.kind === "upload" ? { file: source.file } : { sampleId: source.sample.sample_id },
      condition,
      severity,
    )
      .then((r) => {
        if (id !== requestId.current) return;
        setResult({ key: currentKey, data: r });
        setError(null);
      })
      .catch((e: Error) => id === requestId.current && setError(e.message));
  }, [source, condition, severity, currentKey]);

  return (
    <div className="space-y-6">
      {/* Controls card */}
      <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
        {/* Condition picker */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Condition</p>
          <div className="flex flex-wrap gap-3">
            {CONDITIONS.map((c) => (
              <ConditionButton
                key={c.id}
                option={c}
                active={condition === c.id}
                onClick={() => setCondition(c.id)}
              />
            ))}
          </div>
        </div>

        {/* Severity + Upload row */}
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Severity</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <SeverityDot key={n} level={n} active={severity === n} onClick={() => setSeverity(n)} />
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent">
            <Upload size={14} />
            Upload your image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSource({ kind: "upload", file: f, name: f.name });
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {source?.kind === "upload" && (
          <p className="mt-3 text-xs text-muted">
            Using: <span className="font-medium text-fg">{source.name}</span> — tightly cropped signs work
            best (resized to 48 × 48 internally).
          </p>
        )}
      </div>

      {/* Sample thumbnails */}
      {samples.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Sample images</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sample images">
            {samples.map((s) => {
              const active = source?.kind === "sample" && source.sample.sample_id === s.sample_id;
              return (
                <button
                  key={s.sample_id}
                  type="button"
                  onClick={() => setSource({ kind: "sample", sample: s })}
                  title={s.class_name}
                  aria-label={`Use sample: ${s.class_name}`}
                  aria-pressed={active}
                  className={`rounded-xl border-2 p-1 transition-all hover:scale-105 ${
                    active ? "border-accent shadow-sm shadow-accent/30" : "border-line hover:border-muted"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" width={44} height={44} className="pixelated h-11 w-11 rounded-lg" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-bad/50 bg-bad/10 px-4 py-3 text-sm text-bad">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
        </p>
      )}

      {/* Loading */}
      {!result && !error && (
        <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-muted">
          <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading…
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={`flex flex-wrap gap-4 transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
          <PredictionCard title="Original" p={result.data.original} maxEntropy={result.data.max_entropy} />
          <PredictionCard
            title="Corrupted"
            badge={condition !== "clean" ? `${condition} · sev ${severity}` : "none applied"}
            p={result.data.corrupted}
            maxEntropy={result.data.max_entropy}
            highlight={condition !== "clean"}
          />
        </div>
      )}
    </div>
  );
}

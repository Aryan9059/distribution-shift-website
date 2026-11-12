"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getScenarios,
  resetSimulation,
  startSimulation,
  stepSimulation,
  type Order,
  type Scenario,
  type StartResponse,
  type WindowResult,
} from "@/lib/api";
import { Panel, Stat } from "@/components/ui";

type Status = "idle" | "running" | "paused" | "done";

const STEP_DELAY_MS = 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function StreamDemo() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenario, setScenario] = useState("E2_tunnel_bursts");
  const [order, setOrder] = useState<Order>("correlated");
  const [session, setSession] = useState<StartResponse | null>(null);
  const [history, setHistory] = useState<WindowResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const running = useRef(false);
  const sessionRef = useRef<StartResponse | null>(null);

  useEffect(() => {
    getScenarios()
      .then(setScenarios)
      .catch((e: Error) => setError(e.message));
    return () => {
      running.current = false; // stop the loop if the page is left
    };
  }, []);

  const loop = useCallback(async () => {
    running.current = true;
    setStatus("running");
    try {
      while (running.current && sessionRef.current) {
        const r = await stepSimulation(sessionRef.current.session_id);
        if (r.window === undefined) {
          setStatus("done");
          break;
        }
        setHistory((h) => [...h, r]);
        if (r.done) {
          setStatus("done");
          break;
        }
        await sleep(STEP_DELAY_MS);
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus("paused");
    } finally {
      running.current = false;
    }
  }, []);

  const start = async () => {
    setError(null);
    try {
      let s = sessionRef.current;
      if (!s || s.scenario !== scenario || s.order !== order) {
        s = await startSimulation(scenario, order);
        sessionRef.current = s;
        setSession(s);
        setHistory([]);
      }
      void loop();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pause = () => {
    running.current = false;
    setStatus("paused");
  };

  const reset = async () => {
    running.current = false;
    setError(null);
    setHistory([]);
    setStatus("idle");
    if (sessionRef.current) {
      try {
        setSession(await resetSimulation(sessionRef.current.session_id));
      } catch (e) {
        setError((e as Error).message);
        sessionRef.current = null;
        setSession(null);
      }
    }
  };

  const last = history.at(-1);
  const total = session?.total_windows ?? 0;

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        w: h.window,
        ks: h.ks,
        gate: h.gate_open ? 1 : 0,
        shift: h.shifted ? 1 : 0,
      })),
    [history],
  );

  const events = useMemo(() => {
    const out: string[] = [];
    history.forEach((h, i) => {
      const prev = history[i - 1];
      if (h.adapting && !prev?.adapting) out.push(`Window ${h.window + 1}: gate opened, TENT started`);
      if (h.just_reset) out.push(`Window ${h.window + 1}: gate closed, model reset to source weights`);
    });
    return out.slice(-5).reverse();
  }, [history]);

  const idle = status === "idle";

  return (
    <Panel>
      <p className="mb-4 text-sm text-muted">
        Runs a predefined stream through the real backend, one window of 64 frames at a time: the frozen model
        scores the window, the gate decides, and TENT runs only while the gate is open. Every value below comes
        from the backend. Labels are used only to report accuracy, never by the detector or TENT.
      </p>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Scenario</span>
          <select
            value={scenario}
            disabled={!idle}
            onChange={(e) => setScenario(e.target.value)}
            className="rounded-md border border-line bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {scenarios.length === 0 && <option value={scenario}>{scenario}</option>}
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <span className="mb-1 block text-xs text-muted">Stream ordering</span>
          <div className="inline-flex overflow-hidden rounded-md border border-line">
            {(["correlated", "shuffled"] as const).map((o) => (
              <button
                key={o}
                type="button"
                disabled={!idle}
                aria-pressed={order === o}
                onClick={() => setOrder(o)}
                className={`px-3 py-1.5 capitalize transition-colors disabled:opacity-50 ${
                  order === o ? "bg-accent text-white" : "text-muted hover:text-fg"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {status === "running" ? (
            <button type="button" onClick={pause} className="rounded-md border border-line px-4 py-1.5 text-sm hover:border-accent">
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={status === "done"}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {status === "paused" ? "Resume" : "Start"}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            disabled={idle && history.length === 0}
            className="rounded-md border border-line px-4 py-1.5 text-sm hover:border-accent disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>

      {scenarios.find((s) => s.id === scenario) && (
        <p className="mt-3 text-xs text-muted">{scenarios.find((s) => s.id === scenario)?.description}</p>
      )}
      <p className="mt-1 text-xs text-muted">
        Correlated: tracks in driving order, so a window holds only a few signs. Shuffled: the same frames in
        random order.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-bad/50 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Current window"
          value={last ? `${last.window + 1} / ${total}` : `– / ${total || "–"}`}
          hint={last ? `${last.condition}${last.shifted ? ` · severity ${last.severity.toFixed(1)}` : ""}` : undefined}
        />
        <Stat label="KS distance" value={last ? last.ks.toFixed(3) : "–"} hint={last?.alarm ? "above threshold" : undefined} />
        <Stat label="Threshold τ" value={(session?.threshold ?? 0) ? session!.threshold.toFixed(3) : "–"} hint="calibrated on clean streams" />
        <Stat
          label="Gate"
          value={last ? <span className={last.gate_open ? "text-warn" : ""}>{last.gate_open ? "Open" : "Closed"}</span> : "–"}
          hint={session ? `opens after ${session.gate_m}, closes after ${session.gate_k}` : undefined}
        />
        <Stat
          label="TENT"
          value={last ? <span className={last.adapting ? "text-warn" : ""}>{last.adapting ? "Active" : "Inactive"}</span> : "–"}
          hint={last ? `${last.tent_steps} steps since last reset` : undefined}
        />
        <Stat
          label="Model"
          value={last ? <span className={last.model_state === "adapted" ? "text-warn" : ""}>{last.model_state === "adapted" ? "Adapted" : "Source weights"}</span> : "–"}
          hint={last?.just_reset ? "just reset" : undefined}
        />
      </div>

      <div className="mt-6 h-64 w-full" role="img" aria-label="KS distance over stream windows with threshold and gate state">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#1f2c47" strokeDasharray="3 3" />
            <XAxis
              dataKey="w"
              type="number"
              domain={[0, Math.max(1, total - 1)]}
              tick={{ fill: "#8da2c4", fontSize: 11 }}
              stroke="#1f2c47"
              label={{ value: "stream window (64 frames each)", position: "insideBottom", offset: -2, fill: "#8da2c4", fontSize: 11 }}
              height={36}
            />
            <YAxis domain={[0, 1]} tick={{ fill: "#8da2c4", fontSize: 11 }} stroke="#1f2c47" width={44} />
            <Tooltip
              contentStyle={{ background: "#101a2e", border: "1px solid #1f2c47", borderRadius: 6, fontSize: 12 }}
              formatter={(v, name) => [name === "ks" ? Number(v).toFixed(3) : v === 1 ? "yes" : "no", name === "ks" ? "KS distance" : name === "gate" ? "gate open" : "true shift"]}
              labelFormatter={(l) => `window ${Number(l) + 1}`}
            />
            <Area type="stepAfter" dataKey="shift" fill="#8da2c4" stroke="none" fillOpacity={0.12} isAnimationActive={false} />
            <Area type="stepAfter" dataKey="gate" fill="#4f8cff" stroke="none" fillOpacity={0.3} isAnimationActive={false} />
            <Line type="monotone" dataKey="ks" stroke="#e8edf7" strokeWidth={1.8} dot={false} isAnimationActive={false} />
            {session && <ReferenceLine y={session.threshold} stroke="#ef6a6a" strokeDasharray="5 4" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span><span className="mr-1 inline-block h-0.5 w-4 bg-fg align-middle" />KS distance</span>
        <span><span className="mr-1 inline-block h-0.5 w-4 border-t border-dashed border-bad align-middle" />threshold τ</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 bg-accent/40 align-middle" />gate open</span>
        <span><span className="mr-1 inline-block h-2.5 w-4 bg-muted/20 align-middle" />true shifted windows (for reference)</span>
      </div>

      {last && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-muted">Frames in the current window</div>
            <div className="flex flex-wrap gap-1">
              {last.thumbnails.map((t, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={t} alt="" width={48} height={48} className="pixelated h-12 w-12 rounded border border-line" />
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Accuracy, this window</dt>
              <dd className="font-mono">
                {(last.acc_deployed * 100).toFixed(0)}% <span className="text-muted">(source {(last.acc_source * 100).toFixed(0)}%)</span>
              </dd>
              <dt className="text-muted">Accuracy, so far</dt>
              <dd className="font-mono">
                {(last.mean_acc_deployed * 100).toFixed(1)}% <span className="text-muted">(source {(last.mean_acc_source * 100).toFixed(1)}%)</span>
              </dd>
              <dt className="text-muted">Adapted windows</dt>
              <dd className="font-mono">{last.adapt_windows}</dd>
              <dt className="text-muted">False gate openings</dt>
              <dd className="font-mono">{last.false_alarms}</dd>
              <dt className="text-muted">Resets</dt>
              <dd className="font-mono">{last.resets}</dd>
            </dl>
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-muted">Recent events</div>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No gate activity yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {events.map((e) => (
                  <li key={e} className="font-mono text-xs">{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {status === "done" && last && (
        <p className="mt-5 rounded-md border border-line px-3 py-2 text-sm text-muted">
          Finished. Mean accuracy {(last.mean_acc_deployed * 100).toFixed(1)}% for the deployed model versus{" "}
          {(last.mean_acc_source * 100).toFixed(1)}% for the never-adapt source model. Press Reset to try another
          scenario or ordering.
        </p>
      )}
    </Panel>
  );
}

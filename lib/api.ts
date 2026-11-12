export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Condition = "clean" | "tunnel" | "fog";
export type Order = "correlated" | "shuffled";

export type Prediction = {
  image: string;
  class_id: number;
  class_name: string;
  confidence: number;
  entropy: number;
  top5: { class_id: number; class_name: string; prob: number }[];
};

export type PredictResponse = {
  size: number;
  condition: Condition;
  severity: number;
  max_entropy: number;
  original: Prediction;
  corrupted: Prediction;
};

export type Sample = { sample_id: number; class_id: number; class_name: string; image: string };
export type Scenario = { id: string; label: string; description: string };

export type StartResponse = {
  session_id: string;
  total_windows: number;
  threshold: number;
  gate_m: number;
  gate_k: number;
  window_size: number;
  scenario: string;
  order: Order;
};

export type WindowResult = {
  window: number;
  condition: Condition;
  severity: number;
  shifted: boolean;
  ks: number;
  p_value: number;
  threshold: number;
  alarm: boolean;
  gate_open: boolean;
  adapting: boolean;
  just_reset: boolean;
  model_state: "adapted" | "source";
  tent_steps: number;
  acc_deployed: number;
  acc_source: number;
  thumbnails: string[];
  done: boolean;
  processed: number;
  total: number;
  mean_acc_deployed: number;
  mean_acc_source: number;
  adapt_windows: number;
  false_alarms: number;
  resets: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(
      `Cannot reach the backend at ${API_URL}. Start it with "uvicorn app.main:app --port 8000" in the backend folder.`,
    );
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const getSamples = () => request<Sample[]>("/samples?n=12");
export const getScenarios = () => request<Scenario[]>("/simulation/scenarios");

export function predict(
  input: { file?: File; sampleId?: number },
  condition: Condition,
  severity: number,
) {
  const body = new FormData();
  if (input.file) body.append("file", input.file);
  if (input.sampleId !== undefined) body.append("sample_id", String(input.sampleId));
  body.append("condition", condition);
  body.append("severity", String(severity));
  return request<PredictResponse>("/predict", { method: "POST", body });
}

export const startSimulation = (scenario: string, order: Order) =>
  request<StartResponse>("/simulation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, order, seed: 0 }),
  });

export const stepSimulation = (id: string) =>
  request<WindowResult>(`/simulation/${id}/step`, { method: "POST" });

export const resetSimulation = (id: string) =>
  request<StartResponse>(`/simulation/${id}/reset`, { method: "POST" });

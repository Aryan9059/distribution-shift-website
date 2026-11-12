"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type BarSeries = { key: string; label: string; color: string };

/** Grouped bar chart of accuracies (0-100). `data` rows need a `name` plus one numeric field per series key. */
export default function BarCompare({
  data,
  series,
  height = 260,
  label,
}: {
  data: Record<string, string | number>[];
  series: BarSeries[];
  height?: number;
  label: string;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1f2c47" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#8da2c4", fontSize: 12 }} stroke="#1f2c47" />
          <YAxis domain={[0, 100]} tick={{ fill: "#8da2c4", fontSize: 11 }} stroke="#1f2c47" unit="%" width={48} />
          <Tooltip
            cursor={{ fill: "#ffffff08" }}
            contentStyle={{ background: "#101a2e", border: "1px solid #1f2c47", borderRadius: 6, fontSize: 12 }}
            formatter={(v) => `${Number(v).toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#8da2c4" }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { cn } from '@/utils/cn';
import { getAnalytics, getRegions } from '@/services/apiClient';
import type { CloudRegion } from '@/types';

const COLORS = ['#0d9488', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

export function AnalyticsAPI() {
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(90);
  const [region, setRegion] = useState<CloudRegion>('eu-central-1');
  const [regions, setRegions] = useState<Array<any>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRegions();
        if (cancelled) return;
        setRegions(r);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await getAnalytics({ region_id: region, days: timeRange });
        if (cancelled) return;
        setData(resp);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load analytics');
        setData(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region, timeRange]);

  const pieData = useMemo(() => {
    const items = (data?.model_breakdown ?? []) as Array<any>;
    const total = items.reduce((s, m) => s + Number(m.co2e_grams ?? 0), 0);
    if (total <= 0) return [];
    return items.slice(0, 8).map((m) => ({
      name: String(m.display_name).split('(')[0].trim(),
      value: Math.round((Number(m.co2e_grams) / total) * 1000) / 10,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  const timeSeries = (data?.time_series ?? []) as Array<any>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Sustainability Analytics</h1>
          <p className="mt-0.5 text-xs text-slate-500">All analytics derived from MySQL calculation logs</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as CloudRegion)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-teal-600 focus:outline-none flex-1 sm:flex-initial"
          >
            {regions.map((r: any) => (
              <option key={r.id} value={r.region_id}>{r.location}</option>
            ))}
          </select>
          <div className="flex rounded-md border border-slate-200 bg-white flex-shrink-0">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setTimeRange(d)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  timeRange === d ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {timeSeries.every((p: any) => Number(p.requests ?? 0) === 0) ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 sm:p-12 text-center">
          <p className="text-[13px] text-slate-500">No analytics available yet. Run calculations to generate logs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800">CO₂e Emissions Trend</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Daily grams CO₂e</p>
            <div className="mt-3 h-48 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries.map((p: any) => ({ date: p.date, co2eGrams: p.co2e_grams }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#94a3b8' }} tickFormatter={(d: string) => d.slice(5)} interval={Math.floor(timeRange / 6)} />
                  <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} width={45} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="co2eGrams" stroke="#2563eb" fill="#2563eb" fillOpacity={0.06} strokeWidth={1.5} name="CO₂e (g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800">Emissions by Model</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Share of total CO₂e</p>
            <div className="mt-3 h-48 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={1} stroke="none">
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0' }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Share']} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

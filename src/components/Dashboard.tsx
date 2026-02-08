import { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight, RefreshCw
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getDashboardMetrics, getModels } from '@/services/apiClient';
import type { NavSection } from '@/types';

function getGradeBgClass(grade?: string) {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'B':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'C':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'D':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'F':
      return 'bg-red-50 text-red-700 border border-red-200';
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
}

interface DashboardProps {
  onNavigate: (section: NavSection) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [energyWindowDays, setEnergyWindowDays] = useState<'today' | 7 | 30>(30);
  const [prevLatestPoint, setPrevLatestPoint] = useState<{ energyKwh: number; co2eGrams: number } | null>(null);
  const [latestPointSnapshot, setLatestPointSnapshot] = useState<{ energyKwh: number; co2eGrams: number } | null>(null);

  async function loadDashboardData(mode: 'initial' | 'refresh' = 'initial') {
    try {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);

      const [dashboardMetrics, modelsResponse] = await Promise.all([
        getDashboardMetrics(),
        getModels(),
      ]);

      const ts30d = (dashboardMetrics?.time_series_30d ?? []) as Array<any>;
      const lastPoint = ts30d.length ? ts30d[ts30d.length - 1] : null;

      if (lastPoint) {
        const nextLatest = {
          energyKwh: Number(lastPoint.energy_kwh ?? 0),
          co2eGrams: Number(lastPoint.co2e_grams ?? 0),
        };
        setPrevLatestPoint(latestPointSnapshot);
        setLatestPointSnapshot(nextLatest);
      }

      setMetrics({
        ...dashboardMetrics,
        models: modelsResponse.models,
      });
      setLastUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboardData('initial');
  }, []);

  useEffect(() => {
    if (energyWindowDays !== 'today') return;

    let intervalId: number | undefined;

    const tick = () => {
      if (document.hidden) return;
      if (refreshing) return;
      loadDashboardData('refresh');
    };

    intervalId = window.setInterval(tick, 10_000);

    const onVisibilityChange = () => {
      if (!document.hidden) tick();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [energyWindowDays, refreshing]);

  const trendIcon = useMemo(() => {
    if (metrics?.trend_direction === 'improving') {
      return <TrendingDown className="h-3.5 w-3.5 text-teal-600" />;
    }
    if (metrics?.trend_direction === 'degrading') {
      return <TrendingUp className="h-3.5 w-3.5 text-red-600" />;
    }
    return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  }, [metrics?.trend_direction]);

  const last30Days = useMemo(() => {
    const ts = (metrics?.time_series_30d ?? []) as Array<any>;
    if (ts.length > 0) {
      return ts.map((p) => ({
        date: String(p.date),
        energyKwh: Number(p.energy_kwh ?? 0),
        co2eGrams: Number(p.co2e_grams ?? 0),
      }));
    }

    return [];
  }, [metrics]);

  const todayHours = useMemo(() => {
    const ts = (metrics?.time_series_today ?? []) as Array<any>;
    if (ts.length > 0) {
      return ts.map((p) => ({
        hour: String(p.hour),
        energyKwh: Number(p.energy_kwh ?? 0),
        co2eGrams: Number(p.co2e_grams ?? 0),
      }));
    }

    return [];
  }, [metrics]);

  const latest30dPoint = useMemo(() => {
    if (!last30Days.length) return null;
    return last30Days[last30Days.length - 1];
  }, [last30Days]);

  const energySeries = useMemo(() => {
    if (energyWindowDays === 'today') {
      return todayHours;
    }

    const days = energyWindowDays;
    if (!last30Days.length) return [];
    return last30Days.slice(Math.max(0, last30Days.length - days));
  }, [energyWindowDays, last30Days, todayHours]);

  const latestDelta = useMemo(() => {
    if (!latest30dPoint || !prevLatestPoint) return null;
    return {
      energyKwh: latest30dPoint.energyKwh - prevLatestPoint.energyKwh,
      co2eGrams: latest30dPoint.co2eGrams - prevLatestPoint.co2eGrams,
    };
  }, [latest30dPoint, prevLatestPoint]);

  const modelBreakdown = useMemo(() => {
    const usage = (metrics?.model_usage ?? []) as Array<any>;
    if (usage.length > 0) {
      return usage.map((u) => ({
        modelId: u.model_id,
        displayName: u.display_name,
        requests: Number(u.requests ?? 0),
        energyKwh: Number(u.energy_kwh ?? 0),
        co2eGrams: Number(u.co2e_grams ?? 0),
        waterLiters: Number(u.water_liters ?? 0),
        ecoScore: Number(u.avg_eco_score ?? 0),
        ecoGrade: String(u.eco_grade ?? 'F'),
        qualityScore: Number(u.quality_score ?? 0),
      }));
    }

    return [];
  }, [metrics?.model_usage, metrics?.models]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-600">{error || 'Failed to load dashboard'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Environmental Impact Dashboard</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Last 30 days · {metrics?.models?.length || 0} active models · {Number(metrics?.total_requests ?? 0).toLocaleString()} requests
            {lastUpdatedAt ? (
              <span className="text-slate-400"> · Updated {lastUpdatedAt.toLocaleTimeString()}</span>
            ) : null}
          </p>
          {latest30dPoint ? (
            <p className="mt-1 text-[11px] text-slate-400">
              Today ({latest30dPoint.date}): {latest30dPoint.energyKwh.toFixed(3)} kWh · {latest30dPoint.co2eGrams.toFixed(1)} g CO₂e
              {latestDelta ? (
                <span className="text-slate-400">
                  {' '}· Δ {latestDelta.energyKwh >= 0 ? '+' : ''}{latestDelta.energyKwh.toFixed(3)} kWh, {latestDelta.co2eGrams >= 0 ? '+' : ''}{latestDelta.co2eGrams.toFixed(1)} g
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 self-start flex-shrink-0">
          <button
            onClick={() => loadDashboardData('refresh')}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing ? 'animate-spin' : '')} />
            <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
            {trendIcon}
            <span>
              Footprint {metrics.trend_direction === 'improving' ? 'decreasing' : metrics.trend_direction === 'degrading' ? 'increasing' : 'stable'}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Energy Consumed"
          value={`${Number(metrics.total_energy_kwh ?? 0).toFixed(1)}`}
          unit="kWh"
          change={metrics.period_comparison?.energyChange}
          sublabel="30-day total"
        />
        <MetricCard
          label="CO₂e Emissions"
          value={`${Number(metrics.total_co2e_kg ?? 0).toFixed(1)}`}
          unit="kg"
          change={metrics.period_comparison?.co2eChange}
          sublabel="30-day total"
        />
        <MetricCard
          label="Water Usage"
          value={`${Number(metrics.total_water_liters ?? 0).toFixed(0)}`}
          unit="L"
          sublabel="Cooling + facility"
        />
        <MetricCard
          label="Avg EcoScore"
          value={`${Number(metrics.avg_eco_score ?? 0).toFixed(1)}`}
          unit="/100"
          sublabel="Weighted sustainability"
        />
      </div>

      {/* Alert Banner */}
      {metrics.trend_direction === 'degrading' && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-800">Emissions trending upward</p>
            <p className="mt-0.5 text-xs text-amber-700">
              CO₂e increased {metrics.period_comparison?.co2eChange ?? 0}% vs. prior period.
              Requests grew {metrics.period_comparison?.requestsChange ?? 0}%. Consider reviewing high-impact model usage.
            </p>
            <button
              onClick={() => onNavigate('analytics')}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900"
            >
              View detailed analytics <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] font-medium text-slate-800">Energy Consumption ({energyWindowDays === 'today' ? 'Today' : `${energyWindowDays}d`})</h3>
              <p className="mt-0.5 text-[11px] text-slate-400">Daily kWh across all models</p>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-[11px] text-slate-600">
              <button
                type="button"
                onClick={() => setEnergyWindowDays('today')}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  energyWindowDays === 'today' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setEnergyWindowDays(7)}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  energyWindowDays === 7 ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                )}
              >
                7d
              </button>
              <button
                type="button"
                onClick={() => setEnergyWindowDays(30)}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  energyWindowDays === 30 ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                )}
              >
                30d
              </button>
            </div>
          </div>
          <div className="mt-3 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey={energyWindowDays === 'today' ? 'hour' : 'date'}
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(d: string) => (energyWindowDays === 'today' ? d : d.slice(5))}
                  interval={energyWindowDays === 'today' ? 0 : energyWindowDays === 7 ? 0 : 6}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}`}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 4,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const v = typeof value === 'number' ? value : 0;
                    const n = String(name);
                    return [
                      `${v.toFixed(3)} ${n === 'energyKwh' ? 'kWh' : 'g'}`,
                      n === 'energyKwh' ? 'Energy' : 'CO₂e',
                    ];
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(label: any) =>
                    energyWindowDays === 'today' ? `Hour: ${String(label)}` : `Date: ${String(label)}`
                  }
                />
                <Area
                  type="monotone"
                  dataKey="energyKwh"
                  stroke="#0d9488"
                  fill="#0d9488"
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-slate-800">Impact by Model</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">CO₂e emissions (30d estimate)</p>
          <div className="mt-3 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelBreakdown.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}kg`}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  tick={{ fontSize: 8, fill: '#64748b' }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 4,
                    border: '1px solid #e2e8f0',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${(Number(value) / 1000).toFixed(2)} kg CO₂e`, 'Emissions']}
                />
                <Bar dataKey="co2eGrams" radius={[0, 2, 2, 0]}>
                  {modelBreakdown.slice(0, 6).map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.ecoScore >= 70
                          ? '#0d9488'
                          : entry.ecoScore >= 50
                          ? '#d97706'
                          : '#dc2626'
                      }
                      fillOpacity={0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[13px] font-medium text-slate-800">Model Usage Overview</h3>
        </div>

        {/* Mobile card view */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {modelBreakdown.map((m) => (
            <div key={m.modelId} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-800 truncate pr-2">{m.displayName}</p>
                <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0', getGradeBgClass(m.ecoGrade))}>
                  {m.ecoGrade} ({m.ecoScore.toFixed(0)})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div>
                  <span className="text-slate-400">Requests: </span>
                  <span className="text-slate-700">{m.requests.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Energy: </span>
                  <span className="text-slate-700">{m.energyKwh.toFixed(2)} kWh</span>
                </div>
                <div>
                  <span className="text-slate-400">CO₂e: </span>
                  <span className="text-slate-700">{m.co2eGrams.toFixed(1)} g</span>
                </div>
                <div>
                  <span className="text-slate-400">Quality: </span>
                  <span className="text-slate-700">{m.qualityScore}/100</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider">Model</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider">Requests</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider">Energy (kWh)</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider">CO₂e (g)</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider">Water (L)</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider">EcoScore</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {modelBreakdown.map((m) => (
                <tr key={m.modelId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{m.displayName}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{m.requests.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{m.energyKwh.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{m.co2eGrams.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{m.waterLiters.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', getGradeBgClass(m.ecoGrade))}>
                      {m.ecoGrade} ({m.ecoScore.toFixed(0)})
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{m.qualityScore}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  change,
  sublabel,
}: {
  label: string;
  value: string;
  unit: string;
  change?: number;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11px] text-slate-500">{label}</p>
        {change !== undefined && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[10px] font-medium',
              change > 0 ? 'text-red-600' : change < 0 ? 'text-teal-600' : 'text-slate-400'
            )}
          >
            {change > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : change < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <span className="text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums">{value}</span>
        <span className="ml-1 text-xs text-slate-400">{unit}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-slate-400">{sublabel}</p>
    </div>
  );
}

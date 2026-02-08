import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { generateTimeSeriesData, generateDashboardMetrics, generateModelUsageBreakdown, DEMO_ORG } from '@/engine/simulation';
import { getGradeBgClass } from '@/engine/calculator';
import type { NavSection } from '@/types';

interface DashboardProps {
  onNavigate: (section: NavSection) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const timeSeries = useMemo(() => generateTimeSeriesData(90), []);
  const metrics = useMemo(() => generateDashboardMetrics(timeSeries), [timeSeries]);
  const modelBreakdown = useMemo(() => generateModelUsageBreakdown(), []);

  const trendIcon = metrics.trendDirection === 'improving'
    ? <TrendingDown className="h-3.5 w-3.5 text-teal-600" />
    : metrics.trendDirection === 'degrading'
    ? <TrendingUp className="h-3.5 w-3.5 text-red-600" />
    : <Minus className="h-3.5 w-3.5 text-slate-400" />;

  const last30Days = timeSeries.slice(-30);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Environmental Impact Dashboard</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {DEMO_ORG.name} · Last 30 days · {DEMO_ORG.projects.length} active projects
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 self-start flex-shrink-0">
          {trendIcon}
          <span>
            Footprint {metrics.trendDirection === 'improving' ? 'decreasing' : metrics.trendDirection === 'degrading' ? 'increasing' : 'stable'}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Energy Consumed"
          value={`${metrics.totalEnergyKwh.toFixed(1)}`}
          unit="kWh"
          change={metrics.periodComparison.energyChange}
          sublabel="30-day total"
        />
        <MetricCard
          label="CO₂e Emissions"
          value={`${metrics.totalCO2eKg.toFixed(1)}`}
          unit="kg"
          change={metrics.periodComparison.co2eChange}
          sublabel="Location-based (Scope 2)"
        />
        <MetricCard
          label="Water Usage"
          value={`${metrics.totalWaterLiters.toFixed(0)}`}
          unit="liters"
          change={metrics.periodComparison.energyChange}
          sublabel="Facility + server cooling"
        />
        <MetricCard
          label="Avg EcoScore"
          value={`${metrics.avgEcoScore.toFixed(1)}`}
          unit="/ 100"
          sublabel="Weighted composite"
        />
      </div>

      {/* Alert Banner */}
      {metrics.trendDirection === 'degrading' && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-800">Emissions trending upward</p>
            <p className="mt-0.5 text-xs text-amber-700">
              CO₂e increased {metrics.periodComparison.co2eChange}% vs. prior period.
              Requests grew {metrics.periodComparison.requestsChange}%. Consider reviewing high-impact model usage.
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
          <h3 className="text-[13px] font-medium text-slate-800">Energy Consumption (30d)</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">Daily kWh across all models</p>
          <div className="mt-3 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last30Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(d: string) => d.slice(5)}
                  interval={6}
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
                  labelFormatter={(label: any) => `Date: ${String(label)}`}
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

      {/* Data Notice */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
        <strong className="text-slate-600">Data Notice:</strong> Dashboard displays simulated usage patterns for demonstration.
        In production, data flows from real-time telemetry (GPU power monitoring, API gateway logs)
        into PostgreSQL via the FastAPI ingestion pipeline.
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

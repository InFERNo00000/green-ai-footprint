import { useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { cn } from '@/utils/cn';
import { generateTimeSeriesData, generateModelUsageBreakdown, DEMO_ORG } from '@/engine/simulation';
import { calculateEcoScore, getAllRegions } from '@/engine/calculator';
import type { CloudRegion } from '@/types';

const COLORS = ['#0d9488', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

export function Analytics() {
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(90);
  const [region, setRegion] = useState<CloudRegion>('eu-central-1');
  const regions = getAllRegions();

  const timeSeries = useMemo(() => generateTimeSeriesData(timeRange, region), [timeRange, region]);
  const modelBreakdown = useMemo(() => generateModelUsageBreakdown(region), [region]);

  const totalCO2e = modelBreakdown.reduce((sum, m) => sum + m.co2eGrams, 0);
  const pieData = modelBreakdown.map((m) => ({
    name: m.displayName.split('(')[0].trim(),
    value: Math.round((m.co2eGrams / totalCO2e) * 100 * 10) / 10,
  }));

  const regionComparison = useMemo(() => {
    return regions.map((r) => {
      const score = calculateEcoScore('claude3-sonnet', r.regionId);
      return {
        region: r.location,
        ecoScore: score.overall,
        gCO2e: r.gCO2ePerKwh,
        renewable: r.renewablePercentage,
      };
    }).sort((a, b) => b.ecoScore - a.ecoScore);
  }, [regions]);

  const weeklyData = useMemo(() => {
    const weeks: { week: string; energy: number; co2e: number; requests: number }[] = [];
    for (let i = 0; i < timeSeries.length; i += 7) {
      const chunk = timeSeries.slice(i, i + 7);
      if (chunk.length === 0) break;
      weeks.push({
        week: `W${Math.floor(i / 7) + 1}`,
        energy: chunk.reduce((s, p) => s + p.energyKwh, 0),
        co2e: chunk.reduce((s, p) => s + p.co2eGrams, 0),
        requests: chunk.reduce((s, p) => s + p.requests, 0),
      });
    }
    return weeks;
  }, [timeSeries]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Sustainability Analytics</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Drill-down: Organization → Project → Model → Request
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as CloudRegion)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-teal-600 focus:outline-none flex-1 sm:flex-initial"
          >
            <optgroup label="Americas">
              {regions.filter(r => ['ca-central-1','us-west-2','us-east-1','us-central1','sa-east-1'].includes(r.regionId)).map((r) => (
                <option key={r.regionId} value={r.regionId}>{r.location}</option>
              ))}
            </optgroup>
            <optgroup label="Europe">
              {regions.filter(r => ['eu-north-1','eu-west-3','eu-west-1','europe-west4','eu-central-1'].includes(r.regionId)).map((r) => (
                <option key={r.regionId} value={r.regionId}>{r.location}</option>
              ))}
            </optgroup>
            <optgroup label="Middle East & Africa">
              {regions.filter(r => ['me-south-1','af-south-1'].includes(r.regionId)).map((r) => (
                <option key={r.regionId} value={r.regionId}>{r.location}</option>
              ))}
            </optgroup>
            <optgroup label="Asia-Pacific">
              {regions.filter(r => ['ap-south-1','ap-south-2','ap-southeast-1','ap-northeast-2','ap-northeast-1','ap-southeast-2'].includes(r.regionId)).map((r) => (
                <option key={r.regionId} value={r.regionId}>{r.location}</option>
              ))}
            </optgroup>
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

      {/* Organization Hierarchy */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-slate-800">
          Organization: {DEMO_ORG.name}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_ORG.projects.map((proj) => (
            <div key={proj.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">{proj.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{proj.models.length} models active</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {proj.models.map((m) => (
                  <span key={m} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-slate-800">CO₂e Emissions Trend</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Daily grams CO₂e (location-based)</p>
          <div className="mt-3 h-48 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries}>
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
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={1}
                  stroke="none"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Share']}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-slate-800">Weekly Energy Consumption</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Aggregated kWh per week</p>
          <div className="mt-3 h-48 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={40} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="energy" stroke="#d97706" strokeWidth={1.5} dot={{ r: 1.5 }} name="Energy (kWh)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-slate-800">Region Sustainability Ranking</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">EcoScore by deployment region (same model) · {regionComparison.length} regions</p>
          <div className="mt-3 space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {regionComparison.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 text-[10px] text-slate-400 text-right tabular-nums flex-shrink-0">#{i + 1}</span>
                <span className="w-20 sm:w-28 text-[11px] text-slate-600 truncate flex-shrink-0">{r.region}</span>
                <div className="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${r.ecoScore}%`,
                      backgroundColor: r.ecoScore >= 70 ? '#0d9488' : r.ecoScore >= 50 ? '#d97706' : '#dc2626',
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-[11px] font-medium text-slate-600 tabular-nums flex-shrink-0">{r.ecoScore.toFixed(0)}</span>
                <span className="hidden sm:inline w-16 text-right text-[10px] text-slate-400 flex-shrink-0">{r.gCO2e} g</span>
                <span className="hidden sm:inline w-10 text-right text-[10px] text-slate-400 flex-shrink-0">{r.renewable}%</span>
              </div>
            ))}
          </div>
          <div className="hidden sm:flex items-center justify-end gap-4 mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-400">
            <span>g = gCO₂e/kWh</span>
            <span>% = renewable energy</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-slate-800">Actionable Insights</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InsightCard
            title="Model Optimization"
            description={`Replacing your highest-emission model with ${modelBreakdown[modelBreakdown.length - 1]?.displayName.split('(')[0]} could reduce emissions by up to ${Math.round((1 - modelBreakdown[modelBreakdown.length - 1]?.co2eGrams / modelBreakdown[0]?.co2eGrams) * 100)}% for equivalent tasks.`}
          />
          <InsightCard
            title="Region Migration"
            description={`Moving workloads to ${regionComparison[0]?.region} (${regionComparison[0]?.gCO2e} gCO₂e/kWh) from ${regionComparison[regionComparison.length - 1]?.region} could improve EcoScore by ${(regionComparison[0]?.ecoScore - regionComparison[regionComparison.length - 1]?.ecoScore).toFixed(0)} points.`}
          />
          <InsightCard
            title="Usage Pattern"
            description="Weekend utilization drops to 30% of weekday levels. Consider batch-processing non-urgent workloads during off-peak hours to improve GPU utilization."
          />
        </div>
      </div>
    </div>
  );
}

function InsightCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

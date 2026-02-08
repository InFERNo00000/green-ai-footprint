import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend, Cell,
} from 'recharts';
import { GitCompareArrows, Lightbulb, AlertTriangle, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { compareModels, getAllModels, getAllRegions, getGradeBgClass } from '@/engine/calculator';
import type { CloudRegion, ModelComparisonEntry, ModelProfile } from '@/types';
import { getCustomModelProfiles } from '@/stores/customModels';
import { CustomModelModal } from './CustomModelModal';

const COLORS = ['#0d9488', '#2563eb', '#d97706', '#dc2626', '#7c3aed'];

export function ModelComparison() {
  const predefinedModels = getAllModels();
  const regions = getAllRegions();

  const [customModelVersion, setCustomModelVersion] = useState(0);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const customProfiles = useMemo(
    () => getCustomModelProfiles(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customModelVersion]
  );
  const allModels: ModelProfile[] = useMemo(
    () => [...predefinedModels, ...customProfiles],
    [predefinedModels, customProfiles]
  );

  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt4', 'claude3-sonnet', 'llama70b', 'mistral7b']);
  const [region, setRegion] = useState<CloudRegion>('eu-central-1');
  const [requests, setRequests] = useState(1000);
  const [avgTokens, setAvgTokens] = useState(1000);

  const comparison = useMemo(
    () => compareModels(selectedModels, region, requests, avgTokens, undefined, customProfiles),
    [selectedModels, region, requests, avgTokens, customProfiles]
  );

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleModelAdded = useCallback(() => {
    setCustomModelVersion(v => v + 1);
  }, []);

  const barData = comparison.models.map((m) => ({
    name: m.displayName.split(' ')[0] + ' ' + (m.displayName.split(' ')[1] || ''),
    co2e: Math.round(m.footprint.co2eGramsPer1kRequests * 100) / 100,
    energy: Math.round(m.footprint.energyKwhPer1kRequests * 1000) / 1000,
    water: Math.round(m.footprint.waterLitersPer1kRequests * 1000) / 1000,
    ecoScore: m.ecoScore.overall,
    quality: m.qualityScore,
  }));

  const radarData = comparison.models.length > 0
    ? ['Energy Eff.', 'Carbon', 'Water', 'Hardware', 'Renewable'].map((metric, i) => {
        const keys = ['energyEfficiency', 'carbonIntensity', 'waterUsage', 'hardwareLifecycle', 'renewableAlignment'] as const;
        const point: Record<string, string | number> = { metric };
        comparison.models.forEach((m) => {
          point[m.displayName.slice(0, 12)] = m.ecoScore.breakdown[keys[i]].score;
        });
        return point;
      })
    : [];

  // Separate predefined from custom for UI
  const predefinedModelList = allModels.filter(m => m.family !== 'custom');
  const customModelList = allModels.filter(m => m.family === 'custom');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Model Comparison</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Side-by-side sustainability analysis with decision recommendations
        </p>
      </div>

      {/* Configuration */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-2">
              Select Models (2–5)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {predefinedModelList.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  disabled={!selectedModels.includes(m.id) && selectedModels.length >= 5}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors border',
                    selectedModels.includes(m.id)
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                    !selectedModels.includes(m.id) && selectedModels.length >= 5 && 'opacity-30 cursor-not-allowed'
                  )}
                >
                  {m.displayName.split('(')[0].trim()}
                </button>
              ))}
            </div>
            
            {/* Custom models section */}
            {customModelList.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Custom Models</p>
                <div className="flex flex-wrap gap-1.5">
                  {customModelList.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      disabled={!selectedModels.includes(m.id) && selectedModels.length >= 5}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors border',
                        selectedModels.includes(m.id)
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50',
                        !selectedModels.includes(m.id) && selectedModels.length >= 5 && 'opacity-30 cursor-not-allowed'
                      )}
                    >
                      {m.displayName.split('(')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add custom model button */}
            <button
              onClick={() => setShowCustomModal(true)}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add custom model for comparison
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as CloudRegion)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none"
              >
                <optgroup label="Americas">
                  {regions.filter(r => ['ca-central-1','us-west-2','us-east-1','us-central1','sa-east-1'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>{r.location} — {r.gCO2ePerKwh} g</option>
                  ))}
                </optgroup>
                <optgroup label="Europe">
                  {regions.filter(r => ['eu-north-1','eu-west-3','eu-west-1','europe-west4','eu-central-1'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>{r.location} — {r.gCO2ePerKwh} g</option>
                  ))}
                </optgroup>
                <optgroup label="Middle East & Africa">
                  {regions.filter(r => ['me-south-1','af-south-1'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>{r.location} — {r.gCO2ePerKwh} g</option>
                  ))}
                </optgroup>
                <optgroup label="Asia-Pacific">
                  {regions.filter(r => ['ap-south-1','ap-south-2','ap-southeast-1','ap-northeast-2','ap-northeast-1','ap-southeast-2'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>{r.location} — {r.gCO2ePerKwh} g</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Requests</label>
              <input
                type="number"
                value={requests}
                onChange={(e) => setRequests(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none"
                min={1}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Avg Tokens</label>
              <input
                type="number"
                value={avgTokens}
                onChange={(e) => setAvgTokens(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none"
                min={1}
                inputMode="numeric"
              />
            </div>
          </div>
        </div>
      </div>

      {selectedModels.length < 2 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 sm:p-12 text-center">
          <GitCompareArrows className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-3 text-[13px] text-slate-500">Select at least 2 models to compare</p>
        </div>
      ) : (
        <>
          {/* Recommendation */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-[13px] font-medium text-slate-800">Recommendation</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{comparison.recommendation.narrative}</p>
            {comparison.recommendation.tradeoffs.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {comparison.recommendation.tradeoffs.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                    <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile card view */}
          <div className="block md:hidden space-y-3">
            {comparison.models.map((m, i) => (
              <div key={m.modelId} className="rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[13px] font-medium truncate pr-2" style={{ color: COLORS[i % COLORS.length] }}>
                    {m.displayName.split('(')[0].trim()}
                  </h4>
                  <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0', getGradeBgClass(m.ecoScore.grade))}>
                    {m.ecoScore.grade} ({m.ecoScore.overall})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]">
                  <MetricRow label="Quality" value={`${m.qualityScore}/100`} />
                  <MetricRow label="Quality/kgCO₂e" value={m.costEfficiency.toFixed(1)} />
                  <MetricRow label="Energy" value={`${m.footprint.energyKwhPer1kRequests.toFixed(4)} kWh`} />
                  <MetricRow label="CO₂e" value={`${m.footprint.co2eGramsPer1kRequests.toFixed(2)} g`} />
                  <MetricRow label="Water" value={`${m.footprint.waterLitersPer1kRequests.toFixed(4)} L`} />
                  <MetricRow label="Hardware" value={`${m.footprint.hardwareAmortizedGramsPer1kRequests.toFixed(4)} g`} />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-400 uppercase">Metric</th>
                  {comparison.models.map((m, i) => (
                    <th key={m.modelId} className="px-4 py-2.5 text-right text-[11px] font-medium uppercase" style={{ color: COLORS[i] }}>
                      {m.displayName.split('(')[0].trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <CompRow label="EcoScore" models={comparison.models} accessor={(m) => (
                  <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium', getGradeBgClass(m.ecoScore.grade))}>
                    {m.ecoScore.grade} ({m.ecoScore.overall})
                  </span>
                )} />
                <CompRow label="Quality Score" models={comparison.models} accessor={(m) => `${m.qualityScore}/100`} />
                <CompRow label="Quality per kgCO₂e" models={comparison.models} accessor={(m) => m.costEfficiency.toFixed(1)} highlight="max" />
                <CompRow label={`Energy (kWh / ${requests} req)`} models={comparison.models} accessor={(m) => m.footprint.energyKwhPer1kRequests.toFixed(4)} highlight="min" />
                <CompRow label={`CO₂e (g / ${requests} req)`} models={comparison.models} accessor={(m) => m.footprint.co2eGramsPer1kRequests.toFixed(2)} highlight="min" />
                <CompRow label={`Water (L / ${requests} req)`} models={comparison.models} accessor={(m) => m.footprint.waterLitersPer1kRequests.toFixed(4)} highlight="min" />
                <CompRow label="Hardware (gCO₂e amortized)" models={comparison.models} accessor={(m) => m.footprint.hardwareAmortizedGramsPer1kRequests.toFixed(4)} highlight="min" />
                <CompRow label="≈ km driving" models={comparison.models} accessor={(m) => m.footprint.totalEquivalentKmDriving.toFixed(3)} />
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-[13px] font-medium text-slate-800">CO₂e Emissions</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Grams per {requests.toLocaleString()} requests</p>
              <div className="mt-3 h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={45} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [`${Number(v).toFixed(2)} g`, 'CO₂e']}
                    />
                    <Bar dataKey="co2e" radius={[2, 2, 0, 0]}>
                      {barData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-[13px] font-medium text-slate-800">EcoScore Profile Overlay</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Higher is better across all dimensions</p>
              <div className="mt-3 h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 7 }} />
                    {comparison.models.map((m, i) => (
                      <Radar
                        key={m.modelId}
                        dataKey={m.displayName.slice(0, 12)}
                        stroke={COLORS[i]}
                        fill={COLORS[i]}
                        fillOpacity={0.06}
                        strokeWidth={1.5}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Assumptions */}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <div className="text-[11px] text-slate-500 space-y-0.5">
                {comparison.scenarioAssumptions.map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
                <p className="text-slate-400 mt-1.5">
                  Real-world performance varies with prompt complexity, batching, and quantization.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Custom Model Modal */}
      <CustomModelModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onModelAdded={handleModelAdded}
      />
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700 font-medium tabular-nums">{value}</span>
    </div>
  );
}

function CompRow({
  label,
  models,
  accessor,
  highlight,
}: {
  label: string;
  models: ModelComparisonEntry[];
  accessor: (m: ModelComparisonEntry) => React.ReactNode;
  highlight?: 'min' | 'max';
}) {
  let bestIdx = -1;
  if (highlight && models.length > 0) {
    const values = models.map((m) => {
      const val = accessor(m);
      return typeof val === 'string' ? parseFloat(val) : 0;
    });
    if (highlight === 'min') {
      bestIdx = values.indexOf(Math.min(...values));
    } else {
      bestIdx = values.indexOf(Math.max(...values));
    }
  }

  return (
    <tr className="hover:bg-slate-50/50">
      <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500">{label}</td>
      {models.map((m, i) => (
        <td
          key={m.modelId}
          className={cn(
            'px-4 py-2.5 text-right text-[13px] tabular-nums',
            i === bestIdx ? 'font-semibold text-teal-700' : 'text-slate-600'
          )}
        >
          {accessor(m)}
          {i === bestIdx && <span className="ml-1 text-teal-500 text-[10px]">★</span>}
        </td>
      ))}
    </tr>
  );
}

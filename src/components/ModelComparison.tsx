import { useState, useCallback, useEffect } from 'react';
import { GitCompareArrows, Lightbulb, AlertTriangle, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { compareModels as compareModelsApi, getModels, getRegions } from '@/services/apiClient';
import type { CloudRegion } from '@/types';
import { CustomModelModal } from './CustomModelModal';

type ComparisonModel = {
  modelId: string;
  displayName: string;
  ecoScore: {
    overall: number;
    grade: string;
  };
  footprint: {
    energyKwhPer1kRequests: number;
    co2eGramsPer1kRequests: number;
    waterLitersPer1kRequests: number;
    hardwareAmortizedGramsPer1kRequests: number;
    totalEquivalentKmDriving: number;
    totalEquivalentSmartphoneCharges: number;
  };
  qualityScore: number;
  costEfficiency: number;
};

const COLORS = ['#0d9488', '#2563eb', '#d97706', '#dc2626', '#7c3aed'];

function getGradeBgClass(grade: string): string {
  const g = String(grade || '').toUpperCase();
  if (g.startsWith('A')) return 'bg-teal-50 text-teal-700 border border-teal-200';
  if (g.startsWith('B')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (g.startsWith('C')) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (g.startsWith('D')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

export function ModelComparison() {
  const [models, setModels] = useState<Array<any>>([]);
  const [regions, setRegionsState] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCustomModal, setShowCustomModal] = useState(false);

  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [region, setRegion] = useState<CloudRegion>('eu-central-1');
  const [requests, setRequests] = useState(1000);
  const [avgTokens, setAvgTokens] = useState(1000);

  const [comparison, setComparison] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [modelsResp, regionsResp] = await Promise.all([
          getModels(),
          getRegions(),
        ]);
        if (cancelled) return;

        setModels(modelsResp.models);
        setRegionsState(regionsResp);

        if (modelsResp.models.length > 0) {
          const defaults = modelsResp.models.slice(0, 4).map((m) => m.id);
          setSelectedModels(defaults.slice(0, Math.max(0, Math.min(4, defaults.length))));
        }

        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        setLoadError('Failed to load models/regions');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (selectedModels.length < 2) {
        setComparison(null);
        return;
      }
      try {
        setComparing(true);
        setCompareError(null);
        const resp = await compareModelsApi({
          model_ids: selectedModels,
          region_id: region,
          requests_per_1k: requests,
          avg_tokens_per_request: avgTokens,
        });
        if (cancelled) return;
        setComparison(resp);
      } catch (e) {
        if (cancelled) return;
        setCompareError('Comparison failed');
        setComparison(null);
      } finally {
        if (cancelled) return;
        setComparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [avgTokens, region, requests, selectedModels]);

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleModelAdded = useCallback(async () => {
    try {
      const modelsResp = await getModels();
      setModels(modelsResp.models);
    } catch {
      // ignore
    }
  }, []);

  const predefinedModelList = models.filter((m) => m.is_predefined);
  const customModelList = models.filter((m) => !m.is_predefined);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500">Loading comparison data...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-600">{loadError}</div>
      </div>
    );
  }

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
              {predefinedModelList.map((m: any) => (
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
                  {String(m.display_name).split('(')[0].trim()}
                </button>
              ))}
            </div>
            
            {/* Custom models section */}
            {customModelList.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Custom Models</p>
                <div className="flex flex-wrap gap-1.5">
                  {customModelList.map((m: any) => (
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
                      {String(m.display_name).split('(')[0].trim()}
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
                {regions.map((r: any) => (
                  <option key={r.id} value={r.region_id}>{r.location} — {r.gco2e_per_kwh} g</option>
                ))}
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
      ) : compareError ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 sm:p-12 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-300" />
          <p className="mt-3 text-[13px] text-red-600">{compareError}</p>
        </div>
      ) : comparing || !comparison ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 sm:p-12 text-center">
          <GitCompareArrows className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-3 text-[13px] text-slate-500">Comparing models...</p>
        </div>
      ) : (
        <>
          {/* Recommendation */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-[13px] font-medium text-slate-800">Recommendation</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{comparison.recommendation.narrative}</p>
            {comparison.recommendation.tradeoffs.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {comparison.recommendation.tradeoffs.map((t: string, i: number) => (
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
            {comparison.models.map((m: any, i: number) => (
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
                  {comparison.models.map((m: any, i: number) => (
                    <th key={m.modelId} className="px-4 py-2.5 text-right text-[11px] font-medium uppercase" style={{ color: COLORS[i % COLORS.length] }}>
                      {m.displayName.split('(')[0].trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <CompRow label="EcoScore" models={comparison.models as ComparisonModel[]} accessor={(m) => `${m.ecoScore.overall}`} highlight="max" />
                <CompRow label="Grade" models={comparison.models as ComparisonModel[]} accessor={(m) => (
                  <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium', getGradeBgClass(m.ecoScore.grade))}>
                    {m.ecoScore.grade}
                  </span>
                )} />
                <CompRow label="Quality" models={comparison.models as ComparisonModel[]} accessor={(m) => `${m.qualityScore}/100`} highlight="max" />
                <CompRow label="CO₂e (g / 1k req)" models={comparison.models as ComparisonModel[]} accessor={(m) => m.footprint.co2eGramsPer1kRequests.toFixed(2)} highlight="min" />
                <CompRow label="Energy (kWh / 1k req)" models={comparison.models as ComparisonModel[]} accessor={(m) => m.footprint.energyKwhPer1kRequests.toFixed(4)} highlight="min" />
                <CompRow label="Water (L / 1k req)" models={comparison.models as ComparisonModel[]} accessor={(m) => m.footprint.waterLitersPer1kRequests.toFixed(4)} highlight="min" />
                <CompRow label="Hardware (g / 1k req)" models={comparison.models as ComparisonModel[]} accessor={(m) => m.footprint.hardwareAmortizedGramsPer1kRequests.toFixed(4)} highlight="min" />
                <CompRow label="Quality/kgCO₂e" models={comparison.models as ComparisonModel[]} accessor={(m) => m.costEfficiency.toFixed(1)} highlight="max" />
              </tbody>
            </table>
          </div>

          {/* Assumptions */}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <div className="text-[11px] text-slate-500 space-y-0.5">
                {comparison.scenarioAssumptions.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </div>
            </div>
            <p className="text-slate-400 mt-1.5">
              Real-world performance varies with prompt complexity, batching, and quantization.
            </p>
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
  models: ComparisonModel[];
  accessor: (m: ComparisonModel) => React.ReactNode;
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, AlertTriangle, Check, X, RefreshCw,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { compareScenarios as compareScenariosApi, getModels, getRegions } from '@/services/apiClient';
import type { CloudRegion, NavSection } from '@/types';

type ScenarioConfig = {
  modelId: string;
  region: CloudRegion;
  requestCount: number;
  avgTokensPerRequest: number;
};

type CompareResponse = {
  baseline: {
    model_id: string;
    region_id: string;
    request_count: number;
    avg_tokens_per_request: number;
    total_tokens: number;
    energy_kwh: number;
    co2e_grams: number;
    water_liters: number;
    hardware_amortized_grams: number;
    eco_score: number;
    eco_grade: string;
  };
  proposed: {
    model_id: string;
    region_id: string;
    request_count: number;
    avg_tokens_per_request: number;
    total_tokens: number;
    energy_kwh: number;
    co2e_grams: number;
    water_liters: number;
    hardware_amortized_grams: number;
    eco_score: number;
    eco_grade: string;
  };
  delta: {
    co2e_percent: number;
    energy_percent: number;
    water_percent: number;
    eco_score_delta: number;
  };
};

function getGradeBgClass(grade: string): string {
  const g = String(grade || '').toUpperCase();
  if (g.startsWith('A')) return 'bg-teal-50 text-teal-700 border border-teal-200';
  if (g.startsWith('B')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (g.startsWith('C')) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (g.startsWith('D')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

export function ScenarioSimulatorAPI({ onNavigate }: { onNavigate?: (section: NavSection) => void }) {
  const [models, setModels] = useState<Array<any>>([]);
  const [regions, setRegions] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [baseline, setBaseline] = useState<ScenarioConfig>({
    modelId: '',
    region: 'eu-central-1',
    requestCount: 10000,
    avgTokensPerRequest: 1000,
  });

  const [proposed, setProposed] = useState<ScenarioConfig>({
    modelId: '',
    region: 'eu-central-1',
    requestCount: 10000,
    avgTokensPerRequest: 1000,
  });

  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [modelsResp, regionsResp] = await Promise.all([getModels(), getRegions()]);
        if (cancelled) return;

        setModels(modelsResp.models);
        setRegions(regionsResp);

        const defaultModel = modelsResp.models?.[0]?.id ?? '';
        setBaseline((b) => ({ ...b, modelId: b.modelId || defaultModel }));
        setProposed((p) => ({ ...p, modelId: p.modelId || (modelsResp.models?.[1]?.id ?? defaultModel) }));

        setLoadError(null);
      } catch {
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

  const canCompare = useMemo(() => {
    return Boolean(baseline.modelId && proposed.modelId && baseline.region && proposed.region);
  }, [baseline.modelId, baseline.region, proposed.modelId, proposed.region]);

  const handleCompare = useCallback(async () => {
    if (!canCompare) return;
    try {
      setComparing(true);
      setCompareError(null);
      const resp = (await compareScenariosApi({
        baseline: {
          model_id: baseline.modelId,
          region_id: baseline.region,
          request_count: baseline.requestCount,
          avg_tokens_per_request: baseline.avgTokensPerRequest,
        },
        proposed: {
          model_id: proposed.modelId,
          region_id: proposed.region,
          request_count: proposed.requestCount,
          avg_tokens_per_request: proposed.avgTokensPerRequest,
        },
      })) as CompareResponse;
      setComparison(resp);
    } catch (e) {
      setComparison(null);
      setCompareError(e instanceof Error ? e.message : 'Scenario comparison failed');
    } finally {
      setComparing(false);
    }
  }, [baseline, canCompare, proposed]);

  const handleReset = useCallback(() => {
    setComparison(null);
    setCompareError(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500">Loading scenarios...</div>
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
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Scenario Simulator</h1>
        <p className="mt-0.5 text-xs text-slate-500">What-if analysis computed by backend</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScenarioPanel
          title="Current State (Baseline)"
          models={models}
          regions={regions}
          config={baseline}
          onChange={setBaseline}
          borderColor="border-slate-300"
          bgColor="bg-white"
          disabled={comparing}
        />

        <ScenarioPanel
          title="Proposed Change"
          models={models}
          regions={regions}
          config={proposed}
          onChange={setProposed}
          borderColor="border-teal-300"
          bgColor="bg-teal-50/30"
          disabled={comparing}
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        {!comparison ? (
          <button
            onClick={handleCompare}
            disabled={!canCompare || comparing}
            className="flex items-center gap-2 rounded-md bg-slate-800 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Compare Scenarios
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Modify
          </button>
        )}
      </div>

      {compareError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{compareError}</div>
      )}

      {comparison && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800 mb-3">Impact Comparison</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DeltaCard label="CO₂e" baseline={comparison.baseline.co2e_grams} proposed={comparison.proposed.co2e_grams} unit="g" percent={comparison.delta.co2e_percent} lowerIsBetter />
              <DeltaCard label="Energy" baseline={comparison.baseline.energy_kwh} proposed={comparison.proposed.energy_kwh} unit="kWh" percent={comparison.delta.energy_percent} lowerIsBetter />
              <DeltaCard label="Water" baseline={comparison.baseline.water_liters} proposed={comparison.proposed.water_liters} unit="L" percent={comparison.delta.water_percent} lowerIsBetter />
              <DeltaCard label="EcoScore" baseline={comparison.baseline.eco_score} proposed={comparison.proposed.eco_score} unit="" delta={comparison.delta.eco_score_delta} lowerIsBetter={false} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-medium text-slate-800">Baseline EcoScore</h3>
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', getGradeBgClass(comparison.baseline.eco_grade))}>
                  {comparison.baseline.eco_grade} ({comparison.baseline.eco_score.toFixed(1)})
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Energy: {comparison.baseline.energy_kwh.toFixed(3)} kWh · CO₂e: {comparison.baseline.co2e_grams.toFixed(1)} g</p>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-medium text-slate-800">Proposed EcoScore</h3>
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', getGradeBgClass(comparison.proposed.eco_grade))}>
                  {comparison.proposed.eco_grade} ({comparison.proposed.eco_score.toFixed(1)})
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Energy: {comparison.proposed.energy_kwh.toFixed(3)} kWh · CO₂e: {comparison.proposed.co2e_grams.toFixed(1)} g</p>
            </div>
          </div>

          <div className={cn(
            'rounded-lg border p-4',
            comparison.delta.co2e_percent < 0
              ? 'border-teal-200 bg-teal-50'
              : comparison.delta.co2e_percent > 10
              ? 'border-red-200 bg-red-50'
              : 'border-amber-200 bg-amber-50'
          )}>
            <div className="flex items-start gap-3">
              {comparison.delta.co2e_percent < 0 ? (
                <Check className="mt-0.5 h-4 w-4 text-teal-600 flex-shrink-0" />
              ) : comparison.delta.co2e_percent > 10 ? (
                <X className="mt-0.5 h-4 w-4 text-red-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <p className="text-[13px] font-medium text-slate-800">Recommendation</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {comparison.delta.co2e_percent < 0
                    ? 'This change reduces emissions.'
                    : comparison.delta.co2e_percent > 10
                    ? 'This change increases emissions materially.'
                    : 'This change has a mixed impact.'}
                </p>
                <button
                  onClick={() => onNavigate?.('analytics')}
                  className="mt-2 text-[11px] font-medium text-teal-700 hover:text-teal-800"
                >
                  View analytics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioPanel({
  title,
  config,
  onChange,
  models,
  regions,
  borderColor,
  bgColor,
  disabled,
}: {
  title: string;
  config: ScenarioConfig;
  onChange: (cfg: ScenarioConfig) => void;
  models: Array<any>;
  regions: Array<any>;
  borderColor: string;
  bgColor: string;
  disabled: boolean;
}) {
  const updateField = <K extends keyof ScenarioConfig>(field: K, value: ScenarioConfig[K]) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', borderColor, bgColor, disabled && 'opacity-60')}>
      <h3 className="text-[13px] font-medium text-slate-800">{title}</h3>

      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">AI Model</label>
        <select
          value={config.modelId}
          onChange={(e) => updateField('modelId', e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">Region</label>
        <select
          value={config.region}
          onChange={(e) => updateField('region', e.target.value as CloudRegion)}
          disabled={disabled}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
        >
          {regions.map((r) => (
            <option key={r.id} value={r.region_id}>{r.location} — {r.gco2e_per_kwh} gCO₂e/kWh</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Requests</label>
          <input
            type="number"
            value={config.requestCount}
            onChange={(e) => updateField('requestCount', Math.max(1, parseInt(e.target.value) || 1))}
            disabled={disabled}
            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
            min={1}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Avg Tokens</label>
          <input
            type="number"
            value={config.avgTokensPerRequest}
            onChange={(e) => updateField('avgTokensPerRequest', Math.max(1, parseInt(e.target.value) || 1))}
            disabled={disabled}
            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
            min={1}
            inputMode="numeric"
          />
        </div>
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  baseline,
  proposed,
  unit,
  percent,
  delta,
  lowerIsBetter,
}: {
  label: string;
  baseline: number;
  proposed: number;
  unit: string;
  percent?: number;
  delta?: number;
  lowerIsBetter: boolean;
}) {
  const d = typeof delta === 'number' ? delta : proposed - baseline;
  const sign = d > 0 ? '+' : '';
  const isGood = lowerIsBetter ? d <= 0 : d >= 0;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn('text-base font-semibold tabular-nums', isGood ? 'text-teal-700' : 'text-red-700')}>
        {sign}{d.toFixed(1)}{unit ? ` ${unit}` : ''}
      </p>
      {typeof percent === 'number' && (
        <p className="text-[10px] text-slate-400">{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</p>
      )}
    </div>
  );
}

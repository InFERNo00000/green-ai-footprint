import { useState, useMemo, useCallback } from 'react';
import {
  ArrowRight, TrendingUp, TrendingDown, Minus, Lightbulb,
  AlertTriangle, Check, X, RefreshCw, Save
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  compareScenarios,
  getAllModels,
  getAllRegions,
  getGradeBgClass,
  getModelProfile,
  getGridIntensity,
  getModelArchitectureClass,
  getHardwareEfficiencyTier,
  getGPUProfile,
} from '@/engine/calculator';
import type { CloudRegion, ScenarioConfig, ModelProfile } from '@/types';
import { getCustomModelProfiles } from '@/stores/customModels';

type UsagePattern = 'realtime' | 'batch' | 'mixed';

const USAGE_PATTERNS: { value: UsagePattern; label: string; desc: string }[] = [
  { value: 'realtime', label: 'Real-time', desc: 'Low latency, ~85% GPU util' },
  { value: 'mixed', label: 'Mixed', desc: 'Standard workload, ~92% util' },
  { value: 'batch', label: 'Batch', desc: 'High latency OK, ~100% util' },
];

export function ScenarioSimulator() {
  const predefinedModels = getAllModels();
  const regions = getAllRegions();
  const customProfiles = useMemo(() => getCustomModelProfiles(), []);
  const allModels: ModelProfile[] = useMemo(
    () => [...predefinedModels, ...customProfiles],
    [predefinedModels, customProfiles]
  );

  // Baseline configuration (current state)
  const [baseline, setBaseline] = useState<ScenarioConfig>({
    id: 'baseline',
    name: 'Current State',
    modelId: 'gpt4',
    region: 'eu-central-1',
    requestCount: 10000,
    avgTokensPerRequest: 1000,
    usagePattern: 'mixed',
  });

  // Proposed configuration (what-if state)
  const [proposed, setProposed] = useState<ScenarioConfig>({
    id: 'proposed',
    name: 'Proposed Change',
    modelId: 'claude3-sonnet',
    region: 'eu-central-1',
    requestCount: 10000,
    avgTokensPerRequest: 1000,
    usagePattern: 'mixed',
  });

  const [showComparison, setShowComparison] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<{ baseline: ScenarioConfig; proposed: ScenarioConfig; name: string }[]>([]);

  // Run comparison
  const comparison = useMemo(() => {
    if (!showComparison) return null;
    return compareScenarios(baseline, proposed, customProfiles);
  }, [baseline, proposed, showComparison, customProfiles]);

  const handleCompare = useCallback(() => {
    setShowComparison(true);
  }, []);

  const handleReset = useCallback(() => {
    setShowComparison(false);
  }, []);

  const handleSaveScenario = useCallback(() => {
    const name = `Scenario ${savedScenarios.length + 1}: ${baseline.modelId} → ${proposed.modelId}`;
    setSavedScenarios(prev => [...prev, { baseline: { ...baseline }, proposed: { ...proposed }, name }]);
  }, [baseline, proposed, savedScenarios.length]);

  const handleLoadScenario = useCallback((scenario: { baseline: ScenarioConfig; proposed: ScenarioConfig }) => {
    setBaseline(scenario.baseline);
    setProposed(scenario.proposed);
    setShowComparison(false);
  }, []);

  // Get model details for display
  const baselineModel = useMemo(() => getModelProfile(baseline.modelId, customProfiles), [baseline.modelId, customProfiles]);
  const proposedModel = useMemo(() => getModelProfile(proposed.modelId, customProfiles), [proposed.modelId, customProfiles]);
  const baselineGrid = useMemo(() => getGridIntensity(baseline.region), [baseline.region]);
  const proposedGrid = useMemo(() => getGridIntensity(proposed.region), [proposed.region]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Scenario Simulator</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          What-if analysis: Compare environmental impact before deploying changes
        </p>
      </div>

      {/* Quick preset buttons */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-slate-800 mb-3">Quick Scenarios</h3>
        <div className="flex flex-wrap gap-2">
          <QuickScenarioButton
            label="GPT-4 → Claude Sonnet"
            onClick={() => {
              setBaseline(b => ({ ...b, modelId: 'gpt4' }));
              setProposed(p => ({ ...p, modelId: 'claude3-sonnet' }));
              setShowComparison(false);
            }}
          />
          <QuickScenarioButton
            label="Frankfurt → Sweden"
            onClick={() => {
              setBaseline(b => ({ ...b, region: 'eu-central-1' }));
              setProposed(p => ({ ...p, region: 'eu-north-1' }));
              setShowComparison(false);
            }}
          />
          <QuickScenarioButton
            label="Real-time → Batch"
            onClick={() => {
              setBaseline(b => ({ ...b, usagePattern: 'realtime' }));
              setProposed(p => ({ ...p, usagePattern: 'batch' }));
              setShowComparison(false);
            }}
          />
          <QuickScenarioButton
            label="10K → 100K requests"
            onClick={() => {
              setBaseline(b => ({ ...b, requestCount: 10000 }));
              setProposed(p => ({ ...p, requestCount: 100000 }));
              setShowComparison(false);
            }}
          />
        </div>
      </div>

      {/* Configuration Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Baseline */}
        <ScenarioPanel
          title="Current State (Baseline)"
          config={baseline}
          onChange={setBaseline}
          allModels={allModels}
          regions={regions}
          borderColor="border-slate-300"
          bgColor="bg-white"
          disabled={showComparison}
        />

        {/* Proposed */}
        <ScenarioPanel
          title="Proposed Change"
          config={proposed}
          onChange={setProposed}
          allModels={allModels}
          regions={regions}
          borderColor="border-teal-300"
          bgColor="bg-teal-50/30"
          disabled={showComparison}
        />
      </div>

      {/* Compare Button */}
      <div className="flex items-center justify-center gap-3">
        {!showComparison ? (
          <button
            onClick={handleCompare}
            className="flex items-center gap-2 rounded-md bg-slate-800 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-slate-700 transition-colors"
          >
            Compare Scenarios
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Modify
            </button>
            <button
              onClick={handleSaveScenario}
              className="flex items-center gap-2 rounded-md border border-teal-300 bg-teal-50 px-4 py-2 text-[13px] font-medium text-teal-700 hover:bg-teal-100"
            >
              <Save className="h-3.5 w-3.5" />
              Save Scenario
            </button>
          </>
        )}
      </div>

      {/* Comparison Results */}
      {showComparison && comparison && (
        <div className="space-y-4">
          {/* Delta Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800 mb-3">Impact Comparison</h3>
            
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DeltaCard
                label="CO₂e Emissions"
                baseline={comparison.baseline.footprint.co2eGrams}
                proposed={comparison.proposed.footprint.co2eGrams}
                unit="g"
                percent={comparison.delta.co2ePercent}
                lowerIsBetter
              />
              <DeltaCard
                label="Energy"
                baseline={comparison.baseline.footprint.energyKwh}
                proposed={comparison.proposed.footprint.energyKwh}
                unit="kWh"
                percent={comparison.delta.energyPercent}
                lowerIsBetter
              />
              <DeltaCard
                label="Water"
                baseline={comparison.baseline.footprint.waterLiters}
                proposed={comparison.proposed.footprint.waterLiters}
                unit="L"
                percent={comparison.delta.waterPercent}
                lowerIsBetter
              />
              <DeltaCard
                label="EcoScore"
                baseline={comparison.baseline.ecoScore}
                proposed={comparison.proposed.ecoScore}
                unit=""
                percent={null}
                delta={comparison.delta.ecoScore}
                lowerIsBetter={false}
              />
            </div>
          </div>

          {/* EcoScore Comparison */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-medium text-slate-800">Baseline EcoScore</h3>
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', getGradeBgClass(comparison.baseline.ecoGrade))}>
                  {comparison.baseline.ecoGrade} ({comparison.baseline.ecoScore.toFixed(1)})
                </span>
              </div>
              <ModelSummary model={baselineModel} grid={baselineGrid} />
            </div>
            
            <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-medium text-slate-800">Proposed EcoScore</h3>
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', getGradeBgClass(comparison.proposed.ecoGrade))}>
                  {comparison.proposed.ecoGrade} ({comparison.proposed.ecoScore.toFixed(1)})
                </span>
              </div>
              <ModelSummary model={proposedModel} grid={proposedGrid} />
            </div>
          </div>

          {/* Recommendation */}
          <div className={cn(
            'rounded-lg border p-4',
            comparison.delta.co2ePercent < 0
              ? 'border-teal-200 bg-teal-50'
              : comparison.delta.co2ePercent > 10
              ? 'border-red-200 bg-red-50'
              : 'border-amber-200 bg-amber-50'
          )}>
            <div className="flex items-start gap-3">
              {comparison.delta.co2ePercent < 0 ? (
                <Check className="mt-0.5 h-4 w-4 text-teal-600 flex-shrink-0" />
              ) : comparison.delta.co2ePercent > 10 ? (
                <X className="mt-0.5 h-4 w-4 text-red-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <p className={cn(
                  'text-[13px] font-medium',
                  comparison.delta.co2ePercent < 0 ? 'text-teal-800' : comparison.delta.co2ePercent > 10 ? 'text-red-800' : 'text-amber-800'
                )}>
                  {comparison.recommendation}
                </p>
                {comparison.tradeoffs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {comparison.tradeoffs.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                        <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Annual Projection */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-[13px] font-medium text-slate-800 mb-2">Annual Projection</h3>
            <p className="text-xs text-slate-500 mb-3">
              If this change is applied and usage remains constant over 12 months:
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className={cn(
                  'text-lg font-semibold tabular-nums',
                  comparison.delta.co2ePercent < 0 ? 'text-teal-700' : 'text-red-700'
                )}>
                  {comparison.delta.co2ePercent < 0 ? '-' : '+'}{comparison.annualProjection.co2eSavedKg.toFixed(1)} kg
                </p>
                <p className="text-[10px] text-slate-400">CO₂e annually</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className={cn(
                  'text-lg font-semibold tabular-nums',
                  comparison.delta.energyPercent < 0 ? 'text-teal-700' : 'text-red-700'
                )}>
                  {comparison.delta.energyPercent < 0 ? '-' : '+'}{comparison.annualProjection.energySavedKwh.toFixed(1)} kWh
                </p>
                <p className="text-[10px] text-slate-400">Energy annually</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-[11px] text-slate-600">{comparison.annualProjection.costImplication}</p>
              </div>
            </div>
          </div>

          {/* Carbon Attribution (USP #1 integration) */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800 mb-3">Carbon Attribution Breakdown</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <AttributionBreakdown
                label="Baseline"
                attribution={comparison.baseline.attribution}
              />
              <AttributionBreakdown
                label="Proposed"
                attribution={comparison.proposed.attribution}
                highlight
              />
            </div>
          </div>
        </div>
      )}

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-slate-800 mb-3">Saved Scenarios</h3>
          <div className="space-y-2">
            {savedScenarios.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-[11px] text-slate-600">{s.name}</span>
                <button
                  onClick={() => handleLoadScenario(s)}
                  className="text-[10px] font-medium text-teal-600 hover:text-teal-700"
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Methodology Note */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">
        <strong className="text-slate-600">Methodology:</strong> Scenarios use the same calculation engine as the Footprint Calculator.
        Usage pattern multipliers: Real-time ×1.15 (lower GPU utilization), Batch ×0.85 (higher utilization).
        Comparisons are projections — actual impact depends on deployment conditions.
      </div>
    </div>
  );
}

// --- Sub-components ---

function QuickScenarioButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
    >
      {label}
    </button>
  );
}

function ScenarioPanel({
  title,
  config,
  onChange,
  allModels,
  regions,
  borderColor,
  bgColor,
  disabled,
}: {
  title: string;
  config: ScenarioConfig;
  onChange: (config: ScenarioConfig) => void;
  allModels: ModelProfile[];
  regions: ReturnType<typeof getAllRegions>;
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
          {allModels.filter(m => m.family !== 'custom').map((m) => (
            <option key={m.id} value={m.id}>{m.displayName}</option>
          ))}
          {allModels.filter(m => m.family === 'custom').length > 0 && (
            <optgroup label="Custom Models">
              {allModels.filter(m => m.family === 'custom').map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </optgroup>
          )}
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
            <option key={r.regionId} value={r.regionId}>
              {r.location} — {r.gCO2ePerKwh} gCO₂e/kWh
            </option>
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

      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">Usage Pattern</label>
        <div className="grid grid-cols-3 gap-2">
          {USAGE_PATTERNS.map((p) => (
            <button
              key={p.value}
              onClick={() => updateField('usagePattern', p.value)}
              disabled={disabled}
              className={cn(
                'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                config.usagePattern === p.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                disabled && 'cursor-not-allowed'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          {USAGE_PATTERNS.find(p => p.value === config.usagePattern)?.desc}
        </p>
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
  percent: number | null;
  delta?: number;
  lowerIsBetter: boolean;
}) {
  const diff = delta ?? (proposed - baseline);
  const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
  const isNeutral = Math.abs(diff) < 0.001;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <div>
          <p className="text-[10px] text-slate-400">
            {baseline.toFixed(baseline < 1 ? 3 : 1)} → {proposed.toFixed(proposed < 1 ? 3 : 1)} {unit}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-[11px] font-semibold',
          isNeutral ? 'text-slate-400' : isImprovement ? 'text-teal-600' : 'text-red-600'
        )}>
          {isNeutral ? (
            <Minus className="h-3 w-3" />
          ) : isImprovement ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <TrendingUp className="h-3 w-3" />
          )}
          {percent !== null ? (
            <span>{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</span>
          ) : (
            <span>{diff > 0 ? '+' : ''}{diff.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelSummary({ model, grid }: { model: ModelProfile; grid: ReturnType<typeof getGridIntensity> }) {
  const arch = getModelArchitectureClass(model);
  const gpu = getGPUProfile(model.typicalGPU);
  const tier = getHardwareEfficiencyTier(gpu);

  return (
    <div className="space-y-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Model</span>
        <span className="text-slate-700 font-medium">{model.displayName.split('(')[0].trim()}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Architecture</span>
        <span className="text-slate-700">{arch.label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Hardware</span>
        <span className="text-slate-700">{gpu.name} × {model.gpuCountInference}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Efficiency Tier</span>
        <span className={cn(
          'rounded px-1.5 py-0.5 text-[10px] font-medium',
          tier.tier === 'optimal' ? 'bg-teal-50 text-teal-700' : tier.tier === 'standard' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'
        )}>
          {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Region</span>
        <span className="text-slate-700">{grid.location}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Grid Intensity</span>
        <span className="text-slate-700">{grid.gCO2ePerKwh} gCO₂e/kWh ({grid.renewablePercentage}% renewable)</span>
      </div>
    </div>
  );
}

function AttributionBreakdown({
  label,
  attribution,
  highlight,
}: {
  label: string;
  attribution: ReturnType<typeof compareScenarios>['baseline']['attribution'];
  highlight?: boolean;
}) {
  const total = attribution.totalGrams;
  const operational = attribution.operationalEmissions.inference + attribution.operationalEmissions.networking + attribution.operationalEmissions.storage;
  const embodied = attribution.embodiedEmissions.hardware + attribution.embodiedEmissions.infrastructure;
  const upstream = attribution.upstreamEmissions.training + attribution.upstreamEmissions.finetuning;

  const operationalPct = total > 0 ? (operational / total) * 100 : 0;
  const embodiedPct = total > 0 ? (embodied / total) * 100 : 0;
  const upstreamPct = total > 0 ? (upstream / total) * 100 : 0;

  return (
    <div className={cn('rounded-md border p-3', highlight ? 'border-teal-200 bg-teal-50/50' : 'border-slate-100 bg-slate-50')}>
      <p className="text-[11px] font-medium text-slate-700 mb-2">{label}: {total.toFixed(2)}g CO₂e</p>
      <div className="h-3 flex rounded-full overflow-hidden mb-2">
        <div className="bg-blue-500" style={{ width: `${operationalPct}%` }} title="Operational" />
        <div className="bg-amber-500" style={{ width: `${embodiedPct}%` }} title="Embodied" />
        <div className="bg-purple-500" style={{ width: `${upstreamPct}%` }} title="Upstream" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[9px]">
        <div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-slate-500">Operational</span>
          </div>
          <p className="text-slate-700 font-medium">{operationalPct.toFixed(1)}%</p>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">Embodied</span>
          </div>
          <p className="text-slate-700 font-medium">{embodiedPct.toFixed(1)}%</p>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="text-slate-500">Upstream</span>
          </div>
          <p className="text-slate-700 font-medium">{upstreamPct.toFixed(1)}%</p>
        </div>
      </div>
      <p className="mt-2 text-[9px] text-slate-400">
        Confidence: {attribution.confidenceInterval.confidence} 
        ({attribution.confidenceInterval.low.toFixed(1)}–{attribution.confidenceInterval.high.toFixed(1)}g)
      </p>
    </div>
  );
}

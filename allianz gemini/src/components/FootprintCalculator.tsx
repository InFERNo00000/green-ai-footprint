import { useState, useMemo, useCallback } from 'react';
import { Info, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  calculateFullFootprint,
  calculateEcoScore,
  getAllModels,
  getAllRegions,
  getGradeBgClass,
  getGradeColor,
  calculateCarbonAttribution,
  getModelArchitectureClass,
  getHardwareEfficiencyTier,
  getGPUProfile,
} from '@/engine/calculator';
import type { CloudRegion, ModelProfile } from '@/types';
import type { FootprintResult } from '@/engine/calculator';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { getCustomModelProfiles, getCustomModels, deleteCustomModel } from '@/stores/customModels';
import { CustomModelModal } from './CustomModelModal';

// Model grouping for the select dropdown
function groupModels(models: ModelProfile[]) {
  const frontier: ModelProfile[] = [];
  const midSize: ModelProfile[] = [];
  const small: ModelProfile[] = [];
  const other: ModelProfile[] = [];
  const custom: ModelProfile[] = [];

  for (const m of models) {
    if (m.family === 'custom') {
      custom.push(m);
    } else if (m.parametersBillions >= 200) {
      frontier.push(m);
    } else if (m.parametersBillions >= 20) {
      midSize.push(m);
    } else if (m.parametersBillions < 20 && m.family !== 'custom') {
      small.push(m);
    } else {
      other.push(m);
    }
  }

  return { frontier, midSize, small, other, custom };
}

export function FootprintCalculator() {
  const predefinedModels = getAllModels();
  const regions = getAllRegions();

  const [customModelVersion, setCustomModelVersion] = useState(0);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showCustomList, setShowCustomList] = useState(false);

  // Merge predefined + custom models
  const customProfiles = useMemo(
    () => getCustomModelProfiles(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customModelVersion]
  );
  const allModels = useMemo(
    () => [...predefinedModels, ...customProfiles],
    [predefinedModels, customProfiles]
  );

  const [modelId, setModelId] = useState(predefinedModels[1].id);
  const [region, setRegion] = useState<CloudRegion>('eu-central-1');
  const [requestCount, setRequestCount] = useState(10000);
  const [avgTokens, setAvgTokens] = useState(1000);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const totalTokens = requestCount * avgTokens;
  const grouped = useMemo(() => groupModels(allModels), [allModels]);

  const result: FootprintResult = useMemo(
    () => calculateFullFootprint({ modelId, region, totalTokens, requestCount, additionalModels: customProfiles }),
    [modelId, region, totalTokens, requestCount, customProfiles]
  );

  const ecoScore = useMemo(
    () => calculateEcoScore(modelId, region, undefined, undefined, customProfiles),
    [modelId, region, customProfiles]
  );

  const radarData = [
    { metric: 'Energy Eff.', value: ecoScore.breakdown.energyEfficiency.score },
    { metric: 'Carbon', value: ecoScore.breakdown.carbonIntensity.score },
    { metric: 'Water', value: ecoScore.breakdown.waterUsage.score },
    { metric: 'Hardware', value: ecoScore.breakdown.hardwareLifecycle.score },
    { metric: 'Renewable', value: ecoScore.breakdown.renewableAlignment.score },
  ];

  // USP #1: AI-Aware Carbon Attribution
  const attribution = useMemo(
    () => calculateCarbonAttribution(result, result.model),
    [result]
  );

  const architectureClass = useMemo(
    () => getModelArchitectureClass(result.model),
    [result.model]
  );

  const gpuProfile = useMemo(
    () => getGPUProfile(result.gpu.id),
    [result.gpu.id]
  );

  const hardwareTier = useMemo(
    () => getHardwareEfficiencyTier(gpuProfile),
    [gpuProfile]
  );

  const handleModelAdded = useCallback(() => {
    setCustomModelVersion(v => v + 1);
  }, []);

  const handleDeleteCustomModel = useCallback((id: string) => {
    if (modelId === id) {
      setModelId(predefinedModels[1].id);
    }
    deleteCustomModel(id);
    setCustomModelVersion(v => v + 1);
  }, [modelId, predefinedModels]);

  const storedCustomModels = useMemo(
    () => getCustomModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customModelVersion]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Footprint Calculator</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Estimate the environmental impact of GenAI workloads with auditable calculations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Configuration */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3.5">
            <h3 className="text-[13px] font-medium text-slate-800">Configuration</h3>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">AI Model</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                {grouped.frontier.length > 0 && (
                  <optgroup label="Frontier LLMs (≥200B)">
                    {grouped.frontier.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                )}
                {grouped.midSize.length > 0 && (
                  <optgroup label="Mid-Size LLMs (20B–200B)">
                    {grouped.midSize.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                )}
                {grouped.small.length > 0 && (
                  <optgroup label="Small / Efficient Models (<20B)">
                    {grouped.small.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                )}
                {grouped.other.length > 0 && (
                  <optgroup label="Other">
                    {grouped.other.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                )}
                {grouped.custom.length > 0 && (
                  <optgroup label="Custom Models">
                    {grouped.custom.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                {result.model.parametersBillions}B params · {result.gpu.name} × {result.model.gpuCountInference}
              </p>

              {/* Add Custom Model button */}
              <button
                onClick={() => setShowCustomModal(true)}
                className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors w-full justify-center"
              >
                <Plus className="h-3 w-3" />
                Add Custom Model
              </button>

              {/* Manage custom models */}
              {storedCustomModels.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowCustomList(!showCustomList)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                  >
                    {showCustomList ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                    {storedCustomModels.length} custom model{storedCustomModels.length !== 1 ? 's' : ''} saved
                  </button>
                  {showCustomList && (
                    <div className="mt-1.5 space-y-1">
                      {storedCustomModels.map((cm) => (
                        <div key={cm.id} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-slate-600 truncate">{cm.name}</p>
                            <p className="text-[9px] text-slate-400">{cm.parametersBillions}B · {cm.category}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteCustomModel(cm.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 flex-shrink-0 ml-1"
                            title="Delete custom model"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Cloud Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as CloudRegion)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <optgroup label="Americas">
                  {regions.filter(r => ['ca-central-1','us-west-2','us-east-1','us-central1','sa-east-1'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>
                      {r.location} ({r.regionId}) — {r.gCO2ePerKwh} gCO₂e/kWh
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Europe">
                  {regions.filter(r => ['eu-north-1','eu-west-3','eu-west-1','europe-west4','eu-central-1'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>
                      {r.location} ({r.regionId}) — {r.gCO2ePerKwh} gCO₂e/kWh
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Middle East & Africa">
                  {regions.filter(r => ['me-south-1','af-south-1'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>
                      {r.location} ({r.regionId}) — {r.gCO2ePerKwh} gCO₂e/kWh
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Asia-Pacific">
                  {regions.filter(r => ['ap-south-1','ap-south-2','ap-southeast-1','ap-northeast-2','ap-northeast-1','ap-southeast-2'].includes(r.regionId)).map((r) => (
                    <option key={r.regionId} value={r.regionId}>
                      {r.location} ({r.regionId}) — {r.gCO2ePerKwh} gCO₂e/kWh
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                {result.grid.renewablePercentage}% renewable · {result.grid.source}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Requests</label>
                <input
                  type="number"
                  value={requestCount}
                  onChange={(e) => setRequestCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  min={1}
                  step={1000}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Avg Tokens/Req</label>
                <input
                  type="number"
                  value={avgTokens}
                  onChange={(e) => setAvgTokens(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  min={1}
                  step={100}
                  inputMode="numeric"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Total: {totalTokens.toLocaleString()} tokens ({(totalTokens / 1_000_000).toFixed(2)}M)
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Custom model indicator */}
          {result.model.family === 'custom' && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">
                Custom model — calculations use user-provided energy coefficients (confidence: low).
                For auditable results, integrate real-time power monitoring.
              </p>
            </div>
          )}

          {/* Primary Metrics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ResultCard label="Energy" value={result.energyKwh < 0.01 ? result.energyKwh.toExponential(2) : result.energyKwh.toFixed(3)} unit="kWh" sublabel={`${result.energyPerRequest.toFixed(6)} kWh/req`} />
            <ResultCard label="CO₂e Emissions" value={result.co2eGrams < 1 ? result.co2eGrams.toFixed(3) : result.co2eGrams.toFixed(1)} unit="grams" sublabel={`${result.co2ePerRequest.toFixed(4)} g/req`} />
            <ResultCard label="Water Usage" value={result.waterLiters < 0.01 ? result.waterLiters.toExponential(2) : result.waterLiters.toFixed(3)} unit="liters" sublabel={`${result.waterPerRequest.toFixed(6)} L/req`} />
            <ResultCard label="Hardware" value={result.hardwareAmortizedGrams < 0.01 ? result.hardwareAmortizedGrams.toExponential(2) : result.hardwareAmortizedGrams.toFixed(3)} unit="gCO₂e" sublabel="Embodied carbon share" />
          </div>

          {/* EcoScore + Radar */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-[13px] font-medium text-slate-800 mb-3">EcoScore™ Rating</h3>
              <div className="flex items-center gap-4">
                <div className="text-center flex-shrink-0">
                  <div
                    className={cn(
                      'flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-lg text-lg sm:text-xl font-bold',
                      getGradeBgClass(ecoScore.grade)
                    )}
                  >
                    {ecoScore.grade}
                  </div>
                  <p className="mt-1.5 text-lg font-semibold text-slate-900 tabular-nums">{ecoScore.overall}</p>
                  <p className="text-[10px] text-slate-400">out of 100</p>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {Object.entries(ecoScore.breakdown).map(([key, sub]) => (
                    <div key={key}>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500 capitalize truncate pr-2">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium text-slate-700 flex-shrink-0 tabular-nums">{sub.score.toFixed(0)}</span>
                      </div>
                      <div className="mt-0.5 h-1 rounded-full bg-slate-100">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{
                            width: `${Math.max(2, sub.score)}%`,
                            backgroundColor: getGradeColor(
                              sub.score >= 70 ? 'A' : sub.score >= 40 ? 'B' : 'D'
                            ),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Confidence: {ecoScore.confidence} · Log-normalized weighted composite
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-[13px] font-medium text-slate-800 mb-2">Impact Profile</h3>
              <div className="h-48 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                    <Radar
                      dataKey="value"
                      stroke="#0d9488"
                      fill="#0d9488"
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Contextual Equivalencies */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800 mb-1">Contextual Equivalencies</h3>
            <p className="text-[10px] text-slate-400 mb-3">
              For executive communication only — not for compliance calculations
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-base sm:text-lg font-semibold text-slate-900 tabular-nums">
                  {result.equivalentKmDriving < 0.1
                    ? result.equivalentKmDriving.toFixed(3)
                    : result.equivalentKmDriving.toFixed(1)} km
                </p>
                <p className="text-[10px] text-slate-500">passenger car driving</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-base sm:text-lg font-semibold text-slate-900 tabular-nums">
                  {result.equivalentSmartphoneCharges < 1
                    ? result.equivalentSmartphoneCharges.toFixed(2)
                    : Math.round(result.equivalentSmartphoneCharges).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500">smartphone charges</p>
              </div>
            </div>
          </div>

          {/* USP #1: AI-Aware Carbon Attribution */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800 mb-1">AI-Aware Carbon Attribution</h3>
            <p className="text-[10px] text-slate-400 mb-3">
              Emissions breakdown by source category (Scope 2 + Scope 3)
            </p>
            
            {/* Architecture & Hardware Info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                <p className="text-[10px] text-slate-400">Architecture Class</p>
                <p className="text-[11px] font-medium text-slate-700">{architectureClass.label}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Energy profile: {architectureClass.energyProfile}</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                <p className="text-[10px] text-slate-400">Hardware Tier</p>
                <p className={cn(
                  'text-[11px] font-medium',
                  hardwareTier.tier === 'optimal' ? 'text-teal-700' :
                  hardwareTier.tier === 'standard' ? 'text-slate-700' : 'text-amber-700'
                )}>
                  {hardwareTier.tier.charAt(0).toUpperCase() + hardwareTier.tier.slice(1)}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">{hardwareTier.description}</p>
              </div>
            </div>

            {/* Attribution Breakdown */}
            <div className="space-y-2.5">
              <AttributionRow
                label="Operational (Inference)"
                value={attribution.operationalEmissions.inference}
                total={attribution.totalGrams}
                color="bg-blue-500"
              />
              <AttributionRow
                label="Embodied (Hardware)"
                value={attribution.embodiedEmissions.hardware}
                total={attribution.totalGrams}
                color="bg-amber-500"
              />
              <AttributionRow
                label="Upstream (Training amortized)"
                value={attribution.upstreamEmissions.training}
                total={attribution.totalGrams}
                color="bg-purple-500"
              />
            </div>

            {/* Confidence Interval */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Total attributed:</span>
                  <span className="text-[11px] font-semibold text-slate-800 tabular-nums">{attribution.totalGrams.toFixed(2)} gCO₂e</span>
                </div>
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-medium',
                  attribution.confidenceInterval.confidence === 'high' ? 'bg-teal-50 text-teal-700' :
                  attribution.confidenceInterval.confidence === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                )}>
                  Confidence: {attribution.confidenceInterval.confidence}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Range: {attribution.confidenceInterval.low.toFixed(2)} – {attribution.confidenceInterval.high.toFixed(2)} gCO₂e
              </p>
            </div>
          </div>

          {/* Assumptions */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <button
              onClick={() => setShowAssumptions(!showAssumptions)}
              className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-left">Calculation Assumptions & Methodology</span>
              </span>
              {showAssumptions ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
            {showAssumptions && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-1.5">
                {result.assumptions.map((a, i) => (
                  <p key={i} className="text-[11px] text-slate-500 flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" />
                    <span>{a}</span>
                  </p>
                ))}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">
                    This calculation does not account for: network transfer energy, data storage lifecycle,
                    model fine-tuning overhead, or multi-tenancy efficiency gains. Production deployment
                    should integrate real-time power monitoring (RAPL/DCGM) for higher accuracy.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Model Modal */}
      <CustomModelModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onModelAdded={handleModelAdded}
      />
    </div>
  );
}

function ResultCard({
  label,
  value,
  unit,
  sublabel,
}: {
  label: string;
  value: string;
  unit: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400">{unit}</p>
      <p className="mt-0.5 text-[10px] text-slate-400 truncate">{sublabel}</p>
    </div>
  );
}

function AttributionRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3">
      <div className={cn('h-2 w-2 rounded-full flex-shrink-0', color)} />
      <span className="text-[10px] text-slate-500 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
      <span className="text-[10px] font-medium text-slate-600 w-12 text-right tabular-nums">{value.toFixed(2)}g</span>
      <span className="text-[9px] text-slate-400 w-10 text-right tabular-nums">{percentage.toFixed(1)}%</span>
    </div>
  );
}

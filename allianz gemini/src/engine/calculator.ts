// ============================================================
// GREEN-AI FOOTPRINT TOOL — CALCULATION ENGINE
//
// This module implements the core footprint calculation pipeline.
// Every formula is documented with assumptions and sources.
//
// CALCULATION CHAIN:
// 1. Tokens → Energy (kWh) via model-specific energy coefficient
// 2. Energy → CO2e via grid carbon intensity + PUE
// 3. Energy → Water via WUE + GPU cooling model
// 4. Hardware → Amortized embodied carbon via lifespan model
// 5. All metrics → EcoScore via weighted normalization
// ============================================================

import type {
  ModelProfile,
  GPUProfile,
  GridCarbonIntensity,
  EcoScoreResult,
  EcoScoreWeights,
  FootprintSummary,
  ModelComparison,
  ModelComparisonEntry,
  ComparisonRecommendation,
  CloudRegion,
  GPUClass,
  CarbonAttributionBreakdown,
  HardwareEfficiencyTier,
  ModelArchitectureClass,
  ScenarioConfig,
  ScenarioResult,
  ScenarioComparison,
  AuditMetadata,
  AuditAssumption,
} from '@/types';

import {
  GRID_CARBON_INTENSITIES,
  GPU_PROFILES,
  MODEL_PROFILES,
  DEFAULT_PUE,
  DEFAULT_WUE_LITERS_PER_KWH,
  EQUIVALENCIES,
  DEFAULT_ECOSCORE_WEIGHTS,
  ECOSCORE_BENCHMARKS,
} from './constants';

// ============================================================
// 1. ENERGY CALCULATION
// ============================================================

/**
 * Calculate energy consumption for a given number of tokens.
 *
 * Formula: E = (tokens / 1,000,000) × energyPerMillionTokens × PUE
 *
 * Assumptions:
 * - energyPerMillionTokens is a pre-computed coefficient that includes
 *   GPU power, CPU overhead, memory, and networking.
 * - PUE accounts for cooling, power distribution, lighting overhead.
 * - We do NOT distinguish input vs output tokens here (simplification).
 *   In production, output tokens are ~2-3x more expensive.
 *
 * @returns Energy in kWh
 */
export function calculateEnergy(
  totalTokens: number,
  model: ModelProfile,
  pue: number = DEFAULT_PUE
): number {
  const millionTokens = totalTokens / 1_000_000;
  return millionTokens * model.energyPerMillionTokensKwh * pue;
}

// ============================================================
// 2. CO2e EMISSIONS
// ============================================================

/**
 * Calculate CO2 equivalent emissions.
 *
 * Formula: CO2e = E(kWh) × gridIntensity(gCO2e/kWh)
 *
 * This uses LOCATION-BASED accounting (GHG Protocol Scope 2).
 * Market-based accounting would require renewable energy certificates
 * data, which is out of scope for this PoC.
 *
 * @returns CO2e in grams
 */
export function calculateCO2e(
  energyKwh: number,
  region: CloudRegion
): number {
  const grid = getGridIntensity(region);
  return energyKwh * grid.gCO2ePerKwh;
}

// ============================================================
// 3. WATER USAGE
// ============================================================

/**
 * Calculate water consumption for AI workloads.
 *
 * Formula: Water = E(kWh) × WUE(L/kWh) + GPU_cooling × duration
 *
 * Two components:
 * 1. Facility-level: evaporative cooling proportional to energy
 * 2. Server-level: direct liquid cooling for GPUs (if applicable)
 *
 * Source: Ren (2023) "Making AI Less Thirsty"
 * GPT-3 training ≈ 700,000 liters. GPT-4 estimated at 2-6x more.
 *
 * @returns Water in liters
 */
export function calculateWater(
  energyKwh: number,
  gpuProfile: GPUProfile,
  durationHours: number,
  wue: number = DEFAULT_WUE_LITERS_PER_KWH
): number {
  const facilityWater = energyKwh * wue;
  const serverWater = gpuProfile.waterCoolingLitersPerHour * durationHours;
  return facilityWater + serverWater;
}

// ============================================================
// 4. HARDWARE LIFECYCLE IMPACT
// ============================================================

/**
 * Calculate amortized embodied carbon from hardware manufacturing.
 *
 * Formula: amortized = (embodiedCO2e / lifespan) × usage_duration × gpu_count
 *
 * Embodied carbon includes:
 * - Raw material extraction
 * - Semiconductor fabrication
 * - Assembly and testing
 * - Shipping
 *
 * Source: Gupta et al. "Chasing Carbon" (2022)
 * A server's embodied carbon is roughly 20-50% of its operational carbon.
 *
 * @returns Amortized embodied carbon in grams CO2e
 */
export function calculateHardwareAmortization(
  gpuProfile: GPUProfile,
  gpuCount: number,
  usageDurationHours: number
): number {
  const amortizedPerGPUPerHour =
    (gpuProfile.embodiedCarbonKgCO2e * 1000) / gpuProfile.expectedLifespanHours;
  return amortizedPerGPUPerHour * gpuCount * usageDurationHours;
}

// ============================================================
// 5. FULL FOOTPRINT CALCULATION
// ============================================================

export interface FootprintInput {
  modelId: string;
  region: CloudRegion;
  totalTokens: number;
  requestCount: number;
  avgTokensPerRequest?: number;
  gpuOverride?: GPUClass;
  pue?: number;
  wue?: number;
  additionalModels?: ModelProfile[];
}

export interface FootprintResult {
  energyKwh: number;
  co2eGrams: number;
  waterLiters: number;
  hardwareAmortizedGrams: number;
  durationHours: number;
  // Per-request breakdowns
  energyPerRequest: number;
  co2ePerRequest: number;
  waterPerRequest: number;
  // Contextual
  equivalentKmDriving: number;
  equivalentSmartphoneCharges: number;
  // Metadata
  model: ModelProfile;
  gpu: GPUProfile;
  grid: GridCarbonIntensity;
  assumptions: string[];
}

export function calculateFullFootprint(input: FootprintInput): FootprintResult {
  const model = getModelProfile(input.modelId, input.additionalModels);
  const gpu = getGPUProfile(input.gpuOverride || model.typicalGPU);
  const grid = getGridIntensity(input.region);

  const assumptions: string[] = [];

  // Energy
  const pue = input.pue || DEFAULT_PUE;
  const energyKwh = calculateEnergy(input.totalTokens, model, pue);
  assumptions.push(`PUE factor: ${pue} (industry average for modern data centers)`);

  // Duration estimate: tokens / (tokens_per_second × gpu_count)
  const totalSeconds = input.totalTokens / (model.tokensPerSecond * model.gpuCountInference);
  const durationHours = totalSeconds / 3600;
  assumptions.push(`Estimated duration: ${durationHours.toFixed(3)} hours based on ${model.tokensPerSecond} tok/s × ${model.gpuCountInference} GPUs`);

  // CO2e
  const co2eGrams = calculateCO2e(energyKwh, input.region);
  assumptions.push(`Grid intensity: ${grid.gCO2ePerKwh} gCO2e/kWh (${grid.source})`);

  // Water
  const wue = input.wue || DEFAULT_WUE_LITERS_PER_KWH;
  const waterLiters = calculateWater(energyKwh, gpu, durationHours, wue);
  assumptions.push(`WUE: ${wue} L/kWh (Google 2023 average)`);

  // Hardware
  const hardwareAmortizedGrams = calculateHardwareAmortization(
    gpu,
    model.gpuCountInference,
    durationHours
  );
  assumptions.push(`GPU embodied carbon: ${gpu.embodiedCarbonKgCO2e} kgCO2e over ${gpu.expectedLifespanHours.toLocaleString()} hour lifespan`);

  // Equivalencies
  const totalCO2eKg = co2eGrams / 1000;
  const equivalentKmDriving = totalCO2eKg * EQUIVALENCIES.kmDrivingPerKgCO2e;
  const equivalentSmartphoneCharges = energyKwh * EQUIVALENCIES.smartphoneChargesPerKwh;

  // Per-request
  const rq = Math.max(input.requestCount, 1);

  return {
    energyKwh,
    co2eGrams,
    waterLiters,
    hardwareAmortizedGrams,
    durationHours,
    energyPerRequest: energyKwh / rq,
    co2ePerRequest: co2eGrams / rq,
    waterPerRequest: waterLiters / rq,
    equivalentKmDriving,
    equivalentSmartphoneCharges,
    model,
    gpu,
    grid,
    assumptions,
  };
}

// ============================================================
// 6. ECOSCORE CALCULATION
// ============================================================

/**
 * EcoScore: A composite sustainability rating for AI model usage.
 *
 * DESIGN PRINCIPLES:
 * 1. Transparent: Every sub-score is individually explainable
 * 2. Configurable: Weights can be adjusted by enterprise policy
 * 3. Non-linear: Uses logarithmic scaling to avoid false precision
 *    at extremes and to better differentiate mid-range models
 * 4. Bounded: 0-100, mapped to letter grades
 * 5. Defensible: Benchmarks are derived from known model profiles
 *
 * FORMULA:
 *   SubScore_i = 100 × (1 - log(value/best) / log(worst/best))
 *   Clamped to [0, 100]
 *   
 *   For renewable alignment: linear 0-100 (already a percentage)
 *
 *   EcoScore = Σ(weight_i × SubScore_i)
 *
 * WHY LOGARITHMIC?
 * - A model using 0.05 kWh/M tokens vs 0.10 kWh is a 2x difference
 * - A model using 2.0 kWh vs 4.0 kWh is also 2x
 * - Linear scoring would over-weight the absolute difference at the top
 * - Log scaling treats proportional improvements equally
 *
 * GRADE MAPPING:
 *   90-100: A+ (Exceptional)
 *   80-89:  A  (Excellent)
 *   70-79:  B+ (Good)
 *   60-69:  B  (Above Average)
 *   50-59:  C+ (Average)
 *   40-49:  C  (Below Average)
 *   30-39:  D  (Poor)
 *   0-29:   F  (Critical)
 */
export function calculateEcoScore(
  modelId: string,
  region: CloudRegion,
  weights: EcoScoreWeights = DEFAULT_ECOSCORE_WEIGHTS as EcoScoreWeights,
  gpuOverride?: GPUClass,
  additionalModels?: ModelProfile[]
): EcoScoreResult {
  const model = getModelProfile(modelId, additionalModels);
  const gpu = getGPUProfile(gpuOverride || model.typicalGPU);
  const grid = getGridIntensity(region);
  const benchmarks = ECOSCORE_BENCHMARKS;

  const assumptions: string[] = [];

  // --- Sub-score 1: Energy Efficiency ---
  const energyRaw = model.energyPerMillionTokensKwh * DEFAULT_PUE;
  const energyScore = logNormalize(energyRaw, benchmarks.energyPerMillionTokens.best, benchmarks.energyPerMillionTokens.worst);
  assumptions.push('Energy efficiency scored against best (0.03 kWh/M tokens) and worst (5.0 kWh/M tokens) benchmarks');

  // --- Sub-score 2: Carbon Intensity ---
  const co2Raw = energyRaw * grid.gCO2ePerKwh;
  const co2Score = logNormalize(co2Raw, benchmarks.co2ePerMillionTokens.best, benchmarks.co2ePerMillionTokens.worst);
  assumptions.push(`Carbon intensity uses ${grid.location} grid at ${grid.gCO2ePerKwh} gCO2e/kWh`);

  // --- Sub-score 3: Water Usage ---
  const inferenceSeconds = 1_000_000 / (model.tokensPerSecond * model.gpuCountInference);
  const inferenceHours = inferenceSeconds / 3600;
  const waterRaw = (energyRaw * DEFAULT_WUE_LITERS_PER_KWH) + (gpu.waterCoolingLitersPerHour * inferenceHours);
  const waterScore = logNormalize(waterRaw, benchmarks.waterPerMillionTokens.best, benchmarks.waterPerMillionTokens.worst);

  // --- Sub-score 4: Hardware Lifecycle ---
  const hwRaw = ((gpu.embodiedCarbonKgCO2e * 1000) / gpu.expectedLifespanHours) * model.gpuCountInference * inferenceHours;
  const hwScore = logNormalize(hwRaw, benchmarks.hardwareAmortizedPerMillionTokens.best, benchmarks.hardwareAmortizedPerMillionTokens.worst);

  // --- Sub-score 5: Renewable Alignment ---
  const renewableScore = linearNormalize(grid.renewablePercentage, benchmarks.renewablePercentage.worst, benchmarks.renewablePercentage.best);
  assumptions.push(`Region renewable energy: ${grid.renewablePercentage}%`);

  // --- Weighted Overall ---
  const overall =
    weights.energyEfficiency * energyScore +
    weights.carbonIntensity * co2Score +
    weights.waterUsage * waterScore +
    weights.hardwareLifecycle * hwScore +
    weights.renewableAlignment * renewableScore;

  const grade = getGrade(overall);

  // Confidence assessment
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (model.family === 'custom') confidence = 'low';
  assumptions.push('Confidence reflects data source quality; production use requires real telemetry');

  return {
    overall: Math.round(overall * 10) / 10,
    grade,
    breakdown: {
      energyEfficiency: {
        score: Math.round(energyScore * 10) / 10,
        raw: Math.round(energyRaw * 1000) / 1000,
        unit: 'kWh per M tokens',
        explanation: `Model consumes ${energyRaw.toFixed(3)} kWh per million tokens (incl. PUE ${DEFAULT_PUE})`,
      },
      carbonIntensity: {
        score: Math.round(co2Score * 10) / 10,
        raw: Math.round(co2Raw * 100) / 100,
        unit: 'gCO₂e per M tokens',
        explanation: `${co2Raw.toFixed(1)}g CO₂e per million tokens in ${grid.location}`,
      },
      waterUsage: {
        score: Math.round(waterScore * 10) / 10,
        raw: Math.round(waterRaw * 1000) / 1000,
        unit: 'liters per M tokens',
        explanation: `${waterRaw.toFixed(3)}L water per million tokens (facility + server cooling)`,
      },
      hardwareLifecycle: {
        score: Math.round(hwScore * 10) / 10,
        raw: Math.round(hwRaw * 100) / 100,
        unit: 'gCO₂e amortized per M tokens',
        explanation: `${hwRaw.toFixed(2)}g embodied carbon amortized per million tokens across ${model.gpuCountInference}× ${gpu.name}`,
      },
      renewableAlignment: {
        score: Math.round(renewableScore * 10) / 10,
        raw: grid.renewablePercentage,
        unit: '% renewable grid',
        explanation: `${grid.location} grid is ${grid.renewablePercentage}% renewable (${grid.source})`,
      },
    },
    assumptions,
    confidence,
  };
}

// ============================================================
// 7. MODEL COMPARISON ENGINE
// ============================================================

export function compareModels(
  modelIds: string[],
  region: CloudRegion,
  requestsPer1k: number = 1000,
  avgTokensPerRequest: number = 1000,
  weights?: EcoScoreWeights,
  additionalModels?: ModelProfile[]
): ModelComparison {
  const totalTokens = requestsPer1k * avgTokensPerRequest;
  const scenarioAssumptions = [
    `Comparison scenario: ${requestsPer1k.toLocaleString()} requests, ${avgTokensPerRequest} avg tokens/request`,
    `Region: ${region}`,
    `Total tokens evaluated: ${totalTokens.toLocaleString()}`,
  ];

  const entries: ModelComparisonEntry[] = modelIds.map((modelId) => {
    const model = getModelProfile(modelId, additionalModels);
    const ecoScore = calculateEcoScore(modelId, region, weights, undefined, additionalModels);
    const footprint = calculateFullFootprint({
      modelId,
      region,
      totalTokens,
      requestCount: requestsPer1k,
      additionalModels,
    });

    const footprintSummary: FootprintSummary = {
      energyKwhPer1kRequests: footprint.energyKwh,
      co2eGramsPer1kRequests: footprint.co2eGrams,
      waterLitersPer1kRequests: footprint.waterLiters,
      hardwareAmortizedGramsPer1kRequests: footprint.hardwareAmortizedGrams,
      totalEquivalentKmDriving: footprint.equivalentKmDriving,
      totalEquivalentSmartphoneCharges: footprint.equivalentSmartphoneCharges,
    };

    // Cost efficiency: quality points per gram CO2e
    const costEfficiency = footprint.co2eGrams > 0
      ? model.qualityScore / (footprint.co2eGrams / 1000)
      : 0;

    return {
      modelId,
      displayName: model.displayName,
      ecoScore,
      footprint: footprintSummary,
      qualityScore: model.qualityScore,
      costEfficiency: Math.round(costEfficiency * 10) / 10,
    };
  });

  // Generate recommendation
  const sortedByScore = [...entries].sort((a, b) => b.ecoScore.overall - a.ecoScore.overall);
  const sortedByEfficiency = [...entries].sort((a, b) =>
    a.footprint.co2eGramsPer1kRequests - b.footprint.co2eGramsPer1kRequests
  );
  const sortedByCostEfficiency = [...entries].sort((a, b) => b.costEfficiency - a.costEfficiency);

  const bestOverall = sortedByScore[0];
  const bestEfficiency = sortedByEfficiency[0];
  const bestQPC = sortedByCostEfficiency[0];

  const tradeoffs: string[] = [];

  if (bestOverall.modelId !== bestEfficiency.modelId) {
    tradeoffs.push(
      `${bestOverall.displayName} has the best overall EcoScore but ${bestEfficiency.displayName} has lower absolute emissions — consider workload criticality.`
    );
  }

  if (bestOverall.modelId !== bestQPC.modelId) {
    tradeoffs.push(
      `${bestQPC.displayName} delivers the most quality per unit of carbon — optimal for tasks where model capability matters.`
    );
  }

  const worstEntry = sortedByScore[sortedByScore.length - 1];
  const improvementPct = worstEntry.footprint.co2eGramsPer1kRequests > 0
    ? Math.round((1 - bestEfficiency.footprint.co2eGramsPer1kRequests / worstEntry.footprint.co2eGramsPer1kRequests) * 100)
    : 0;

  if (improvementPct > 10) {
    tradeoffs.push(
      `Switching from ${worstEntry.displayName} to ${bestEfficiency.displayName} could reduce emissions by ~${improvementPct}% with a quality score change of ${worstEntry.qualityScore} → ${bestEfficiency.qualityScore}.`
    );
  }

  const narrative = `Based on ${requestsPer1k.toLocaleString()} requests in ${getGridIntensity(region).location}, ` +
    `${bestOverall.displayName} achieves the best overall EcoScore (${bestOverall.ecoScore.grade}, ${bestOverall.ecoScore.overall}/100). ` +
    `For maximum efficiency, ${bestEfficiency.displayName} uses only ${bestEfficiency.footprint.co2eGramsPer1kRequests.toFixed(1)}g CO₂e. ` +
    `The best quality-per-carbon ratio belongs to ${bestQPC.displayName} at ${bestQPC.costEfficiency} quality points per kgCO₂e.`;

  const recommendation: ComparisonRecommendation = {
    bestOverall: bestOverall.modelId,
    bestEfficiency: bestEfficiency.modelId,
    bestQualityPerCarbon: bestQPC.modelId,
    narrative,
    tradeoffs,
  };

  return {
    models: entries,
    recommendation,
    scenarioAssumptions,
  };
}

// ============================================================
// 8. FOOTPRINT SUMMARY HELPER
// ============================================================

export function calculateFootprintSummary(
  modelId: string,
  region: CloudRegion,
  requests: number,
  avgTokens: number,
  additionalModels?: ModelProfile[]
): FootprintSummary {
  const result = calculateFullFootprint({
    modelId,
    region,
    totalTokens: requests * avgTokens,
    requestCount: requests,
    additionalModels,
  });

  return {
    energyKwhPer1kRequests: result.energyKwh,
    co2eGramsPer1kRequests: result.co2eGrams,
    waterLitersPer1kRequests: result.waterLiters,
    hardwareAmortizedGramsPer1kRequests: result.hardwareAmortizedGrams,
    totalEquivalentKmDriving: result.equivalentKmDriving,
    totalEquivalentSmartphoneCharges: result.equivalentSmartphoneCharges,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function logNormalize(value: number, best: number, worst: number): number {
  if (value <= best) return 100;
  if (value >= worst) return 0;
  // Log-scaled normalization
  const logValue = Math.log(value);
  const logBest = Math.log(best);
  const logWorst = Math.log(worst);
  const score = 100 * (1 - (logValue - logBest) / (logWorst - logBest));
  return Math.max(0, Math.min(100, score));
}

function linearNormalize(value: number, worst: number, best: number): number {
  if (value >= best) return 100;
  if (value <= worst) return 0;
  return 100 * (value - worst) / (best - worst);
}

function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export function getModelProfile(id: string, additionalModels?: ModelProfile[]): ModelProfile {
  // Check predefined models first
  const predefined = MODEL_PROFILES.find((m) => m.id === id);
  if (predefined) return predefined;
  
  // Check additional models (e.g., custom models passed by the caller)
  if (additionalModels) {
    const custom = additionalModels.find((m) => m.id === id);
    if (custom) return custom;
  }
  
  throw new Error(`Unknown model: ${id}`);
}

export function getGPUProfile(id: GPUClass): GPUProfile {
  const profile = GPU_PROFILES.find((g) => g.id === id);
  if (!profile) throw new Error(`Unknown GPU: ${id}`);
  return profile;
}

export function getGridIntensity(region: CloudRegion): GridCarbonIntensity {
  const grid = GRID_CARBON_INTENSITIES.find((g) => g.regionId === region);
  if (!grid) throw new Error(`Unknown region: ${region}`);
  return grid;
}

export function getAllModels(): ModelProfile[] {
  return MODEL_PROFILES;
}

export function getAllRegions(): GridCarbonIntensity[] {
  return GRID_CARBON_INTENSITIES;
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return '#0f766e';
    case 'A': return '#0d9488';
    case 'B+': return '#2dd4bf';
    case 'B': return '#d97706';
    case 'C+': return '#b45309';
    case 'C': return '#dc2626';
    case 'D': return '#b91c1c';
    case 'F': return '#7f1d1d';
    default: return '#64748b';
  }
}

export function getGradeBgClass(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-teal-50 text-teal-800 border border-teal-200';
    case 'A': return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'B+': return 'bg-teal-50 text-teal-600 border border-teal-100';
    case 'B': return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'C+': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'C': return 'bg-red-50 text-red-700 border border-red-200';
    case 'D': return 'bg-red-50 text-red-800 border border-red-200';
    case 'F': return 'bg-red-100 text-red-900 border border-red-300';
    default: return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
}

// ============================================================
// USP #1: AI-AWARE CARBON ATTRIBUTION
// ============================================================

/**
 * Get the architecture class for a model.
 * Determines inference characteristics and energy profile.
 */
export function getModelArchitectureClass(model: ModelProfile): ModelArchitectureClass {
  const family = model.family.toLowerCase();
  
  if (family.includes('moe') || family.includes('mixtral') || family.includes('dbrx') || family.includes('deepseek')) {
    return {
      type: 'moe',
      label: 'Mixture of Experts (MoE)',
      inferenceCharacteristics: 'Sparse activation — only subset of parameters active per token. More efficient than dense models of similar total size.',
      energyProfile: 'medium',
    };
  }
  
  if (family.includes('embedding') || family.includes('ada')) {
    return {
      type: 'encoder-only',
      label: 'Encoder-Only (Embedding)',
      inferenceCharacteristics: 'Single forward pass, no autoregressive generation. ~100x more efficient than generative LLMs.',
      energyProfile: 'low',
    };
  }
  
  if (family.includes('dall') || family.includes('stable') || family.includes('midjourney')) {
    return {
      type: 'diffusion',
      label: 'Diffusion Model (Image)',
      inferenceCharacteristics: 'Iterative denoising steps. Energy scales with image resolution and step count.',
      energyProfile: 'high',
    };
  }
  
  if (family.includes('gemini') || family.includes('gpt-4') || family.includes('claude')) {
    return {
      type: 'multimodal',
      label: 'Multimodal Transformer',
      inferenceCharacteristics: 'Handles text, image, and potentially audio. Higher memory and compute requirements.',
      energyProfile: 'high',
    };
  }
  
  // Default: Dense transformer (most LLMs)
  return {
    type: 'dense-transformer',
    label: 'Dense Transformer (LLM)',
    inferenceCharacteristics: 'All parameters active per token. Standard autoregressive generation.',
    energyProfile: model.parametersBillions > 100 ? 'high' : model.parametersBillions > 20 ? 'medium' : 'low',
  };
}

/**
 * Get the hardware efficiency tier for a GPU.
 */
export function getHardwareEfficiencyTier(gpu: GPUProfile): HardwareEfficiencyTier {
  if (gpu.id === 'nvidia-h100') {
    return {
      tier: 'optimal',
      description: 'Latest generation, highest efficiency per FLOP',
      efficiencyMultiplier: 0.8,
    };
  }
  
  if (gpu.id.includes('a100') || gpu.id === 'nvidia-a10g') {
    return {
      tier: 'standard',
      description: 'Current generation, good efficiency',
      efficiencyMultiplier: 1.0,
    };
  }
  
  return {
    tier: 'legacy',
    description: 'Previous generation, consider upgrading for efficiency gains',
    efficiencyMultiplier: 1.4,
  };
}

/**
 * Calculate detailed carbon attribution breakdown.
 * 
 * This splits emissions into three scopes:
 * 1. Operational (Scope 2): Direct energy consumption during inference
 * 2. Embodied (Scope 3 upstream): Hardware manufacturing, data center construction
 * 3. Upstream (Scope 3): Model training, fine-tuning
 * 
 * Confidence intervals reflect data quality and estimation uncertainty.
 */
export function calculateCarbonAttribution(
  footprint: FootprintResult,
  model: ModelProfile,
  _requestsPerYear: number = 0 // Reserved for future annual projection calculations
): CarbonAttributionBreakdown {
  // Operational emissions (Scope 2)
  const inferenceEmissions = footprint.co2eGrams;
  const networkingOverhead = inferenceEmissions * 0.02; // ~2% for network transfer
  const storageOverhead = inferenceEmissions * 0.005; // ~0.5% for ephemeral storage
  
  // Embodied emissions (Scope 3 upstream - hardware)
  const hardwareEmissions = footprint.hardwareAmortizedGrams;
  const infrastructureEmissions = hardwareEmissions * 0.15; // Data center construction ~15% of hardware
  
  // Upstream emissions (Scope 3 - training)
  // Amortize training emissions over estimated total model lifetime requests
  // Assumption: Major models serve ~100B requests over their lifetime
  const estimatedLifetimeRequests = 100_000_000_000;
  const trainingEmissionsPerRequest = (model.trainingCO2eTons * 1_000_000) / estimatedLifetimeRequests;
  const trainingEmissions = trainingEmissionsPerRequest * footprint.energyKwh * 1000; // Scale by energy as proxy
  const finetuningEmissions = trainingEmissions * 0.1; // Fine-tuning typically 10% of training
  
  const totalGrams = 
    inferenceEmissions + networkingOverhead + storageOverhead +
    hardwareEmissions + infrastructureEmissions +
    trainingEmissions + finetuningEmissions;
  
  // Confidence interval calculation
  // More uncertainty for custom models, less for well-documented models
  const isCustom = model.family === 'custom';
  const uncertaintyFactor = isCustom ? 0.4 : 0.15; // ±40% for custom, ±15% for known models
  
  const methodology: string[] = [
    'Operational emissions use location-based grid intensity (GHG Protocol Scope 2)',
    'Hardware amortization based on Gupta et al. (2022) embodied carbon methodology',
    `Training emissions amortized over ~${(estimatedLifetimeRequests / 1e9).toFixed(0)}B estimated lifetime requests`,
    'Networking overhead estimated at 2% of inference emissions',
    'Infrastructure embodied carbon estimated at 15% of hardware embodied carbon',
    `Uncertainty range: ±${(uncertaintyFactor * 100).toFixed(0)}% based on ${isCustom ? 'custom model (unverified)' : 'published benchmarks'}`,
  ];
  
  return {
    operationalEmissions: {
      inference: Math.round(inferenceEmissions * 100) / 100,
      networking: Math.round(networkingOverhead * 100) / 100,
      storage: Math.round(storageOverhead * 100) / 100,
    },
    embodiedEmissions: {
      hardware: Math.round(hardwareEmissions * 100) / 100,
      infrastructure: Math.round(infrastructureEmissions * 100) / 100,
    },
    upstreamEmissions: {
      training: Math.round(trainingEmissions * 1000) / 1000,
      finetuning: Math.round(finetuningEmissions * 1000) / 1000,
    },
    totalGrams: Math.round(totalGrams * 100) / 100,
    confidenceInterval: {
      low: Math.round(totalGrams * (1 - uncertaintyFactor) * 100) / 100,
      high: Math.round(totalGrams * (1 + uncertaintyFactor) * 100) / 100,
      confidence: isCustom ? 'low' : model.parametersBillions > 100 ? 'medium' : 'high',
    },
    methodology,
  };
}

// ============================================================
// USP #2: SCENARIO SIMULATION ENGINE
// ============================================================

/**
 * Run a scenario calculation.
 * Returns complete footprint result with EcoScore and attribution.
 */
export function runScenario(
  config: ScenarioConfig,
  additionalModels?: ModelProfile[]
): ScenarioResult {
  const totalTokens = config.requestCount * config.avgTokensPerRequest;
  
  // Apply usage pattern multiplier
  const patternMultiplier = config.usagePattern === 'batch' ? 0.85 : config.usagePattern === 'realtime' ? 1.15 : 1.0;
  
  const footprint = calculateFullFootprint({
    modelId: config.modelId,
    region: config.region,
    totalTokens,
    requestCount: config.requestCount,
    pue: config.pue,
    wue: config.wue,
    additionalModels,
  });
  
  const ecoScore = calculateEcoScore(config.modelId, config.region, undefined, undefined, additionalModels);
  
  const model = getModelProfile(config.modelId, additionalModels);
  const attribution = calculateCarbonAttribution(footprint, model);
  
  return {
    config,
    footprint: {
      energyKwh: footprint.energyKwh * patternMultiplier,
      co2eGrams: footprint.co2eGrams * patternMultiplier,
      waterLiters: footprint.waterLiters * patternMultiplier,
      hardwareGrams: footprint.hardwareAmortizedGrams * patternMultiplier,
    },
    ecoScore: ecoScore.overall,
    ecoGrade: ecoScore.grade,
    attribution,
  };
}

/**
 * Compare two scenarios and generate a detailed comparison.
 * This is the core of the What-If Analysis feature.
 */
export function compareScenarios(
  baseline: ScenarioConfig,
  proposed: ScenarioConfig,
  additionalModels?: ModelProfile[]
): ScenarioComparison {
  const baselineResult = runScenario(baseline, additionalModels);
  const proposedResult = runScenario(proposed, additionalModels);
  
  const deltaEnergy = proposedResult.footprint.energyKwh - baselineResult.footprint.energyKwh;
  const deltaCO2e = proposedResult.footprint.co2eGrams - baselineResult.footprint.co2eGrams;
  const deltaWater = proposedResult.footprint.waterLiters - baselineResult.footprint.waterLiters;
  const deltaEcoScore = proposedResult.ecoScore - baselineResult.ecoScore;
  
  const energyPercent = baselineResult.footprint.energyKwh > 0 
    ? (deltaEnergy / baselineResult.footprint.energyKwh) * 100 
    : 0;
  const co2ePercent = baselineResult.footprint.co2eGrams > 0 
    ? (deltaCO2e / baselineResult.footprint.co2eGrams) * 100 
    : 0;
  const waterPercent = baselineResult.footprint.waterLiters > 0 
    ? (deltaWater / baselineResult.footprint.waterLiters) * 100 
    : 0;
  
  // Generate recommendation
  let recommendation: string;
  const tradeoffs: string[] = [];
  
  if (deltaCO2e < 0 && deltaEcoScore > 0) {
    recommendation = `Recommended: The proposed scenario reduces emissions by ${Math.abs(co2ePercent).toFixed(1)}% and improves EcoScore by ${deltaEcoScore.toFixed(1)} points.`;
  } else if (deltaCO2e < 0 && deltaEcoScore <= 0) {
    recommendation = `Consider: The proposed scenario reduces emissions by ${Math.abs(co2ePercent).toFixed(1)}% but EcoScore decreases slightly.`;
    tradeoffs.push('EcoScore may decrease due to changes in regional renewable percentage or hardware tier.');
  } else if (deltaCO2e > 0 && deltaEcoScore > 0) {
    recommendation = `Mixed: Emissions increase by ${co2ePercent.toFixed(1)}% but EcoScore improves by ${deltaEcoScore.toFixed(1)} points.`;
    tradeoffs.push('Higher absolute emissions may be acceptable if model quality requirements demand it.');
  } else {
    recommendation = `Not recommended: The proposed scenario increases emissions by ${co2ePercent.toFixed(1)}% without EcoScore improvement.`;
  }
  
  // Model quality tradeoff
  const baselineModel = getModelProfile(baseline.modelId, additionalModels);
  const proposedModel = getModelProfile(proposed.modelId, additionalModels);
  if (baselineModel.qualityScore !== proposedModel.qualityScore) {
    const qualityDiff = proposedModel.qualityScore - baselineModel.qualityScore;
    if (qualityDiff < 0) {
      tradeoffs.push(`Model capability decreases from ${baselineModel.qualityScore} to ${proposedModel.qualityScore} (quality score). Evaluate task suitability.`);
    } else {
      tradeoffs.push(`Model capability improves from ${baselineModel.qualityScore} to ${proposedModel.qualityScore} (quality score).`);
    }
  }
  
  // Region tradeoff
  if (baseline.region !== proposed.region) {
    const baselineGrid = getGridIntensity(baseline.region);
    const proposedGrid = getGridIntensity(proposed.region);
    tradeoffs.push(`Region change: ${baselineGrid.location} (${baselineGrid.gCO2ePerKwh} gCO₂e/kWh) → ${proposedGrid.location} (${proposedGrid.gCO2ePerKwh} gCO₂e/kWh)`);
    
    if (proposedGrid.gCO2ePerKwh < baselineGrid.gCO2ePerKwh) {
      tradeoffs.push('Lower-carbon region selected. Consider latency implications for end users.');
    }
  }
  
  // Usage pattern tradeoff
  if (baseline.usagePattern !== proposed.usagePattern) {
    if (proposed.usagePattern === 'batch') {
      tradeoffs.push('Batch processing improves GPU utilization by ~15% but increases request latency.');
    } else if (proposed.usagePattern === 'realtime') {
      tradeoffs.push('Real-time processing reduces latency but decreases GPU utilization by ~15%.');
    }
  }
  
  // Annual projection (assuming provided config represents monthly usage)
  const monthlyFactor = 12;
  const annualCO2eSaved = Math.abs(deltaCO2e) * monthlyFactor / 1000; // Convert to kg
  const annualEnergySaved = Math.abs(deltaEnergy) * monthlyFactor;
  
  let costImplication: string;
  if (deltaCO2e < 0) {
    costImplication = `Potential annual savings: ${annualCO2eSaved.toFixed(1)} kg CO₂e, ${annualEnergySaved.toFixed(1)} kWh`;
  } else {
    costImplication = `Potential annual increase: ${annualCO2eSaved.toFixed(1)} kg CO₂e, ${annualEnergySaved.toFixed(1)} kWh`;
  }
  
  return {
    baseline: baselineResult,
    proposed: proposedResult,
    delta: {
      energyKwh: Math.round(deltaEnergy * 1000) / 1000,
      energyPercent: Math.round(energyPercent * 10) / 10,
      co2eGrams: Math.round(deltaCO2e * 100) / 100,
      co2ePercent: Math.round(co2ePercent * 10) / 10,
      waterLiters: Math.round(deltaWater * 1000) / 1000,
      waterPercent: Math.round(waterPercent * 10) / 10,
      ecoScore: Math.round(deltaEcoScore * 10) / 10,
    },
    recommendation,
    tradeoffs,
    annualProjection: {
      co2eSavedKg: Math.round(annualCO2eSaved * 10) / 10,
      energySavedKwh: Math.round(annualEnergySaved * 10) / 10,
      costImplication,
    },
  };
}

// ============================================================
// USP #3: AUDIT-READY ESG EXPORTS
// ============================================================

export const CALCULATION_VERSION = '1.0.0';

/**
 * Generate audit metadata for a calculation.
 * This provides the traceability required for ESG audits.
 */
export function generateAuditMetadata(
  modelId: string,
  region: CloudRegion,
  requestCount: number,
  avgTokens: number,
  additionalModels?: ModelProfile[]
): AuditMetadata {
  const model = getModelProfile(modelId, additionalModels);
  const grid = getGridIntensity(region);
  
  // Generate input hash for verification
  const inputString = `${modelId}|${region}|${requestCount}|${avgTokens}|${CALCULATION_VERSION}`;
  const inputHash = btoa(inputString).slice(0, 16);
  
  const assumptions: AuditAssumption[] = [
    {
      category: 'energy',
      assumption: `PUE factor: ${DEFAULT_PUE}`,
      source: 'Industry average for modern hyperscale data centers (Google 2023, Uptime Institute)',
      confidenceLevel: 'high',
      lastUpdated: '2024-01-01',
    },
    {
      category: 'energy',
      assumption: `Model energy coefficient: ${model.energyPerMillionTokensKwh} kWh/M tokens`,
      source: model.family === 'custom' ? 'User-provided estimate' : 'Luccioni et al. (2023), Patterson et al. (2022)',
      confidenceLevel: model.family === 'custom' ? 'low' : 'medium',
      lastUpdated: '2024-01-01',
    },
    {
      category: 'carbon',
      assumption: `Grid carbon intensity: ${grid.gCO2ePerKwh} gCO2e/kWh`,
      source: grid.source,
      confidenceLevel: 'high',
      lastUpdated: `${grid.year}-01-01`,
    },
    {
      category: 'water',
      assumption: `WUE: ${DEFAULT_WUE_LITERS_PER_KWH} L/kWh`,
      source: 'Google Environmental Report 2023',
      confidenceLevel: 'medium',
      lastUpdated: '2024-01-01',
    },
    {
      category: 'hardware',
      assumption: 'GPU embodied carbon amortized over 35,000 hour lifespan',
      source: 'Gupta et al. "Chasing Carbon" (2022)',
      confidenceLevel: 'medium',
      lastUpdated: '2024-01-01',
    },
    {
      category: 'model',
      assumption: 'Input/output tokens treated equivalently (simplification)',
      source: 'Standard industry practice for estimation',
      confidenceLevel: 'low',
      lastUpdated: '2024-01-01',
    },
  ];
  
  return {
    calculationVersion: CALCULATION_VERSION,
    timestamp: new Date().toISOString(),
    inputHash,
    assumptions,
    dataQuality: {
      overall: model.family === 'custom' ? 'low' : 'medium',
      factors: [
        { factor: 'Energy coefficient source', score: model.family === 'custom' ? 40 : 70, notes: model.family === 'custom' ? 'User-provided, unverified' : 'Peer-reviewed literature' },
        { factor: 'Grid intensity data', score: 85, notes: `${grid.source} (${grid.year})` },
        { factor: 'Hardware lifecycle data', score: 65, notes: 'Academic research, conservative estimates' },
        { factor: 'Usage pattern modeling', score: 50, notes: 'Aggregate estimate, no real-time telemetry' },
      ],
    },
    regulatoryAlignment: [
      {
        framework: 'GHG Protocol Scope 2',
        description: 'Location-based emissions accounting',
        alignmentLevel: 'full',
        notes: 'Uses grid carbon intensity data per GHG Protocol Scope 2 guidance',
      },
      {
        framework: 'GHG Protocol Scope 3',
        description: 'Value chain emissions (hardware, training)',
        alignmentLevel: 'partial',
        notes: 'Hardware embodied carbon included; upstream extraction not fully traced',
      },
      {
        framework: 'EU CSRD',
        description: 'Corporate Sustainability Reporting Directive',
        alignmentLevel: 'conceptual',
        notes: 'Aligned with double materiality principle; requires company-specific adaptation',
      },
      {
        framework: 'ISO 14064',
        description: 'GHG emissions quantification',
        alignmentLevel: 'partial',
        notes: 'Methodology aligns with ISO 14064-1 principles; full certification requires independent verification',
      },
      {
        framework: 'Science Based Targets initiative (SBTi)',
        description: 'Corporate emission reduction targets',
        alignmentLevel: 'conceptual',
        notes: 'Tool outputs can feed into SBTi target tracking; pathway analysis not included',
      },
    ],
  };
}

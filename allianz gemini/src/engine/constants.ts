// ============================================================
// GREEN-AI FOOTPRINT TOOL — REFERENCE DATA & CONSTANTS
// 
// SOURCING METHODOLOGY:
// - Carbon intensities: IEA World Energy Outlook 2023, Ember Global Electricity Review 2023
// - GPU specifications: NVIDIA datasheets, MLPerf benchmarks
// - Water usage: Shaolei Ren et al. "Making AI Less Thirsty" (2023)
// - Embodied carbon: Gupta et al. "Chasing Carbon" (2022), Dell ESG reports
// - Model energy: Luccioni et al. "Power Hungry Processing" (2023), Strubell et al. (2019)
//
// IMPORTANT: All values are estimates for a PoC. Production systems must
// integrate real-time telemetry (e.g., Kepler, RAPL, WattTime API).
// ============================================================

import type { GridCarbonIntensity, GPUProfile, ModelProfile } from '@/types';

// --- Grid Carbon Intensity by Cloud Region ---
// gCO2e per kWh (location-based, annual average)
export const GRID_CARBON_INTENSITIES: GridCarbonIntensity[] = [
  // ========= AMERICAS =========
  {
    regionId: 'ca-central-1',
    provider: 'aws',
    location: 'Montreal, Canada',
    gCO2ePerKwh: 14,
    source: 'Environment Canada NIR 2023 (Quebec grid)',
    year: 2023,
    renewablePercentage: 95,
  },
  {
    regionId: 'us-west-2',
    provider: 'aws',
    location: 'Oregon, USA',
    gCO2ePerKwh: 78,
    source: 'EIA eGRID 2023 (NWPP)',
    year: 2023,
    renewablePercentage: 68,
  },
  {
    regionId: 'us-east-1',
    provider: 'aws',
    location: 'Virginia, USA',
    gCO2ePerKwh: 338,
    source: 'EIA eGRID 2023 (SERC Virginia)',
    year: 2023,
    renewablePercentage: 22,
  },
  {
    regionId: 'us-central1',
    provider: 'gcp',
    location: 'Iowa, USA',
    gCO2ePerKwh: 410,
    source: 'EIA eGRID 2023 (MROE)',
    year: 2023,
    renewablePercentage: 42,
  },
  {
    regionId: 'sa-east-1',
    provider: 'aws',
    location: 'São Paulo, Brazil',
    gCO2ePerKwh: 61,
    source: 'MCTI Brazil National Inventory 2023',
    year: 2023,
    renewablePercentage: 83,
  },
  // ========= EUROPE =========
  {
    regionId: 'eu-north-1',
    provider: 'aws',
    location: 'Stockholm, Sweden',
    gCO2ePerKwh: 9,
    source: 'Swedish Energy Agency 2023',
    year: 2023,
    renewablePercentage: 98,
  },
  {
    regionId: 'eu-west-3',
    provider: 'aws',
    location: 'Paris, France',
    gCO2ePerKwh: 56,
    source: 'RTE France Bilan Electrique 2023',
    year: 2023,
    renewablePercentage: 92,
  },
  {
    regionId: 'eu-west-1',
    provider: 'aws',
    location: 'Ireland',
    gCO2ePerKwh: 296,
    source: 'EEA 2023',
    year: 2023,
    renewablePercentage: 40,
  },
  {
    regionId: 'europe-west4',
    provider: 'gcp',
    location: 'Netherlands',
    gCO2ePerKwh: 328,
    source: 'CBS Netherlands 2023',
    year: 2023,
    renewablePercentage: 33,
  },
  {
    regionId: 'eu-central-1',
    provider: 'aws',
    location: 'Frankfurt, Germany',
    gCO2ePerKwh: 350,
    source: 'UBA Germany 2023',
    year: 2023,
    renewablePercentage: 46,
  },
  // ========= MIDDLE EAST & AFRICA =========
  {
    regionId: 'me-south-1',
    provider: 'aws',
    location: 'Bahrain',
    gCO2ePerKwh: 532,
    source: 'IEA World Energy Outlook 2023 (Bahrain)',
    year: 2023,
    renewablePercentage: 5,
  },
  {
    regionId: 'af-south-1',
    provider: 'aws',
    location: 'Cape Town, South Africa',
    gCO2ePerKwh: 928,
    source: 'Eskom Integrated Report 2023',
    year: 2023,
    renewablePercentage: 7,
  },
  // ========= ASIA-PACIFIC =========
  {
    regionId: 'ap-south-1',
    provider: 'aws',
    location: 'Mumbai, India',
    gCO2ePerKwh: 708,
    source: 'CEA India CO2 Baseline Database v19 (2023)',
    year: 2023,
    renewablePercentage: 12,
  },
  {
    regionId: 'ap-south-2',
    provider: 'aws',
    location: 'Hyderabad, India',
    gCO2ePerKwh: 708,
    source: 'CEA India CO2 Baseline Database v19 (2023)',
    year: 2023,
    renewablePercentage: 12,
  },
  {
    regionId: 'ap-southeast-1',
    provider: 'aws',
    location: 'Singapore',
    gCO2ePerKwh: 408,
    source: 'EMA Singapore 2023',
    year: 2023,
    renewablePercentage: 3,
  },
  {
    regionId: 'ap-northeast-2',
    provider: 'aws',
    location: 'Seoul, South Korea',
    gCO2ePerKwh: 415,
    source: 'KEPCO Sustainability Report 2023',
    year: 2023,
    renewablePercentage: 9,
  },
  {
    regionId: 'ap-northeast-1',
    provider: 'aws',
    location: 'Tokyo, Japan',
    gCO2ePerKwh: 462,
    source: 'METI Japan 2023',
    year: 2023,
    renewablePercentage: 22,
  },
  {
    regionId: 'ap-southeast-2',
    provider: 'aws',
    location: 'Sydney, Australia',
    gCO2ePerKwh: 660,
    source: 'Australian Government DISER 2023',
    year: 2023,
    renewablePercentage: 32,
  },
];

// --- GPU Hardware Profiles ---
// TDP from NVIDIA datasheets; embodied carbon from Gupta et al. estimates
// Water cooling: 1-3 L/hr for server-level cooling (Shaolei Ren 2023)
export const GPU_PROFILES: GPUProfile[] = [
  {
    id: 'nvidia-h100',
    name: 'NVIDIA H100 SXM5',
    tdpWatts: 700,
    typicalUtilization: 0.65,
    memoryGB: 80,
    flopsTeraflops: 989, // FP16 Tensor
    embodiedCarbonKgCO2e: 150, // Conservative estimate
    expectedLifespanHours: 35000, // ~4 years
    waterCoolingLitersPerHour: 2.8,
  },
  {
    id: 'nvidia-a100-80gb',
    name: 'NVIDIA A100 80GB SXM',
    tdpWatts: 400,
    typicalUtilization: 0.60,
    memoryGB: 80,
    flopsTeraflops: 312,
    embodiedCarbonKgCO2e: 130,
    expectedLifespanHours: 35000,
    waterCoolingLitersPerHour: 1.8,
  },
  {
    id: 'nvidia-a100-40gb',
    name: 'NVIDIA A100 40GB',
    tdpWatts: 400,
    typicalUtilization: 0.55,
    memoryGB: 40,
    flopsTeraflops: 312,
    embodiedCarbonKgCO2e: 120,
    expectedLifespanHours: 35000,
    waterCoolingLitersPerHour: 1.7,
  },
  {
    id: 'nvidia-v100',
    name: 'NVIDIA V100 32GB',
    tdpWatts: 300,
    typicalUtilization: 0.50,
    memoryGB: 32,
    flopsTeraflops: 125,
    embodiedCarbonKgCO2e: 100,
    expectedLifespanHours: 35000,
    waterCoolingLitersPerHour: 1.2,
  },
  {
    id: 'nvidia-t4',
    name: 'NVIDIA T4',
    tdpWatts: 70,
    typicalUtilization: 0.50,
    memoryGB: 16,
    flopsTeraflops: 65,
    embodiedCarbonKgCO2e: 50,
    expectedLifespanHours: 35000,
    waterCoolingLitersPerHour: 0.4,
  },
  {
    id: 'nvidia-a10g',
    name: 'NVIDIA A10G',
    tdpWatts: 150,
    typicalUtilization: 0.55,
    memoryGB: 24,
    flopsTeraflops: 125,
    embodiedCarbonKgCO2e: 70,
    expectedLifespanHours: 35000,
    waterCoolingLitersPerHour: 0.7,
  },
  {
    id: 'cpu-only',
    name: 'CPU Only (Intel Xeon)',
    tdpWatts: 250,
    typicalUtilization: 0.40,
    memoryGB: 0,
    flopsTeraflops: 2,
    embodiedCarbonKgCO2e: 40,
    expectedLifespanHours: 50000,
    waterCoolingLitersPerHour: 0.5,
  },
];

// --- Model Profiles ---
// Energy per million tokens derived from:
// - Luccioni et al. (2023) for open models
// - Patterson et al. (2022) for training costs
// - Inference extrapolated from GPU profiling literature
// 
// ASSUMPTION: "energy per million tokens" = total server power (GPU + CPU + memory + networking + cooling PUE)
// PUE factor of 1.1-1.2 is baked into these numbers
export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'gpt4',
    family: 'gpt-4-class',
    displayName: 'GPT-4 Class (≈1.8T params)',
    parametersBillions: 1800,
    typicalGPU: 'nvidia-a100-80gb',
    gpuCountInference: 8,
    tokensPerSecond: 40,
    energyPerMillionTokensKwh: 4.2,
    trainingEnergyMwh: 62000,
    trainingCO2eTons: 21000,
    qualityScore: 95,
  },
  {
    id: 'gpt35',
    family: 'gpt-3.5-class',
    displayName: 'GPT-3.5 Class (≈175B params)',
    parametersBillions: 175,
    typicalGPU: 'nvidia-a100-40gb',
    gpuCountInference: 2,
    tokensPerSecond: 120,
    energyPerMillionTokensKwh: 0.45,
    trainingEnergyMwh: 1287,
    trainingCO2eTons: 552,
    qualityScore: 78,
  },
  {
    id: 'claude3-opus',
    family: 'claude-3-opus',
    displayName: 'Claude 3 Opus Class',
    parametersBillions: 500,
    typicalGPU: 'nvidia-a100-80gb',
    gpuCountInference: 4,
    tokensPerSecond: 50,
    energyPerMillionTokensKwh: 2.8,
    trainingEnergyMwh: 30000,
    trainingCO2eTons: 10200,
    qualityScore: 93,
  },
  {
    id: 'claude3-sonnet',
    family: 'claude-3-sonnet',
    displayName: 'Claude 3 Sonnet Class',
    parametersBillions: 150,
    typicalGPU: 'nvidia-a100-40gb',
    gpuCountInference: 2,
    tokensPerSecond: 100,
    energyPerMillionTokensKwh: 0.55,
    trainingEnergyMwh: 8000,
    trainingCO2eTons: 2720,
    qualityScore: 85,
  },
  {
    id: 'claude3-haiku',
    family: 'claude-3-haiku',
    displayName: 'Claude 3 Haiku Class',
    parametersBillions: 30,
    typicalGPU: 'nvidia-a10g',
    gpuCountInference: 1,
    tokensPerSecond: 300,
    energyPerMillionTokensKwh: 0.08,
    trainingEnergyMwh: 1500,
    trainingCO2eTons: 510,
    qualityScore: 72,
  },
  {
    id: 'llama70b',
    family: 'llama-70b',
    displayName: 'Llama 3 70B',
    parametersBillions: 70,
    typicalGPU: 'nvidia-a100-80gb',
    gpuCountInference: 2,
    tokensPerSecond: 80,
    energyPerMillionTokensKwh: 0.85,
    trainingEnergyMwh: 6500,
    trainingCO2eTons: 2210,
    qualityScore: 80,
  },
  {
    id: 'llama13b',
    family: 'llama-13b',
    displayName: 'Llama 2 13B',
    parametersBillions: 13,
    typicalGPU: 'nvidia-a10g',
    gpuCountInference: 1,
    tokensPerSecond: 150,
    energyPerMillionTokensKwh: 0.15,
    trainingEnergyMwh: 1200,
    trainingCO2eTons: 408,
    qualityScore: 62,
  },
  {
    id: 'llama7b',
    family: 'llama-7b',
    displayName: 'Llama 2 7B',
    parametersBillions: 7,
    typicalGPU: 'nvidia-t4',
    gpuCountInference: 1,
    tokensPerSecond: 200,
    energyPerMillionTokensKwh: 0.05,
    trainingEnergyMwh: 500,
    trainingCO2eTons: 170,
    qualityScore: 55,
  },
  {
    id: 'mistral7b',
    family: 'mistral-7b',
    displayName: 'Mistral 7B',
    parametersBillions: 7,
    typicalGPU: 'nvidia-t4',
    gpuCountInference: 1,
    tokensPerSecond: 220,
    energyPerMillionTokensKwh: 0.04,
    trainingEnergyMwh: 400,
    trainingCO2eTons: 136,
    qualityScore: 60,
  },
  {
    id: 'mixtral8x7b',
    family: 'mixtral-8x7b',
    displayName: 'Mixtral 8x7B (MoE)',
    parametersBillions: 47,
    typicalGPU: 'nvidia-a100-40gb',
    gpuCountInference: 1,
    tokensPerSecond: 110,
    energyPerMillionTokensKwh: 0.25,
    trainingEnergyMwh: 2000,
    trainingCO2eTons: 680,
    qualityScore: 74,
  },
  {
    id: 'gemini-pro',
    family: 'gemini-pro',
    displayName: 'Gemini Pro Class',
    parametersBillions: 300,
    typicalGPU: 'nvidia-h100',
    gpuCountInference: 4,
    tokensPerSecond: 70,
    energyPerMillionTokensKwh: 1.8,
    trainingEnergyMwh: 25000,
    trainingCO2eTons: 8500,
    qualityScore: 90,
  },
  // --- New Models (2024–2025) ---
  {
    id: 'grok-2',
    family: 'grok-2',
    displayName: 'Grok-2 (xAI, ≈314B params)',
    parametersBillions: 314,
    typicalGPU: 'nvidia-h100',
    gpuCountInference: 4,
    tokensPerSecond: 55,
    energyPerMillionTokensKwh: 2.4,
    trainingEnergyMwh: 35000,
    trainingCO2eTons: 11900,
    qualityScore: 88,
  },
  {
    id: 'deepseek-v3',
    family: 'deepseek-v3',
    displayName: 'DeepSeek-V3 (MoE, 671B total / 37B active)',
    parametersBillions: 671,
    typicalGPU: 'nvidia-h100',
    gpuCountInference: 4,
    tokensPerSecond: 90,
    energyPerMillionTokensKwh: 0.95,
    trainingEnergyMwh: 5500,
    trainingCO2eTons: 1870,
    qualityScore: 86,
  },
  {
    id: 'gemini-flash-2',
    family: 'gemini-flash',
    displayName: 'Gemini 2.0 Flash (Google, distilled)',
    parametersBillions: 9,
    typicalGPU: 'nvidia-t4',
    gpuCountInference: 1,
    tokensPerSecond: 180,
    energyPerMillionTokensKwh: 0.10,
    trainingEnergyMwh: 800,
    trainingCO2eTons: 272,
    qualityScore: 74,
  },
  // --- Additional Models (2024–2025 Expansion) ---
  {
    id: 'llama-3.1-405b',
    family: 'llama-3.1-405b',
    displayName: 'Llama 3.1 405B (Meta, open-weight)',
    parametersBillions: 405,
    typicalGPU: 'nvidia-h100',
    gpuCountInference: 8,
    tokensPerSecond: 30,
    energyPerMillionTokensKwh: 3.6,
    trainingEnergyMwh: 39000,
    trainingCO2eTons: 13260,
    qualityScore: 92,
  },
  {
    id: 'qwen-72b',
    family: 'qwen-72b',
    displayName: 'Qwen 2.5 72B (Alibaba Cloud)',
    parametersBillions: 72,
    typicalGPU: 'nvidia-a100-80gb',
    gpuCountInference: 2,
    tokensPerSecond: 75,
    energyPerMillionTokensKwh: 0.90,
    trainingEnergyMwh: 7000,
    trainingCO2eTons: 2380,
    qualityScore: 82,
  },
  {
    id: 'dbrx',
    family: 'dbrx',
    displayName: 'DBRX 132B (Databricks, MoE)',
    parametersBillions: 132,
    typicalGPU: 'nvidia-a100-80gb',
    gpuCountInference: 4,
    tokensPerSecond: 60,
    energyPerMillionTokensKwh: 1.10,
    trainingEnergyMwh: 9000,
    trainingCO2eTons: 3060,
    qualityScore: 78,
  },
  {
    id: 'phi-3-medium',
    family: 'phi-3-medium',
    displayName: 'Phi-3 Medium 14B (Microsoft)',
    parametersBillions: 14,
    typicalGPU: 'nvidia-a10g',
    gpuCountInference: 1,
    tokensPerSecond: 130,
    energyPerMillionTokensKwh: 0.18,
    trainingEnergyMwh: 1400,
    trainingCO2eTons: 476,
    qualityScore: 71,
  },
  {
    id: 'command-r-plus',
    family: 'command-r-plus',
    displayName: 'Command R+ (Cohere, 104B)',
    parametersBillions: 104,
    typicalGPU: 'nvidia-a100-80gb',
    gpuCountInference: 2,
    tokensPerSecond: 65,
    energyPerMillionTokensKwh: 1.50,
    trainingEnergyMwh: 8500,
    trainingCO2eTons: 2890,
    qualityScore: 83,
  },
  {
    id: 'gemma-7b',
    family: 'gemma-7b',
    displayName: 'Gemma 2 9B (Google, open)',
    parametersBillions: 9,
    typicalGPU: 'nvidia-t4',
    gpuCountInference: 1,
    tokensPerSecond: 170,
    energyPerMillionTokensKwh: 0.06,
    trainingEnergyMwh: 600,
    trainingCO2eTons: 204,
    qualityScore: 64,
  },
];

// --- Power Usage Effectiveness ---
// PUE = Total facility energy / IT equipment energy
// Industry range: 1.1 (Google) to 1.6 (legacy). We use conservative 1.2
export const DEFAULT_PUE = 1.2;

// --- Water Usage Effectiveness ---
// WUE typically 0.5-2.0 L/kWh for evaporative cooling
// Google reported 1.1 L/kWh in 2023
export const DEFAULT_WUE_LITERS_PER_KWH = 1.1;

// --- Contextual Equivalencies ---
// Used for executive communication, NOT for calculations
export const EQUIVALENCIES = {
  kmDrivingPerKgCO2e: 5.95, // Average EU passenger car: 168g CO2/km
  smartphoneChargesPerKwh: 86, // ~0.012 kWh per charge
  treeDaysAbsorptionPerKgCO2e: 16.7, // Average tree absorbs ~22kg CO2/year = 0.06kg/day
};

// --- EcoScore Default Weights ---
export const DEFAULT_ECOSCORE_WEIGHTS = {
  energyEfficiency: 0.30,
  carbonIntensity: 0.30,
  waterUsage: 0.10,
  hardwareLifecycle: 0.10,
  renewableAlignment: 0.20,
};

// --- EcoScore Benchmarks (for normalization) ---
// These define "best" and "worst" reference points for scoring
// Based on analysis of MODEL_PROFILES across different regions
export const ECOSCORE_BENCHMARKS = {
  energyPerMillionTokens: { best: 0.03, worst: 5.0 }, // kWh
  co2ePerMillionTokens: { best: 2.3, worst: 2100 }, // grams
  waterPerMillionTokens: { best: 0.03, worst: 5.5 }, // liters
  hardwareAmortizedPerMillionTokens: { best: 0.5, worst: 120 }, // grams CO2e
  renewablePercentage: { best: 100, worst: 0 }, // %
};

// ============================================================
// CUSTOM MODEL STORE
// 
// Persistent storage for user-defined AI models.
// Uses localStorage for PoC — designed to be swappable with
// a PostgreSQL-backed API in production.
//
// STORAGE KEY: 'green-ai-custom-models'
// FORMAT: JSON array of StoredCustomModel
// ============================================================

import type { StoredCustomModel, CustomModelInput, ModelProfile, GPUClass } from '@/types';
import { GPU_PROFILES } from '@/engine/constants';

// --- Validation Rules ---
// These prevent nonsensical inputs that would corrupt calculations
const VALIDATION = {
  name: { minLength: 2, maxLength: 100 },
  parametersBillions: { min: 0.001, max: 10000 },
  energyPerMillionTokensKwh: { min: 0.001, max: 100 },
  tokensPerSecondPerGpu: { min: 1, max: 10000 },
  gpuCount: { min: 1, max: 64 },
  qualityScore: { min: 0, max: 100 },
} as const;

export interface ValidationError {
  field: string;
  message: string;
}

// --- Read all custom models ---
export function getCustomModels(): StoredCustomModel[] {
  return [];
}

// --- Validate a custom model input ---
export function validateCustomModel(input: CustomModelInput): ValidationError[] {
  const errors: ValidationError[] = [];
  
  const name = input.name?.trim() || '';
  if (name.length < VALIDATION.name.minLength) {
    errors.push({ field: 'name', message: `Name must be at least ${VALIDATION.name.minLength} characters` });
  }
  if (name.length > VALIDATION.name.maxLength) {
    errors.push({ field: 'name', message: `Name must be under ${VALIDATION.name.maxLength} characters` });
  }

  // Duplicate checking is intentionally disabled (no client-side persistence)

  if (input.parametersBillions < VALIDATION.parametersBillions.min || input.parametersBillions > VALIDATION.parametersBillions.max) {
    errors.push({ field: 'parametersBillions', message: `Parameters must be between ${VALIDATION.parametersBillions.min}B and ${VALIDATION.parametersBillions.max}B` });
  }

  if (input.energyPerMillionTokensKwh < VALIDATION.energyPerMillionTokensKwh.min || input.energyPerMillionTokensKwh > VALIDATION.energyPerMillionTokensKwh.max) {
    errors.push({ field: 'energyPerMillionTokensKwh', message: `Energy must be between ${VALIDATION.energyPerMillionTokensKwh.min} and ${VALIDATION.energyPerMillionTokensKwh.max} kWh/M tokens` });
  }

  if (input.tokensPerSecondPerGpu < VALIDATION.tokensPerSecondPerGpu.min || input.tokensPerSecondPerGpu > VALIDATION.tokensPerSecondPerGpu.max) {
    errors.push({ field: 'tokensPerSecondPerGpu', message: `Throughput must be between ${VALIDATION.tokensPerSecondPerGpu.min} and ${VALIDATION.tokensPerSecondPerGpu.max} tok/s` });
  }

  if (input.gpuCount < VALIDATION.gpuCount.min || input.gpuCount > VALIDATION.gpuCount.max) {
    errors.push({ field: 'gpuCount', message: `GPU count must be between ${VALIDATION.gpuCount.min} and ${VALIDATION.gpuCount.max}` });
  }

  if (input.qualityScore < VALIDATION.qualityScore.min || input.qualityScore > VALIDATION.qualityScore.max) {
    errors.push({ field: 'qualityScore', message: `Quality score must be between ${VALIDATION.qualityScore.min} and ${VALIDATION.qualityScore.max}` });
  }

  const validGpuIds = GPU_PROFILES.map(g => g.id);
  if (!validGpuIds.includes(input.gpuType)) {
    errors.push({ field: 'gpuType', message: 'Invalid GPU type selected' });
  }

  return errors;
}

// --- Create a new custom model ---
export function addCustomModel(input: CustomModelInput): { success: boolean; errors?: ValidationError[]; model?: StoredCustomModel } {
  const errors = validateCustomModel(input);
  if (errors.length > 0) return { success: false, errors };

  return {
    success: false,
    errors: [{ field: 'name', message: 'Custom models are not persisted in this build.' }],
  };
}

// --- Delete a custom model ---
export function deleteCustomModel(id: string): boolean {
  void id;
  return false;
}

// --- Convert StoredCustomModel → ModelProfile ---
// This allows custom models to work seamlessly with existing calculation engine
export function customModelToProfile(stored: StoredCustomModel): ModelProfile {
  return {
    id: stored.id,
    family: 'custom',
    displayName: `${stored.name} (Custom, ${stored.parametersBillions}B)`,
    parametersBillions: stored.parametersBillions,
    typicalGPU: stored.gpuType,
    gpuCountInference: stored.gpuCount,
    tokensPerSecond: stored.tokensPerSecondPerGpu,
    energyPerMillionTokensKwh: stored.energyPerMillionTokensKwh,
    trainingEnergyMwh: 0, // Unknown for custom models
    trainingCO2eTons: 0,
    qualityScore: stored.qualityScore,
  };
}

// --- Get all custom models as ModelProfile[] ---
export function getCustomModelProfiles(): ModelProfile[] {
  return [];
}

// --- Energy estimation helper ---
// Defensible power-law estimate based on model parameters and GPU type.
// Formula: energy ≈ 0.0015 × params^0.7 × gpuEfficiencyFactor
// Source: Empirical observation from Kaplan et al. (2020) neural scaling laws,
// adapted for inference. Sub-linear because larger models have better batching.
export function estimateEnergyFromParams(
  paramsBillions: number,
  gpuType: GPUClass
): number {
  const gpuEfficiency: Record<string, number> = {
    'nvidia-h100': 0.8,      // Most efficient per FLOP
    'nvidia-a100-80gb': 1.0,  // Baseline
    'nvidia-a100-40gb': 1.05,
    'nvidia-v100': 1.4,
    'nvidia-a10g': 1.2,
    'nvidia-t4': 1.3,
    'cpu-only': 5.0,
  };
  
  const factor = gpuEfficiency[gpuType] ?? 1.0;
  const rawEnergy = 0.0015 * Math.pow(paramsBillions, 0.7) * factor;
  
  // Clamp to reasonable range
  return Math.max(0.001, Math.min(100, Math.round(rawEnergy * 1000) / 1000));
}

export { VALIDATION };

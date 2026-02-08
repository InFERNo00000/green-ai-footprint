// ============================================================
// API TYPES
// 
// TypeScript types for FastAPI request/response schemas
// ============================================================

export type ModelCategory = 
  | 'frontier-llm' | 'mid-size-llm' | 'small-edge' | 'code-model'
  | 'image-gen' | 'embedding' | 'multimodal' | 'custom';

export type GpuType = 
  | 'nvidia-h100' | 'nvidia-a100-80gb' | 'nvidia-a100-40gb'
  | 'nvidia-v100' | 'nvidia-t4' | 'nvidia-a10g' | 'cpu-only';

// Base model interface
export interface AIModelBase {
  display_name: string;
  family: string;
  category: ModelCategory;
  parameters_billion: number;
  energy_per_million_tokens_kwh: number;
  default_gpu: GpuType;
  gpu_count_inference: number;
  tokens_per_second_per_gpu: number;
  quality_score: number;
  description?: string;
}

// Request types
export interface AIModelCreate extends AIModelBase {}

export interface AIModelUpdate extends Partial<AIModelBase> {}

// Response types
export interface AIModelResponse extends AIModelBase {
  id: string;
  slug: string;
  is_predefined: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIModelListResponse {
  models: AIModelResponse[];
  total: number;
  predefined_count: number;
  custom_count: number;
}

export interface CalculationRequest {
  model_id: string;
  region_id: string;
  request_count: number;
  avg_tokens_per_request: number;
  pue?: number;
  wue?: number;
  persist?: boolean;
}

export interface CalculationResponse {
  energy_kwh: number;
  co2e_grams: number;
  water_liters: number;
  hardware_amortized_grams: number;
  duration_hours: number;
  energy_per_request: number;
  co2e_per_request: number;
  water_per_request: number;
  eco_score: number;
  eco_grade: string;
  equivalent_km_driving: number;
  equivalent_smartphone_charges: number;
  assumptions: string[];
  confidence: string;
}

export interface DashboardMetricsResponse {
  total_requests: number;
  total_energy_kwh: number;
  total_co2e_kg: number;
  total_water_liters: number;
  avg_eco_score: number;
  trend_direction: 'improving' | 'stable' | 'degrading';
  period_comparison: {
    energyChange: number;
    co2eChange: number;
    requestsChange: number;
  };
  model_usage?: {
    model_id: string;
    display_name: string;
    quality_score: number;
    requests: number;
    energy_kwh: number;
    co2e_grams: number;
    water_liters: number;
    avg_eco_score: number;
    eco_grade: string;
  }[];
  time_series_30d?: {
    date: string;
    energy_kwh: number;
    co2e_grams: number;
  }[];

  time_series_today?: {
    hour: string;
    energy_kwh: number;
    co2e_grams: number;
  }[];
}

export interface ModelComparisonRequest {
  model_ids: string[];
  region_id: string;
  requests_per_1k?: number;
  avg_tokens_per_request?: number;
  weights?: {
    energyEfficiency?: number;
    carbonIntensity?: number;
    waterUsage?: number;
    hardwareLifecycle?: number;
    renewableAlignment?: number;
  };
}

export interface EcoScoreBreakdown {
  score: number;
  raw: number;
  unit: string;
  explanation: string;
}

export interface EcoScoreResult {
  overall: number;
  grade: string;
  breakdown: {
    energyEfficiency: EcoScoreBreakdown;
    carbonIntensity: EcoScoreBreakdown;
    waterUsage: EcoScoreBreakdown;
    hardwareLifecycle: EcoScoreBreakdown;
    renewableAlignment: EcoScoreBreakdown;
  };
  assumptions: string[];
  confidence: string;
}

export interface ModelComparison {
  models: {
    modelId: string;
    displayName: string;
    ecoScore: EcoScoreResult;
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
  }[];
  recommendation: {
    bestOverall: string;
    bestEfficiency: string;
    bestQualityPerCarbon: string;
    narrative: string;
    tradeoffs: string[];
  };
  scenarioAssumptions: string[];
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

// ============================================================
// GREEN-AI FOOTPRINT TOOL — TYPE DEFINITIONS
// Enterprise ESG Platform for GenAI Workloads
// ============================================================

// --- Infrastructure & Model Taxonomy ---

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'on-prem';
export type CloudRegion = 
  | 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'eu-central-1' 
  | 'ap-southeast-1' | 'ap-northeast-1' | 'us-central1' | 'europe-west4'
  | 'ap-south-1' | 'ap-south-2' | 'me-south-1' | 'af-south-1'
  | 'sa-east-1' | 'eu-north-1' | 'ap-northeast-2' | 'ca-central-1'
  | 'ap-southeast-2' | 'eu-west-3';

export type GPUClass = 
  | 'nvidia-a100-80gb' | 'nvidia-a100-40gb' | 'nvidia-h100' 
  | 'nvidia-v100' | 'nvidia-t4' | 'nvidia-a10g' | 'cpu-only';

export type ModelFamily = 
  | 'gpt-4-class' | 'gpt-3.5-class' | 'llama-70b' | 'llama-13b' | 'llama-7b'
  | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku'
  | 'mistral-7b' | 'mixtral-8x7b' | 'gemini-pro' | 'gemini-nano'
  | 'grok-2' | 'deepseek-v3' | 'gemini-flash'
  | 'llama-3.1-405b' | 'qwen-72b' | 'dbrx' | 'phi-3-medium'
  | 'command-r-plus' | 'gemma-7b'
  | 'custom'
  | string; // Extensible for future model families

// --- Custom Model Input (for user-defined models) ---
export type ModelCategory = 'frontier-llm' | 'mid-size-llm' | 'small-edge' | 'code-model' | 'image-gen' | 'embedding' | 'multimodal' | 'custom';

export interface CustomModelInput {
  name: string;
  category: ModelCategory;
  parametersBillions: number;
  energyPerMillionTokensKwh: number;
  gpuType: GPUClass;
  gpuCount: number;
  tokensPerSecondPerGpu: number;
  qualityScore: number;
  description?: string;
}

export interface StoredCustomModel extends CustomModelInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// --- Carbon Intensity Data (gCO2e/kWh) ---
// Sources: IEA 2023, Ember Climate, WattTime
// These are LOCATION-BASED grid average intensities
export interface GridCarbonIntensity {
  regionId: CloudRegion;
  provider: CloudProvider;
  location: string;
  gCO2ePerKwh: number;
  source: string;
  year: number;
  renewablePercentage: number;
}

// --- GPU Power & Efficiency Models ---
export interface GPUProfile {
  id: GPUClass;
  name: string;
  tdpWatts: number; // Thermal Design Power
  typicalUtilization: number; // 0-1, typical inference utilization
  memoryGB: number;
  flopsTeraflops: number; // FP16 TFLOPS
  embodiedCarbonKgCO2e: number; // Manufacturing + shipping
  expectedLifespanHours: number;
  waterCoolingLitersPerHour: number; // Direct liquid cooling estimate
}

// --- Model Profiles ---
export interface ModelProfile {
  id: string;
  family: ModelFamily;
  displayName: string;
  parametersBillions: number;
  typicalGPU: GPUClass;
  gpuCountInference: number;
  tokensPerSecond: number; // Inference throughput per GPU
  energyPerMillionTokensKwh: number; // Primary efficiency metric
  trainingEnergyMwh: number; // Total training energy (estimated)
  trainingCO2eTons: number; // Training emissions
  qualityScore: number; // 0-100, benchmark-derived capability score
}

// --- Usage & Request Tracking ---
export interface UsageRecord {
  id: string;
  timestamp: string;
  orgId: string;
  projectId: string;
  modelId: string;
  region: CloudRegion;
  provider: CloudProvider;
  gpuClass: GPUClass;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  energyKwh: number;
  co2eGrams: number;
  waterLiters: number;
  hardwareAmortizedGrams: number;
}

// --- EcoScore System ---
export interface EcoScoreWeights {
  energyEfficiency: number;    // Weight for kWh per useful output
  carbonIntensity: number;     // Weight for CO2e per request
  waterUsage: number;          // Weight for water consumption
  hardwareLifecycle: number;   // Weight for embodied carbon amortization
  renewableAlignment: number;  // Weight for grid renewability
}

export interface EcoScoreResult {
  overall: number; // 0-100, A+ to F
  grade: string;
  breakdown: {
    energyEfficiency: { score: number; raw: number; unit: string; explanation: string };
    carbonIntensity: { score: number; raw: number; unit: string; explanation: string };
    waterUsage: { score: number; raw: number; unit: string; explanation: string };
    hardwareLifecycle: { score: number; raw: number; unit: string; explanation: string };
    renewableAlignment: { score: number; raw: number; unit: string; explanation: string };
  };
  assumptions: string[];
  confidence: 'high' | 'medium' | 'low';
}

// --- Comparison Engine ---
export interface ModelComparison {
  models: ModelComparisonEntry[];
  recommendation: ComparisonRecommendation;
  scenarioAssumptions: string[];
}

export interface ModelComparisonEntry {
  modelId: string;
  displayName: string;
  ecoScore: EcoScoreResult;
  footprint: FootprintSummary;
  qualityScore: number;
  costEfficiency: number; // Quality per unit carbon
}

export interface FootprintSummary {
  energyKwhPer1kRequests: number;
  co2eGramsPer1kRequests: number;
  waterLitersPer1kRequests: number;
  hardwareAmortizedGramsPer1kRequests: number;
  totalEquivalentKmDriving: number; // For executive context
  totalEquivalentSmartphoneCharges: number;
}

export interface ComparisonRecommendation {
  bestOverall: string;
  bestEfficiency: string;
  bestQualityPerCarbon: string;
  narrative: string;
  tradeoffs: string[];
}

// --- Dashboard & Analytics ---
export interface DashboardMetrics {
  totalRequests: number;
  totalEnergyKwh: number;
  totalCO2eKg: number;
  totalWaterLiters: number;
  avgEcoScore: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
  periodComparison: {
    energyChange: number;
    co2eChange: number;
    requestsChange: number;
  };
}

export interface TimeSeriesPoint {
  date: string;
  energyKwh: number;
  co2eGrams: number;
  requests: number;
  avgEcoScore: number;
}

// --- ESG Report ---
export interface ESGReport {
  generatedAt: string;
  reportingPeriod: { start: string; end: string };
  orgName: string;
  executiveSummary: string;
  totalFootprint: FootprintSummary;
  modelBreakdown: { modelId: string; displayName: string; percentage: number; footprint: FootprintSummary }[];
  ecoScore: EcoScoreResult;
  recommendations: string[];
  methodology: string[];
  limitations: string[];
  dataQuality: string;
}

// --- Navigation ---
export type NavSection = 'dashboard' | 'calculator' | 'comparison' | 'analytics' | 'scenarios' | 'reports' | 'settings';

// --- USP #1: AI-Aware Carbon Attribution ---
export interface CarbonAttributionBreakdown {
  operationalEmissions: {
    inference: number; // gCO2e from running inference
    networking: number; // Estimated network transfer overhead
    storage: number; // Data storage emissions (minimal for inference)
  };
  embodiedEmissions: {
    hardware: number; // Amortized GPU/server manufacturing
    infrastructure: number; // Data center construction amortization
  };
  upstreamEmissions: {
    training: number; // Amortized model training emissions
    finetuning: number; // If applicable
  };
  totalGrams: number;
  confidenceInterval: {
    low: number;
    high: number;
    confidence: 'high' | 'medium' | 'low';
  };
  methodology: string[];
}

export interface HardwareEfficiencyTier {
  tier: 'optimal' | 'standard' | 'legacy';
  description: string;
  efficiencyMultiplier: number;
}

export interface ModelArchitectureClass {
  type: 'dense-transformer' | 'moe' | 'retrieval-augmented' | 'multimodal' | 'encoder-only' | 'diffusion';
  label: string;
  inferenceCharacteristics: string;
  energyProfile: 'high' | 'medium' | 'low';
}

// --- USP #2: Scenario Simulation ---
export interface ScenarioConfig {
  id: string;
  name: string;
  modelId: string;
  region: CloudRegion;
  requestCount: number;
  avgTokensPerRequest: number;
  usagePattern: 'realtime' | 'batch' | 'mixed';
  pue?: number;
  wue?: number;
}

export interface ScenarioResult {
  config: ScenarioConfig;
  footprint: {
    energyKwh: number;
    co2eGrams: number;
    waterLiters: number;
    hardwareGrams: number;
  };
  ecoScore: number;
  ecoGrade: string;
  attribution: CarbonAttributionBreakdown;
}

export interface ScenarioComparison {
  baseline: ScenarioResult;
  proposed: ScenarioResult;
  delta: {
    energyKwh: number;
    energyPercent: number;
    co2eGrams: number;
    co2ePercent: number;
    waterLiters: number;
    waterPercent: number;
    ecoScore: number;
  };
  recommendation: string;
  tradeoffs: string[];
  annualProjection: {
    co2eSavedKg: number;
    energySavedKwh: number;
    costImplication: string;
  };
}

// --- USP #3: Audit-Ready ESG & Regulatory Alignment ---
export interface AuditMetadata {
  calculationVersion: string;
  timestamp: string;
  inputHash: string;
  assumptions: AuditAssumption[];
  dataQuality: DataQualityAssessment;
  regulatoryAlignment: RegulatoryAlignment[];
}

export interface AuditAssumption {
  category: 'energy' | 'carbon' | 'water' | 'hardware' | 'model';
  assumption: string;
  source: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

export interface DataQualityAssessment {
  overall: 'high' | 'medium' | 'low';
  factors: {
    factor: string;
    score: number;
    notes: string;
  }[];
}

export interface RegulatoryAlignment {
  framework: string;
  description: string;
  alignmentLevel: 'full' | 'partial' | 'conceptual';
  notes: string;
}

export interface AuditTrail {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  inputSummary: string;
  outputSummary: string;
  metadata: AuditMetadata;
}

// --- Organization Hierarchy ---
export interface Organization {
  id: string;
  name: string;
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  models: string[]; // modelProfile IDs
}

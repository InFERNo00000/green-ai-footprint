-- ============================================================
-- GREEN-AI FOOTPRINT TOOL — PostgreSQL Schema
-- 
-- This schema supports both predefined and custom AI models
-- for enterprise footprint calculations.
--
-- DEPLOYMENT: PostgreSQL 15+
-- ============================================================

-- Enum types
CREATE TYPE model_category AS ENUM (
  'frontier-llm',
  'mid-size-llm',
  'small-edge',
  'code-model',
  'image-gen',
  'embedding',
  'multimodal',
  'custom'
);

CREATE TYPE gpu_type AS ENUM (
  'nvidia-h100',
  'nvidia-a100-80gb',
  'nvidia-a100-40gb',
  'nvidia-v100',
  'nvidia-t4',
  'nvidia-a10g',
  'cpu-only'
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI Models Table
-- Stores both predefined (seeded) and user-defined custom models
-- ============================================================
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identification
  slug VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'gpt4', 'custom-abc123'
  display_name VARCHAR(200) NOT NULL,
  family VARCHAR(100) NOT NULL, -- Model family identifier
  
  -- Classification
  category model_category NOT NULL,
  is_predefined BOOLEAN DEFAULT FALSE, -- TRUE = system-seeded, FALSE = user-created
  
  -- Model specifications
  parameters_billion DECIMAL(10,4) NOT NULL,
  energy_per_million_tokens_kwh DECIMAL(10,6) NOT NULL,
  default_gpu gpu_type NOT NULL,
  gpu_count_inference INTEGER NOT NULL DEFAULT 1,
  tokens_per_second_per_gpu INTEGER NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  
  -- Training metadata (optional, for context)
  training_energy_mwh DECIMAL(12,2),
  training_co2e_tons DECIMAL(12,2),
  
  -- User-provided context
  description TEXT,
  
  -- Ownership (NULL for predefined models)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_params CHECK (parameters_billion > 0 AND parameters_billion <= 10000),
  CONSTRAINT chk_energy CHECK (energy_per_million_tokens_kwh > 0 AND energy_per_million_tokens_kwh <= 100),
  CONSTRAINT chk_throughput CHECK (tokens_per_second_per_gpu > 0 AND tokens_per_second_per_gpu <= 10000),
  CONSTRAINT chk_gpu_count CHECK (gpu_count_inference >= 1 AND gpu_count_inference <= 64)
);

-- Indexes for common queries
CREATE INDEX idx_ai_models_org ON ai_models(organization_id) WHERE is_active = TRUE;
CREATE INDEX idx_ai_models_category ON ai_models(category) WHERE is_active = TRUE;
CREATE INDEX idx_ai_models_predefined ON ai_models(is_predefined) WHERE is_active = TRUE;

-- ============================================================
-- Footprint calculation logs (audit trail)
-- ============================================================
CREATE TABLE calculation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  model_id UUID REFERENCES ai_models(id),
  region_id VARCHAR(50) NOT NULL,
  request_count INTEGER NOT NULL,
  avg_tokens_per_request INTEGER NOT NULL,
  total_tokens BIGINT NOT NULL,
  
  -- Results
  energy_kwh DECIMAL(12,6) NOT NULL,
  co2e_grams DECIMAL(12,4) NOT NULL,
  water_liters DECIMAL(12,6) NOT NULL,
  hardware_amortized_grams DECIMAL(12,6) NOT NULL,
  eco_score DECIMAL(5,1),
  eco_grade VARCHAR(3),
  
  -- Configuration used
  pue_factor DECIMAL(4,2),
  wue_factor DECIMAL(4,2),
  
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calc_logs_org ON calculation_logs(organization_id, calculated_at DESC);

-- ============================================================
-- Seed predefined models
-- ============================================================
INSERT INTO ai_models (slug, display_name, family, category, is_predefined, parameters_billion, energy_per_million_tokens_kwh, default_gpu, gpu_count_inference, tokens_per_second_per_gpu, quality_score, training_energy_mwh, training_co2e_tons) VALUES
  ('gpt4', 'GPT-4 Class (≈1.8T params)', 'gpt-4-class', 'frontier-llm', TRUE, 1800, 4.2, 'nvidia-a100-80gb', 8, 40, 95, 62000, 21000),
  ('gpt35', 'GPT-3.5 Class (≈175B params)', 'gpt-3.5-class', 'mid-size-llm', TRUE, 175, 0.45, 'nvidia-a100-40gb', 2, 120, 78, 1287, 552),
  ('claude3-opus', 'Claude 3 Opus Class', 'claude-3-opus', 'frontier-llm', TRUE, 500, 2.8, 'nvidia-a100-80gb', 4, 50, 93, 30000, 10200),
  ('claude3-sonnet', 'Claude 3 Sonnet Class', 'claude-3-sonnet', 'mid-size-llm', TRUE, 150, 0.55, 'nvidia-a100-40gb', 2, 100, 85, 8000, 2720),
  ('claude3-haiku', 'Claude 3 Haiku Class', 'claude-3-haiku', 'small-edge', TRUE, 30, 0.08, 'nvidia-a10g', 1, 300, 72, 1500, 510),
  ('llama70b', 'Llama 3 70B', 'llama-70b', 'mid-size-llm', TRUE, 70, 0.85, 'nvidia-a100-80gb', 2, 80, 80, 6500, 2210),
  ('llama13b', 'Llama 2 13B', 'llama-13b', 'small-edge', TRUE, 13, 0.15, 'nvidia-a10g', 1, 150, 62, 1200, 408),
  ('llama7b', 'Llama 2 7B', 'llama-7b', 'small-edge', TRUE, 7, 0.05, 'nvidia-t4', 1, 200, 55, 500, 170),
  ('mistral7b', 'Mistral 7B', 'mistral-7b', 'small-edge', TRUE, 7, 0.04, 'nvidia-t4', 1, 220, 60, 400, 136),
  ('mixtral8x7b', 'Mixtral 8x7B (MoE)', 'mixtral-8x7b', 'mid-size-llm', TRUE, 47, 0.25, 'nvidia-a100-40gb', 1, 110, 74, 2000, 680),
  ('gemini-pro', 'Gemini Pro Class', 'gemini-pro', 'frontier-llm', TRUE, 300, 1.8, 'nvidia-h100', 4, 70, 90, 25000, 8500),
  ('grok-2', 'Grok-2 (xAI, ≈314B params)', 'grok-2', 'frontier-llm', TRUE, 314, 2.4, 'nvidia-h100', 4, 55, 88, 35000, 11900),
  ('deepseek-v3', 'DeepSeek-V3 (MoE, 671B total / 37B active)', 'deepseek-v3', 'frontier-llm', TRUE, 671, 0.95, 'nvidia-h100', 4, 90, 86, 5500, 1870),
  ('gemini-flash-2', 'Gemini 2.0 Flash (Google, distilled)', 'gemini-flash', 'small-edge', TRUE, 9, 0.10, 'nvidia-t4', 1, 180, 74, 800, 272),
  ('llama-3.1-405b', 'Llama 3.1 405B (Meta, open-weight)', 'llama-3.1-405b', 'frontier-llm', TRUE, 405, 3.6, 'nvidia-h100', 8, 30, 92, 39000, 13260),
  ('qwen-72b', 'Qwen 2.5 72B (Alibaba Cloud)', 'qwen-72b', 'mid-size-llm', TRUE, 72, 0.90, 'nvidia-a100-80gb', 2, 75, 82, 7000, 2380),
  ('dbrx', 'DBRX 132B (Databricks, MoE)', 'dbrx', 'mid-size-llm', TRUE, 132, 1.10, 'nvidia-a100-80gb', 4, 60, 78, 9000, 3060),
  ('phi-3-medium', 'Phi-3 Medium 14B (Microsoft)', 'phi-3-medium', 'small-edge', TRUE, 14, 0.18, 'nvidia-a10g', 1, 130, 71, 1400, 476),
  ('command-r-plus', 'Command R+ (Cohere, 104B)', 'command-r-plus', 'mid-size-llm', TRUE, 104, 1.50, 'nvidia-a100-80gb', 2, 65, 83, 8500, 2890),
  ('gemma-7b', 'Gemma 2 9B (Google, open)', 'gemma-7b', 'small-edge', TRUE, 9, 0.06, 'nvidia-t4', 1, 170, 64, 600, 204);

// ============================================================
// API CLIENT SERVICE
// 
// Replaces simulation.ts and localStorage with real API calls
// to the FastAPI backend. All data now comes from the database.
// ============================================================

import type { 
  AIModelResponse, 
  CalculationRequest, 
  CalculationResponse,
  DashboardMetricsResponse,
  ModelComparisonRequest,
  ModelComparison as ModelComparisonResponse
} from '../types/api';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  'http://127.0.0.1:8001';

// Helper for API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(method === 'GET'
        ? {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          }
        : {}),
      ...options.headers,
    },
    ...(method === 'GET' ? { cache: 'no-store' as RequestCache } : {}),
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(`[API ERROR] ${method} ${url} -> ${response.status}`, error);
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

async function apiDownload(endpoint: string, options: RequestInit = {}): Promise<{ blob: Blob; filename?: string }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const response = await fetch(url, {
    headers: {
      ...(method === 'GET'
        ? {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          }
        : {}),
      ...options.headers,
    },
    ...(method === 'GET' ? { cache: 'no-store' as RequestCache } : {}),
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  const cd = response.headers.get('content-disposition') || undefined;
  let filename: string | undefined;
  if (cd) {
    const m = cd.match(/filename=\"?([^\";]+)\"?/i);
    if (m?.[1]) filename = m[1];
  }

  const blob = await response.blob();
  return { blob, filename };
}

// ============================================================
// Models API
// ============================================================

export async function getModels(
  category?: string,
  includeCustom: boolean = true,
  includePredefined: boolean = true
): Promise<{ models: AIModelResponse[], total: number, predefined_count: number, custom_count: number }> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (!includeCustom) params.append('include_custom', 'false');
  if (!includePredefined) params.append('include_predefined', 'false');

  const endpoint = `/api/v1/models${params.toString() ? `?${params.toString()}` : ''}`;
  return apiCall(endpoint);
}

export async function getModel(modelId: string): Promise<AIModelResponse> {
  return apiCall(`/api/v1/models/${modelId}`);
}

export async function createCustomModel(modelData: {
  display_name: string;
  family: string;
  category: string;
  parameters_billion: number;
  energy_per_million_tokens_kwh: number;
  default_gpu: string;
  gpu_count_inference: number;
  tokens_per_second_per_gpu: number;
  quality_score: number;
  description?: string;
}): Promise<AIModelResponse> {
  return apiCall('/api/v1/models', {
    method: 'POST',
    body: JSON.stringify(modelData),
  });
}

export async function updateCustomModel(
  modelId: string, 
  updates: Partial<AIModelResponse>
): Promise<AIModelResponse> {
  return apiCall(`/api/v1/models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteCustomModel(modelId: string): Promise<void> {
  return apiCall(`/api/v1/models/${modelId}`, {
    method: 'DELETE',
  });
}

// ============================================================
// Calculations API
// ============================================================

export async function calculateFootprint(request: CalculationRequest): Promise<CalculationResponse> {
  return apiCall('/api/v1/calculate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================
// Dashboard API
// ============================================================

export async function getDashboardMetrics(): Promise<DashboardMetricsResponse> {
  // Aggressive cache busting with random + timestamp
  const cacheBuster = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return apiCall(`/api/v1/dashboard?_cb=${cacheBuster}`);
}

export async function getAnalytics(params?: { region_id?: string; days?: number }): Promise<any> {
  const search = new URLSearchParams();
  if (params?.region_id) search.set('region_id', params.region_id);
  if (params?.days) search.set('days', String(params.days));
  const endpoint = `/api/v1/analytics${search.toString() ? `?${search.toString()}` : ''}`;
  return apiCall(endpoint);
}

// ============================================================
// Reference Data API
// ============================================================

export async function getRegions(): Promise<Array<{
  id: string;
  region_id: string;
  provider: string;
  location: string;
  gco2e_per_kwh: number;
  source: string;
  year: number;
  renewable_percentage: number;
}>> {
  return apiCall('/api/v1/reference/regions');
}

export async function getGpus(): Promise<Array<{
  id: string;
  name: string;
  tdp_watts: number;
  typical_utilization: number;
  memory_gb: number;
  flops_teraflops: number;
  embodied_carbon_kg_co2e: number;
  expected_lifespan_hours: number;
  water_cooling_liters_per_hour: number;
}>> {
  return apiCall('/api/v1/reference/gpus');
}

export async function getSettingsDefaults(): Promise<{
  default_pue: number;
  default_wue: number;
  ecoscore_weights: Record<string, number>;
}> {
  return apiCall('/api/v1/reference/settings-defaults');
}

// ============================================================
// Model Comparison API
// ============================================================

export async function compareModels(request: ModelComparisonRequest): Promise<ModelComparisonResponse> {
  return apiCall('/api/v1/compare', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function compareScenarios(request: {
  baseline: { model_id: string; region_id: string; request_count: number; avg_tokens_per_request: number };
  proposed: { model_id: string; region_id: string; request_count: number; avg_tokens_per_request: number };
}): Promise<any> {
  return apiCall('/api/v1/scenarios/compare', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================
// Health Check
// ============================================================

export async function healthCheck(): Promise<{ status: string; version: string; timestamp: string }> {
  return apiCall('/api/v1/health');
}

export async function getReports(): Promise<{ reports: any[]; total: number }> {
  return apiCall('/api/v1/reports');
}

export async function generateReport(request?: { days?: number; name?: string }): Promise<any> {
  return apiCall('/api/v1/reports/generate', {
    method: 'POST',
    body: JSON.stringify({
      days: request?.days,
      name: request?.name,
    }),
  });
}

export async function getReport(reportId: string): Promise<any> {
  return apiCall(`/api/v1/reports/${reportId}`);
}

export async function exportReportPdf(reportId: string): Promise<{ blob: Blob; filename?: string }> {
  return apiDownload(`/api/v1/reports/${reportId}/export/pdf`);
}

export async function exportReportDocx(reportId: string): Promise<{ blob: Blob; filename?: string }> {
  return apiDownload(`/api/v1/reports/${reportId}/export/docx`);
}

// ============================================================
// Error handling utilities
// ============================================================

export function isApiError(error: unknown): error is { message: string } {
  return error instanceof Error && 'message' in error;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

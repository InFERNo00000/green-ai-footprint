// ============================================================
// FOOTPRINT CALCULATOR - API VERSION
// 
// Replaces local calculations with API calls to backend
// ============================================================

import { useState, useEffect } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateFootprint, getModels, getRegions } from '@/services/apiClient';
import type { CloudRegion } from '@/types';
import type { CalculationResponse, AIModelResponse } from '@/types/api';

export function FootprintCalculatorAPI() {
  const [models, setModels] = useState<AIModelResponse[]>([]);
  const [regions, setRegions] = useState<Array<{ id: string; region_id: CloudRegion; location: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [lastRunPersisted, setLastRunPersisted] = useState<boolean | null>(null);

  // Form state
  const [modelId, setModelId] = useState<string>('');
  const [region, setRegion] = useState<CloudRegion>('eu-central-1');
  const [requestCount, setRequestCount] = useState(10000);
  const [avgTokens, setAvgTokens] = useState(1000);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Load models + regions on mount
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [modelsResponse, regionsResponse] = await Promise.all([
          getModels(),
          getRegions(),
        ]);

        setModels(modelsResponse.models);
        if (modelsResponse.models.length > 0) {
          setModelId(modelsResponse.models[0].id);
        }

        setRegions(
          regionsResponse.map((r) => ({
            id: r.id,
            region_id: r.region_id as CloudRegion,
            location: r.location,
          }))
        );
      } catch (err) {
        setError('Failed to load reference data');
        console.error('Reference data load error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Handle calculation
  const handleCalculate = async (persist: boolean) => {
    if (!modelId) {
      setError('Please select a model');
      return;
    }

    try {
      setCalculating(true);
      setError(null);
      
      const response = await calculateFootprint({
        model_id: modelId,
        region_id: region,
        request_count: requestCount,
        avg_tokens_per_request: avgTokens,
        persist,
      });

      setResult(response);
      setLastRunPersisted(persist);
    } catch (err) {
      setError('Calculation failed');
      console.error('Calculation error:', err);
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">AI Footprint Calculator</h1>
        <p className="mt-0.5 text-xs text-slate-500">Calculate the environmental impact of your AI workloads</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[13px] font-medium text-slate-800">Inputs</h3>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-2">AI Model</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Select a model...</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.display_name} ({model.is_predefined ? 'Predefined' : 'Custom'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-2">Cloud Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as CloudRegion)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.region_id}>
                  {r.location} ({r.region_id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-2">Number of Requests</label>
              <input
                type="number"
                value={requestCount}
                onChange={(e) => setRequestCount(Number(e.target.value))}
                min="1"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-2">Average Tokens per Request</label>
              <input
                type="number"
                value={avgTokens}
                onChange={(e) => setAvgTokens(Number(e.target.value))}
                min="1"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => handleCalculate(false)}
              disabled={calculating || !modelId}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {calculating ? 'Calculating...' : 'Preview (no dashboard)'}
            </button>
            <button
              onClick={() => handleCalculate(true)}
              disabled={calculating || !modelId}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {calculating ? 'Calculating...' : 'Save to Dashboard'}
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-[13px] font-medium text-slate-800">Results</h3>
          </div>

          <div className="space-y-5 px-4 py-4">
            {lastRunPersisted !== null ? (
              <div className={lastRunPersisted ? "rounded-md border border-emerald-200 bg-emerald-50 p-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"}>
                <p className={lastRunPersisted ? "text-[12px] text-emerald-800" : "text-[12px] text-slate-700"}>
                  {lastRunPersisted ? 'Saved to Dashboard: this run was logged and will affect Dashboard totals.' : 'Preview only: this run was not logged and will not affect Dashboard totals.'}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xl font-semibold text-slate-900 tabular-nums">{result.energy_kwh.toFixed(3)}</div>
                <div className="mt-1 text-[11px] text-slate-500">kWh Energy</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xl font-semibold text-slate-900 tabular-nums">{result.co2e_grams.toFixed(1)}</div>
                <div className="mt-1 text-[11px] text-slate-500">g CO₂e</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xl font-semibold text-slate-900 tabular-nums">{result.water_liters.toFixed(2)}</div>
                <div className="mt-1 text-[11px] text-slate-500">Liters Water</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xl font-semibold text-slate-900 tabular-nums">{result.eco_score.toFixed(1)}</div>
                <div className="mt-1 text-[11px] text-slate-500">EcoScore ({result.eco_grade})</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-[13px] font-medium text-slate-800">Equivalent Impact</h4>
                <div className="mt-2 space-y-1 text-[13px] text-slate-700">
                  <div>{result.equivalent_km_driving.toFixed(1)} km driving</div>
                  <div>{result.equivalent_smartphone_charges.toFixed(0)} smartphone charges</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-[13px] font-medium text-slate-800">Per-Request Metrics</h4>
                <div className="mt-2 space-y-1 text-[13px] text-slate-700">
                  <div>Energy: {result.energy_per_request.toFixed(6)} kWh</div>
                  <div>CO₂e: {result.co2e_per_request.toFixed(3)} g</div>
                  <div>Water: {result.water_per_request.toFixed(4)} L</div>
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowAssumptions(!showAssumptions)}
                className="flex items-center gap-2 text-[13px] text-slate-600 hover:text-slate-900"
              >
                <Info className="h-4 w-4" />
                {showAssumptions ? 'Hide' : 'Show'} Assumptions
                {showAssumptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAssumptions && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-[13px] font-medium text-slate-800">Calculation Assumptions</h4>
                  <ul className="mt-2 space-y-1 text-[13px] text-slate-700">
                    {result.assumptions.map((assumption, index) => (
                      <li key={index}>{assumption}</li>
                    ))}
                  </ul>
                  <div className="mt-3 text-[11px] text-slate-500">Confidence: {result.confidence}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

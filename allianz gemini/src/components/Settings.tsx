import { useState } from 'react';
import { Save, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DEFAULT_ECOSCORE_WEIGHTS } from '@/engine/constants';

export function Settings() {
  const [weights, setWeights] = useState({ ...DEFAULT_ECOSCORE_WEIGHTS });
  const [pue, setPue] = useState(1.2);
  const [wue, setWue] = useState(1.1);
  const [saved, setSaved] = useState(false);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const isValid = Math.abs(totalWeight - 1.0) < 0.01;

  const handleSave = () => {
    if (!isValid) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Configure EcoScore weights, infrastructure parameters, and integration endpoints
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* EcoScore Weights */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-slate-800">EcoScore Weight Configuration</h3>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Adjust weights to reflect organizational priorities. Total must equal 1.0.
          </p>

          <div className="mt-4 space-y-3.5">
            {[
              { key: 'energyEfficiency', label: 'Energy Efficiency', desc: 'kWh per unit output' },
              { key: 'carbonIntensity', label: 'Carbon Intensity', desc: 'CO₂e emissions' },
              { key: 'waterUsage', label: 'Water Usage', desc: 'Water consumption' },
              { key: 'hardwareLifecycle', label: 'Hardware Lifecycle', desc: 'Embodied carbon' },
              { key: 'renewableAlignment', label: 'Renewable Alignment', desc: 'Grid renewable %' },
            ].map(({ key, label, desc }) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="text-[11px] font-medium text-slate-600">{label}</label>
                    <p className="text-[10px] text-slate-400">{desc}</p>
                  </div>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={weights[key as keyof typeof weights]}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right text-[13px] focus:border-teal-600 focus:outline-none flex-shrink-0 tabular-nums"
                    inputMode="decimal"
                  />
                </div>
                <div className="mt-1 h-0.5 rounded-full bg-slate-100">
                  <div
                    className="h-0.5 rounded-full bg-teal-600 transition-all"
                    style={{ width: `${weights[key as keyof typeof weights] * 100}%` }}
                  />
                </div>
              </div>
            ))}

            <div className={cn('flex items-center justify-between rounded-md p-2 text-[11px] font-medium', isValid ? 'bg-slate-50 text-slate-600' : 'bg-red-50 text-red-600')}>
              <span>Total: {totalWeight.toFixed(2)}</span>
              {!isValid && <span>Must equal 1.0</span>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Infrastructure */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800">Infrastructure Parameters</h3>
            <div className="mt-3.5 space-y-3.5">
              <div>
                <label className="text-[11px] font-medium text-slate-600">
                  Power Usage Effectiveness (PUE)
                </label>
                <p className="text-[10px] text-slate-400">
                  Ratio of total facility energy to IT equipment energy. Range: 1.0–2.0
                </p>
                <input
                  type="number"
                  step={0.05}
                  min={1.0}
                  max={2.0}
                  value={pue}
                  onChange={(e) => setPue(parseFloat(e.target.value) || 1.2)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none tabular-nums"
                  inputMode="decimal"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Google 1.10 · Microsoft 1.18 · Industry avg 1.58
                </p>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600">
                  Water Usage Effectiveness (WUE)
                </label>
                <p className="text-[10px] text-slate-400">
                  Liters per kWh for cooling. Range: 0.1–3.0
                </p>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={3.0}
                  value={wue}
                  onChange={(e) => setWue(parseFloat(e.target.value) || 1.1)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] focus:border-teal-600 focus:outline-none tabular-nums"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          {/* API */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800">API Integration</h3>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Production endpoints for FastAPI backend services.
            </p>
            <div className="mt-3 space-y-2.5">
              {[
                { label: 'Ingestion API', endpoint: 'POST /api/v1/usage/ingest' },
                { label: 'Footprint API', endpoint: 'POST /api/v1/footprint/calculate' },
                { label: 'EcoScore API', endpoint: 'GET /api/v1/ecoscore/{model_id}' },
              ].map(({ label, endpoint }) => (
                <div key={label} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-medium text-slate-400 uppercase">{label}</p>
                  <p className="text-[11px] text-slate-600 font-mono mt-0.5 break-all">{endpoint}</p>
                  <span className="mt-1 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">
                    Not connected (PoC)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-[13px] font-medium text-slate-800">Architecture</h3>
            <div className="mt-3 text-[11px] text-slate-500 space-y-1.5">
              <p><span className="text-slate-600 font-medium">Database:</span> PostgreSQL with partitioned time-series tables. Multi-tenant hierarchy.</p>
              <p><span className="text-slate-600 font-medium">Backend:</span> Python FastAPI with async handlers. Mirrors frontend calculation engine.</p>
              <p><span className="text-slate-600 font-medium">Security:</span> JWT auth, RBAC, field-level encryption for infrastructure details.</p>
              <p><span className="text-slate-600 font-medium">Deployment:</span> Render with auto-scaling. Managed PostgreSQL with automated backups.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start sm:items-center gap-2 text-[11px] text-slate-400">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 sm:mt-0" />
          <span>Settings stored in browser session for PoC. Production: persisted via API.</span>
        </div>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium transition-colors w-full sm:w-auto justify-center flex-shrink-0',
            saved
              ? 'bg-teal-50 text-teal-700 border border-teal-200'
              : isValid
              ? 'bg-slate-800 text-white hover:bg-slate-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}
        >
          <Save className="h-3.5 w-3.5" />
          {saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

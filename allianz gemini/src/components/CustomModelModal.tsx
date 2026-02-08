import { useState, useCallback, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GPU_PROFILES } from '@/engine/constants';
import { addCustomModel, validateCustomModel, estimateEnergyFromParams, VALIDATION } from '@/stores/customModels';
import type { CustomModelInput, ModelCategory, GPUClass } from '@/types';

interface CustomModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelAdded: () => void;
}

const CATEGORY_OPTIONS: { value: ModelCategory; label: string }[] = [
  { value: 'frontier-llm', label: 'Frontier LLM (>100B params)' },
  { value: 'mid-size-llm', label: 'Mid-Size LLM (7B–100B)' },
  { value: 'small-edge', label: 'Small / Edge Model (<7B)' },
  { value: 'code-model', label: 'Code Generation' },
  { value: 'image-gen', label: 'Image Generation' },
  { value: 'embedding', label: 'Embedding Model' },
  { value: 'multimodal', label: 'Multimodal' },
  { value: 'custom', label: 'Other / Custom' },
];

export function CustomModelModal({ isOpen, onClose, onModelAdded }: CustomModelModalProps) {
  const [form, setForm] = useState<CustomModelInput>({
    name: '',
    category: 'mid-size-llm',
    parametersBillions: 7,
    energyPerMillionTokensKwh: 0.25,
    gpuType: 'nvidia-t4',
    gpuCount: 1,
    tokensPerSecondPerGpu: 100,
    qualityScore: 60,
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setSubmitError('');
      setSaving(false);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const updateField = useCallback(<K extends keyof CustomModelInput>(field: K, value: CustomModelInput[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear field error on change
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleEstimate = useCallback(() => {
    const estimated = estimateEnergyFromParams(form.parametersBillions, form.gpuType);
    updateField('energyPerMillionTokensKwh', estimated);
  }, [form.parametersBillions, form.gpuType, updateField]);

  const handleSubmit = useCallback(() => {
    const validationErrors = validateCustomModel(form);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(e => { errorMap[e.field] = e.message; });
      setErrors(errorMap);
      return;
    }

    setSaving(true);
    // Simulate brief save delay (in production, this would be an API call)
    setTimeout(() => {
      const result = addCustomModel(form);
      if (result.success) {
        onModelAdded();
        onClose();
        // Reset form for next use
        setForm({
          name: '',
          category: 'mid-size-llm',
          parametersBillions: 7,
          energyPerMillionTokensKwh: 0.25,
          gpuType: 'nvidia-t4',
          gpuCount: 1,
          tokensPerSecondPerGpu: 100,
          qualityScore: 60,
          description: '',
        });
      } else {
        setSubmitError('Failed to save model. Please check inputs.');
        if (result.errors) {
          const errorMap: Record<string, string> = {};
          result.errors.forEach(e => { errorMap[e.field] = e.message; });
          setErrors(errorMap);
        }
      }
      setSaving(false);
    }, 300);
  }, [form, onModelAdded, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-lg border border-slate-200 shadow-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between rounded-t-lg z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Add Custom AI Model</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Define parameters for footprint calculation</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Model Name */}
          <FieldGroup label="Model Name" error={errors.name} required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., My Fine-tuned Llama 3"
              className={cn(
                'w-full rounded-md border px-2.5 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-1',
                errors.name
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600'
              )}
              maxLength={VALIDATION.name.maxLength}
            />
          </FieldGroup>

          {/* Category */}
          <FieldGroup label="Model Category" error={errors.category}>
            <select
              value={form.category}
              onChange={(e) => updateField('category', e.target.value as ModelCategory)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FieldGroup>

          {/* Parameters + Quality — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Parameters (Billions)" error={errors.parametersBillions}>
              <input
                type="number"
                value={form.parametersBillions}
                onChange={(e) => updateField('parametersBillions', parseFloat(e.target.value) || 0)}
                className={cn(
                  'w-full rounded-md border px-2.5 py-2 text-[13px] focus:outline-none focus:ring-1',
                  errors.parametersBillions
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600'
                )}
                min={VALIDATION.parametersBillions.min}
                max={VALIDATION.parametersBillions.max}
                step="0.1"
                inputMode="decimal"
              />
              <p className="text-[9px] text-slate-400 mt-0.5">{VALIDATION.parametersBillions.min}B – {VALIDATION.parametersBillions.max.toLocaleString()}B</p>
            </FieldGroup>
            <FieldGroup label="Quality Score (0–100)" error={errors.qualityScore}>
              <input
                type="number"
                value={form.qualityScore}
                onChange={(e) => updateField('qualityScore', parseInt(e.target.value) || 0)}
                className={cn(
                  'w-full rounded-md border px-2.5 py-2 text-[13px] focus:outline-none focus:ring-1',
                  errors.qualityScore
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600'
                )}
                min={VALIDATION.qualityScore.min}
                max={VALIDATION.qualityScore.max}
                inputMode="numeric"
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Benchmark-derived capability</p>
            </FieldGroup>
          </div>

          {/* GPU Type + Count — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="GPU Type" error={errors.gpuType}>
              <select
                value={form.gpuType}
                onChange={(e) => updateField('gpuType', e.target.value as GPUClass)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                {GPU_PROFILES.map(gpu => (
                  <option key={gpu.id} value={gpu.id}>{gpu.name}</option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup label="GPU Count" error={errors.gpuCount}>
              <input
                type="number"
                value={form.gpuCount}
                onChange={(e) => updateField('gpuCount', parseInt(e.target.value) || 1)}
                className={cn(
                  'w-full rounded-md border px-2.5 py-2 text-[13px] focus:outline-none focus:ring-1',
                  errors.gpuCount
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600'
                )}
                min={VALIDATION.gpuCount.min}
                max={VALIDATION.gpuCount.max}
                inputMode="numeric"
              />
            </FieldGroup>
          </div>

          {/* Energy + Estimation */}
          <FieldGroup label="Energy per Million Tokens (kWh)" error={errors.energyPerMillionTokensKwh}>
            <div className="flex gap-2">
              <input
                type="number"
                value={form.energyPerMillionTokensKwh}
                onChange={(e) => updateField('energyPerMillionTokensKwh', parseFloat(e.target.value) || 0)}
                className={cn(
                  'flex-1 rounded-md border px-2.5 py-2 text-[13px] focus:outline-none focus:ring-1 tabular-nums',
                  errors.energyPerMillionTokensKwh
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600'
                )}
                min={VALIDATION.energyPerMillionTokensKwh.min}
                max={VALIDATION.energyPerMillionTokensKwh.max}
                step="0.001"
                inputMode="decimal"
              />
              <button
                type="button"
                onClick={handleEstimate}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                title="Estimate from parameter count and GPU type"
              >
                <Lightbulb className="h-3 w-3" />
                Estimate
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">
              Use "Estimate" to derive from params × GPU, or enter a known value. Range: {VALIDATION.energyPerMillionTokensKwh.min}–{VALIDATION.energyPerMillionTokensKwh.max} kWh
            </p>
          </FieldGroup>

          {/* Throughput */}
          <FieldGroup label="Tokens/sec per GPU" error={errors.tokensPerSecondPerGpu}>
            <input
              type="number"
              value={form.tokensPerSecondPerGpu}
              onChange={(e) => updateField('tokensPerSecondPerGpu', parseInt(e.target.value) || 1)}
              className={cn(
                'w-full rounded-md border px-2.5 py-2 text-[13px] focus:outline-none focus:ring-1',
                errors.tokensPerSecondPerGpu
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600'
              )}
              min={VALIDATION.tokensPerSecondPerGpu.min}
              max={VALIDATION.tokensPerSecondPerGpu.max}
              inputMode="numeric"
            />
            <p className="text-[9px] text-slate-400 mt-0.5">Inference throughput per GPU. Used for duration and water estimates.</p>
          </FieldGroup>

          {/* Description (optional) */}
          <FieldGroup label="Description (optional)">
            <input
              type="text"
              value={form.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="e.g., Fine-tuned for insurance claim processing"
              className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-[13px] text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              maxLength={200}
            />
          </FieldGroup>

          {/* Methodology notice */}
          <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 text-[10px] text-slate-500 leading-relaxed">
            <strong className="text-slate-600">Note:</strong> Custom model calculations use the same engine as predefined models.
            Energy coefficients you provide will be treated as ground truth — ensure they reflect realistic measurements or estimates.
            The EcoScore confidence level for custom models is set to "low" to indicate unverified data.
          </div>

          {/* Error banner */}
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-end gap-2 rounded-b-lg">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-md bg-slate-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Add Model'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

import { useMemo, useState, useCallback } from 'react';
import { FileText, Download, Clock, CheckCircle2, Shield, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  calculateEcoScore,
  calculateFullFootprint,
  getGradeBgClass,
  generateAuditMetadata,
  CALCULATION_VERSION,
} from '@/engine/calculator';
import { DEMO_ORG, generateModelUsageBreakdown } from '@/engine/simulation';
import type { ESGReport, CloudRegion, AuditMetadata } from '@/types';

export function ESGReports() {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  // Generate audit metadata for the report
  const auditMetadata: AuditMetadata = useMemo(() => {
    return generateAuditMetadata('claude3-sonnet', 'eu-central-1', 100000, 900);
  }, []);

  const report: ESGReport = useMemo(() => {
    const region: CloudRegion = 'eu-central-1';
    const breakdown = generateModelUsageBreakdown(region);
    const ecoScore = calculateEcoScore('claude3-sonnet', region);

    const totalCO2e = breakdown.reduce((s, m) => s + m.co2eGrams, 0);
    const totalEnergy = breakdown.reduce((s, m) => s + m.energyKwh, 0);
    const totalWater = breakdown.reduce((s, m) => s + m.waterLiters, 0);
    const totalRequests = breakdown.reduce((s, m) => s + m.requests, 0);

    const modelBreakdownItems = breakdown.map((m) => {
      const fp = calculateFullFootprint({
        modelId: m.modelId,
        region,
        totalTokens: m.requests * 850,
        requestCount: m.requests,
      });
      return {
        modelId: m.modelId,
        displayName: m.displayName,
        percentage: Math.round((m.co2eGrams / totalCO2e) * 100),
        footprint: {
          energyKwhPer1kRequests: fp.energyKwh,
          co2eGramsPer1kRequests: fp.co2eGrams,
          waterLitersPer1kRequests: fp.waterLiters,
          hardwareAmortizedGramsPer1kRequests: fp.hardwareAmortizedGrams,
          totalEquivalentKmDriving: fp.equivalentKmDriving,
          totalEquivalentSmartphoneCharges: fp.equivalentSmartphoneCharges,
        },
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      reportingPeriod: {
        start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
      },
      orgName: DEMO_ORG.name,
      executiveSummary: `During the reporting period, ${DEMO_ORG.name} processed approximately ${totalRequests.toLocaleString()} GenAI inference requests across ${breakdown.length} model configurations, consuming ${totalEnergy.toFixed(2)} kWh of energy and producing ${(totalCO2e / 1000).toFixed(2)} kg CO₂e emissions (location-based, Scope 2). The organization achieved an average EcoScore of ${ecoScore.grade} (${ecoScore.overall}/100), indicating ${ecoScore.overall >= 60 ? 'above-average' : 'below-average'} sustainability performance relative to industry benchmarks.`,
      totalFootprint: {
        energyKwhPer1kRequests: totalEnergy,
        co2eGramsPer1kRequests: totalCO2e,
        waterLitersPer1kRequests: totalWater,
        hardwareAmortizedGramsPer1kRequests: 0,
        totalEquivalentKmDriving: (totalCO2e / 1000) * 5.95,
        totalEquivalentSmartphoneCharges: totalEnergy * 86,
      },
      modelBreakdown: modelBreakdownItems,
      ecoScore,
      recommendations: [
        'Migrate latency-insensitive workloads to Oregon (us-west-2) for 77% lower grid carbon intensity vs. Frankfurt.',
        'Replace GPT-4 class models with Claude 3 Sonnet or Llama 70B for internal document processing — 85% lower emissions at 80-90% quality retention.',
        'Implement request batching for the Customer Service Bot project to improve GPU utilization from ~55% to >80%.',
        'Establish per-project carbon budgets aligned with SBTi interim targets.',
        'Integrate real-time power monitoring (NVIDIA DCGM + Kepler) to replace estimation with measured values.',
      ],
      methodology: [
        'Energy: Model-specific kWh/M tokens coefficient × PUE factor (1.2)',
        'CO₂e: Location-based Scope 2 using IEA/EEA 2023 grid emission factors',
        'Water: WUE × energy + server-level GPU cooling estimates (Ren 2023)',
        'Hardware: Amortized embodied carbon over expected GPU lifespan (Gupta 2022)',
        'EcoScore: Log-normalized weighted composite across 5 impact dimensions',
      ],
      limitations: [
        'All calculations use estimated energy coefficients, not measured power consumption.',
        'Token counts do not differentiate input/output (output tokens are ~2-3x more expensive).',
        'Market-based carbon accounting (RECs, PPAs) is not reflected — only location-based.',
        'Water usage estimates assume evaporative cooling; adiabatic/DLC systems may differ.',
        'Multi-tenancy efficiency gains in shared cloud infrastructure are not modeled.',
        'Network transfer, data storage, and edge inference are out of scope.',
      ],
      dataQuality: 'Medium — estimates based on published research and hardware specifications. Production use requires integration with real-time telemetry infrastructure.',
    };
  }, []);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 1500);
  }, []);

  const handleExport = useCallback(() => {
    const content = formatReportText(report);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESG_AI_Report_${report.reportingPeriod.end}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">ESG Reporting</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Structured sustainability summaries for internal ESG reviews
          </p>
        </div>
        <div className="flex-shrink-0">
          {!generated ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {generating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Generate Report
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 w-full sm:w-auto justify-center"
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>
          )}
        </div>
      </div>

      {!generated && !generating ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 sm:p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 text-[15px] font-medium text-slate-700">Ready to Generate</h3>
          <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
            Generate a structured ESG report covering your GenAI environmental footprint
            for the last 30 days. Includes methodology, limitations, and recommendations.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3 sm:gap-5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Audit-ready format
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              30-day period
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              GHG Protocol aligned
            </div>
          </div>
        </div>
      ) : generated ? (
        <div className="space-y-4">
          {/* Report Header */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ESG Sustainability Report</p>
                <h2 className="mt-0.5 text-base sm:text-lg font-semibold text-slate-900">GenAI Environmental Impact Assessment</h2>
                <p className="text-xs text-slate-500 mt-0.5">{report.orgName}</p>
              </div>
              <div className="text-[11px] text-slate-400 sm:text-right flex-shrink-0">
                <p>Period: {report.reportingPeriod.start} — {report.reportingPeriod.end}</p>
                <p>Generated: {new Date(report.generatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <ReportSection title="1. Executive Summary">
            <p className="text-xs text-slate-600 leading-relaxed">{report.executiveSummary}</p>
          </ReportSection>

          {/* Total Footprint */}
          <ReportSection title="2. Total Environmental Footprint">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ReportMetric label="Total Energy" value={`${report.totalFootprint.energyKwhPer1kRequests.toFixed(2)} kWh`} />
              <ReportMetric label="Total CO₂e" value={`${(report.totalFootprint.co2eGramsPer1kRequests / 1000).toFixed(2)} kg`} />
              <ReportMetric label="Total Water" value={`${report.totalFootprint.waterLitersPer1kRequests.toFixed(1)} L`} />
              <ReportMetric label="EcoScore" value={
                <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium', getGradeBgClass(report.ecoScore.grade))}>
                  {report.ecoScore.grade} ({report.ecoScore.overall})
                </span>
              } />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] text-slate-400">Equivalent to</p>
                <p className="text-base font-semibold text-slate-800 tabular-nums">{report.totalFootprint.totalEquivalentKmDriving.toFixed(1)} km</p>
                <p className="text-[10px] text-slate-400">passenger car driving</p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] text-slate-400">Equivalent to</p>
                <p className="text-base font-semibold text-slate-800 tabular-nums">{Math.round(report.totalFootprint.totalEquivalentSmartphoneCharges).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">smartphone charges</p>
              </div>
            </div>
          </ReportSection>

          {/* Model Breakdown */}
          <ReportSection title="3. Impact by Model">
            <div className="block sm:hidden space-y-2">
              {report.modelBreakdown.map((m) => (
                <div key={m.modelId} className="flex items-center gap-3 rounded-md bg-slate-50 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-700 truncate">{m.displayName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {m.footprint.energyKwhPer1kRequests.toFixed(3)} kWh · {m.footprint.co2eGramsPer1kRequests.toFixed(1)} g CO₂e
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-10 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600 rounded-full" style={{ width: `${m.percentage}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 w-8 text-right tabular-nums">{m.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 text-left text-[11px] font-medium text-slate-400">Model</th>
                    <th className="pb-2 text-right text-[11px] font-medium text-slate-400">% of Emissions</th>
                    <th className="pb-2 text-right text-[11px] font-medium text-slate-400">Energy (kWh)</th>
                    <th className="pb-2 text-right text-[11px] font-medium text-slate-400">CO₂e (g)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.modelBreakdown.map((m) => (
                    <tr key={m.modelId}>
                      <td className="py-2 text-slate-700">{m.displayName}</td>
                      <td className="py-2 text-right text-slate-500">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-600 rounded-full" style={{ width: `${m.percentage}%` }} />
                          </div>
                          <span className="tabular-nums">{m.percentage}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">{m.footprint.energyKwhPer1kRequests.toFixed(3)}</td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">{m.footprint.co2eGramsPer1kRequests.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          {/* EcoScore */}
          <ReportSection title="4. EcoScore™ Analysis">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(report.ecoScore.breakdown).map(([key, sub]) => (
                <div key={key} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-medium text-slate-400 uppercase">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-800 tabular-nums">{sub.score.toFixed(0)}</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{sub.explanation}</p>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Recommendations */}
          <ReportSection title="5. Recommendations">
            <div className="space-y-2">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-white flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Methodology */}
          <ReportSection title="6. Methodology">
            <ul className="space-y-1.5">
              {report.methodology.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </ReportSection>

          {/* Limitations */}
          <ReportSection title="7. Limitations & Data Quality">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 mb-3">
              <p className="text-[11px] font-medium text-amber-800">Data Quality: {report.dataQuality}</p>
            </div>
            <ul className="space-y-1.5">
              {report.limitations.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400 flex-shrink-0" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </ReportSection>

          {/* Audit Trail (USP #3) */}
          <ReportSection title="8. Audit Trail & Traceability">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-slate-500" />
                <p className="text-[11px] font-medium text-slate-700">Calculation Verification</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-[10px]">
                <div>
                  <p className="text-slate-400">Version</p>
                  <p className="font-medium text-slate-700">{CALCULATION_VERSION}</p>
                </div>
                <div>
                  <p className="text-slate-400">Input Hash</p>
                  <p className="font-medium text-slate-700 font-mono">{auditMetadata.inputHash}</p>
                </div>
                <div>
                  <p className="text-slate-400">Timestamp</p>
                  <p className="font-medium text-slate-700">{new Date(auditMetadata.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400">Data Quality</p>
                  <p className={cn(
                    'font-medium',
                    auditMetadata.dataQuality.overall === 'high' ? 'text-teal-700' :
                    auditMetadata.dataQuality.overall === 'medium' ? 'text-amber-700' : 'text-red-700'
                  )}>
                    {auditMetadata.dataQuality.overall.charAt(0).toUpperCase() + auditMetadata.dataQuality.overall.slice(1)}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAuditDetails(!showAuditDetails)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-3"
            >
              <Info className="h-3 w-3" />
              {showAuditDetails ? 'Hide' : 'Show'} detailed assumptions
            </button>

            {showAuditDetails && (
              <div className="space-y-3">
                {/* Assumptions */}
                <div>
                  <p className="text-[11px] font-medium text-slate-600 mb-2">Calculation Assumptions</p>
                  <div className="space-y-2">
                    {auditMetadata.assumptions.map((a, i) => (
                      <div key={i} className="rounded-md border border-slate-100 bg-white p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-slate-600">{a.assumption}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">Source: {a.source}</p>
                          </div>
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[9px] font-medium flex-shrink-0',
                            a.confidenceLevel === 'high' ? 'bg-teal-50 text-teal-700' :
                            a.confidenceLevel === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                          )}>
                            {a.confidenceLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Quality Factors */}
                <div>
                  <p className="text-[11px] font-medium text-slate-600 mb-2">Data Quality Assessment</p>
                  <div className="space-y-1.5">
                    {auditMetadata.dataQuality.factors.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 w-32 flex-shrink-0">{f.factor}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              f.score >= 70 ? 'bg-teal-500' : f.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            )}
                            style={{ width: `${f.score}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-600 w-8 text-right">{f.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ReportSection>

          {/* Regulatory Alignment (USP #3) */}
          <ReportSection title="9. Regulatory Framework Alignment">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-500">
                This report aligns with the following frameworks conceptually. Full regulatory compliance requires independent verification and company-specific adaptation.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {auditMetadata.regulatoryAlignment.map((r, i) => (
                <div key={i} className="rounded-md border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-medium text-slate-700">{r.framework}</p>
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[9px] font-medium',
                      r.alignmentLevel === 'full' ? 'bg-teal-50 text-teal-700' :
                      r.alignmentLevel === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                    )}>
                      {r.alignmentLevel}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">{r.description}</p>
                  <p className="text-[9px] text-slate-400 mt-1">{r.notes}</p>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>
      ) : null}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-[13px] font-medium text-slate-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <div className="mt-1 text-base font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function formatReportText(report: ESGReport): string {
  const lines: string[] = [];
  lines.push('='.repeat(70));
  lines.push('GREEN-AI FOOTPRINT TOOL — ESG SUSTAINABILITY REPORT');
  lines.push(`Organization: ${report.orgName}`);
  lines.push(`Period: ${report.reportingPeriod.start} to ${report.reportingPeriod.end}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('='.repeat(70));
  lines.push('');
  lines.push('1. EXECUTIVE SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(report.executiveSummary);
  lines.push('');
  lines.push('2. TOTAL FOOTPRINT');
  lines.push('-'.repeat(40));
  lines.push(`Energy: ${report.totalFootprint.energyKwhPer1kRequests.toFixed(2)} kWh`);
  lines.push(`CO2e: ${(report.totalFootprint.co2eGramsPer1kRequests / 1000).toFixed(2)} kg`);
  lines.push(`Water: ${report.totalFootprint.waterLitersPer1kRequests.toFixed(1)} L`);
  lines.push(`EcoScore: ${report.ecoScore.grade} (${report.ecoScore.overall}/100)`);
  lines.push('');
  lines.push('3. MODEL BREAKDOWN');
  lines.push('-'.repeat(40));
  report.modelBreakdown.forEach((m) => {
    lines.push(`  ${m.displayName}: ${m.percentage}% of emissions, ${m.footprint.co2eGramsPer1kRequests.toFixed(1)}g CO2e`);
  });
  lines.push('');
  lines.push('4. RECOMMENDATIONS');
  lines.push('-'.repeat(40));
  report.recommendations.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r}`);
  });
  lines.push('');
  lines.push('5. METHODOLOGY');
  lines.push('-'.repeat(40));
  report.methodology.forEach((m) => lines.push(`  • ${m}`));
  lines.push('');
  lines.push('6. LIMITATIONS');
  lines.push('-'.repeat(40));
  report.limitations.forEach((l) => lines.push(`  ⚠ ${l}`));
  lines.push('');
  lines.push(`Data Quality: ${report.dataQuality}`);
  lines.push('');
  lines.push('='.repeat(70));
  lines.push('Generated by Green-AI Footprint Tool PoC.');
  lines.push('Not for regulatory submission without production-grade data integration.');
  lines.push('='.repeat(70));
  return lines.join('\n');
}

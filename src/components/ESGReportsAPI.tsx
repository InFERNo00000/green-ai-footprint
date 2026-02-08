import { useEffect, useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { exportReportDocx, exportReportPdf, generateReport, getReport, getReports } from '@/services/apiClient';

export function ESGReportsAPI() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState<null | 'pdf' | 'docx'>(null);

  async function refresh() {
    const resp = await getReports();
    setReports(resp.reports ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await refresh();
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load reports');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedReportId) {
        setSelectedReport(null);
        return;
      }
      try {
        setLoadingReport(true);
        const detail = await getReport(selectedReportId);
        if (cancelled) return;
        setSelectedReport(detail);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load report');
        setSelectedReport(null);
      } finally {
        if (cancelled) return;
        setLoadingReport(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedReportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500">Loading reports...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">ESG Reporting</h1>
          <p className="mt-0.5 text-xs text-slate-500">Reports are generated and stored by the backend</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-8 sm:p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 text-[15px] font-medium text-slate-700">No reports yet</h3>
          <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
            This environment does not contain any ESG reports in the database.
          </p>
          <div className="mt-4 inline-flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span>Generate a report from existing calculation logs.</span>
          </div>

          <button
            onClick={async () => {
              try {
                setGenerating(true);
                setError(null);
                await generateReport({ days: 30 });
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to generate report');
              } finally {
                setGenerating(false);
              }
            }}
            disabled={generating}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-slate-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate report (last 30 days)'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">ESG Reporting</h1>
        <p className="mt-0.5 text-xs text-slate-500">Reports stored in MySQL</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[13px] font-medium text-slate-800">Reports</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {reports.map((r, idx) => (
            <button
              key={r.id ?? idx}
              onClick={() => setSelectedReportId(String(r.id))}
              className="w-full px-4 py-3 text-left text-[13px] text-slate-700 hover:bg-slate-50"
            >
              {r.name ?? 'Report'}
            </button>
          ))}
        </div>
      </div>

      {loadingReport && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500">
          Loading report…
        </div>
      )}

      {selectedReport && !loadingReport && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-medium text-slate-800">{selectedReport.name}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {String(selectedReport.period_start).slice(0, 10)} → {String(selectedReport.period_end).slice(0, 10)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    setExporting('pdf');
                    const { blob, filename } = await exportReportPdf(String(selectedReport.id));
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename || 'esg-report.pdf';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'PDF export failed');
                  } finally {
                    setExporting(null);
                  }
                }}
                disabled={exporting !== null}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
              </button>
              <button
                onClick={async () => {
                  try {
                    setExporting('docx');
                    const { blob, filename } = await exportReportDocx(String(selectedReport.id));
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename || 'esg-report.docx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Word export failed');
                  } finally {
                    setExporting(null);
                  }
                }}
                disabled={exporting !== null}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {exporting === 'docx' ? 'Exporting…' : 'Export Word'}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400 uppercase">Requests</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800 tabular-nums">{Number(selectedReport.total_requests ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400 uppercase">Energy</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800 tabular-nums">{Number(selectedReport.total_energy_kwh ?? 0).toFixed(2)} kWh</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400 uppercase">CO₂e</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800 tabular-nums">{Number(selectedReport.total_co2e_kg ?? 0).toFixed(2)} kg</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400 uppercase">Water</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800 tabular-nums">{Number(selectedReport.total_water_liters ?? 0).toFixed(2)} L</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] text-slate-400 uppercase">Avg EcoScore</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-800 tabular-nums">{selectedReport.avg_eco_score !== null && selectedReport.avg_eco_score !== undefined ? Number(selectedReport.avg_eco_score).toFixed(1) : '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

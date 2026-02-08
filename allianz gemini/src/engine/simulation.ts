// ============================================================
// SIMULATED DATA GENERATOR
// 
// In production, this would be replaced by PostgreSQL queries.
// This generates realistic usage patterns for dashboard demonstration.
// Clearly isolated as simulation — no pretense of real data.
// ============================================================

import type { TimeSeriesPoint, DashboardMetrics, Organization } from '@/types';
import type { CloudRegion } from '@/types';

export const DEMO_ORG: Organization = {
  id: 'org-disabled',
  name: 'Disabled',
  projects: [],
};

export function generateTimeSeriesData(
  _days: number = 90,
  _region: CloudRegion = 'eu-central-1'
): TimeSeriesPoint[] {
  return [];
}

export function generateDashboardMetrics(
  _timeSeries: TimeSeriesPoint[]
): DashboardMetrics {
  return {
    totalRequests: 0,
    totalEnergyKwh: 0,
    totalCO2eKg: 0,
    totalWaterLiters: 0,
    avgEcoScore: 0,
    trendDirection: 'stable',
    periodComparison: {
      energyChange: 0,
      co2eChange: 0,
      requestsChange: 0,
    },
  };
}

export function generateModelUsageBreakdown(region: CloudRegion = 'eu-central-1') {
  void region;
  return [];
}

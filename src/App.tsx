import { useState } from 'react';
import type { NavSection } from '@/types';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { FootprintCalculatorAPI } from '@/components/FootprintCalculatorAPI';
import { ModelComparison } from '@/components/ModelComparison';
import { ScenarioSimulatorAPI } from '@/components/ScenarioSimulatorAPI';
import { AnalyticsAPI } from '@/components/AnalyticsAPI';
import { ESGReportsAPI } from '@/components/ESGReportsAPI';
import { Settings } from '@/components/Settings';

export function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveSection} />;
      case 'calculator':
        return <FootprintCalculatorAPI />;
      case 'comparison':
        return <ModelComparison />;
      case 'scenarios':
        return <ScenarioSimulatorAPI onNavigate={setActiveSection} />;
      case 'analytics':
        return <AnalyticsAPI />;
      case 'reports':
        return <ESGReportsAPI />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setActiveSection} />;
    }
  };

  return (
    <Layout activeSection={activeSection} onNavigate={setActiveSection}>
      {renderSection()}
    </Layout>
  );
}

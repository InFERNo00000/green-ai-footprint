import { useState } from 'react';
import type { NavSection } from '@/types';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { FootprintCalculator } from '@/components/FootprintCalculator';
import { ModelComparison } from '@/components/ModelComparison';
import { ScenarioSimulator } from '@/components/ScenarioSimulator';
import { Analytics } from '@/components/Analytics';
import { ESGReports } from '@/components/ESGReports';
import { Settings } from '@/components/Settings';

export function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveSection} />;
      case 'calculator':
        return <FootprintCalculator />;
      case 'comparison':
        return <ModelComparison />;
      case 'scenarios':
        return <ScenarioSimulator />;
      case 'analytics':
        return <Analytics />;
      case 'reports':
        return <ESGReports />;
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

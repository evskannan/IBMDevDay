// SpecBridge — Main App component

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppHeader } from './components/AppHeader';
import { TabNav } from './components/TabNav';
import { InputsTab } from './tabs/InputsTab';
import { GenerationTab } from './tabs/GenerationTab';
import { ValidationTab } from './tabs/ValidationTab';
import { OutputTab } from './tabs/OutputTab';
import { SettingsTab } from './tabs/SettingsTab';
import './index.css';

function AppShell() {
  const { state } = useApp();

  const renderTab = () => {
    switch (state.activeTab) {
      case 'inputs':     return <InputsTab />;
      case 'generation': return <GenerationTab />;
      case 'validation': return <ValidationTab />;
      case 'output':     return <OutputTab />;
      case 'settings':   return <SettingsTab />;
      default:           return <InputsTab />;
    }
  };

  return (
    <div className="app">
      <AppHeader />
      <TabNav />
      <main className="app-main">
        {renderTab()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

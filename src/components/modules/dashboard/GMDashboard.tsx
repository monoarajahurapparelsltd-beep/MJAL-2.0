import React from 'react';
import { ExecutiveDashboardSuite } from './ExecutiveDashboardSuite';

export const GMDashboard: React.FC = () => {
  return (
    <ExecutiveDashboardSuite
      roleTitle="General Manager (GM) Operational View"
      roleBadgeColor="emerald"
      defaultTab="lines"
    />
  );
};

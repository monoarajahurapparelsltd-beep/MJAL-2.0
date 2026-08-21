import React from 'react';
import { ExecutiveDashboardSuite } from './ExecutiveDashboardSuite';

export const DirectorDashboard: React.FC = () => {
  return (
    <ExecutiveDashboardSuite
      roleTitle="Director Board Dashboard"
      roleBadgeColor="indigo"
      defaultTab="pipeline"
    />
  );
};

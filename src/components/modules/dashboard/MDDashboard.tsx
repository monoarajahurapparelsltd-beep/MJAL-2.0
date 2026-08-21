import React from 'react';
import { ExecutiveDashboardSuite } from './ExecutiveDashboardSuite';

export const MDDashboard: React.FC = () => {
  return (
    <ExecutiveDashboardSuite
      roleTitle="Managing Director (MD) Executive Board"
      roleBadgeColor="gold"
      defaultTab="financial"
    />
  );
};

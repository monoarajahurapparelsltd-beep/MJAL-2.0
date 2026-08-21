import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Department, Permission } from '../../types';

interface PermissionGuardProps {
  dept: Department;
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  dept,
  permission,
  fallback = null,
  children
}) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(dept, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

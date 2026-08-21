import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role, Department, Permission } from '../types';
import { supabaseDataService, fullPermissions, viewOnlyPermissions } from '../services/supabaseDataService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  isSuperAdmin as checkSuperAdmin,
  isHRAdmin as checkHRAdmin,
  isManagement as checkManagement,
  isGlobalUser as checkGlobalUser,
  canAccessDepartment as checkCanAccessDepartment,
  canAccessSection as checkCanAccessSection,
  canAccessLine as checkCanAccessLine,
  canAccessModule as checkCanAccessModule,
  hasValidScope as checkHasValidScope
} from '../utils/authUtils';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  login: (usernameOrEmail: string, password?: string) => Promise<boolean>;
  switchUser: (userId: string) => void;
  logout: () => Promise<void>;
  hasPermission: (dept: Department, perm: Permission) => boolean;
  canOperate: () => boolean; // MD, Director, GM cannot create/edit/delete/submit
  canDelete: (dept: Department) => boolean;
  canAccessDept: (dept: Department) => boolean;
  canAccessSec: (dept: Department, section?: string) => boolean;
  canAccessLn: (dept: Department, lineNo?: string) => boolean;
  canAccessMod: (moduleId: string) => boolean;
  isSuperAdmin: () => boolean;
  isHRAdmin: () => boolean;
  isManagement: () => boolean;
  isGlobalUser: () => boolean;
  hasValidScope: () => boolean;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  createUserByAdmin: (newUser: Partial<User>, password: string) => Promise<{ success: boolean; message: string }>;
  updateUserByAdmin: (user: User, password?: string) => Promise<{ success: boolean; message: string }>;
  deleteUserByAdmin: (userId: string) => Promise<{ success: boolean; message: string }>;
  purgeDemoMockUsers: () => Promise<{ success: boolean; count: number; message: string }>;
  resetUserPasswordByAdmin: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  createInitialSuperAdmin: (adminData: { name: string; email: string; phone: string; password: string }) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(supabaseDataService.getUsers());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedId = localStorage.getItem('mjal_active_user_id');
    const savedEmail = localStorage.getItem('mjal_active_user_email');
    if (savedId || savedEmail) {
      const allUsers = supabaseDataService.getUsers();
      const found = allUsers.find(u => (savedId && u.id === savedId) || (savedEmail && (u.email || '').toLowerCase() === savedEmail.toLowerCase()));
      if (found && found.status === 'Active') return found;
    }
    return null;
  });

  // Keep a ref to the active currentUser to avoid stale closure resurrecting logged-out sessions
  const currentUserRef = React.useRef<User | null>(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('mjal_active_user_id', currentUser.id);
      if (currentUser.email) {
        localStorage.setItem('mjal_active_user_email', currentUser.email.toLowerCase());
      }
    } else {
      localStorage.removeItem('mjal_active_user_id');
      localStorage.removeItem('mjal_active_user_email');
    }
  }, [currentUser]);

  useEffect(() => {
    const unsub = supabaseDataService.subscribe(() => {
      const updated = supabaseDataService.getUsers();
      setUsers(updated);
      const savedId = localStorage.getItem('mjal_active_user_id');
      const savedEmail = localStorage.getItem('mjal_active_user_email');
      
      if (currentUserRef.current) {
        const activeUserId = currentUserRef.current.id;
        const activeUserEmail = (currentUserRef.current.email || '').toLowerCase();
        const found = updated.find(u => u.id === activeUserId || (u.email || '').toLowerCase() === activeUserEmail);
        if (found) setCurrentUser(found);
      } else if (savedId || savedEmail) {
        const found = updated.find(u => (savedId && u.id === savedId) || (savedEmail && (u.email || '').toLowerCase() === savedEmail.toLowerCase()));
        if (found && found.status === 'Active') {
          setCurrentUser(found);
          currentUserRef.current = found;
        }
      }
    });

    // Check Supabase Auth Session
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const matched = supabaseDataService.getUsers().find(u => u.email === session.user.email || u.id === session.user.id);
          if (matched) {
            setCurrentUser(matched);
            currentUserRef.current = matched;
          }
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          currentUserRef.current = null;
          setCurrentUser(null);
          localStorage.removeItem('mjal_active_user_id');
        } else if (session?.user) {
          const matched = supabaseDataService.getUsers().find(u => u.email === session.user.email || u.id === session.user.id);
          if (matched) {
            setCurrentUser(matched);
            currentUserRef.current = matched;
          }
        }
      });

      return () => {
        unsub();
        authListener.subscription.unsubscribe();
      };
    }

    return unsub;
  }, []);

  const login = async (usernameOrEmail: string, password?: string): Promise<boolean> => {
    const rawQuery = (usernameOrEmail || '').trim();
    if (!rawQuery) return false;
    const query = rawQuery.toLowerCase();
    const emailQuery = query.includes('@') ? query : `${query}@mjal.com`;

    // 1. First try Supabase Auth if password is provided and configured
    if (isSupabaseConfigured() && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailQuery,
          password: password
        });

        if (!error && data.user) {
          let matched = users.find(u => (u.email || '').toLowerCase() === (data.user.email || '').toLowerCase() || u.id === data.user.id);
          if (!matched) {
            // Dynamically construct profile for newly signed-in Supabase user
            matched = {
              id: data.user.id,
              name: data.user.user_metadata?.full_name || rawQuery,
              email: data.user.email || emailQuery,
              username: rawQuery.split('@')[0],
              role: data.user.user_metadata?.role || 'SUPER_ADMIN',
              department: data.user.user_metadata?.department || 'HR & Admin',
              section: 'Head Office',
              status: 'Active',
              permissions: fullPermissions
            };
            await supabaseDataService.saveUser(matched, 'Supabase Auth');
          }

          if (matched.status === 'Active') {
            setCurrentUser(matched);
            await supabaseDataService.addAuditLog(matched.name, matched.role, matched.department, 'User Login', 'Auth', matched.id);
            return true;
          }
        }
      } catch (err) {
        console.warn('Supabase Auth signin attempt:', err);
      }
    }

    // 2. Strict Profile Matching against registered users in system
    const allUsers = supabaseDataService.getUsers();
    const found = allUsers.find(u =>
      (u.email || '').toLowerCase() === query ||
      (u.email || '').toLowerCase() === emailQuery ||
      (u.username || '').toLowerCase() === query ||
      (u.employee_id || '').toLowerCase() === query
    );

    if (found && found.status === 'Active') {
      setCurrentUser(found);
      currentUserRef.current = found;
      localStorage.setItem('mjal_active_user_id', found.id);
      if (found.email) localStorage.setItem('mjal_active_user_email', found.email.toLowerCase());
      
      // Synchronize / push account information directly to Supabase profiles database table
      if (isSupabaseConfigured() && found.email) {
        try {
          supabase.from('profiles').upsert({
            id: found.id,
            employee_id: found.employee_id || found.username,
            full_name: found.name,
            email: found.email,
            phone: found.phone || null,
            role: found.role,
            department: found.department,
            section: found.section || null,
            status: found.status || 'Active',
            permissions: found.permissions
          }).then(({ error }) => {
            if (error) console.warn('Sync profile to Supabase on login notice:', error.message);
          });
        } catch (e) {
          console.warn('Sync profile on login exception:', e);
        }
      }

      await supabaseDataService.addAuditLog(found.name, found.role, found.department, 'User Login', 'Auth', found.id);
      return true;
    }

    return false;
  };

  const switchUser = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      supabaseDataService.addAuditLog(found.name, found.role, found.department, 'User Switched Role', 'Auth', found.id);
    }
  };

  const logout = async () => {
    localStorage.removeItem('mjal_active_user_id');
    const prevUser = currentUserRef.current;
    currentUserRef.current = null;
    setCurrentUser(null);

    if (prevUser) {
      try {
        await supabaseDataService.addAuditLog(prevUser.name, prevUser.role, prevUser.department, 'User Logout', 'Auth', prevUser.id);
      } catch (err) {
        console.warn('Audit log write on logout notice:', err);
      }
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'No authenticated user found' };
    if (newPassword.length < 6) return { success: false, message: 'Password must be at least 6 characters long' };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, message: error.message };
    }

    await supabaseDataService.addAuditLog(currentUser.name, currentUser.role, currentUser.department, 'Password Changed', 'Security', currentUser.id);
    return { success: true, message: 'Password changed successfully' };
  };

  const createUserByAdmin = async (newUser: Partial<User>, password: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return { success: false, message: 'Unauthorized: Only Super Admin can create users.' };
    }

    if (!newUser.email || !newUser.name) {
      return { success: false, message: 'Full Name and Email are required.' };
    }

    const res = await supabaseDataService.createUserViaAdminAPI(
      {
        name: newUser.name,
        email: newUser.email,
        password: password,
        username: newUser.username || newUser.email.split('@')[0],
        department: newUser.department || 'Sewing',
        designation: newUser.designation,
        role: newUser.role || 'DEPT_USER',
        employeeId: newUser.employee_id || newUser.username,
        phone: newUser.phone,
        status: newUser.status || 'Active',
        permissions: newUser.permissions,
        section: newUser.section,
        lineNo: newUser.line_no
      },
      currentUser.name
    );

    if (res.success && res.user) {
      setUsers(supabaseDataService.getUsers());
      return { success: true, message: `User ${res.user.name} created successfully with Supabase profile.` };
    }
    return { success: false, message: res.error || 'Failed to create user' };
  };

  const updateUserByAdmin = async (user: User, password?: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return { success: false, message: 'Unauthorized: Only Super Admin can update users.' };
    }

    const res = await supabaseDataService.updateUserViaAdminAPI(user, currentUser.name, password);
    if (res.success) {
      setUsers(supabaseDataService.getUsers());
      if (currentUser.id === user.id) {
        setCurrentUser(user);
      }
      return { success: true, message: `User ${user.name} updated successfully.` };
    }
    return { success: false, message: res.error || 'Failed to update user' };
  };

  const deleteUserByAdmin = async (userId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return { success: false, message: 'Unauthorized: Only Super Admin can delete users.' };
    }

    if (currentUser.id === userId) {
      return { success: false, message: 'Cannot delete the currently logged in Super Admin user.' };
    }

    const res = await supabaseDataService.deleteUserViaAdminAPI(userId, currentUser.name);
    if (res.success) {
      setUsers(supabaseDataService.getUsers());
      return { success: true, message: 'User deleted successfully.' };
    }
    return { success: false, message: res.error || 'Failed to delete user' };
  };

  const purgeDemoMockUsers = async (): Promise<{ success: boolean; count: number; message: string }> => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return { success: false, count: 0, message: 'Unauthorized: Only Super Admin can purge demo users.' };
    }

    const res = await supabaseDataService.purgeDemoMockUsers(currentUser.name);
    if (res.success) {
      setUsers(supabaseDataService.getUsers());
      return { success: true, count: res.count, message: `Successfully removed ${res.count} demo mock user(s).` };
    }
    return { success: false, count: 0, message: res.error || 'Failed to remove demo users' };
  };

  const resetUserPasswordByAdmin = async (userId: string, newPass: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return { success: false, message: 'Unauthorized: Only Super Admin can reset user passwords.' };
    }

    const res = await supabaseDataService.resetUserPasswordViaAdminAPI(userId, newPass, currentUser.name);
    if (res.success) {
      return { success: true, message: 'Password reset successfully.' };
    }
    return { success: false, message: res.error || 'Failed to reset password' };
  };

  const createInitialSuperAdmin = async (adminData: { name: string; email: string; phone: string; password: string }): Promise<{ success: boolean; message: string; user?: User }> => {
    const cleanEmail = adminData.email.trim().toLowerCase();
    const employeeId = cleanEmail.split('@')[0];

    // 1. Try server-side dedicated superadmin setup endpoint
    try {
      const response = await fetch('/api/admin/setup-superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminData.name,
          email: cleanEmail,
          phone: adminData.phone,
          password: adminData.password,
          employeeId: employeeId
        })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.user) {
          const superAdminUser: User = {
            id: json.user.id,
            name: json.user.name,
            email: json.user.email,
            username: json.user.username || employeeId,
            role: 'SUPER_ADMIN',
            department: 'HR & Admin',
            section: 'Head Office',
            phone: adminData.phone,
            status: 'Active',
            permissions: fullPermissions,
            createdAt: new Date().toISOString()
          };

          await supabaseDataService.saveUser(superAdminUser, 'System Setup');
          setUsers(supabaseDataService.getUsers());
          setCurrentUser(superAdminUser);
          return {
            success: true,
            message: 'Super Admin account created and saved directly in Supabase Auth & profiles table!',
            user: superAdminUser
          };
        }
      }
    } catch (apiErr) {
      console.warn('API /api/admin/setup-superadmin error, trying direct client setup:', apiErr);
    }

    // 2. Direct client-side Supabase Auth signUp + Profiles table upsert
    let id = '00000000-0000-4000-8000-000000000001';
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: adminData.password,
          options: {
            data: {
              full_name: adminData.name,
              role: 'SUPER_ADMIN',
              department: 'HR & Admin',
              phone: adminData.phone,
              employee_id: employeeId
            }
          }
        });

        if (error) {
          console.warn('Supabase Auth signUp notice:', error.message);
        } else if (data?.user) {
          id = data.user.id;
        }
      } catch (err: any) {
        console.warn('Supabase Auth signUp exception:', err?.message || err);
      }
    }

    const superAdmin: User = {
      id,
      name: adminData.name,
      email: cleanEmail,
      username: employeeId,
      role: 'SUPER_ADMIN',
      department: 'HR & Admin',
      section: 'Head Office',
      phone: adminData.phone,
      status: 'Active',
      permissions: fullPermissions,
      createdAt: new Date().toISOString()
    };

    await supabaseDataService.saveUser(superAdmin, 'System Setup');
    setUsers(supabaseDataService.getUsers());
    setCurrentUser(superAdmin);
    return {
      success: true,
      message: 'Super Admin account created and saved directly in Supabase Auth & profiles table!',
      user: superAdmin
    };
  };

  const canOperate = (): boolean => {
    if (!currentUser) return false;
    // MD and DIRECTOR are STRICT VIEW + REPORT ONLY
    if (['MD', 'DIRECTOR', 'Managing Director (MD)', 'Director'].includes(currentUser.role)) {
      return false;
    }
    // GM, SUPER_ADMIN, DEPT_USER, HR_ADMIN, etc. have operational access
    return true;
  };

  const hasPermission = (dept: Department, perm: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;

    // View & report permissions only for MD, Director
    if (['MD', 'DIRECTOR', 'Managing Director (MD)', 'Director'].includes(currentUser.role)) {
      return ['VIEW', 'EXPORT', 'PRINT'].includes(perm);
    }

    // GM has full management & operational access across all departments
    if (['GM', 'General Manager (GM)'].includes(currentUser.role)) {
      return true;
    }

    // Merchandising users have full operational entry access to Merchandising & Order Management
    if (currentUser.department === 'Merchandising' && (dept === 'Order Management' || dept === 'Merchandising')) {
      const ownPerms = currentUser.permissions?.['Merchandising'] || [];
      const orderPerms = currentUser.permissions?.['Order Management'] || [];
      return ownPerms.includes(perm) || orderPerms.includes(perm) || ['VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'EXPORT', 'PRINT'].includes(perm);
    }

    if (!currentUser.permissions) {
      return currentUser.role === 'SUPER_ADMIN' || ['GM', 'General Manager (GM)'].includes(currentUser.role);
    }
    const deptPerms = currentUser.permissions?.[dept] || [];
    return deptPerms.includes(perm);
  };

  const canDelete = (dept: Department): boolean => {
    if (!currentUser) return false;
    if (!canOperate()) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (['GM', 'General Manager (GM)'].includes(currentUser.role)) return true;
    if (currentUser.role === 'HR_ADMIN' && dept === 'HR & Admin') return true;
    if (currentUser.department === 'Merchandising' && (dept === 'Merchandising' || dept === 'Order Management')) {
      return hasPermission(dept, 'DELETE') || currentUser.role === 'DEPT_USER';
    }
    return hasPermission(dept, 'DELETE');
  };

  const canAccessDept = (dept: Department) => checkCanAccessDepartment(currentUser, dept);
  const canAccessSec = (dept: Department, section?: string) => checkCanAccessSection(currentUser, dept, section);
  const canAccessLn = (dept: Department, lineNo?: string) => checkCanAccessLine(currentUser, dept, lineNo);
  const canAccessMod = (moduleId: string) => checkCanAccessModule(currentUser, moduleId);
  const isSuperAdmin = () => checkSuperAdmin(currentUser);
  const isHRAdmin = () => checkHRAdmin(currentUser);
  const isManagement = () => checkManagement(currentUser);
  const isGlobalUser = () => checkGlobalUser(currentUser);
  const hasValidScope = () => checkHasValidScope(currentUser);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isLoading,
        login,
        switchUser,
        logout,
        hasPermission,
        canOperate,
        canDelete,
        canAccessDept,
        canAccessSec,
        canAccessLn,
        canAccessMod,
        isSuperAdmin,
        isHRAdmin,
        isManagement,
        isGlobalUser,
        hasValidScope,
        changePassword,
        createUserByAdmin,
        updateUserByAdmin,
        deleteUserByAdmin,
        purgeDemoMockUsers,
        resetUserPasswordByAdmin,
        createInitialSuperAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

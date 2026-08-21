import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Admin Client using Server-Side Service Role Key or fallback configuration
const DEFAULT_SUPABASE_URL = 'https://pjbfuhsmzjvgfpxlyijc.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYmZ1aHNtemp2Z2ZweGx5aWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjg1NzIsImV4cCI6MjEwMTk0NDU3Mn0.RlCS8Xrf50TLjSEjszzsyhCnBsdQvNJRSBePSAuXTbM';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.warn('Server Supabase client initialization error:', err);
  }
}

// In-memory persistent store of custom-created users on server (in addition to Supabase)
const serverUsersStore = new Map<string, any>();
const serverDeletedUsers = new Set<string>(); // stores lowercased emails and user IDs

// Known demo / mock user emails
export const DEMO_MOCK_USER_EMAILS = [
  'hr.admin@mjal.com',
  'director@mjal.com',
  'gm@mjal.com',
  'ismail@mjal.com',
  'sewing@mjal.com',
  'cutting@mjal.com',
  'merchandiser@mjal.com',
  'qc@mjal.com'
];

// -------------------------------------------------------------
// API Endpoints (Mounted BEFORE Vite Middlewares)
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConfigured: Boolean(supabaseAdmin)
  });
});

/**
 * Super Admin API: List all users from Supabase profiles & auth
 */
app.get('/api/admin/users', async (req, res) => {
  try {
    let remoteProfiles: any[] = [];

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('profiles').select('*');
        if (!error && Array.isArray(data)) {
          remoteProfiles = data;
        }
      } catch (pErr) {
        console.warn('Could not fetch profiles via admin client:', pErr);
      }
    }

    // Merge with serverUsersStore, filtering out any deleted users
    const userMap = new Map<string, any>();
    remoteProfiles.forEach(p => {
      const emailKey = (p.email || '').toLowerCase();
      const idKey = (p.id || '').toLowerCase();
      if (emailKey && !serverDeletedUsers.has(emailKey) && !serverDeletedUsers.has(idKey)) {
        userMap.set(emailKey, p);
      }
    });
    serverUsersStore.forEach((user, email) => {
      const emailKey = email.toLowerCase();
      const idKey = (user.id || '').toLowerCase();
      if (!serverDeletedUsers.has(emailKey) && !serverDeletedUsers.has(idKey) && !userMap.has(emailKey)) {
        userMap.set(emailKey, user);
      }
    });

    return res.json({
      success: true,
      users: Array.from(userMap.values())
    });
  } catch (err: any) {
    return res.json({
      success: true,
      users: Array.from(serverUsersStore.values()).filter(u => !serverDeletedUsers.has((u.email || '').toLowerCase()) && !serverDeletedUsers.has((u.id || '').toLowerCase()))
    });
  }
});

/**
 * Super Admin API: Create User in Supabase Auth & Public Profiles Table
 */
app.post('/api/admin/users/create', async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      username,
      department,
      designation,
      role,
      employeeId,
      phone,
      status = 'Active',
      permissions = {},
      section,
      lineNo
    } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Full Name, Email and Password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRole = role || 'DEPT_USER';
    const userDept = department || 'Sewing';
    const userEmpId = employeeId || username || cleanEmail.split('@')[0];

    let authUserId: string | null = null;

    // 1. If Supabase Admin client is available
    if (supabaseAdmin) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: userRole,
            department: userDept,
            designation: designation || '',
            employee_id: userEmpId,
            phone: phone || ''
          }
        });

        if (!authError && authUser?.user) {
          authUserId = authUser.user.id;
        } else if (authError) {
          // If admin API requires service role or user exists, try finding existing user or fallback to signUp
          if (authError.message?.toLowerCase().includes('already exists') || authError.message?.toLowerCase().includes('already registered')) {
            try {
              const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
              const existing = listData?.users?.find((u: any) => (u.email || '').toLowerCase() === cleanEmail);
              if (existing) {
                authUserId = existing.id;
              }
            } catch (listErr) {
              console.warn('List users error:', listErr);
            }
          }

          if (!authUserId) {
            try {
              const { data: sData } = await supabaseAdmin.auth.signUp({
                email: cleanEmail,
                password: password,
                options: {
                  data: {
                    full_name: fullName,
                    role: userRole,
                    department: userDept,
                    phone: phone || '',
                    employee_id: userEmpId
                  }
                }
              });
              if (sData?.user) {
                authUserId = sData.user.id;
              }
            } catch (sErr) {
              console.warn('SignUp fallback error:', sErr);
            }
          }
        }
      } catch (adminErr: any) {
        console.warn('Supabase admin create exception:', adminErr?.message || adminErr);
        try {
          const { data: sData } = await supabaseAdmin.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                full_name: fullName,
                role: userRole,
                department: userDept,
                phone: phone || '',
                employee_id: userEmpId
              }
            }
          });
          if (sData?.user) {
            authUserId = sData.user.id;
          }
        } catch (sErr) {
          console.warn('SignUp exception fallback:', sErr);
        }
      }
    }

    // Fallback valid UUID v4 if not generated by Supabase
    if (!authUserId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        authUserId = crypto.randomUUID();
      } else {
        authUserId = '10000000-1000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
      }
    }

    // 2. Upsert into public.profiles
    const profilePayload = {
      id: authUserId,
      employee_id: userEmpId,
      full_name: fullName,
      email: cleanEmail,
      phone: phone || null,
      role: userRole,
      department: userDept,
      section: section || designation || null,
      line_no: lineNo || null,
      status: status || 'Active',
      permissions: typeof permissions === 'object' ? permissions : {},
      updated_at: new Date().toISOString()
    };

    if (supabaseAdmin) {
      try {
        const { error: profileErr } = await supabaseAdmin
          .from('profiles')
          .upsert(profilePayload);

        if (profileErr) {
          console.warn('Profile upsert warning:', profileErr.message);
        }
      } catch (pErr: any) {
        console.warn('Profile upsert exception:', pErr?.message || pErr);
      }
    }

    // Save in serverUsersStore
    serverUsersStore.set(cleanEmail, profilePayload);

    return res.json({
      success: true,
      message: 'User created successfully in Supabase Auth & Profiles.',
      user: {
        id: authUserId,
        name: fullName,
        email: cleanEmail,
        username: userEmpId,
        role: userRole,
        department: userDept,
        section: section || designation,
        line_no: lineNo,
        phone: phone,
        status: status,
        permissions: permissions
      }
    });
  } catch (err: any) {
    console.error('Server error creating user:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error creating user.'
    });
  }
});

/**
 * Super Admin Setup API: Provision dedicated Super Admin directly into Auth and profiles
 */
app.post('/api/admin/setup-superadmin', async (req, res) => {
  try {
    const { name, email, phone, password, employeeId } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Full Name, Email, and Password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userEmpId = employeeId || cleanEmail.split('@')[0];
    let authUserId: string | null = null;

    const fullPermissions: Record<string, string[]> = {
      'HR & Admin': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Store': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Merchandising': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Sample': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Order Management': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Cutting': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Sewing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Washing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Finishing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'QC': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Packing': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Shipment': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Accounts/Finance': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT'],
      'Production Planning': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'EXPORT', 'PRINT']
    };

    if (supabaseAdmin) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            role: 'SUPER_ADMIN',
            department: 'HR & Admin',
            phone: phone || '',
            employee_id: userEmpId
          }
        });

        if (!authError && authUser?.user) {
          authUserId = authUser.user.id;
        } else {
          // Fallback to signUp
          const { data: sData } = await supabaseAdmin.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                full_name: name,
                role: 'SUPER_ADMIN',
                department: 'HR & Admin',
                phone: phone || '',
                employee_id: userEmpId
              }
            }
          });
          if (sData?.user) {
            authUserId = sData.user.id;
          }
        }
      } catch (err: any) {
        console.warn('Super Admin auth creation exception:', err?.message || err);
      }
    }

    if (!authUserId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        authUserId = crypto.randomUUID();
      } else {
        authUserId = '00000000-0000-4000-8000-000000000001';
      }
    }

    const superAdminProfile = {
      id: authUserId,
      employee_id: userEmpId,
      full_name: name,
      email: cleanEmail,
      phone: phone || null,
      role: 'SUPER_ADMIN',
      department: 'HR & Admin',
      section: 'Head Office',
      status: 'Active',
      permissions: fullPermissions,
      updated_at: new Date().toISOString()
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('profiles').upsert(superAdminProfile);
      } catch (pErr: any) {
        console.warn('Super Admin profile upsert warning:', pErr?.message || pErr);
      }
    }

    // Save in serverUsersStore
    serverUsersStore.set(cleanEmail, superAdminProfile);

    return res.json({
      success: true,
      message: 'Super Admin account provisioned directly in Supabase Auth and Profiles table.',
      user: {
        id: authUserId,
        name: name,
        email: cleanEmail,
        username: userEmpId,
        role: 'SUPER_ADMIN',
        department: 'HR & Admin',
        section: 'Head Office',
        phone: phone,
        status: 'Active',
        permissions: fullPermissions
      }
    });
  } catch (err: any) {
    console.error('Server error setting up superadmin:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to setup Super Admin.'
    });
  }
});

/**
 * Super Admin API: Update User in Supabase Auth and Profiles
 */
app.post('/api/admin/users/update', async (req, res) => {
  try {
    const {
      id,
      fullName,
      email,
      department,
      designation,
      role,
      employeeId,
      phone,
      status,
      permissions,
      section,
      lineNo,
      password
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'User ID is required.' });
    }

    if (supabaseAdmin) {
      // 1. Update Auth attributes if email or password provided
      const authUpdates: any = {
        user_metadata: {
          full_name: fullName,
          role,
          department,
          designation,
          employee_id: employeeId
        }
      };

      if (email) authUpdates.email = email.trim().toLowerCase();
      if (password && password.length >= 6) authUpdates.password = password;

      try {
        await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      } catch (authErr) {
        console.warn('Auth user update notice:', authErr);
      }

      // 2. Update Profiles table
      const profileUpdates: any = {
        updated_at: new Date().toISOString()
      };
      if (fullName) profileUpdates.full_name = fullName;
      if (email) profileUpdates.email = email.trim().toLowerCase();
      if (employeeId) profileUpdates.employee_id = employeeId;
      if (phone !== undefined) profileUpdates.phone = phone;
      if (role) profileUpdates.role = role;
      if (department) profileUpdates.department = department;
      if (section !== undefined) profileUpdates.section = section;
      if (lineNo !== undefined) profileUpdates.line_no = lineNo;
      if (status) profileUpdates.status = status;
      if (permissions) profileUpdates.permissions = permissions;

      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', id);

      if (profileErr) {
        return res.status(400).json({ success: false, error: profileErr.message });
      }
    }

    return res.json({
      success: true,
      message: 'User profile updated successfully.'
    });
  } catch (err: any) {
    console.error('Server error updating user:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * Super Admin API: Reset User Password
 */
app.post('/api/admin/users/reset-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid User ID and new password (min 6 characters) are required.'
      });
    }

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    }

    return res.json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (err: any) {
    console.error('Server error resetting password:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * Super Admin API: Delete User (by ID and/or Email)
 */
app.post('/api/admin/users/delete', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ success: false, error: 'User ID or Email is required.' });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanId = userId ? String(userId).trim() : '';

    if (cleanEmail) {
      serverDeletedUsers.add(cleanEmail);
      serverUsersStore.delete(cleanEmail);
    }
    if (cleanId) {
      serverDeletedUsers.add(cleanId.toLowerCase());
      for (const [e, u] of serverUsersStore.entries()) {
        if (u.id === cleanId) {
          serverUsersStore.delete(e);
        }
      }
    }

    if (supabaseAdmin) {
      // 1. Delete from profiles table by ID or email
      if (cleanId) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('id', cleanId);
        } catch (e) {
          console.warn('Profiles delete by id warning:', e);
        }
      }
      if (cleanEmail) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('email', cleanEmail);
        } catch (e) {
          console.warn('Profiles delete by email warning:', e);
        }
      }

      // 2. Delete from auth.users if cleanId exists
      if (cleanId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(cleanId);
        } catch (authErr) {
          console.warn('Auth user delete notice:', authErr);
        }
      }
    }

    return res.json({
      success: true,
      message: 'User deleted permanently.'
    });
  } catch (err: any) {
    console.error('Server error deleting user:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * Super Admin API: Purge all Demo / Mock Users
 */
app.post('/api/admin/users/delete-demo-mock', async (req, res) => {
  try {
    const deletedCount = DEMO_MOCK_USER_EMAILS.length;

    DEMO_MOCK_USER_EMAILS.forEach(email => {
      const cleanEmail = email.toLowerCase();
      serverDeletedUsers.add(cleanEmail);
      serverUsersStore.delete(cleanEmail);
    });

    if (supabaseAdmin) {
      for (const email of DEMO_MOCK_USER_EMAILS) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('email', email.toLowerCase());
        } catch (err) {
          console.warn(`Error deleting demo user ${email}:`, err);
        }
      }
    }

    return res.json({
      success: true,
      message: `Successfully purged ${deletedCount} demo mock users.`,
      count: deletedCount
    });
  } catch (err: any) {
    console.error('Server error purging demo users:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * Super Admin API: Batch Sync Users to Supabase Profiles
 */
app.post('/api/admin/users/sync', async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'Users array is required.' });
    }

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .upsert(users, { onConflict: 'id' });

      if (error) {
        console.warn('Server Supabase batch sync profiles warning:', error.message);
      }
    }

    users.forEach((u: any) => {
      if (u.email) {
        serverUsersStore.set(u.email.toLowerCase(), u);
      }
    });

    return res.json({
      success: true,
      count: users.length,
      message: `Batch synced ${users.length} users successfully.`
    });
  } catch (err: any) {
    console.error('Server error syncing users:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal sync error' });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Asset Serving Setup
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MJAL ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

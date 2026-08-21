import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://pjbfuhsmzjvgfpxlyijc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYmZ1aHNtemp2Z2ZweGx5aWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjg1NzIsImV4cCI6MjEwMTk0NDU3Mn0.RlCS8Xrf50TLjSEjszzsyhCnBsdQvNJRSBePSAuXTbM';

// Get Supabase credentials from environment or localStorage configuration
const getSupabaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL;
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  // Fallback to locally configured Supabase settings if configured in UI
  const localUrl = localStorage.getItem('mjal_supabase_url');
  const localKey = localStorage.getItem('mjal_supabase_key');

  if (localUrl && localKey) {
    return { url: localUrl, key: localKey };
  }

  // Default production project connection
  return {
    url: DEFAULT_SUPABASE_URL,
    key: DEFAULT_SUPABASE_ANON_KEY
  };
};

const config = getSupabaseConfig();

export const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const isSupabaseConfigured = (): boolean => {
  return true; // Live connected instance active
};

export const saveSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('mjal_supabase_url', url.trim());
  localStorage.setItem('mjal_supabase_key', key.trim());
  window.location.reload();
};

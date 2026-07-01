import { createClient } from '@supabase/supabase-js';

export class MissingSupabaseEnvError extends Error {
  constructor(missingVariables) {
    super(`Missing required Supabase environment variables: ${missingVariables.join(', ')}`);
    this.name = 'MissingSupabaseEnvError';
    this.missingVariables = missingVariables;
  }
}

const requiredEnvVariables = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function getEnv(name) {
  return process.env[name] || import.meta.env?.[name] || null;
}

function getRequiredEnv(name) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getMissingSupabaseEnvVariables() {
  return requiredEnvVariables.filter((name) => !getEnv(name));
}

export function getSupabaseServerClient() {
  const missingVariables = getMissingSupabaseEnvVariables();

  if (missingVariables.length > 0) {
    throw new MissingSupabaseEnvError(missingVariables);
  }

  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

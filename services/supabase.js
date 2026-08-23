const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

if (!env.supabaseUrl) {
  throw new Error("SUPABASE_URL is not configured.");
}

if (!env.supabaseAnonKey) {
  throw new Error("SUPABASE_ANON_KEY is not configured.");
}

if (!env.supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
}

const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

function createUserClient(accessToken) {
  if (!accessToken) {
    throw new Error("Access token is required.");
  }

  return createClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

module.exports = {
  supabaseAdmin,
  createUserClient
};

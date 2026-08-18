const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

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

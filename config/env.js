require("dotenv").config();

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY"
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not configured.`);
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3000,

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",

  frontendUrl:
    process.env.FRONTEND_URL ||
    "https://salonepadi-ai-cloud.github.io"
};

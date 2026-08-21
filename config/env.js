require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3000,

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",

  frontendUrl:
    process.env.FRONTEND_URL ||
    "https://salonepadiai-cloud.github.io"
};

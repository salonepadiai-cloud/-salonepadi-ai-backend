require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3000,

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY,

  groqApiKey: process.env.GROQ_API_KEY,

  groqModel:
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-120b",

  frontendUrl:
    process.env.FRONTEND_URL ||
    "https://salonepadiai-cloud.github.io"
};

const OpenAI = require("openai");

const { supabaseAdmin } = require("./supabase");
const env = require("../config/env");

/*
|--------------------------------------------------------------------------
| Groq client
|--------------------------------------------------------------------------
|
| We use the same Groq/OpenAI-compatible API that SalonePadi AI already
| uses for normal responses.
|
*/

const client = env.groqApiKey
  ? new OpenAI({
      apiKey: env.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1"
    })
  : null;


/*
|--------------------------------------------------------------------------
| MEMORY LIMITS
|--------------------------------------------------------------------------
*/

const DEFAULT_MEMORY_LIMIT = 20;
const MAX_MEMORY_LIMIT = 100;
const MAX_MEMORY_LENGTH = 500;


/*
|--------------------------------------------------------------------------
| GET USER MEMORIES
|--------------------------------------------------------------------------
|
| Retrieves the most important/recent memories for the AI context.
|
*/

async function getUserMemories(
  userId,
  limit = DEFAULT_MEMORY_LIMIT
) {
  if (!userId) {
    return [];
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || DEFAULT_MEMORY_LIMIT, 1),
    MAX_MEMORY_LIMIT
  );

  const { data, error } = await supabaseAdmin
    .from("memories")
    .select(
      "id, memory, category, importance, created_at"
    )
    .eq("user_id", userId)
    .order("importance", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    })
    .limit(safeLimit);

  if (error) {
    console.error(
      "Memory retrieval error:",
      error
    );

    return [];
  }

  return data || [];
}


/*
|--------------------------------------------------------------------------
| NORMALIZE MEMORY
|--------------------------------------------------------------------------
|
| Cleans memory before saving it.
|
*/

function normalizeMemory(memory) {
  if (!memory) {
    return "";
  }

  return String(memory)
    .replace(/\u0000/g, "")
    .replace(
      /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    )
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MEMORY_LENGTH);
}


/*
|--------------------------------------------------------------------------
| SAVE MEMORY
|--------------------------------------------------------------------------
|
| Saves one memory for a user.
|
*/

async function saveMemory({
  userId,
  memory,
  category = "general",
  importance = 5
}) {
  if (!userId) {
    return null;
  }

  const cleanMemory =
    normalizeMemory(memory);

  if (!cleanMemory) {
    return null;
  }

  const safeCategory =
    normalizeMemory(category) ||
    "general";

  let safeImportance =
    Number(importance);

  if (!Number.isFinite(safeImportance)) {
    safeImportance = 5;
  }

  safeImportance = Math.min(
    Math.max(Math.round(safeImportance), 1),
    10
  );


  /*
   * Prevent obvious duplicate memories.
   */

  const { data: existing } =
    await supabaseAdmin
      .from("memories")
      .select(
        "id, memory, category, importance, created_at"
      )
      .eq("user_id", userId)
      .ilike("memory", cleanMemory)
      .limit(1);

  if (existing?.length) {
    return existing[0];
  }


  const { data, error } =
    await supabaseAdmin
      .from("memories")
      .insert({
        user_id: userId,
        memory: cleanMemory,
        category: safeCategory,
        importance: safeImportance
      })
      .select()
      .single();

  if (error) {
    console.error(
      "Memory save error:",
      error
    );

    return null;
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| DELETE MEMORY
|--------------------------------------------------------------------------
|
| Deletes only memories belonging to the authenticated user.
|
*/

async function deleteMemory(
  userId,
  memoryId
) {
  if (!userId || !memoryId) {
    return false;
  }

  const { error } =
    await supabaseAdmin
      .from("memories")
      .delete()
      .eq("id", memoryId)
      .eq("user_id", userId);

  if (error) {
    console.error(
      "Memory delete error:",
      error
    );

    return false;
  }

  return true;
}


/*
|--------------------------------------------------------------------------
| EXTRACT MEMORIES
|--------------------------------------------------------------------------
|
| Asks Groq to identify useful long-term information from the user's
| latest message.
|
| IMPORTANT:
| The AI should NOT remember everything.
|
| We only save information that could genuinely improve future
| conversations.
|
*/

async function extractMemories({
  userId,
  message,
  conversationHistory = []
}) {
  if (!client || !userId || !message) {
    return [];
  }

  const recentHistory =
    conversationHistory
      .slice(-10)
      .map((item) => ({
        role:
          item.role === "assistant"
            ? "assistant"
            : "user",
        content: String(
          item.content || ""
        ).slice(0, 2000)
      }));

  const extractionPrompt = `
You are the memory system for SalonePadi AI.

Your job is to identify ONLY useful long-term information about the user
that should be remembered for future conversations.

Do NOT save:
- Temporary questions.
- Normal greetings.
- Casual conversation.
- One-time requests.
- Facts about other people unless directly relevant to the user's ongoing work.
- Secrets.
- Passwords.
- API keys.
- Access tokens.
- Financial credentials.
- Highly sensitive personal information.
- Information that is unlikely to help future conversations.

GOOD memories include:
- User preferences.
- User's ongoing projects.
- User's preferred programming languages or tools.
- Long-term goals.
- Important recurring workflows.
- How the user prefers the AI to respond.
- Important project architecture decisions.
- Business/product information that the user is building.
- Stable information that will improve future assistance.

A memory should be written as a short factual statement.

Example:

User:
"I prefer JavaScript instead of TypeScript."

Memory:
"The user prefers JavaScript over TypeScript."

User:
"I'm building an AI assistant called SalonePadi AI."

Memory:
"The user is building an AI assistant called SalonePadi AI."

User:
"My backend uses Supabase and Groq."

Memory:
"The user's backend uses Supabase and Groq."

Return ONLY valid JSON.

Expected format:

{
  "memories": [
    {
      "memory": "Short factual memory",
      "category": "preference",
      "importance": 7
    }
  ]
}

Allowed categories:
- personal
- preference
- project
- work
- goal
- technical
- business
- general

Importance must be an integer from 1 to 10.

Use 8-10 for very important long-term information.
Use 5-7 for useful information.
Use 1-4 for minor information.

If there is nothing worth remembering, return:

{
  "memories": []
}

Latest user message:

${String(message).slice(0, 5000)}

Recent conversation context:

${JSON.stringify(recentHistory)}
`;


  try {
    const response =
      await client.chat.completions.create({
        model: env.groqModel,
        messages: [
          {
            role: "system",
            content: extractionPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      });

    const raw =
      response.choices?.[0]?.message?.content ||
      "";

    return parseMemoryResponse(raw);

  } catch (error) {
    console.error(
      "Memory extraction error:",
      error
    );

    return [];
  }
}


/*
|--------------------------------------------------------------------------
| PARSE MEMORY RESPONSE
|--------------------------------------------------------------------------
|
| Safely parses the JSON returned by the memory model.
|
*/

function parseMemoryResponse(raw) {
  if (!raw) {
    return [];
  }

  let text = String(raw)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed =
      JSON.parse(text);

    if (
      !parsed ||
      !Array.isArray(parsed.memories)
    ) {
      return [];
    }

    return parsed.memories
      .filter(
        (item) =>
          item &&
          typeof item.memory === "string" &&
          item.memory.trim()
      )
      .map((item) => ({
        memory: normalizeMemory(
          item.memory
        ),
        category:
          normalizeMemory(
            item.category
          ) || "general",
        importance:
          normalizeImportance(
            item.importance
          )
      }))
      .filter(
        (item) => item.memory
      );

  } catch (error) {
    console.warn(
      "Unable to parse memory extraction response."
    );

    return [];
  }
}


/*
|--------------------------------------------------------------------------
| NORMALIZE IMPORTANCE
|--------------------------------------------------------------------------
*/

function normalizeImportance(
  importance
) {
  let value =
    Number(importance);

  if (!Number.isFinite(value)) {
    value = 5;
  }

  return Math.min(
    Math.max(Math.round(value), 1),
    10
  );
}


/*
|--------------------------------------------------------------------------
| EXTRACT + SAVE MEMORIES
|--------------------------------------------------------------------------
|
| This is the function the chat/AI service will call after receiving
| a user message.
|
*/

async function rememberFromMessage({
  userId,
  message,
  conversationHistory = []
}) {
  if (!userId || !message) {
    return [];
  }

  const candidates =
    await extractMemories({
      userId,
      message,
      conversationHistory
    });

  if (!candidates.length) {
    return [];
  }

  const savedMemories = [];

  for (const candidate of candidates) {
    if (!candidate.memory) {
      continue;
    }

    const saved =
      await saveMemory({
        userId,
        memory: candidate.memory,
        category: candidate.category,
        importance: candidate.importance
      });

    if (saved) {
      savedMemories.push(saved);
    }
  }

  return savedMemories;
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  getUserMemories,
  saveMemory,
  deleteMemory,
  extractMemories,
  rememberFromMessage
};

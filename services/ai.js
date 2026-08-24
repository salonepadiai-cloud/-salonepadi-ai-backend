const OpenAI = require("openai");

const env = require("../config/env");
const { SYSTEM_PROMPT } = require("../utils/prompts");
const { getUserMemories } = require("./memory");

const client = env.groqApiKey
  ? new OpenAI({
      apiKey: env.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1"
    })
  : null;

/*
|--------------------------------------------------------------------------
| Clean AI response
|--------------------------------------------------------------------------
|
| Removes invisible/control characters and normalizes
| unusual Unicode characters while keeping normal
| punctuation, emojis, and line breaks.
|
*/

function cleanAIResponse(text) {
  if (!text) {
    return "";
  }

  return String(text)
    // Remove null bytes and invisible control characters
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")

    // Normalize different Unicode representations
    .normalize("NFC")

    // Normalize Windows/Mac line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    // Remove excessive blank lines
    .replace(/\n{4,}/g, "\n\n\n")

    // Remove excessive spaces
    .replace(/[ \t]{3,}/g, " ")

    .trim();
}

async function generateAIResponse({
  userId,
  message,
  conversationHistory = []
}) {
  if (!client) {
    throw new Error(
      "Groq AI service is not configured."
    );
  }

  const memories =
    await getUserMemories(userId);

  const memoryContext =
    memories.length > 0
      ? `
RELEVANT USER MEMORY:

${memories
  .map((item) => `- ${item.memory}`)
  .join("\n")}
`
      : `
No stored memories are currently available.
`;

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },

    {
      role: "system",
      content: memoryContext
    },

    ...conversationHistory
      .slice(-20)
      .map((item) => ({
        role:
          item.role === "assistant"
            ? "assistant"
            : "user",
        content: String(item.content || "")
      })),

    {
      role: "user",
      content: String(message || "")
    }
  ];

  const response =
    await client.chat.completions.create({
      model: env.groqModel,
      messages,
      temperature: 0.7
    });

  const rawResponse =
    response.choices?.[0]?.message?.content || "";

  return cleanAIResponse(rawResponse);
}

module.exports = {
  generateAIResponse
};

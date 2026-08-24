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
        content: item.content
      })),

    {
      role: "user",
      content: message
    }
  ];

  const response =
    await client.chat.completions.create({
      model: env.groqModel,
      messages,
      temperature: 0.7
    });

  return (
    response.choices?.[0]?.message?.content ||
    ""
  );
}

module.exports = {
  generateAIResponse
};

const OpenAI = require("openai");

const env = require("../config/env");
const { SYSTEM_PROMPT } = require("../utils/prompts");

const {
  getUserMemories,
  rememberFromMessage
} = require("./memory");


/*
|--------------------------------------------------------------------------
| GROQ CLIENT
|--------------------------------------------------------------------------
*/

const client = env.groqApiKey
  ? new OpenAI({
      apiKey: env.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1"
    })
  : null;


/*
|--------------------------------------------------------------------------
| CLEAN AI RESPONSE
|--------------------------------------------------------------------------
|
| Removes invisible/control characters and normalizes
| Unicode while keeping punctuation, emojis and line breaks.
|
*/

function cleanAIResponse(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(/\u0000/g, "")
    .replace(
      /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    )
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{3,}/g, " ")
    .trim();
}


/*
|--------------------------------------------------------------------------
| GENERATE AI RESPONSE
|--------------------------------------------------------------------------
|
| Main AI generation function.
|
| Flow:
|
| 1. Retrieve existing user memories.
| 2. Build the AI context.
| 3. Send conversation to Groq.
| 4. Clean the response.
| 5. Automatically look for new memories.
| 6. Save useful memories.
|
*/

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

  const cleanMessage =
    String(message || "").trim();

  if (!cleanMessage) {
    throw new Error(
      "Message is required."
    );
  }


  /*
  |--------------------------------------------------------------------------
  | LOAD EXISTING MEMORIES
  |--------------------------------------------------------------------------
  */

  const memories =
    await getUserMemories(
      userId,
      20
    );


  /*
  |--------------------------------------------------------------------------
  | BUILD MEMORY CONTEXT
  |--------------------------------------------------------------------------
  */

  const memoryContext =
    memories.length > 0
      ? `
RELEVANT USER MEMORY:

${memories
  .map(
    (item) =>
      `- ${String(item.memory || "").trim()}`
  )
  .filter(Boolean)
  .join("\n")}

Use these memories only when relevant.
Do not mention the internal memory system to the user.
Do not claim to remember information that is not present here.
`
      : `
No stored memories are currently available.
`;


  /*
  |--------------------------------------------------------------------------
  | BUILD CONVERSATION HISTORY
  |--------------------------------------------------------------------------
  */

  const history =
    conversationHistory
      .slice(-20)
      .map((item) => ({
        role:
          item.role === "assistant"
            ? "assistant"
            : "user",

        content:
          String(
            item.content || ""
          ).trim()
      }))
      .filter(
        (item) => item.content
      );


  /*
  |--------------------------------------------------------------------------
  | AI MESSAGES
  |--------------------------------------------------------------------------
  */

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },

    {
      role: "system",
      content: memoryContext
    },

    ...history,

    {
      role: "user",
      content: cleanMessage
    }
  ];


  /*
  |--------------------------------------------------------------------------
  | CALL GROQ
  |--------------------------------------------------------------------------
  */

  const response =
    await client.chat.completions.create({
      model: env.groqModel,
      messages,
      temperature: 0.7
    });


  /*
  |--------------------------------------------------------------------------
  | EXTRACT RESPONSE
  |--------------------------------------------------------------------------
  */

  const rawResponse =
    response.choices?.[0]?.message?.content ||
    "";


  const cleanedResponse =
    cleanAIResponse(
      rawResponse
    );


  /*
  |--------------------------------------------------------------------------
  | AUTOMATIC MEMORY
  |--------------------------------------------------------------------------
  |
  | Memory extraction happens AFTER the AI response.
  |
  | A memory failure must NEVER break the user's chat.
  |
  */

  if (userId) {
    try {
      await rememberFromMessage({
        userId,
        message: cleanMessage,
        conversationHistory: history
      });

    } catch (memoryError) {

      console.error(
        "Automatic memory error:",
        memoryError
      );

      /*
       * Do not throw here.
       *
       * The AI response has already been generated.
       * Memory is an additional feature and should not
       * prevent the user from receiving their response.
       */
    }
  }


  /*
  |--------------------------------------------------------------------------
  | RETURN RESPONSE
  |--------------------------------------------------------------------------
  */

  return cleanedResponse;
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  generateAIResponse,
  cleanAIResponse
};

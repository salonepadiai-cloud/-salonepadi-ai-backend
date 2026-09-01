const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const env = require("../config/env");
const { SYSTEM_PROMPT } = require("../utils/prompts");

const {
  getUserMemories,
  rememberFromMessage
} = require("./memory");


/*
|--------------------------------------------------------------------------
| AI CLIENTS
|--------------------------------------------------------------------------
|
| Both providers are optional. Whichever API key is present becomes
| available; the other is simply skipped. This lets Groq keep working
| exactly as before even if Gemini is never configured.
|
*/

const groqClient = env.groqApiKey
  ? new OpenAI({
      apiKey: env.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1"
    })
  : null;

const geminiClient = env.geminiApiKey
  ? new GoogleGenerativeAI(env.geminiApiKey)
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
| PROVIDER: GROQ
|--------------------------------------------------------------------------
|
| Unchanged from the original implementation — same client,
| same model source, same call shape.
|
*/

async function callGroq(messages) {
  if (!groqClient) {
    throw new Error(
      "Groq AI service is not configured."
    );
  }

  const response =
    await groqClient.chat.completions.create({
      model: env.groqModel,
      messages,
      temperature: 0.7
    });

  return (
    response.choices?.[0]?.message?.content ||
    ""
  );
}


/*
|--------------------------------------------------------------------------
| PROVIDER: GEMINI
|--------------------------------------------------------------------------
|
| Gemini's SDK uses a different message shape than OpenAI-style
| chat completions (roles are "user"/"model", not "user"/"assistant",
| and system prompts are passed separately as systemInstruction).
| This function converts our shared internal format into that shape.
|
*/

async function callGemini(messages) {
  if (!geminiClient) {
    throw new Error(
      "Gemini AI service is not configured."
    );
  }

  const systemText = messages
    .filter((item) => item.role === "system")
    .map((item) => item.content)
    .join("\n\n");

  const conversationMessages = messages.filter(
    (item) => item.role !== "system"
  );

  const lastMessage =
    conversationMessages.pop();

  const model = geminiClient.getGenerativeModel({
    model: env.geminiModel,
    systemInstruction: systemText || undefined
  });

  const chat = model.startChat({
    history: conversationMessages.map(
      (item) => ({
        role:
          item.role === "assistant"
            ? "model"
            : "user",
        parts: [{ text: item.content }]
      })
    )
  });

  const result = await chat.sendMessage(
    lastMessage.content
  );

  return result.response.text();
}


/*
|--------------------------------------------------------------------------
| PROVIDER REGISTRY
|--------------------------------------------------------------------------
*/

const PROVIDERS = {
  groq: callGroq,
  gemini: callGemini
};


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
| 3. Send conversation to the selected provider (Groq or Gemini).
| 4. Clean the response.
| 5. Automatically look for new memories.
| 6. Save useful memories.
|
| The `provider` param is optional. If omitted, or if it names a
| provider that isn't configured, the server's default (env.defaultAiProvider)
| is used instead — this is decided here, not silently in the route.
|
*/

async function generateAIResponse({
  userId,
  message,
  conversationHistory = [],
  provider
}) {
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
  | SELECT PROVIDER
  |--------------------------------------------------------------------------
  |
  | Falls back to the server default if no provider was requested,
  | or if the requested one isn't a provider we know about.
  |
  */

  const requestedProvider =
    PROVIDERS[provider]
      ? provider
      : env.defaultAiProvider;

  const callProvider =
    PROVIDERS[requestedProvider];

  if (!callProvider) {
    throw new Error(
      `Unknown AI provider: ${requestedProvider}`
    );
  }


  /*
  |--------------------------------------------------------------------------
  | CALL PROVIDER
  |--------------------------------------------------------------------------
  */

  const rawResponse =
    await callProvider(messages);


  /*
  |--------------------------------------------------------------------------
  | EXTRACT RESPONSE
  |--------------------------------------------------------------------------
  */

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

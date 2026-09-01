const express = require("express");

const authenticate = require("../middleware/auth");
const { supabaseAdmin } = require("../services/supabase");
const { generateAIResponse } = require("../services/ai");

const router = express.Router();

router.use(authenticate);


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const MAX_MESSAGE_LENGTH = 20000;
const MAX_HISTORY = 30;


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function cleanText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .replace(
      /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    )
    .normalize("NFC")
    .trim();
}


function isValidConversationId(id) {
  return (
    typeof id === "string" &&
    id.trim().length > 0
  );
}


/*
|--------------------------------------------------------------------------
| GET CONVERSATIONS
|--------------------------------------------------------------------------
|
| Returns only conversations belonging to the authenticated user.
|
*/

router.get(
  "/conversations",
  async (req, res) => {
    try {
      const { data, error } =
        await supabaseAdmin
          .from("conversations")
          .select(
            "id, title, created_at, updated_at"
          )
          .eq(
            "user_id",
            req.user.id
          )
          .order(
            "updated_at",
            {
              ascending: false
            }
          );

      if (error) {
        throw error;
      }

      return res.json({
        conversations: data || []
      });

    } catch (error) {

      console.error(
        "Load conversations error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to load conversations."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| CREATE CONVERSATION
|--------------------------------------------------------------------------
*/

router.post(
  "/conversations",
  async (req, res) => {
    try {

      const requestedTitle =
        cleanText(
          req.body?.title
        );

      const title =
        requestedTitle ||
        "New Chat";

      const { data, error } =
        await supabaseAdmin
          .from("conversations")
          .insert({
            user_id: req.user.id,
            title: title.slice(0, 120)
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        conversation: data
      });

    } catch (error) {

      console.error(
        "Create conversation error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to create conversation."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| RENAME CONVERSATION
|--------------------------------------------------------------------------
|
| Lets the user set their own title instead of living with
| whatever was auto-generated when the conversation was created.
|
*/

router.patch(
  "/conversations/:id",
  async (req, res) => {

    try {

      const conversationId =
        cleanText(
          req.params.id
        );

      const requestedTitle =
        cleanText(
          req.body?.title
        );

      if (
        !isValidConversationId(
          conversationId
        )
      ) {
        return res.status(400).json({
          error:
            "Conversation ID is required."
        });
      }

      if (!requestedTitle) {
        return res.status(400).json({
          error:
            "Title is required."
        });
      }


      /*
       * Verify ownership before updating anything.
       */

      const {
        data: conversation,
        error: conversationError
      } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .single();


      if (
        conversationError ||
        !conversation
      ) {
        return res.status(404).json({
          error:
            "Conversation not found."
        });
      }


      const {
        data: updatedConversation,
        error: updateError
      } = await supabaseAdmin
        .from("conversations")
        .update({
          title:
            requestedTitle.slice(0, 120)
        })
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .select()
        .single();


      if (updateError) {
        throw updateError;
      }


      return res.json({
        conversation: updatedConversation
      });

    } catch (error) {

      console.error(
        "Rename conversation error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to rename conversation."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| DELETE CONVERSATION
|--------------------------------------------------------------------------
|
| Deletes a conversation and all of its messages.
| Ownership is verified before anything is deleted.
|
*/

router.delete(
  "/conversations/:id",
  async (req, res) => {

    try {

      const conversationId =
        cleanText(
          req.params.id
        );

      if (
        !isValidConversationId(
          conversationId
        )
      ) {
        return res.status(400).json({
          error:
            "Conversation ID is required."
        });
      }


      /*
       * Verify ownership before deleting anything.
       */

      const {
        data: conversation,
        error: conversationError
      } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .single();


      if (
        conversationError ||
        !conversation
      ) {
        return res.status(404).json({
          error:
            "Conversation not found."
        });
      }


      /*
       * Delete messages first, then the conversation itself.
       * Done explicitly rather than relying on a DB cascade,
       * since we can't assume one is configured.
       */

      const {
        error: messagesDeleteError
      } = await supabaseAdmin
        .from("messages")
        .delete()
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        );

      if (messagesDeleteError) {
        throw messagesDeleteError;
      }

      const {
        error: conversationDeleteError
      } = await supabaseAdmin
        .from("conversations")
        .delete()
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        );

      if (conversationDeleteError) {
        throw conversationDeleteError;
      }


      return res.json({
        message:
          "Conversation deleted."
      });

    } catch (error) {

      console.error(
        "Delete conversation error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to delete conversation."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| GET CONVERSATION MESSAGES
|--------------------------------------------------------------------------
*/

router.get(
  "/conversations/:id/messages",
  async (req, res) => {

    try {

      const conversationId =
        cleanText(
          req.params.id
        );

      if (
        !isValidConversationId(
          conversationId
        )
      ) {
        return res.status(400).json({
          error:
            "Conversation ID is required."
        });
      }


      /*
       * Verify ownership.
       */

      const {
        data: conversation,
        error: conversationError
      } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .single();


      if (
        conversationError ||
        !conversation
      ) {
        return res.status(404).json({
          error:
            "Conversation not found."
        });
      }


      /*
       * Load messages.
       */

      const {
        data,
        error
      } = await supabaseAdmin
        .from("messages")
        .select(
          "id, role, content, created_at"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        );


      if (error) {
        throw error;
      }


      return res.json({
        messages: data || []
      });

    } catch (error) {

      console.error(
        "Load messages error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to load messages."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| SEND MESSAGE
|--------------------------------------------------------------------------
|
| Flow:
|
| User
|   ↓
| Verify conversation
|   ↓
| Load history
|   ↓
| Save user message
|   ↓
| Generate AI response
|   ↓
| Save AI response
|   ↓
| Update conversation
|   ↓
| Return AI response
|
*/

router.post(
  "/conversations/:id/messages",
  async (req, res) => {

    try {

      const conversationId =
        cleanText(
          req.params.id
        );

      const message =
        cleanText(
          req.body?.message
        );


      /*
       * Validate conversation ID.
       */

      if (
        !isValidConversationId(
          conversationId
        )
      ) {
        return res.status(400).json({
          error:
            "Conversation ID is required."
        });
      }


      /*
       * Validate message.
       */

      if (!message) {
        return res.status(400).json({
          error:
            "Message is required."
        });
      }


      if (
        message.length >
        MAX_MESSAGE_LENGTH
      ) {
        return res.status(400).json({
          error:
            `Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`
        });
      }


      /*
       * Verify conversation ownership.
       */

      const {
        data: conversation,
        error: conversationError
      } = await supabaseAdmin
        .from("conversations")
        .select(
          "id, title"
        )
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .single();


      if (
        conversationError ||
        !conversation
      ) {
        return res.status(404).json({
          error:
            "Conversation not found."
        });
      }


      /*
       * Load previous conversation history.
       */

      const {
        data: previousMessages,
        error: historyError
      } = await supabaseAdmin
        .from("messages")
        .select(
          "role, content"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        )
        .limit(
          MAX_HISTORY
        );


      if (historyError) {
        throw historyError;
      }


      /*
       * Save user message.
       */

      const {
        data: savedUserMessage,
        error: userMessageError
      } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id:
            conversationId,

          user_id:
            req.user.id,

          role:
            "user",

          content:
            message
        })
        .select()
        .single();


      if (userMessageError) {
        throw userMessageError;
      }


      /*
       * Generate AI response.
       *
       * The AI service also handles:
       *
       * - Existing memory
       * - Memory context
       * - Automatic memory extraction
       * - Provider selection (Groq or Gemini)
       */

      let aiResult;

      try {

        aiResult =
          await generateAIResponse({
            userId:
              req.user.id,

            message:
              message,

            conversationHistory:
              previousMessages || [],

            provider:
              req.body?.provider
          });

      } catch (aiError) {

        console.error(
          "AI generation error:",
          aiError
        );


        /*
         * The user's message has already been saved.
         *
         * We return an AI-specific error instead of pretending
         * that the message was never received.
         */

        return res.status(502).json({
          error:
            aiError.message ||
            "Unable to generate AI response."
        });
      }


      /*
       * Make sure the AI actually returned something.
       */

      const cleanAIResponse =
        cleanText(
          aiResult.text
        );

      const usedProvider =
        aiResult.provider;


      if (!cleanAIResponse) {

        console.error(
          "AI returned an empty response."
        );

        return res.status(502).json({
          error:
            "The AI returned an empty response."
        });
      }


      /*
       * Save assistant message.
       */

      const {
        data: savedAssistantMessage,
        error: assistantError
      } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id:
            conversationId,

          user_id:
            req.user.id,

          role:
            "assistant",

          content:
            cleanAIResponse
        })
        .select()
        .single();


      if (assistantError) {
        throw assistantError;
      }


      /*
       * Update conversation timestamp.
       */

      const {
        error: conversationUpdateError
      } = await supabaseAdmin
        .from("conversations")
        .update({
          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          req.user.id
        );


      if (
        conversationUpdateError
      ) {
        console.error(
          "Conversation update error:",
          conversationUpdateError
        );

        /*
         * Do not fail the entire chat because the timestamp
         * update failed after the AI response was already saved.
         */
      }


      /*
       * Return both messages.
       */

      return res.json({
        userMessage:
          savedUserMessage,

        message: {
          ...savedAssistantMessage,
          provider: usedProvider
        },

        conversation: {
          id:
            conversationId,

          title:
            conversation?.title ||
            "New Chat"
        }
      });

    } catch (error) {

      console.error(
        "Chat route error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to process your message."
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| EXPORT ROUTER
|--------------------------------------------------------------------------
*/

module.exports = router;

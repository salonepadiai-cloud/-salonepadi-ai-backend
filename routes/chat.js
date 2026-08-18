const express = require("express");
const authenticate = require("../middleware/auth");
const { supabaseAdmin } = require("../services/supabase");
const { generateAIResponse } = require("../services/ai");

const router = express.Router();

router.use(authenticate);

router.get("/conversations", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      conversations: data || []
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to load conversations."
    });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title = "New Chat" } = req.body;

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        user_id: req.user.id,
        title
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      conversation: data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to create conversation."
    });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = req.params.id;

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", req.user.id)
      .single();

    if (!conversation) {
      return res.status(404).json({
        error: "Conversation not found."
      });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      messages: data || []
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to load messages."
    });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", req.user.id)
      .single();

    if (!conversation) {
      return res.status(404).json({
        error: "Conversation not found."
      });
    }

    const { data: previousMessages, error: historyError } =
      await supabaseAdmin
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(30);

    if (historyError) {
      throw historyError;
    }

    await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: req.user.id,
        role: "user",
        content: message.trim()
      });

    const aiResponse = await generateAIResponse({
      userId: req.user.id,
      message: message.trim(),
      conversationHistory: previousMessages || []
    });

    const { data: savedAssistantMessage, error: assistantError } =
      await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: req.user.id,
          role: "assistant",
          content: aiResponse
        })
        .select()
        .single();

    if (assistantError) {
      throw assistantError;
    }

    await supabaseAdmin
      .from("conversations")
      .update({
        updated_at: new Date().toISOString()
      })
      .eq("id", conversationId)
      .eq("user_id", req.user.id);

    res.json({
      message: savedAssistantMessage
    });
  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      error: "Unable to generate AI response."
    });
  }
});

module.exports = router;

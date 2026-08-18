const express = require("express");
const authenticate = require("../middleware/auth");
const { supabaseAdmin } = require("../services/supabase");

const router = express.Router();

router.use(authenticate);

router.get("/profile", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      profile: data
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to load profile."
    });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const { name, avatar_url } = req.body;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        name,
        avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      profile: data
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to update profile."
    });
  }
});

module.exports = router;

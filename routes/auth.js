const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const { supabaseAdmin } = require("../services/supabase");

const router = express.Router();

function createAuthClient() {
  return createClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters."
      });
    }

    const supabase = createAuthClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || ""
        }
      }
    });

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(201).json({
      message: "Account created successfully.",
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to create account."
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    const supabase = createAuthClient();

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    res.json({
      message: "Login successful.",
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to login."
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.json({
        message: "Logged out."
      });
    }

    const token = authorization.replace("Bearer ", "").trim();

    const supabase = createAuthClient();

    await supabase.auth.admin.signOut?.();

    await supabaseAdmin.auth.getUser(token);

    res.json({
      message: "Logout successful."
    });
  } catch (error) {
    res.json({
      message: "Logout successful."
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        error: "Authentication required."
      });
    }

    const token = authorization.replace("Bearer ", "").trim();

    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid session."
      });
    }

    res.json({
      user
    });
  } catch (error) {
    res.status(401).json({
      error: "Invalid session."
    });
  }
});

module.exports = router;

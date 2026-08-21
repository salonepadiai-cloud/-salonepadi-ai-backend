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

/*
|--------------------------------------------------------------------------
| SIGN UP
|--------------------------------------------------------------------------
| Creates the account, confirms it, then signs the user in immediately.
|--------------------------------------------------------------------------
*/

router.post("/signup", async (req, res) => {
  try {
    const {
      email,
      password,
      name
    } = req.body;

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const cleanName =
      String(name || "").trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        error:
          "Email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters."
      });
    }

    /*
     * Create the user with the server-side
     * Supabase service-role client.
     *
     * email_confirm: true means the newly
     * created account is immediately confirmed.
     */
    const {
      data: created,
      error: createError
    } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: cleanName
      }
    });

    if (createError) {
      console.error(
        "Signup create user error:",
        createError
      );

      return res.status(400).json({
        error: createError.message
      });
    }

    if (!created?.user) {
      return res.status(500).json({
        error:
          "Account was created but user information was not returned."
      });
    }

    /*
     * Now sign the new user in so Supabase
     * gives us a real access token.
     */
    const supabase = createAuthClient();

    const {
      data: loginData,
      error: loginError
    } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

    if (loginError || !loginData?.session) {
      console.error(
        "Signup automatic login error:",
        loginError
      );

      return res.status(500).json({
        error:
          "Account created, but automatic login failed. Please log in."
      });
    }

    return res.status(201).json({
      message:
        "Account created successfully.",
      user: loginData.user,
      session: loginData.session
    });

  } catch (error) {
    console.error(
      "Signup error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to create account."
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        error:
          "Email and password are required."
      });
    }

    const supabase = createAuthClient();

    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

    if (error || !data?.session) {
      return res.status(401).json({
        error:
          "Invalid email or password."
      });
    }

    return res.json({
      message:
        "Login successful.",
      user: data.user,
      session: data.session
    });

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to login."
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

router.post("/logout", async (req, res) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.json({
        message:
          "Logged out."
      });
    }

    const token =
      authorization
        .replace(/^Bearer\s+/i, "")
        .trim();

    if (token) {
      await supabaseAdmin.auth.getUser(
        token
      );
    }

    return res.json({
      message:
        "Logout successful."
    });

  } catch (error) {
    console.error(
      "Logout error:",
      error
    );

    return res.json({
      message:
        "Logout successful."
    });
  }
});

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

router.get("/me", async (req, res) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        error:
          "Authentication required."
      });
    }

    const token =
      authorization
        .replace(/^Bearer\s+/i, "")
        .trim();

    if (!token) {
      return res.status(401).json({
        error:
          "Authentication required."
      });
    }

    const {
      data: { user },
      error
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (error || !user) {
      return res.status(401).json({
        error:
          "Invalid session."
      });
    }

    return res.json({
      user
    });

  } catch (error) {
    console.error(
      "Current user error:",
      error
    );

    return res.status(401).json({
      error:
        "Invalid session."
    });
  }
});

module.exports = router;

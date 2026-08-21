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
*/

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    const cleanName = String(name || "").trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters."
      });
    }

    /*
     * Check whether the account already exists.
     */
    const { data: existingUsers, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

    if (listError) {
      console.error("User lookup error:", listError);

      return res.status(500).json({
        error: "Unable to check account."
      });
    }

    const existingUser = existingUsers.users.find(
      (user) =>
        user.email?.toLowerCase() === cleanEmail
    );

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists. Please log in."
      });
    }

    /*
     * Create the user with email already confirmed.
     * This allows immediate login after registration.
     */
    const {
      data: createdUser,
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
      console.error("Signup error:", createError);

      return res.status(400).json({
        error: createError.message
      });
    }

    /*
     * Sign the new user in immediately.
     */
    const supabase = createAuthClient();

    const {
      data: loginData,
      error: loginError
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (loginError) {
      console.error(
        "Automatic login error:",
        loginError
      );

      return res.status(201).json({
        message:
          "Account created successfully. Please log in.",
        user: createdUser.user,
        session: null
      });
    }

    return res.status(201).json({
      message:
        "Account created and logged in successfully.",
      user: loginData.user,
      session: loginData.session
    });

  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      error: "Unable to create account."
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
    const { email, password } = req.body;

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    const supabase = createAuthClient();

    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    return res.json({
      message: "Login successful.",
      user: data.user,
      session: data.session
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Unable to login."
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
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.json({
        message: "Logged out."
      });
    }

    const token =
      authorization.replace("Bearer ", "").trim();

    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token);

    if (!error && user) {
      await supabaseAdmin.auth.admin.signOut(
        user.id,
        "global"
      );
    }

    return res.json({
      message: "Logout successful."
    });

  } catch (error) {
    console.error("Logout error:", error);

    return res.json({
      message: "Logout successful."
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
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required."
      });
    }

    const token =
      authorization.replace("Bearer ", "").trim();

    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid session."
      });
    }

    return res.json({
      user
    });

  } catch (error) {
    console.error("Auth check error:", error);

    return res.status(401).json({
      error: "Invalid session."
    });
  }
});

module.exports = router;

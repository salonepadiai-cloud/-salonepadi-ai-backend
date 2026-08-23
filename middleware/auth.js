const { supabaseAdmin } = require("../services/supabase");

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        error: "Authentication required."
      });
    }

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid authorization format."
      });
    }

    const token = authorization
      .slice(7)
      .trim();

    if (!token) {
      return res.status(401).json({
        error: "Access token is missing."
      });
    }

    const {
      data,
      error
    } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error(
        "Supabase token verification failed:",
        error.message
      );

      return res.status(401).json({
        error: "Invalid or expired session."
      });
    }

    if (!data?.user) {
      return res.status(401).json({
        error: "User session not found."
      });
    }

    req.user = data.user;
    req.accessToken = token;

    next();

  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error
    );

    return res.status(401).json({
      error: "Authentication failed."
    });
  }
}

module.exports = authenticate;

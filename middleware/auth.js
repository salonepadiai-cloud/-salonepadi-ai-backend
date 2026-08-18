const { supabaseAdmin } = require("../services/supabase");

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
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
        error: "Invalid or expired session."
      });
    }

    req.user = user;
    req.accessToken = token;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(401).json({
      error: "Authentication failed."
    });
  }
}

module.exports = authenticate;

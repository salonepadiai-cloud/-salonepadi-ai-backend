const express = require("express");
const cors = require("cors");
const env = require("./config/env");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const memoryRoutes = require("./routes/memory");
const userRoutes = require("./routes/user");

const app = express();

/*
 * CORS
 */
app.use(
  cors({
    origin:
      env.frontendUrl === "*"
        ? true
        : env.frontendUrl,
    credentials: true
  })
);

/*
 * JSON
 */
app.use(
  express.json({
    limit: "1mb"
  })
);

/*
 * Root health check
 */
app.get("/", (req, res) => {
  res.json({
    name: "SalonePadi AI",
    version: "1.0.0",
    message:
      "Kushe! SalonePadi AI backend is alive.",
    status: "online"
  });
});

/*
 * API health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SalonePadi AI"
  });
});

/*
 * API routes
 */
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/user", userRoutes);

/*
 * 404
 */
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

/*
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error(
    "Unhandled error:",
    err
  );

  res.status(500).json({
    error: "Internal server error."
  });
});

/*
 * Render PORT
 *
 * Render provides process.env.PORT.
 * Fall back to env.port for local development.
 */
const PORT =
  process.env.PORT ||
  env.port ||
  3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `SalonePadi AI backend running on port ${PORT}`
    );
  }
);

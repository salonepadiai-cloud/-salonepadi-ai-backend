const express = require("express");
const cors = require("cors");
const env = require("./config/env");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const memoryRoutes = require("./routes/memory");
const userRoutes = require("./routes/user");

const app = express();

app.use(
  cors({
    origin: env.frontendUrl === "*" ? true : env.frontendUrl,
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    name: "SalonePadi AI",
    version: "1.0.0",
    message: "Kushe! SalonePadi AI backend is alive.",
    status: "online"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SalonePadi AI"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/user", userRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "Internal server error."
  });
});

app.listen(env.port, () => {
  console.log(
    `SalonePadi AI backend running on port ${env.port}`
  );
});

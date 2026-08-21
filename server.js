const express = require("express");
const cors = require("cors");
const env = require("./config/env");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const memoryRoutes = require("./routes/memory");
const userRoutes = require("./routes/user");

const app = express();

const allowedOrigins = [
  "https://salonepadiai-cloud.github.io"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header
      // such as server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked CORS origin:", origin);

      return callback(
        new Error("Not allowed by CORS")
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
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

const PORT = process.env.PORT || env.port || 3000;

app.listen(PORT, () => {
  console.log(
    `SalonePadi AI backend running on port ${PORT}`
  );
});

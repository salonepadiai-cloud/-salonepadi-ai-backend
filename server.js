require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "SalonePadi AI",
    message: "Kushe! SalonePadi backend is running.",
    status: "online",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SalonePadi AI Backend",
  });
});

app.listen(PORT, () => {
  console.log(`SalonePadi AI backend running on port ${PORT}`);
});

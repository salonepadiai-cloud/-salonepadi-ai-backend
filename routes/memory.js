const express = require("express");
const authenticate = require("../middleware/auth");
const {
  getUserMemories,
  saveMemory,
  deleteMemory
} = require("../services/memory");

const router = express.Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  const memories = await getUserMemories(req.user.id, 100);

  res.json({
    memories
  });
});

router.post("/", async (req, res) => {
  try {
    const { memory, category, importance } = req.body;

    if (!memory) {
      return res.status(400).json({
        error: "Memory is required."
      });
    }

    const result = await saveMemory({
      userId: req.user.id,
      memory,
      category,
      importance
    });

    if (!result) {
      return res.status(500).json({
        error: "Unable to save memory."
      });
    }

    res.status(201).json({
      memory: result
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to save memory."
    });
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await deleteMemory(
    req.user.id,
    req.params.id
  );

  if (!deleted) {
    return res.status(500).json({
      error: "Unable to delete memory."
    });
  }

  res.json({
    message: "Memory deleted."
  });
});

module.exports = router;

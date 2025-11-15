import express from "express";
import { geminiService } from "../services/geminiService";
import { treeService } from "../services/treeService";

const router = express.Router();

router.post("/suggest-parent", async (req, res) => {
  const { topicName } = req.body;

  if (!topicName) {
    return res.status(400).json({ error: "topicName is required" });
  }

  try {
    const existingNodes = treeService.getTree().nodes;
    const suggestion = await geminiService.suggestParentAndCategory(
      topicName,
      existingNodes
    );

    res.json(suggestion);
  } catch (error) {
    console.error("AI suggestion error:", error);
    res.status(500).json({ 
      error: "Failed to get AI suggestion",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/suggest-chain", async (req, res) => {
  const { topicName } = req.body;

  if (!topicName) {
    return res.status(400).json({ error: "topicName is required" });
  }

  try {
    const existingNodes = treeService.getTree().nodes;
    const suggestion = await geminiService.suggestWithChain(
      topicName,
      existingNodes
    );

    res.json(suggestion);
  } catch (error) {
    console.error("AI chain suggestion error:", error);
    res.status(500).json({ 
      error: "Failed to get AI chain suggestion",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/find-related", async (req, res) => {  // 👈 Add this
  const { conceptName } = req.body;

  if (!conceptName) {
    return res.status(400).json({ error: "conceptName is required" });
  }

  try {
    const existingNodes = treeService.getTree().nodes;
    const relatedIds = await geminiService.findRelated(
      conceptName,
      existingNodes
    );

    res.json(relatedIds);
  } catch (error) {
    console.error("AI find related error:", error);
    res.json([]); // Return empty array on error
  }
});

export default router;

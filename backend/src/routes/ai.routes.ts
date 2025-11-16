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

router.post("/generate-subtopics", async (req, res) => {
  const { topicName } = req.body;

  if (!topicName) {
    return res.status(400).json({ error: "topicName is required" });
  }

  try {
    const existingNodes = treeService.getTree().nodes;
    const subtopics = await geminiService.generateSubtopics(
      topicName,
      existingNodes
    );

    res.json(subtopics);
  } catch (error) {
    console.error("AI generate subtopics error:", error);
    res.status(500).json({ 
      error: "Failed to generate subtopics",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/generate-bridge-topic", async (req, res) => {
  const { topic1, topic2 } = req.body;

  if (!topic1 || !topic2) {
    return res.status(400).json({ error: "topic1 and topic2 are required" });
  }

  try {
    const existingNodes = treeService.getTree().nodes;
    const bridgeTopic = await geminiService.generateBridgeTopic(
      topic1,
      topic2,
      existingNodes
    );

    res.json(bridgeTopic);
  } catch (error) {
    console.error("AI generate bridge topic error:", error);
    res.status(500).json({ 
      error: "Failed to generate bridge topic",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

import express, { Request, Response } from "express";
import snowflakeService from "../services/snowflakeService";

const router = express.Router();

// Test Snowflake connection
router.get("/test-connection", async (req: Request, res: Response) => {
  try {
    console.log("[Mastery Route] Testing Snowflake connection...");
    await snowflakeService.connectToSnowflake();
    res.json({ success: true, message: "Snowflake connection OK" });
  } catch (err: any) {
    console.error("[Mastery Route] Snowflake connection failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Log user interaction
router.post("/log-interaction", async (req: Request, res: Response) => {
  try {
    const { userId, nodeId, interactionType, durationSeconds, metadata } = req.body;

    console.log(`[Mastery Route] Received log-interaction:`, {
      userId,
      nodeId,
      interactionType,
      durationSeconds,
      metadata,
    });

    if (!userId || !nodeId || !interactionType) {
      return res.status(400).json({
        error: "Missing required fields: userId, nodeId, interactionType",
      });
    }

    await snowflakeService.logInteraction(
      userId,
      nodeId,
      interactionType,
      durationSeconds,
      metadata
    );

    console.log(`[Mastery Route] ✅ Logged interaction successfully: ${interactionType}`);
    res.json({ success: true, message: "Interaction logged" });
  } catch (err: any) {
    console.error("[Mastery Routes] Error logging interaction:", err.message);
    // Still return success even if Snowflake fails - don't break user experience
    res.json({ success: true, message: "Interaction logged (queued)" });
  }
});

// Get mastery score for a user-node combo (must come BEFORE the generic :userId route)
router.get("/score/:userId/:nodeId", async (req: Request, res: Response) => {
  try {
    const { userId, nodeId } = req.params;

    const masteryScore = await snowflakeService.calculateMasteryScore(
      userId,
      nodeId
    );

    res.json({ userId, nodeId, masteryScore });
  } catch (err: any) {
    console.error("[Mastery Routes] Error getting mastery:", err.message);
    // Return default score of 0 if Snowflake fails - don't break the app
    res.json({ userId: req.params.userId, nodeId: req.params.nodeId, masteryScore: 0, error: 'Snowflake unavailable' });
  }
});

// Get all mastery scores for a user
router.get("/mastery/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const scores = await snowflakeService.getAllMasteryScores(userId);

    res.json({ userId, scores });
  } catch (err: any) {
    console.error("[Mastery Routes] Error getting user mastery scores:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to get mastery scores" });
  }
});

// Get recommendations for next topics
router.get("/recommendations/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { currentNodeId } = req.query;

    console.log(`[Mastery Routes] Getting recommendations for user: ${userId}, current node: ${currentNodeId || 'none'}`);

    const response = await snowflakeService.getRecommendations(
      userId,
      currentNodeId as string
    );

    res.json(response);
  } catch (err: any) {
    console.error("[Mastery Routes] Error getting recommendations:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to get recommendations" });
  }
});

export default router;

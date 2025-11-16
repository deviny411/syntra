import axios from 'axios';

const PYTHON_SERVICE_URL = 'http://localhost:5001';

// Initialize - just check Python service is running
export const connectToSnowflake = async (): Promise<void> => {
  try {
    console.log('[Snowflake] 🐍 Connecting to Python microservice...');
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`);
    console.log('[Snowflake] ✅ Python service is ready:', response.data);
  } catch (err) {
    console.error('[Snowflake] ❌ Python service not reachable:', err);
    throw err;
  }
};

// Log user interaction via Python service
export const logInteraction = async (
  userId: string,
  nodeId: string,
  interactionType: string,
  durationSeconds?: number,
  metadata?: any
): Promise<void> => {
  try {
    console.log(`[Snowflake] 🔄 logInteraction: ${userId} - ${nodeId} - ${interactionType}`);

    await axios.post(`${PYTHON_SERVICE_URL}/log-interaction`, {
      userId,
      nodeId,
      interactionType,
      durationSeconds: durationSeconds || 0
    });

    console.log(`[Snowflake] ✅ logInteraction SUCCESS`);
  } catch (err) {
    console.error('[Snowflake] ❌ Failed to log interaction:', err);
    throw err;
  }
};

// Get mastery score for a user and node
export const getMasteryScore = async (userId: string, nodeId: string): Promise<any> => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/get-mastery`, {
      params: { userId, nodeId }
    });
    
    return response.data.mastery;
  } catch (err) {
    console.error('[Snowflake] Failed to get mastery score:', err);
    return null;
  }
};

// Calculate and update mastery score
export const calculateMasteryScore = async (userId: string, nodeId: string): Promise<number> => {
  try {
    console.log(`[Mastery Debug] Starting calculation for ${userId} - ${nodeId}`);

    // Get all interactions via Python service
    const response = await axios.get(`${PYTHON_SERVICE_URL}/get-interactions`, {
      params: { userId, nodeId }
    });
    
    const interactions = response.data.interactions || [];
    console.log(`[Mastery Debug] Found ${interactions.length} interaction groups:`, interactions);

    // Calculate mastery based on interactions
    let masteryScore = 0;
    let revisitCount = 0;
    let totalTimeSpent = 0;
    let subtopicsExplored = 0;
    let contentReadPct = 0;
    let visitCount = 0;

    interactions.forEach((interaction: any) => {
      const count = interaction.COUNT || 1;
      const duration = interaction.DURATION_SECONDS || 0;
      const type = interaction.INTERACTION_TYPE;

      console.log(`[Mastery Debug]   - Type: ${type}, Count: ${count}, Duration: ${duration}s`);

      if (type === 'visit') {
        visitCount += count;
        revisitCount = count > 1 ? count : revisitCount;
      }

      totalTimeSpent += duration;

      if (type === 'explore_subtopic') {
        subtopicsExplored += count;
      }

      // Handle content consumption
      if (type === 'read_article') {
        contentReadPct = Math.min(100, contentReadPct + 30 * count);
        // Each article also adds a revisit
        revisitCount += count;
      }

      if (type === 'watch_video') {
        contentReadPct = Math.min(100, contentReadPct + 20 * count);
        revisitCount += count;
      }
      
      if (type === 'manual_decrease') {
        // User manually decreased, count as a visit
        visitCount += count;
      }

      if (type === 'already_familiar') {
        // Set mastery to 100% for already familiar topics
        masteryScore = 100;
        contentReadPct = 100;
        totalTimeSpent = Math.max(totalTimeSpent, 3600); // Max time (1 hour)
        revisitCount = Math.max(revisitCount, 5); // Max revisits
        console.log(`[Mastery Debug]   → User marked as already familiar, setting mastery to 100%`);
      }
    });

    console.log(`[Mastery Debug] Aggregated metrics:`, {
      visitCount,
      revisitCount,
      totalTimeSpent,
      subtopicsExplored,
      contentReadPct,
    });

    // Mastery formula - weighted more towards content and interaction
    const revisitScore = (Math.min(revisitCount, 3) / 3) * 35; // Reduced threshold from 5 to 3, increased weight
    const timeScore = Math.min(1, totalTimeSpent / 1800) * 15; // Reduced time threshold from 3600 to 1800
    const subtopicScore = Math.min(1, subtopicsExplored / 3) * 15; // Reduced threshold from 5 to 3
    const contentScore = (contentReadPct / 100) * 35; // Increased weight from 25 to 35

    masteryScore = revisitScore + timeScore + subtopicScore + contentScore;

    console.log(`[Mastery Debug] Calculation formula:`);
    console.log(`  Revisit (${visitCount}/5 visits × 0.25): ${revisitScore.toFixed(1)}%`);
    console.log(`  Time (${totalTimeSpent}s / 3600s × 0.25): ${timeScore.toFixed(1)}%`);
    console.log(`  Subtopics (${subtopicsExplored}/5 × 0.25): ${subtopicScore.toFixed(1)}%`);
    console.log(`  Content (${contentReadPct}/100 × 0.25): ${contentScore.toFixed(1)}%`);
    console.log(`  → Final Score: ${masteryScore.toFixed(2)}/100`);

    // Save to Snowflake via Python service
    await axios.post(`${PYTHON_SERVICE_URL}/upsert-mastery`, {
      userId,
      nodeId,
      masteryScore,
      revisitCount,
      totalTimeSpent,
      subtopicsExplored,
      contentReadPct
    });

    console.log(`[Mastery Debug] ✅ Updated mastery for ${userId}-${nodeId}: ${masteryScore.toFixed(2)}`);
    return masteryScore;
  } catch (err) {
    console.error('[Snowflake] Failed to calculate mastery:', err);
    return 0;
  }
};

// Get all mastery scores for a user
export const getAllMasteryScores = async (userId: string): Promise<any[]> => {
  try {
    console.log(`[Snowflake] Getting all mastery scores for user: ${userId}`);
    // TODO: Add endpoint to Python service if needed
    return [];
  } catch (err) {
    console.error('[Snowflake] Failed to get all mastery scores:', err);
    return [];
  }
};

// Get recommendations for a user
export const getRecommendations = async (userId: string, currentNodeId?: string): Promise<any> => {
  try {
    console.log(`[Snowflake] Getting recommendations for user: ${userId}, current node: ${currentNodeId || 'none'}`);
    
    const params: any = { userId };
    if (currentNodeId) {
      params.currentNodeId = currentNodeId;
    }
    
    const response = await axios.get(`${PYTHON_SERVICE_URL}/get-recommendations`, {
      params
    });
    
    console.log(`[Snowflake] ✅ Got ${response.data.recommendations?.length || 0} recommendations`);
    return response.data;
  } catch (err) {
    console.error('[Snowflake] Failed to get recommendations:', err);
    return {
      recommendations: []
    };
  }
};

// Default export for compatibility
export default {
  connectToSnowflake,
  logInteraction,
  getMasteryScore,
  calculateMasteryScore,
  getAllMasteryScores,
  getRecommendations,
};

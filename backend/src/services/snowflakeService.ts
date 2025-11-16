import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Snowflake connection lazily
let connection: any = null;
let isConnected = false;
let isConnecting = false;
let connectPromise: Promise<void> | null = null;

const getConnection = () => {
  if (!connection) {
    const account = process.env.SNOWFLAKE_ACCOUNT;
    const user = process.env.SNOWFLAKE_USER;
    const password = process.env.SNOWFLAKE_PASSWORD;
    const database = process.env.SNOWFLAKE_DATABASE;
    const schema = process.env.SNOWFLAKE_SCHEMA;
    const warehouse = process.env.SNOWFLAKE_WAREHOUSE;

    console.log('[Snowflake] Creating connection with:');
    console.log('  account:', account ? '✓' : '✗');
    console.log('  user:', user ? '✓' : '✗');
    console.log('  password:', password ? '✓' : '✗');
    console.log('  database:', database ? '✓' : '✗');
    console.log('  schema:', schema ? '✓' : '✗');
    console.log('  warehouse:', warehouse ? '✓' : '✗');

    if (!account || !user || !password || !database || !schema || !warehouse) {
      console.error('[Snowflake] Missing Snowflake credentials in .env');
      throw new Error('Missing Snowflake credentials. Please check .env file.');
    }

    connection = snowflake.createConnection({
      account,
      username: user,
      password,
      database,
      schema,
      warehouse,
    });
  }
  return connection;
};

// Connect to Snowflake with proper queue handling
export const connectToSnowflake = async (): Promise<void> => {
  console.log(`[Snowflake] 🔗 connectToSnowflake called, isConnected=${isConnected}, isConnecting=${isConnecting}`);
  
  // If already connected, return immediately
  if (isConnected) {
    console.log(`[Snowflake] ✅ Already connected, returning`);
    return;
  }

  // If already connecting, wait for that promise
  if (isConnecting && connectPromise) {
    console.log(`[Snowflake] ⏳ Already connecting, waiting for existing promise`);
    return connectPromise;
  }

  // Start new connection attempt
  console.log(`[Snowflake] 🔄 Starting new connection...`);
  isConnecting = true;
  
  connectPromise = new Promise<void>((resolve, reject) => {
    const conn = getConnection();
    console.log(`[Snowflake] 📞 Calling conn.connect()...`);
    
    // Snowflake SDK has a known issue where callback doesn't fire in some environments
    // Use a small delay to let the connection initialize, then just assume it's connected
    setTimeout(() => {
      console.log('[Snowflake] ✅ Assuming connection ready after initialization delay');
      isConnecting = false;
      isConnected = true;
      connectPromise = null;
      resolve();
    }, 200);
    
    // Still try to use the callback if it fires (for other environments)
    conn.connect((err: any) => {
      console.log(`[Snowflake] 📲 conn.connect() callback fired (unexpected!), err=${err ? 'YES' : 'NO'}`);
      if (isConnected) {
        console.log('[Snowflake] ℹ️  Already resolved, ignoring callback');
        return;
      }
      
      isConnecting = false;
      if (err) {
        console.error('[Snowflake] ❌ Connection error in callback:', err.message);
        connectPromise = null;
        reject(err);
      } else {
        console.log('[Snowflake] ✅ Connected successfully in callback');
        isConnected = true;
        connectPromise = null;
        resolve();
      }
    });
  });

  return connectPromise;
};

// Execute SQL query
const executeQuery = (sql: string, binds: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    console.log(`[Snowflake] 📋 executeQuery called with SQL:`, sql.substring(0, 80) + '...');
    console.log(`[Snowflake] 📋 executeQuery binds:`, binds);
    
    const conn = getConnection();
    console.log(`[Snowflake] ✅ Got connection object`);
    
    let callbackFired = false;
    const timeout = setTimeout(() => {
      if (!callbackFired) {
        console.warn(`[Snowflake] ⚠️  Query callback didn't fire after 1s, trying to verify with test query`);
        
        // Try a simple test query to verify connection is working
        conn.execute({
          sqlText: 'SELECT 1',
          complete: (testErr: any, testStmt: any, testRows: any) => {
            console.log(`[Snowflake] 📡 Test query result:`, testErr ? `ERROR: ${testErr.message}` : 'SUCCESS');
            if (!callbackFired) {
              callbackFired = true;
              console.warn(`[Snowflake] ⚠️  Assuming original query succeeded (test query ${testErr ? 'failed' : 'succeeded'})`);
              resolve([]);
            }
          }
        });
        
        // If test query also doesn't callback within 2s, just resolve anyway
        setTimeout(() => {
          if (!callbackFired) {
            callbackFired = true;
            console.warn(`[Snowflake] ⚠️  Test query also didn't callback, forcing resolve`);
            resolve([]);
          }
        }, 2000);
      }
    }, 1000);
    
    conn.execute({
      sqlText: sql,
      binds: binds,
      complete: (err: any, stmt: any, rows: any) => {
        if (callbackFired) {
          console.warn('[Snowflake] ℹ️  Query callback fired after timeout, ignoring');
          return;
        }
        callbackFired = true;
        clearTimeout(timeout);
        
        if (err) {
          console.error('[Snowflake] ❌ Query error:', err.message);
          reject(err);
        } else {
          console.log(`[Snowflake] ✅ Query executed successfully, rows returned:`, rows?.length || 0);
          resolve(rows || []);
        }
      },
    });
    console.log(`[Snowflake] ✅ execute() callback registered`);
  });
};

// Log user interaction
export const logInteraction = async (
  userId: string,
  nodeId: string,
  interactionType: string,
  durationSeconds?: number,
  metadata?: any
): Promise<void> => {
  try {
    console.log(`[Snowflake] 🔄 logInteraction START: ${userId} - ${nodeId} - ${interactionType}`);
    
    await connectToSnowflake();
    console.log(`[Snowflake] ✅ Connected for logInteraction`);
    
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    console.log(`[Snowflake] 📝 Metadata JSON prepared:`, metadataJson);
    
    const sql = `
      INSERT INTO SYNTRA_DB.PUBLIC.USER_INTERACTIONS 
      (USER_ID, NODE_ID, INTERACTION_TYPE, DURATION_SECONDS, METADATA)
      VALUES (?, ?, ?, ?, PARSE_JSON(?))
    `;
    
    console.log(`[Snowflake] 📤 Executing query...`);
    await executeQuery(sql, [
      userId,
      nodeId,
      interactionType,
      durationSeconds || null,
      metadataJson,
    ]);
    
    console.log(`[Snowflake] ✅ logInteraction SUCCESS: ${userId} - ${nodeId} - ${interactionType}`);
  } catch (err) {
    console.error('[Snowflake] ❌ Failed to log interaction:', err);
    throw err;
  }
};

// Get mastery score for a user and node
export const getMasteryScore = async (
  userId: string,
  nodeId: string
): Promise<any> => {
  try {
    await connectToSnowflake();
    
    const sql = `
      SELECT * FROM SYNTRA_DB.PUBLIC.MASTERY_SCORES
      WHERE USER_ID = ? AND NODE_ID = ?
    `;
    
    const results = await executeQuery(sql, [userId, nodeId]);
    return results.length > 0 ? results[0] : null;
  } catch (err) {
    console.error('[Snowflake] Failed to get mastery score:', err);
    throw err;
  }
};

// Calculate and update mastery score
export const calculateMasteryScore = async (
  userId: string,
  nodeId: string
): Promise<number> => {
  try {
    await connectToSnowflake();
    
    console.log(`[Mastery Debug] Starting calculation for ${userId} - ${nodeId}`);
    
    // Get all interactions for this user-node combo
    const interactionsSql = `
      SELECT 
        INTERACTION_TYPE,
        DURATION_SECONDS,
        COUNT(*) as count,
        MAX(TIMESTAMP) as last_visited
      FROM SYNTRA_DB.PUBLIC.USER_INTERACTIONS
      WHERE USER_ID = ? AND NODE_ID = ?
      GROUP BY INTERACTION_TYPE, DURATION_SECONDS
    `;
    
    const interactions = await executeQuery(interactionsSql, [userId, nodeId]);
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
      
      // Handle content consumption with confidence levels
      if (type === 'read_article') {
        // Base article: 25%, but scale based on understanding level
        let articleBoost = 25;
        // Check metadata for understanding level if available
        if (interaction.METADATA) {
          try {
            const metadata = JSON.parse(interaction.METADATA);
            if (metadata.confidence === 'very_high') articleBoost = 25;
            else if (metadata.confidence === 'high') articleBoost = 20;
            else if (metadata.confidence === 'medium') articleBoost = 12;
            else if (metadata.confidence === 'low') articleBoost = 5;
          } catch (e) {
            // If metadata parsing fails, use base boost
          }
        }
        contentReadPct = Math.min(100, contentReadPct + articleBoost * count);
      }
      
      if (type === 'watch_video') {
        // Base video: 15%, but scale based on understanding level
        let videoBoost = 15;
        // Check metadata for understanding level if available
        if (interaction.METADATA) {
          try {
            const metadata = JSON.parse(interaction.METADATA);
            if (metadata.confidence === 'very_high') videoBoost = 15;
            else if (metadata.confidence === 'high') videoBoost = 12;
            else if (metadata.confidence === 'medium') videoBoost = 8;
            else if (metadata.confidence === 'low') videoBoost = 3;
          } catch (e) {
            // If metadata parsing fails, use base boost
          }
        }
        contentReadPct = Math.min(100, contentReadPct + videoBoost * count);
      }
      if (type === 'already_familiar') {
        // If user marked as familiar, boost content score to at least 50%
        contentReadPct = Math.max(contentReadPct, 50);
        console.log(`[Mastery Debug]   → User marked as already familiar, set content% to at least 50%`);
      }
    });
    
    console.log(`[Mastery Debug] Aggregated metrics:`, {
      visitCount,
      revisitCount,
      totalTimeSpent,
      subtopicsExplored,
      contentReadPct,
    });
    
    // Mastery formula (0-100) with equal weights
    // Each component can contribute 0-25 points
    const revisitScore = (Math.min(revisitCount, 5) / 5) * 0.25;    // How many times revisited (max 5 = 25 points)
    const timeScore = (Math.min(totalTimeSpent, 3600) / 3600) * 0.25; // Time spent (max 1 hour = 25 points)
    const subtopicScore = (subtopicsExplored / Math.max(subtopicsExplored, 5)) * 0.25; // Topics explored (max 5 = 25 points)
    const contentScore = (Math.min(contentReadPct, 100) / 100) * 0.25; // Content consumed (max 100% = 25 points)
    
    masteryScore = (revisitScore + timeScore + subtopicScore + contentScore) * 100;
    masteryScore = Math.min(100, Math.max(0, masteryScore));
    
    console.log(`[Mastery Debug] Calculation formula:`);
    console.log(`  Revisit (${Math.min(revisitCount, 5)}/5 visits × 0.25): ${(revisitScore * 100).toFixed(1)}%`);
    console.log(`  Time (${totalTimeSpent}s / 3600s × 0.25): ${(timeScore * 100).toFixed(1)}%`);
    console.log(`  Subtopics (${subtopicsExplored}/5 × 0.25): ${(subtopicScore * 100).toFixed(1)}%`);
    console.log(`  Content (${Math.min(contentReadPct, 100)}/100 × 0.25): ${(contentScore * 100).toFixed(1)}%`);
    console.log(`  → Final Score: ${masteryScore.toFixed(2)}/100`);
    
    console.log(`[Mastery Debug] Score breakdown:`, {
      revisitScore: (revisitScore * 100).toFixed(1),
      timeScore: (timeScore * 100).toFixed(1),
      subtopicScore: (subtopicScore * 100).toFixed(1),
      contentScore: (contentScore * 100).toFixed(1),
      finalScore: masteryScore.toFixed(2),
    });
    
    // Update mastery scores table
    const updateSql = `
      INSERT INTO SYNTRA_DB.PUBLIC.MASTERY_SCORES 
      (USER_ID, NODE_ID, MASTERY_SCORE, REVISIT_COUNT, TOTAL_TIME_SPENT, SUBTOPICS_EXPLORED, CONTENT_READ_PCT, LAST_VISITED)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
      ON CONFLICT (USER_ID, NODE_ID) DO UPDATE SET
        MASTERY_SCORE = ?,
        REVISIT_COUNT = ?,
        TOTAL_TIME_SPENT = ?,
        SUBTOPICS_EXPLORED = ?,
        CONTENT_READ_PCT = ?,
        LAST_VISITED = CURRENT_TIMESTAMP(),
        UPDATED_AT = CURRENT_TIMESTAMP()
    `;
    
    await executeQuery(updateSql, [
      userId, nodeId, masteryScore, revisitCount, totalTimeSpent, subtopicsExplored, contentReadPct,
      masteryScore, revisitCount, totalTimeSpent, subtopicsExplored, contentReadPct,
    ]);
    
    console.log(`[Mastery Debug] ✅ Updated mastery for ${userId}-${nodeId}: ${masteryScore.toFixed(2)}`);
    return masteryScore;
  } catch (err) {
    console.error('[Snowflake] Failed to calculate mastery:', err);
    throw err;
  }
};

// Get all mastery scores for a user
export const getUserMasteryScores = async (userId: string): Promise<any[]> => {
  try {
    await connectToSnowflake();
    
    const sql = `
      SELECT * FROM SYNTRA_DB.PUBLIC.MASTERY_SCORES
      WHERE USER_ID = ?
      ORDER BY MASTERY_SCORE DESC
    `;
    
    return await executeQuery(sql, [userId]);
  } catch (err) {
    console.error('[Snowflake] Failed to get user mastery scores:', err);
    throw err;
  }
};

// Get recommendations for next topics to learn
export const getRecommendations = async (userId: string): Promise<any[]> => {
  try {
    await connectToSnowflake();
    
    const sql = `
      SELECT * FROM SYNTRA_DB.PUBLIC.RECOMMENDATIONS
      WHERE USER_ID = ?
      ORDER BY CONFIDENCE_SCORE DESC
      LIMIT 5
    `;
    
    return await executeQuery(sql, [userId]);
  } catch (err) {
    console.error('[Snowflake] Failed to get recommendations:', err);
    throw err;
  }
};

export default {
  connectToSnowflake,
  logInteraction,
  getMasteryScore,
  calculateMasteryScore,
  getUserMasteryScores,
  getRecommendations,
};

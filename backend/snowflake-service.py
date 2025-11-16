from flask import Flask, request, jsonify
from flask_cors import CORS
import snowflake.connector
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app)

# Snowflake connection config
# Use org-account format directly (e.g., MUPWCBZ-TN61553)
account = os.getenv('SNOWFLAKE_ACCOUNT', '')
print(f"[Snowflake Config] Using account: {account}")

SNOWFLAKE_CONFIG = {
    'account': account,
    'user': os.getenv('SNOWFLAKE_USER'),
    'password': os.getenv('SNOWFLAKE_PASSWORD'),
    'warehouse': 'SYNTRA',
    'database': 'SYNTRA_DB',
    'schema': 'PUBLIC'
}

def get_connection():
    return snowflake.connector.connect(**SNOWFLAKE_CONFIG)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/log-interaction', methods=['POST'])
def log_interaction():
    try:
        data = request.json
        user_id = data.get('userId')
        node_id = data.get('nodeId')
        interaction_type = data.get('interactionType')
        duration_seconds = data.get('durationSeconds', 0)
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO SYNTRA_DB.PUBLIC.USER_INTERACTIONS 
            (USER_ID, NODE_ID, INTERACTION_TYPE, DURATION_SECONDS, METADATA, TIMESTAMP)
            VALUES (%s, %s, %s, %s, NULL, CURRENT_TIMESTAMP())
        """, (user_id, node_id, interaction_type, duration_seconds))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error logging interaction: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get-interactions', methods=['GET'])
def get_interactions():
    try:
        user_id = request.args.get('userId')
        node_id = request.args.get('nodeId')
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                INTERACTION_TYPE,
                DURATION_SECONDS,
                COUNT(*) as count,
                MAX(TIMESTAMP) as last_visited
            FROM SYNTRA_DB.PUBLIC.USER_INTERACTIONS
            WHERE USER_ID = %s AND NODE_ID = %s
            GROUP BY INTERACTION_TYPE, DURATION_SECONDS
        """, (user_id, node_id))
        
        rows = cursor.fetchall()
        
        interactions = []
        for row in rows:
            interactions.append({
                'INTERACTION_TYPE': row[0],
                'DURATION_SECONDS': row[1],
                'COUNT': row[2],
                'LAST_VISITED': row[3].isoformat() if row[3] else None
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({'interactions': interactions})
    except Exception as e:
        print(f"Error getting interactions: {e}")
        return jsonify({'interactions': []}), 500

@app.route('/upsert-mastery', methods=['POST'])
def upsert_mastery():
    try:
        data = request.json
        user_id = data.get('userId')
        node_id = data.get('nodeId')
        mastery_score = data.get('masteryScore')
        revisit_count = data.get('revisitCount', 0)
        total_time_spent = data.get('totalTimeSpent', 0)
        subtopics_explored = data.get('subtopicsExplored', 0)
        content_read_pct = data.get('contentReadPct', 0)
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            MERGE INTO SYNTRA_DB.PUBLIC.MASTERY_SCORES AS target
            USING (SELECT %s as USER_ID, %s as NODE_ID) AS source
            ON target.USER_ID = source.USER_ID AND target.NODE_ID = source.NODE_ID
            WHEN MATCHED THEN
                UPDATE SET 
                    MASTERY_SCORE = %s,
                    REVISIT_COUNT = %s,
                    TOTAL_TIME_SPENT = %s,
                    SUBTOPICS_EXPLORED = %s,
                    CONTENT_READ_PCT = %s,
                    LAST_VISITED = CURRENT_TIMESTAMP(),
                    UPDATED_AT = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN
                INSERT (USER_ID, NODE_ID, MASTERY_SCORE, REVISIT_COUNT, TOTAL_TIME_SPENT, SUBTOPICS_EXPLORED, CONTENT_READ_PCT, LAST_VISITED, UPDATED_AT)
                VALUES (source.USER_ID, source.NODE_ID, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
        """, (user_id, node_id, mastery_score, revisit_count, total_time_spent, subtopics_explored, content_read_pct,
              mastery_score, revisit_count, total_time_spent, subtopics_explored, content_read_pct))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error upserting mastery: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get-mastery', methods=['GET'])
def get_mastery():
    try:
        user_id = request.args.get('userId')
        node_id = request.args.get('nodeId')
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM SYNTRA_DB.PUBLIC.MASTERY_SCORES
            WHERE USER_ID = %s AND NODE_ID = %s
        """, (user_id, node_id))
        
        row = cursor.fetchone()
        
        if row:
            mastery = {
                'USER_ID': row[0],
                'NODE_ID': row[1],
                'MASTERY_SCORE': float(row[2]) if row[2] else 0,
                'REVISIT_COUNT': row[3],
                'TOTAL_TIME_SPENT': row[4],
                'SUBTOPICS_EXPLORED': row[5],
                'CONTENT_READ_PCT': row[6],
                'LAST_VISITED': row[7].isoformat() if row[7] else None,
                'UPDATED_AT': row[8].isoformat() if row[8] else None
            }
        else:
            mastery = None
        
        cursor.close()
        conn.close()
        
        return jsonify({'mastery': mastery})
    except Exception as e:
        print(f"Error getting mastery: {e}")
        return jsonify({'mastery': None}), 500

@app.route('/get-recommendations', methods=['GET'])
def get_recommendations():
    try:
        user_id = request.args.get('userId')
        current_node_id = request.args.get('currentNodeId', None)
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get all mastery scores for the user
        cursor.execute("""
            SELECT NODE_ID, MASTERY_SCORE
            FROM SYNTRA_DB.PUBLIC.MASTERY_SCORES
            WHERE USER_ID = %s
            ORDER BY MASTERY_SCORE ASC
        """, (user_id,))
        
        mastery_data = cursor.fetchall()
        
        # Format mastery data for AI
        mastery_summary = "\n".join([
            f"- {row[0]}: {float(row[1]) if row[1] else 0:.1f}% mastery"
            for row in mastery_data
        ])
        
        if not mastery_summary:
            mastery_summary = "No topics learned yet."
        
        # Build prompt for Cortex AI
        current_context = f"Currently viewing: {current_node_id}\n\n" if current_node_id else ""
        prompt = f"""You are an AI learning advisor. Based on this user's mastery data:

{current_context}Mastery Scores:
{mastery_summary}

NOTE: In this system, >50% mastery means the user has solid understanding. 70%+ means advanced. 100% means expert.

Suggest 3 topics they should learn next that would:
1. Build on what they already know (complement existing knowledge, especially topics >50%)
2. Fill gaps in foundational understanding (topics <30%)
3. Unlock new areas of study

For each recommendation, explain:
- Why this topic is valuable now
- How it connects to their current knowledge (especially their 50%+ topics)
- What mastery level they should aim for (50%+ is good, 70%+ is strong)

IMPORTANT: Topic names should use spaces instead of hyphens or dashes. Write "Machine Learning" not "Machine-Learning", "Neural Networks" not "Neural-Networks", etc.

Format as JSON:
{{
  "recommendations": [
    {{
      "topic": "topic name",
      "reason": "why learn this now",
      "connections": ["topic1", "topic2"],
      "targetMastery": 60
    }}
  ]
}}"""

        print(f"[Recommendations] Querying Cortex AI for user {user_id}")
        print(f"[Recommendations] Mastery data rows: {len(mastery_data)}")
        
        # Use Snowflake Cortex AI to generate recommendations
        try:
            cursor.execute("""
                SELECT SNOWFLAKE.CORTEX.COMPLETE(
                    'mistral-large',
                    %s
                ) as recommendation
            """, (prompt,))
            
            result = cursor.fetchone()
            ai_response = result[0] if result else "{}"
            
            print(f"[Recommendations] ✅ Cortex AI raw response:")
            print(ai_response)
            print(f"[Recommendations] Response type: {type(ai_response)}")
        except Exception as cortex_error:
            print(f"[Recommendations] ⚠️ Cortex AI error: {cortex_error}")
            print(f"[Recommendations] This might mean Cortex isn't enabled or role lacks permissions")
            cursor.close()
            conn.close()
            return jsonify({
                "recommendations": [
                    {
                        "topic": "Enable Snowflake Cortex",
                        "reason": "Cortex AI isn't available. Contact your Snowflake admin to enable CORTEX functions for your role.",
                        "connections": [],
                        "targetMastery": 0
                    }
                ]
            })
        
        cursor.close()
        conn.close()
        
        # Parse JSON response
        import json
        import re
        try:
            # Try direct parse first
            recommendations = json.loads(ai_response)
            print(f"[Recommendations] ✅ Successfully parsed JSON")
        except:
            print(f"[Recommendations] ⚠️ Failed to parse as JSON, trying to extract...")
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', ai_response, re.DOTALL)
            if json_match:
                try:
                    recommendations = json.loads(json_match.group(1))
                    print(f"[Recommendations] ✅ Extracted JSON from code block")
                except:
                    recommendations = None
            else:
                # Try to find JSON object in response
                json_match = re.search(r'\{.*"recommendations".*\}', ai_response, re.DOTALL)
                if json_match:
                    try:
                        recommendations = json.loads(json_match.group(0))
                        print(f"[Recommendations] ✅ Extracted JSON from text")
                    except:
                        recommendations = None
                else:
                    recommendations = None
            
            if not recommendations:
                print(f"[Recommendations] ❌ Could not extract JSON, using fallback")
                recommendations = {
                    "recommendations": [
                        {
                            "topic": "Explore foundational topics",
                            "reason": "Build a strong base before advancing (Cortex returned non-JSON)",
                            "connections": [],
                            "targetMastery": 70
                        }
                    ]
                }
        
        return jsonify(recommendations)
        
    except Exception as e:
        print(f"Error getting recommendations: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "recommendations": [
                {
                    "topic": "Continue exploring",
                    "reason": "Keep learning at your own pace",
                    "connections": [],
                    "targetMastery": 70
                }
            ]
        }), 200  # Return 200 with fallback data

if __name__ == '__main__':
    print("🐍 Python Snowflake Service starting on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)

import snowflake.connector
import os
from dotenv import load_dotenv

load_dotenv()

print("🚀 Setting up Snowflake database and tables...")
print("=" * 60)

try:
    conn = snowflake.connector.connect(
        account=os.getenv('SNOWFLAKE_ACCOUNT'),
        user=os.getenv('SNOWFLAKE_USER'),
        password=os.getenv('SNOWFLAKE_PASSWORD'),
        warehouse='SYNTRA'
    )
    
    cursor = conn.cursor()
    
    # Create database
    print("\n📦 Creating database SYNTRA_DB...")
    cursor.execute("CREATE DATABASE IF NOT EXISTS SYNTRA_DB")
    print("✅ Database created")
    
    # Use the database
    cursor.execute("USE DATABASE SYNTRA_DB")
    
    # Create schema (PUBLIC should exist by default, but let's make sure)
    print("\n📂 Creating schema PUBLIC...")
    cursor.execute("CREATE SCHEMA IF NOT EXISTS PUBLIC")
    cursor.execute("USE SCHEMA PUBLIC")
    print("✅ Schema ready")
    
    # Create USER_INTERACTIONS table
    print("\n👥 Creating USER_INTERACTIONS table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS USER_INTERACTIONS (
            USER_ID VARCHAR(255) NOT NULL,
            NODE_ID VARCHAR(255) NOT NULL,
            INTERACTION_TYPE VARCHAR(50) NOT NULL,
            DURATION_SECONDS INT DEFAULT 0,
            METADATA VARIANT,
            TIMESTAMP TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)
    print("✅ USER_INTERACTIONS table created")
    
    # Create MASTERY_SCORES table
    print("\n📊 Creating MASTERY_SCORES table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS MASTERY_SCORES (
            USER_ID VARCHAR(255) NOT NULL,
            NODE_ID VARCHAR(255) NOT NULL,
            MASTERY_SCORE FLOAT DEFAULT 0,
            REVISIT_COUNT INT DEFAULT 0,
            TOTAL_TIME_SPENT INT DEFAULT 0,
            SUBTOPICS_EXPLORED INT DEFAULT 0,
            CONTENT_READ_PCT FLOAT DEFAULT 0,
            LAST_VISITED TIMESTAMP_LTZ,
            UPDATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
            PRIMARY KEY (USER_ID, NODE_ID)
        )
    """)
    print("✅ MASTERY_SCORES table created")
    
    # Create RECOMMENDATIONS table
    print("\n💡 Creating RECOMMENDATIONS table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS RECOMMENDATIONS (
            USER_ID VARCHAR(255) NOT NULL,
            RECOMMENDED_NODE_ID VARCHAR(255) NOT NULL,
            CONFIDENCE_SCORE FLOAT DEFAULT 0,
            REASON VARCHAR(500),
            CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)
    print("✅ RECOMMENDATIONS table created")
    
    # Verify tables were created
    print("\n🔍 Verifying tables...")
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    print("\n📋 Tables in SYNTRA_DB.PUBLIC:")
    for table in tables:
        print(f"   ✓ {table[1]}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("🎉 Setup complete! Your Snowflake database is ready.")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ Error during setup: {e}")
    import traceback
    traceback.print_exc()

import snowflake.connector
import os
from dotenv import load_dotenv

load_dotenv()

# Verify Snowflake setup - check tables and permissions
formats_to_test = [
    'MUPWCBZ-TN61553',
]

user = os.getenv('SNOWFLAKE_USER')
password = os.getenv('SNOWFLAKE_PASSWORD')

print(f"🔍 Verifying Snowflake setup for user: {user}")
print("=" * 60)

for fmt in formats_to_test:
    try:
        conn = snowflake.connector.connect(
            account=fmt,
            user=user,
            password=password,
            warehouse='SYNTRA',
            database='SYNTRA_DB',
            schema='PUBLIC'
        )
        
        cursor = conn.cursor()
        
        # Check tables exist
        print(f"\n📋 Tables in SYNTRA_DB.PUBLIC:")
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        table_names = [table[1] for table in tables]
        for name in table_names:
            print(f"   ✓ {name}")
        
        # Test INSERT into USER_INTERACTIONS
        print(f"\n🧪 Testing INSERT into USER_INTERACTIONS...")
        cursor.execute("""
            INSERT INTO SYNTRA_DB.PUBLIC.USER_INTERACTIONS 
            (USER_ID, NODE_ID, INTERACTION_TYPE, DURATION_SECONDS, METADATA, TIMESTAMP)
            VALUES (%s, %s, %s, %s, NULL, CURRENT_TIMESTAMP())
        """, ('test-user', 'test-node', 'test', 0))
        conn.commit()
        print(f"   ✅ INSERT successful")
        
        # Test SELECT
        print(f"\n📊 Testing SELECT from USER_INTERACTIONS...")
        cursor.execute("""
            SELECT * FROM SYNTRA_DB.PUBLIC.USER_INTERACTIONS 
            WHERE USER_ID = 'test-user' 
            LIMIT 1
        """)
        row = cursor.fetchone()
        if row:
            print(f"   ✅ SELECT successful - Found test record")
        
        # Clean up test data
        cursor.execute("DELETE FROM SYNTRA_DB.PUBLIC.USER_INTERACTIONS WHERE USER_ID = 'test-user'")
        conn.commit()
        print(f"   🧹 Test data cleaned up")
        
        cursor.close()
        conn.close()
        
        print(f"\n" + "=" * 60)
        print(f"🎉 SUCCESS! Snowflake is fully configured and working!")
        print(f"=" * 60)
        break
        
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        import traceback
        traceback.print_exc()

print("\nTest complete!")

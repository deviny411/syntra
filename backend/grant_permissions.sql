-- Run this in Snowflake UI as ACCOUNTADMIN
-- This grants SYNTRA_APP user access to SYNTRA_DB and its tables

-- First, check what tables exist
USE DATABASE SYNTRA_DB;
USE SCHEMA PUBLIC;
SHOW TABLES;

-- Grant usage on database
GRANT USAGE ON DATABASE SYNTRA_DB TO ROLE PUBLIC;

-- Grant usage on schema
GRANT USAGE ON SCHEMA SYNTRA_DB.PUBLIC TO ROLE PUBLIC;

-- Grant privileges on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA SYNTRA_DB.PUBLIC TO ROLE PUBLIC;

-- Grant privileges on future tables (for tables created later)
GRANT SELECT, INSERT, UPDATE, DELETE ON FUTURE TABLES IN SCHEMA SYNTRA_DB.PUBLIC TO ROLE PUBLIC;

-- Grant warehouse usage (if not already granted)
GRANT USAGE ON WAREHOUSE SYNTRA TO ROLE PUBLIC;

-- Verify the grants were applied
SHOW GRANTS TO ROLE PUBLIC;

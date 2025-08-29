-- ========================================
-- TABLES
-- ========================================

-- Raw news data table
CREATE OR REPLACE TABLE BTC_DATA.RAW.BITCOIN_NEWS (
    id INTEGER AUTOINCREMENT PRIMARY KEY,
    datetime TIMESTAMP,
    headline STRING,
    summary STRING,
    source STRING,
    url STRING,
    categories STRING,
    tags STRING,
    api_source STRING,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    ingestion_date DATE DEFAULT CURRENT_DATE(),
    file_name STRING,
    processed_flag BOOLEAN DEFAULT FALSE
);

-- Hourly sentiment analysis results
CREATE OR REPLACE TABLE BTC_DATA.ANALYTICS.HOURLY_FNG (
    id INTEGER AUTOINCREMENT PRIMARY KEY,
    analysis_date DATE,
    analysis_hour INTEGER,
    datetime_hour TIMESTAMP,
    total_articles INTEGER,
    avg_sentiment_score FLOAT,
    fear_greed_score INTEGER,
    fear_greed_category STRING,
    processing_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    source_article_ids ARRAY
);

-- Daily aggregated Fear & Greed Index 
CREATE OR REPLACE TABLE BTC_DATA.ANALYTICS.DAILY_FNG (
    id INTEGER AUTOINCREMENT PRIMARY KEY,
    analysis_date DATE,
    total_articles INTEGER,
    total_hours_analyzed INTEGER,
    avg_sentiment_score FLOAT,
    daily_fear_greed_score INTEGER,
    fear_greed_category STRING,
    hourly_scores ARRAY,
    processing_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);


-- ========================================
-- STREAM for Change Data Capture
-- ========================================

-- Stream to capture new inserts into BITCOIN_NEWS
CREATE OR REPLACE STREAM BTC_DATA.RAW.NEWS_STREAM 
ON TABLE BTC_DATA.RAW.BITCOIN_NEWS
APPEND_ONLY = TRUE  -- Only capture INSERT operations
COMMENT = 'Captures new Bitcoin news articles for real-time sentiment processing';

-- ========================================
-- STORED PROCEDURES
-- ========================================

-- Procedure to process hourly sentiment analysis
CREATE OR REPLACE PROCEDURE  BTC_DATA.ANALYTICS.CALCULATE_HOURLY_FNG()
RETURNS STRING
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    processed_count INTEGER DEFAULT 0;
    error_message STRING DEFAULT '';
BEGIN
    
    -- Check if there's new data in the stream
    LET stream_count INTEGER := (SELECT COUNT(*) FROM BTC_DATA.RAW.NEWS_STREAM);
    
    IF (stream_count = 0) THEN
        RETURN 'No new data to process';
    END IF;
    
    -- Process sentiment analysis for new articles
    INSERT INTO  BTC_DATA.ANALYTICS.HOURLY_FNG (
        analysis_date, 
        analysis_hour, 
        datetime_hour, 
        total_articles, 
        avg_sentiment_score, 
        fear_greed_score, 
        fear_greed_category,
        source_article_ids
    )
    WITH new_articles AS (
        -- Get new articles from stream
        SELECT 
            id,
            datetime,
            headline,
            summary,
            DATE(datetime) as article_date,
            HOUR(datetime) as article_hour,
            DATE_TRUNC('HOUR', datetime) as hour_bucket
        FROM BTC_DATA.RAW.NEWS_STREAM
        WHERE summary IS NOT NULL 
        AND LENGTH(TRIM(summary)) > 10
        AND datetime IS NOT NULL
    ),
    hourly_sentiment AS (
        SELECT 
            article_date as analysis_date,
            article_hour as analysis_hour,
            hour_bucket as datetime_hour,
            COUNT(*) as total_articles,
            -- Use Snowflake Cortex SENTIMENT function
            AVG(SNOWFLAKE.CORTEX.SENTIMENT(headline || '. ' || summary)) as avg_sentiment_score,
            ARRAY_AGG(id) as article_ids
        FROM new_articles
        GROUP BY article_date, article_hour, hour_bucket
    ),
    fear_greed_calculation AS (
        SELECT 
            analysis_date,
            analysis_hour,
            datetime_hour,
            total_articles,
            avg_sentiment_score,
            article_ids,
            -- Convert sentiment (-1 to 1) to Fear & Greed scale (0-100)
            ROUND(((avg_sentiment_score + 1) / 2) * 100) as fear_greed_score,
            CASE 
                WHEN ROUND(((avg_sentiment_score + 1) / 2) * 100) BETWEEN 0 AND 20 THEN 'Extreme Fear'
                WHEN ROUND(((avg_sentiment_score + 1) / 2) * 100) BETWEEN 21 AND 40 THEN 'Fear'
                WHEN ROUND(((avg_sentiment_score + 1) / 2) * 100) BETWEEN 41 AND 60 THEN 'Neutral'
                WHEN ROUND(((avg_sentiment_score + 1) / 2) * 100) BETWEEN 61 AND 80 THEN 'Greed'
                WHEN ROUND(((avg_sentiment_score + 1) / 2) * 100) BETWEEN 81 AND 100 THEN 'Extreme Greed'
                ELSE 'Neutral'
            END as fear_greed_category
        FROM hourly_sentiment
    )
    SELECT 
        analysis_date,
        analysis_hour,
        datetime_hour,
        total_articles,
        avg_sentiment_score,
        fear_greed_score,
        fear_greed_category,
        article_ids
    FROM fear_greed_calculation;
    
    -- Get count of processed records
    processed_count := (SELECT COUNT(*) FROM BTC_DATA.RAW.NEWS_STREAM);
    
    -- Mark articles as processed
    UPDATE BTC_DATA.RAW.BITCOIN_NEWS 
    SET processed_flag = TRUE 
    WHERE id IN (SELECT id FROM BTC_DATA.RAW.NEWS_STREAM);
    
    RETURN 'Successfully processed ' || processed_count || ' articles into hourly sentiment analysis';
    
EXCEPTION
    WHEN OTHER THEN
        error_message := SQLERRM;
        RETURN 'Error processing hourly sentiment: ' || error_message;
END;
$$;

-- Procedure to calculate daily Fear & Greed Index
CREATE OR REPLACE PROCEDURE  BTC_DATA.ANALYTICS.CALCULATE_DAILY_FNG()
RETURNS STRING
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    processed_dates INTEGER DEFAULT 0;
    error_message STRING DEFAULT '';
BEGIN
    
    -- Calculate daily FNG for dates that have complete hourly data
    INSERT INTO  BTC_DATA.ANALYTICS.DAILY_FNG (
        analysis_date,
        total_articles,
        total_hours_analyzed,
        avg_sentiment_score,
        daily_fear_greed_score,
        fear_greed_category,
        hourly_scores
    )
    WITH daily_candidates AS (
        -- Find dates with new hourly data not yet in daily table
        SELECT DISTINCT analysis_date
        FROM  BTC_DATA.ANALYTICS.HOURLY_FNG h
        WHERE NOT EXISTS (
            SELECT 1 FROM  BTC_DATA.ANALYTICS.DAILY_FNG d 
            WHERE d.analysis_date = h.analysis_date
        )
        AND analysis_date < CURRENT_DATE()  -- Only process complete days
    ),
    daily_aggregation AS (
        SELECT 
            h.analysis_date,
            SUM(h.total_articles) as total_articles,
            COUNT(DISTINCT h.analysis_hour) as total_hours_analyzed,
            AVG(h.avg_sentiment_score) as avg_sentiment_score,
            ROUND(AVG(h.fear_greed_score)) as daily_fear_greed_score,
            ARRAY_AGG(h.fear_greed_score) as hourly_scores
        FROM  BTC_DATA.ANALYTICS.HOURLY_FNG h
        INNER JOIN daily_candidates dc ON h.analysis_date = dc.analysis_date
        GROUP BY h.analysis_date
    )
    SELECT 
        analysis_date,
        total_articles,
        total_hours_analyzed,
        avg_sentiment_score,
        daily_fear_greed_score,
        CASE 
            WHEN daily_fear_greed_score BETWEEN 0 AND 20 THEN 'Extreme Fear'
            WHEN daily_fear_greed_score BETWEEN 21 AND 40 THEN 'Fear'
            WHEN daily_fear_greed_score BETWEEN 41 AND 60 THEN 'Neutral'
            WHEN daily_fear_greed_score BETWEEN 61 AND 80 THEN 'Greed'
            WHEN daily_fear_greed_score BETWEEN 81 AND 100 THEN 'Extreme Greed'
            ELSE 'Neutral'
        END as fear_greed_category,
        hourly_scores
    FROM daily_aggregation;
    
    processed_dates := (SELECT COUNT(*) FROM daily_candidates);
    
    RETURN 'Successfully processed ' || processed_dates || ' daily Fear & Greed indices';
    
EXCEPTION
    WHEN OTHER THEN
        error_message := SQLERRM;
        RETURN 'Error processing daily FNG: ' || error_message;
END;
$$;

-- ========================================
-- TASKS for Automated Processing
-- ========================================


create or replace task BTC_DATA.ANALYTICS.PROCESS_HOURLY_FNG
	schedule='USING CRON 10 * * * * UTC'
	target_completion_interval='1 MINUTES'
	USER_TASK_MANAGED_INITIAL_WAREHOUSE_SIZE='XSMALL'
	SUSPEND_TASK_AFTER_NUM_FAILURES=1
	USER_TASK_TIMEOUT_MS=120000
	as CALL  BTC_DATA.ANALYTICS.CALCULATE_HOURLY_FNG();
    
-- Task to process daily FNG (runs every hour)
create or replace task BTC_DATA.ANALYTICS.PROCESS_DAILY_FNG
	warehouse=INT_WH
	schedule='USING CRON 35 23 * * * Europe/Paris'
	SUSPEND_TASK_AFTER_NUM_FAILURES=1
	USER_TASK_TIMEOUT_MS=120000
	as CALL  BTC_DATA.ANALYTICS.CALCULATE_DAILY_FNG();
    
-- ========================================
-- ENABLE TASKS
-- ========================================
GRANT EXECUTE TASK 
  ON ACCOUNT 
  TO ROLE SYSADMIN;

GRANT EXECUTE MANAGED TASK 
  ON ACCOUNT 
  TO ROLE SYSADMIN;

-- Enable the tasks (requires ACCOUNTADMIN role)
ALTER TASK  BTC_DATA.ANALYTICS.PROCESS_HOURLY_FNG RESUME;
ALTER TASK  BTC_DATA.ANALYTICS.PROCESS_DAILY_FNG RESUME;

-- ========================================
-- MONITORING VIEWS
-- ========================================

CREATE OR REPLACE FILE FORMAT BTC_DATA.RAW.CSV_FORMAT
    TYPE = 'CSV'
    FIELD_DELIMITER = ','
    RECORD_DELIMITER = '\n'
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    ESCAPE_UNENCLOSED_FIELD = NONE
    TRIM_SPACE = TRUE
    ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE;

   
SELECT * from BTC_DATA.RAW.NEWS_STREAM;
SELECT * from BTC_DATA.RAW.BITCOIN_NEWS ORDER BY DATETIME DESC LIMIT 100;
SELECT * from BTC_DATA.ANALYTICS.HOURLY_FNG ORDER BY DATETIME_HOUR DESC;
SELECT * from BTC_DATA.ANALYTICS.DAILY_FNG ORDER BY ANALYSIS_DATE DESC;

SELECT * from BTC_DATA.RAW.BITCOIN_NEWS LIMIT 10;

SELECT * FROM  BTC_DATA.ANALYTICS.HOURLY_FNG where datetime_hour = '2025-07-15 23:00:00.000';

SELECT max(DATETIME) from BTC_DATA.RAW.BITCOIN_NEWS;
-- View to monitor stream activity
SELECT 
    COUNT(*) as pending_records,
    MIN(ingestion_timestamp) as oldest_pending,
    MAX(ingestion_timestamp) as newest_pending
FROM BTC_DATA.RAW.NEWS_STREAM;

-- View to monitor task execution
SELECT 
    name,
    state,
    scheduled_time,
    completed_time,
    return_value,
    error_code,
    error_message
FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY())
WHERE name IN ('PROCESS_HOURLY_FNG', 'PROCESS_DAILY_FNG')
ORDER BY scheduled_time DESC;


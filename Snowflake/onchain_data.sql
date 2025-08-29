CREATE OR REPLACE TABLE BTC_DATA.DATA.BTC_REALIZED_CAP_AND_PRICE AS
WITH 
outputs_with_spend AS (
    SELECT 
        fo.TX_ID,
        fo.INDEX,
        DATE_TRUNC('DAY', fo.BLOCK_TIMESTAMP)       AS CREATED_DAY,
        DATE_TRUNC('DAY', fi.BLOCK_TIMESTAMP)       AS SPENT_DAY,
        fo.VALUE                                    AS BTC_VALUE
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS fo
    LEFT JOIN BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS fi
           ON fo.TX_ID = fi.SPENT_TX_ID
          AND fo.INDEX = fi.SPENT_OUTPUT_INDEX
),
realized_cap_daily AS (
    SELECT
        p.DATE                                         AS DAY_UTC,
        SUM(ows.BTC_VALUE * p_crea.PRICE)              AS REALIZED_CAP_USD
    FROM BTC_DATA.DATA.BTC_PRICE p
    LEFT JOIN outputs_with_spend ows
           ON ows.CREATED_DAY <= p.DATE
          AND (ows.SPENT_DAY IS NULL OR ows.SPENT_DAY > p.DATE)
    LEFT JOIN BTC_DATA.DATA.BTC_PRICE p_crea
           ON p_crea.DATE = ows.CREATED_DAY
    GROUP BY p.DATE
),
unspent_btc_daily AS (
    SELECT
        p.DATE                            AS DAY_UTC,
        SUM(ows.BTC_VALUE)               AS TOTAL_UNSPENT_BTC
    FROM BTC_DATA.DATA.BTC_PRICE p
    LEFT JOIN outputs_with_spend ows
           ON ows.CREATED_DAY <= p.DATE
          AND (ows.SPENT_DAY IS NULL OR ows.SPENT_DAY > p.DATE)
    GROUP BY p.DATE
),
final AS (
    SELECT
        r.DAY_UTC                                                    AS DATE,
        r.REALIZED_CAP_USD,
        u.TOTAL_UNSPENT_BTC,
        CASE 
            WHEN u.TOTAL_UNSPENT_BTC = 0 THEN NULL
            ELSE r.REALIZED_CAP_USD / u.TOTAL_UNSPENT_BTC
        END                                                         AS REALIZED_PRICE_USD
    FROM realized_cap_daily r
    JOIN unspent_btc_daily u
        ON r.DAY_UTC = u.DAY_UTC
)

SELECT
   DATE,
   REALIZED_CAP_USD,
   TOTAL_UNSPENT_BTC,
   REALIZED_PRICE_USD
FROM final
ORDER BY DATE;


-------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE TABLE BTC_DATA.DATA.EXCHANGE_FLOW AS
WITH cex_addresses AS (
    -- Sélectionne les adresses associées aux exchanges centralisés (liste des projects)
    SELECT DISTINCT ADDRESS
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.DIM_LABELS
    WHERE PROJECT_NAME IN ('bitmex', 'coinsquare', 'binance', 'coinbase',
                            'crypto.com', 'kraken', 'korbit', 'gate.io', 
                            'kucoin', 'coincheck', 'okx', 'bitfinex', 
                            'gate', 'bitget', 'bitstamp', 'bybit', 'phemex')
),
daily_inflow AS (
    -- Agrège par jour l'inflow en BTC (via FACT_OUTPUTS)
    SELECT 
        DATE_TRUNC('day', BLOCK_TIMESTAMP) AS day,
        SUM(VALUE) AS inflow_btc
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS o
    JOIN cex_addresses ca
      ON o.PUBKEY_SCRIPT_ADDRESS = ca.ADDRESS
    GROUP BY 1
),
daily_outflow AS (
    -- Agrège par jour l'outflow en BTC (via FACT_INPUTS)
    SELECT 
        DATE_TRUNC('day', BLOCK_TIMESTAMP) AS day,
        SUM(VALUE) AS outflow_btc
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS i
    JOIN cex_addresses ca
      ON i.PUBKEY_SCRIPT_ADDRESS = ca.ADDRESS
    GROUP BY 1
),
daily_totals AS (
    -- Joint les agrégations journalières pour obtenir le netflow par jour
    SELECT 
        COALESCE(d_in.day, d_out.day) AS day,
        COALESCE(d_in.inflow_btc, 0) AS inflow_btc,
        COALESCE(d_out.outflow_btc, 0) AS outflow_btc,
        COALESCE(d_in.inflow_btc, 0) - COALESCE(d_out.outflow_btc, 0) AS netflow_btc
    FROM daily_inflow d_in
    FULL OUTER JOIN daily_outflow d_out
      ON d_in.day = d_out.day
),
daily_with_price AS (
    -- Joint la table des totaux journaliers avec le prix du BTC du même jour
    SELECT
         dt.day,
         dt.inflow_btc,
         dt.outflow_btc,
         dt.netflow_btc,
         bp.BTC_PRICE_USD,
         SUM(dt.netflow_btc) OVER (ORDER BY dt.day ROWS UNBOUNDED PRECEDING) AS exchange_reserve_btc
    FROM daily_totals dt
    LEFT JOIN BTC_DATA.DATA.BTC_PRICE_USD bp
      ON dt.day = bp.DATE
)
SELECT 
    day,
    inflow_btc,
    outflow_btc,
    netflow_btc,
    exchange_reserve_btc,
    inflow_btc * BTC_PRICE_USD AS inflow_usd,
    outflow_btc * BTC_PRICE_USD AS outflow_usd,
    netflow_btc * BTC_PRICE_USD AS netflow_usd,
    exchange_reserve_btc * BTC_PRICE_USD AS exchange_reserve_usd
FROM daily_with_price
ORDER BY day;


--------------------------------------------------------------------------------------------------------------


CREATE OR REPLACE TABLE BTC_DATA.DATA.MVRV AS
WITH realized_table AS (
    SELECT
        TO_DATE(DATE)                           AS DAY_UTC,
        REALIZED_CAP_USD,
        TOTAL_UNSPENT_BTC
    FROM BTC_DATA.DATA.BTC_REALIZED_CAP_AND_PRICE
),
market_table AS (
    SELECT
        TO_DATE(DATE)   AS DAY_UTC,
        PRICE           AS MARKET_PRICE_USD
    FROM BTC_DATA.DATA.BTC_PRICE
)
SELECT
    r.DAY_UTC                                AS DATE,
    r.REALIZED_CAP_USD,
    r.TOTAL_UNSPENT_BTC,
    (r.TOTAL_UNSPENT_BTC * m.MARKET_PRICE_USD)    AS MARKET_CAP_USD,
    CASE 
      WHEN r.REALIZED_CAP_USD = 0 THEN NULL
      ELSE (r.TOTAL_UNSPENT_BTC * m.MARKET_PRICE_USD) / r.REALIZED_CAP_USD
    END                                       AS MVRV
FROM realized_table r
JOIN market_table m 
   ON r.DAY_UTC = m.DAY_UTC
ORDER BY r.DAY_UTC;


CREATE OR REPLACE TABLE BTC_DATA.DATA.MVRV_HOLDERS AS
WITH DATES AS (
    -- On récupère toutes les dates disponibles dans la table des prix
    SELECT DISTINCT
        DATE AS PRICE_DATE
    FROM BTC_DATA.DATA.BTC_PRICE_USD
    WHERE DATE <= CURRENT_DATE()
),
UTXO_STATUS AS (
    SELECT
         o.OUTPUT_ID
        ,DATE(o.BLOCK_TIMESTAMP) AS CREATION_DATE
        ,o.VALUE                 AS BTC_VALUE
        ,i.BLOCK_TIMESTAMP       AS SPENT_TS
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS o
    LEFT JOIN BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS i
           ON  o.TX_ID = i.SPENT_TX_ID
           AND o.INDEX = i.SPENT_OUTPUT_INDEX
),
DAILY_UTXO_SET AS (
    -- On évalue pour chaque date si l’UTXO est encore “unspent”
    SELECT
         d.PRICE_DATE                         AS SNAPSHOT_DATE
        ,u.OUTPUT_ID
        ,u.BTC_VALUE
        ,u.CREATION_DATE
        ,DATEDIFF('day', u.CREATION_DATE, d.PRICE_DATE) AS HOLD_DAYS
    FROM DATES d
    CROSS JOIN UTXO_STATUS u
    WHERE u.CREATION_DATE <= d.PRICE_DATE
      AND (
           u.SPENT_TS IS NULL
           OR DATE(u.SPENT_TS) > d.PRICE_DATE
      )
),
DAILY_UTXO_PRICES AS (
    -- Joindre le prix du jour (market price) et le prix à la création
    SELECT
         dus.SNAPSHOT_DATE
        ,dus.OUTPUT_ID
        ,dus.BTC_VALUE
        ,dus.HOLD_DAYS
        ,mp.BTC_PRICE_USD AS MARKET_PRICE
        ,cp.BTC_PRICE_USD AS CREATION_PRICE
    FROM DAILY_UTXO_SET dus
    
    -- prix BTC à la date du snapshot
    JOIN BTC_DATA.DATA.BTC_PRICE_USD mp
         ON dus.SNAPSHOT_DATE = mp.DATE
    
    -- prix BTC à la date de création
    JOIN BTC_DATA.DATA.BTC_PRICE_USD cp
         ON dus.CREATION_DATE = cp.DATE
),
CTE_MVRV_AGG AS (
    SELECT
         SNAPSHOT_DATE
        ,CASE WHEN HOLD_DAYS >= 155 THEN 'LTH' ELSE 'STH' END AS HOLDER_TYPE
        ,SUM(BTC_VALUE * MARKET_PRICE)         AS SUM_MARKET_VALUE
        ,SUM(BTC_VALUE * CREATION_PRICE)       AS SUM_REALIZED_VALUE
    FROM DAILY_UTXO_PRICES
    GROUP BY 1,2
),
CTE_MVRV_PER_DATE AS (
    SELECT
         SNAPSHOT_DATE
        ,SUM(CASE WHEN HOLDER_TYPE = 'LTH' THEN SUM_MARKET_VALUE ELSE 0 END)
         / NULLIF(SUM(CASE WHEN HOLDER_TYPE = 'LTH' THEN SUM_REALIZED_VALUE ELSE 0 END),0)
         AS LTH_MVRV
        ,SUM(CASE WHEN HOLDER_TYPE = 'STH' THEN SUM_MARKET_VALUE ELSE 0 END)
         / NULLIF(SUM(CASE WHEN HOLDER_TYPE = 'STH' THEN SUM_REALIZED_VALUE ELSE 0 END),0)
         AS STH_MVRV
    FROM CTE_MVRV_AGG
    GROUP BY SNAPSHOT_DATE
)
SELECT
     d.PRICE_DATE                        AS "DATE"
    ,COALESCE(m.LTH_MVRV, 0)            AS LTH_MVRV
    ,COALESCE(m.STH_MVRV, 0)            AS STH_MVRV
FROM DATES d
LEFT JOIN CTE_MVRV_PER_DATE m
       ON d.PRICE_DATE = m.SNAPSHOT_DATE
ORDER BY d.PRICE_DATE;



-----------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE TABLE BTC_DATA.DATA.NUPL AS
WITH realized_table AS (
    SELECT
        TO_DATE(DATE)                      AS DAY_UTC,
        REALIZED_CAP_USD,
        TOTAL_UNSPENT_BTC
    FROM BTC_DATA.DATA.BTC_REALIZED_CAP_AND_PRICE
),
market_table AS (
    SELECT
        TO_DATE(DATE)                      AS DAY_UTC,
        PRICE                               AS MARKET_PRICE_USD
    FROM BTC_DATA.DATA.BTC_PRICE
),

joined_data AS (
    SELECT 
        r.DAY_UTC                                                AS DATE,
        (r.TOTAL_UNSPENT_BTC * m.MARKET_PRICE_USD)               AS MARKET_CAP_USD,
        r.REALIZED_CAP_USD,
        CASE 
            WHEN (r.TOTAL_UNSPENT_BTC * m.MARKET_PRICE_USD) = 0 
                THEN NULL
            ELSE (
                (r.TOTAL_UNSPENT_BTC * m.MARKET_PRICE_USD)
                - r.REALIZED_CAP_USD
            ) / (r.TOTAL_UNSPENT_BTC * m.MARKET_PRICE_USD)
        END                                                     AS NUPL_RATIO
    FROM realized_table r
    JOIN market_table m
        ON r.DAY_UTC = m.DAY_UTC
)

SELECT
    DATE,
    MARKET_CAP_USD,
    REALIZED_CAP_USD,
    NUPL_RATIO                                     AS NUPL,
    NUPL_RATIO * 100                               AS NUPL_PERCENT
FROM joined_data
ORDER BY DATE;


CREATE OR REPLACE TABLE BTC_DATA.DATA.ACTIVE_ADDRESSES AS
WITH ADDRESSES_IN_OUT AS (
    SELECT 
        DATE_TRUNC('DAY', fo.BLOCK_TIMESTAMP) AS DAY_UTC,
        fo.PUBKEY_SCRIPT_ADDRESS             AS ADDRESS
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS fo
    
    UNION
    
    SELECT 
        DATE_TRUNC('DAY', fi.BLOCK_TIMESTAMP) AS DAY_UTC,
        fi.PUBKEY_SCRIPT_ADDRESS             AS ADDRESS
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS fi
),

DAILY_ACTIVE_ADDRESSES AS (
    SELECT
        DAY_UTC,
        COUNT(DISTINCT ADDRESS) AS ACTIVE_ADDRESSES
    FROM ADDRESSES_IN_OUT
    GROUP BY DAY_UTC
)

SELECT
    DAY_UTC               AS DATE,
    ACTIVE_ADDRESSES
FROM DAILY_ACTIVE_ADDRESSES
ORDER BY DATE;


CREATE OR REPLACE TABLE BTC_DATA.DATA.CDD AS
WITH spent_outputs AS (
    SELECT
        fi.BLOCK_TIMESTAMP                               AS SPENT_TIMESTAMP,
        DATE_TRUNC('DAY', fi.BLOCK_TIMESTAMP)            AS SPENT_DAY,

        fo.BLOCK_TIMESTAMP                               AS CREATED_TIMESTAMP,
        DATE_TRUNC('DAY', fo.BLOCK_TIMESTAMP)            AS CREATED_DAY,

        fo.VALUE                                         AS BTC_VALUE,
        
        DATEDIFF('DAY', fo.BLOCK_TIMESTAMP, fi.BLOCK_TIMESTAMP) AS COIN_AGE_DAYS
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS fi
    JOIN BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS fo
         ON fo.TX_ID  = fi.SPENT_TX_ID
        AND fo.INDEX  = fi.SPENT_OUTPUT_INDEX
),

daily_cdd AS (
    SELECT
        SPENT_DAY,
        SUM(BTC_VALUE * COIN_AGE_DAYS) AS TOTAL_CDD
    FROM spent_outputs
    GROUP BY SPENT_DAY
),

cdd_rolling AS (
    SELECT
        SPENT_DAY                                                   AS DATE,
        TOTAL_CDD                                                   AS CDD_RAW,
        AVG(TOTAL_CDD) OVER (
            ORDER BY SPENT_DAY
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        )                                                           AS CDD_30_DMA,
        AVG(TOTAL_CDD) OVER (
            ORDER BY SPENT_DAY
            ROWS BETWEEN 89 PRECEDING AND CURRENT ROW
        )                                                           AS CDD_90_DMA
    FROM daily_cdd
)

SELECT
    DATE,
    CDD_RAW,
    CDD_30_DMA,
    CDD_90_DMA
FROM cdd_rolling
ORDER BY DATE;


-----------------------------------------------------------------------------------------------------------------


CREATE OR REPLACE TABLE BTC_DATA.DATA.TX_VOLUME AS
WITH daily_volume AS (
    SELECT
        DATE_TRUNC('DAY', BLOCK_TIMESTAMP)     AS DAY_UTC,
        SUM(OUTPUT_VALUE)                      AS DAILY_TX_VOLUME_BTC
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_TRANSACTIONS
    WHERE IS_COINBASE = FALSE
    GROUP BY DATE_TRUNC('DAY', BLOCK_TIMESTAMP)
)

SELECT
    DAY_UTC    AS DATE,
    DAILY_TX_VOLUME_BTC
FROM daily_volume
ORDER BY DATE;

-----------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE TABLE BTC_DATA.DATA.PUELL_MULTIPLE AS
WITH daily_minted AS (
    SELECT
        DATE_TRUNC('DAY', BLOCK_TIMESTAMP) AS DAY_UTC,
        SUM(OUTPUT_VALUE)                  AS MINTED_BTC
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_TRANSACTIONS
    WHERE IS_COINBASE = TRUE
    GROUP BY DAY_UTC
),

daily_issuance_usd AS (
    SELECT
        dm.DAY_UTC,
        dm.MINTED_BTC,
        (dm.MINTED_BTC * p.BTC_PRICE_USD) AS DAILY_ISSUANCE_USD
    FROM daily_minted dm
    LEFT JOIN BTC_DATA.DATA.BTC_PRICE_USD p
           ON p.DATE = dm.DAY_UTC
),

puell_calc AS (
    SELECT
        DAY_UTC                                    AS DATE,
        MINTED_BTC,
        DAILY_ISSUANCE_USD,
        AVG(DAILY_ISSUANCE_USD) OVER (
            ORDER BY DAY_UTC
            ROWS BETWEEN 364 PRECEDING AND CURRENT ROW
        ) AS MA_365_ISSUANCE_USD
    FROM daily_issuance_usd
)

SELECT
    DATE,
    MINTED_BTC,
    DAILY_ISSUANCE_USD,
    MA_365_ISSUANCE_USD,
    CASE 
        WHEN MA_365_ISSUANCE_USD = 0 OR MA_365_ISSUANCE_USD IS NULL THEN NULL
        ELSE DAILY_ISSUANCE_USD / MA_365_ISSUANCE_USD
    END AS PUELL_MULTIPLE
FROM puell_calc
ORDER BY DATE;

-----------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE TABLE SOPR AS
WITH spent_outputs AS (
  SELECT 
      o.OUTPUT_ID,
      o.VALUE AS btc_value, 
      o.BLOCK_TIMESTAMP AS creation_time, 
      i.BLOCK_TIMESTAMP AS spending_time 
  FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS o
  JOIN BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS i
    ON o.TX_ID = i.SPENT_TX_ID
),
with_prices AS (
  SELECT 
      s.*,
      p_spending.btc_price_usd AS spending_price,
      p_creation.btc_price_usd AS creation_price
  FROM spent_outputs s
  LEFT JOIN BTC_DATA.DATA.BTC_PRICE_USD p_spending
    ON DATE(s.spending_time) = DATE(p_spending.TIMESTAMP)
  LEFT JOIN BTC_DATA.DATA.BTC_PRICE_USD p_creation
    ON DATE(s.creation_time) = DATE(p_creation.TIMESTAMP)
)
SELECT 
    DATE(spending_time) AS spent_date,
    SUM(btc_value * spending_price) / SUM(btc_value * creation_price) AS SOPR
FROM with_prices
GROUP BY DATE(spending_time)
ORDER BY spent_date;

CREATE OR REPLACE TABLE BTC_DATA.DATA.SOPR_HOLDERS AS
WITH DATES AS (
    -- On récupère toutes les dates disponibles dans la table des prix
    SELECT DISTINCT
        DATE AS PRICE_DATE
    FROM BTC_DATA.DATA.BTC_PRICE_USD
),
CTE_SOPR AS (
    SELECT 
         DATE(i.BLOCK_TIMESTAMP)                               AS DISPOSAL_DATE  -- date de dépense (jour)
        ,DATE(o.BLOCK_TIMESTAMP)                               AS CREATION_DATE  -- date de création (jour)
        ,i.VALUE                                               AS BTC_VALUE
        ,DATEDIFF('day', o.BLOCK_TIMESTAMP, i.BLOCK_TIMESTAMP) AS HOLD_DAYS
        
        -- Valeur en USD à la date de dépense
        ,(i.VALUE * dp.BTC_PRICE_USD) AS DISPOSAL_VALUE_USD
        
        -- Valeur en USD à la date de création
        ,(i.VALUE * cp.BTC_PRICE_USD) AS CREATION_VALUE_USD
        
    FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_INPUTS i
    JOIN BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_OUTPUTS o
         ON  i.SPENT_TX_ID        = o.TX_ID
         AND i.SPENT_OUTPUT_INDEX = o.INDEX
         
    -- Prix du BTC à la date de dépense
    JOIN BTC_DATA.DATA.BTC_PRICE_USD dp
         ON DATE(i.BLOCK_TIMESTAMP) = dp.DATE
         
    -- Prix du BTC à la date de création
    JOIN BTC_DATA.DATA.BTC_PRICE_USD cp
         ON DATE(o.BLOCK_TIMESTAMP) = cp.DATE
         
    WHERE i.VALUE IS NOT NULL
),
CTE_GROUPED AS (
    -- On agrège par (DISPOSAL_DATE, HOLDER_TYPE)
    SELECT
         DISPOSAL_DATE
        ,CASE WHEN HOLD_DAYS >= 155 THEN 'LTH' ELSE 'STH' END AS HOLDER_TYPE
        ,SUM(DISPOSAL_VALUE_USD)     AS SUM_DISPOSAL_USD
        ,SUM(CREATION_VALUE_USD)     AS SUM_CREATION_USD
    FROM CTE_SOPR
    GROUP BY 1,2
),
CTE_SOPR_PER_DATE AS (
    -- On pivote pour séparer LTH_SOPR et STH_SOPR sur la même ligne
    SELECT
         g.DISPOSAL_DATE
        ,SUM(CASE WHEN g.HOLDER_TYPE = 'LTH' THEN g.SUM_DISPOSAL_USD ELSE 0 END)
         / NULLIF(SUM(CASE WHEN g.HOLDER_TYPE = 'LTH' THEN g.SUM_CREATION_USD ELSE 0 END), 0)
         AS LTH_SOPR
        ,SUM(CASE WHEN g.HOLDER_TYPE = 'STH' THEN g.SUM_DISPOSAL_USD ELSE 0 END)
         / NULLIF(SUM(CASE WHEN g.HOLDER_TYPE = 'STH' THEN g.SUM_CREATION_USD ELSE 0 END), 0)
         AS STH_SOPR
    FROM CTE_GROUPED g
    GROUP BY g.DISPOSAL_DATE
)
SELECT
     d.PRICE_DATE                                AS "DATE"
    ,COALESCE(s.LTH_SOPR, 0)                     AS LTH_SOPR
    ,COALESCE(s.STH_SOPR, 0)                     AS STH_SOPR
FROM DATES d
LEFT JOIN CTE_SOPR_PER_DATE s
       ON d.PRICE_DATE = s.DISPOSAL_DATE
ORDER BY d.PRICE_DATE;



----------------------------------------------------------------------------
CREATE OR REPLACE TABLE BTC_DATA.DATA.BTC_PRICE_MOVEMENT AS
WITH price_changes AS (
    SELECT 
        TIMESTAMP,
        DATE,
        BTC_PRICE_USD,
        LAG(BTC_PRICE_USD) OVER (ORDER BY DATE) AS previous_price
    FROM BTC_DATA.DATA.BTC_PRICE_USD
)
SELECT 
    TIMESTAMP,
    DATE,
    BTC_PRICE_USD,
    CASE 
        WHEN previous_price IS NULL THEN NULL  -- No comparison for the first row
        WHEN BTC_PRICE_USD > previous_price * 1.005 THEN 1  -- Increase beyond 0.5%
        WHEN BTC_PRICE_USD < previous_price * 0.995 THEN -1  -- Decrease beyond 0.5%
        ELSE 0  -- Within the ±0.5% range, considered unchanged
    END AS PRICE_MOVEMENT
FROM price_changes;


CREATE OR REPLACE TABLE BTC_DATA.DATA.TX_BANDS AS
 SELECT
    CAST(BLOCK_TIMESTAMP AS DATE) AS TX_DATE,
    COUNT(CASE WHEN (OUTPUT_VALUE_SATS / 100000000.0) > 1 THEN 1 END) AS TX_GT_1_BTC,
    COUNT(CASE WHEN (OUTPUT_VALUE_SATS / 100000000.0) > 10 THEN 1 END) AS TX_GT_10_BTC,
    COUNT(CASE WHEN (OUTPUT_VALUE_SATS / 100000000.0) > 100 THEN 1 END) AS TX_GT_100_BTC,
    COUNT(CASE WHEN (OUTPUT_VALUE_SATS / 100000000.0) > 1000 THEN 1 END) AS TX_GT_1000_BTC,
    COUNT(CASE WHEN (OUTPUT_VALUE_SATS / 100000000.0) > 10000 THEN 1 END) AS TX_GT_10000_BTC,
    COUNT(CASE WHEN (OUTPUT_VALUE_SATS / 100000000.0) > 100000 THEN 1 END) AS TX_GT_100000_BTC
FROM BITCOIN_ONCHAIN_CORE_DATA.CORE.FACT_TRANSACTIONS
GROUP BY CAST(BLOCK_TIMESTAMP AS DATE)
ORDER BY TX_DATE;





























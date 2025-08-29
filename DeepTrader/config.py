import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Snowflake Configuration
SNOWFLAKE_CONFIG = {
    "account": os.getenv("SNOWFLAKE_ACCOUNT"),
    "user": os.getenv("SNOWFLAKE_USER"),
    "password": os.getenv("SNOWFLAKE_PASSWORDS"),
    "role": os.getenv("SNOWFLAKE_ROLE"),
    "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE"),
    "database": os.getenv("SNOWFLAKE_DATABASE"),
    "schema": os.getenv("SNOWFLAKE_SCHEMA")
}

# Model Configuration
MODEL_CONFIG = {
    "lookback_window": 720,  # 30 days * 24 hours
    "action_space_size": 3,  # sell, hold, buy
    "hidden_dim": 512,
    "learning_rate": 1e-4,
    "gamma": 0.99,
    "epsilon_start": 1.0,
    "epsilon_end": 0.01,
    "epsilon_decay": 0.99995,
    "memory_size": 100000,
    "batch_size": 128,
    "target_update_freq": 100,
    "max_episodes": 200,
    "eval_frequency": 10,
    "dashboard_update_freq": 10,
    "episode_length": 10000,  # Length of random training episodes
}

# Data Configuration
DATA_CONFIG = {
    "train_split": 0.8,
    "eval_split": 0.1,
    "test_split": 0.1,
    "volatility_window": 30 * 24,  # 30 days in hours
    "max_position_hold": 30 * 24,  # Maximum 30 days without action
}

# Trading Configuration
TRADING_CONFIG = {
    "initial_balance": 1000,
    "transaction_cost": 0.001,  # 0.1% per trade
    "actions": {
        0: "sell",
        1: "hold", 
        2: "buy"
    }
} 
# DQN Bitcoin Trading System 🚀

A comprehensive Deep Q-Network (DQN) implementation for hourly Bitcoin trading using real-time data from Snowflake. This system is designed for high-frequency trading with a focus on consistent returns and minimal drawdowns.

## 🎯 Project Overview

This project implements a sophisticated reinforcement learning agent that learns to trade Bitcoin by:
- Analyzing 92,000+ hours of historical BTC data
- Making decisions every hour (high-frequency trading)
- Optimizing for consistent returns with minimal risk
- Comparing performance against Buy & Hold strategy

## 🏗️ Architecture

### Core Components

1. **Data Pipeline** (`data_pipeline.py`)
   - Connects to Snowflake database
   - Imports and preprocesses Bitcoin hourly data
   - Adds technical indicators and volatility features
   - Handles outliers and data normalization

2. **DQN Model** (`dqn_model.py`)
   - Dueling DQN architecture with experience replay
   - Double DQN for stable Q-value estimation
   - Adaptive epsilon-greedy exploration
   - Memory management and gradient clipping

3. **Trading Environment** (`trading_environment.py`)
   - Realistic trading simulation with transaction costs
   - Portfolio management and performance tracking
   - Reward function optimized for consistent returns
   - Action space: Sell All, Hold, Buy All

4. **Visualization** (`visualization.py`)
   - Real-time training progress monitoring
   - Performance comparison charts
   - Interactive dashboards with Plotly
   - Episode-by-episode analysis

5. **Main System** (`main.py`)
   - Orchestrates training, evaluation, and testing
   - Progress tracking with progress bars
   - Model saving and performance optimization

## 📊 Features

### Data Processing
- **Technical Indicators**: SMA, EMA, MACD, RSI, Bollinger Bands, Stochastic Oscillator
- **Volume Indicators**: Volume SMA, Money Flow Index
- **Volatility Metrics**: ATR, 30-day rolling volatility
- **Price Features**: Returns, ratios, and normalized prices

### Model Architecture
- **Dueling DQN**: Separates value and advantage estimation
- **Experience Replay**: 100,000 memory capacity
- **Double DQN**: Reduces Q-value overestimation
- **Target Network**: Stable learning with periodic updates

### Trading Strategy
- **Action Space**: 3 actions (Sell All, Hold, Buy All)
- **Lookback Window**: 30 days (720 hours) of historical data
- **Transaction Costs**: 0.1% per trade
- **Risk Management**: Penalties for excessive holding periods

### Performance Metrics
- **Returns**: Total return, annualized returns
- **Risk Metrics**: Sharpe ratio, maximum drawdown, volatility
- **Trading Metrics**: Win rate, number of trades, profit factor

### Action Space & Constraints

The system uses a constrained action space to ensure realistic trading:

- **Actions**: `sell` (0), `hold` (1), `buy` (2)
- **Smart Constraints**: 
  - Cannot perform consecutive buy actions without selling first
  - Cannot perform consecutive sell actions without buying first
  - Hold actions do not affect the constraint state
  - Invalid actions are penalized and automatically converted to hold
- **Action Masking**: DQN agent uses Q-value masking to learn valid action selection
- **Realistic Trading**: Prevents impossible scenarios like selling with no BTC or buying with no cash


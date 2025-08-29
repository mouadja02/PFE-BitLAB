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

## 🚀 Quick Start

### Prerequisites

```bash
pip install -r requirements.txt
```

### Configuration

Update `config.py` with your Snowflake credentials:

```python
SNOWFLAKE_CONFIG = {
    "account": "YOUR_ACCOUNT",
    "user": "YOUR_USER",
    "password": "YOUR_PASSWORD",
    "role": "SYSADMIN",
    "warehouse": "YOUR_WAREHOUSE",
    "database": "BTC_DATA",
    "schema": "DATA"
}
```

### Run Training

```bash
python main.py
```

## 📈 Data Splits

- **Training**: 80% (First ~73,600 hours)
- **Evaluation**: 10% (Next ~9,200 hours) 
- **Testing**: 10% (Last ~9,200 hours)

## 🎯 Training Process

### Episode Structure
1. **Training Episodes**: Agent learns on training data
2. **Evaluation**: Every 10 episodes on validation set
3. **Visualization**: Episode performance charts
4. **Dashboard Updates**: Every 20 episodes

### Learning Schedule
- **Episodes**: 200 total
- **Epsilon Decay**: 1.0 → 0.01 (exploration → exploitation)
- **Target Network Updates**: Every 1,000 steps
- **Model Saving**: Best performing model on evaluation set

## 📊 Performance Monitoring

### Real-time Metrics
- Portfolio value evolution
- Action distribution
- Reward accumulation
- Trading frequency
- Win rate progression

### Visualizations Generated
- `episode_X_performance.png`: Individual episode analysis
- `training_progress.png`: Training metrics over time
- `evaluation_results.png`: Validation performance
- `interactive_dashboard.html`: Interactive monitoring

## 🎛️ Hyperparameters

```python
MODEL_CONFIG = {
    "lookback_window": 720,      # 30 days in hours
    "action_space_size": 3,      # Sell, Hold, Buy
    "hidden_dim": 512,           # Neural network hidden size
    "learning_rate": 1e-4,       # Adam optimizer learning rate
    "gamma": 0.99,               # Discount factor
    "epsilon_start": 1.0,        # Initial exploration rate
    "epsilon_end": 0.01,         # Final exploration rate
    "epsilon_decay": 0.995,      # Exploration decay rate
    "memory_size": 100000,       # Experience replay buffer
    "batch_size": 64,            # Training batch size
    "target_update_freq": 1000,  # Target network update frequency
}
```

## 💰 Trading Configuration

```python
TRADING_CONFIG = {
    "initial_balance": 10000,    # Starting portfolio value
    "transaction_cost": 0.001,   # 0.1% transaction fee
    "actions": {
        0: "sell",           # Liquidate all BTC positions
        1: "hold",               # No action
        2: "buy"             # Use all cash to buy BTC
    }
}
```

## 🎯 Reward Function

The reward function is designed to encourage:
- **Positive returns** with scaled rewards
- **Risk management** with volatility penalties
- **Trading activity** with action bonuses
- **Loss avoidance** with heavy loss penalties
- **Consistent trading** with holding period limits

## 📁 Project Structure

```
DeepTraderQ2/
├── main.py                 # Main training loop
├── config.py              # Configuration settings
├── data_pipeline.py       # Data import and preprocessing
├── dqn_model.py          # DQN agent and neural network
├── trading_environment.py # Trading simulation environment
├── visualization.py       # Plotting and dashboard tools
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── data/                 # Data storage
│   ├── raw_btc_data.csv
│   └── preprocessed_btc_data.csv
├── models/               # Saved models
│   └── best_dqn_model.pth
├── plots/                # Generated visualizations
│   ├── episode_X_performance.png
│   ├── training_progress.png
│   ├── evaluation_results.png
│   └── interactive_dashboard.html
└── logs/                 # Training logs
```

## 🔧 Technical Indicators Used

### Trend Indicators
- **SMA 20**: 20-period Simple Moving Average
- **EMA 12/26**: Exponential Moving Averages
- **MACD**: Moving Average Convergence Divergence

### Momentum Indicators
- **RSI**: Relative Strength Index (14-period)
- **Stochastic**: %K and %D oscillators

### Volatility Indicators
- **Bollinger Bands**: Upper, lower bands and bandwidth
- **ATR**: Average True Range
- **30-day Volatility**: Rolling volatility measures

### Volume Indicators
- **Volume SMA**: 20-period volume moving average
- **MFI**: Money Flow Index

## 🚀 Real-World Deployment

This system is designed for real-world deployment with:
- **Modular architecture** for easy integration
- **Configurable parameters** for different markets
- **Robust error handling** and logging
- **Performance monitoring** and alerting
- **Model versioning** and rollback capabilities

## 📈 Expected Performance

The system aims to achieve:
- **Positive Returns**: Outperform Buy & Hold strategy
- **Risk Management**: Sharpe ratio > 1.0
- **Low Drawdowns**: Maximum drawdown < 20%
- **High Activity**: Trade at least every 30 days
- **Consistency**: Win rate > 50%

## 🛠️ Customization

### Adding New Features
1. Extend `data_pipeline.py` for new technical indicators
2. Modify `trading_environment.py` for new reward functions
3. Update `config.py` for new hyperparameters

### Different Markets
1. Update data source in `data_pipeline.py`
2. Adjust feature engineering for market specifics
3. Modify reward function for market characteristics

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes only. Trading cryptocurrencies involves substantial risk of loss. Past performance does not guarantee future results. Always conduct your own research and consider consulting with a financial advisor before making investment decisions.

## 📞 Support

For questions and support:
- Create an issue on GitHub
- Review the documentation
- Check the configuration settings

## 🔥 Key Features

- **Real-time Snowflake Integration**: Live Bitcoin hourly data import
- **Advanced Technical Analysis**: 26+ technical indicators using TA library
- **Sophisticated DQN Architecture**: Dueling DQN with Double DQN and experience replay
- **Realistic Trading Simulation**: Transaction costs, portfolio tracking, risk management
- **Action Constraints**: Prevents consecutive buy/sell actions without opposite action
- **Random Frame Training**: Trains on random market segments for better generalization
- **Comprehensive Evaluation**: Multiple performance metrics and comparisons
- **Interactive Visualizations**: Real-time dashboards and progress tracking
- **Production Ready**: Robust error handling, logging, and model persistence

---

**Built with ❤️ for the crypto trading community** 
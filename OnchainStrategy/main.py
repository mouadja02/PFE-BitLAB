import os
import datetime
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle
import mplfinance as mpf
import argparse

from utils import load_data_from_snowflake

# Define default parameters
DEFAULT_MA_LENGTH = 220
DEFAULT_ZSCORE_LOOKBACK = 200
DEFAULT_LONG_THRESHOLD = 0.26
DEFAULT_SHORT_THRESHOLD = -0.62
DEFAULT_OVERBOUGHT_THRESHOLD = 3.0
DEFAULT_OVERSOLD_THRESHOLD = -2.0

def calculate_mvrv_zscore(df, ma_type='WMA', ma_length=DEFAULT_MA_LENGTH, lookback=DEFAULT_ZSCORE_LOOKBACK):
    """
    Calculate MVRV Z-Score
    
    Args:
        df: DataFrame with MVRV column
        ma_type: Type of moving average (WMA, EMA, etc.)
        ma_length: Length of moving average
        lookback: Lookback period for Z-Score calculation
    
    Returns:
        DataFrame with Z-Score
    """
    # Ensure we have MVRV column
    if 'MVRV' not in df.columns:
        raise ValueError("MVRV column not found in the dataframe")
    
    # Calculate moving average based on specified type
    if ma_type == 'EMA':
        df['MVRV_MA'] = df['MVRV'].ewm(span=ma_length, adjust=False).mean()
    elif ma_type == 'DEMA':
        ema1 = df['MVRV'].ewm(span=ma_length, adjust=False).mean()
        ema2 = ema1.ewm(span=ma_length, adjust=False).mean()
        df['MVRV_MA'] = 2 * ema1 - ema2
    else:
        weights = np.arange(1, ma_length + 1)
        df['MVRV_MA'] = df['MVRV'].rolling(window=ma_length).apply(
            lambda x: np.sum(weights * x) / weights.sum(), raw=True)
    
    # Calculate standard deviation
    df['MVRV_STD'] = df['MVRV'].rolling(window=lookback).std()
    
    # Calculate Z-Score
    df['MVRV_ZSCORE'] = (df['MVRV'] - df['MVRV_MA']) / df['MVRV_STD']
    
    return df

def calculate_nupl_zscore(df, ma_type='WMA', ma_length=DEFAULT_MA_LENGTH, lookback=DEFAULT_ZSCORE_LOOKBACK):
    """
    Calculate NUPL Z-Score
    
    Args:
        df: DataFrame with NUPL column
        ma_type: Type of moving average (WMA, EMA, etc.)
        ma_length: Length of moving average
        lookback: Lookback period for Z-Score calculation
    
    Returns:
        DataFrame with Z-Score
    """
    # Ensure we have NUPL column
    if 'NUPL' not in df.columns:
        raise ValueError("NUPL column not found in the dataframe")
    
    # Calculate moving average based on specified type
    if ma_type == 'EMA':
        df['NUPL_MA'] = df['NUPL'].ewm(span=ma_length, adjust=False).mean()
    elif ma_type == 'DEMA':
        ema1 = df['NUPL'].ewm(span=ma_length, adjust=False).mean()
        ema2 = ema1.ewm(span=ma_length, adjust=False).mean()
        df['NUPL_MA'] = 2 * ema1 - ema2
    else :  # ma_type == 'WMA'
        weights = np.arange(1, ma_length + 1)
        df['NUPL_MA'] = df['NUPL'].rolling(window=ma_length).apply(
            lambda x: np.sum(weights * x) / weights.sum(), raw=True)
    
    # Calculate standard deviation
    df['NUPL_STD'] = df['NUPL'].rolling(window=lookback).std()
    
    # Calculate Z-Score
    df['NUPL_ZSCORE'] = (df['NUPL'] - df['NUPL_MA']) / df['NUPL_STD']
    
    return df

def calculate_combined_signal(df, method='average', mvrv_weight=0.5, nupl_weight=0.5):
    """
    Calculate combined Z-Score from MVRV and NUPL Z-Scores
    
    Args:
        df: DataFrame with both MVRV_ZSCORE and NUPL_ZSCORE
        method: Method to combine scores ('average', 'weighted', 'consensus')
        mvrv_weight: Weight for MVRV Z-Score when method='weighted'
        nupl_weight: Weight for NUPL Z-Score when method='weighted'
    
    Returns:
        DataFrame with combined Z-Score
    """
    # Ensure we have both Z-Scores
    if 'MVRV_ZSCORE' not in df.columns:
        raise ValueError("MVRV_ZSCORE column not found in the dataframe")
    if 'NUPL_ZSCORE' not in df.columns:
        raise ValueError("NUPL_ZSCORE column not found in the dataframe")
    
    # Calculate combined Z-Score based on method
    if method == 'average':
        df['COMBINED_ZSCORE'] = (df['MVRV_ZSCORE'] + df['NUPL_ZSCORE']) / 2
    elif method == 'weighted':
        # Normalize weights
        total_weight = mvrv_weight + nupl_weight
        mvrv_weight = mvrv_weight / total_weight
        nupl_weight = nupl_weight / total_weight
        
        df['COMBINED_ZSCORE'] = (df['MVRV_ZSCORE'] * mvrv_weight) + (df['NUPL_ZSCORE'] * nupl_weight)
    elif method == 'consensus':
        # Signal only when both metrics agree on direction
        # Use element-wise operations to avoid ambiguous truth value error
        conditions = [
            (df['MVRV_ZSCORE'] > 0) & (df['NUPL_ZSCORE'] > 0),
            (df['MVRV_ZSCORE'] < 0) & (df['NUPL_ZSCORE'] < 0)
        ]
        choices = [
            (df['MVRV_ZSCORE'] + df['NUPL_ZSCORE']) / 2,
            (df['MVRV_ZSCORE'] + df['NUPL_ZSCORE']) / 2
        ]
        default = 0
        
        # Use numpy.select for multiple conditions
        df['COMBINED_ZSCORE'] = np.select(conditions, choices, default)
    else:
        # Default to average if method not recognized
        df['COMBINED_ZSCORE'] = (df['MVRV_ZSCORE'] + df['NUPL_ZSCORE']) / 2
    
    return df

def generate_signals(df, long_threshold=DEFAULT_LONG_THRESHOLD, short_threshold=DEFAULT_SHORT_THRESHOLD, z_score_col='COMBINED_ZSCORE'):
    """
    Generate trading signals based on Z-Score crossing thresholds
    """
    # Make a copy to avoid the SettingWithCopyWarning
    df = df.copy()
    
    # Initialize signals column
    df['SIGNAL'] = 0  # 0: no signal, 1: long (buy), -1: short (sell)
    
    # Track current position (0: not in position, 1: in position)
    current_position = 0
    
    # Generate signals when Z-Score crosses thresholds
    for i in range(1, len(df)):
        # Buy signal: Z-Score crosses above long threshold and we're not already in a position
        if df[z_score_col].iloc[i-1] <= long_threshold and df[z_score_col].iloc[i] > long_threshold and current_position == 0:
            df.loc[df.index[i], 'SIGNAL'] = 1
            current_position = 1
        
        # Sell signal: Z-Score crosses below short threshold and we're in a position
        elif df[z_score_col].iloc[i-1] >= short_threshold and df[z_score_col].iloc[i] < short_threshold and current_position == 1:
            df.loc[df.index[i], 'SIGNAL'] = -1
            current_position = 0
    
    # Create position column (1: holding BTC, 0: not holding BTC)
    df['POSITION'] = 0
    position = 0
    
    for i in range(len(df)):
        if df['SIGNAL'].iloc[i] == 1:  # Buy signal
            position = 1
        elif df['SIGNAL'].iloc[i] == -1:  # Sell signal
            position = 0
            
        df.loc[df.index[i], 'POSITION'] = position
    
    return df

def backtest_strategy(df, initial_capital=1000):
    """
    Backtest the combined Z-Score strategy and calculate returns
    """
    # Make a copy of the dataframe to avoid modifying the original
    bt_df = df.copy()
    
    # Use CLOSE as the price column if available
    if 'CLOSE' in bt_df.columns:
        bt_df['PRICE'] = bt_df['CLOSE']
    elif 'BTC_PRICE' in bt_df.columns:
        bt_df['PRICE'] = bt_df['BTC_PRICE']
    elif 'PRICE' not in bt_df.columns:
        raise ValueError("No price column (PRICE, CLOSE, or BTC_PRICE) found in the dataframe")
    
    # Initialize portfolio and buy & hold columns with explicit float dtype
    bt_df['PORTFOLIO_VALUE'] = pd.Series([float(initial_capital)] * len(bt_df), index=bt_df.index)
    bt_df['BUY_HOLD_VALUE'] = pd.Series([float(initial_capital)] * len(bt_df), index=bt_df.index)
    
    # Calculate buy & hold strategy (assuming we buy at the first available price)
    initial_btc = initial_capital / bt_df['PRICE'].iloc[0]
    bt_df['BUY_HOLD_VALUE'] = initial_btc * bt_df['PRICE']
    
    # Calculate strategy returns
    position = 0  # 0: not holding BTC, 1: holding BTC
    btc_held = 0
    cash = initial_capital
    
    for i in range(1, len(bt_df)):
        # Update portfolio value based on previous position
        if position == 1:  # Holding BTC
            bt_df.loc[bt_df.index[i], 'PORTFOLIO_VALUE'] = float(btc_held * bt_df['PRICE'].iloc[i])
        else:  # Not holding BTC (in cash)
            bt_df.loc[bt_df.index[i], 'PORTFOLIO_VALUE'] = float(cash)
        
        # Check for new signals
        if bt_df['SIGNAL'].iloc[i] == 1 and position == 0:  # Buy signal
            position = 1
            btc_held = cash / bt_df['PRICE'].iloc[i]
            cash = 0
        elif bt_df['SIGNAL'].iloc[i] == -1 and position == 1:  # Sell signal
            position = 0
            cash = btc_held * bt_df['PRICE'].iloc[i]
            btc_held = 0
    
    # Calculate performance metrics
    bt_df['STRATEGY_RETURNS'] = bt_df['PORTFOLIO_VALUE'].pct_change()
    bt_df['BUY_HOLD_RETURNS'] = bt_df['BUY_HOLD_VALUE'].pct_change()
    
    # Cumulative returns
    bt_df['STRATEGY_CUM_RETURNS'] = (1 + bt_df['STRATEGY_RETURNS'].fillna(0)).cumprod() - 1
    bt_df['BUY_HOLD_CUM_RETURNS'] = (1 + bt_df['BUY_HOLD_RETURNS'].fillna(0)).cumprod() - 1
    
    return bt_df

def plot_strategy(df, overbought_threshold=DEFAULT_OVERBOUGHT_THRESHOLD, 
                 oversold_threshold=DEFAULT_OVERSOLD_THRESHOLD, z_score_col='COMBINED_ZSCORE'):
    """
    Plot the strategy results with candlestick chart and signals
    """
    # Prepare data for mplfinance
    df_plot = df.copy()
    df_plot.index = pd.to_datetime(df_plot.index)
    
    # Check if we have OHLC data
    has_ohlc = all(col in df_plot.columns for col in ['OPEN', 'HIGH', 'LOW', 'CLOSE'])
    
    if not has_ohlc:
        if 'PRICE' in df_plot.columns:
            price_col = 'PRICE'
        elif 'BTC_PRICE' in df_plot.columns:
            price_col = 'BTC_PRICE'
        else:
            raise ValueError("No price column found for plotting")
        
        # Create OHLC data from price
        df_plot['Open'] = df_plot[price_col]
        df_plot['High'] = df_plot[price_col]
        df_plot['Low'] = df_plot[price_col]
        df_plot['Close'] = df_plot[price_col]
    else:
        # Use existing OHLC data
        df_plot['Open'] = df_plot['OPEN']
        df_plot['High'] = df_plot['HIGH']
        df_plot['Low'] = df_plot['LOW']
        df_plot['Close'] = df_plot['CLOSE']
    
    # Create figure with subplots
    fig, (ax1, ax2, ax3, ax4) = plt.subplots(4, 1, figsize=(14, 16), gridspec_kw={'height_ratios': [3, 1, 1, 1]})
    
    # Plot candlestick chart
    mpf.plot(df_plot, type='candle', style='charles', ax=ax1, volume=False)
    
    # Set log scale for price axis
    ax1.set_yscale('log')
    ax1.set_title('BTC Price (Log Scale)', fontsize=12)
    
    # Color candlesticks based on position
    for i in range(len(df_plot)):
        if df_plot['POSITION'].iloc[i] == 1:  # Holding BTC
            color = '#00ffdd'  # teal
        elif df_plot['POSITION'].iloc[i] == 0:  # In cash
            color = '#ff00bf'  # magenta
        else:
            continue
            
        rect = Rectangle((i-0.4, df_plot['Low'].iloc[i]), 0.8, 
                        df_plot['High'].iloc[i] - df_plot['Low'].iloc[i],
                        facecolor=color, alpha=0.3)
        ax1.add_patch(rect)
    
    # Plot signals
    for i in range(len(df_plot)):
        if df_plot['SIGNAL'].iloc[i] == 1:  # Buy signal
            ax1.scatter(i, df_plot['Low'].iloc[i] * 0.98, marker='^', color='green', s=100)
        elif df_plot['SIGNAL'].iloc[i] == -1:  # Sell signal
            ax1.scatter(i, df_plot['High'].iloc[i] * 1.02, marker='v', color='red', s=100)
    
    # Plot Combined Z-Score in second subplot
    ax2.plot(df_plot[z_score_col], color='purple', linewidth=2)
    ax2.axhline(y=DEFAULT_LONG_THRESHOLD, color='green', linestyle='--', alpha=0.7)
    ax2.axhline(y=DEFAULT_SHORT_THRESHOLD, color='red', linestyle='--', alpha=0.7)
    ax2.axhline(y=overbought_threshold, color='red', linestyle='-', alpha=0.5)
    ax2.axhline(y=oversold_threshold, color='green', linestyle='-', alpha=0.5)
    ax2.fill_between(range(len(df_plot)), overbought_threshold, df_plot[z_score_col], 
                    where=(df_plot[z_score_col] > overbought_threshold), 
                    color='#ff00bf', alpha=0.3)
    ax2.fill_between(range(len(df_plot)), oversold_threshold, df_plot[z_score_col],
                    where=(df_plot[z_score_col] < oversold_threshold), 
                    color='#00ffdd', alpha=0.3)
    ax2.set_ylabel('Combined Z-Score')
    
    # Plot individual Z-Scores in third subplot
    if 'MVRV_ZSCORE' in df_plot.columns and 'NUPL_ZSCORE' in df_plot.columns:
        ax3.plot(df_plot['MVRV_ZSCORE'], color='blue', label='MVRV Z-Score', linewidth=1.5)
        ax3.plot(df_plot['NUPL_ZSCORE'], color='green', label='NUPL Z-Score', linewidth=1.5)
        ax3.axhline(y=0, color='gray', linestyle='-', alpha=0.5)
        ax3.set_ylabel('Individual Z-Scores')
        ax3.legend(loc='upper right')
    
    # Plot portfolio performance in fourth subplot
    ax4.plot(df_plot['PORTFOLIO_VALUE'], label='Strategy', color='#00ffdd')  # Teal for strategy
    ax4.plot(df_plot['BUY_HOLD_VALUE'], label='Buy & Hold', color='#ff00bf', linestyle='--')  # Magenta for buy & hold
    ax4.set_ylabel('Portfolio Value ($)')
    ax4.legend()
    
    # Set title and adjust layout
    fig.suptitle('BTC Combined MVRV-NUPL Z-Score Trading Strategy', fontsize=16)
    
    # Fix x-axis dates for all subplots
    date_range = df_plot.index
    min_date = date_range.min().strftime('%Y-%m-%d')
    max_date = date_range.max().strftime('%Y-%m-%d')
    
    # Create a cleaner x-axis with proper date formatting
    for ax in [ax1, ax2, ax3, ax4]:
        # Set the limits to the actual data range
        ax.set_xlim(0, len(df_plot) - 1)
        
        # Hide the default x-tick labels for all but the bottom subplot
        if ax != ax4:
            plt.setp(ax.get_xticklabels(), visible=False)
    
    plt.tight_layout()
    plt.subplots_adjust(top=0.95)
    
    return fig

def print_performance_summary(df):
    """
    Print a performance summary of the backtest
    """
    initial_value = df['PORTFOLIO_VALUE'].iloc[0]
    final_value = df['PORTFOLIO_VALUE'].iloc[-1]
    buy_hold_final = df['BUY_HOLD_VALUE'].iloc[-1]
    
    # Calculate returns
    total_return = (final_value / initial_value - 1) * 100
    buy_hold_return = (buy_hold_final / initial_value - 1) * 100
    outperformance = total_return - buy_hold_return
    
    # Count trades
    trades = (df['SIGNAL'] != 0).sum()
    buy_trades = (df['SIGNAL'] == 1).sum()
    sell_trades = (df['SIGNAL'] == -1).sum()
    
    # Calculate Sharpe ratio (annualized)
    daily_returns = df['STRATEGY_RETURNS'].fillna(0)
    sharpe_ratio = np.sqrt(252) * (daily_returns.mean() / daily_returns.std()) if daily_returns.std() > 0 else 0
    
    # Calculate max drawdown
    portfolio_values = df['PORTFOLIO_VALUE'].values
    max_drawdown = 0
    peak = portfolio_values[0]
    
    for value in portfolio_values:
        if value > peak:
            peak = value
        drawdown = (peak - value) / peak * 100
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    # Calculate win rate and profit factor
    # Identify completed trades (buy followed by sell)
    buy_indices = df[df['SIGNAL'] == 1].index
    sell_indices = df[df['SIGNAL'] == -1].index
    
    profit_trades = 0
    loss_trades = 0
    total_profit = 0
    total_loss = 0
    
    current_buy_idx = None
    
    # Match buy/sell pairs and calculate metrics
    for idx in sorted(df.index):
        if idx in buy_indices:
            current_buy_idx = idx
        elif idx in sell_indices and current_buy_idx is not None:
            buy_price = df.loc[current_buy_idx, 'PRICE']
            sell_price = df.loc[idx, 'PRICE']
            pnl_pct = (sell_price / buy_price - 1) * 100
            
            if pnl_pct > 0:
                profit_trades += 1
                total_profit += pnl_pct
            else:
                loss_trades += 1
                total_loss += pnl_pct
            
            current_buy_idx = None
    
    completed_trades = profit_trades + loss_trades
    if completed_trades > 0:
        win_rate = (profit_trades / completed_trades) * 100
    else:
        win_rate = 0
        
    if abs(total_loss) > 0:
        profit_factor = abs(total_profit) / abs(total_loss)
    else:
        profit_factor = float('inf') if total_profit > 0 else 0
    
    # Print summary
    print("\n=== BACKTEST PERFORMANCE SUMMARY ===")
    print(f"Initial Capital: ${initial_value:.2f}")
    print(f"Final Portfolio Value: ${final_value:.2f}")
    print(f"Buy & Hold Final Value: ${buy_hold_final:.2f}")
    print(f"Total Return: {total_return:.2f}%")
    print(f"Buy & Hold Return: {buy_hold_return:.2f}%")
    print(f"Strategy Outperformance: {outperformance:.2f}%")
    print(f"Sharpe Ratio: {sharpe_ratio:.2f}")
    print(f"Maximum Drawdown: {max_drawdown:.2f}%")
    print(f"Total Trades: {trades}")
    print(f"Buy Signals: {buy_trades}")
    print(f"Sell Signals: {sell_trades}")
    print(f"Completed Trades: {completed_trades}")
    print(f"Win Rate: {win_rate:.2f}%")
    print(f"Profit Factor: {profit_factor:.2f}")
    
    return {
        'initial_value': initial_value,
        'final_value': final_value,
        'buy_hold_final': buy_hold_final,
        'total_return': total_return,
        'buy_hold_return': buy_hold_return,
        'outperformance': outperformance,
        'sharpe_ratio': sharpe_ratio,
        'max_drawdown': max_drawdown,
        'trades': trades,
        'buy_trades': buy_trades,
        'sell_trades': sell_trades,
        'completed_trades': completed_trades,
        'win_rate': win_rate,
        'profit_factor': profit_factor
    }

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='BTC Combined MVRV-NUPL Z-Score Strategy')
    
    parser.add_argument('--ma-type', type=str, default='WMA', choices=['WMA', 'DEMA', 'EMA'],
                        help='Type of moving average to use')
    parser.add_argument('--ma-length', type=int, default=DEFAULT_MA_LENGTH,
                        help='Moving average length')
    parser.add_argument('--zscore-lookback', type=int, default=DEFAULT_ZSCORE_LOOKBACK,
                        help='Lookback period for Z-Score calculation')
    parser.add_argument('--long-threshold', type=float, default=DEFAULT_LONG_THRESHOLD,
                        help='Long (buy) threshold for Z-Score')
    parser.add_argument('--short-threshold', type=float, default=DEFAULT_SHORT_THRESHOLD,
                        help='Short (sell) threshold for Z-Score')
    parser.add_argument('--overbought', type=float, default=DEFAULT_OVERBOUGHT_THRESHOLD,
                        help='Overbought threshold for visualization')
    parser.add_argument('--oversold', type=float, default=DEFAULT_OVERSOLD_THRESHOLD,
                        help='Oversold threshold for visualization')
    parser.add_argument('--initial-capital', type=float, default=1000,
                        help='Initial capital for backtest')
    parser.add_argument('--combine-method', type=str, default='average', 
                        choices=['average', 'weighted', 'consensus'],
                        help='Method to combine MVRV and NUPL Z-Scores')
    parser.add_argument('--mvrv-weight', type=float, default=0.5, 
                        help='Weight for MVRV Z-Score when using weighted method')
    parser.add_argument('--nupl-weight', type=float, default=0.5,
                        help='Weight for NUPL Z-Score when using weighted method')
    
    args = parser.parse_args()
    
    # Load data
    print("Loading BTC data...")
    try:
        # First try to load from local CSV to avoid Snowflake query
        df = pd.read_csv('btc_data.csv', parse_dates=['DATE'])
        df.set_index('DATE', inplace=True)
        print("Data loaded from local CSV file")
    except Exception as e:
        print(f"Failed to load from CSV: {e}")
        print("Attempting to load from Snowflake...")
        df = load_data_from_snowflake(save_csv=True)
        print("Data loaded from Snowflake")
    
    # Calculate MVRV Z-Score
    print("Calculating MVRV Z-Score...")
    df = calculate_mvrv_zscore(
        df, 
        ma_type=args.ma_type, 
        ma_length=args.ma_length,
        lookback=args.zscore_lookback
    )
    
    # Calculate NUPL Z-Score
    print("Calculating NUPL Z-Score...")
    df = calculate_nupl_zscore(
        df, 
        ma_type=args.ma_type, 
        ma_length=args.ma_length,
        lookback=args.zscore_lookback
    )
    
    # Calculate combined Z-Score
    print(f"Calculating combined Z-Score using {args.combine_method} method...")
    df = calculate_combined_signal(
        df,
        method=args.combine_method,
        mvrv_weight=args.mvrv_weight,
        nupl_weight=args.nupl_weight
    )
    
    # Generate signals
    print("Generating trading signals...")
    df = generate_signals(
        df,
        long_threshold=args.long_threshold,
        short_threshold=args.short_threshold,
        z_score_col='COMBINED_ZSCORE'
    )
    
    # Run backtest
    print("Running backtest...")
    df = backtest_strategy(df, initial_capital=args.initial_capital)
    
    # Print performance summary
    metrics = print_performance_summary(df)
    
    # Plot strategy results
    print("Plotting strategy results...")
    fig = plot_strategy(
        df,
        overbought_threshold=args.overbought,
        oversold_threshold=args.oversold,
        z_score_col='COMBINED_ZSCORE'
    )
    
    # Show plot
    plt.show()
    
    return df, metrics

if __name__ == '__main__':
    main() 
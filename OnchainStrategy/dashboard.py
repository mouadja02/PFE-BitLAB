import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import mplfinance as mpf
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import datetime
from sklearn.model_selection import ParameterGrid
import itertools
import altair as alt
from datetime import timedelta
from utils import load_data_from_snowflake
from main import (
    calculate_mvrv_zscore,
    calculate_nupl_zscore,
    calculate_combined_signal,
    generate_signals,
    backtest_strategy,
    DEFAULT_MA_LENGTH,
    DEFAULT_ZSCORE_LOOKBACK,
    DEFAULT_LONG_THRESHOLD,
    DEFAULT_SHORT_THRESHOLD,
    DEFAULT_OVERBOUGHT_THRESHOLD,
    DEFAULT_OVERSOLD_THRESHOLD
)
import json

# Advanced optimization imports
try:
    from skopt import gp_minimize, forest_minimize, gbrt_minimize
    from skopt.space import Real, Integer, Categorical
    from skopt.utils import use_named_args
    from skopt.acquisition import gaussian_ei
    BAYESIAN_AVAILABLE = True
except ImportError:
    BAYESIAN_AVAILABLE = False
    st.warning("scikit-optimize not available. Install with: pip install scikit-optimize")

try:
    from deap import algorithms, base, creator, tools
    import random
    GA_AVAILABLE = True
except ImportError:
    GA_AVAILABLE = False
    st.warning("DEAP not available for Genetic Algorithm. Install with: pip install deap")

# Alternative implementation using simple GA if DEAP is not available
import concurrent.futures
from functools import partial

# Set page configuration
st.set_page_config(
    layout="wide", 
    page_title="BTC MVRV-NUPL Combined Strategy Dashboard"
)

# Define custom color scheme
def get_theme_colors():
    """Get colors based on current theme"""
    # Try to detect theme - this is a simplified approach
    # In practice, Streamlit doesn't provide direct theme detection
    # So we'll create a more neutral color scheme that works in both themes
    return {
        "background": "rgba(0,0,0,0)",  # Transparent background
        "text": "inherit",  # Use theme's text color
        "primary": "#00D4AA",  # Teal - works in both themes
        "secondary": "#FF6B6B",  # Red-pink - works in both themes  
        "neutral": "#4F8BF9",  # Blue - works in both themes
        "grid": "rgba(128,128,128,0.1)",  # Semi-transparent gray
        "accent": "#FFA500",  # Orange - works in both themes
        "green": "#28A745",  # Bootstrap green - works in both themes
        "red": "#DC3545",   # Bootstrap red - works in both themes
        "card_bg": "rgba(128,128,128,0.1)",  # Semi-transparent for cards
        "border": "rgba(128,128,128,0.2)"  # Semi-transparent borders
    }

COLORS = get_theme_colors()

# Apply custom CSS
st.markdown(f"""
<style>
    .stTabs [data-baseweb="tab-list"] {{
        gap: 8px;
    }}
    .stTabs [data-baseweb="tab"] {{
        height: 50px;
        white-space: pre-wrap;
        background-color: {COLORS["card_bg"]};
        border-radius: 4px 4px 0px 0px;
        padding: 0px 16px;
        font-weight: 600;
        border: 1px solid {COLORS["border"]};
    }}
    .stTabs [aria-selected="true"] {{
        background-color: {COLORS["neutral"]} !important;
        color: white !important;
    }}
    .stButton button {{
        background-color: {COLORS["neutral"]};
        color: white;
        border-radius: 4px;
        padding: 0.5rem 1rem;
        font-weight: 600;
        border: none;
    }}
    .stButton button:hover {{
        background-color: {COLORS["accent"]};
        border: none;
    }}
    .metric-card {{
        background-color: {COLORS["card_bg"]};
        border: 1px solid {COLORS["border"]};
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
        backdrop-filter: blur(10px);
    }}
    .stProgress > div > div > div > div {{
        background-color: {COLORS["neutral"]};
    }}
    /* Ensure plots work in both themes */
    .js-plotly-plot .plotly {{
        background: transparent !important;
    }}
    /* Fix selectbox and input styling */
    .stSelectbox > div > div {{
        background-color: {COLORS["card_bg"]};
        border: 1px solid {COLORS["border"]};
    }}
    .stNumberInput > div > div {{
        background-color: {COLORS["card_bg"]};
        border: 1px solid {COLORS["border"]};
    }}
</style>
""", unsafe_allow_html=True)

# Create main tabs
tab1, tab2, tab3, tab4 = st.tabs(["Strategy Dashboard", "Parameter Optimization", "Combined Metrics Analysis", "Label-Based Optimization"])

# Dashboard title
st.sidebar.title("BTC On-Chain Strategy")
st.sidebar.markdown("### MVRV & NUPL Combined")

# Load data function
@st.cache_data
def load_data():
    try:
        df = pd.read_csv('btc_data.csv')
        df['DATE'] = pd.to_datetime(df['DATE'])
        df.set_index('DATE', inplace=True)
        return df
    except Exception as e:
        st.error(f"Error loading from CSV: {e}")
        try:
            df = load_data_from_snowflake(save_csv=True, csv_path='btc_data.csv')
            return df
        except Exception as snow_error:
            st.error(f"Error loading from Snowflake: {snow_error}")
            st.stop()

# Main dashboard tab
with tab1:
    # Sidebar configuration
    st.sidebar.subheader("Strategy Parameters")
    
    # Check if we have optimized parameters from the label-based optimization
    use_optimized_params = False
    if 'label_optimized_params' in st.session_state:
        use_optimized_params = st.sidebar.checkbox(
            "Use Label-Optimized Parameters", 
            value=False,
            help="Use the parameters found in the Label-Based Optimization tab"
        )
    
    # Combine method
    if use_optimized_params:
        combine_method = st.session_state.label_optimized_params['combine_method']
        st.sidebar.info(f"Using optimized combine method: {combine_method}")
    else:
        combine_method = st.sidebar.selectbox(
            "Combination Method",
            options=["average", "weighted", "consensus"],
            index=0,
            help="How to combine MVRV and NUPL Z-Scores: average (equal weights), weighted (custom weights), consensus (only signal when both agree)"
        )
    
    # Show weights only for weighted method
    if combine_method == "weighted":
        col1, col2 = st.sidebar.columns(2)
        with col1:
            if use_optimized_params:
                mvrv_weight = st.session_state.label_optimized_params['mvrv_weight']
                st.sidebar.info(f"Using optimized MVRV weight: {mvrv_weight:.2f}")
            else:
                mvrv_weight = st.slider(
                    "MVRV Weight",
                    min_value=0.0,
                    max_value=1.0,
                    value=0.5,
                    step=0.01
                )
        with col2:
            if use_optimized_params:
                nupl_weight = st.session_state.label_optimized_params['nupl_weight']
                st.sidebar.info(f"Using optimized NUPL weight: {nupl_weight:.2f}")
            else:
                nupl_weight = st.slider(
                    "NUPL Weight",
                    min_value=0.0,
                    max_value=1.0,
                    value=0.5,
                    step=0.01
                )
            
            # Normalize weights to make sure they sum to 1
            if not use_optimized_params:
                total = mvrv_weight + nupl_weight
                if total > 0:
                    mvrv_weight = mvrv_weight / total
                    nupl_weight = nupl_weight / total
                
        # Display normalized weights
        if not use_optimized_params:
            st.sidebar.markdown(f"**Normalized weights:** MVRV={mvrv_weight:.2f}, NUPL={nupl_weight:.2f}")
    else:
        mvrv_weight = nupl_weight = 0.5  # Default to equal weights
    
    # Moving average settings
    st.sidebar.subheader("Moving Average Settings")
    if use_optimized_params:
        ma_type = st.session_state.label_optimized_params['ma_type']
        st.sidebar.info(f"Using optimized MA type: {ma_type}")
    else:
        ma_type = st.sidebar.selectbox(
            "Moving Average Type",
            options=["WMA", "DEMA", "EMA"],
            index=0
        )
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if use_optimized_params:
            ma_length = st.session_state.label_optimized_params['ma_length']
            st.sidebar.info(f"Using optimized MA length: {ma_length}")
        else:
            ma_length = st.slider(
                "MA Length",
                min_value=50,
                max_value=500,
                value=DEFAULT_MA_LENGTH,
                step=10
            )
    with col2:
        if use_optimized_params:
            # Just show the value, don't allow editing
            st.number_input(
                "MA Length (Manual)",
                min_value=1,
                max_value=1000,
                value=ma_length,
                step=1,
                disabled=True
            )
        else:
            ma_length = st.number_input(
                "MA Length (Manual)",
                min_value=1,
                max_value=1000,
                value=ma_length,
                step=1
            )
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if use_optimized_params:
            zscore_lookback = st.session_state.label_optimized_params['zscore_lookback']
            st.sidebar.info(f"Using optimized Z-Score lookback: {zscore_lookback}")
        else:
            zscore_lookback = st.slider(
                "Z-Score Lookback",
                min_value=50,
                max_value=500,
                value=DEFAULT_ZSCORE_LOOKBACK,
                step=10
            )
    with col2:
        if use_optimized_params:
            # Just show the value, don't allow editing
            st.number_input(
                "Z-Score Lookback (Manual)",
                min_value=1,
                max_value=1000,
                value=zscore_lookback,
                step=1,
                disabled=True
            )
        else:
            zscore_lookback = st.number_input(
                "Z-Score Lookback (Manual)",
                min_value=1,
                max_value=1000,
                value=zscore_lookback,
                step=1
            )
    
    # Signal thresholds
    st.sidebar.subheader("Signal Thresholds")
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if use_optimized_params:
            long_threshold = st.session_state.label_optimized_params['long_threshold']
            st.sidebar.info(f"Using optimized buy threshold: {long_threshold:.2f}")
        else:
            long_threshold = st.slider(
                "Buy Threshold",
                min_value=-1.0,
                max_value=2.0,
                value=DEFAULT_LONG_THRESHOLD,
                step=0.05
            )
    with col2:
        if use_optimized_params:
            # Just show the value, don't allow editing
            st.number_input(
                "Buy Threshold (Manual)",
                min_value=-5.0,
                max_value=5.0,
                value=long_threshold,
                step=0.01,
                format="%.2f",
                disabled=True
            )
        else:
            long_threshold = st.number_input(
                "Buy Threshold (Manual)",
                min_value=-5.0,
                max_value=5.0,
                value=long_threshold,
                step=0.01,
                format="%.2f"
            )
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if use_optimized_params:
            short_threshold = st.session_state.label_optimized_params['short_threshold']
            st.sidebar.info(f"Using optimized sell threshold: {short_threshold:.2f}")
        else:
            short_threshold = st.slider(
                "Sell Threshold",
                min_value=-2.0,
                max_value=1.0,
                value=DEFAULT_SHORT_THRESHOLD,
                step=0.05
            )
    with col2:
        if use_optimized_params:
            # Just show the value, don't allow editing
            st.number_input(
                "Sell Threshold (Manual)",
                min_value=-5.0,
                max_value=5.0,
                value=short_threshold,
                step=0.01,
                format="%.2f",
                disabled=True
            )
        else:
            short_threshold = st.number_input(
                "Sell Threshold (Manual)",
                min_value=-5.0,
                max_value=5.0,
                value=short_threshold,
                step=0.01,
                format="%.2f"
            )
    
    # Visual indicators
    st.sidebar.subheader("Visual Indicators")
    col1, col2 = st.sidebar.columns(2)
    with col1:
        overbought_threshold = st.slider(
            "Overbought",
            min_value=1.0,
            max_value=5.0,
            value=DEFAULT_OVERBOUGHT_THRESHOLD,
            step=0.25
        )
    with col2:
        overbought_threshold = st.number_input(
            "Overbought (Manual)",
            min_value=0.0,
            max_value=10.0,
            value=overbought_threshold,
            step=0.01,
            format="%.2f",
            key="main_overbought_threshold"
        )
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        oversold_threshold = st.slider(
            "Oversold",
            min_value=-5.0,
            max_value=-1.0,
            value=DEFAULT_OVERSOLD_THRESHOLD,
            step=0.25
        )
    with col2:
        oversold_threshold = st.number_input(
            "Oversold (Manual)",
            min_value=-10.0,
            max_value=0.0,
            value=oversold_threshold,
            step=0.01,
            format="%.2f",
            key="main_oversold_threshold"
        )
    
    # Backtest settings
    st.sidebar.subheader("Backtest Settings")
    initial_capital = st.sidebar.number_input(
        "Initial Capital (USD)",
        min_value=1,
        max_value=100000,
        value=1000,
        step=1000,
        key="main_initial_capital"
    )
    
    # Date range selector
    st.sidebar.subheader("Date Range Filter")
    use_date_filter = st.sidebar.checkbox("Filter by Date Range", value=False)
    
    # Load raw data
    raw_data = load_data()
    
    # Date range selector based on available data
    min_date = raw_data.index.min().date()
    max_date = raw_data.index.max().date()
    
    if use_date_filter:
        start_date = st.sidebar.date_input(
            "Start Date",
            value=min_date,
            min_value=min_date,
            max_value=max_date
        )
        
        end_date = st.sidebar.date_input(
            "End Date",
            value=max_date,
            min_value=min_date,
            max_value=max_date
        )
        
        # Filter data by date range
        filtered_data = raw_data.loc[start_date:end_date].copy()
    else:
        filtered_data = raw_data.copy()

    # Strategy execution function
    def run_combined_strategy(df, params=None):
        """
        Run the combined MVRV-NUPL strategy with given parameters or default ones
        """
        if params is None:
            # Use parameters from UI
            ma_type_val = ma_type
            ma_length_val = ma_length
            zscore_lookback_val = zscore_lookback
            long_threshold_val = long_threshold
            short_threshold_val = short_threshold
            initial_capital_val = initial_capital
            combine_method_val = combine_method
            mvrv_weight_val = mvrv_weight
            nupl_weight_val = nupl_weight
        else:
            # Use params from optimization
            ma_type_val = params.get('ma_type', 'WMA')
            ma_length_val = params.get('ma_length', DEFAULT_MA_LENGTH)
            zscore_lookback_val = params.get('zscore_lookback', DEFAULT_ZSCORE_LOOKBACK)
            long_threshold_val = params.get('long_threshold', DEFAULT_LONG_THRESHOLD)
            short_threshold_val = params.get('short_threshold', DEFAULT_SHORT_THRESHOLD)
            initial_capital_val = params.get('initial_capital', 1000)
            combine_method_val = params.get('combine_method', 'average')
            mvrv_weight_val = params.get('mvrv_weight', 0.5)
            nupl_weight_val = params.get('nupl_weight', 0.5)
        
        # Calculate MVRV Z-Score
        df = calculate_mvrv_zscore(
            df.copy(), 
            ma_type=ma_type_val, 
            ma_length=ma_length_val, 
            lookback=zscore_lookback_val
        )
        
        # Calculate NUPL Z-Score
        df = calculate_nupl_zscore(
            df, 
            ma_type=ma_type_val, 
            ma_length=ma_length_val,
            lookback=zscore_lookback_val
        )
        
        # Calculate combined Z-Score
        df = calculate_combined_signal(
            df,
            method=combine_method_val,
            mvrv_weight=mvrv_weight_val,
            nupl_weight=nupl_weight_val
        )
        
        # Generate trading signals
        df = generate_signals(
            df,
            long_threshold=long_threshold_val,
            short_threshold=short_threshold_val,
            z_score_col='COMBINED_ZSCORE'
        )
        
        # Backtest the strategy
        df = backtest_strategy(df, initial_capital=initial_capital_val)
        
        return df
    
    # Run strategy with current parameters
    with st.spinner("Running combined MVRV-NUPL strategy..."):
        results = run_combined_strategy(filtered_data)
    
    # Main dashboard content
    st.title("Bitcoin MVRV-NUPL Combined Strategy")
    
    # Show notification if using optimized parameters
    if use_optimized_params:
        st.success(f"""
        **Using Label-Optimized Parameters!** 
        
        The strategy is currently using parameters optimized to match your custom entry/exit signals
        from the Label-Based Optimization tab.
        """)
    
    # Summary metrics
    st.markdown("### Strategy Performance")
    col1, col2, col3, col4 = st.columns(4)
    
    # Calculate performance metrics
    initial_value = results['PORTFOLIO_VALUE'].iloc[0]
    final_value = results['PORTFOLIO_VALUE'].iloc[-1]
    buy_hold_final = results['BUY_HOLD_VALUE'].iloc[-1]
    
    total_return = (final_value / initial_value - 1) * 100
    buy_hold_return = (buy_hold_final / initial_value - 1) * 100
    outperformance = total_return - buy_hold_return
    
    days = (results.index[-1] - results.index[0]).days
    years = days / 365.25
    
    annualized_return = ((final_value / initial_value) ** (1/years) - 1) * 100 if years > 0 else 0
    buy_hold_annualized = ((buy_hold_final / initial_value) ** (1/years) - 1) * 100 if years > 0 else 0
    
    trades = (results['SIGNAL'] != 0).sum()
    buy_trades = (results['SIGNAL'] == 1).sum()
    sell_trades = (results['SIGNAL'] == -1).sum()
    
    # Calculate win rate and other metrics
    buy_indices = results[results['SIGNAL'] == 1].index
    sell_indices = results[results['SIGNAL'] == -1].index
    
    profit_trades = 0
    loss_trades = 0
    total_profit = 0
    total_loss = 0
    
    current_buy_idx = None
    
    # Match buy/sell pairs and calculate metrics
    for idx in sorted(results.index):
        if idx in buy_indices:
            current_buy_idx = idx
        elif idx in sell_indices and current_buy_idx is not None:
            buy_price = results.loc[current_buy_idx, 'PRICE']
            sell_price = results.loc[idx, 'PRICE']
            pnl_pct = (sell_price / buy_price - 1) * 100
            
            if pnl_pct > 0:
                profit_trades += 1
                total_profit += pnl_pct
            else:
                loss_trades += 1
                total_loss += pnl_pct
            
            current_buy_idx = None
    
    completed_trades = profit_trades + loss_trades
    win_rate = (profit_trades / completed_trades * 100) if completed_trades > 0 else 0
    avg_profit = (total_profit / profit_trades) if profit_trades > 0 else 0
    avg_loss = (total_loss / loss_trades) if loss_trades > 0 else 0
    profit_factor = (abs(total_profit) / abs(total_loss)) if abs(total_loss) > 0 else float('inf')
    
    # Calculate max drawdown
    portfolio_values = results['PORTFOLIO_VALUE'].values
    max_drawdown = 0
    peak = portfolio_values[0]
    
    for value in portfolio_values:
        if value > peak:
            peak = value
        drawdown = (peak - value) / peak * 100
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    # Calculate Sharpe ratio (annualized)
    daily_returns = results['STRATEGY_RETURNS'].fillna(0)
    sharpe_ratio = np.sqrt(252) * (daily_returns.mean() / daily_returns.std()) if daily_returns.std() > 0 else 0
    
    # Display summary metrics with colored indicators
    with col1:
        return_delta = total_return - buy_hold_return
        return_color = COLORS["green"] if return_delta > 0 else COLORS["red"]
        return_icon = "↗" if return_delta > 0 else "↘"
        
        st.markdown(f"""
        <div style="background-color:{COLORS['card_bg']}; border: 1px solid {COLORS['border']}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid {return_color};">
            <h3 style="margin-top:0; color:{return_color}; font-size: 1.1rem;">{return_icon} Strategy Return</h3>
            <p style="font-size:28px; font-weight:bold; margin:0; color:{return_color};">{total_return:.2f}%</p>
            <p style="color:{return_color}; opacity: 0.8; margin: 0;">vs Buy & Hold: {return_delta:+.2f}%</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        win_icon = "●" if win_rate > 60 else "○"
        win_color = COLORS["green"] if win_rate > 60 else "inherit"
        
        st.markdown(f"""
        <div style="background-color:{COLORS['card_bg']}; border: 1px solid {COLORS['border']}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid {win_color if win_rate > 60 else COLORS['border']};">
            <h3 style="margin-top:0; color:{win_color}; font-size: 1.1rem;">{win_icon} Win Rate</h3>
            <p style="font-size:28px; font-weight:bold; margin:0;">{win_rate:.1f}%</p>
            <p style="opacity: 0.8; margin: 0;">Completed trades: {completed_trades}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        pf_icon = "≈" if profit_factor > 2 else "≈"
        pf_color = COLORS["green"] if profit_factor > 2 else "inherit"
        pf_display = f"{profit_factor:.2f}" if profit_factor != float('inf') else "∞"
        
        st.markdown(f"""
        <div style="background-color:{COLORS['card_bg']}; border: 1px solid {COLORS['border']}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid {pf_color if profit_factor > 2 else COLORS['border']};">
            <h3 style="margin-top:0; color:{pf_color}; font-size: 1.1rem;">{pf_icon} Profit Factor</h3>
            <p style="font-size:28px; font-weight:bold; margin:0;">{pf_display}</p>
            <p style="opacity: 0.8; margin: 0;">Avg profit: {avg_profit:.2f}% | Avg loss: {avg_loss:.2f}%</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        dd_icon = "▼" if max_drawdown < 30 else "▼"
        dd_color = COLORS["green"] if max_drawdown < 30 else COLORS["red"]
        
        st.markdown(f"""
        <div style="background-color:{COLORS['card_bg']}; border: 1px solid {COLORS['border']}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid {dd_color};">
            <h3 style="margin-top:0; color:{dd_color}; font-size: 1.1rem;">{dd_icon} Max Drawdown</h3>
            <p style="font-size:28px; font-weight:bold; margin:0; color:{dd_color};">{max_drawdown:.2f}%</p>
            <p style="opacity: 0.8; margin: 0;">Sharpe Ratio: {sharpe_ratio:.2f}</p>
        </div>
        """, unsafe_allow_html=True)
    
    # Current position status
    current_position = results['POSITION'].iloc[-1]
    position_text = "HOLDING BTC" if current_position == 1 else "IN CASH"
    position_color = COLORS["primary"] if current_position == 1 else COLORS["secondary"]
    position_icon = "LONG" if current_position == 1 else "OUT"
    
    st.markdown(f"""
    <div style="background-color:{COLORS['card_bg']}; border: 1px solid {COLORS['border']}; padding:1rem; border-radius:8px; margin:1rem 0; border-left:5px solid {position_color};">
        <h2 style="margin:0; color:{position_color}; display:flex; align-items:center; font-size: 1.3rem;">
            {position_icon} | Current Position: {position_text}
        </h2>
        <p style="margin: 0.5rem 0 0 0; opacity: 0.8;">Last signal date: {results[results['SIGNAL'] != 0].index[-1].strftime('%Y-%m-%d') if any(results['SIGNAL'] != 0) else 'No signals yet'}</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Create interactive charts with plotly
    def create_combined_chart(df):
        """
        Create an interactive plotly chart showing price, combined Z-Score, and individual Z-Scores
        """
        # Convert index to datetime if needed
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        
        # Check if we have OHLC data
        has_ohlc = all(col in df.columns for col in ['OPEN', 'HIGH', 'LOW', 'CLOSE'])
        
        if has_ohlc:
            price_col = 'CLOSE'
        elif 'PRICE' in df.columns:
            price_col = 'PRICE'
        elif 'BTC_PRICE' in df.columns:
            price_col = 'BTC_PRICE'
        else:
            # This shouldn't happen based on our data loading
            st.error("No price column found for plotting")
            return None
        
        # Create figure with subplots
        fig = make_subplots(
            rows=3, 
            cols=1,
            shared_xaxes=True,
            vertical_spacing=0.05,
            subplot_titles=("BTC Price", "Combined Z-Score", "Individual Z-Scores"),
            row_heights=[0.6, 0.4, 0.4]
        )
        
        # Plot BTC price in first subplot
        if has_ohlc:
            fig.add_trace(
                go.Candlestick(
                    x=df.index,
                    open=df['OPEN'],
                    high=df['HIGH'],
                    low=df['LOW'],
                    close=df['CLOSE'],
                    name="BTC Price"
                ),
                row=1, col=1
            )
        else:
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=df[price_col],
                    mode='lines',
                    name="BTC Price",
                    line=dict(color='white', width=1)
                ),
                row=1, col=1
            )
        
        # Add buy/sell actions to price chart
        buy_signals = df[df['SIGNAL'] == 1]
        sell_signals = df[df['SIGNAL'] == -1]
        
        # Buy signals (green triangles)
        if not buy_signals.empty:
            fig.add_trace(
                go.Scatter(
                    x=buy_signals.index,
                    y=buy_signals[price_col] * 0.98,  # Slightly below price for visibility
                    mode='markers',
                    marker=dict(
                        symbol='triangle-up',
                        size=15,
                        color=COLORS["green"],
                        line=dict(color='white', width=1)
                    ),
                    name="Buy Signal"
                ),
                row=1, col=1
            )
        
        # Sell signals (red triangles)
        if not sell_signals.empty:
            fig.add_trace(
                go.Scatter(
                    x=sell_signals.index,
                    y=sell_signals[price_col] * 1.02,  # Slightly above price for visibility
                    mode='markers',
                    marker=dict(
                        symbol='triangle-down',
                        size=15,
                        color=COLORS["red"],
                        line=dict(color='white', width=1)
                    ),
                    name="Sell Signal"
                ),
                row=1, col=1
            )
        
        # Add color backgrounds based on position
        # Identify position change points
        position_changes = df['POSITION'].ne(df['POSITION'].shift()).cumsum()
        
        # Group by consecutive positions
        for i, pos_group in df.groupby(position_changes):
            if len(pos_group) <= 1:
                continue
            
            pos = pos_group['POSITION'].iloc[0]
            start_date = pos_group.index[0]
            end_date = pos_group.index[-1]
            
            if pos == 1:  # Holding BTC - teal/cyan background
                fig.add_vrect(
                    x0=start_date, 
                    x1=end_date,
                    fillcolor=COLORS["primary"], 
                    opacity=0.1,
                    layer="below", 
                    line_width=0,
                    row=1, col=1
                )
            elif pos == 0:  # Holding cash - magenta/pink background
                fig.add_vrect(
                    x0=start_date, 
                    x1=end_date,
                    fillcolor=COLORS["secondary"], 
                    opacity=0.1,
                    layer="below", 
                    line_width=0,
                    row=1, col=1
                )
        
        # Plot Combined Z-Score in second subplot
        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df['COMBINED_ZSCORE'],
                mode='lines',
                name="Combined Z-Score",
                line=dict(color='white', width=1.5)
            ),
            row=2, col=1
        )
        
        # Color the combined Z-Score line based on position
        for i, pos_group in df.groupby(position_changes):
            if len(pos_group) <= 1:
                continue
            
            pos = pos_group['POSITION'].iloc[0]
            color = COLORS["primary"] if pos == 1 else COLORS["secondary"]
            
            fig.add_trace(
                go.Scatter(
                    x=pos_group.index,
                    y=pos_group['COMBINED_ZSCORE'],
                    mode='lines',
                    line=dict(color=color, width=2),
                    showlegend=False
                ),
                row=2, col=1
            )
        
        # Add threshold lines for Z-Score
        fig.add_hline(
            y=long_threshold, 
            line_dash="dash", 
            line_color=COLORS["green"], 
            opacity=0.7,
            row=2, col=1,
            annotation_text="Buy",
            annotation_position="right"
        )
        
        fig.add_hline(
            y=short_threshold, 
            line_dash="dash", 
            line_color=COLORS["red"], 
            opacity=0.7,
            row=2, col=1,
            annotation_text="Sell",
            annotation_position="right"
        )
        
        fig.add_hline(
            y=overbought_threshold, 
            line_dash="solid", 
            line_color=COLORS["secondary"], 
            opacity=0.5,
            row=2, col=1,
            annotation_text="Overbought",
            annotation_position="right"
        )
        
        fig.add_hline(
            y=oversold_threshold, 
            line_dash="solid", 
            line_color=COLORS["primary"], 
            opacity=0.5,
            row=2, col=1,
            annotation_text="Oversold",
            annotation_position="right"
        )
        
        fig.add_hline(
            y=0, 
            line_dash="solid", 
            line_color="white", 
            opacity=0.3,
            row=2, col=1
        )
        
        # Plot individual Z-Scores in third subplot
        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df['MVRV_ZSCORE'],
                mode='lines',
                name="MVRV Z-Score",
                line=dict(color='blue', width=1.5)
            ),
            row=3, col=1
        )
        
        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df['NUPL_ZSCORE'],
                mode='lines',
                name="NUPL Z-Score",
                line=dict(color='green', width=1.5)
            ),
            row=3, col=1
        )
        
        fig.add_hline(
            y=0, 
            line_dash="solid", 
            line_color="white", 
            opacity=0.3,
            row=3, col=1
        )
        
        # Update layout
        fig.update_layout(
            height=800,
            plot_bgcolor="rgba(0,0,0,0)",  # Fully transparent
            paper_bgcolor="rgba(0,0,0,0)",  # Fully transparent
            title=dict(
                text="Bitcoin MVRV-NUPL Combined Strategy",
                font=dict(size=20)
            ),
            hovermode="x unified",
            showlegend=True,
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="center",
                x=0.5
            ),
            margin=dict(l=20, r=20, t=50, b=20)
        )
        
        # Update y-axis type for price chart to log
        fig.update_yaxes(
            type="log", 
            row=1, 
            col=1, 
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
            title="Price (log scale)"
        )
        
        # Update axes styling for all charts
        fig.update_xaxes(
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
            showgrid=True
        )
        
        fig.update_yaxes(
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
            showgrid=True
        )
        
        # Set y-axis titles for Z-Score plots
        fig.update_yaxes(title="Combined Z-Score", row=2, col=1)
        fig.update_yaxes(title="Individual Z-Scores", row=3, col=1)
        
        # Add range slider
        fig.update_layout(
            xaxis=dict(
                rangeslider=dict(visible=False, bgcolor=COLORS["grid"]),
                type="date"
            )
        )
        
        return fig
    
    # Display interactive chart
    with st.spinner("Generating interactive charts..."):
        combined_chart = create_combined_chart(results)
        st.plotly_chart(combined_chart, use_container_width=True)

    col1, col2 = st.columns(2)

    with col1:
        st.write("Strategy Performance")
        st.table(pd.DataFrame({
            "Metric": ["Total Return", "Annualized Return", "Final Value", "Number of Trades"],
            "Value": [f"{total_return:.2f}%", f"{annualized_return:.2f}%", f"${final_value:.2f}", f"{trades} ({buy_trades} buys, {sell_trades} sells)"]
        }))

    with col2:
        st.write("Buy & Hold Performance")
        st.table(pd.DataFrame({
            "Metric": ["Total Return", "Annualized Return", "Final Value", "Outperformance"],
            "Value": [f"{buy_hold_return:.2f}%", f"{buy_hold_annualized:.2f}%", 
                     f"${buy_hold_final:.2f}", f"{(total_return-buy_hold_return):.2f}%"]
        }))

    # Portfolio performance chart
    st.subheader("Portfolio Performance")
    
    # Create portfolio performance chart
    portfolio_fig = go.Figure()
    
    # Add strategy portfolio value line
    portfolio_fig.add_trace(
        go.Scatter(
            x=results.index,
            y=results['PORTFOLIO_VALUE'],
            mode='lines',
            name="Strategy Value",
            line=dict(color=COLORS["primary"], width=2)
        )
    )
    
    # Add buy & hold line
    portfolio_fig.add_trace(
        go.Scatter(
            x=results.index,
            y=results['BUY_HOLD_VALUE'],
            mode='lines',
            name="Buy & Hold Value",
            line=dict(color=COLORS["secondary"], width=1.5, dash='dash')
        )
    )
    
    # Update layout for log scale and styling
    portfolio_fig.update_layout(
        height=400,
        plot_bgcolor="rgba(0,0,0,0)",  # Fully transparent
        paper_bgcolor="rgba(0,0,0,0)",  # Fully transparent
        yaxis_type="log",  # Set y-axis to log scale
        xaxis=dict(
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
        ),
        yaxis=dict(
            title="Portfolio Value (USD, Log Scale)",
            gridcolor=COLORS["grid"],
            zerolinecolor=COLORS["grid"],
        ),
        hovermode="x unified",
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5
        ),
        margin=dict(l=10, r=10, t=30, b=10)
    )
    
    # Display portfolio chart
    st.plotly_chart(portfolio_fig, use_container_width=True)
    
    # Create two columns for detailed metrics display
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Strategy Performance Metrics")
        
        metrics_table = pd.DataFrame({
            "Metric": [
                "Total Return", 
                "Annualized Return", 
                "Sharpe Ratio",
                "Max Drawdown", 
                "Win Rate", 
                "Profit Factor",
                "Number of Trades",
                "Avg. Winning Trade",
                "Avg. Losing Trade"
            ],
            "Value": [
                f"{total_return:.2f}%", 
                f"{annualized_return:.2f}%", 
                f"{sharpe_ratio:.2f}",
                f"{max_drawdown:.2f}%", 
                f"{win_rate:.1f}%", 
                f"{profit_factor:.2f}" if profit_factor != float('inf') else "∞",
                f"{trades} ({buy_trades} buys, {sell_trades} sells)",
                f"{avg_profit:.2f}%",
                f"{avg_loss:.2f}%"
            ]
        })
        
        # Display metrics with custom styling
        st.markdown(
            metrics_table.style.apply(
                lambda x: ['background-color: rgba(0, 255, 221, 0.1)' if i % 2 == 0 else '' for i in range(len(x))], 
                axis=0
            ).to_html(),
            unsafe_allow_html=True
        )
    
    with col2:
        st.markdown("### Market & Comparative Analysis")
        
        comparison_table = pd.DataFrame({
            "Metric": [
                "Buy & Hold Return", 
                "Buy & Hold Annualized", 
                "Strategy Outperformance",
                "Market Days Analyzed", 
                "% Time in Market", 
                "Avg. Hold Duration",
                "Last Signal",
                "Current Position",
                "Current Z-Score"
            ],
            "Value": [
                f"{buy_hold_return:.2f}%", 
                f"{buy_hold_annualized:.2f}%", 
                f"{outperformance:+.2f}%",
                f"{days} days ({years:.1f} years)", 
                f"{(results['POSITION'].mean() * 100):.1f}%", 
                f"{(days * results['POSITION'].mean() / max(1, completed_trades)):.1f} days/trade" if completed_trades > 0 else "N/A",
                f"{results[results['SIGNAL'] != 0].index[-1].strftime('%Y-%m-%d')}" if any(results['SIGNAL'] != 0) else "No signals yet",
                f"{'HOLDING BTC' if results['POSITION'].iloc[-1] == 1 else 'IN CASH'}",
                f"{results['COMBINED_ZSCORE'].iloc[-1]:.2f}"
            ]
        })
        
        # Display metrics with custom styling
        st.markdown(
            comparison_table.style.apply(
                lambda x: ['background-color: rgba(255, 0, 191, 0.1)' if i % 2 == 0 else '' for i in range(len(x))], 
                axis=0
            ).to_html(),
            unsafe_allow_html=True
        )
    
    # Trade List
    st.subheader("Trade History")
    
    # Get all signals
    trade_df = results[results['SIGNAL'] != 0].copy()
    trade_df['Action'] = trade_df['SIGNAL'].apply(lambda x: "Buy" if x == 1 else "Sell")
    
    # Determine price column
    price_col = 'CLOSE' if 'CLOSE' in trade_df.columns else 'PRICE'
    
    # Format the trade list
    trade_display = pd.DataFrame({
        'Date': trade_df.index.strftime('%Y-%m-%d').tolist(),
        'Action': trade_df['Action'].tolist(),
        'Price ($)': trade_df[price_col].round(2).tolist(),
        'MVRV Z-Score': trade_df['MVRV_ZSCORE'].round(3).tolist(),
        'NUPL Z-Score': trade_df['NUPL_ZSCORE'].round(3).tolist(),
        'Combined Z-Score': trade_df['COMBINED_ZSCORE'].round(3).tolist()
    })
    
    # Create trade pairs for performance calculation
    if len(trade_df) >= 2:
        # Create pairs of buy and sell signals
        buy_indices = trade_df[trade_df['Action'] == 'Buy'].index
        sell_indices = trade_df[trade_df['Action'] == 'Sell'].index
        
        trade_pairs = []
        last_buy_idx = None
        
        for idx in sorted(list(buy_indices) + list(sell_indices)):
            if idx in buy_indices:
                last_buy_idx = idx
            elif idx in sell_indices and last_buy_idx is not None:
                trade_pairs.append((last_buy_idx, idx))
                last_buy_idx = None
        
        # Calculate trade performances
        trade_results = []
        for buy_idx, sell_idx in trade_pairs:
            # Use the determined price column
            buy_price = results.loc[buy_idx, price_col]
            sell_price = results.loc[sell_idx, price_col]
            buy_date = results.loc[buy_idx].name
            sell_date = results.loc[sell_idx].name
            hold_days = (sell_date - buy_date).days
            profit_pct = (sell_price / buy_price - 1) * 100
            
            # Market performance during the same period
            market_start = results.loc[buy_idx, 'BUY_HOLD_VALUE']
            market_end = results.loc[sell_idx, 'BUY_HOLD_VALUE']
            market_pct = (market_end / market_start - 1) * 100
            
            # Outperformance
            outperform = profit_pct - market_pct
            
            trade_results.append({
                'Buy Date': buy_date.strftime('%Y-%m-%d'),
                'Sell Date': sell_date.strftime('%Y-%m-%d'),
                'Hold Period': f"{hold_days} days",
                'Buy Price': f"${buy_price:.2f}",
                'Sell Price': f"${sell_price:.2f}",
                'Return': f"{profit_pct:.2f}%",
                'Market Return': f"{market_pct:.2f}%",
                'Outperformance': f"{outperform:+.2f}%",
                'Result': "Profit" if profit_pct > 0 else "Loss",
                'Color': COLORS["green"] if profit_pct > 0 else COLORS["red"]
            })
        
        if trade_results:
            # Create a dataframe for better visualization
            trade_results_df = pd.DataFrame(trade_results)
            
            # Display trades without styling (to fix the column mismatch error)
            st.markdown("### Completed Trades Analysis")
            st.dataframe(trade_results_df)
    
    # Display raw signal list
    with st.expander("View All Signals"):
        st.dataframe(trade_display, use_container_width=True)
    
    # Raw data exploration and downloads
    with st.expander("Raw Data Explorer"):
        st.subheader("Raw Data Sample")
        
        # Select columns to display
        display_cols = ['PRICE', 'MVRV', 'NUPL', 'MVRV_ZSCORE', 'NUPL_ZSCORE', 
                        'COMBINED_ZSCORE', 'SIGNAL', 'POSITION', 'PORTFOLIO_VALUE', 
                        'BUY_HOLD_VALUE', 'STRATEGY_RETURNS', 'BUY_HOLD_RETURNS']
        
        available_cols = [col for col in display_cols if col in results.columns]
        st.dataframe(results[available_cols].head(20), use_container_width=True)
        
        # Download buttons
        col1, col2 = st.columns(2)
        
        with col1:
            csv = results.to_csv().encode('utf-8')
            st.download_button(
                label="Download Full Results CSV",
                data=csv,
                file_name='combined_strategy_results.csv',
                mime='text/csv',
            )
        
        with col2:
            csv_trades = trade_display.to_csv().encode('utf-8')
            st.download_button(
                label="Download Trade List CSV",
                data=csv_trades,
                file_name='combined_strategy_trades.csv',
                mime='text/csv',
            )
    
    # Z-Score Denormalization Tool
    st.subheader("Z-Score Denormalization Tool")
    st.markdown("""
    Convert Z-Scores back to actual MVRV and NUPL values for a specific date. This tool helps you understand 
    what the actual metric values were when certain Z-Score levels were reached.
    """)
    
    with st.expander("Z-Score to Actual Values Converter", expanded=False):
        # Create columns for inputs
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.markdown("#### Input Parameters")
            
            # Date input
            denorm_date = st.date_input(
                "Target Date",
                value=results.index[-1].date() if len(results) > 0 else datetime.date.today(),
                min_value=results.index[0].date() if len(results) > 0 else datetime.date(2020, 1, 1),
                max_value=results.index[-1].date() if len(results) > 0 else datetime.date.today(),
                help="Select the date for which you want to denormalize Z-Scores"
            )
            
            # Z-Score inputs
            target_mvrv_zscore = st.number_input(
                "MVRV Z-Score",
                min_value=-10.0,
                max_value=10.0,
                value=0.0,
                step=0.1,
                format="%.2f",
                help="Enter the MVRV Z-Score you want to convert to actual value"
            )
            
            target_nupl_zscore = st.number_input(
                "NUPL Z-Score",
                min_value=-10.0,
                max_value=10.0,
                value=0.0,
                step=0.1,
                format="%.2f",
                help="Enter the NUPL Z-Score you want to convert to actual value"
            )
        
        with col2:
            st.markdown("#### Denormalization Parameters")
            st.markdown("*Use the same parameters as your current strategy*")
            
            # Use current strategy parameters for denormalization
            denorm_ma_type = ma_type
            denorm_ma_length = ma_length
            denorm_zscore_lookback = zscore_lookback
            
            st.info(f"""
            **Current Strategy Parameters:**
            - MA Type: {denorm_ma_type}
            - MA Length: {denorm_ma_length}
            - Z-Score Lookback: {denorm_zscore_lookback}
            """)
            
            # Option to use custom parameters
            use_custom_denorm_params = st.checkbox(
                "Use Custom Parameters", 
                value=False,
                help="Check this to use different parameters for denormalization"
            )
            
            if use_custom_denorm_params:
                denorm_ma_type = st.selectbox(
                    "MA Type (Custom)",
                    options=["WMA", "DEMA", "EMA"],
                    index=0,
                    key="denorm_ma_type"
                )
                
                denorm_ma_length = st.number_input(
                    "MA Length (Custom)",
                    min_value=50,
                    max_value=500,
                    value=DEFAULT_MA_LENGTH,
                    step=10,
                    key="denorm_ma_length"
                )
                
                denorm_zscore_lookback = st.number_input(
                    "Z-Score Lookback (Custom)",
                    min_value=50,
                    max_value=500,
                    value=DEFAULT_ZSCORE_LOOKBACK,
                    step=10,
                    key="denorm_zscore_lookback"
                )
        
        with col3:
            st.markdown("#### Results")
            
            # Denormalization function
            def denormalize_zscore(df, target_date, target_zscore, metric_col, ma_col, std_col):
                """
                Convert Z-Score back to actual metric value for a specific date
                
                Formula: actual_value = zscore * std + ma
                Where zscore = (actual_value - ma) / std
                """
                try:
                    # Convert target_date to datetime if it's a date
                    if isinstance(target_date, datetime.date):
                        target_date = pd.Timestamp(target_date)
                    
                    # Find the closest date in the dataframe
                    if target_date not in df.index:
                        # Find the closest date
                        closest_date = df.index[df.index.get_indexer([target_date], method='nearest')[0]]
                        st.warning(f"Exact date not found. Using closest date: {closest_date.strftime('%Y-%m-%d')}")
                        target_date = closest_date
                    
                    # Get the moving average and standard deviation for that date
                    ma_value = df.loc[target_date, ma_col]
                    std_value = df.loc[target_date, std_col]
                    
                    # Check for valid values
                    if pd.isna(ma_value) or pd.isna(std_value) or std_value == 0:
                        return None, None, "Invalid data for the selected date (NaN or zero std)"
                    
                    # Calculate actual value: actual_value = zscore * std + ma
                    actual_value = target_zscore * std_value + ma_value
                    
                    return actual_value, target_date, None
                    
                except Exception as e:
                    return None, None, f"Error: {str(e)}"
            
            # Perform denormalization when button is clicked
            if st.button("Calculate Actual Values", key="denormalize_button"):
                with st.spinner("Calculating denormalized values..."):
                    # Prepare data with the specified parameters
                    denorm_data = filtered_data.copy()
                    
                    # Calculate MVRV Z-Score with specified parameters
                    denorm_data = calculate_mvrv_zscore(
                        denorm_data, 
                        ma_type=denorm_ma_type, 
                        ma_length=denorm_ma_length, 
                        lookback=denorm_zscore_lookback
                    )
                    
                    # Calculate NUPL Z-Score with specified parameters
                    denorm_data = calculate_nupl_zscore(
                        denorm_data, 
                        ma_type=denorm_ma_type, 
                        ma_length=denorm_ma_length,
                        lookback=denorm_zscore_lookback
                    )
                    
                    # Denormalize MVRV
                    mvrv_actual, mvrv_date, mvrv_error = denormalize_zscore(
                        denorm_data, denorm_date, target_mvrv_zscore, 
                        'MVRV', 'MVRV_MA', 'MVRV_STD'
                    )
                    
                    # Denormalize NUPL
                    nupl_actual, nupl_date, nupl_error = denormalize_zscore(
                        denorm_data, denorm_date, target_nupl_zscore, 
                        'NUPL', 'NUPL_MA', 'NUPL_STD'
                    )
                    
                    # Display results
                    if mvrv_error or nupl_error:
                        st.error(f"Denormalization failed: {mvrv_error or nupl_error}")
                    else:
                        # Get actual historical values for comparison
                        historical_mvrv = denorm_data.loc[mvrv_date, 'MVRV'] if mvrv_date in denorm_data.index else None
                        historical_nupl = denorm_data.loc[nupl_date, 'NUPL'] if nupl_date in denorm_data.index else None
                        
                        # Display results in a nice format
                        st.success("✅ Denormalization completed successfully!")
                        
                        # Results table
                        results_data = {
                            'Metric': ['MVRV', 'NUPL'],
                            'Input Z-Score': [f"{target_mvrv_zscore:.2f}", f"{target_nupl_zscore:.2f}"],
                            'Calculated Actual Value': [f"{mvrv_actual:.4f}" if mvrv_actual else "N/A", 
                                                       f"{nupl_actual:.4f}" if nupl_actual else "N/A"],
                            'Historical Actual Value': [f"{historical_mvrv:.4f}" if historical_mvrv else "N/A",
                                                       f"{historical_nupl:.4f}" if historical_nupl else "N/A"],
                            'Date Used': [mvrv_date.strftime('%Y-%m-%d') if mvrv_date else "N/A",
                                         nupl_date.strftime('%Y-%m-%d') if nupl_date else "N/A"]
                        }
                        
                        st.dataframe(pd.DataFrame(results_data), use_container_width=True, hide_index=True)
                        
                        # Additional context
                        st.markdown("#### Interpretation")
                        
                        # MVRV interpretation
                        if mvrv_actual:
                            if mvrv_actual > 3.0:
                                mvrv_interp = "🔴 **Extremely Overvalued** - Historical top territory"
                            elif mvrv_actual > 2.5:
                                mvrv_interp = "🟠 **Overvalued** - Caution advised"
                            elif mvrv_actual > 1.5:
                                mvrv_interp = "🟡 **Fairly Valued** - Normal market conditions"
                            elif mvrv_actual > 1.0:
                                mvrv_interp = "🟢 **Undervalued** - Potential buying opportunity"
                            else:
                                mvrv_interp = "🟢 **Significantly Undervalued** - Strong buying opportunity"
                            
                            st.markdown(f"**MVRV ({mvrv_actual:.4f}):** {mvrv_interp}")
                        
                        # NUPL interpretation
                        if nupl_actual:
                            if nupl_actual > 0.75:
                                nupl_interp = "🔴 **Extreme Greed** - Market euphoria, high risk"
                            elif nupl_actual > 0.5:
                                nupl_interp = "🟠 **Greed** - Overheated market conditions"
                            elif nupl_actual > 0.25:
                                nupl_interp = "🟡 **Optimism** - Positive but not extreme"
                            elif nupl_actual > 0:
                                nupl_interp = "🟢 **Hope** - Mild optimism"
                            elif nupl_actual > -0.25:
                                nupl_interp = "🟡 **Fear** - Mild pessimism"
                            elif nupl_actual > -0.5:
                                nupl_interp = "🟠 **Anxiety** - Significant fear"
                            else:
                                nupl_interp = "🟢 **Capitulation** - Extreme fear, potential bottom"
                            
                            st.markdown(f"**NUPL ({nupl_actual:.4f}):** {nupl_interp}")
                        
                        # Combined signal interpretation
                        if mvrv_actual and nupl_actual:
                            combined_zscore = (target_mvrv_zscore + target_nupl_zscore) / 2
                            
                            if combined_zscore > 2.0:
                                combined_interp = "🔴 **Strong Sell Signal Territory**"
                            elif combined_zscore > 0.5:
                                combined_interp = "🟠 **Potential Sell Signal Territory**"
                            elif combined_zscore > -0.5:
                                combined_interp = "🟡 **Neutral Territory**"
                            elif combined_zscore > -2.0:
                                combined_interp = "🟢 **Potential Buy Signal Territory**"
                            else:
                                combined_interp = "🟢 **Strong Buy Signal Territory**"
                            
                            st.markdown(f"**Combined Signal ({combined_zscore:.2f}):** {combined_interp}")
            
            # Show current actual values for reference
            if len(results) > 0:
                st.markdown("#### Current Values (Latest Date)")
                latest_date = results.index[-1]
                current_mvrv = results.loc[latest_date, 'MVRV'] if 'MVRV' in results.columns else "N/A"
                current_nupl = results.loc[latest_date, 'NUPL'] if 'NUPL' in results.columns else "N/A"
                current_mvrv_zscore = results.loc[latest_date, 'MVRV_ZSCORE'] if 'MVRV_ZSCORE' in results.columns else "N/A"
                current_nupl_zscore = results.loc[latest_date, 'NUPL_ZSCORE'] if 'NUPL_ZSCORE' in results.columns else "N/A"
                
                # Format the values first to avoid f-string formatting issues
                mvrv_display = f"{current_mvrv:.4f}" if isinstance(current_mvrv, (int, float)) else str(current_mvrv)
                mvrv_zscore_display = f"{current_mvrv_zscore:.2f}" if isinstance(current_mvrv_zscore, (int, float)) else str(current_mvrv_zscore)
                nupl_display = f"{current_nupl:.4f}" if isinstance(current_nupl, (int, float)) else str(current_nupl)
                nupl_zscore_display = f"{current_nupl_zscore:.2f}" if isinstance(current_nupl_zscore, (int, float)) else str(current_nupl_zscore)
                
                st.info(f"""
                **{latest_date.strftime('%Y-%m-%d')}:**
                - MVRV: {mvrv_display} (Z-Score: {mvrv_zscore_display})
                - NUPL: {nupl_display} (Z-Score: {nupl_zscore_display})
                """)
    
    # Strategy description and context
    with st.expander("Strategy Explanation"):
        st.markdown("""
        ### MVRV-NUPL Combined Strategy Explanation
        
        This strategy combines two powerful on-chain metrics to generate trading signals:
        
        1. **MVRV (Market Value to Realized Value)** - Compares Bitcoin's current market cap to its realized cap, which values each coin at the price it last moved.
        
        2. **NUPL (Net Unrealized Profit/Loss)** - Measures the difference between unrealized profit and loss as a proportion of the market cap.
        
        Both metrics are transformed into Z-Scores (measuring how many standard deviations they are from their historical mean) and then combined using one of three methods:
        
        - **Average**: Simple arithmetic mean of both Z-Scores
        - **Weighted**: Custom-weighted average giving more influence to one metric over the other
        - **Consensus**: Only generates signals when both metrics agree on market direction
        
        #### Signal Generation:
        - **Buy Signal**: Combined Z-Score crosses above the buy threshold when not holding BTC
        - **Sell Signal**: Combined Z-Score crosses below the sell threshold when holding BTC
        
        #### Interpretation:
        - Very high Z-Scores (above overbought threshold) suggest market euphoria and potential overvaluation
        - Very low Z-Scores (below oversold threshold) suggest fear/capitulation and potential undervaluation
        
        This combined approach may provide more reliable signals than either metric alone.
        
        #### Z-Score Denormalization
        The denormalization tool above allows you to convert Z-Scores back to actual MVRV and NUPL values, helping you understand what the raw metric values were at specific Z-Score levels and dates.
        """)
    
    # Footer
    st.markdown("---")
    st.markdown("""
    <div style="text-align:center; font-size:0.8em;">
        <p>BTC MVRV-NUPL Combined Z-Score Strategy Dashboard | Created for on-chain analysis</p>
    </div>
    """, unsafe_allow_html=True)

with tab2:
    # Parameter Optimization
    st.title("Advanced Strategy Parameter Optimization")
    
    st.markdown("""
    This section uses advanced optimization algorithms to find the best parameter combinations for the MVRV-NUPL Combined strategy.
    Choose between Bayesian Optimization (efficient, good for continuous parameters) or Genetic Algorithm (robust, good for complex search spaces).
    """)
    
    # Optimization method selection
    st.subheader("Optimization Method")
    
    optimization_methods = []
    if BAYESIAN_AVAILABLE:
        optimization_methods.append("Bayesian Optimization")
    if GA_AVAILABLE:
        optimization_methods.append("Genetic Algorithm")
    optimization_methods.append("Random Search")  # Always available as fallback
    
    selected_method = st.selectbox(
        "Select Optimization Algorithm",
        options=optimization_methods,
        index=0,
        help="Bayesian Optimization: Uses Gaussian Process to intelligently explore parameter space. Genetic Algorithm: Uses evolutionary principles for robust optimization."
    )
    
    # Divider
    st.markdown("---")
    
    # Parameter ranges - Define these first before using them
    st.subheader("Parameter Search Ranges")
    
    # Three column layout for parameter ranges
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("#### Moving Average Parameters")
        
        ma_type_options = st.multiselect(
            "Moving Average Types",
            options=["EMA", "DEMA", "WMA"],
            default=["WMA", "EMA"],
            help="Types of moving averages to include in the search",
            key="optimization_ma_types"
        )
        if not ma_type_options:
            ma_type_options = ["WMA"] 
        
        ma_length_min = st.number_input("MA Length Min", min_value=50, max_value=400, value=100, step=10, key="param_opt_ma_length_min")
        ma_length_max = st.number_input("MA Length Max", min_value=100, max_value=500, value=300, step=10, key="param_opt_ma_length_max")
    
    with col2:
        st.markdown("#### Z-Score Parameters")
        
        zscore_lookback_min = st.number_input("Z-Score Lookback Min", min_value=50, max_value=400, value=150, step=10, key="param_opt_zscore_lookback_min")
        zscore_lookback_max = st.number_input("Z-Score Lookback Max", min_value=100, max_value=500, value=250, step=10, key="param_opt_zscore_lookback_max")
        
        long_threshold_min = st.number_input("Buy Threshold Min", min_value=-1.0, max_value=1.0, value=0.0, step=0.1, key="param_opt_long_threshold_min")
        long_threshold_max = st.number_input("Buy Threshold Max", min_value=0.0, max_value=2.0, value=0.5, step=0.1, key="param_opt_long_threshold_max")
    
    with col3:
        st.markdown("#### Additional Parameters")
        
        short_threshold_min = st.number_input("Sell Threshold Min", min_value=-2.0, max_value=0.0, value=-1.0, step=0.1, key="param_opt_short_threshold_min")
        short_threshold_max = st.number_input("Sell Threshold Max", min_value=-1.0, max_value=1.0, value=0.0, step=0.1, key="param_opt_short_threshold_max")
        
        combine_methods = st.multiselect(
            "Combination Methods to Test",
            options=["average", "weighted", "consensus"],
            default=["average", "weighted"],
            help="Select which methods to include in the optimization",
            key="optimization_combine_methods"
        )
        
        if not combine_methods:
            combine_methods = ["average"]  # Default to average if nothing selected
        
        weight_range = st.checkbox("Optimize Weights (for weighted method)", value=True)
        
        weights_min = 0.2 if weight_range else 0.5
        weights_max = 0.8 if weight_range else 0.5
        
        initial_capital = st.number_input("Initial Capital", min_value=100, max_value=50000, value=1000, step=1000, key="param_opt_initial_capital")
    
    # Divider
    st.markdown("---")
    
    # Method-specific settings
    col1, col2 = st.columns(2)
    
    with col1:
        if selected_method == "Bayesian Optimization":
            n_calls = st.slider(
                "Number of Evaluations",
                min_value=10,
                max_value=10000,
                value=50,
                step=5,
                help="Number of parameter combinations to evaluate. Bayesian optimization is more efficient than random search."
            )
            
            # Add initialization method selection
            init_method = st.selectbox(
                "Initialization Method",
                options=["Random Points", "Manual Start Point"],
                index=0,
                help="Choose how to initialize the Bayesian optimization: random points or a manual starting point"
            )
            
            if init_method == "Random Points":
                n_initial_points = st.slider(
                    "Initial Random Points",
                    min_value=5,
                    max_value=20,
                    value=10,
                    step=1,
                    help="Number of random points to start with before using Bayesian optimization"
                )
            else:  # Manual Start Point
                st.markdown("**Manual Start Point Configuration:**")
                
                manual_ma_type = st.selectbox(
                    "Start MA Type",
                    options=ma_type_options,
                    index=0,
                    help="Starting moving average type"
                )
                
                manual_ma_length = st.number_input(
                    "Start MA Length",
                    min_value=ma_length_min,
                    max_value=ma_length_max,
                    value=(ma_length_min + ma_length_max) // 2,
                    step=10,
                    help="Starting MA length"
                )
                
                manual_zscore_lookback = st.number_input(
                    "Start Z-Score Lookback",
                    min_value=zscore_lookback_min,
                    max_value=zscore_lookback_max,
                    value=(zscore_lookback_min + zscore_lookback_max) // 2,
                    step=10,
                    help="Starting Z-Score lookback period"
                )
                
                manual_long_threshold = st.number_input(
                    "Start Buy Threshold",
                    min_value=long_threshold_min,
                    max_value=long_threshold_max,
                    value=(long_threshold_min + long_threshold_max) / 2,
                    step=0.05,
                    format="%.2f",
                    help="Starting buy threshold"
                )
                
                manual_short_threshold = st.number_input(
                    "Start Sell Threshold",
                    min_value=short_threshold_min,
                    max_value=short_threshold_max,
                    value=(short_threshold_min + short_threshold_max) / 2,
                    step=0.05,
                    format="%.2f",
                    help="Starting sell threshold"
                )
                
                manual_combine_method = st.selectbox(
                    "Start Combine Method",
                    options=combine_methods,
                    index=0,
                    help="Starting combination method"
                )
                
                manual_mvrv_weight = st.slider(
                    "Start MVRV Weight",
                    min_value=weights_min,
                    max_value=weights_max,
                    value=(weights_min + weights_max) / 2,
                    step=0.05,
                    help="Starting MVRV weight (for weighted method)"
                )
                
                # Store manual parameters
                manual_start_point = {
                    'ma_type': manual_ma_type,
                    'ma_length': manual_ma_length,
                    'zscore_lookback': manual_zscore_lookback,
                    'long_threshold': manual_long_threshold,
                    'short_threshold': manual_short_threshold,
                    'combine_method': manual_combine_method,
                    'mvrv_weight': manual_mvrv_weight
                }
                
                n_initial_points = 1  # Only one initial point when manual
            
            acquisition_func = st.selectbox(
                "Acquisition Function",
                options=["gp_hedge", "EI", "LCB", "PI"],
                index=0,
                help="gp_hedge=Adaptive (Recommended), EI=Expected Improvement, LCB=Lower Confidence Bound, PI=Probability of Improvement"
            )
            
        elif selected_method == "Genetic Algorithm":
            population_size = st.slider(
                "Population Size",
                min_value=20,
                max_value=100,
                value=50,
                step=10,
                help="Number of individuals in each generation"
            )
            
            n_generations = st.slider(
                "Number of Generations",
                min_value=10,
                max_value=100,
                value=30,
                step=5,
                help="Number of generations to evolve"
            )
            
            mutation_rate = st.slider(
                "Mutation Rate",
                min_value=0.01,
                max_value=0.3,
                value=0.1,
                step=0.01,
                help="Probability of mutation for each parameter"
            )
            
            crossover_rate = st.slider(
                "Crossover Rate",
                min_value=0.5,
                max_value=1.0,
                value=0.8,
                step=0.05,
                help="Probability of crossover between parents"
            )
            
        else:  # Random Search
            num_iterations = st.slider(
                "Number of Iterations",
                min_value=10,
                max_value=10000,
                value=100,
                step=10,
                help="Number of random parameter combinations to try"
            )
    
    with col2:
        optimization_metric = st.selectbox(
            "Optimization Target Metric",
            options=["Total Return", "Sharpe Ratio", "Win Rate", "Profit Factor", "Outperformance vs Buy & Hold", "Return to Drawdown Ratio"],
            index=0,
            help="Select the performance metric you want to maximize"
        )
        
        plot_scale = st.selectbox(
            "Progress Plot Scale",
            options=["Linear", "Log"],
            index=0,
            help="Choose linear or logarithmic scale for the optimization progress plot"
        )
        
        use_smaller_dataset = st.checkbox(
            "Use Recent Data Only (Faster)", 
            value=True,
            help="Optimize using only recent data to speed up the process"
        )
        
        if use_smaller_dataset:
            lookback_period = st.slider(
                "Lookback Period (Days)",
                min_value=90,
                max_value=1825,  # ~5 years
                value=365,
                step=30,
                help="Number of days of historical data to use"
            )
    
    # Function definitions for optimization methods
    
    # Random Search Implementation
    def optimize_combined_strategy(data, metric, iterations, 
                                   ma_types, ma_min, ma_max, 
                                   zscore_min, zscore_max, 
                                   long_min, long_max, 
                                   short_min, short_max,
                                   combine_methods, 
                                   weight_min, weight_max, 
                                   capital):
        """
        Optimize strategy parameters using random search
        """
        # Create progress elements
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        # Store results
        results = []
        
        # Run random search
        for i in range(iterations):
            # Generate random parameter set
            random_params = {
                'ma_type': np.random.choice(ma_types),
                'ma_length': np.random.randint(ma_min, ma_max + 1),
                'zscore_lookback': np.random.randint(zscore_min, zscore_max + 1),
                'long_threshold': np.random.uniform(long_min, long_max),
                'short_threshold': np.random.uniform(short_min, short_max),
                'combine_method': np.random.choice(combine_methods),
                'initial_capital': capital
            }
            
            # Add random weights if using weighted method
            if random_params['combine_method'] == 'weighted':
                random_params['mvrv_weight'] = np.random.uniform(weight_min, weight_max)
                random_params['nupl_weight'] = 1.0 - random_params['mvrv_weight']
            else:
                random_params['mvrv_weight'] = 0.5
                random_params['nupl_weight'] = 0.5
            
            try:
                # Run strategy with parameters
                result_df = run_combined_strategy(data.copy(), random_params)
                
                # Calculate metrics
                initial_value = result_df['PORTFOLIO_VALUE'].iloc[0]
                final_value = result_df['PORTFOLIO_VALUE'].iloc[-1]
                buy_hold_final = result_df['BUY_HOLD_VALUE'].iloc[-1]
                
                total_return = (final_value / initial_value - 1) * 100
                buy_hold_return = (buy_hold_final / initial_value - 1) * 100
                outperformance = total_return - buy_hold_return
                
                trades = (result_df['SIGNAL'] != 0).sum()
                
                # Calculate win rate and other metrics
                buy_indices = result_df[result_df['SIGNAL'] == 1].index
                sell_indices = result_df[result_df['SIGNAL'] == -1].index
                
                profit_trades = 0
                loss_trades = 0
                total_profit = 0
                total_loss = 0
                current_buy_idx = None
                
                # Match buy/sell pairs and calculate metrics
                for idx in sorted(result_df.index):
                    if idx in buy_indices:
                        current_buy_idx = idx
                    elif idx in sell_indices and current_buy_idx is not None:
                        buy_price = result_df.loc[current_buy_idx, 'PRICE']
                        sell_price = result_df.loc[idx, 'PRICE']
                        pnl_pct = (sell_price / buy_price - 1) * 100
                        
                        if pnl_pct > 0:
                            profit_trades += 1
                            total_profit += pnl_pct
                        else:
                            loss_trades += 1
                            total_loss += pnl_pct
                        current_buy_idx = None
                
                completed_trades = profit_trades + loss_trades
                win_rate = (profit_trades / completed_trades * 100) if completed_trades > 0 else 0
                
                # Calculate Sharpe ratio (annualized)
                daily_returns = result_df['STRATEGY_RETURNS'].fillna(0)
                sharpe_ratio = np.sqrt(252) * (daily_returns.mean() / daily_returns.std()) if daily_returns.std() > 0 else 0
                
                # Calculate max drawdown
                portfolio_values = result_df['PORTFOLIO_VALUE'].values
                max_drawdown = 0
                peak = portfolio_values[0]
                for value in portfolio_values:
                    if value > peak:
                        peak = value
                    drawdown = (peak - value) / peak * 100
                    if drawdown > max_drawdown:
                        max_drawdown = drawdown
                
                # Calculate profit factor
                if abs(total_loss) > 0:
                    profit_factor = abs(total_profit) / abs(total_loss)
                else:
                    profit_factor = float('inf') if total_profit > 0 else 0
                
                # Calculate return to drawdown ratio
                return_to_drawdown = total_return / max(max_drawdown, 0.01)
                
                # Store result
                result = {
                    'params': random_params,
                    'total_return': total_return,
                    'sharpe_ratio': sharpe_ratio,
                    'win_rate': win_rate,
                    'profit_factor': profit_factor,
                    'outperformance': outperformance,
                    'max_drawdown': max_drawdown,
                    'return_to_drawdown': return_to_drawdown,
                    'trades': trades
                }
                
                results.append(result)
                
                # Update progress
                progress = (i + 1) / iterations
                progress_bar.progress(progress)
                
                # Calculate best score so far
                if metric == "Total Return":
                    best_score = max([r['total_return'] for r in results])
                elif metric == "Sharpe Ratio":
                    best_score = max([r['sharpe_ratio'] for r in results])
                elif metric == "Win Rate":
                    best_score = max([r['win_rate'] for r in results])
                elif metric == "Profit Factor":
                    best_score = max([r['profit_factor'] for r in results])
                elif metric == "Outperformance vs Buy & Hold":
                    best_score = max([r['outperformance'] for r in results])
                else:  # Return to Drawdown Ratio
                    best_score = max([r['return_to_drawdown'] for r in results])
                
                status_text.text(f"Iteration {i+1}/{iterations} - Progress: {int(progress*100)}% - Best {metric}: {best_score:.2f}")
                
            except Exception as e:
                status_text.error(f"Error in iteration {i+1}: {str(e)}")
                continue
        
        # Sort results based on selected metric
        if metric == "Total Return":
            results.sort(key=lambda x: x['total_return'], reverse=True)
        elif metric == "Sharpe Ratio":
            results.sort(key=lambda x: x['sharpe_ratio'], reverse=True)
        elif metric == "Win Rate":
            results.sort(key=lambda x: x['win_rate'], reverse=True)
        elif metric == "Profit Factor":
            results.sort(key=lambda x: x['profit_factor'], reverse=True)
        elif metric == "Outperformance vs Buy & Hold":
            results.sort(key=lambda x: x['outperformance'], reverse=True)
        else:  # Return to Drawdown Ratio
            results.sort(key=lambda x: x['return_to_drawdown'], reverse=True)
        
        return results[:10]  # Return top 10 results
    
    # Bayesian Optimization Implementation
    def bayesian_optimization(data, metric, n_calls, n_initial_points, acq_func, plot_scale="Linear", init_method="Random Points", manual_start_point=None):
        """
        Bayesian Optimization using Gaussian Process with real-time progress plotting
        """
        if not BAYESIAN_AVAILABLE:
            st.error("scikit-optimize not available. Please install with: pip install scikit-optimize")
            return []
            
        # Define search space
        dimensions = [
            Categorical(ma_type_options, name='ma_type'),
            Integer(ma_length_min, ma_length_max, name='ma_length'),
            Integer(zscore_lookback_min, zscore_lookback_max, name='zscore_lookback'),
            Real(long_threshold_min, long_threshold_max, name='long_threshold'),
            Real(short_threshold_min, short_threshold_max, name='short_threshold'),
            Categorical(combine_methods, name='combine_method'),
            Real(weights_min, weights_max, name='mvrv_weight') if weight_range else Real(0.5, 0.5, name='mvrv_weight')
        ]
        
        # Create progress elements
        progress_bar = st.progress(0)
        status_text = st.empty()
        progress_chart_container = st.empty()
        results_container = st.empty()
        
        # Store all results and progress data for display
        all_results = []
        progress_data = {'iteration': [], 'return': [], 'best_so_far': []}
        
        # Prepare initial points if manual start point is provided
        x0 = None
        y0 = None
        
        if init_method == "Manual Start Point" and manual_start_point is not None:
            # Convert manual start point to the format expected by skopt
            manual_point = [
                manual_start_point['ma_type'],
                manual_start_point['ma_length'],
                manual_start_point['zscore_lookback'],
                manual_start_point['long_threshold'],
                manual_start_point['short_threshold'],
                manual_start_point['combine_method'],
                manual_start_point['mvrv_weight']
            ]
            
            # Evaluate the manual start point first
            status_text.text("Evaluating manual start point...")
            
            try:
                strategy_params = {
                    'ma_type': manual_start_point['ma_type'],
                    'ma_length': manual_start_point['ma_length'],
                    'zscore_lookback': manual_start_point['zscore_lookback'],
                    'long_threshold': manual_start_point['long_threshold'],
                    'short_threshold': manual_start_point['short_threshold'],
                    'combine_method': manual_start_point['combine_method'],
                    'mvrv_weight': manual_start_point['mvrv_weight'],
                    'nupl_weight': 1.0 - manual_start_point['mvrv_weight'],
                    'initial_capital': initial_capital
                }
                
                # Run strategy with manual start point
                result_df = run_combined_strategy(data.copy(), strategy_params)
                
                # Calculate metrics
                initial_value = result_df['PORTFOLIO_VALUE'].iloc[0]
                final_value = result_df['PORTFOLIO_VALUE'].iloc[-1]
                buy_hold_final = result_df['BUY_HOLD_VALUE'].iloc[-1]
                
                total_return = (final_value / initial_value - 1) * 100
                buy_hold_return = (buy_hold_final / initial_value - 1) * 100
                outperformance = total_return - buy_hold_return
                
                # Calculate additional metrics
                trades = (result_df['SIGNAL'] != 0).sum()
                daily_returns = result_df['STRATEGY_RETURNS'].fillna(0)
                sharpe_ratio = np.sqrt(252) * (daily_returns.mean() / daily_returns.std()) if daily_returns.std() > 0 else 0
                
                # Calculate max drawdown
                portfolio_values = result_df['PORTFOLIO_VALUE'].values
                max_drawdown = 0
                peak = portfolio_values[0]
                for value in portfolio_values:
                    if value > peak:
                        peak = value
                    drawdown = (peak - value) / peak * 100
                    if drawdown > max_drawdown:
                        max_drawdown = drawdown
                
                # Calculate win rate and profit factor
                buy_indices = result_df[result_df['SIGNAL'] == 1].index
                sell_indices = result_df[result_df['SIGNAL'] == -1].index
                profit_trades = 0
                loss_trades = 0
                total_profit = 0
                total_loss = 0
                current_buy_idx = None
                
                for idx in sorted(result_df.index):
                    if idx in buy_indices:
                        current_buy_idx = idx
                    elif idx in sell_indices and current_buy_idx is not None:
                        buy_price = result_df.loc[current_buy_idx, 'PRICE']
                        sell_price = result_df.loc[idx, 'PRICE']
                        pnl_pct = (sell_price / buy_price - 1) * 100
                        
                        if pnl_pct > 0:
                            profit_trades += 1
                            total_profit += pnl_pct
                        else:
                            loss_trades += 1
                            total_loss += pnl_pct
                        current_buy_idx = None
                
                completed_trades = profit_trades + loss_trades
                win_rate = (profit_trades / completed_trades * 100) if completed_trades > 0 else 0
                profit_factor = (abs(total_profit) / abs(total_loss)) if abs(total_loss) > 0 else float('inf')
                return_to_drawdown = total_return / max(max_drawdown, 0.01)
                
                # Store result
                result = {
                    'params': strategy_params,
                    'total_return': total_return,
                    'sharpe_ratio': sharpe_ratio,
                    'win_rate': win_rate,
                    'profit_factor': profit_factor,
                    'outperformance': outperformance,
                    'max_drawdown': max_drawdown,
                    'return_to_drawdown': return_to_drawdown,
                    'trades': trades
                }
                
                all_results.append(result)
                
                # Get metric value for optimization
                if metric == "Total Return":
                    metric_value = total_return
                elif metric == "Sharpe Ratio":
                    metric_value = sharpe_ratio
                elif metric == "Win Rate":
                    metric_value = win_rate
                elif metric == "Profit Factor":
                    metric_value = profit_factor if profit_factor != float('inf') else 100
                elif metric == "Outperformance vs Buy & Hold":
                    metric_value = outperformance
                else:  # Return to Drawdown Ratio
                    metric_value = return_to_drawdown
                
                # Set up initial points for skopt
                x0 = [manual_point]
                y0 = [-metric_value]  # Negative because skopt minimizes
                
                status_text.text(f"Manual start point evaluated: {metric} = {metric_value:.2f}")
                
                # Update progress data
                progress_data['iteration'].append(1)
                progress_data['return'].append(total_return)
                progress_data['best_so_far'].append(metric_value)
                
            except Exception as e:
                st.error(f"Error evaluating manual start point: {str(e)}")
                # Fall back to random initialization
                x0 = None
                y0 = None
                n_initial_points = 5
        
        @use_named_args(dimensions)
        def objective(**params):
            """Objective function for Bayesian optimization"""
            try:
                # Convert parameters
                strategy_params = {
                    'ma_type': params['ma_type'],
                    'ma_length': params['ma_length'],
                    'zscore_lookback': params['zscore_lookback'],
                    'long_threshold': params['long_threshold'],
                    'short_threshold': params['short_threshold'],
                    'combine_method': params['combine_method'],
                    'mvrv_weight': params['mvrv_weight'],
                    'nupl_weight': 1.0 - params['mvrv_weight'],
                    'initial_capital': initial_capital
                }
                
                # Run strategy
                result_df = run_combined_strategy(data.copy(), strategy_params)
                
                # Calculate metrics (same as other methods)
                initial_value = result_df['PORTFOLIO_VALUE'].iloc[0]
                final_value = result_df['PORTFOLIO_VALUE'].iloc[-1]
                buy_hold_final = result_df['BUY_HOLD_VALUE'].iloc[-1]
                
                total_return = (final_value / initial_value - 1) * 100
                buy_hold_return = (buy_hold_final / initial_value - 1) * 100
                outperformance = total_return - buy_hold_return
                
                # Calculate additional metrics
                trades = (result_df['SIGNAL'] != 0).sum()
                daily_returns = result_df['STRATEGY_RETURNS'].fillna(0)
                sharpe_ratio = np.sqrt(252) * (daily_returns.mean() / daily_returns.std()) if daily_returns.std() > 0 else 0
                
                # Calculate max drawdown
                portfolio_values = result_df['PORTFOLIO_VALUE'].values
                max_drawdown = 0
                peak = portfolio_values[0]
                for value in portfolio_values:
                    if value > peak:
                        peak = value
                    drawdown = (peak - value) / peak * 100
                    if drawdown > max_drawdown:
                        max_drawdown = drawdown
                
                # Calculate win rate and profit factor
                buy_indices = result_df[result_df['SIGNAL'] == 1].index
                sell_indices = result_df[result_df['SIGNAL'] == -1].index
                profit_trades = 0
                loss_trades = 0
                total_profit = 0
                total_loss = 0
                current_buy_idx = None
                
                for idx in sorted(result_df.index):
                    if idx in buy_indices:
                        current_buy_idx = idx
                    elif idx in sell_indices and current_buy_idx is not None:
                        buy_price = result_df.loc[current_buy_idx, 'PRICE']
                        sell_price = result_df.loc[idx, 'PRICE']
                        pnl_pct = (sell_price / buy_price - 1) * 100
                        
                        if pnl_pct > 0:
                            profit_trades += 1
                            total_profit += pnl_pct
                        else:
                            loss_trades += 1
                            total_loss += pnl_pct
                        current_buy_idx = None
                
                completed_trades = profit_trades + loss_trades
                win_rate = (profit_trades / completed_trades * 100) if completed_trades > 0 else 0
                profit_factor = (abs(total_profit) / abs(total_loss)) if abs(total_loss) > 0 else float('inf')
                return_to_drawdown = total_return / max(max_drawdown, 0.01)
                
                # Store result
                result = {
                    'params': strategy_params,
                    'total_return': total_return,
                    'sharpe_ratio': sharpe_ratio,
                    'win_rate': win_rate,
                    'profit_factor': profit_factor,
                    'outperformance': outperformance,
                    'max_drawdown': max_drawdown,
                    'return_to_drawdown': return_to_drawdown,
                    'trades': trades
                }
                
                all_results.append(result)
                current_iter = len(all_results)
                
                # Update progress data
                progress_data['iteration'].append(current_iter)
                progress_data['return'].append(total_return)
                
                # Calculate best so far
                if metric == "Total Return":
                    best_so_far = max([r['total_return'] for r in all_results])
                elif metric == "Sharpe Ratio":
                    best_so_far = max([r['sharpe_ratio'] for r in all_results])
                elif metric == "Win Rate":
                    best_so_far = max([r['win_rate'] for r in all_results])
                elif metric == "Profit Factor":
                    best_so_far = max([r['profit_factor'] for r in all_results if r['profit_factor'] != float('inf')])
                elif metric == "Outperformance vs Buy & Hold":
                    best_so_far = max([r['outperformance'] for r in all_results])
                else:  # Return to Drawdown Ratio
                    best_so_far = max([r['return_to_drawdown'] for r in all_results])
                
                progress_data['best_so_far'].append(best_so_far)
                
                # Update progress and display
                progress_bar.progress(min(current_iter / n_calls, 1.0))
                
                # Show different status based on initialization method
                if init_method == "Manual Start Point" and current_iter == 1:
                    status_text.text(f"Manual Start Point - {metric}: {best_so_far:.2f}")
                else:
                    status_text.text(f"Bayesian Evaluation {current_iter}/{n_calls} - Current: {total_return:.2f}% - Best {metric}: {best_so_far:.2f}")
                
                # Update progress chart every iteration (but limit updates for performance)
                if current_iter % 2 == 0 or current_iter <= 5 or current_iter == n_calls:
                    with progress_chart_container.container():
                        st.subheader("Optimization Progress")
                        
                        # Create progress chart
                        progress_fig = go.Figure()
                        
                        # Add current returns
                        progress_fig.add_trace(go.Scatter(
                            x=progress_data['iteration'],
                            y=progress_data['return'],
                            mode='markers+lines',
                            name='Individual Returns',
                            marker=dict(size=6, color=COLORS["neutral"], opacity=0.7),
                            line=dict(width=1, color=COLORS["neutral"], dash='dot')
                        ))
                        
                        # Add best so far line
                        progress_fig.add_trace(go.Scatter(
                            x=progress_data['iteration'],
                            y=progress_data['best_so_far'],
                            mode='lines+markers',
                            name=f'Best {metric}',
                            line=dict(width=3, color=COLORS["green"]),
                            marker=dict(size=8, color=COLORS["green"])
                        ))
                        
                        # Highlight manual start point if used
                        if init_method == "Manual Start Point" and len(progress_data['iteration']) >= 1:
                            progress_fig.add_trace(go.Scatter(
                                x=[1],
                                y=[progress_data['return'][0]],
                                mode='markers',
                                name='Manual Start Point',
                                marker=dict(size=12, color=COLORS["accent"], symbol='star'),
                                showlegend=True
                            ))
                        
                        # Update layout
                        progress_fig.update_layout(
                            title=f"Bayesian Optimization Progress - {metric} ({init_method})",
                            xaxis_title="Iteration",
                            yaxis_title=f"{metric} (%)" if "%" in metric or "Return" in metric else metric,
                            height=400,
                            plot_bgcolor="rgba(0,0,0,0)",
                            paper_bgcolor="rgba(0,0,0,0)",
                            showlegend=True,
                            hovermode="x unified",
                            yaxis_type="log" if plot_scale == "Log" and min(progress_data['return']) > 0 else "linear"
                        )
                        
                        # Style axes
                        progress_fig.update_xaxes(gridcolor=COLORS["grid"], showgrid=True)
                        progress_fig.update_yaxes(gridcolor=COLORS["grid"], showgrid=True)
                        
                        st.plotly_chart(progress_fig, use_container_width=True)
                
                # Update live results display
                if current_iter % 5 == 0 or current_iter <= 10:  # Update every 5 iterations or first 10
                    with results_container.container():
                        st.subheader("Top 5 Results So Far")
                        
                        metric_key = metric.lower().replace(' ', '_').replace('vs_buy_&_hold', 'vs_buy_hold')
                        if metric_key == 'outperformance_vs_buy_hold':
                            metric_key = 'outperformance'
                        
                        sorted_results = sorted(all_results, key=lambda x: x[metric_key], reverse=True)[:5]
                        
                        display_data = []
                        for i, res in enumerate(sorted_results, 1):
                            display_data.append({
                                'Rank': i,
                                'Return (%)': f"{res['total_return']:.2f}",
                                'Sharpe': f"{res['sharpe_ratio']:.2f}",
                                'Win Rate (%)': f"{res['win_rate']:.1f}",
                                'Method': res['params']['combine_method'],
                                'MA': f"{res['params']['ma_type']}-{res['params']['ma_length']}",
                                'Thresholds': f"{res['params']['long_threshold']:.2f}/{res['params']['short_threshold']:.2f}"
                            })
                        st.dataframe(pd.DataFrame(display_data), use_container_width=True, hide_index=True)
                
                # Return negative value for minimization (we want to maximize the metric)
                metric_value = 0
                if metric == "Total Return":
                    metric_value = total_return
                elif metric == "Sharpe Ratio":
                    metric_value = sharpe_ratio
                elif metric == "Win Rate":
                    metric_value = win_rate
                elif metric == "Profit Factor":
                    metric_value = profit_factor if profit_factor != float('inf') else 100
                elif metric == "Outperformance vs Buy & Hold":
                    metric_value = outperformance
                else:  # Return to Drawdown Ratio
                    metric_value = return_to_drawdown
                
                return -metric_value  # Negative because skopt minimizes
                
            except Exception as e:
                st.error(f"Error in Bayesian evaluation: {str(e)}")
                return 0  # Return neutral value on error
        
        # Run Bayesian optimization
        try:
            if acq_func == "EI":
                acquisition = "EI"
            elif acq_func == "LCB":
                acquisition = "LCB"
            elif acq_func == "PI":
                acquisition = "PI"
            else:  # gp_hedge or any other value
                acquisition = "gp_hedge"
            
            # Run optimization with or without initial points
            if x0 is not None and y0 is not None:
                result = gp_minimize(
                    func=objective,
                    dimensions=dimensions,
                    n_calls=n_calls,
                    n_initial_points=max(1, n_initial_points - 1),  # Subtract 1 because we already have the manual point
                    acq_func=acquisition,
                    x0=x0,
                    y0=y0,
                    random_state=42
                )
            else:
                result = gp_minimize(
                    func=objective,
                    dimensions=dimensions,
                    n_calls=n_calls,
                    n_initial_points=n_initial_points,
                    acq_func=acquisition,
                    random_state=42
                )
            
            # Sort all results by the target metric
            metric_key = metric.lower().replace(' ', '_').replace('vs_buy_&_hold', 'vs_buy_hold')
            if metric_key == 'outperformance_vs_buy_hold':
                metric_key = 'outperformance'
            
            all_results.sort(key=lambda x: x[metric_key], reverse=True)
            
            # Store progress data for insights
            st.session_state.optimization_progress = progress_data
            st.session_state.optimization_metric = metric
            
            return all_results[:10]  # Return top 10 results
            
        except Exception as e:
            st.error(f"Bayesian optimization failed: {str(e)}")
            return []
    
    # Genetic Algorithm Implementation (after the Bayesian optimization function)
    def genetic_algorithm_optimization(data, metric, pop_size, n_gen, mut_rate, cx_rate):
        """
        Genetic Algorithm optimization using DEAP or custom implementation
        """
        # Create progress elements
        progress_bar = st.progress(0)
        status_text = st.empty()
        results_container = st.empty()
        
        # Store all results
        all_results = []
        generation_stats = []
        
        if GA_AVAILABLE:
            # Use DEAP implementation
            import random
            
            # Define parameter encoding/decoding
            def encode_individual():
                """Create a random individual"""
                individual = []
                individual.append(random.choice(range(len(ma_type_options))))  # ma_type index
                individual.append(random.randint(ma_length_min, ma_length_max))  # ma_length
                individual.append(random.randint(zscore_lookback_min, zscore_lookback_max))  # zscore_lookback
                individual.append(random.uniform(long_threshold_min, long_threshold_max))  # long_threshold
                individual.append(random.uniform(short_threshold_min, short_threshold_max))  # short_threshold
                individual.append(random.choice(range(len(combine_methods))))  # combine_method index
                individual.append(random.uniform(weights_min, weights_max))  # mvrv_weight
                return individual
            
            def decode_individual(individual):
                """Convert individual to parameters"""
                return {
                    'ma_type': ma_type_options[int(individual[0])],
                    'ma_length': int(individual[1]),
                    'zscore_lookback': int(individual[2]),
                    'long_threshold': individual[3],
                    'short_threshold': individual[4],
                    'combine_method': combine_methods[int(individual[5])],
                    'mvrv_weight': individual[6],
                    'nupl_weight': 1.0 - individual[6],
                    'initial_capital': initial_capital
                }
            
            def evaluate_individual(individual):
                """Evaluate fitness of an individual"""
                try:
                    params = decode_individual(individual)
                    result_df = run_combined_strategy(data.copy(), params)
                    
                    # Calculate metrics (same as other methods)
                    initial_value = result_df['PORTFOLIO_VALUE'].iloc[0]
                    final_value = result_df['PORTFOLIO_VALUE'].iloc[-1]
                    buy_hold_final = result_df['BUY_HOLD_VALUE'].iloc[-1]
                
                    total_return = (final_value / initial_value - 1) * 100
                    buy_hold_return = (buy_hold_final / initial_value - 1) * 100
                    outperformance = total_return - buy_hold_return
                    
                    trades = (result_df['SIGNAL'] != 0).sum()
                    daily_returns = result_df['STRATEGY_RETURNS'].fillna(0)
                    sharpe_ratio = np.sqrt(252) * (daily_returns.mean() / daily_returns.std()) if daily_returns.std() > 0 else 0
                    
                    # Calculate max drawdown
                    portfolio_values = result_df['PORTFOLIO_VALUE'].values
                    max_drawdown = 0
                    peak = portfolio_values[0]
                    for value in portfolio_values:
                        if value > peak:
                            peak = value
                        drawdown = (peak - value) / peak * 100
                        if drawdown > max_drawdown:
                            max_drawdown = drawdown
                    
                    # Calculate win rate and profit factor
                    buy_indices = result_df[result_df['SIGNAL'] == 1].index
                    sell_indices = result_df[result_df['SIGNAL'] == -1].index
                    profit_trades = 0
                    loss_trades = 0
                    total_profit = 0
                    total_loss = 0
                    current_buy_idx = None
                
                    for idx in sorted(result_df.index):
                        if idx in buy_indices:
                            current_buy_idx = idx
                        elif idx in sell_indices and current_buy_idx is not None:
                            buy_price = result_df.loc[current_buy_idx, 'PRICE']
                            sell_price = result_df.loc[idx, 'PRICE']
                            pnl_pct = (sell_price / buy_price - 1) * 100
                            
                            if pnl_pct > 0:
                                profit_trades += 1
                                total_profit += pnl_pct
                            else:
                                loss_trades += 1
                                total_loss += pnl_pct
                            current_buy_idx = None
                
                    completed_trades = profit_trades + loss_trades
                    win_rate = (profit_trades / completed_trades * 100) if completed_trades > 0 else 0
                    profit_factor = (abs(total_profit) / abs(total_loss)) if abs(total_loss) > 0 else float('inf')
                    return_to_drawdown = total_return / max(max_drawdown, 0.01)
                    
                    # Store result
                    result = {
                        'params': params,
                        'total_return': total_return,
                        'sharpe_ratio': sharpe_ratio,
                        'win_rate': win_rate,
                        'profit_factor': profit_factor,
                        'outperformance': outperformance,
                        'max_drawdown': max_drawdown,
                        'return_to_drawdown': return_to_drawdown,
                        'trades': trades
                    }
                    
                    all_results.append(result)
                    
                    # Return fitness value
                    if metric == "Total Return":
                        return (total_return,)
                    elif metric == "Sharpe Ratio":
                        return (sharpe_ratio,)
                    elif metric == "Win Rate":
                        return (win_rate,)
                    elif metric == "Profit Factor":
                        return (profit_factor if profit_factor != float('inf') else 100,)
                    elif metric == "Outperformance vs Buy & Hold":
                        return (outperformance,)
                    else:  # Return to Drawdown Ratio
                        return (return_to_drawdown,)
                    
                except Exception as e:
                    return (0,)  # Return poor fitness on error
            
            # Set up DEAP
            creator.create("FitnessMax", base.Fitness, weights=(1.0,))
            creator.create("Individual", list, fitness=creator.FitnessMax)
            
            toolbox = base.Toolbox()
            toolbox.register("individual", tools.initIterate, creator.Individual, encode_individual)
            toolbox.register("population", tools.initRepeat, list, toolbox.individual)
            toolbox.register("evaluate", evaluate_individual)
            toolbox.register("mate", tools.cxTwoPoint)
            toolbox.register("mutate", tools.mutGaussian, mu=0, sigma=0.1, indpb=mut_rate)
            toolbox.register("select", tools.selTournament, tournsize=3)
            
            # Initialize population
            population = toolbox.population(n=pop_size)
            
            # Evaluate initial population
            fitnesses = list(map(toolbox.evaluate, population))
            for ind, fit in zip(population, fitnesses):
                ind.fitness.values = fit
            
            # Evolution loop
            for generation in range(n_gen):
                # Update progress
                progress = generation / n_gen
                progress_bar.progress(progress)
                
                # Selection and breeding
                offspring = toolbox.select(population, len(population))
                offspring = list(map(toolbox.clone, offspring))
                
                # Crossover
                for child1, child2 in zip(offspring[::2], offspring[1::2]):
                    if random.random() < cx_rate:
                        toolbox.mate(child1, child2)
                        del child1.fitness.values
                        del child2.fitness.values
                
                # Mutation
                for mutant in offspring:
                    if random.random() < mut_rate:
                        toolbox.mutate(mutant)
                        del mutant.fitness.values
                
                # Evaluate offspring with invalid fitness
                invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
                fitnesses = map(toolbox.evaluate, invalid_ind)
                for ind, fit in zip(invalid_ind, fitnesses):
                    ind.fitness.values = fit
                
                # Replace population
                population[:] = offspring
                
                # Statistics
                fits = [ind.fitness.values[0] for ind in population]
                generation_stats.append({
                    'generation': generation,
                    'max': max(fits),
                    'avg': np.mean(fits),
                    'min': min(fits)
                })
                
                status_text.text(f"Generation {generation + 1}/{n_gen} - Best fitness: {max(fits):.2f} - Avg: {np.mean(fits):.2f}")
                
                # Update live results every 5 generations
                if generation % 5 == 0 or generation == n_gen - 1:
                    with results_container.container():
                        st.subheader("Genetic Algorithm Progress")
                        
                        # Show generation statistics
                        if len(generation_stats) > 1:
                            stats_df = pd.DataFrame(generation_stats)
                            fig = go.Figure()
                            fig.add_trace(go.Scatter(x=stats_df['generation'], y=stats_df['max'], name='Best', line=dict(color='green')))
                            fig.add_trace(go.Scatter(x=stats_df['generation'], y=stats_df['avg'], name='Average', line=dict(color='blue')))
                                
                            fig.update_layout(
                                title=f"Fitness Evolution - {metric}",
                                xaxis_title="Generation",
                                yaxis_title="Fitness",
                                height=300,
                                plot_bgcolor="rgba(0,0,0,0)",
                                paper_bgcolor="rgba(0,0,0,0)"
                            )
                            st.plotly_chart(fig, use_container_width=True)
                            
                        # Show top 5 individuals
                        if all_results:
                            metric_key = metric.lower().replace(' ', '_').replace('vs_buy_&_hold', 'vs_buy_hold')
                            if metric_key == 'outperformance_vs_buy_hold':
                                metric_key = 'outperformance'
                            
                            sorted_results = sorted(all_results, key=lambda x: x[metric_key], reverse=True)[:5]
                            
                            display_data = []
                            for i, res in enumerate(sorted_results, 1):
                                display_data.append({
                                    'Rank': i,
                                    'Return (%)': f"{res['total_return']:.2f}",
                                    'Sharpe': f"{res['sharpe_ratio']:.2f}",
                                    'Win Rate (%)': f"{res['win_rate']:.1f}",
                                    'Method': res['params']['combine_method'],
                                    'MA': f"{res['params']['ma_type']}-{res['params']['ma_length']}",
                                    'Thresholds': f"{res['params']['long_threshold']:.2f}/{res['params']['short_threshold']:.2f}"
                                })
                            st.dataframe(pd.DataFrame(display_data), use_container_width=True)
            
        else:
            # Custom simple GA implementation
            st.warning("DEAP not available. Using simplified genetic algorithm.")
            
            # Simple GA implementation fallback
            all_results = optimize_combined_strategy(data, metric, pop_size * n_gen, 
                                                   ma_type_options, ma_length_min, ma_length_max,
                                                   zscore_lookback_min, zscore_lookback_max,
                                                   long_threshold_min, long_threshold_max,
                                                   short_threshold_min, short_threshold_max,
                                                   combine_methods, weights_min, weights_max, initial_capital)
        
        # Sort final results
        metric_key = metric.lower().replace(' ', '_').replace('vs_buy_&_hold', 'vs_buy_hold')
        if metric_key == 'outperformance_vs_buy_hold':
            metric_key = 'outperformance'
        
        all_results.sort(key=lambda x: x[metric_key], reverse=True)
        
        return all_results[:10]  # Return top 10 results
    
    # Optimization Insights Generation
    def generate_optimization_insights(results, method_name):
        """
        Generate insights about the optimization process and results
        """
        if not results or len(results) < 3:
            return "Insufficient data for generating insights."
        
        insights = []
        
        # Basic statistics
        returns = [r['total_return'] for r in results[:10]]  # Top 10 results
        sharpe_ratios = [r['sharpe_ratio'] for r in results[:10]]
        win_rates = [r['win_rate'] for r in results[:10]]
        
        # Performance insights
        best_return = max(returns)
        avg_return_top5 = np.mean(returns[:5])
        return_std = np.std(returns)
        
        insights.append(f"**Performance analysis:**")
        insights.append(f"   • Best strategy return: **{best_return:.2f}%**")
        insights.append(f"   • Average of top 5 strategies: **{avg_return_top5:.2f}%**")
        insights.append(f"   • Return variability (std): **{return_std:.2f}%**")
        
        if return_std < 5:
            insights.append(f"   • Low variability suggests consistent parameter regions")
        elif return_std > 15:
            insights.append(f"   • High variability suggests sensitive parameter tuning required")
        
        # Parameter analysis
        insights.append(f"\n**Parameter analysis:**")
        
        # Analyze combination methods
        methods = [r['params']['combine_method'] for r in results[:10]]
        method_counts = {method: methods.count(method) for method in set(methods)}
        best_method = max(method_counts.keys(), key=lambda x: method_counts[x])
        
        insights.append(f"   • Most successful combine method: **{best_method}** ({method_counts[best_method]}/10 top results)")
        
        # Analyze MA types
        ma_types = [r['params']['ma_type'] for r in results[:10]]
        ma_counts = {ma: ma_types.count(ma) for ma in set(ma_types)}
        best_ma = max(ma_counts.keys(), key=lambda x: ma_counts[x])
        
        insights.append(f"   • Most successful MA type: **{best_ma}** ({ma_counts[best_ma]}/10 top results)")
        
        # Analyze parameter ranges
        ma_lengths = [r['params']['ma_length'] for r in results[:10]]
        zscore_lookbacks = [r['params']['zscore_lookback'] for r in results[:10]]
        long_thresholds = [r['params']['long_threshold'] for r in results[:10]]
        short_thresholds = [r['params']['short_threshold'] for r in results[:10]]
        
        insights.append(f"   • Optimal MA length range: **{min(ma_lengths)} - {max(ma_lengths)}** (avg: {np.mean(ma_lengths):.0f})")
        insights.append(f"   • Optimal Z-Score lookback range: **{min(zscore_lookbacks)} - {max(zscore_lookbacks)}** (avg: {np.mean(zscore_lookbacks):.0f})")
        insights.append(f"   • Optimal buy threshold range: **{min(long_thresholds):.2f} - {max(long_thresholds):.2f}** (avg: {np.mean(long_thresholds):.2f})")
        insights.append(f"   • Optimal sell threshold range: **{min(short_thresholds):.2f} - {max(short_thresholds):.2f}** (avg: {np.mean(short_thresholds):.2f})")
        
        # Risk analysis
        insights.append(f"\n**Risk analysis:**")
        max_drawdowns = [r['max_drawdown'] for r in results[:10]]
        avg_drawdown = np.mean(max_drawdowns)
        min_drawdown = min(max_drawdowns)
        
        insights.append(f"   • Average max drawdown: **{avg_drawdown:.2f}%**")
        insights.append(f"   • Best drawdown control: **{min_drawdown:.2f}%**")
        
        if avg_drawdown < 20:
            insights.append(f"   • Acceptable risk levels across top strategies")
        elif avg_drawdown > 35:
            insights.append(f"   • High drawdown risk - consider more conservative parameters")
        
        # Trading frequency analysis
        trade_counts = [r['trades'] for r in results[:10]]
        avg_trades = np.mean(trade_counts)
        
        insights.append(f"\n📊 **Trading Activity:**")
        insights.append(f"   • Average trades per strategy: **{avg_trades:.1f}**")
        
        if avg_trades < 10:
            insights.append(f"   • Low frequency strategy - fewer but potentially higher conviction trades")
        elif avg_trades > 50:
            insights.append(f"   • High frequency strategy - more active trading approach")
        
        insights.append(f"\n**Trading activity:**")
        
        # Convergence analysis (if we have progress data)
        if hasattr(st.session_state, 'optimization_progress') and st.session_state.optimization_progress:
            progress = st.session_state.optimization_progress
            if len(progress['best_so_far']) > 5:
                insights.append(f"\n**Convergence analysis:**")
                
                # Check how quickly the best result improved
                best_final = progress['best_so_far'][-1]
                best_at_25pct = progress['best_so_far'][len(progress['best_so_far'])//4] if len(progress['best_so_far']) > 4 else progress['best_so_far'][0]
                
                improvement_rate = (best_final - best_at_25pct) / max(abs(best_at_25pct), 0.1)
                
                if improvement_rate < 0.1:
                    insights.append(f"   • Quick convergence - optimal region found early")
                    insights.append(f"   • Consider reducing iterations for efficiency")
                else:
                    insights.append(f"   • Gradual improvement throughout optimization")
                    insights.append(f"   • Consider increasing iterations for better results")
        
        # Method-specific insights
        insights.append(f"\n**{method_name} specific:**")
        if method_name == "Bayesian Optimization":
            insights.append(f"   • Efficient exploration of parameter space")
            insights.append(f"   • Good balance of exploration vs exploitation")
            if len(results) > 20:
                insights.append(f"   • Consider reducing evaluations for faster results")
        elif method_name == "Genetic Algorithm":
            insights.append(f"   • Robust global search with evolutionary principles")
            insights.append(f"   • Good for complex parameter interactions")
        else:  # Random Search
            insights.append(f"   • Unbiased exploration of parameter space")
            insights.append(f"   • Consider upgrading to Bayesian optimization for efficiency")
        
        # Recommendations
        insights.append(f"\n**Recommendations:**")
        
        if best_return > 100:  # Very good performance
            insights.append(f"   • Excellent results! Consider testing on out-of-sample data")
            insights.append(f"   • Monitor for overfitting with forward testing")
        elif best_return > 50:  # Good performance
            insights.append(f"   • Good performance. Consider fine-tuning around optimal parameters")
        else:  # Poor performance
            insights.append(f"   • Consider expanding parameter search ranges")
            insights.append(f"   • Review strategy logic and market regime applicability")
        
        if return_std > 20:
            insights.append(f"   • High parameter sensitivity - use ensemble of top strategies")
        
        return "\n".join(insights)
    
    # Initialize session state for optimization results
    if 'optimization_results' not in st.session_state:
        st.session_state.optimization_results = None
        st.session_state.best_params = None
    
    # Button to run optimization
    optimization_button_text = f"Run {selected_method}"
    if st.button(optimization_button_text, type="primary", key="run_advanced_optimization"):
        with st.spinner(f"Running {selected_method.lower()}..."):
            # Prepare data for optimization
            if use_smaller_dataset:
                # Use only the most recent data
                if isinstance(raw_data.index, pd.DatetimeIndex):
                    end_date = raw_data.index.max()
                    start_date = end_date - pd.Timedelta(days=lookback_period)
                    optimization_data = raw_data.loc[start_date:].copy()
                else:
                    # If index is not datetime, use the last N rows
                    optimization_data = raw_data.tail(lookback_period).copy()
            else:
                optimization_data = raw_data.copy()
            
            # Run selected optimization method
            if selected_method == "Bayesian Optimization" and BAYESIAN_AVAILABLE:
                # Prepare manual start point if needed
                manual_params = None
                if init_method == "Manual Start Point":
                    manual_params = manual_start_point
                
                st.session_state.optimization_results = bayesian_optimization(
                    optimization_data, 
                    optimization_metric, 
                    n_calls, 
                    n_initial_points, 
                    acquisition_func,
                    plot_scale,
                    init_method,
                    manual_params
                )
            elif selected_method == "Genetic Algorithm" and GA_AVAILABLE:
                st.session_state.optimization_results = genetic_algorithm_optimization(
                    optimization_data, 
                    optimization_metric, 
                    population_size, 
                    n_generations, 
                    mutation_rate, 
                    crossover_rate
                )
            else:  # Random Search or fallback
                iterations = num_iterations if selected_method == "Random Search" else 50
                st.session_state.optimization_results = optimize_combined_strategy(
                    optimization_data, 
                    optimization_metric, 
                    iterations, 
                    ma_type_options, 
                    ma_length_min, 
                    ma_length_max, 
                    zscore_lookback_min, 
                    zscore_lookback_max, 
                    long_threshold_min, 
                    long_threshold_max, 
                    short_threshold_min, 
                    short_threshold_max, 
                    combine_methods,
                    weights_min,
                    weights_max,
                    initial_capital
                )
            
            # Store best parameters for testing
            if st.session_state.optimization_results:
                st.session_state.best_params = st.session_state.optimization_results[0]['params']
    
    # Display optimization results
    if st.session_state.optimization_results:
        st.subheader(f"Top parameter combinations ({selected_method})")
        
        # Create a formatted display dataframe
        display_results = []
                    
        for rank, result in enumerate(st.session_state.optimization_results, 1):
                        params = result['params']
                        
                        weight_display = ""
                        if params['combine_method'] == 'weighted':
                            weight_display = f"MVRV: {params['mvrv_weight']:.2f}, NUPL: {params['nupl_weight']:.2f}"
                        
                        display_results.append({
                            'Rank': rank,
                'Total Return (%)': f"{result['total_return']:.2f}",
                'Return/Drawdown': f"{result['return_to_drawdown']:.2f}",
                'Outperformance (%)': f"{result['outperformance']:.2f}",
                'Sharpe Ratio': f"{result['sharpe_ratio']:.2f}",
                'Win Rate (%)': f"{result['win_rate']:.1f}",
                'Profit Factor': f"{result['profit_factor']:.2f}" if result['profit_factor'] != float('inf') else "∞",
                'Trades': result['trades'],
                'Max Drawdown (%)': f"{result['max_drawdown']:.2f}",
                            'Combine Method': params['combine_method'].capitalize(),
                            'MA Type': params['ma_type'],
                            'MA Length': params['ma_length'],
                            'Z-Score Lookback': params['zscore_lookback'],
                            'Buy Threshold': f"{params['long_threshold']:.2f}",
                            'Sell Threshold': f"{params['short_threshold']:.2f}",
                            'Weights': weight_display
                        })
                    
        # Display styled table
        st.dataframe(pd.DataFrame(display_results), use_container_width=True, hide_index=True)
        
        # Provide download button for results
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            csv_data = pd.DataFrame(display_results).to_csv(index=False).encode('utf-8')
            st.download_button(
                label=f"Download {selected_method} Results",
                data=csv_data,
                file_name=f"combined_strategy_{selected_method.lower().replace(' ', '_')}_{optimization_metric.replace(' ', '_').lower()}_optimization.csv",
                mime="text/csv",
                help="Download the optimization results as a CSV file",
                use_container_width=True
            )
        
        # Generate and display optimization insights
        st.subheader("Optimization insights")
        
        with st.expander("Detailed analysis & recommendations", expanded=True):
            insights = generate_optimization_insights(st.session_state.optimization_results, selected_method)
            st.markdown(insights)
        
        # Additional visualizations
        if len(st.session_state.optimization_results) >= 5:
            col1, col2 = st.columns(2)
            
            with col1:
                # Parameter distribution plots
                st.markdown("#### Parameter Distribution Analysis")
                
                returns_data = [r['total_return'] for r in st.session_state.optimization_results[:20]]
                ma_lengths = [r['params']['ma_length'] for r in st.session_state.optimization_results[:20]]
                thresholds = [r['params']['long_threshold'] for r in st.session_state.optimization_results[:20]]
                
                # Create scatter plot of MA Length vs Return
                param_fig = go.Figure()
                param_fig.add_trace(go.Scatter(
                    x=ma_lengths,
                    y=returns_data,
                    mode='markers',
                    marker=dict(
                        size=8,
                        color=returns_data,
                        colorscale='Viridis',
                        colorbar=dict(title="Return (%)"),
                        opacity=0.7
                    ),
                    text=[f"Return: {r:.1f}%" for r in returns_data],
                    hovertemplate='MA Length: %{x}<br>Return: %{y:.2f}%<extra></extra>'
                ))
                
                param_fig.update_layout(
                    title="MA Length vs Strategy Return",
                    xaxis_title="MA Length",
                    yaxis_title="Return (%)",
                    height=350,
                    plot_bgcolor="rgba(0,0,0,0)",
                    paper_bgcolor="rgba(0,0,0,0)"
                )
                
                st.plotly_chart(param_fig, use_container_width=True)
            
            with col2:
                # Risk-Return scatter
                st.markdown("#### Risk-Return Profile")
                
                returns_data = [r['total_return'] for r in st.session_state.optimization_results[:20]]
                drawdowns = [r['max_drawdown'] for r in st.session_state.optimization_results[:20]]
                sharpe_ratios = [r['sharpe_ratio'] for r in st.session_state.optimization_results[:20]]
                
                risk_return_fig = go.Figure()
                risk_return_fig.add_trace(go.Scatter(
                    x=drawdowns,
                    y=returns_data,
                    mode='markers',
                    marker=dict(
                        size=10,
                        color=sharpe_ratios,
                        colorscale='RdYlGn',
                        colorbar=dict(title="Sharpe Ratio"),
                        opacity=0.7
                    ),
                    text=[f"Sharpe: {s:.2f}" for s in sharpe_ratios],
                    hovertemplate='Max Drawdown: %{x:.1f}%<br>Return: %{y:.2f}%<br>Sharpe: %{text}<extra></extra>'
                ))
                
                risk_return_fig.update_layout(
                    title="Risk-Return Profile",
                    xaxis_title="Max Drawdown (%)",
                    yaxis_title="Return (%)",
                    height=350,
                    plot_bgcolor="rgba(0,0,0,0)",
                    paper_bgcolor="rgba(0,0,0,0)"
                )
                
                st.plotly_chart(risk_return_fig, use_container_width=True)
        
        # Allow testing the best parameters
        st.subheader("Test best parameters")
        
        if st.button("Apply Best Parameters to Full Dataset", key="test_best"):
            best_params = st.session_state.best_params
            
            with st.spinner("Testing best parameters on full dataset..."):
                # Run strategy with best parameters
                results_with_best = run_combined_strategy(filtered_data, best_params)
                
                # Calculate key metrics
                initial_value = results_with_best['PORTFOLIO_VALUE'].iloc[0]
                final_value = results_with_best['PORTFOLIO_VALUE'].iloc[-1]
                buy_hold_final = results_with_best['BUY_HOLD_VALUE'].iloc[-1]
                
                total_return = (final_value / initial_value - 1) * 100
                buy_hold_return = (buy_hold_final / initial_value - 1) * 100
                outperformance = total_return - buy_hold_return
                
                # Display test results
                st.markdown(f"""
                ### Best parameters test results
                
                **Optimization Method:** {selected_method}  
                **Strategy Return:** {total_return:.2f}% (vs {buy_hold_return:.2f}% Buy & Hold)  
                **Outperformance:** {outperformance:+.2f}%
                
                **Optimized Parameters:**
                - Combination Method: {best_params['combine_method']}
                - MA Type: {best_params['ma_type']}
                - MA Length: {best_params['ma_length']}
                - Z-Score Lookback: {best_params['zscore_lookback']}
                - Buy Threshold: {best_params['long_threshold']:.3f}
                - Sell Threshold: {best_params['short_threshold']:.3f}
                """)
                
                if best_params['combine_method'] == 'weighted':
                    st.markdown(f"- MVRV Weight: {best_params['mvrv_weight']:.2f}")
                    st.markdown(f"- NUPL Weight: {best_params['nupl_weight']:.2f}")
                
                # Plot results with best parameters
                test_chart = create_combined_chart(results_with_best)
                st.plotly_chart(test_chart, use_container_width=True)
        
        # Method explanation
        with st.expander("Optimization methods explained"):
            st.markdown(f"""
            ### Advanced optimization methods
            
            #### Bayesian optimization
            - **How it works**: Uses a probabilistic model (Gaussian Process) to predict which parameters are most likely to give good results
            - **Advantages**: Very efficient, requires fewer evaluations, learns from previous results
            - **Best for**: Continuous parameters, when computational budget is limited
            - **When to use**: When you want the most efficient search with fewer iterations
            
            **Initialization Options:**
            - **Random Points**: Start with random parameter combinations (traditional approach)
            - **Manual Start Point**: Begin optimization from a specific parameter set you define
              - Useful when you have domain knowledge or want to improve upon existing parameters
              - The algorithm will explore around your starting point intelligently
              - Can lead to faster convergence if your start point is in a good region
            
            **Acquisition Functions:**
            - **gp_hedge** (Recommended): Adaptively chooses between EI, LCB, and PI based on performance
            - **EI (Expected Improvement)**: Balanced exploration/exploitation, good general-purpose choice
            - **LCB (Lower Confidence Bound)**: More exploration, good for complex parameter spaces
            - **PI (Probability of Improvement)**: More exploitation, faster convergence but may miss global optimum
            
            #### Genetic algorithm
            #### 🧬 Genetic Algorithm
            - **How it works**: Mimics biological evolution with selection, crossover, and mutation
            - **Advantages**: Good at avoiding local optima, handles complex parameter interactions well
            - **Best for**: Complex search spaces, discrete and continuous parameters
            - **When to use**: When you have computational budget and want robust global search
            
            #### 🎲 Random Search
            - **How it works**: Randomly samples parameter combinations from the search space
            - **Advantages**: Simple, unbiased, good baseline method
            - **Best for**: Initial exploration, comparing against more sophisticated methods
            - **When to use**: As a baseline or when other methods are not available
            """)
        
        # Footer
        st.markdown("---")
        st.markdown("""
        <div style="text-align:center; font-size:0.8em;">
            <p>Advanced Parameter Optimization | Powered by Bayesian Optimization & Genetic Algorithms</p>
        </div>
        """, unsafe_allow_html=True)

import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

from config import MODEL_CONFIG, TRADING_CONFIG, DATA_CONFIG

class TradingEnvironment:
    """Bitcoin Trading Environment for DQN Agent"""
    
    def __init__(self, data: pd.DataFrame, lookback_window: int = 720, initial_balance: float = 10000):
        self.data = data.copy()
        self.lookback_window = lookback_window
        self.initial_balance = initial_balance
        
        # Environment state
        self.current_step = 0
        self.balance = initial_balance
        self.btc_held = 0.0
        self.total_value = initial_balance
        self.transaction_cost = TRADING_CONFIG['transaction_cost']
        
        # Action tracking
        self.last_action_step = 0
        self.last_trading_action = None  # Track last non-hold action (0=sell, 2=buy)
        self.max_position_hold = DATA_CONFIG['max_position_hold']
        
        # Performance tracking
        self.trades = []
        self.portfolio_values = []
        self.actions_taken = []
        
        # Prepare features for normalization
        self.feature_columns = [col for col in data.columns if col not in ['UNIX_TIMESTAMP', 'datetime']]
        self.scaler = StandardScaler()
        
        # Fit scaler on all data (in real deployment, use rolling normalization)
        self.scaler.fit(data[self.feature_columns].values)
        
        print(f"🏛️ Trading Environment initialized")
        print(f"📊 Data shape: {self.data.shape}")
        print(f"🔍 Lookback window: {self.lookback_window} hours")
        print(f"💰 Initial balance: ${self.initial_balance:,.2f}")
        print(f"🔧 Features: {len(self.feature_columns)}")
        print(f"🚫 Constraint: No consecutive buy/sell actions without opposite action")
    
    def reset(self, start_step: int = None) -> np.ndarray:
        """Reset environment to initial state"""
        if start_step is None:
            self.current_step = self.lookback_window
        else:
            self.current_step = max(start_step, self.lookback_window)
            
        self.balance = self.initial_balance
        self.btc_held = 0.0
        self.total_value = self.initial_balance
        self.last_action_step = self.current_step
        self.last_trading_action = None  # Reset last trading action
        
        # Clear tracking lists
        self.trades.clear()
        self.portfolio_values.clear() 
        self.actions_taken.clear()
        
        return self._get_state()
    
    def _get_state(self) -> np.ndarray:
        """Get current state (normalized lookback window)"""
        start_idx = self.current_step - self.lookback_window
        end_idx = self.current_step
        
        # Get lookback window data
        window_data = self.data.iloc[start_idx:end_idx][self.feature_columns].values
        
        # Normalize using z-score (on the window)
        normalized_data = self.scaler.transform(window_data)
        
        # Flatten to 1D array for neural network input
        state = normalized_data.flatten()
        
        # Add portfolio information
        portfolio_info = np.array([
            self.balance / self.initial_balance,  # Normalized balance
            self.btc_held * self._get_current_price() / self.initial_balance,  # Normalized BTC value
            self.total_value / self.initial_balance,  # Normalized total value
            (self.current_step - self.last_action_step) / self.max_position_hold,  # Time since last action
        ])
        
        # Add action constraint information
        action_constraints = np.array([
            1.0 if self._can_sell() else 0.0,  # Can sell (has BTC)
            1.0,  # Can always hold
            1.0 if self._can_buy() else 0.0,   # Can buy (has cash)
            1.0 if self.last_trading_action != 0 else 0.0,  # Can sell (not consecutive)
            1.0 if self.last_trading_action != 2 else 0.0,  # Can buy (not consecutive)
        ])
        
        return np.concatenate([state, portfolio_info, action_constraints])
    
    def _get_current_price(self) -> float:
        """Get current BTC price"""
        return self.data.iloc[self.current_step]['CLOSE']
    
    def _calculate_reward(self, prev_total_value: float, action_blocked: bool) -> float:
        """Calculate reward for the given action"""
        current_total_value = self.total_value
        
        # Base reward: portfolio return
        portfolio_return = (current_total_value - prev_total_value) / prev_total_value
        reward = portfolio_return * 100  # Scale to reasonable range
        
        # Penalty for holding position too long (encourage high frequency trading)
        days_since_action = (self.current_step - self.last_action_step) / 24
        if days_since_action > 30:  # More than 30 days
            reward -= 0.1 * (days_since_action - 30)  # Increasing penalty
        
        # Bonus for taking action (encourage activity)
        if not action_blocked:
            reward += 0.01
            
        # Risk-adjusted reward (penalize high volatility strategies)
        if len(self.portfolio_values) > 10:
            recent_values = np.array(self.portfolio_values[-10:])
            volatility = np.std(recent_values) / np.mean(recent_values)
            reward -= volatility * 0.5
        
        # Large loss penalty (encourage loss avoidance)
        if portfolio_return < -0.05:  # More than 5% loss
            reward -= abs(portfolio_return) * 10
            
        # Large gain bonus (but smaller than loss penalty)
        if portfolio_return > 0.05:  # More than 5% gain
            reward += portfolio_return * 5
            
        return reward
    
    def step(self, action: int) -> tuple:
        """Execute one step in environment"""
        if self.current_step >= len(self.data) - 1:
            return self._get_state(), 0, True, {"error": "End of data"}
        
        # Get current price
        current_price = self._get_current_price()
        
        # Check action constraints and apply penalty for invalid actions
        reward_penalty = 0.0
        action_blocked = False
        
        if action == 0:  # sell
            if not self._can_sell():
                reward_penalty = -5.0  # Heavy penalty for invalid sell
                action_blocked = True
                action = 1  # Force hold instead
        elif action == 2:  # buy  
            if not self._can_buy():
                reward_penalty = -5.0  # Heavy penalty for invalid buy
                action_blocked = True
                action = 1  # Force hold instead
        
        # Store original balance and BTC for reward calculation
        prev_total_value = self.total_value
        
        # Execute action
        if action == 0:  # sell
            if self.btc_held > 0:
                btc_value = self.btc_held * current_price
                transaction_fee = btc_value * self.transaction_cost
                self.balance += btc_value - transaction_fee
                
                self.trades.append({
                    'step': self.current_step,
                    'action': 'sell',
                    'price': current_price,
                    'btc_amount': self.btc_held,
                    'value': btc_value,
                    'fee': transaction_fee,
                    'balance_after': self.balance,
                    'portfolio_value': self.balance + 0  # After sell, all BTC converted to cash
                })
                
                self.btc_held = 0.0
                self.last_action_step = self.current_step
                self.last_trading_action = 0  # Update last trading action
                
        elif action == 2:  # buy
            if self.balance > 0:
                transaction_fee = self.balance * self.transaction_cost
                investable_amount = self.balance - transaction_fee
                btc_amount = investable_amount / current_price
                
                self.trades.append({
                    'step': self.current_step,
                    'action': 'buy',
                    'price': current_price,
                    'btc_amount': btc_amount,
                    'value': investable_amount,
                    'fee': transaction_fee,
                    'btc_after': btc_amount,
                    'portfolio_value': btc_amount * current_price  # After buy, all cash converted to BTC
                })
                
                self.btc_held = btc_amount
                self.balance = 0.0
                self.last_action_step = self.current_step
                self.last_trading_action = 2  # Update last trading action
        
        # Action 1 (hold) doesn't update last_trading_action
        
        # Update portfolio value
        self.total_value = self.balance + (self.btc_held * current_price)
        self.portfolio_values.append(self.total_value)
        self.actions_taken.append(action)
        
        # Move to next step
        self.current_step += 1
        
        # Calculate reward
        base_reward = self._calculate_reward(prev_total_value, action_blocked)
        reward = base_reward + reward_penalty
        
        # Check if done (portfolio too low or end of data)
        done = (self.total_value < self.initial_balance * 0.1) or (self.current_step >= len(self.data) - 1)
        
        # Return step information
        info = {
            'portfolio_value': self.total_value,
            'balance': self.balance,
            'btc_held': self.btc_held,
            'current_price': current_price,
            'action_blocked': action_blocked,
            'last_trading_action': self.last_trading_action,
            'can_buy': self._can_buy(),
            'can_sell': self._can_sell()
        }
        
        return self._get_state(), reward, done, info
    
    def get_portfolio_performance(self) -> Dict[str, float]:
        """Calculate portfolio performance metrics"""
        if len(self.portfolio_values) < 2:
            return {}
        
        portfolio_values = np.array(self.portfolio_values)
        returns = np.diff(portfolio_values) / portfolio_values[:-1]
        
        total_return = (self.total_value - self.initial_balance) / self.initial_balance
        
        # Calculate metrics
        metrics = {
            'total_return': total_return,
            'total_return_pct': total_return * 100,
            'final_value': self.total_value,
            'max_value': np.max(portfolio_values),
            'min_value': np.min(portfolio_values),
            'volatility': np.std(returns) * np.sqrt(24 * 365) if len(returns) > 1 else 0,  # Annualized
            'sharpe_ratio': (np.mean(returns) * 24 * 365) / (np.std(returns) * np.sqrt(24 * 365)) if np.std(returns) > 0 else 0,
            'num_trades': len(self.trades),
            'win_rate': self._calculate_win_rate(),
            'max_drawdown': self._calculate_max_drawdown(portfolio_values),
            'profit_factor': self._calculate_profit_factor()
        }
        
        return metrics
    
    def _calculate_win_rate(self) -> float:
        """Calculate win rate based on complete buy-sell trade cycles"""
        if len(self.trades) < 2:
            return 0.0
        
        # Track complete trade cycles (buy -> sell pairs)
        winning_trades = 0
        total_complete_trades = 0
        
        # Find buy-sell pairs
        i = 0
        while i < len(self.trades) - 1:
            current_trade = self.trades[i]
            
            # Look for a buy trade
            if current_trade['action'] == 'buy':
                buy_price = current_trade['price']
                buy_amount = current_trade['btc_amount']
                
                # Find the next sell trade
                j = i + 1
                while j < len(self.trades):
                    next_trade = self.trades[j]
                    if next_trade['action'] == 'sell':
                        sell_price = next_trade['price']
                        
                        # Calculate profit/loss for this trade cycle
                        # Profit = (sell_price - buy_price) * btc_amount - fees
                        buy_fee = current_trade.get('fee', 0)
                        sell_fee = next_trade.get('fee', 0)
                        total_fees = buy_fee + sell_fee
                        
                        # Net profit/loss
                        net_profit = (sell_price - buy_price) * buy_amount - total_fees
                        
                        if net_profit > 0:
                            winning_trades += 1
                        
                        total_complete_trades += 1
                        i = j  # Move to the sell trade
                        break
                    j += 1
                else:
                    # No matching sell found, move to next trade
                    break
            
            i += 1
        
        # If no complete cycles, calculate based on current position profitability
        if total_complete_trades == 0 and len(self.trades) > 0:
            # Check if current position is profitable
            last_trade = self.trades[-1]
            current_price = self._get_current_price()
            
            if last_trade['action'] == 'buy' and self.btc_held > 0:
                # Currently holding BTC, check if profitable
                buy_price = last_trade['price']
                unrealized_profit = (current_price - buy_price) * self.btc_held
                return 1.0 if unrealized_profit > 0 else 0.0
            
            return 0.0
        
        return winning_trades / total_complete_trades if total_complete_trades > 0 else 0.0
    
    def _calculate_max_drawdown(self, portfolio_values: np.ndarray) -> float:
        """Calculate maximum drawdown"""
        if len(portfolio_values) < 2:
            return 0.0
            
        peak = np.maximum.accumulate(portfolio_values)
        drawdown = (portfolio_values - peak) / peak
        return np.min(drawdown)
    
    def _calculate_profit_factor(self) -> float:
        """Calculate profit factor (gross profit / gross loss)"""
        if len(self.portfolio_values) < 2:
            return 0.0
            
        returns = np.diff(self.portfolio_values)
        gross_profit = np.sum(returns[returns > 0])
        gross_loss = abs(np.sum(returns[returns < 0]))
        
        return gross_profit / gross_loss if gross_loss > 0 else float('inf')
    
    def get_buy_and_hold_performance(self, start_step: int = None, end_step: int = None) -> Dict[str, float]:
        """Calculate buy and hold benchmark performance"""
        if start_step is None:
            start_step = self.lookback_window
        if end_step is None:
            end_step = len(self.data) - 1
            
        start_price = self.data.iloc[start_step]['CLOSE']
        end_price = self.data.iloc[end_step]['CLOSE']
        
        # Calculate buy and hold return
        bh_return = (end_price - start_price) / start_price
        bh_final_value = self.initial_balance * (1 + bh_return)
        
        # Calculate volatility for buy and hold
        prices = self.data.iloc[start_step:end_step+1]['CLOSE'].values
        bh_returns = np.diff(prices) / prices[:-1]
        bh_volatility = np.std(bh_returns) * np.sqrt(24 * 365) if len(bh_returns) > 1 else 0
        
        return {
            'total_return': bh_return,
            'total_return_pct': bh_return * 100,
            'final_value': bh_final_value,
            'volatility': bh_volatility,
            'sharpe_ratio': (np.mean(bh_returns) * 24 * 365) / (np.std(bh_returns) * np.sqrt(24 * 365)) if np.std(bh_returns) > 0 else 0,
            'max_drawdown': self._calculate_max_drawdown(prices)
        }
    
    def _can_sell(self) -> bool:
        """Check if agent can sell (has BTC and last action wasn't sell)"""
        return self.btc_held > 0 and self.last_trading_action != 0
    
    def _can_buy(self) -> bool:
        """Check if agent can buy (has cash and last action wasn't buy)"""
        return self.balance > 0 and self.last_trading_action != 2

if __name__ == "__main__":
    # Test the trading environment
    print("🧪 Testing Trading Environment...")
    
    # Create dummy data for testing
    np.random.seed(42)
    dates = pd.date_range('2020-01-01', periods=1000, freq='H')
    dummy_data = pd.DataFrame({
        'UNIX_TIMESTAMP': [int(d.timestamp()) for d in dates],
        'datetime': dates,
        'OPEN': np.random.randn(1000).cumsum() + 50000,
        'HIGH': np.random.randn(1000).cumsum() + 50100,
        'LOW': np.random.randn(1000).cumsum() + 49900,
        'CLOSE': np.random.randn(1000).cumsum() + 50000,
        'VOLUME': np.random.randn(1000) * 1000 + 10000,
        'rsi': np.random.randn(1000) * 20 + 50,
        'macd': np.random.randn(1000) * 100,
        'volatility_30d': np.random.randn(1000) * 0.1 + 0.3
    })
    
    env = TradingEnvironment(dummy_data)
    state = env.reset()
    
    print(f"Initial state shape: {state.shape}")
    print(f"Initial portfolio value: ${env.total_value:,.2f}")
    
    # Test a few random actions
    for i in range(5):
        action = np.random.randint(0, 3)
        next_state, reward, done, info = env.step(action)
        print(f"Step {i}: Action={action}, Reward={reward:.4f}, Portfolio=${info['portfolio_value']:,.2f}")
        
        if done:
            break
    
    performance = env.get_portfolio_performance()
    print(f"Final performance: {performance}") 
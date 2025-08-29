#!/usr/bin/env python3
"""
DQN Bitcoin Trading System - Main Training Loop
Comprehensive implementation for hourly Bitcoin trading using Deep Q-Learning
"""

import os
import numpy as np
import pandas as pd
from tqdm import tqdm
import warnings
warnings.filterwarnings('ignore')

# Import custom modules
from data_pipeline import DataPipeline
from dqn_model import DQNAgent
from trading_environment import TradingEnvironment
from visualization import TradingVisualizer
from config import MODEL_CONFIG, DATA_CONFIG, TRADING_CONFIG

class DQNTradingSystem:
    """Main DQN Trading System Class"""
    
    def __init__(self):
        self.data_pipeline = DataPipeline()
        self.visualizer = TradingVisualizer()
        
        # Create necessary directories
        os.makedirs('models', exist_ok=True)
        os.makedirs('data', exist_ok=True)
        os.makedirs('logs', exist_ok=True)
        
        # Training tracking
        self.episode_data = []
        self.evaluation_data = []
        self.best_eval_score = -np.inf
        self.best_model_path = 'models/best_dqn_model.pth'
        
        print("🚀 DQN Trading System Initialized")
    
    def prepare_data(self, use_cached: bool = True) -> pd.DataFrame:
        """Prepare data for training"""
        print("\n" + "="*60)
        print("📊 DATA PREPARATION PHASE")
        print("="*60)
        
        if use_cached:
            # Try to load preprocessed data first
            data = self.data_pipeline.load_preprocessed_data()
            if data is not None:
                return data
        
        # Import and preprocess data from Snowflake
        print("🔄 Importing data from Snowflake...")
        raw_data = self.data_pipeline.import_data_from_snowflake()
        
        if raw_data is None:
            raise ValueError("Failed to import data from Snowflake")
        
        print("🛠️ Preprocessing data...")
        processed_data = self.data_pipeline.preprocess_data(raw_data)
        
        print("💾 Saving preprocessed data...")
        self.data_pipeline.save_preprocessed_data(processed_data)
        
        return processed_data
    
    def split_data(self, data: pd.DataFrame) -> tuple:
        """Split data sequentially: first 80% train, next 10% eval, last 10% test"""
        total_length = len(data)
        
        # Sequential split: first 80% for training
        train_end = int(total_length * DATA_CONFIG['train_split'])
        eval_end = train_end + int(total_length * DATA_CONFIG['eval_split'])
        
        train_data = data.iloc[:train_end].copy()
        eval_data = data.iloc[train_end:eval_end].copy()
        test_data = data.iloc[eval_end:].copy()
        
        print(f"📈 Sequential data split:")
        print(f"  - Training: {len(train_data):,} rows ({DATA_CONFIG['train_split']*100:.0f}%) - Rows 0 to {train_end-1}")
        print(f"  - Evaluation: {len(eval_data):,} rows ({DATA_CONFIG['eval_split']*100:.0f}%) - Rows {train_end} to {eval_end-1}")
        print(f"  - Testing: {len(test_data):,} rows ({DATA_CONFIG['test_split']*100:.0f}%) - Rows {eval_end} to {total_length-1}")
        
        return train_data, eval_data, test_data
    
    def initialize_agent(self, data: pd.DataFrame) -> DQNAgent:
        """Initialize DQN agent"""
        # Prepare features to get state size
        features, feature_names = self.data_pipeline.prepare_features_for_model(data)
        
        # State size = flattened lookback window + portfolio info + action constraints
        state_size = len(feature_names) * MODEL_CONFIG['lookback_window'] + 4 + 5  # +4 for portfolio, +5 for action constraints
        
        print(f"🧠 Initializing DQN Agent...")
        print(f"  - State size: {state_size:,}")
        print(f"  - Action space: {MODEL_CONFIG['action_space_size']}")
        print(f"  - Lookback window: {MODEL_CONFIG['lookback_window']} hours")
        print(f"  - Action constraints: Prevent consecutive buy/sell actions")
        
        agent = DQNAgent(state_size, MODEL_CONFIG['action_space_size'])
        return agent
    
    def train_episode(self, env: TradingEnvironment, agent: DQNAgent, episode: int, train_data: pd.DataFrame) -> dict:
        """Train agent for one episode on a random segment of training data"""
        
        # Define episode parameters
        episode_length = MODEL_CONFIG['episode_length']
        min_start = env.lookback_window
        max_start = len(train_data) - episode_length - env.lookback_window
        
        if max_start <= min_start:
            # If data is too small, use all available data
            start_step = min_start
            print(f"⚠️ Warning: Training data too small for {episode_length} episode length. Using full dataset.")
        else:
            # Random start point for this episode
            start_step = np.random.randint(min_start, max_start)
        
        print(f"📍 Episode {episode}: Training on segment {start_step:,} to {start_step + episode_length:,}")
        
        # Reset environment at random start point
        state = env.reset(start_step=start_step)
        total_reward = 0
        steps = 0
        losses = []
        
        # Calculate max steps for this episode
        max_steps = min(episode_length, len(env.data) - env.current_step - 1)
        
        # Progress bar for episode
        pbar = tqdm(total=max_steps, desc=f"Episode {episode}", leave=False)
        
        while steps < max_steps:
            # Select action
            action = agent.select_action(state, training=True)
            
            # Take step in environment
            next_state, reward, done, info = env.step(action)
            
            # Store experience
            agent.store_experience(state, action, reward, next_state, done)
            
            # Learn from experience
            loss = agent.learn()
            if loss is not None:
                losses.append(loss)
            
            # Update tracking
            total_reward += reward
            steps += 1
            state = next_state
            
            pbar.update(1)
            pbar.set_postfix({
                'Reward': f'{total_reward:.2f}',
                'Portfolio': f'${info["portfolio_value"]:,.0f}',
                'Action': TRADING_CONFIG['actions'][action],
                'Epsilon': f'{agent.epsilon:.3f}',
                'Steps': f'{steps}/{max_steps}',
                'LastAction': info.get('last_trading_action', 'None'),
                'Blocked': '⚠️' if info.get('action_blocked', False) else '✅'
            })
            
            if done:
                print(f"\n⚠️ Episode ended early at step {steps} (portfolio too low or data ended)")
                break
        
        pbar.close()
        
        # Calculate episode metrics
        agent_metrics = env.get_portfolio_performance()
        
        # Calculate buy & hold for the same segment
        segment_start = start_step
        segment_end = min(start_step + steps, len(env.data) - 1)
        bh_metrics = env.get_buy_and_hold_performance(segment_start, segment_end)
        
        episode_info = {
            'episode': episode,
            'start_step': start_step,
            'segment_length': steps,
            'total_reward': total_reward,
            'steps': steps,
            'avg_loss': np.mean(losses) if losses else 0,
            'epsilon': agent.epsilon,
            'agent_metrics': agent_metrics,
            'bh_metrics': bh_metrics
        }
        
        return episode_info
    
    def evaluate_agent(self, env: TradingEnvironment, agent: DQNAgent, episode: int, eval_data: pd.DataFrame) -> dict:
        """Evaluate agent on the full validation dataset"""
        print(f"\n🔍 Evaluating agent (Episode {episode})...")
        
        # Use the full evaluation dataset
        start_step = env.lookback_window
        max_eval_steps = len(eval_data) - env.lookback_window - 1
        
        print(f"📍 Evaluation: Using full eval dataset - {max_eval_steps:,} steps")
        
        state = env.reset(start_step=start_step)
        total_reward = 0
        steps = 0
        
        # Progress bar for evaluation
        pbar = tqdm(total=max_eval_steps, desc="Evaluation", leave=False)
        
        while steps < max_eval_steps and env.current_step < len(env.data) - 1:
            # Select action (no exploration)
            action = agent.select_action(state, training=False)
            
            # Take step
            next_state, reward, done, info = env.step(action)
            
            # Update tracking
            total_reward += reward
            steps += 1
            state = next_state
            
            pbar.update(1)
            pbar.set_postfix({
                'Portfolio': f'${info["portfolio_value"]:,.0f}',
                'Action': TRADING_CONFIG['actions'][action],
                'Steps': f'{steps}/{max_eval_steps}',
                'LastAction': info.get('last_trading_action', 'None'),
                'CanBuy': '✅' if info.get('can_buy', False) else '❌',
                'CanSell': '✅' if info.get('can_sell', False) else '❌'
            })
            
            if done:
                print(f"\n⚠️ Evaluation ended early at step {steps} (portfolio too low)")
                break
        
        pbar.close()
        
        # Calculate evaluation metrics
        agent_metrics = env.get_portfolio_performance()
        
        # Calculate buy & hold for the same evaluation period
        segment_end = min(start_step + steps, len(env.data) - 1)
        bh_metrics = env.get_buy_and_hold_performance(start_step, segment_end)
        
        eval_info = {
            'episode': episode,
            'eval_start': start_step,
            'eval_length': steps,
            'total_reward': total_reward,
            'steps': steps,
            'agent_metrics': agent_metrics,
            'bh_metrics': bh_metrics
        }
        
        # Check if this is the best model so far
        # Use a composite score: Sharpe ratio + return with penalty for drawdown
        sharpe_ratio = agent_metrics.get('sharpe_ratio', 0)
        total_return = agent_metrics.get('total_return', 0)
        max_drawdown = agent_metrics.get('max_drawdown', 0)
        
        # Composite score: prioritize consistent returns with low drawdown
        eval_score = sharpe_ratio + (total_return * 5) - (abs(max_drawdown) * 10)
        
        if eval_score > self.best_eval_score:
            self.best_eval_score = eval_score
            agent.save_model(self.best_model_path)
            print(f"✅ New best model saved! Score: {eval_score:.4f}")
            print(f"   - Sharpe: {sharpe_ratio:.3f}, Return: {total_return*100:.2f}%, Drawdown: {max_drawdown*100:.2f}%")
        
        return eval_info
    
    def train(self, max_episodes: int = None):
        """Main training loop"""
        if max_episodes is None:
            max_episodes = MODEL_CONFIG['max_episodes']
        
        print("\n" + "="*60)
        print("🎯 TRAINING PHASE")
        print("="*60)
        
        # Prepare data
        data = self.prepare_data()
        train_data, eval_data, test_data = self.split_data(data)
        
        # Initialize agent
        agent = self.initialize_agent(data)
        
        # Create environments
        train_env = TradingEnvironment(train_data, MODEL_CONFIG['lookback_window'], 
                                     TRADING_CONFIG['initial_balance'])
        eval_env = TradingEnvironment(eval_data, MODEL_CONFIG['lookback_window'], 
                                    TRADING_CONFIG['initial_balance'])
        
        print(f"\n🚀 Starting training for {max_episodes} episodes...")
        print(f"📈 Training Strategy: Random {MODEL_CONFIG['episode_length']:,}-step segments")
        print(f"🎯 Each episode trains on a different random market period")
        print(f"🔍 Evaluation uses the full evaluation dataset ({len(eval_data):,} samples)")
        
        # Training loop
        for episode in range(max_episodes):
            print(f"\n{'='*20} EPISODE {episode + 1}/{max_episodes} {'='*20}")
            
            # Train episode
            episode_info = self.train_episode(train_env, agent, episode + 1, train_data)
            self.episode_data.append(episode_info)
            
            # Print episode results
            agent_return = episode_info['agent_metrics'].get('total_return_pct', 0)
            bh_return = episode_info['bh_metrics'].get('total_return_pct', 0)
            
            print(f"📊 Episode {episode + 1} Results:")
            print(f"  - Segment: {episode_info['start_step']:,} to {episode_info['start_step'] + episode_info['segment_length']:,} ({episode_info['segment_length']:,} steps)")
            print(f"  - Agent Return: {agent_return:.2f}%")
            print(f"  - Buy & Hold Return: {bh_return:.2f}%")
            print(f"  - Total Reward: {episode_info['total_reward']:.2f}")
            print(f"  - Trades: {episode_info['agent_metrics'].get('num_trades', 0)}")
            print(f"  - Win Rate: {episode_info['agent_metrics'].get('win_rate', 0)*100:.1f}%")
            print(f"  - Epsilon: {episode_info['epsilon']:.3f}")
            print(f"  - Avg Loss: {episode_info['avg_loss']:.4f}")
            
            # Generate episode visualization
            self.visualizer.plot_episode_performance(
                episode + 1, train_env, 
                episode_info['agent_metrics'], 
                episode_info['bh_metrics']
            )
            
            # Evaluate agent periodically
            if (episode + 1) % MODEL_CONFIG['eval_frequency'] == 0:
                eval_info = self.evaluate_agent(eval_env, agent, episode + 1, eval_data)
                self.evaluation_data.append(eval_info)
                
                # Print evaluation results
                eval_return = eval_info['agent_metrics'].get('total_return_pct', 0)
                eval_bh_return = eval_info['bh_metrics'].get('total_return_pct', 0)
                
                print(f"\n🎯 Evaluation Results (Episode {episode + 1}):")
                print(f"  - Agent Return: {eval_return:.2f}%")
                print(f"  - Buy & Hold Return: {eval_bh_return:.2f}%")
                print(f"  - Sharpe Ratio: {eval_info['agent_metrics'].get('sharpe_ratio', 0):.3f}")
                print(f"  - Max Drawdown: {eval_info['agent_metrics'].get('max_drawdown', 0)*100:.2f}%")
                print(f"  - Win Rate: {eval_info['agent_metrics'].get('win_rate', 0)*100:.1f}%")
            
            # Update dashboard periodically
            if (episode + 1) % MODEL_CONFIG['dashboard_update_freq'] == 0:
                print("\n📈 Updating dashboard...")
                self.visualizer.plot_training_progress(self.episode_data)
                if self.evaluation_data:
                    self.visualizer.plot_evaluation_results(self.evaluation_data)
                    self.visualizer.create_interactive_dashboard(self.episode_data)
        
        print(f"\n✅ Training completed! Best model saved at: {self.best_model_path}")
        print(f"💾 Model file contains only weights (.pth) - sufficient for online trading")
    
    def test(self):
        """Test the best model on the full test set"""
        print("\n" + "="*60)
        print("🧪 TESTING PHASE")
        print("="*60)
        
        # Load data
        data = self.prepare_data()
        train_data, eval_data, test_data = self.split_data(data)
        
        # Initialize agent and load best model
        agent = self.initialize_agent(data)
        agent.load_model(self.best_model_path)
        
        # Create test environment
        test_env = TradingEnvironment(test_data, MODEL_CONFIG['lookback_window'], 
                                    TRADING_CONFIG['initial_balance'])
        
        print(f"🎯 Testing best model on full test set ({len(test_data):,} samples)...")
        
        # Run test on the full test set
        test_info = self.evaluate_agent(test_env, agent, "TEST", test_data)
        
        # Print final results
        print(f"\n🏆 FINAL TEST RESULTS:")
        print(f"{'='*50}")
        
        agent_metrics = test_info['agent_metrics']
        bh_metrics = test_info['bh_metrics']
        
        print(f"📊 Performance Metrics:")
        print(f"  DQN Agent:")
        print(f"    - Total Return: {agent_metrics.get('total_return_pct', 0):.2f}%")
        print(f"    - Final Value: ${agent_metrics.get('final_value', 0):,.2f}")
        print(f"    - Sharpe Ratio: {agent_metrics.get('sharpe_ratio', 0):.3f}")
        print(f"    - Max Drawdown: {agent_metrics.get('max_drawdown', 0)*100:.2f}%")
        print(f"    - Win Rate: {agent_metrics.get('win_rate', 0)*100:.1f}%")
        print(f"    - Number of Trades: {agent_metrics.get('num_trades', 0)}")
        print(f"    - Volatility: {agent_metrics.get('volatility', 0)*100:.2f}%")
        
        print(f"\n  Buy & Hold:")
        print(f"    - Total Return: {bh_metrics.get('total_return_pct', 0):.2f}%")
        print(f"    - Final Value: ${bh_metrics.get('final_value', 0):,.2f}")
        print(f"    - Sharpe Ratio: {bh_metrics.get('sharpe_ratio', 0):.3f}")
        print(f"    - Max Drawdown: {bh_metrics.get('max_drawdown', 0)*100:.2f}%")
        print(f"    - Volatility: {bh_metrics.get('volatility', 0)*100:.2f}%")
        
        # Generate final test visualization
        self.visualizer.plot_episode_performance(
            "FINAL_TEST", test_env, agent_metrics, bh_metrics
        )
        
        # Performance comparison
        outperformed = agent_metrics.get('total_return', 0) > bh_metrics.get('total_return', 0)
        print(f"\n🎯 Agent {'✅ OUTPERFORMED' if outperformed else '❌ UNDERPERFORMED'} Buy & Hold")
        
        # Additional analysis
        print(f"\n📈 Additional Analysis:")
        print(f"  - Risk-Adjusted Return (Sharpe): Agent {agent_metrics.get('sharpe_ratio', 0):.3f} vs B&H {bh_metrics.get('sharpe_ratio', 0):.3f}")
        print(f"  - Drawdown Comparison: Agent {agent_metrics.get('max_drawdown', 0)*100:.2f}% vs B&H {bh_metrics.get('max_drawdown', 0)*100:.2f}%")
        
        return test_info

def main():
    """Main function"""
    print("🎯 Starting DQN Bitcoin Trading System")
    print("="*60)
    
    # Initialize system
    system = DQNTradingSystem()
    
    try:
        # Train the model
        system.train()
        
        # Test the model
        system.test()
        
        print("\n🎉 DQN Trading System completed successfully!")
        print(f"📁 Results saved in: plots/")
        print(f"🤖 Best model saved in: {system.best_model_path}")
        
    except KeyboardInterrupt:
        print("\n⚠️ Training interrupted by user")
        print("💾 Progress has been saved")
        
    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

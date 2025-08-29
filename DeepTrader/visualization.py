import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
from typing import Dict, List, Any
import os

# Set style
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

class TradingVisualizer:
    """Comprehensive visualization toolkit for DQN trading system"""
    
    def __init__(self, save_dir: str = "plots"):
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)
        
    def plot_episode_performance(self, episode_num, env, agent_metrics, bh_metrics):
        """Plot episode performance with portfolio evolution"""
        # Create episode-specific timestamps based on actual steps taken
        episode_steps = len(env.portfolio_values)
        
        # Get the actual step range from the environment
        start_step = env.current_step - episode_steps
        end_step = env.current_step
        
        # Create timestamps for just this episode segment
        if 'datetime' in env.data.columns:
            # Use actual datetime if available, slicing for the episode segment
            episode_timestamps = env.data.iloc[start_step:end_step]['datetime'].values
            if len(episode_timestamps) != episode_steps:
                # Fallback: create step-based timestamps
                episode_timestamps = list(range(episode_steps))
        else:
            # Fallback: use step numbers
            episode_timestamps = list(range(episode_steps))
        
        # Ensure timestamp and portfolio arrays match
        if len(episode_timestamps) != len(env.portfolio_values):
            episode_timestamps = list(range(len(env.portfolio_values)))
        
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle(f'Episode {episode_num} Performance', fontsize=16, fontweight='bold')
        
        # Plot 1: Portfolio Value Evolution
        ax1.plot(episode_timestamps, env.portfolio_values, 'b-', linewidth=2, label='Portfolio Value', alpha=0.8)
        ax1.axhline(y=env.initial_balance, color='gray', linestyle='--', alpha=0.7, label='Initial Balance')
        ax1.set_title('Portfolio Value Over Time')
        ax1.set_ylabel('Portfolio Value ($)')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Format x-axis for datetime if applicable
        if 'datetime' in env.data.columns and len(episode_timestamps) > 0:
            try:
                if hasattr(episode_timestamps[0], 'strftime'):
                    ax1.tick_params(axis='x', rotation=45)
            except:
                pass  # Use default formatting if datetime formatting fails
        
        # 2. Portfolio Evolution Comparison
        ax2 = ax2
        
        # Agent portfolio
        ax2.plot(episode_timestamps, env.portfolio_values, 'b-', linewidth=2, label='DQN Agent', alpha=0.8)
        
        # Buy & Hold comparison - create BH values for this episode segment
        if episode_steps > 0:
            start_price = env.data.iloc[start_step]['CLOSE']
            end_price = env.data.iloc[end_step-1]['CLOSE'] if end_step-1 < len(env.data) else start_price
            
            # Create buy & hold values for this segment
            episode_prices = env.data.iloc[start_step:end_step]['CLOSE'].values
            if len(episode_prices) == episode_steps:
                bh_values = [env.initial_balance * (price / start_price) for price in episode_prices]
            else:
                bh_values = [env.initial_balance] * episode_steps  # Fallback
        else:
            bh_values = [env.initial_balance]
            
        ax2.plot(episode_timestamps, bh_values, 'r--', linewidth=2, label='Buy & Hold', alpha=0.7)
        
        ax2.set_title('Agent vs Buy & Hold Performance', fontweight='bold')
        ax2.set_ylabel('Portfolio Value ($)')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        # 3. Action Distribution
        ax3 = ax3
        if len(env.actions_taken) > 0:
            action_counts = pd.Series(env.actions_taken).value_counts().sort_index()
            action_labels = ['Sell All', 'Hold', 'Buy All']
            colors = ['red', 'gray', 'green']
            
            # Ensure we have data for all actions
            for i in range(3):
                if i not in action_counts.index:
                    action_counts[i] = 0
            action_counts = action_counts.sort_index()
            
            ax3.pie(action_counts.values, labels=[action_labels[i] for i in action_counts.index], 
                   colors=[colors[i] for i in action_counts.index], autopct='%1.1f%%', startangle=90)
            ax3.set_title('Action Distribution', fontweight='bold')
        else:
            ax3.text(0.5, 0.5, 'No actions taken', ha='center', va='center', transform=ax3.transAxes)
            ax3.set_title('Action Distribution', fontweight='bold')
        
        # 4. Performance Metrics Comparison
        ax4 = ax4
        
        metrics_comparison = {
            'Metric': ['Total Return (%)', 'Sharpe Ratio', 'Max Drawdown (%)', 'Win Rate (%)', 'Trades'],
            'DQN Agent': [
                agent_metrics.get('total_return_pct', 0),
                agent_metrics.get('sharpe_ratio', 0),
                agent_metrics.get('max_drawdown', 0) * 100,
                agent_metrics.get('win_rate', 0) * 100,
                agent_metrics.get('num_trades', 0)
            ],
            'Buy & Hold': [
                bh_metrics.get('total_return_pct', 0),
                bh_metrics.get('sharpe_ratio', 0),
                bh_metrics.get('max_drawdown', 0) * 100,
                0,  # No win rate for B&H
                1   # One trade for B&H
            ]
        }
        
        metrics_df = pd.DataFrame(metrics_comparison)
        
        # Create grouped bar chart
        x = np.arange(len(metrics_df['Metric']))
        width = 0.35
        
        ax4.bar(x - width/2, metrics_df['DQN Agent'], width, label='DQN Agent', alpha=0.8, color='blue')
        ax4.bar(x + width/2, metrics_df['Buy & Hold'], width, label='Buy & Hold', alpha=0.8, color='red')
        
        ax4.set_title('Performance Metrics Comparison', fontweight='bold')
        ax4.set_ylabel('Value')
        ax4.set_xticks(x)
        ax4.set_xticklabels(metrics_df['Metric'], rotation=45, ha='right')
        ax4.legend()
        ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # Save plot
        if not hasattr(self, 'save_dir'):
            self.save_dir = 'plots'
        os.makedirs(self.save_dir, exist_ok=True)
        
        plt.savefig(f'{self.save_dir}/episode_{episode_num}_performance.png', 
                   dpi=300, bbox_inches='tight')
        plt.close()
    
    def plot_training_progress(self, episode_data: List[Dict], save: bool = True) -> None:
        """Plot training progress across episodes"""
        
        fig, axes = plt.subplots(2, 3, figsize=(20, 12))
        fig.suptitle('Training Progress Dashboard', fontsize=16, fontweight='bold')
        
        episodes = [ep['episode'] for ep in episode_data]
        
        # 1. Total Returns Comparison
        ax1 = axes[0, 0]
        agent_returns = [ep['agent_metrics'].get('total_return_pct', 0) for ep in episode_data]
        bh_returns = [ep['bh_metrics'].get('total_return_pct', 0) for ep in episode_data]
        
        ax1.plot(episodes, agent_returns, 'b-', linewidth=2, marker='o', label='DQN Agent', alpha=0.8)
        ax1.plot(episodes, bh_returns, 'r--', linewidth=2, marker='s', label='Buy & Hold', alpha=0.7)
        ax1.set_title('Total Returns Over Episodes', fontweight='bold')
        ax1.set_xlabel('Episode', fontweight='bold')
        ax1.set_ylabel('Total Return (%)', fontweight='bold')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # 2. Sharpe Ratio Evolution
        ax2 = axes[0, 1]
        agent_sharpe = [ep['agent_metrics'].get('sharpe_ratio', 0) for ep in episode_data]
        bh_sharpe = [ep['bh_metrics'].get('sharpe_ratio', 0) for ep in episode_data]
        
        ax2.plot(episodes, agent_sharpe, 'b-', linewidth=2, marker='o', label='DQN Agent', alpha=0.8)
        ax2.plot(episodes, bh_sharpe, 'r--', linewidth=2, marker='s', label='Buy & Hold', alpha=0.7)
        ax2.set_title('Sharpe Ratio Evolution', fontweight='bold')
        ax2.set_xlabel('Episode', fontweight='bold')
        ax2.set_ylabel('Sharpe Ratio', fontweight='bold')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        # 3. Max Drawdown Comparison
        ax3 = axes[0, 2]
        agent_dd = [ep['agent_metrics'].get('max_drawdown', 0) * 100 for ep in episode_data]
        bh_dd = [ep['bh_metrics'].get('max_drawdown', 0) * 100 for ep in episode_data]
        
        ax3.plot(episodes, agent_dd, 'b-', linewidth=2, marker='o', label='DQN Agent', alpha=0.8)
        ax3.plot(episodes, bh_dd, 'r--', linewidth=2, marker='s', label='Buy & Hold', alpha=0.7)
        ax3.set_title('Maximum Drawdown Evolution', fontweight='bold')
        ax3.set_xlabel('Episode', fontweight='bold')
        ax3.set_ylabel('Max Drawdown (%)', fontweight='bold')
        ax3.legend()
        ax3.grid(True, alpha=0.3)
        
        # 4. Win Rate Progress
        ax4 = axes[1, 0]
        win_rates = [ep['agent_metrics'].get('win_rate', 0) * 100 for ep in episode_data]
        
        ax4.plot(episodes, win_rates, 'g-', linewidth=2, marker='o', alpha=0.8)
        ax4.axhline(y=50, color='r', linestyle='--', alpha=0.7, label='Random (50%)')
        ax4.set_title('Win Rate Progress', fontweight='bold')
        ax4.set_xlabel('Episode', fontweight='bold')
        ax4.set_ylabel('Win Rate (%)', fontweight='bold')
        ax4.legend()
        ax4.grid(True, alpha=0.3)
        
        # 5. Number of Trades
        ax5 = axes[1, 1]
        num_trades = [ep['agent_metrics'].get('num_trades', 0) for ep in episode_data]
        
        ax5.plot(episodes, num_trades, 'purple', linewidth=2, marker='o', alpha=0.8)
        ax5.set_title('Trading Frequency', fontweight='bold')
        ax5.set_xlabel('Episode', fontweight='bold')
        ax5.set_ylabel('Number of Trades', fontweight='bold')
        ax5.grid(True, alpha=0.3)
        
        # 6. Epsilon Decay (if available)
        ax6 = axes[1, 2]
        if 'epsilon' in episode_data[0]:
            epsilons = [ep.get('epsilon', 0) for ep in episode_data]
            ax6.plot(episodes, epsilons, 'orange', linewidth=2, marker='o', alpha=0.8)
            ax6.set_title('Exploration Rate (Epsilon)', fontweight='bold')
            ax6.set_xlabel('Episode', fontweight='bold')
            ax6.set_ylabel('Epsilon', fontweight='bold')
            ax6.grid(True, alpha=0.3)
        else:
            ax6.text(0.5, 0.5, 'Epsilon data not available', 
                    transform=ax6.transAxes, ha='center', va='center')
            ax6.set_title('Exploration Rate', fontweight='bold')
        
        plt.tight_layout()
        
        if save:
            plt.savefig(f'{self.save_dir}/training_progress.png', 
                       dpi=300, bbox_inches='tight')
            plt.close()
        else:
            plt.show()
    
    def plot_evaluation_results(self, eval_data: List[Dict], save: bool = True) -> None:
        """Plot evaluation results on validation set"""
        
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle('Evaluation Results on Validation Set', fontsize=16, fontweight='bold')
        
        episodes = [ep['episode'] for ep in eval_data]
        
        # 1. Cumulative Returns
        ax1 = axes[0, 0]
        agent_returns = [ep['agent_metrics'].get('total_return_pct', 0) for ep in eval_data]
        bh_returns = [ep['bh_metrics'].get('total_return_pct', 0) for ep in eval_data]
        
        ax1.plot(episodes, agent_returns, 'b-', linewidth=3, marker='o', 
                markersize=8, label='DQN Agent', alpha=0.8)
        ax1.plot(episodes, bh_returns, 'r--', linewidth=3, marker='s', 
                markersize=8, label='Buy & Hold', alpha=0.7)
        ax1.set_title('Evaluation Returns Over Episodes', fontweight='bold')
        ax1.set_xlabel('Episode', fontweight='bold')
        ax1.set_ylabel('Total Return (%)', fontweight='bold')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # 2. Risk-Adjusted Returns (Sharpe Ratio)
        ax2 = axes[0, 1]
        agent_sharpe = [ep['agent_metrics'].get('sharpe_ratio', 0) for ep in eval_data]
        bh_sharpe = [ep['bh_metrics'].get('sharpe_ratio', 0) for ep in eval_data]
        
        ax2.plot(episodes, agent_sharpe, 'b-', linewidth=3, marker='o', 
                markersize=8, label='DQN Agent', alpha=0.8)
        ax2.plot(episodes, bh_sharpe, 'r--', linewidth=3, marker='s', 
                markersize=8, label='Buy & Hold', alpha=0.7)
        ax2.set_title('Risk-Adjusted Returns (Sharpe)', fontweight='bold')
        ax2.set_xlabel('Episode', fontweight='bold')
        ax2.set_ylabel('Sharpe Ratio', fontweight='bold')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        # 3. Performance Metrics Heatmap
        ax3 = axes[1, 0]
        
        metrics_data = []
        for ep in eval_data[-5:]:  # Last 5 evaluations
            metrics_data.append([
                ep['agent_metrics'].get('total_return_pct', 0),
                ep['agent_metrics'].get('sharpe_ratio', 0),
                ep['agent_metrics'].get('max_drawdown', 0) * 100,
                ep['agent_metrics'].get('win_rate', 0) * 100
            ])
        
        metrics_df = pd.DataFrame(metrics_data, 
                                index=[f"Ep {ep['episode']}" for ep in eval_data[-5:]],
                                columns=['Return (%)', 'Sharpe', 'Max DD (%)', 'Win Rate (%)'])
        
        sns.heatmap(metrics_df, annot=True, fmt='.2f', cmap='RdYlGn', 
                   ax=ax3, cbar_kws={'label': 'Performance Score'})
        ax3.set_title('Recent Evaluation Metrics', fontweight='bold')
        
        # 4. Success Rate
        ax4 = axes[1, 1]
        
        # Calculate success rate (agent outperforming buy & hold)
        success_episodes = []
        success_rate = []
        
        for i, ep in enumerate(eval_data):
            agent_ret = ep['agent_metrics'].get('total_return_pct', 0)
            bh_ret = ep['bh_metrics'].get('total_return_pct', 0)
            success_episodes.append(1 if agent_ret > bh_ret else 0)
            success_rate.append(sum(success_episodes) / len(success_episodes) * 100)
        
        ax4.plot(episodes, success_rate, 'g-', linewidth=3, marker='o', 
                markersize=8, alpha=0.8)
        ax4.axhline(y=50, color='r', linestyle='--', alpha=0.7, label='Random (50%)')
        ax4.set_title('Success Rate (Outperforming B&H)', fontweight='bold')
        ax4.set_xlabel('Episode', fontweight='bold')
        ax4.set_ylabel('Success Rate (%)', fontweight='bold')
        ax4.legend()
        ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save:
            plt.savefig(f'{self.save_dir}/evaluation_results.png', 
                       dpi=300, bbox_inches='tight')
            plt.close()
        else:
            plt.show()
    
    def create_interactive_dashboard(self, episode_data: List[Dict], save: bool = True) -> None:
        """Create interactive Plotly dashboard"""
        
        # Create subplots
        fig = make_subplots(
            rows=2, cols=3,
            subplot_titles=('Returns Comparison', 'Sharpe Ratio Evolution', 'Max Drawdown',
                          'Win Rate Progress', 'Trading Frequency', 'Performance Distribution'),
            specs=[[{"secondary_y": False}, {"secondary_y": False}, {"secondary_y": False}],
                   [{"secondary_y": False}, {"secondary_y": False}, {"type": "box"}]]
        )
        
        episodes = [ep['episode'] for ep in episode_data]
        
        # 1. Returns Comparison
        agent_returns = [ep['agent_metrics'].get('total_return_pct', 0) for ep in episode_data]
        bh_returns = [ep['bh_metrics'].get('total_return_pct', 0) for ep in episode_data]
        
        fig.add_trace(
            go.Scatter(x=episodes, y=agent_returns, mode='lines+markers', 
                      name='DQN Agent', line=dict(color='blue', width=3)),
            row=1, col=1
        )
        fig.add_trace(
            go.Scatter(x=episodes, y=bh_returns, mode='lines+markers', 
                      name='Buy & Hold', line=dict(color='red', width=3, dash='dash')),
            row=1, col=1
        )
        
        # 2. Sharpe Ratio
        agent_sharpe = [ep['agent_metrics'].get('sharpe_ratio', 0) for ep in episode_data]
        bh_sharpe = [ep['bh_metrics'].get('sharpe_ratio', 0) for ep in episode_data]
        
        fig.add_trace(
            go.Scatter(x=episodes, y=agent_sharpe, mode='lines+markers', 
                      name='DQN Sharpe', line=dict(color='blue', width=3), showlegend=False),
            row=1, col=2
        )
        fig.add_trace(
            go.Scatter(x=episodes, y=bh_sharpe, mode='lines+markers', 
                      name='B&H Sharpe', line=dict(color='red', width=3, dash='dash'), showlegend=False),
            row=1, col=2
        )
        
        # 3. Max Drawdown
        agent_dd = [ep['agent_metrics'].get('max_drawdown', 0) * 100 for ep in episode_data]
        bh_dd = [ep['bh_metrics'].get('max_drawdown', 0) * 100 for ep in episode_data]
        
        fig.add_trace(
            go.Scatter(x=episodes, y=agent_dd, mode='lines+markers', 
                      name='DQN DD', line=dict(color='blue', width=3), showlegend=False),
            row=1, col=3
        )
        fig.add_trace(
            go.Scatter(x=episodes, y=bh_dd, mode='lines+markers', 
                      name='B&H DD', line=dict(color='red', width=3, dash='dash'), showlegend=False),
            row=1, col=3
        )
        
        # 4. Win Rate
        win_rates = [ep['agent_metrics'].get('win_rate', 0) * 100 for ep in episode_data]
        
        fig.add_trace(
            go.Scatter(x=episodes, y=win_rates, mode='lines+markers', 
                      name='Win Rate', line=dict(color='green', width=3), showlegend=False),
            row=2, col=1
        )
        
        # 5. Trading Frequency
        num_trades = [ep['agent_metrics'].get('num_trades', 0) for ep in episode_data]
        
        fig.add_trace(
            go.Scatter(x=episodes, y=num_trades, mode='lines+markers', 
                      name='Trades', line=dict(color='purple', width=3), showlegend=False),
            row=2, col=2
        )
        
        # 6. Performance Distribution
        fig.add_trace(
            go.Box(y=agent_returns, name='DQN Returns', boxpoints='all', 
                  jitter=0.3, pointpos=-1.8, marker_color='blue'),
            row=2, col=3
        )
        fig.add_trace(
            go.Box(y=bh_returns, name='B&H Returns', boxpoints='all', 
                  jitter=0.3, pointpos=1.8, marker_color='red'),
            row=2, col=3
        )
        
        # Update layout
        fig.update_layout(
            title_text="DQN Trading System - Interactive Dashboard",
            title_x=0.5,
            height=800,
            showlegend=True,
            template="plotly_white"
        )
        
        # Update axes labels
        fig.update_xaxes(title_text="Episode", row=1, col=1)
        fig.update_xaxes(title_text="Episode", row=1, col=2)
        fig.update_xaxes(title_text="Episode", row=1, col=3)
        fig.update_xaxes(title_text="Episode", row=2, col=1)
        fig.update_xaxes(title_text="Episode", row=2, col=2)
        
        fig.update_yaxes(title_text="Return (%)", row=1, col=1)
        fig.update_yaxes(title_text="Sharpe Ratio", row=1, col=2)
        fig.update_yaxes(title_text="Max Drawdown (%)", row=1, col=3)
        fig.update_yaxes(title_text="Win Rate (%)", row=2, col=1)
        fig.update_yaxes(title_text="Number of Trades", row=2, col=2)
        fig.update_yaxes(title_text="Return (%)", row=2, col=3)
        
        if save:
            fig.write_html(f'{self.save_dir}/interactive_dashboard.html')
            print(f"✅ Interactive dashboard saved to {self.save_dir}/interactive_dashboard.html")
        
        return fig

if __name__ == "__main__":
    # Test the visualization module
    print("🧪 Testing Visualization Module...")
    
    viz = TradingVisualizer()
    
    # Create dummy episode data for testing
    dummy_episode_data = []
    for i in range(20):
        dummy_episode_data.append({
            'episode': i,
            'agent_metrics': {
                'total_return_pct': np.random.randn() * 10 + 5,
                'sharpe_ratio': np.random.randn() * 0.5 + 1,
                'max_drawdown': np.random.random() * 0.2,
                'win_rate': np.random.random() * 0.4 + 0.3,
                'num_trades': np.random.randint(5, 50)
            },
            'bh_metrics': {
                'total_return_pct': np.random.randn() * 8 + 3,
                'sharpe_ratio': np.random.randn() * 0.3 + 0.8,
                'max_drawdown': np.random.random() * 0.15
            },
            'epsilon': 1.0 * (0.99 ** i)
        })
    
    # Test plotting functions
    viz.plot_training_progress(dummy_episode_data, save=False)
    viz.plot_evaluation_results(dummy_episode_data[::2], save=False)  # Every other episode
    
    print("✅ Visualization tests completed!") 
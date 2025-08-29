import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import numpy as np
import random
from collections import deque, namedtuple
from typing import Tuple, List

from config import MODEL_CONFIG

# Experience tuple for replay memory
Experience = namedtuple('Experience', ['state', 'action', 'reward', 'next_state', 'done'])

class ReplayMemory:
    """Experience replay memory for DQN"""
    
    def __init__(self, capacity: int):
        self.memory = deque(maxlen=capacity)
    
    def push(self, state, action, reward, next_state, done):
        """Save an experience tuple"""
        self.memory.append(Experience(state, action, reward, next_state, done))
    
    def sample(self, batch_size: int) -> List[Experience]:
        """Sample a batch of experiences"""
        return random.sample(self.memory, batch_size)
    
    def __len__(self):
        return len(self.memory)

class TemporalAttention(nn.Module):
    """Lightweight attention mechanism for temporal patterns in Bitcoin data"""
    
    def __init__(self, feature_dim: int, attention_dim: int = 64):
        super(TemporalAttention, self).__init__()
        self.feature_dim = feature_dim
        self.attention_dim = attention_dim
        
        # Attention weights
        self.attention = nn.Sequential(
            nn.Linear(feature_dim, attention_dim),
            nn.Tanh(),
            nn.Linear(attention_dim, 1)
        )
        
    def forward(self, x):
        # x shape: (batch_size, seq_len, feature_dim)
        # Compute attention weights
        attention_weights = self.attention(x)  # (batch_size, seq_len, 1)
        attention_weights = F.softmax(attention_weights, dim=1)
        
        # Apply attention
        attended = torch.sum(x * attention_weights, dim=1)  # (batch_size, feature_dim)
        return attended, attention_weights

class DQN(nn.Module):
    """Improved Deep Q-Network for Bitcoin trading with temporal attention"""
    
    def __init__(self, input_size: int, hidden_dim: int = 256, output_size: int = 3):
        super(DQN, self).__init__()
        
        self.input_size = input_size
        self.hidden_dim = hidden_dim
        self.output_size = output_size
        
        # Calculate dimensions
        # State = [lookback_window * features + portfolio_info + action_constraints]
        lookback_window = MODEL_CONFIG['lookback_window']
        portfolio_info = 4  # Portfolio state info
        action_constraints = 5  # Action constraint info
        
        # Calculate actual feature count from input size
        actual_lookback_size = input_size - portfolio_info - action_constraints
        self.feature_count = max(1, actual_lookback_size // lookback_window)
        
        print(f"🔧 DQN Architecture: Input={input_size}, Lookback={actual_lookback_size}, Features={self.feature_count}")
        
        # Store dimensions
        self.lookback_size = actual_lookback_size
        self.portfolio_size = portfolio_info
        self.constraints_size = action_constraints
        
        # Adaptive temporal feature extraction for lookback window
        self.temporal_processor = nn.Sequential(
            nn.Linear(self.feature_count, hidden_dim // 4),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim // 4, hidden_dim // 4),
            nn.ReLU()
        )
        
        # Attention mechanism for temporal patterns
        self.attention = TemporalAttention(hidden_dim // 4, attention_dim=32)
        
        # Portfolio state processor
        self.portfolio_processor = nn.Sequential(
            nn.Linear(portfolio_info, hidden_dim // 8),
            nn.ReLU(),
            nn.Linear(hidden_dim // 8, hidden_dim // 8)
        )
        
        # Action constraints processor
        self.constraints_processor = nn.Sequential(
            nn.Linear(action_constraints, hidden_dim // 16),
            nn.ReLU(),
            nn.Linear(hidden_dim // 16, hidden_dim // 16)
        )
        
        # Combined feature processing
        combined_size = hidden_dim // 4 + hidden_dim // 8 + hidden_dim // 16
        self.feature_combiner = nn.Sequential(
            nn.Linear(combined_size, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.1)
        )
        
        # Value stream (Dueling DQN)
        self.value_stream = nn.Sequential(
            nn.Linear(hidden_dim // 2, hidden_dim // 4),
            nn.ReLU(),
            nn.Linear(hidden_dim // 4, 1)
        )
        
        # Advantage stream (Dueling DQN)
        self.advantage_stream = nn.Sequential(
            nn.Linear(hidden_dim // 2, hidden_dim // 4),
            nn.ReLU(),
            nn.Linear(hidden_dim // 4, output_size)
        )
        
    def forward(self, x):
        batch_size = x.size(0)
        total_input_size = x.size(1)
        
        # Calculate actual dimensions based on input size
        portfolio_info = 4  # Portfolio state info
        action_constraints = 5  # Action constraint info
        
        # Calculate lookback size from actual input
        actual_lookback_size = total_input_size - portfolio_info - action_constraints
        
        # Split input into components
        lookback_data = x[:, :actual_lookback_size]  # Temporal features
        portfolio_data = x[:, actual_lookback_size:actual_lookback_size + portfolio_info]  # Portfolio state
        constraints_data = x[:, -action_constraints:]  # Action constraints
        
        # Calculate feature count and window size from actual data
        lookback_window = MODEL_CONFIG['lookback_window']
        actual_feature_count = actual_lookback_size // lookback_window
        
        if actual_feature_count <= 0:
            actual_feature_count = 1
            actual_window_size = actual_lookback_size
        else:
            actual_window_size = lookback_window
        
        # Reshape for temporal processing: (batch, timesteps, features)
        if actual_lookback_size > 0:
            # Ensure we can reshape properly
            expected_size = actual_window_size * actual_feature_count
            if actual_lookback_size != expected_size:
                # Adjust to fit available data
                if actual_lookback_size > expected_size:
                    lookback_data = lookback_data[:, :expected_size]
                else:
                    # Pad with zeros if needed
                    padding = torch.zeros(batch_size, expected_size - actual_lookback_size, device=x.device)
                    lookback_data = torch.cat([lookback_data, padding], dim=1)
                actual_lookback_size = expected_size
            
            temporal_features = lookback_data.view(batch_size, actual_window_size, actual_feature_count)
        else:
            # Fallback: create dummy temporal features
            temporal_features = torch.zeros(batch_size, 1, self.feature_count, device=x.device)
            actual_window_size = 1
            actual_feature_count = self.feature_count
        
        # Handle feature count mismatch by projecting to expected size
        if actual_feature_count != self.feature_count:
            # Project features to expected size
            projection = nn.Linear(actual_feature_count, self.feature_count).to(x.device)
            temporal_features_list = []
            for t in range(actual_window_size):
                timestep_features = temporal_features[:, t, :]  # (batch, actual_features)
                projected_features = projection(timestep_features)  # (batch, expected_features)
                temporal_features_list.append(projected_features)
            
            # Process projected features
            processed_temporal = []
            for projected_features in temporal_features_list:
                processed = self.temporal_processor(projected_features)  # (batch, hidden_dim//4)
                processed_temporal.append(processed)
        else:
            # Process each timestep normally
            processed_temporal = []
            for t in range(actual_window_size):
                timestep_features = temporal_features[:, t, :]  # (batch, features)
                processed = self.temporal_processor(timestep_features)  # (batch, hidden_dim//4)
                processed_temporal.append(processed)
        
        # Stack temporal features: (batch, timesteps, hidden_dim//4)
        temporal_stack = torch.stack(processed_temporal, dim=1)
        
        # Apply attention to capture important temporal patterns
        attended_temporal, attention_weights = self.attention(temporal_stack)
        
        # Process portfolio state
        portfolio_features = self.portfolio_processor(portfolio_data)
        
        # Process action constraints
        constraint_features = self.constraints_processor(constraints_data)
        
        # Combine all features
        combined_features = torch.cat([
            attended_temporal,      # Temporal patterns with attention
            portfolio_features,     # Current portfolio state
            constraint_features     # Action constraints
        ], dim=1)
        
        # Final feature processing
        features = self.feature_combiner(combined_features)
        
        # Dueling DQN architecture
        value = self.value_stream(features)
        advantage = self.advantage_stream(features)
        
        # Combine value and advantage
        q_values = value + (advantage - advantage.mean(dim=1, keepdim=True))
        
        return q_values

class DQNAgent:
    """DQN Agent for Bitcoin trading"""
    
    def __init__(self, state_size: int, action_size: int = 3):
        self.state_size = state_size
        self.action_size = action_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Hyperparameters
        self.learning_rate = MODEL_CONFIG['learning_rate']
        self.gamma = MODEL_CONFIG['gamma']
        self.epsilon = MODEL_CONFIG['epsilon_start']
        self.epsilon_end = MODEL_CONFIG['epsilon_end']
        self.epsilon_decay = MODEL_CONFIG['epsilon_decay']
        self.batch_size = MODEL_CONFIG['batch_size']
        self.target_update_freq = MODEL_CONFIG['target_update_freq']
        
        # Networks
        self.q_network = DQN(state_size, MODEL_CONFIG['hidden_dim'], action_size).to(self.device)
        self.target_network = DQN(state_size, MODEL_CONFIG['hidden_dim'], action_size).to(self.device)
        self.optimizer = optim.Adam(self.q_network.parameters(), lr=self.learning_rate, weight_decay=1e-5)
        
        # Initialize target network
        self.update_target_network()
        
        # Replay memory
        self.memory = ReplayMemory(MODEL_CONFIG['memory_size'])
        self.steps_done = 0
            
    def count_parameters(self):
        """Count trainable parameters"""
        return sum(p.numel() for p in self.q_network.parameters() if p.requires_grad)
    
    def select_action(self, state: np.ndarray, training: bool = True) -> int:
        """Select action using epsilon-greedy policy with action masking"""
        if training and random.random() < self.epsilon:
            # For exploration, only select from valid actions
            valid_actions = self._get_valid_actions(state)
            if len(valid_actions) > 0:
                return random.choice(valid_actions)
            else:
                return 1  # Default to hold if no valid actions
        
        # Get Q-values from the network
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q_values = self.q_network(state_tensor)
        
        # Apply action masking - set invalid actions to very low values
        masked_q_values = self._apply_action_mask(q_values, state)
        
        return masked_q_values.argmax().item()
    
    def _get_valid_actions(self, state: np.ndarray) -> list:
        """Get list of valid actions based on current state constraints"""
        # Extract action constraint info from state (last 5 elements)
        constraints = state[-5:]
        can_sell_btc = constraints[0] > 0.5      # Has BTC to sell
        can_hold = constraints[1] > 0.5          # Can always hold  
        can_buy_cash = constraints[2] > 0.5      # Has cash to buy
        can_sell_action = constraints[3] > 0.5   # Not consecutive sell
        can_buy_action = constraints[4] > 0.5    # Not consecutive buy
        
        valid_actions = []
        
        # Action 0: sell - need both BTC and not consecutive sell
        if can_sell_btc and can_sell_action:
            valid_actions.append(0)
            
        # Action 1: hold - always valid
        if can_hold:
            valid_actions.append(1)
            
        # Action 2: buy - need both cash and not consecutive buy  
        if can_buy_cash and can_buy_action:
            valid_actions.append(2)
            
        return valid_actions
    
    def _apply_action_mask(self, q_values: torch.Tensor, state: np.ndarray) -> torch.Tensor:
        """Apply action masking to Q-values"""
        masked_q_values = q_values.clone()
        
        # Extract action constraint info from state (last 5 elements)
        constraints = state[-5:]
        can_sell_btc = constraints[0] > 0.5      # Has BTC to sell
        can_hold = constraints[1] > 0.5          # Can always hold
        can_buy_cash = constraints[2] > 0.5      # Has cash to buy  
        can_sell_action = constraints[3] > 0.5   # Not consecutive sell
        can_buy_action = constraints[4] > 0.5    # Not consecutive buy
        
        # Mask invalid actions with very low Q-values
        very_low_value = -1000.0
        
        # Action 0: sell
        if not (can_sell_btc and can_sell_action):
            masked_q_values[0, 0] = very_low_value
            
        # Action 1: hold (always valid in our case)
        # No masking needed
            
        # Action 2: buy  
        if not (can_buy_cash and can_buy_action):
            masked_q_values[0, 2] = very_low_value
            
        return masked_q_values
    
    def store_experience(self, state, action, reward, next_state, done):
        """Store experience in replay memory"""
        self.memory.push(state, action, reward, next_state, done)
    
    def learn(self):
        """Learn from a batch of experiences"""
        if len(self.memory) < self.batch_size:
            return None
        
        # Sample batch
        experiences = self.memory.sample(self.batch_size)
        batch = Experience(*zip(*experiences))
        
        # Convert to tensors
        state_batch = torch.FloatTensor(np.array(batch.state)).to(self.device)
        action_batch = torch.LongTensor(batch.action).to(self.device)
        reward_batch = torch.FloatTensor(batch.reward).to(self.device)
        next_state_batch = torch.FloatTensor(np.array(batch.next_state)).to(self.device)
        done_batch = torch.BoolTensor(batch.done).to(self.device)
        
        # Current Q values
        current_q_values = self.q_network(state_batch).gather(1, action_batch.unsqueeze(1))
        
        # Double DQN: Use main network to select actions, target network to evaluate
        with torch.no_grad():
            next_actions = self.q_network(next_state_batch).argmax(1)
            next_q_values = self.target_network(next_state_batch).gather(1, next_actions.unsqueeze(1))
            target_q_values = reward_batch.unsqueeze(1) + (self.gamma * next_q_values * ~done_batch.unsqueeze(1))
        
        # Compute loss
        loss = F.mse_loss(current_q_values, target_q_values)
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        # Gradient clipping for stability
        torch.nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=1.0)
        self.optimizer.step()
        
        # Update target network
        self.steps_done += 1
        if self.steps_done % self.target_update_freq == 0:
            self.update_target_network()
        
        # Decay epsilon
        if self.epsilon > self.epsilon_end:
            self.epsilon *= self.epsilon_decay
        
        return loss.item()
    
    def update_target_network(self):
        """Update target network with current network weights"""
        self.target_network.load_state_dict(self.q_network.state_dict())
    
    def save_model(self, filepath: str):
        """Save model state dict only (sufficient for inference)"""
        torch.save({
            'model_state_dict': self.q_network.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'steps_done': self.steps_done
        }, filepath)
        print(f"💾 Model saved to {filepath}")
        print(f"📝 Note: Only model weights saved - sufficient for online trading inference")
    
    def load_model(self, filepath: str):
        """Load model state dict"""
        checkpoint = torch.load(filepath, map_location=self.device)
        self.q_network.load_state_dict(checkpoint['model_state_dict'])
        self.target_network.load_state_dict(checkpoint['model_state_dict'])
        
        # Optionally load training state (for continued training)
        if 'optimizer_state_dict' in checkpoint:
            self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        if 'epsilon' in checkpoint:
            self.epsilon = checkpoint['epsilon']
        if 'steps_done' in checkpoint:
            self.steps_done = checkpoint['steps_done']
            
        print(f"📂 Model loaded from {filepath}")
    
    def get_q_values(self, state: np.ndarray) -> np.ndarray:
        """Get Q-values for a given state"""
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q_values = self.q_network(state_tensor)
        return q_values.cpu().numpy()[0]

if __name__ == "__main__":
    # Test the DQN model
    state_size = 25  # Example feature size
    agent = DQNAgent(state_size)
    
    # Test forward pass
    test_state = np.random.randn(state_size)
    action = agent.select_action(test_state)
    q_values = agent.get_q_values(test_state)
    
    print(f"Test state shape: {test_state.shape}")
    print(f"Selected action: {action}")
    print(f"Q-values: {q_values}")
    print(f"Memory capacity: {MODEL_CONFIG['memory_size']:,}")
    print(f"Batch size: {MODEL_CONFIG['batch_size']}") 
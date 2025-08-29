#!/usr/bin/env python3
"""
Training Progress Monitor
Simple script to monitor DQN training progress
"""

import os
import time
import psutil
import glob

def monitor_training():
    """Monitor training progress"""
    print("🔍 DQN Training Monitor")
    print("=" * 50)
    
    # Check if Python process is running
    python_processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info']):
        try:
            if proc.info['name'] == 'python.exe':
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                if 'main.py' in cmdline:
                    python_processes.append({
                        'pid': proc.info['pid'],
                        'memory_mb': proc.info['memory_info'].rss / 1024 / 1024,
                        'cmdline': cmdline
                    })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if python_processes:
        print(f"✅ Found {len(python_processes)} training process(es):")
        for proc in python_processes:
            print(f"   PID: {proc['pid']}, Memory: {proc['memory_mb']:.1f} MB")
    else:
        print("❌ No training processes found")
        return
    
    # Check data files
    print(f"\n📊 Data Files:")
    data_files = ['data/raw_btc_data.csv', 'data/preprocessed_btc_data.csv']
    for file in data_files:
        if os.path.exists(file):
            size_mb = os.path.getsize(file) / 1024 / 1024
            print(f"   ✅ {file} ({size_mb:.1f} MB)")
        else:
            print(f"   ❌ {file} (missing)")
    
    # Check plot files
    print(f"\n📈 Generated Plots:")
    plot_files = glob.glob('plots/*.png')
    if plot_files:
        for plot in sorted(plot_files):
            print(f"   ✅ {plot}")
    else:
        print("   📝 No plots generated yet (training in progress...)")
    
    # Check model files
    print(f"\n🤖 Model Files:")
    model_files = glob.glob('models/*.pth')
    if model_files:
        for model in sorted(model_files):
            print(f"   ✅ {model}")
    else:
        print("   📝 No models saved yet")
    
    print(f"\n⏰ Monitor completed at {time.strftime('%H:%M:%S')}")

if __name__ == "__main__":
    monitor_training() 
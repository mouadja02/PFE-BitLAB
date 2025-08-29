#!/bin/bash

# Bitcoin Data Workflows - Airflow Setup Script

echo "🚀 Setting up Bitcoin Data Workflows with Apache Airflow..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it and try again."
    exit 1
fi

echo "✅ Docker and docker-compose are available"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p dags logs plugins config

# Set proper permissions for Linux/Mac
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    echo "🔒 Setting directory permissions..."
    sudo chown -R 50000:50000 dags logs plugins config
fi

# Build the custom Airflow image with Snowflake provider
echo "🏗️  Building custom Airflow image with required packages..."
docker-compose build

# Initialize Airflow database
echo "🗄️  Initializing Airflow database..."
docker-compose up airflow-init

echo "✅ Setup completed successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Add your GitHub Personal Access Token to the GITHUB_TOKEN variable in .env file"
echo "2. Start Airflow with: docker-compose up -d"
echo "3. Access Airflow UI at: http://localhost:8080 (airflow/airflow)"
echo "4. Unpause the DAGs you want to run"
echo ""
echo "📊 Available DAGs:"
echo "- btc_price_dataset: Fetch Bitcoin hourly price data"
echo "- bitcoin_news: Aggregate Bitcoin news from multiple sources"
echo "- on_chain_trader: Calculate Bitcoin on-chain metrics"
echo "- financial_market_data: Fetch financial market indicators"
echo "- btc_backup: Daily backup of Bitcoin data to GitHub"
echo "- kaggle_reminder: Monthly reminder to update Kaggle datasets" 
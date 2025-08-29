FROM apache/airflow:3.0.1

# Switch to root user to install packages
USER root

# Install system dependencies including git
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Switch back to airflow user
USER airflow

# Copy requirements file
COPY requirements.txt /tmp/requirements.txt

# Install Python packages
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Install additional Airflow providers and essential packages
RUN pip install --no-cache-dir \
    apache-airflow-providers-snowflake==5.3.0 \
    snowflake-connector-python==3.7.0 \
    apache-airflow-providers-http==4.9.0 \
    apache-airflow-providers-github==2.3.0 \
    pandas==2.1.4 \
    numpy==1.26.0 
# BitLAB — Project Overview

This repository contains the BitLAB project: a collection of tools, pipelines and applications built around Bitcoin data, on-chain and technical analytics and a small trading research environment.

The goal of this README is to help a reviewer quickly understand the layout of the repository, the role of each component, and how to run or inspect the code and artifacts. Explanations keep to plain language and point to the most relevant files.

## Quick navigation

- "BitLAB/" — Web frontend and API (Next.js) with dashboards, charts and helper API routes.
- "DataOps/" — Data orchestration and pipelines (Airflow + Docker Compose). Contains DAGs, deployment and infra helpers.
- "DeepTrader/" — Research code for reinforcement-learning based trading experiments (Python).
- "OnchainStrategy/" — Misc scripts and experiments for on-chain signals, forecasting and small utilities (Python).
- "Snowflake/" — SQL scripts used for on-chain analysis and reporting.
- "Forecasting/" — Forecasting-related files and datasets.
- "Report.pdf" — The project report (French).

## High-level description

The project is split into focused subprojects so each part can be explored independently:

- Frontend ("BitLAB") provides visualization and a set of API routes that aggregate data from local datasets or external sources.
- DataOps ("DataOps") orchestrates data ingestion and processing using Airflow; DAGs are in "DataOps/dags/".
- Research and modelling ("DeepTrader", "OnchainStrategy", "Forecasting") contain experiments, training code and small utilities for reproducing analyses.

If you want to browse the repo in a guided order, start with:
1. "Report.pdf" (overview and results in French).
2. "BitLAB/README.md" (UI and API details) then "BitLAB/src/" to see pages and components.
3. "DataOps/dags/" to inspect pipelines.
4. "DeepTrader/" and "OnchainStrategy/" for code used to produce experiments.

## How to run / inspect each component

Below are minimal steps and prerequisites for each major folder. The commands are PowerShell-friendly for Windows.

Prerequisites (common):
- Node.js (v16+ recommended) and npm for the frontend.
- Docker & Docker Compose for DataOps (Airflow).
- Python 3.9+ for research scripts; pip for dependencies.

1) BitLAB (frontend + API)

- Purpose: interactive dashboards and local API routes to serve data visualizations.
- Location: "BitLAB/"
- Quick start (from repository root):

"""powershell
cd .\BitLAB
npm install
npm run dev
"""

- Notes: copy or review ".env.example" in "BitLAB/" before running to provide any required keys. The app is a standard Next.js project; open the browser on the port reported by the dev server.

2) DataOps (Airflow pipelines)

- Purpose: orchestrates data ingestion and scheduled updates using Airflow DAGs.
- Location: "DataOps/" (DAGs in "DataOps/dags/", config in "DataOps/config/")
- Quick start (requires Docker):

"""powershell
cd .\DataOps
docker-compose -f .\docker-compose.yaml up -d
"""

- After startup, open the Airflow web UI as configured in the compose file (check "DataOps/docker-compose.yaml") to inspect and trigger DAGs. If Docker is not installed, you can read the DAGs as Python files in "DataOps/dags/".

3) DeepTrader (research & models)

- Purpose: reinforcement-learning trading experiments and plotting results.
- Location: "DeepTrader/"
- Quick start (create virtual environment and run):

"""powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\DeepTrader\requirements.txt
python .\DeepTrader\main.py
"""

- Outputs and plots are saved in subfolders like "DeepTrader/training_history/", "DeepTrader/batch_analysis/".

4) OnchainStrategy (scripts & utilities)

- Purpose: forecasting helpers, data exports and example strategies.
- Location: "OnchainStrategy/"
- Quick run example:

"""powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\OnchainStrategy\requirements_optimization.txt
python .\OnchainStrategy\main.py
"""

5) Snowflake (SQL)

- Purpose: SQL scripts for reporting and extracting on-chain features.
- Location: "Snowflake/" (open the ".sql" files with a SQL viewer or editor). These are intended to be run in a Snowflake database environment.

6) Forecasting and other artifacts

- "Forecasting/" contains a "kalman.m" MATLAB file and dataset folders for hourly OHLCV data. Open with MATLAB or read datasets directly.
- "n8n/" has an exported flow ("BitLAB-Chatbot.json") that can be imported into an n8n instance.

## Where to find more documentation

- Each subproject may contain its own README: e.g., "BitLAB/README.md", "DeepTrader/README.md" — check those for more details.
- The main project report, "Report.pdf", contains a narrative and results (in French).

## Practical tips for reviewers

- If you are only browsing results, open "Report.pdf" first and then inspect the folders referenced in the report.
- Developers' notes, data sources or environment variables are stored near the code that needs them (look for ".env.example" files and "requirements.txt").
- No sensitive credentials are included in the repo — if needed, ask the maintainers for access to runtime secrets or data stores.

## Contact / next steps

If you want a short guided walkthrough (live demo, screenshots, or a short recorded tour), say which part you want to explore first (frontend, pipelines, or models) and I will prepare a focused guide.

---

Files of interest at the top level:

- "Report.pdf" — project report (French).
- "BitLAB/" — frontend & API (Next.js).
- "DataOps/" — Airflow DAGs and Docker Compose deployment.
- "DeepTrader/" — Python research code and results.
- "OnchainStrategy/" — forecasting & scripts.
- "Snowflake/" — SQL scripts.


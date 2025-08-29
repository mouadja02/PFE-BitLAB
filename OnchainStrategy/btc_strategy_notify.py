import datetime
import numpy as np
import pandas as pd
import requests
import os
from utils import load_data_from_snowflake
from main import (
    calculate_mvrv_zscore,
    calculate_nupl_zscore,
    calculate_combined_signal,
    generate_signals,
    backtest_strategy
)

# Paramètres optimisés de la stratégie
OPTIMIZED_PARAMS = {
    'combine_method': 'weighted',
    'ma_type': 'EMA',
    'ma_length': 160,
    'zscore_lookback': 120,
    'long_threshold': 0.56,
    'short_threshold': -0.45,
    'mvrv_weight': 0.63,
    'nupl_weight': 0.37,
    'initial_capital': 10000
}

# Configuration Telegram
TELEGRAM_BOT_TOKEN = "7781471038:AAE-ucSeegLOVPGhVVS6LIkyExpUC37-trk"
TELEGRAM_CHAT_ID = "1766877995"

# Classification du Fear & Greed Index
def get_fng_classification(fng_value):
    if fng_value >= 75:
        return "Extreme Greed 🤑", "75 - 100"
    elif fng_value >= 51:
        return "Greed 😏", "51 - 74"
    elif fng_value == 50:
        return "Neutral 😐", "50"
    elif fng_value >= 25:
        return "Fear 😟", "25 - 49"
    else:
        return "Extreme Fear 😱", "0 - 24"

def get_fng_index(latest_date):
    """Récupère et calcule la moyenne du Fear & Greed Index pour une date donnée"""
    try:
        # Chemin vers le fichier CSV du FNG
        fng_csv_path = os.path.join('bitcoin-news-data', 'bitcoin_fng_index.csv')
        
        # Vérifier si le fichier existe
        if not os.path.exists(fng_csv_path):
            print(f"Fichier FNG non trouvé: {fng_csv_path}")
            return None
        
        # Charger les données du FNG
        fng_df = pd.read_csv(fng_csv_path)
        
        # Afficher les en-têtes pour le débogage
        print(f"Colonnes du fichier FNG: {fng_df.columns.tolist()}")
        
        # Vérifier si les colonnes nécessaires existent
        if 'date' not in fng_df.columns:
            # Vérifier si la première colonne est 'date' et que l'en-tête a été mal parsé
            if len(fng_df.columns) > 0 and 'date' in fng_df.columns[0]:
                print("Re-lecture du CSV avec un parseur explicite...")
                fng_df = pd.read_csv(fng_csv_path, header=0)
                print(f"Nouvelles colonnes: {fng_df.columns.tolist()}")
        
        # Si "score" est la colonne avec les valeurs du FNG, on l'utilise
        value_column = 'score' if 'score' in fng_df.columns else 'value'
        
        if value_column not in fng_df.columns:
            print(f"Colonne {value_column} non trouvée dans le fichier FNG")
            # Afficher les premières lignes pour comprendre la structure
            print(f"Aperçu du fichier FNG:\n{fng_df.head()}")
            return None
        
        # Convertir la colonne date en datetime si ce n'est pas déjà le cas
        fng_df['date'] = pd.to_datetime(fng_df['date'])
        
        # Formater la date pour la correspondance
        date_str = latest_date.strftime('%Y-%m-%d')
        
        # Filtrer les données pour la date spécifiée
        day_fng = fng_df[fng_df['date'].dt.strftime('%Y-%m-%d') == date_str]
        
        if day_fng.empty:
            print(f"Aucune donnée FNG trouvée pour la date {date_str}")
            # Utiliser la date la plus récente disponible
            latest_fng_date = fng_df['date'].max()
            print(f"Utilisation de la date la plus récente disponible: {latest_fng_date.strftime('%Y-%m-%d')}")
            day_fng = fng_df[fng_df['date'].dt.strftime('%Y-%m-%d') == latest_fng_date.strftime('%Y-%m-%d')]
            
            if day_fng.empty:
                print("Aucune donnée FNG disponible")
                return None
        
        # Calculer la moyenne des valeurs FNG pour cette journée
        avg_fng = day_fng[value_column].mean()
        print(f"Moyenne du FNG pour {date_str}: {avg_fng}")
        
        return avg_fng
    
    except Exception as e:
        print(f"Erreur lors de la récupération du FNG: {e}")
        import traceback
        traceback.print_exc()
        return None

def send_telegram_message(message):
    """Envoyer un message via le bot Telegram"""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown"
    }
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("Message envoyé avec succès sur Telegram")
        else:
            print(f"Erreur lors de l'envoi du message: {response.text}")
    except Exception as e:
        print(f"Exception lors de l'envoi du message: {e}")

def get_signal_emoji(signal):
    """Retourne un emoji en fonction du signal"""
    if signal == "LONG":
        return "🟢"
    elif signal == "SHORT":
        return "🔴"
    elif signal == "HOLD BTC":
        return "💎"
    elif signal == "HOLD FIAT":
        return "💵"
    else:
        return "⚪"

def run_btc_strategy():
    """Exécute la stratégie et envoie le rapport sur Telegram"""
    print(f"Exécution de la stratégie - {datetime.datetime.now()}")
    
    try:
        # Charger les données depuis Snowflake
        print("Chargement des données depuis Snowflake...")
        df = load_data_from_snowflake(save_csv=True)
        
        # Appliquer les calculs de la stratégie
        print("Calcul des indicateurs MVRV Z-Score...")
        df = calculate_mvrv_zscore(
            df.copy(),
            ma_type=OPTIMIZED_PARAMS['ma_type'],
            ma_length=OPTIMIZED_PARAMS['ma_length'],
            lookback=OPTIMIZED_PARAMS['zscore_lookback']
        )
        
        print("Calcul des indicateurs NUPL Z-Score...")
        df = calculate_nupl_zscore(
            df,
            ma_type=OPTIMIZED_PARAMS['ma_type'],
            ma_length=OPTIMIZED_PARAMS['ma_length'],
            lookback=OPTIMIZED_PARAMS['zscore_lookback']
        )
        
        print("Calcul du signal combiné...")
        df = calculate_combined_signal(
            df,
            method=OPTIMIZED_PARAMS['combine_method'],
            mvrv_weight=OPTIMIZED_PARAMS['mvrv_weight'],
            nupl_weight=OPTIMIZED_PARAMS['nupl_weight']
        )
        
        print("Génération des signaux de trading...")
        df = generate_signals(
            df,
            long_threshold=OPTIMIZED_PARAMS['long_threshold'],
            short_threshold=OPTIMIZED_PARAMS['short_threshold'],
            z_score_col='COMBINED_ZSCORE'
        )
        
        print("Backtest de la stratégie...")
        df = backtest_strategy(df, initial_capital=OPTIMIZED_PARAMS['initial_capital'])
        
        # Extraire le dernier signal et la position
        latest_date = df.index[-1]
        latest_signal = df['SIGNAL'].iloc[-1]
        current_position = df['POSITION'].iloc[-1]
        # Use CLOSE if available, otherwise fallback to PRICE
        price_col = 'CLOSE' if 'CLOSE' in df.columns else 'PRICE'
        latest_price = df[price_col].iloc[-1]
        
        # Trouver le dernier signal non-zéro pour déterminer la dernière action
        last_action_signal = None
        for i in range(len(df) - 1, -1, -1):
            if df['SIGNAL'].iloc[i] != 0:
                last_action_signal = df['SIGNAL'].iloc[i]
                break
        
        # Déterminer le signal actuel avec plus de contexte
        if latest_signal == 1:
            current_signal = "LONG"
            signal_context = "🚀 Achat de BTC recommandé"
        elif latest_signal == -1:
            current_signal = "SHORT"
            signal_context = "💰 Vente de BTC recommandée - Passage en fiat"
        else:
            # Signal = 0, donc on est en mode HOLD
            if current_position == 1:
                # On détient du BTC
                current_signal = "HOLD BTC"
                if last_action_signal == 1:
                    signal_context = "💎 Conserver vos BTCs (dernier signal: LONG)"
                else:
                    signal_context = "💎 Conserver vos BTCs"
            else:
                # On détient du fiat
                current_signal = "HOLD FIAT"
                if last_action_signal == -1:
                    signal_context = "💵 Conserver votre fiat (dernier signal: SHORT)"
                else:
                    signal_context = "💵 Conserver votre fiat"
        
        # Récupérer le Fear & Greed Index pour la date la plus récente
        print(f"Récupération du Fear & Greed Index pour la date {latest_date.strftime('%Y-%m-%d')}...")
        fng_value = get_fng_index(latest_date)
        
        # Calculer les métriques de performance
        initial_value = df['PORTFOLIO_VALUE'].iloc[0]
        final_value = df['PORTFOLIO_VALUE'].iloc[-1]
        buy_hold_final = df['BUY_HOLD_VALUE'].iloc[-1]
        
        total_return = (final_value / initial_value - 1) * 100
        buy_hold_return = (buy_hold_final / initial_value - 1) * 100
        outperformance = total_return - buy_hold_return
        
        # Calculer le rendement sur 30 jours
        if len(df) > 30:
            month_return = (df['PORTFOLIO_VALUE'].iloc[-1] / df['PORTFOLIO_VALUE'].iloc[-30] - 1) * 100
            market_month_return = (df['BUY_HOLD_VALUE'].iloc[-1] / df['BUY_HOLD_VALUE'].iloc[-30] - 1) * 100
        else:
            month_return = 0
            market_month_return = 0
        
        # Extraire les valeurs Z-Score actuelles
        current_mvrv_zscore = df['MVRV_ZSCORE'].iloc[-1]
        current_nupl_zscore = df['NUPL_ZSCORE'].iloc[-1]
        current_combined_zscore = df['COMBINED_ZSCORE'].iloc[-1]
        
        # Créer le message pour Telegram
        emoji = get_signal_emoji(current_signal)
        
        # Ajouter les infos FNG si disponibles
        fng_info = ""
        if fng_value is not None:
            fng_class, fng_range = get_fng_classification(fng_value)
            fng_info = f"""
*Bitcoin Fear & Greed Index*: 
- Valeur: {fng_value:.1f}/100
- Classification: *{fng_class}*
"""
        message = f"""*Rapport de la Stratégie BTC*
        
*Prix de fermeture du BTC pour {latest_date.strftime('%Y-%m-%d')}*: ${latest_price:.2f}

*SIGNAL ACTUEL*: {emoji} *{current_signal}*
*Contexte*: {signal_context}{fng_info}

*Indicateurs Z-Score*:
- MVRV Z-Score: {current_mvrv_zscore:.3f}
- NUPL Z-Score: {current_nupl_zscore:.3f}
- *Z-Score Combiné*: {current_combined_zscore:.3f}

*Résultats du backtest de la stratégie sur le marché BTC*:
- Rendement Total: {total_return:.2f}%
- Rendement Buy & Hold: {buy_hold_return:.2f}%
- Surperformance: {outperformance:.2f}%

*Performance sur 30 jours*:
- Stratégie: {month_return:.2f}%
- Marché: {market_month_return:.2f}%

*Paramètres de la stratégie*:
- Méthode: {OPTIMIZED_PARAMS['combine_method']}
- MA Type: {OPTIMIZED_PARAMS['ma_type']}
- MA Length: {OPTIMIZED_PARAMS['ma_length']}
- Lookback: {OPTIMIZED_PARAMS['zscore_lookback']}
- Seuil d'achat: {OPTIMIZED_PARAMS['long_threshold']}
- Seuil de vente: {OPTIMIZED_PARAMS['short_threshold']}
- Poids MVRV: {OPTIMIZED_PARAMS['mvrv_weight']}
- Poids NUPL: {OPTIMIZED_PARAMS['nupl_weight']}

⚠️ *AVERTISSEMENT* ⚠️
_Ceci est uniquement une recommandation de trading basée sur des indicateurs on-chain. Une analyse approfondie doit être effectuée par le destinataire avant toute décision d'investissement._

📝 *NOTE* 📝
_Cette stratégie, déduite d'une analyse des indicateurs on-chain, est conçue pour le trading à long terme. Une stratégie de trading haute fréquence est actuellement en cours de développement._
"""
        
        # Envoyer le message sur Telegram
        print("Envoi du rapport sur Telegram...")
        send_telegram_message(message)
        print("Rapport envoyé avec succès")
        
        return df, current_signal
        
    except Exception as e:
        error_message = f"⚠️ *ERREUR* ⚠️\nUne erreur s'est produite lors de l'exécution de la stratégie: {str(e)}"
        print(error_message)
        send_telegram_message(error_message)
        return None, None

if __name__ == "__main__":
    # Exécuter la stratégie une seule fois
    df, signal = run_btc_strategy()
    print(f"Analyse terminée. Signal actuel: {signal}") 
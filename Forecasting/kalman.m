%% Bitcoin Close Price Forecasting using Kalman Filter
clc, close all, clear all;
%% Load and prepare data
global trainFilteredState trainFilteredStateCovariance A C Q R datetimes;

% Read the data
% Use the exact filename that was provided
data = readtable('bitcoin-hourly-ohclv-dataset\btc-hourly-price_2015_2025.csv', 'Delimiter', ',');

% Fix column names by removing leading spaces
data.Properties.VariableNames = strrep(data.Properties.VariableNames, ' ', '');

% Convert date and time strings to datetime objects
% Handle each row individually to avoid string concatenation issues
n = height(data);
datetimes = NaT(n, 1); % Initialize datetime array with NaT (Not-a-Time)

for i = 1:n
    dateStr = char(data.DATE_STR(i)); % Convert to char if it's a string array
    hourStr = num2str(data.HOUR_STR(i));
    dateTimeStr = [dateStr, ' ', hourStr, ':00:00'];
    datetimes(i) = datetime(dateTimeStr, 'InputFormat', 'yyyy-MM-dd HH:mm:ss');
end

% Extract the price data for forecasting
closePrices = data.CLOSE_PRICE;
openPrices = data.OPEN_PRICE;
highPrices = data.HIGH_PRICE;
lowPrices = data.LOW_PRICE;
volumes = data.VOLUME_FROM;

% Create a time series object
numIndices = 1:length(closePrices);
bitcoinTS = timeseries(closePrices, numIndices);
bitcoinTS.Name = 'Bitcoin Close Price';
bitcoinTS.TimeInfo.Units = 'hours';

%% Split data into training and testing sets
% Use 80% for training, 20% for testing
trainSize = floor(0.8 * length(closePrices));
trainData = closePrices(1:trainSize);
testData = closePrices(trainSize+1:end);
trainDates = datetimes(1:trainSize);
testDates = datetimes(trainSize+1:end);

fprintf('Training data size: %d observations\n', length(trainData));
fprintf('Testing data size: %d observations\n', length(testData));

%% Kalman Filter Implementation

% State-space model for Kalman filter
% State vector: [Level; Trend]
% Observation: Level

% Initialize model parameters
A = [1 1; 0 1];  % State transition matrix
C = [1 0];       % Observation matrix
Q = [0.01 0; 0 0.001];  % Process noise covariance - adjusted for better performance
R = 1;           % Observation noise variance

% Initial state estimate using first few observations
initialLevel = trainData(1);
initialTrend = mean(diff(trainData(1:min(10, length(trainData)))));
x0 = [initialLevel; initialTrend];
P0 = eye(2) * 100;  % Initial state covariance - high uncertainty

% Kalman filter function
kalmanFilter = @(observations, A, C, Q, R, x0, P0) local_kalmanFilter(observations, A, C, Q, R, x0, P0);

% Run Kalman filter on training data
[trainFilteredState, trainFilteredStateCovariance] = kalmanFilter(trainData, A, C, Q, R, x0, P0);

% Use last state as initial state for forecasting
xForecast = trainFilteredState(:, end);
PForecast = trainFilteredStateCovariance(:, :, end);

% Forecast with Kalman filter
kalmanPredictions = zeros(length(testData), 1);
kalmanPredictionCI = zeros(length(testData), 2);

for t = 1:length(testData)
    % Prediction step
    xPred = A * xForecast;
    PPred = A * PForecast * A' + Q;
    
    % Store prediction (Level component)
    kalmanPredictions(t) = C * xPred;
    
    % 95% prediction interval
    predVar = C * PPred * C' + R;
    kalmanPredictionCI(t, :) = [
        kalmanPredictions(t) - 1.96 * sqrt(predVar),
        kalmanPredictions(t) + 1.96 * sqrt(predVar)
    ];
    
    % Update step using the actual observation (if available)
    % In a true forecast scenario, we wouldn't have this, but including it
    % provides a filtered estimate that can be useful for analysis
    if t <= length(testData)
        K = PPred * C' / (C * PPred * C' + R);
        xForecast = xPred + K * (testData(t) - C * xPred);
        PForecast = (eye(2) - K * C) * PPred;
    else
        % For forecasts beyond available data, just propagate state
        xForecast = xPred;
        PForecast = PPred;
    end
end

% Calculate metrics
kalmanRMSE = sqrt(mean((testData - kalmanPredictions).^2));

kalmanPctChange = zeros(1,length(kalmanPredictions));

for i=2:length(kalmanPredictions)
    kalmanPctChange(i) = (kalmanPredictions(i)-kalmanPredictions(i-1))/kalmanPredictions(i-1);
end

PctChange = zeros(1,length(testData));

for i=2:length(testData)
    PctChange(i) = (testData(i)-testData(i-1))/testData(i-1);
end

figure('Position', [100, 100, 1200, 800]);
hold on;
% Plot training data
plot(testDates, kalmanPctChange, 'g-', 'LineWidth', 1);
% Plot test data
plot(testDates, PctChange, 'r--', 'LineWidth', 1);
hold off;
title('Kalman Filter Predicted Pct Change', 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('Percentage Change (%)', 'FontSize', 12);
grid on;
datetick('x', 'dd-mmm', 'keepticks');


fprintf('Kalman Filter RMSE: %f\n', kalmanRMSE);

kalmanMAPE = mean(abs((testData - kalmanPredictions) ./ testData)) * 100;
fprintf('Kalman Filter MAPE: %f%%\n', kalmanMAPE);

%% Plot forecasting results
% Figure 1: Basic Kalman Filter Forecast
figure('Position', [100, 100, 1200, 800]);
hold on;
% Plot training data
plot(trainDates, trainData, 'b-', 'LineWidth', 1);
% Plot test data
plot(testDates, testData, 'y-', 'LineWidth', 1);
% Plot Kalman forecast
plot(testDates, kalmanPredictions, 'r-', 'LineWidth', 2);
hold off;
title(sprintf('Kalman Filter Forecast - RMSE: %.2f, MAPE: %.2f%%', ...
    kalmanRMSE, kalmanMAPE), 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('Price (USD)', 'FontSize', 12);
legend('Training Data', 'Actual', 'Forecast', 'Location', 'best');
grid on;
datetick('x', 'dd-mmm', 'keepticks');

% Figure 2: Kalman Filter Forecast with Confidence Intervals
figure('Position', [100, 100, 1200, 800]);
hold on;
% Plot training data
plot(trainDates, trainData, 'b-', 'LineWidth', 1);
% Plot test data
plot(testDates, testData, 'k-', 'LineWidth', 1);
% Plot Kalman forecast
plot(testDates, kalmanPredictions, 'g-', 'LineWidth', 2);
% Plot prediction intervals
plot(testDates, kalmanPredictionCI(:, 1), 'g--', 'LineWidth', 1);
plot(testDates, kalmanPredictionCI(:, 2), 'g--', 'LineWidth', 1);
hold off;
title(sprintf('Kalman Filter Forecast with 95%% Confidence Intervals - RMSE: %.2f, MAPE: %.2f%%', ...
    kalmanRMSE, kalmanMAPE), 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('Price (USD)', 'FontSize', 12);
legend('Training Data', 'Actual', 'Forecast', '95% Lower Bound', '95% Upper Bound', 'Location', 'best');
grid on;
datetick('x', 'dd-mmm', 'keepticks');

% Figure 3: Simplified Comparison
figure('Position', [100, 100, 1200, 500]);
hold on;
plot(testDates, testData, 'k-', 'LineWidth', 2, 'DisplayName', 'Actual');
plot(testDates, kalmanPredictions, 'g-', 'LineWidth', 1.5, 'DisplayName', 'Kalman');
hold off;
title('Comparison of Forecasting Methods', 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('Price (USD)', 'FontSize', 12);
legend('Location', 'bestoutside');
grid on;
datetick('x', 'dd-mmm', 'keepticks');

% Add text with RMSE values
dim = [0.15 0.7 0.3 0.2];
str = sprintf('Kalman RMSE: %.2f\nKalman MAPE: %.2f%%', ...
    kalmanRMSE, kalmanMAPE);
annotation('textbox', dim, 'String', str, 'FitBoxToText', 'on', 'BackgroundColor', 'white');

% Figure 4: NEW - Forecast Error Analysis
figure('Position', [100, 100, 1200, 800]);

% Calculate prediction errors
predictionErrors = testData - kalmanPredictions;
percentErrors = (predictionErrors ./ testData) * 100;

% Create 2x2 subplots for different error visualizations
subplot(2, 2, 1);
% Absolute error over time
plot(testDates, abs(predictionErrors), 'r-', 'LineWidth', 1.5);
title('Absolute Prediction Error Over Time', 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('Absolute Error (USD)', 'FontSize', 12);
grid on;
datetick('x', 'dd-mmm', 'keepticks');

subplot(2, 2, 2);
% Percent error over time
plot(testDates, abs(percentErrors), 'b-', 'LineWidth', 1.5);
title('Absolute Percentage Error Over Time', 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('Absolute Percentage Error (%)', 'FontSize', 12);
grid on;
datetick('x', 'dd-mmm', 'keepticks');

subplot(2, 2, 3);
% Error distribution histogram
histogram(predictionErrors, 50, 'FaceColor', [0.3 0.6 0.9], 'EdgeColor', 'none');
title('Distribution of Prediction Errors', 'FontSize', 14);
xlabel('Prediction Error (USD)', 'FontSize', 12);
ylabel('Frequency', 'FontSize', 12);
grid on;

subplot(2, 2, 4);
% Scatter plot of predicted vs actual
scatter(testData, kalmanPredictions, 15, 'filled', 'MarkerFaceColor', [0 0.5 0]);
hold on;
% Add perfect prediction line
minVal = min(min(testData), min(kalmanPredictions));
maxVal = max(max(testData), max(kalmanPredictions));
plot([minVal, maxVal], [minVal, maxVal], 'k--', 'LineWidth', 1);
hold off;
title('Predicted vs. Actual Prices', 'FontSize', 14);
xlabel('Actual Price (USD)', 'FontSize', 12);
ylabel('Predicted Price (USD)', 'FontSize', 12);
grid on;

% Add a title for the entire figure
sgtitle('Kalman Filter Prediction Error Analysis', 'FontSize', 16);

% Figure 5: NEW - Rolling Error Metrics
figure('Position', [100, 100, 1200, 500]);

% Calculate rolling metrics with a window of 24 hours (1 day)
windowSize = 24;
numTestPoints = length(testData);
rollingRMSE = zeros(numTestPoints - windowSize + 1, 1);
rollingMAPE = zeros(numTestPoints - windowSize + 1, 1);
rollingDates = testDates(windowSize:end);

for i = 1:(numTestPoints - windowSize + 1)
    windowErrors = testData(i:i+windowSize-1) - kalmanPredictions(i:i+windowSize-1);
    rollingRMSE(i) = sqrt(mean(windowErrors.^2));
    rollingMAPE(i) = mean(abs(windowErrors ./ testData(i:i+windowSize-1))) * 100;
end

% Create subplot for rolling metrics
subplot(2, 1, 1);
plot(rollingDates, rollingRMSE, 'r-', 'LineWidth', 1.5);
title('24-Hour Rolling RMSE', 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('RMSE (USD)', 'FontSize', 12);
grid on;
datetick('x', 'dd-mmm', 'keepticks');

subplot(2, 1, 2);
plot(rollingDates, rollingMAPE, 'b-', 'LineWidth', 1.5);
title('24-Hour Rolling MAPE', 'FontSize', 14);
xlabel('Date', 'FontSize', 12);
ylabel('MAPE (%)', 'FontSize', 12);
grid on;
datetick('x', 'dd-mmm', 'keepticks');

% Add a title for the entire figure
sgtitle('Rolling Error Metrics Over Time', 'FontSize', 16);
%%

implementARIMAModel()

%%
closePrices = [trainData; testData];

%forecastNext24Hours(closePrices)
runKalmanOnNewData('bitcoin-hourly-ohclv-dataset/btc_ohclv_2025-05-13.csv');

%% Function Definitions


function runKalmanOnNewData(newDataFilePath)
    % Function to run Kalman filter on new 24-hour data
    % newDataFilePath: path to CSV file containing 24 hours of data with same columns as training data
    
    % Access the global variables from the main script
    global trainFilteredState trainFilteredStateCovariance A C Q R;
    
    % Check if file exists
    if ~exist(newDataFilePath, 'file')
        error('File not found: %s', newDataFilePath);
    end
    
    % Read the new data
    try
        newData = readtable(newDataFilePath, 'Delimiter', ',');
        
        % Fix column names by removing leading spaces
        newData.Properties.VariableNames = strrep(newData.Properties.VariableNames, ' ', '');
        
        % Check if required columns exist
        requiredColumns = {'DATE_STR', 'HOUR_STR', 'CLOSE_PRICE'};
        for i = 1:length(requiredColumns)
            if ~ismember(requiredColumns{i}, newData.Properties.VariableNames)
                error('Required column "%s" not found in the new data file', requiredColumns{i});
            end
        end
        
        % Check if we have 24 hours of data
        if height(newData) ~= 24
            warning('Expected 24 hours of data, but got %d records', height(newData));
        end
        
        % Parse dates and times
        newDatetimes = NaT(height(newData), 1);
        for i = 1:height(newData)
            dateStr = char(newData.DATE_STR(i));
            hourStr = num2str(newData.HOUR_STR(i));
            dateTimeStr = [dateStr, ' ', hourStr, ':00:00'];
            newDatetimes(i) = datetime(dateTimeStr, 'InputFormat', 'yyyy-MM-dd HH:mm:ss');
        end
        
        % Extract close prices
        newClosePrices = newData.CLOSE_PRICE;
        
        % Apply Kalman filter to new data
        % We'll use the last state from our training as the initial state
        fprintf('Running Kalman filter on new 24-hour data...\n');
        
        % Check if Kalman filter has been run in the main script
        if isempty(trainFilteredState) || isempty(trainFilteredStateCovariance)
            error('Please run the main Kalman filter model first');
        end
        
        % Get last state and covariance from training
        x0 = trainFilteredState(:, end);
        P0 = trainFilteredStateCovariance(:, :, end);
        
        % FIX: Instead of trying to get the last known price from closePrices (which might not be available),
        % we'll use the first value of the new data and correct the initial state based on that
        firstNewPrice = newClosePrices(1);
        
        % Display the discrepancy for debugging
        fprintf('Original Kalman last state: Level = %.2f, Trend = %.2f\n', x0(1), x0(2));
        fprintf('First price from new data: %.2f\n', firstNewPrice);
        fprintf('Discrepancy: %.2f\n', firstNewPrice - x0(1));
        
        % FIX: Correct the state to match the expected price level
        % Keep the estimated trend but update the level
        x0_corrected = [firstNewPrice; x0(2)];
        fprintf('Corrected initial state: Level = %.2f, Trend = %.2f\n', x0_corrected(1), x0_corrected(2));
        
        % Run Kalman filter on new data with corrected initial state
        [newFilteredState, newFilteredStateCovariance] = local_kalmanFilter(newClosePrices, A, C, Q, R, x0_corrected, P0);
        
        % Generate one-step ahead predictions
        newPredictions = zeros(height(newData), 1);
        newPredictionCI = zeros(height(newData), 2);
        
        for t = 1:height(newData)
            % If it's the first step, use corrected initial state for prediction
            if t == 1
                xPred = A * x0_corrected;
                PPred = A * P0 * A' + Q;
            else
                % Otherwise use the previous filtered state
                xPred = A * newFilteredState(:, t-1);
                PPred = A * newFilteredStateCovariance(:, :, t-1) * A' + Q;
            end
            
            % Store prediction (Level component)
            newPredictions(t) = C * xPred;
            
            % 95% prediction interval
            predVar = C * PPred * C' + R;
            newPredictionCI(t, :) = [
                newPredictions(t) - 1.96 * sqrt(predVar),
                newPredictions(t) + 1.96 * sqrt(predVar)
            ];
        end
        
        % Verify first prediction
        fprintf('First prediction: %.2f\n', newPredictions(1));
        fprintf('First actual value: %.2f\n', newClosePrices(1));
        fprintf('Difference: %.2f\n', newPredictions(1) - newClosePrices(1));
        
        % Calculate performance metrics
        newRMSE = sqrt(mean((newClosePrices - newPredictions).^2));
        newMAPE = mean(abs((newClosePrices - newPredictions) ./ newClosePrices)) * 100;
        
        fprintf('New Data Kalman Filter RMSE: %f\n', newRMSE);
        fprintf('New Data Kalman Filter MAPE: %f%%\n', newMAPE);
        
        % Plot results
        figure('Position', [100, 100, 1200, 800]);
        
        % Subplot 1: Actual vs Predicted
        subplot(2, 2, 1:2);
        hold on;
        plot(newDatetimes, newClosePrices, 'k-o', 'LineWidth', 1.5, 'DisplayName', 'Actual');
        plot(newDatetimes, newPredictions, 'r-o', 'LineWidth', 1.5, 'DisplayName', 'Kalman Predicted');
        plot(newDatetimes, newPredictionCI(:, 1), 'r--', 'LineWidth', 1, 'DisplayName', '95% Lower Bound');
        plot(newDatetimes, newPredictionCI(:, 2), 'r--', 'LineWidth', 1, 'DisplayName', '95% Upper Bound');
        hold off;
        title(sprintf('Kalman Filter 24-Hour Forecast - RMSE: %.2f, MAPE: %.2f%%', newRMSE, newMAPE), 'FontSize', 14);
        xlabel('Hour', 'FontSize', 12);
        ylabel('Price (USD)', 'FontSize', 12);
        legend('Location', 'best');
        grid on;
        datetick('x', 'HH:MM', 'keepticks');
        
        % Subplot 2: Absolute Errors
        subplot(2, 2, 3);
        errors = newClosePrices - newPredictions;
        bar(1:height(newData), abs(errors), 'FaceColor', [0.3 0.6 0.9]);
        title('Absolute Prediction Errors', 'FontSize', 14);
        xlabel('Hour of Day', 'FontSize', 12);
        ylabel('Absolute Error (USD)', 'FontSize', 12);
        grid on;
        xticks(1:4:24);
        
        % Subplot 3: Percentage Errors
        subplot(2, 2, 4);
        percentErrors = (errors ./ newClosePrices) * 100;
        bar(1:height(newData), abs(percentErrors), 'FaceColor', [0.6 0.3 0.9]);
        title('Absolute Percentage Errors', 'FontSize', 14);
        xlabel('Hour of Day', 'FontSize', 12);
        ylabel('Absolute Percentage Error (%)', 'FontSize', 12);
        grid on;
        xticks(1:4:24);
        
        % Return results
        fprintf('Summary of predictions for new data:\n');
        disp(table(newDatetimes, newClosePrices, newPredictions, errors, percentErrors, ...
            'VariableNames', {'DateTime', 'Actual', 'Predicted', 'Error', 'PercentError'}));
        
        % Create a table with all results for easy export if needed
        resultTable = table(newDatetimes, newClosePrices, newPredictions, ...
            newPredictionCI(:,1), newPredictionCI(:,2), errors, percentErrors, ...
            'VariableNames', {'DateTime', 'Actual', 'Predicted', 'LowerBound', ...
            'UpperBound', 'Error', 'PercentError'});
        
        % Optional: Save results to a CSV file
        % writetable(resultTable, 'kalman_new_data_results.csv');
        
        return;
    catch e
        % Display any errors that occur
        error('Error processing new data: %s', e.message);
    end
end

% Function to implement Kalman filter
function [filteredState, filteredStateCovariance] = local_kalmanFilter(observations, A, C, Q, R, x0, P0)
    % Kalman filter implementation
    % observations: vector of observations
    % A: State transition matrix
    % C: Observation matrix
    % Q: Process noise covariance
    % R: Observation noise variance
    % x0: Initial state
    % P0: Initial state covariance
    
    n = length(observations);
    stateDim = size(A, 1);
    
    % Initialize arrays to store results
    filteredState = zeros(stateDim, n);
    filteredStateCovariance = zeros(stateDim, stateDim, n);
    
    % Initialize state and covariance
    xFilt = x0;
    PFilt = P0;
    
    for t = 1:n
        % Prediction step
        xPred = A * xFilt;
        PPred = A * PFilt * A' + Q;
        
        % Update step
        K = PPred * C' / (C * PPred * C' + R);
        xFilt = xPred + K * (observations(t) - C * xPred);
        PFilt = (eye(stateDim) - K * C) * PPred;
        
        % Store results
        filteredState(:, t) = xFilt;
        filteredStateCovariance(:, :, t) = PFilt;
    end
end

function testKalmanWithSampleData(manualData)
    % Function to test Kalman filter with manually entered data
    % manualData: a 24x1 vector of close prices for 24 consecutive hours
    
    % Check input
    if nargin < 1 || length(manualData) ~= 24
        % If no data provided or incorrect length, use sample random data
        fprintf('Using sample data for testing...\n');
        % Generate some sample data with a trend and noise
        basePrice = 60000; % Starting base price
        trend = 100; % Upward trend per hour
        volatility = 200; % Random volatility
        manualData = zeros(24, 1);
        for i = 1:24
            manualData(i) = basePrice + trend * i + volatility * (rand() - 0.5);
        end
    end
    
    % Create artificial datetimes for today's hours
    today = datetime('today');
    sampleDatetimes = today + hours(0:23)';
    
    % Format data for processing
    newClosePrices = manualData;
    
    % Access the global variables from the main script
    global trainFilteredState trainFilteredStateCovariance A C Q R;
    
    % Check if Kalman filter has been run in the main script
    if isempty(trainFilteredState) || isempty(trainFilteredStateCovariance)
        error('Please run the main Kalman filter model first');
    end
    
    % Get last state and covariance from training
    x0 = trainFilteredState(:, end);
    P0 = trainFilteredStateCovariance(:, :, end);
    
    % Run Kalman filter on new data
    [newFilteredState, newFilteredStateCovariance] = local_kalmanFilter(newClosePrices, A, C, Q, R, x0, P0);
    
    % Generate one-step ahead predictions
    newPredictions = zeros(length(newClosePrices), 1);
    newPredictionCI = zeros(length(newClosePrices), 2);
    
    for t = 1:length(newClosePrices)
        % If it's the first step, use initial state for prediction
        if t == 1
            xPred = A * x0;
            PPred = A * P0 * A' + Q;
        else
            % Otherwise use the previous filtered state
            xPred = A * newFilteredState(:, t-1);
            PPred = A * newFilteredStateCovariance(:, :, t-1) * A' + Q;
        end
        
        % Store prediction (Level component)
        newPredictions(t) = C * xPred;
        
        % 95% prediction interval
        predVar = C * PPred * C' + R;
        newPredictionCI(t, :) = [
            newPredictions(t) - 1.96 * sqrt(predVar),
            newPredictions(t) + 1.96 * sqrt(predVar)
        ];
    end
    
    % Calculate performance metrics
    newRMSE = sqrt(mean((newClosePrices - newPredictions).^2));
    newMAPE = mean(abs((newClosePrices - newPredictions) ./ newClosePrices)) * 100;
    
    fprintf('Sample Data Kalman Filter RMSE: %f\n', newRMSE);
    fprintf('Sample Data Kalman Filter MAPE: %f%%\n', newMAPE);
    
    % Plot results
    figure('Position', [100, 100, 1200, 800]);
    
    % Subplot 1: Actual vs Predicted
    subplot(2, 2, 1:2);
    hold on;
    plot(sampleDatetimes, newClosePrices, 'k-o', 'LineWidth', 1.5, 'DisplayName', 'Actual');
    plot(sampleDatetimes, newPredictions, 'r-o', 'LineWidth', 1.5, 'DisplayName', 'Kalman Predicted');
    plot(sampleDatetimes, newPredictionCI(:, 1), 'r--', 'LineWidth', 1, 'DisplayName', '95% Lower Bound');
    plot(sampleDatetimes, newPredictionCI(:, 2), 'r--', 'LineWidth', 1, 'DisplayName', '95% Upper Bound');
    hold off;
    title(sprintf('Kalman Filter 24-Hour Forecast - RMSE: %.2f, MAPE: %.2f%%', newRMSE, newMAPE), 'FontSize', 14);
    xlabel('Hour', 'FontSize', 12);
    ylabel('Price (USD)', 'FontSize', 12);
    legend('Location', 'best');
    grid on;
    datetick('x', 'HH:MM', 'keepticks');
    
    % Subplot 2: Absolute Errors
    subplot(2, 2, 3);
    errors = newClosePrices - newPredictions;
    bar(1:length(newClosePrices), abs(errors), 'FaceColor', [0.3 0.6 0.9]);
    title('Absolute Prediction Errors', 'FontSize', 14);
    xlabel('Hour of Day', 'FontSize', 12);
    ylabel('Absolute Error (USD)', 'FontSize', 12);
    grid on;
    xticks(1:4:24);
    
    % Subplot 3: Percentage Errors
    subplot(2, 2, 4);
    percentErrors = (errors ./ newClosePrices) * 100;
    bar(1:length(newClosePrices), abs(percentErrors), 'FaceColor', [0.6 0.3 0.9]);
    title('Absolute Percentage Errors', 'FontSize', 14);
    xlabel('Hour of Day', 'FontSize', 12);
    ylabel('Absolute Percentage Error (%)', 'FontSize', 12);
    grid on;
    xticks(1:4:24);
    
    % Return results
    fprintf('Summary of predictions for sample data:\n');
    disp(table(sampleDatetimes, newClosePrices, newPredictions, errors, percentErrors, ...
        'VariableNames', {'DateTime', 'Actual', 'Predicted', 'Error', 'PercentError'}));
end

function forecastNext24Hours(closePrices)
    % This function forecasts the next 24 hours from the last known data point
    
    % Access the global variables
    global trainFilteredState trainFilteredStateCovariance A C Q R datetimes;
    
    % Check if Kalman filter has been run in the main script
    if isempty(trainFilteredState) || isempty(trainFilteredStateCovariance)
        error('Please run the main Kalman filter model first');
    end
    
    % Get the true last price
    lastKnownPrice = closePrices(end);
    
    % Get the current state and covariance from the Kalman filter
    x0 = trainFilteredState(:, end);
    P0 = trainFilteredStateCovariance(:, :, end);
    
    % Display the discrepancy for debugging
    fprintf('Original Kalman last state: Level = %.2f, Trend = %.2f\n', x0(1), x0(2));
    fprintf('Last known price from data: %.2f\n', lastKnownPrice);
    fprintf('Discrepancy: %.2f\n', lastKnownPrice - x0(1));
    
    % FIX: Correct the state to match the last known price
    % Keep the estimated trend but update the level
    x0_corrected = [lastKnownPrice; x0(2)];
    fprintf('Corrected initial state: Level = %.2f, Trend = %.2f\n', x0_corrected(1), x0_corrected(2));
    
    % Generate hourly forecasts for the next 24 hours
    numHours = 24;
    forecasts = zeros(numHours, 1);
    forecastCI = zeros(numHours, 2);
    
    % Initialize current state and covariance using corrected state
    xCurrent = x0_corrected;
    PCurrent = P0;
    
    for t = 1:numHours
        % Prediction step
        xPred = A * xCurrent;
        PPred = A * PCurrent * A' + Q;
        
        % Store prediction (Level component)
        forecasts(t) = C * xPred;
        
        % 95% prediction interval
        predVar = C * PPred * C' + R;
        forecastCI(t, :) = [
            forecasts(t) - 1.96 * sqrt(predVar),
            forecasts(t) + 1.96 * sqrt(predVar)
        ];
        
        % Update for next iteration (pure forecast without observations)
        xCurrent = xPred;
        PCurrent = PPred;
    end
    
    % Create date-time stamps for the forecast period
    % Start from the last known time and add hours
    lastDateTime = datetimes(end);
    forecastDates = lastDateTime + hours(1:numHours)';
    
    % Verify first forecast
    fprintf('First forecast: %.2f\n', forecasts(1));
    fprintf('Difference from last known: %.2f\n', forecasts(1) - lastKnownPrice);
    
    % Plot the forecasts
    figure('Position', [100, 100, 1200, 600]);
    
    hold on;
    % Plot the last 48 hours of actual data for context
    lastHours = min(48, length(closePrices));
    plot(datetimes(end-lastHours+1:end), closePrices(end-lastHours+1:end), 'b-', 'LineWidth', 1.5, 'DisplayName', 'Historical Data');
    
    % Plot the forecasts
    plot(forecastDates, forecasts, 'r-o', 'LineWidth', 1.5, 'DisplayName', 'Forecast');
    plot(forecastDates, forecastCI(:, 1), 'r--', 'LineWidth', 1, 'DisplayName', '95% Lower Bound');
    plot(forecastDates, forecastCI(:, 2), 'r--', 'LineWidth', 1, 'DisplayName', '95% Upper Bound');
    
    % Add a vertical line to mark the forecast start
    plot([lastDateTime, lastDateTime], [min(min(forecastCI(:, 1)), min(closePrices(end-lastHours+1:end)))*0.98, ...
        max(max(forecastCI(:, 2)), max(closePrices(end-lastHours+1:end)))*1.02], ...
        'k--', 'LineWidth', 1, 'DisplayName', 'Forecast Start');
    
    hold off;
    title('Kalman Filter 24-Hour Price Forecast', 'FontSize', 16);
    xlabel('Date and Time', 'FontSize', 14);
    ylabel('Price (USD)', 'FontSize', 14);
    legend('Location', 'best');
    grid on;
    datetick('x', 'dd-mmm HH:MM', 'keepticks');
    
    % Ensure the y-axis shows both historical and forecast data properly
    yMin = min(min(forecastCI(:, 1)), min(closePrices(end-lastHours+1:end))) * 0.95;
    yMax = max(max(forecastCI(:, 2)), max(closePrices(end-lastHours+1:end))) * 1.05;
    ylim([yMin, yMax]);
    
    % Create a table with the forecasts
    forecastTable = table(forecastDates, forecasts, forecastCI(:,1), forecastCI(:,2), ...
        'VariableNames', {'DateTime', 'Forecast', 'LowerBound', 'UpperBound'});
    
    % Display results
    fprintf('24-Hour Price Forecast from %s:\n', datestr(lastDateTime));
    disp(forecastTable);
    
    % Optional: Save forecasts to a CSV file
    % writetable(forecastTable, 'bitcoin_24h_forecast.csv');
end



%% ARIMA Implementation Function - Main Entry Point
function implementARIMAModel()
    % Access global variables from main script
    global datetimes;
    
    % Read the data - using the same approach as your main script
    data = readtable('bitcoin-hourly-ohclv-dataset\btc-hourly-price_2015_2025.csv', 'Delimiter', ',');
    
    % Fix column names by removing leading spaces
    data.Properties.VariableNames = strrep(data.Properties.VariableNames, ' ', '');
    
    % Extract the price data
    closePrices = data.CLOSE_PRICE;
    
    % Split data into training and testing sets - same split as Kalman filter
    trainSize = floor(0.8 * length(closePrices));
    trainData = closePrices(1:trainSize);
    testData = closePrices(trainSize+1:end);
    trainDates = datetimes(1:trainSize);
    testDates = datetimes(trainSize+1:end);
    
    fprintf('Training data size for ARIMA: %d observations\n', length(trainData));
    fprintf('Testing data size for ARIMA: %d observations\n', length(testData));
    
    % Optimize ARIMA model parameters
    [bestP, bestD, bestQ, bestSARIMA, bestSeasonalPeriod] = optimizeARIMAParameters(trainData);
    
    if bestSARIMA
        fprintf('Best SARIMA Model: (%d,%d,%d)x(%d,%d,%d)_%d\n', bestP(1), bestD(1), bestQ(1), bestP(2), bestD(2), bestQ(2), bestSeasonalPeriod);
    else
        fprintf('Best ARIMA Model: (%d,%d,%d)\n', bestP, bestD, bestQ);
    end
    
    % Fit the optimal ARIMA model
    if bestSARIMA
        % SARIMA model
        Mdl = fitSARIMAModel(trainData, bestP, bestD, bestQ, bestSeasonalPeriod);
    else
        % Regular ARIMA model
        Mdl = fitARIMAModel(trainData, bestP, bestD, bestQ);
    end
    
    % Generate forecasts for the test period
    arimaForecasts = forecastARIMA(Mdl, trainData, length(testData));
    
    % Calculate 95% prediction intervals
    [LB, UB] = calculatePredictionIntervals(Mdl, arimaForecasts, length(testData));
    
    % Calculate metrics
    arimaRMSE = sqrt(mean((testData - arimaForecasts).^2));
    arimaMAPE = mean(abs((testData - arimaForecasts) ./ testData)) * 100;
    
    fprintf('ARIMA Model RMSE: %f\n', arimaRMSE);
    fprintf('ARIMA Model MAPE: %f%%\n', arimaMAPE);
    
    % Plot results
    plotARIMAResults(trainDates, trainData, testDates, testData, arimaForecasts, LB, UB, arimaRMSE, arimaMAPE);
    
    % Compare Kalman vs ARIMA on test data
    compareResults(testDates, testData, arimaForecasts, LB, UB, arimaRMSE, arimaMAPE);
    
    % Run ARIMA on new data if available
    try
        runARIMAOnNewData('bitcoin-hourly-ohclv-dataset/btc_ohclv_2025-05-13.csv', Mdl);
    catch e
        fprintf('Note: Could not run ARIMA on new data: %s\n', e.message);
    end
    
    % Forecast the next 24 hours with ARIMA
    forecastNext24HoursARIMA([trainData; testData], Mdl);
end

%% Function to optimize ARIMA parameters
function [bestP, bestD, bestQ, bestSARIMA, bestSeasonalPeriod] = optimizeARIMAParameters(data)
    % This function tries different ARIMA parameters to find the best model
    
    fprintf('Optimizing ARIMA parameters (this may take some time)...\n');
    
    % First, we'll check if the data needs differencing for stationarity
    % Use ADF test to check stationarity
    [~, pValue] = adftest(data);
    
    % Initial differencing based on ADF test
    initialD = 0;
    if pValue > 0.05
        initialD = 1;
        [~, pValue] = adftest(diff(data));
        if pValue > 0.05
            initialD = 2;
        end
    end
    
    fprintf('Initial differencing order suggested by ADF test: %d\n', initialD);
    
    % Now we'll perform a grid search for the best ARIMA parameters
    % Define parameter ranges to search
    pRange = 0:3;
    dRange = max(0, initialD-1):min(2, initialD+1);
    qRange = 0:3;
    
    bestAIC = Inf;
    bestP = 0;
    bestD = initialD;
    bestQ = 0;
    
    % Check for seasonality
    [hasSeason, seasonalPeriod] = checkForSeasonality(data);
    
    if hasSeason
        fprintf('Detected possible seasonality with period: %d\n', seasonalPeriod);
        % For SARIMA, we'll limit the parameter space further for computational efficiency
        PRange = 0:1;
        DRange = 0:1;
        QRange = 0:1;
        
        bestSARIMA = true;
        bestSeasonalPeriod = seasonalPeriod;
        
        % Grid search for SARIMA model
        for p = pRange
            for d = dRange
                for q = qRange
                    for P = PRange
                        for D = DRange
                            for Q = QRange
                                try
                                    spec = createSARIMASpec(p, d, q, P, D, Q, seasonalPeriod);
                                    [~, ~, logL] = estimate(spec, data, 'Display', 'off');
                                    
                                    % Calculate AIC
                                    numParams = p + q + P + Q;
                                    aic = -2*logL + 2*numParams;
                                    
                                    if aic < bestAIC
                                        bestAIC = aic;
                                        bestP = [p, P];
                                        bestD = [d, D];
                                        bestQ = [q, Q];
                                    end
                                catch
                                    % Skip combinations that fail to converge
                                    continue;
                                end
                            end
                        end
                    end
                end
            end
        end
    else
        % Regular ARIMA grid search
        bestSARIMA = false;
        bestSeasonalPeriod = 0;
        
        for p = pRange
            for d = dRange
                for q = qRange
                    try
                        Mdl = arima(p, d, q);
                        [~, ~, logL] = estimate(Mdl, data, 'Display', 'off');
                        
                        % Calculate AIC
                        numParams = p + q;
                        aic = -2*logL + 2*numParams;
                        
                        if aic < bestAIC
                            bestAIC = aic;
                            bestP = p;
                            bestD = d;
                            bestQ = q;
                        end
                    catch
                        % Skip combinations that fail to converge
                        continue;
                    end
                end
            end
        end
    end
end

%% Function to check for seasonality
function [hasSeason, period] = checkForSeasonality(data)
    % This function checks if there's seasonality in the data
    
    % Compute autocorrelation
    maxLag = min(500, length(data) - 1);
    [acf, lags] = autocorr(data, NumLags=maxLag);
    
    % Remove lag 0
    acf = acf(2:end);
    lags = lags(2:end);
    
    % Find peaks in the autocorrelation function
    [peaks, locations] = findpeaks(acf);
    
    % If we have strong peaks, find the most common distance between them
    if ~isempty(peaks) && max(peaks) > 0.2
        % Sort peaks by strength
        [sortedPeaks, idx] = sort(peaks, 'descend');
        sortedLocs = locations(idx);
        
        % Take top 5 peaks or all if less than 5
        topN = min(5, length(sortedPeaks));
        
        % If we have at least 2 significant peaks, calculate the typical distance
        if topN >= 2
            intervals = diff(sort(sortedLocs(1:topN)));
            if ~isempty(intervals) && median(intervals) > 1
                hasSeason = true;
                period = round(median(intervals));
                
                % Common periods - adjust if one is close
                commonPeriods = [24, 168, 720]; % daily, weekly, monthly (hourly data)
                [~, idx] = min(abs(commonPeriods - period));
                if abs(commonPeriods(idx) - period) / period < 0.2
                    period = commonPeriods(idx);
                end
                
                return;
            end
        end
    end
    
    % Check specific periods that are common for financial data
    commonPeriods = [24, 168, 720]; % daily, weekly, monthly (hourly data)
    for p = commonPeriods
        if p < length(acf)
            if acf(p) > 0.2
                hasSeason = true;
                period = p;
                return;
            end
        end
    end
    
    % Default: no strong seasonality detected
    hasSeason = false;
    period = 0;
end

%% Function to create a SARIMA specification
function spec = createSARIMASpec(p, d, q, P, D, Q, seasonalPeriod)
    % Create a SARIMA model specification
    
    % Regular ARIMA components
    ar = cell(1, p);
    for i = 1:p
        ar{i} = sprintf('AR{%d}', i);
    end
    
    ma = cell(1, q);
    for i = 1:q
        ma{i} = sprintf('MA{%d}', i);
    end
    
    % Seasonal components
    sar = cell(1, P);
    for i = 1:P
        sar{i} = sprintf('SAR{%d}', i);
    end
    
    sma = cell(1, Q);
    for i = 1:Q
        sma{i} = sprintf('SMA{%d}', i);
    end
    
    % Create the specification
    spec = arima('ARLags', 1:p, 'MALags', 1:q, 'D', d);
    
    % Add seasonal components if requested
    if P > 0 || D > 0 || Q > 0
        spec = arima(spec, ...
            'SARLags', seasonalPeriod*(1:P), ...
            'SMALags', seasonalPeriod*(1:Q), ...
            'Seasonality', seasonalPeriod, ...
            'SD', D);
    end
end

%% Function to fit an ARIMA model
function Mdl = fitARIMAModel(data, p, d, q)
    % Fit an ARIMA model with the specified parameters
    
    fprintf('Fitting ARIMA(%d,%d,%d) model...\n', p, d, q);
    
    % Create and estimate the model
    Mdl = arima(p, d, q);
    options = optimoptions('fmincon', 'Display', 'off');
    Mdl = estimate(Mdl, data, 'Display', 'off', 'Options', options);
end

%% Function to fit a SARIMA model
function Mdl = fitSARIMAModel(data, p, d, q, seasonalPeriod)
    % Fit a SARIMA model with the specified parameters
    
    fprintf('Fitting SARIMA(%d,%d,%d)x(%d,%d,%d)_%d model...\n', ...
        p(1), d(1), q(1), p(2), d(2), q(2), seasonalPeriod);
    
    % Create seasonal ARIMA spec
    spec = createSARIMASpec(p(1), d(1), q(1), p(2), d(2), q(2), seasonalPeriod);
    
    % Estimate the model
    options = optimoptions('fmincon', 'Display', 'off');
    Mdl = estimate(spec, data, 'Display', 'off', 'Options', options);
end

%% Function to forecast with ARIMA model
function forecasts = forecastARIMA(Mdl, trainData, horizonLength)
    % Generate forecasts for the specified horizon
    
    [forecasts, ~] = forecast(Mdl, horizonLength, 'Y0', trainData);
end

%% Function to calculate prediction intervals
function [LB, UB] = calculatePredictionIntervals(Mdl, forecasts, horizonLength)
    % Calculate 95% prediction intervals for the forecasts
    
    % Get model variance
    variance = Mdl.Variance;
    
    % Initialize bounds
    LB = zeros(horizonLength, 1);
    UB = zeros(horizonLength, 1);
    
    % Simple approach: expanding prediction intervals
    for h = 1:horizonLength
        % Variance grows with horizon - this is a simplified approach
        horizonVar = variance * h;
        predStd = sqrt(horizonVar);
        
        % 95% prediction interval
        LB(h) = forecasts(h) - 1.96 * predStd;
        UB(h) = forecasts(h) + 1.96 * predStd;
    end
end

%% Function to plot ARIMA results
function plotARIMAResults(trainDates, trainData, testDates, testData, arimaForecasts, LB, UB, arimaRMSE, arimaMAPE)
    % Plot ARIMA forecasting results
    
    % Figure 1: Basic ARIMA Forecast
    figure('Position', [100, 100, 1200, 800]);
    hold on;
    % Plot training data
    plot(trainDates, trainData, 'b-', 'LineWidth', 1);
    % Plot test data
    plot(testDates, testData, 'y-', 'LineWidth', 1);
    % Plot ARIMA forecast
    plot(testDates, arimaForecasts, 'r-', 'LineWidth', 2);
    hold off;
    title(sprintf('ARIMA Forecast - RMSE: %.2f, MAPE: %.2f%%', ...
        arimaRMSE, arimaMAPE), 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('Price (USD)', 'FontSize', 12);
    legend('Training Data', 'Actual', 'Forecast', 'Location', 'best');
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    % Figure 2: ARIMA Forecast with Confidence Intervals
    figure('Position', [100, 100, 1200, 800]);
    hold on;
    % Plot training data
    plot(trainDates, trainData, 'b-', 'LineWidth', 1);
    % Plot test data
    plot(testDates, testData, 'k-', 'LineWidth', 1);
    % Plot ARIMA forecast
    plot(testDates, arimaForecasts, 'g-', 'LineWidth', 2);
    % Plot prediction intervals
    plot(testDates, LB, 'g--', 'LineWidth', 1);
    plot(testDates, UB, 'g--', 'LineWidth', 1);
    hold off;
    title(sprintf('ARIMA Forecast with 95%% Confidence Intervals - RMSE: %.2f, MAPE: %.2f%%', ...
        arimaRMSE, arimaMAPE), 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('Price (USD)', 'FontSize', 12);
    legend('Training Data', 'Actual', 'Forecast', '95% Lower Bound', '95% Upper Bound', 'Location', 'best');
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    % Figure 3: Error Analysis
    figure('Position', [100, 100, 1200, 800]);
    
    % Calculate prediction errors
    predictionErrors = testData - arimaForecasts;
    percentErrors = (predictionErrors ./ testData) * 100;
    
    % Create 2x2 subplots for different error visualizations
    subplot(2, 2, 1);
    % Absolute error over time
    plot(testDates, abs(predictionErrors), 'r-', 'LineWidth', 1.5);
    title('ARIMA: Absolute Prediction Error Over Time', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('Absolute Error (USD)', 'FontSize', 12);
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    subplot(2, 2, 2);
    % Percent error over time
    plot(testDates, abs(percentErrors), 'b-', 'LineWidth', 1.5);
    title('ARIMA: Absolute Percentage Error Over Time', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('Absolute Percentage Error (%)', 'FontSize', 12);
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    subplot(2, 2, 3);
    % Error distribution histogram
    histogram(predictionErrors, 50, 'FaceColor', [0.3 0.6 0.9], 'EdgeColor', 'none');
    title('ARIMA: Distribution of Prediction Errors', 'FontSize', 14);
    xlabel('Prediction Error (USD)', 'FontSize', 12);
    ylabel('Frequency', 'FontSize', 12);
    grid on;
    
    subplot(2, 2, 4);
    % Scatter plot of predicted vs actual
    scatter(testData, arimaForecasts, 15, 'filled', 'MarkerFaceColor', [0 0.5 0]);
    hold on;
    % Add perfect prediction line
    minVal = min(min(testData), min(arimaForecasts));
    maxVal = max(max(testData), max(arimaForecasts));
    plot([minVal, maxVal], [minVal, maxVal], 'k--', 'LineWidth', 1);
    hold off;
    title('ARIMA: Predicted vs. Actual Prices', 'FontSize', 14);
    xlabel('Actual Price (USD)', 'FontSize', 12);
    ylabel('Predicted Price (USD)', 'FontSize', 12);
    grid on;
    
    % Add a title for the entire figure
    sgtitle('ARIMA Prediction Error Analysis', 'FontSize', 16);
    
    % Figure 4: Rolling Error Metrics
    figure('Position', [100, 100, 1200, 500]);
    
    % Calculate rolling metrics with a window of 24 hours (1 day)
    windowSize = 24;
    numTestPoints = length(testData);
    rollingRMSE = zeros(numTestPoints - windowSize + 1, 1);
    rollingMAPE = zeros(numTestPoints - windowSize + 1, 1);
    rollingDates = testDates(windowSize:end);
    
    for i = 1:(numTestPoints - windowSize + 1)
        windowErrors = testData(i:i+windowSize-1) - arimaForecasts(i:i+windowSize-1);
        rollingRMSE(i) = sqrt(mean(windowErrors.^2));
        rollingMAPE(i) = mean(abs(windowErrors ./ testData(i:i+windowSize-1))) * 100;
    end
    
    % Create subplot for rolling metrics
    subplot(2, 1, 1);
    plot(rollingDates, rollingRMSE, 'r-', 'LineWidth', 1.5);
    title('ARIMA: 24-Hour Rolling RMSE', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('RMSE (USD)', 'FontSize', 12);
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    subplot(2, 1, 2);
    plot(rollingDates, rollingMAPE, 'b-', 'LineWidth', 1.5);
    title('ARIMA: 24-Hour Rolling MAPE', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('MAPE (%)', 'FontSize', 12);
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    % Add a title for the entire figure
    sgtitle('ARIMA: Rolling Error Metrics Over Time', 'FontSize', 16);
end

%% Function to compare Kalman and ARIMA results
function compareResults(testDates, testData, arimaForecasts, arimaLB, arimaUB, arimaRMSE, arimaMAPE)
    % Compare Kalman Filter and ARIMA results
    % Assumes Kalman filter results are already available in the workspace
    
    % Access global variables from the main script with Kalman filter results
    global trainFilteredState trainFilteredStateCovariance A C Q R;
    
    % Check if Kalman filter has been run
    if isempty(trainFilteredState) || isempty(trainFilteredStateCovariance)
        warning('Kalman filter results not available for comparison. Run the Kalman filter model first.');
        return;
    end
    
    % Get Kalman filter predictions for the test set
    % Recreate the Kalman predictions using the same approach as the main script
    
    % Use last state as initial state for forecasting
    xForecast = trainFilteredState(:, end);
    PForecast = trainFilteredStateCovariance(:, :, end);
    
    % Generate Kalman predictions for test data
    kalmanPredictions = zeros(length(testData), 1);
    kalmanPredictionCI = zeros(length(testData), 2);
    
    for t = 1:length(testData)
        % Prediction step
        xPred = A * xForecast;
        PPred = A * PForecast * A' + Q;
        
        % Store prediction (Level component)
        kalmanPredictions(t) = C * xPred;
        
        % 95% prediction interval
        predVar = C * PPred * C' + R;
        kalmanPredictionCI(t, :) = [
            kalmanPredictions(t) - 1.96 * sqrt(predVar),
            kalmanPredictions(t) + 1.96 * sqrt(predVar)
        ];
        
        % Update step using the actual observation
        K = PPred * C' / (C * PPred * C' + R);
        xForecast = xPred + K * (testData(t) - C * xPred);
        PForecast = (eye(2) - K * C) * PPred;
    end
    
    % Calculate metrics for Kalman
    kalmanRMSE = sqrt(mean((testData - kalmanPredictions).^2));
    kalmanMAPE = mean(abs((testData - kalmanPredictions) ./ testData)) * 100;
    
    % Create comparison plots
    
    % Figure 1: Direct comparison of forecasts
    figure('Position', [100, 100, 1200, 800]);
    
    % Plot test data and forecasts
    subplot(2, 1, 1);
    hold on;
    plot(testDates, testData, 'k-', 'LineWidth', 1.5, 'DisplayName', 'Actual');
    plot(testDates, kalmanPredictions, 'b-', 'LineWidth', 1.2, 'DisplayName', sprintf('Kalman (RMSE: %.2f)', kalmanRMSE));
    plot(testDates, arimaForecasts, 'r-', 'LineWidth', 1.2, 'DisplayName', sprintf('ARIMA (RMSE: %.2f)', arimaRMSE));
    hold off;
    title('Comparison of Forecast Methods', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('Price (USD)', 'FontSize', 12);
    legend('Location', 'best');
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    % Plot absolute errors
    subplot(2, 1, 2);
    hold on;
    plot(testDates, abs(testData - kalmanPredictions), 'b-', 'LineWidth', 1.2, 'DisplayName', sprintf('Kalman (MAPE: %.2f%%)', kalmanMAPE));
    plot(testDates, abs(testData - arimaForecasts), 'r-', 'LineWidth', 1.2, 'DisplayName', sprintf('ARIMA (MAPE: %.2f%%)', arimaMAPE));
    hold off;
    title('Absolute Forecast Errors', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('Absolute Error (USD)', 'FontSize', 12);
    legend('Location', 'best');
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    % Add a title for the entire figure
    sgtitle('Comparison: Kalman Filter vs. ARIMA', 'FontSize', 16);
    
    % Figure 2: More detailed comparison
    figure('Position', [100, 100, 1200, 900]);
    
    % Calculate additional metrics
    kalmanMAE = mean(abs(testData - kalmanPredictions));
    arimaMAE = mean(abs(testData - arimaForecasts));
    
    kalmanME = mean(testData - kalmanPredictions); % Mean Error (bias)
    arimaME = mean(testData - arimaForecasts);
    
    % Subplot 1: Scatter plots of predictions
    subplot(2, 2, 1);
    hold on;
    scatter(testData, kalmanPredictions, 20, 'b', 'filled', 'MarkerFaceAlpha', 0.3, 'DisplayName', 'Kalman');
    scatter(testData, arimaForecasts, 20, 'r', 'filled', 'MarkerFaceAlpha', 0.3, 'DisplayName', 'ARIMA');
    % Add identity line
    minVal = min([min(testData), min(kalmanPredictions), min(arimaForecasts)]);
    maxVal = max([max(testData), max(kalmanPredictions), max(arimaForecasts)]);
    plot([minVal, maxVal], [minVal, maxVal], 'k--', 'LineWidth', 1, 'DisplayName', 'Perfect Fit');
    hold off;
    title('Predicted vs. Actual Values', 'FontSize', 14);
    xlabel('Actual Price (USD)', 'FontSize', 12);
    ylabel('Predicted Price (USD)', 'FontSize', 12);
    legend('Location', 'best');
    grid on;
    axis equal;
    
    % Subplot 2: Error histograms
    subplot(2, 2, 2);
    hold on;
    histogram(testData - kalmanPredictions, 30, 'FaceColor', 'b', 'FaceAlpha', 0.5, 'DisplayName', 'Kalman');
    histogram(testData - arimaForecasts, 30, 'FaceColor', 'r', 'FaceAlpha', 0.5, 'DisplayName', 'ARIMA');
    hold off;
    title('Error Distributions', 'FontSize', 14);
    xlabel('Prediction Error (USD)', 'FontSize', 12);
    ylabel('Frequency', 'FontSize', 12);
    legend('Location', 'best');
    grid on;
    
    % Subplot 3: Rolling RMSE comparison
    subplot(2, 2, 3);
    
    % Calculate rolling metrics with a window of 24 hours (1 day)
    windowSize = 24;
    numTestPoints = length(testData);
    rollingKalmanRMSE = zeros(numTestPoints - windowSize + 1, 1);
    rollingARIMA_RMSE = zeros(numTestPoints - windowSize + 1, 1);
    rollingDates = testDates(windowSize:end);
    
    for i = 1:(numTestPoints - windowSize + 1)
        kalmanErrors = testData(i:i+windowSize-1) - kalmanPredictions(i:i+windowSize-1);
        arimaErrors = testData(i:i+windowSize-1) - arimaForecasts(i:i+windowSize-1);
        
        rollingKalmanRMSE(i) = sqrt(mean(kalmanErrors.^2));
        rollingARIMA_RMSE(i) = sqrt(mean(arimaErrors.^2));
    end
    
    hold on;
    plot(rollingDates, rollingKalmanRMSE, 'b-', 'LineWidth', 1.5, 'DisplayName', 'Kalman');
    plot(rollingDates, rollingARIMA_RMSE, 'r-', 'LineWidth', 1.5, 'DisplayName', 'ARIMA');
    hold off;
    title('24-Hour Rolling RMSE', 'FontSize', 14);
    xlabel('Date', 'FontSize', 12);
    ylabel('RMSE (USD)', 'FontSize', 12);
    legend('Location', 'best');
    grid on;
    datetick('x', 'dd-mmm', 'keepticks');
    
    % Subplot 4: Performance metrics comparison
    subplot(2, 2, 4);
    metrics = {'RMSE', 'MAE', 'MAPE (%)', 'ME (Bias)'};
    kalmanValues = [kalmanRMSE, kalmanMAE, kalmanMAPE, kalmanME];
    arimaValues = [arimaRMSE, arimaMAE, arimaMAPE, arimaME];
    
    % Create a bar chart to compare metrics
    barWidth = 0.35;
    x = 1:length(metrics);
    
    hold on;
    bar(x - barWidth/2, kalmanValues, barWidth, 'FaceColor', 'b', 'DisplayName', 'Kalman');
    bar(x + barWidth/2, arimaValues, barWidth, 'FaceColor', 'r', 'DisplayName', 'ARIMA');
    hold off;
    
    title('Performance Metrics Comparison', 'FontSize', 14);
    ylabel('Value', 'FontSize', 12);
    xticks(x);
    xticklabels(metrics);
    legend('Location', 'best');
    grid on;
    
    % Add a title for the entire figure
    sgtitle('Detailed Comparison: Kalman Filter vs. ARIMA', 'FontSize', 16);
    
    % Create a summary table
    resultTable = table(...
        {'Kalman Filter'; 'ARIMA Model'}, ...
        [kalmanRMSE; arimaRMSE], ...
        [kalmanMAE; arimaMAE], ...
        [kalmanMAPE; arimaMAPE], ...
        [kalmanME; arimaME], ...
        'VariableNames', {'Model', 'RMSE', 'MAE', 'MAPE', 'Bias'});
    
    % Display the comparison table
    disp('Performance Metrics Comparison:');
    disp(resultTable);
end

%% Function to run ARIMA on new data
function runARIMAOnNewData(newDataFilePath, Mdl)
    % Function to run ARIMA model on new 24-hour data
    % newDataFilePath: path to CSV file containing 24 hours of data
    % Mdl: Fitted ARIMA model
    
    % Check if file exists
    if ~exist(newDataFilePath, 'file')
        error('File not found: %s', newDataFilePath);
    end
    
    % Read the new data
    try
        newData = readtable(newDataFilePath, 'Delimiter', ',');
        
        % Fix column names by removing leading spaces
        newData.Properties.VariableNames = strrep(newData.Properties.VariableNames, ' ', '');
        
        % Check if required columns exist
        requiredColumns = {'DATE_STR', 'HOUR_STR', 'CLOSE_PRICE'};
        for i = 1:length(requiredColumns)
            if ~ismember(requiredColumns{i}, newData.Properties.VariableNames)
                error('Required column "%s" not found in the new data file', requiredColumns{i});
            end
        end
        
        % Parse dates and times
        newDatetimes = NaT(height(newData), 1);
        for i = 1:height(newData)
            dateStr = char(newData.DATE_STR(i));
            hourStr = num2str(newData.HOUR_STR(i));
            dateTimeStr = [dateStr, ' ', hourStr, ':00:00'];
            newDatetimes(i) = datetime(dateTimeStr, 'InputFormat', 'yyyy-MM-dd HH:mm:ss');
        end
        
        % Extract close prices
        newClosePrices = newData.CLOSE_PRICE;
        
        % One-step ahead forecasting with ARIMA
        fprintf('Running ARIMA model on new 24-hour data...\n');
        
        % Generate one-step ahead predictions
        arimaPredictions = zeros(length(newClosePrices), 1);
        arimaPredictionCI = zeros(length(newClosePrices), 2);
        
        % Update the model with each new observation
        yF = newClosePrices(1);  % Initialize with the first actual value
        
        for t = 1:length(newClosePrices)
            % For the first step, use all available past data implicitly in the model
            if t == 1
                [yF, yMSE] = forecast(Mdl, 1, 'Y0', yF);
            else
                % For subsequent steps, update with the last observation
                [yF, yMSE] = forecast(Mdl, 1, 'Y0', newClosePrices(t-1));
            end
            
            arimaPredictions(t) = yF;
            
            % 95% prediction interval
            arimaPredictionCI(t, :) = [
                yF - 1.96 * sqrt(yMSE),
                yF + 1.96 * sqrt(yMSE)
            ];
        end
        
        % Calculate performance metrics
        arimaErrors = newClosePrices - arimaPredictions;
        arimaRMSE = sqrt(mean(arimaErrors.^2));
        arimaMAE = mean(abs(arimaErrors));
        arimaMAPE = mean(abs(arimaErrors ./ newClosePrices)) * 100;
        
        fprintf('New Data ARIMA RMSE: %f\n', arimaRMSE);
        fprintf('New Data ARIMA MAE: %f\n', arimaMAE);
        fprintf('New Data ARIMA MAPE: %f%%\n', arimaMAPE);
        
        % Plot results
        figure('Position', [100, 100, 1200, 800]);
        
        % Subplot 1: Actual vs Predicted
        subplot(2, 2, 1:2);
        hold on;
        plot(newDatetimes, newClosePrices, 'k-o', 'LineWidth', 1.5, 'DisplayName', 'Actual');
        plot(newDatetimes, arimaPredictions, 'r-o', 'LineWidth', 1.5, 'DisplayName', 'ARIMA Predicted');
        plot(newDatetimes, arimaPredictionCI(:, 1), 'r--', 'LineWidth', 1, 'DisplayName', '95% Lower Bound');
        plot(newDatetimes, arimaPredictionCI(:, 2), 'r--', 'LineWidth', 1, 'DisplayName', '95% Upper Bound');
        hold off;
        title(sprintf('ARIMA 24-Hour Forecast - RMSE: %.2f, MAPE: %.2f%%', arimaRMSE, arimaMAPE), 'FontSize', 14);
        xlabel('Hour', 'FontSize', 12);
        ylabel('Price (USD)', 'FontSize', 12);
        legend('Location', 'best');
        grid on;
        datetick('x', 'HH:MM', 'keepticks');
        
        % Subplot 2: Absolute Errors
        subplot(2, 2, 3);
        bar(1:height(newData), abs(arimaErrors), 'FaceColor', [0.3 0.6 0.9]);
        title('ARIMA: Absolute Prediction Errors', 'FontSize', 14);
        xlabel('Hour of Day', 'FontSize', 12);
        ylabel('Absolute Error (USD)', 'FontSize', 12);
        grid on;
        xticks(1:4:24);
        
        % Subplot 3: Percentage Errors
        subplot(2, 2, 4);
        percentErrors = (arimaErrors ./ newClosePrices) * 100;
        bar(1:height(newData), abs(percentErrors), 'FaceColor', [0.6 0.3 0.9]);
        title('ARIMA: Absolute Percentage Errors', 'FontSize', 14);
        xlabel('Hour of Day', 'FontSize', 12);
        ylabel('Absolute Percentage Error (%)', 'FontSize', 12);
        grid on;
        xticks(1:4:24);
        
        % Compare with Kalman Filter on the new data (if available)
        try
            % Try to access Kalman results from the global variables
            global trainFilteredState trainFilteredStateCovariance A C Q R;
            
            if ~isempty(trainFilteredState) && ~isempty(trainFilteredStateCovariance)
                % Get last state and covariance from training
                x0 = trainFilteredState(:, end);
                P0 = trainFilteredStateCovariance(:, :, end);
                
                % Correct the state to match the expected price level
                x0_corrected = [newClosePrices(1); x0(2)];
                
                % Generate Kalman predictions for new data
                kalmanPredictions = zeros(length(newClosePrices), 1);
                
                for t = 1:length(newClosePrices)
                    % If it's the first step, use corrected initial state for prediction
                    if t == 1
                        xPred = A * x0_corrected;
                        PPred = A * P0 * A' + Q;
                    else
                        % Otherwise use the previous filtered state
                        xPred = A * xForecast;
                        PPred = A * PForecast * A' + Q;
                    end
                    
                    % Store prediction (Level component)
                    kalmanPredictions(t) = C * xPred;
                    
                    % Update step using the actual observation
                    K = PPred * C' / (C * PPred * C' + R);
                    xForecast = xPred + K * (newClosePrices(t) - C * xPred);
                    PForecast = (eye(2) - K * C) * PPred;
                end
                
                % Calculate Kalman metrics
                kalmanErrors = newClosePrices - kalmanPredictions;
                kalmanRMSE = sqrt(mean(kalmanErrors.^2));
                kalmanMAPE = mean(abs(kalmanErrors ./ newClosePrices)) * 100;
                
                % Plot comparison
                figure('Position', [100, 100, 1200, 600]);
                
                subplot(2, 1, 1);
                hold on;
                plot(newDatetimes, newClosePrices, 'k-o', 'LineWidth', 1.5, 'DisplayName', 'Actual');
                plot(newDatetimes, kalmanPredictions, 'b-o', 'LineWidth', 1.5, 'DisplayName', sprintf('Kalman (RMSE: %.2f)', kalmanRMSE));
                plot(newDatetimes, arimaPredictions, 'r-o', 'LineWidth', 1.5, 'DisplayName', sprintf('ARIMA (RMSE: %.2f)', arimaRMSE));
                hold off;
                title('Comparison of 24-Hour Forecasts', 'FontSize', 14);
                xlabel('Hour', 'FontSize', 12);
                ylabel('Price (USD)', 'FontSize', 12);
                legend('Location', 'best');
                grid on;
                datetick('x', 'HH:MM', 'keepticks');
                
                subplot(2, 1, 2);
                hold on;
                bar(1:height(newData), abs(kalmanErrors), 'FaceColor', [0 0.4 0.7], 'FaceAlpha', 0.5, 'DisplayName', sprintf('Kalman (MAPE: %.2f%%)', kalmanMAPE));
                bar(1:height(newData), abs(arimaErrors), 'FaceColor', [0.7 0.2 0.1], 'FaceAlpha', 0.5, 'DisplayName', sprintf('ARIMA (MAPE: %.2f%%)', arimaMAPE));
                hold off;
                title('Absolute Errors by Hour', 'FontSize', 14);
                xlabel('Hour of Day', 'FontSize', 12);
                ylabel('Absolute Error (USD)', 'FontSize', 12);
                legend('Location', 'best');
                grid on;
                xticks(1:4:24);
                
                % Add a title for the entire figure
                sgtitle('Comparison: Kalman vs. ARIMA on 24-Hour Data', 'FontSize', 16);
                
                % Create a summary table
                resultTable = table(...
                    {'Kalman Filter'; 'ARIMA Model'}, ...
                    [kalmanRMSE; arimaRMSE], ...
                    [mean(abs(kalmanErrors)); mean(abs(arimaErrors))], ...
                    [kalmanMAPE; arimaMAPE], ...
                    [mean(kalmanErrors); mean(arimaErrors)], ...
                    'VariableNames', {'Model', 'RMSE', 'MAE', 'MAPE', 'Bias'});
                
                % Display the comparison table
                disp('Performance Metrics Comparison on New Data:');
                disp(resultTable);
            end
        catch e
            fprintf('Could not compare with Kalman: %s\n', e.message);
        end
        
    catch e
        % Display any errors that occur
        error('Error processing new data: %s', e.message);
    end
end

%% Function to forecast the next 24 hours with ARIMA
function forecastNext24HoursARIMA(closePrices, Mdl)
    % This function forecasts the next 24 hours from the last known data point using ARIMA
    
    % Access the global variables to get dates
    global datetimes;
    
    % Get the last known price and date
    lastKnownPrice = closePrices(end);
    lastDateTime = datetimes(end);
    
    % Generate date-time stamps for the forecast period
    forecastDates = lastDateTime + hours(1:24)';
    
    % Display information
    fprintf('Forecasting 24 hours ahead from %s\n', datestr(lastDateTime));
    fprintf('Last known price: %.2f\n', lastKnownPrice);
    
    % Generate forecasts
    [forecasts, variances] = forecast(Mdl, 24, 'Y0', closePrices);
    
    % Calculate 95% prediction intervals
    forecastCI = zeros(24, 2);
    for h = 1:24
        forecastCI(h, :) = [
            forecasts(h) - 1.96 * sqrt(variances(h)),
            forecasts(h) + 1.96 * sqrt(variances(h))
        ];
    end
    
    % Verify first forecast
    fprintf('First forecast: %.2f\n', forecasts(1));
    fprintf('Difference from last known: %.2f\n', forecasts(1) - lastKnownPrice);
    
    % Plot the forecasts
    figure('Position', [100, 100, 1200, 600]);
    
    hold on;
    % Plot the last 48 hours of actual data for context
    lastHours = min(48, length(closePrices));
    plot(datetimes(end-lastHours+1:end), closePrices(end-lastHours+1:end), 'b-', 'LineWidth', 1.5, 'DisplayName', 'Historical Data');
    
    % Plot the forecasts
    plot(forecastDates, forecasts, 'r-o', 'LineWidth', 1.5, 'DisplayName', 'ARIMA Forecast');
    plot(forecastDates, forecastCI(:, 1), 'r--', 'LineWidth', 1, 'DisplayName', '95% Lower Bound');
    plot(forecastDates, forecastCI(:, 2), 'r--', 'LineWidth', 1, 'DisplayName', '95% Upper Bound');
    
    % Add a vertical line to mark the forecast start
    plot([lastDateTime, lastDateTime], [min(min(forecastCI(:, 1)), min(closePrices(end-lastHours+1:end)))*0.98, ...
        max(max(forecastCI(:, 2)), max(closePrices(end-lastHours+1:end)))*1.02], ...
        'k--', 'LineWidth', 1, 'DisplayName', 'Forecast Start');
    
    hold off;
    title('ARIMA 24-Hour Price Forecast', 'FontSize', 16);
    xlabel('Date and Time', 'FontSize', 14);
    ylabel('Price (USD)', 'FontSize', 14);
    legend('Location', 'best');
    grid on;
    datetick('x', 'dd-mmm HH:MM', 'keepticks');
    
    % Ensure the y-axis shows both historical and forecast data properly
    yMin = min(min(forecastCI(:, 1)), min(closePrices(end-lastHours+1:end))) * 0.95;
    yMax = max(max(forecastCI(:, 2)), max(closePrices(end-lastHours+1:end))) * 1.05;
    ylim([yMin, yMax]);
    
    % Create a table with the forecasts
    forecastTable = table(forecastDates, forecasts, forecastCI(:,1), forecastCI(:,2), ...
        'VariableNames', {'DateTime', 'Forecast', 'LowerBound', 'UpperBound'});
    
    % Display results
    fprintf('ARIMA 24-Hour Price Forecast from %s:\n', datestr(lastDateTime));
    disp(forecastTable);
    
    % Try to compare with Kalman Filter forecast
    try
        % Check if the forecastNext24Hours function exists in the main script
        mainScriptFunctions = which('forecastNext24Hours');
        if ~isempty(mainScriptFunctions)
            fprintf('Note: You can compare these forecasts with Kalman Filter predictions by running the forecastNext24Hours function in the main script.\n');
        end
    catch
        % Do nothing if there's an error checking for the function
    end
end
/**
 * 進階功率分析模組
 * 基於 GoldenCheetah 和 cycling-analytics 的實作
 * 
 * 包含：
 * 1. Morton's 3-Parameter Critical Power (CP) 模型
 * 2. Exponential Decay CTL/ATL (指數衰減)
 * 3. AI FTP 預測補償模型 (Feature Engineering for ML)
 */

// ============================================
// 常數定義
// ============================================
const CTL_TIME_CONSTANT = 42;  // 慢性訓練負荷時間常數
const ATL_TIME_CONSTANT = 7;   // 急性訓練負荷時間常數
const NP_WINDOW_SIZE = 30;     // NP 計算窗口大小

// MMP 採樣時間點 (用於 Power-Duration Curve)
const MMP_DURATIONS = [1, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1800, 2400, 3600, 5400, 7200];

// ============================================
// 1. Normalized Power (NP) - 標準算法
// ============================================
function calculateNormalizedPower(powerData, windowSize = NP_WINDOW_SIZE) {
    if (!powerData || powerData.length < windowSize) {
        const sum = powerData.reduce((a, b) => a + b, 0);
        return Math.round(sum / powerData.length) || 0;
    }

    const rollingAveragePower = [];
    const correctedWindowSize = Math.min(windowSize, powerData.length);

    for (let i = correctedWindowSize - 1; i < powerData.length; i++) {
        const windowSum = powerData.slice(i - correctedWindowSize + 1, i + 1).reduce((a, b) => a + b, 0);
        rollingAveragePower.push(windowSum / correctedWindowSize);
    }

    const sumFourthPower = rollingAveragePower.reduce((sum, p) => sum + Math.pow(p, 4), 0);
    const np = Math.pow(sumFourthPower / rollingAveragePower.length, 0.25);

    return Math.round(np);
}

// ============================================
// 2. Exponential Decay CTL/ATL (指數衰減模型)
// ============================================
function calculateExponentialCTL(previousCTL, todayTSS, timeConstant = CTL_TIME_CONSTANT) {
    // CTL_today = CTL_yesterday * (1 - 1/τ) + TSS_today * (1/τ)
    return (1 - 1 / timeConstant) * previousCTL + (1 / timeConstant) * todayTSS;
}

function calculateExponentialATL(previousATL, todayTSS, timeConstant = ATL_TIME_CONSTANT) {
    return (1 - 1 / timeConstant) * previousATL + (1 / timeConstant) * todayTSS;
}

function calculateTSB(ctl, atl) {
    return ctl - atl;
}

// ============================================
// 3. Mean Maximal Power (MMP) 曲線計算
// ============================================
function calculateMMP(powerData, duration) {
    if (!powerData || powerData.length < duration) return 0;

    let maxAvg = 0;
    let windowSum = 0;

    // 初始化窗口
    for (let i = 0; i < duration; i++) {
        windowSum += powerData[i];
    }
    maxAvg = windowSum / duration;

    // 滑動窗口
    for (let i = duration; i < powerData.length; i++) {
        windowSum = windowSum - powerData[i - duration] + powerData[i];
        const avg = windowSum / duration;
        if (avg > maxAvg) maxAvg = avg;
    }

    return Math.round(maxAvg);
}

function calculateFullMMP(powerData) {
    const mmpCurve = {};
    for (const duration of MMP_DURATIONS) {
        if (duration <= powerData.length) {
            mmpCurve[duration] = calculateMMP(powerData, duration);
        }
    }
    return mmpCurve;
}

// ============================================
// 4. Morton's 3-Parameter CP Model
// ============================================
function fitMorton3P(pdCurve) {
    /**
     * Morton's 3-Parameter Critical Power Model:
     * P(t) = CP + W' / (t - τ)
     * 
     * 其中:
     *   CP = Critical Power (臨界功率)
     *   W' = Anaerobic Work Capacity (無氧工作容量)
     *   τ  = Time constant (時間常數，約 10-30 秒)
     * 
     * 使用 Levenberg-Marquardt 簡化版進行非線性擬合
     */
    if (!pdCurve || pdCurve.length < 3) {
        return { cp: 0, wPrime: 0, tau: 20, pMax: 0, r2: 0 };
    }

    // 過濾有效數據點 (功率 > 0 且時間 > τ 初始值)
    const validPoints = pdCurve.filter(p => p.power > 0 && p.duration > 5);
    if (validPoints.length < 3) {
        return { cp: 0, wPrime: 0, tau: 20, pMax: 0, r2: 0 };
    }

    // 初始猜測值
    let cp = validPoints[validPoints.length - 1].power;  // 最長時間的功率
    let wPrime = 20000;  // 20 kJ
    let tau = 15;        // 15 秒

    // 簡化的 Gauss-Newton 迭代
    const maxIter = 200;
    const learningRate = 0.001;

    for (let iter = 0; iter < maxIter; iter++) {
        let gradCP = 0, gradWPrime = 0, gradTau = 0;
        let totalError = 0;

        for (const point of validPoints) {
            const t = point.duration;
            const pActual = point.power;
            const denominator = Math.max(t - tau, 0.1);
            const pPredicted = cp + wPrime / denominator;
            const error = pActual - pPredicted;

            totalError += error * error;
            gradCP -= 2 * error;
            gradWPrime -= 2 * error / denominator;
            gradTau -= 2 * error * wPrime / (denominator * denominator);
        }

        // 更新參數
        cp -= learningRate * gradCP;
        wPrime -= learningRate * gradWPrime * 1000;
        tau -= learningRate * gradTau * 10;

        // 約束範圍
        cp = Math.max(100, Math.min(600, cp));
        wPrime = Math.max(5000, Math.min(60000, wPrime));
        tau = Math.max(5, Math.min(40, tau));
    }

    // 計算 R² (決定係數)
    const meanP = validPoints.reduce((s, p) => s + p.power, 0) / validPoints.length;
    let ssTotal = 0, ssRes = 0;
    for (const point of validPoints) {
        ssTotal += Math.pow(point.power - meanP, 2);
        const pPredicted = cp + wPrime / Math.max(point.duration - tau, 0.1);
        ssRes += Math.pow(point.power - pPredicted, 2);
    }
    const r2 = 1 - ssRes / ssTotal;

    // P_max = CP + W'/τ
    const pMax = cp + wPrime / tau;

    return {
        cp: Math.round(cp),
        wPrime: Math.round(wPrime),
        wPrimeKJ: Math.round(wPrime / 1000 * 10) / 10,
        tau: Math.round(tau * 10) / 10,
        pMax: Math.round(pMax),
        r2: Math.round(r2 * 1000) / 1000,
    };
}

// ============================================
// 5. AI FTP 預測補償模型 - 特徵工程
// ============================================
function extractFTPPredictionFeatures(activities, currentFTP = 200, maxHR = 185) {
    /**
     * 為 AI 模型準備特徵，解決「使用者最近沒測過全力」的問題
     * 
     * 輸入特徵:
     * 1. 過去 90 天的 MMP 曲線關鍵點
     * 2. 訓練負荷指標 (CTL, ATL, TSB)
     * 3. 心率與功率效率比 (Efficiency Factor)
     * 4. 騎乘頻率與總爬升量
     * 5. FTP 相關代理指標 (20min power * 0.95, 60min power, etc.)
     */

    // 合併所有功率數據
    const allMMP = {};
    let totalDuration = 0;
    let totalElevation = 0;
    let totalActivities = 0;
    let powerHRPairs = [];
    let ctl = 0, atl = 0;
    const dailyTSS = {};

    for (const activity of activities) {
        const powerData = extractPowerData(activity.streams || []);
        const hrData = extractHRData(activity.streams || []);

        if (powerData.length < 60) continue;
        totalActivities++;

        // 計算 MMP 並保留最大值
        const mmp = calculateFullMMP(powerData);
        for (const [duration, power] of Object.entries(mmp)) {
            if (!allMMP[duration] || power > allMMP[duration]) {
                allMMP[duration] = power;
            }
        }

        // 收集心率/功率配對 (用於 Efficiency Factor)
        if (hrData.length === powerData.length) {
            for (let i = 0; i < powerData.length; i++) {
                if (powerData[i] > 100 && hrData[i] > 100) {
                    powerHRPairs.push({ power: powerData[i], hr: hrData[i] });
                }
            }
        }

        // 累計
        totalDuration += activity.moving_time || powerData.length;
        totalElevation += activity.total_elevation_gain || 0;

        // 計算 TSS 並按日累計
        const np = calculateNormalizedPower(powerData);
        const tss = calculateTSS(np, currentFTP, activity.moving_time || powerData.length);
        const dateKey = new Date(activity.start_date || activity.created_at).toISOString().split('T')[0];
        dailyTSS[dateKey] = (dailyTSS[dateKey] || 0) + tss;
    }

    // 計算指數衰減 CTL/ATL
    const sortedDates = Object.keys(dailyTSS).sort();
    for (const date of sortedDates) {
        ctl = calculateExponentialCTL(ctl, dailyTSS[date]);
        atl = calculateExponentialATL(atl, dailyTSS[date]);
    }
    const tsb = calculateTSB(ctl, atl);

    // 計算 Efficiency Factor (EF = NP / avgHR)
    let efficiencyFactor = 0;
    if (powerHRPairs.length > 100) {
        const avgPower = powerHRPairs.reduce((s, p) => s + p.power, 0) / powerHRPairs.length;
        const avgHR = powerHRPairs.reduce((s, p) => s + p.hr, 0) / powerHRPairs.length;
        efficiencyFactor = Math.round((avgPower / avgHR) * 100) / 100;
    }

    // FTP 代理估算 (多種方法)
    const ftpEstimates = {};

    // 方法 1: 20 分鐘功率 * 0.95
    if (allMMP[1200]) {
        ftpEstimates.from20min = Math.round(allMMP[1200] * 0.95);
    }

    // 方法 2: 60 分鐘功率 (如果有)
    if (allMMP[3600]) {
        ftpEstimates.from60min = allMMP[3600];
    }

    // 方法 3: 使用 CP 模型
    const pdCurve = Object.entries(allMMP).map(([d, p]) => ({ duration: parseInt(d), power: p }));
    const cpModel = fitMorton3P(pdCurve);
    if (cpModel.cp > 0) {
        ftpEstimates.fromCP = cpModel.cp;
    }

    // 方法 4: 45 分鐘功率 * 0.98
    if (allMMP[2700]) {
        ftpEstimates.from45min = Math.round(allMMP[2700] * 0.98);
    }

    // 綜合估算 (加權平均)
    const estimates = Object.values(ftpEstimates);
    const predictedFTP = estimates.length > 0
        ? Math.round(estimates.reduce((a, b) => a + b, 0) / estimates.length)
        : currentFTP;

    return {
        // AI 模型輸入特徵
        features: {
            // MMP 曲線關鍵點 (watts/kg 如果有體重的話更好)
            mmp5s: allMMP[5] || 0,
            mmp30s: allMMP[30] || 0,
            mmp1min: allMMP[60] || 0,
            mmp5min: allMMP[300] || 0,
            mmp10min: allMMP[600] || 0,
            mmp20min: allMMP[1200] || 0,
            mmp60min: allMMP[3600] || 0,

            // 訓練負荷
            ctl: Math.round(ctl),
            atl: Math.round(atl),
            tsb: Math.round(tsb),

            // 效率指標
            efficiencyFactor,

            // 訓練量
            totalActivities,
            totalHours: Math.round(totalDuration / 3600 * 10) / 10,
            totalElevation: Math.round(totalElevation),
            avgActivitiesPerWeek: Math.round(totalActivities / 6 * 10) / 10, // 假設 42 天 = 6 週

            // CP 模型參數
            cp: cpModel.cp,
            wPrime: cpModel.wPrime,
            pMax: cpModel.pMax,
        },

        // FTP 預測結果
        ftpPrediction: {
            currentFTP,
            predictedFTP,
            confidence: cpModel.r2 > 0.95 ? 'high' : cpModel.r2 > 0.85 ? 'medium' : 'low',
            estimates: ftpEstimates,
            recommendation: predictedFTP > currentFTP * 1.05
                ? `建議更新 FTP 至 ${predictedFTP}W (+${Math.round((predictedFTP / currentFTP - 1) * 100)}%)`
                : predictedFTP < currentFTP * 0.95
                    ? `FTP 可能下降，建議重新測試驗證`
                    : '當前 FTP 設定合理',
        },

        // CP 模型詳情
        cpModel,

        // 完整 MMP 曲線
        mmpCurve: allMMP,
    };
}

// ============================================
// 輔助函數
// ============================================
function extractPowerData(streams) {
    if (!streams || !Array.isArray(streams)) return [];
    const wattsStream = streams.find(s => s.type === 'watts');
    return wattsStream?.data || [];
}

function extractHRData(streams) {
    if (!streams || !Array.isArray(streams)) return [];
    const hrStream = streams.find(s => s.type === 'heartrate');
    return hrStream?.data || [];
}

function calculateTSS(np, ftp, durationSeconds) {
    if (ftp <= 0 || np <= 0) return 0;
    const intensityFactor = np / ftp;
    return Math.round((durationSeconds * np * intensityFactor) / (ftp * 3600) * 1000) / 10;
}

// ============================================
// 導出給 n8n 使用
// ============================================
module.exports = {
    // 基礎計算
    calculateNormalizedPower,
    calculateTSS,
    calculateExponentialCTL,
    calculateExponentialATL,
    calculateTSB,

    // MMP 計算
    calculateMMP,
    calculateFullMMP,

    // CP 模型
    fitMorton3P,

    // AI 特徵提取
    extractFTPPredictionFeatures,
};

// ============================================
// n8n 直接執行入口
// ============================================
if (typeof $input !== 'undefined') {
    const items = $input.all();
    const first = items[0]?.json || {};
    const currentFTP = first.athlete_ftp || 200;
    const maxHR = first.athlete_max_hr || 185;

    // 提取所有活動
    const activities = items.map(item => item.json);

    // 執行完整分析
    const analysisResult = extractFTPPredictionFeatures(activities, currentFTP, maxHR);

    return [{ json: analysisResult }];
}


// Power Models & Algorithms
// Used by MMPChart and GoldenCheetahPage

// CP 模型結果型別
export interface CPModelResult {
    cp: number;
    wPrime: number;
    tau: number;
    rSquared: number;
    fittedCurve: { duration: number; power: number }[];
    modelName: string;
}

// MMP 採樣時間點 (秒)
export const MMP_DURATIONS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1800, 2400, 3600, 5400, 7200];

/**
 * 計算 Normalized Power (NP)
 * 演算法步驟:
 * 1. 計算 30 秒滑動平均 (Rolling Average)
 * 2. 將每個 30 秒平均值取 4 次方
 * 3. 計算這些 4 次方值的平均
 * 4. 開 4 次方根
 */
export const calculateNP = (powerData: number[]): number => {
    // 若數據不足 30 秒，直接回傳平均功率 (或 0)
    if (!powerData || powerData.length < 30) return 0;

    const rollingSeries: number[] = [];
    let windowSum = 0;

    // 1. 初始化第一個 30 秒窗口
    for (let i = 0; i < 30; i++) {
        windowSum += powerData[i];
    }
    rollingSeries.push(windowSum / 30);

    // 2. 滑動窗口計算剩餘數據
    for (let i = 30; i < powerData.length; i++) {
        // 移除最舊的一個點，加入最新的一個點
        windowSum = windowSum - powerData[i - 30] + powerData[i];
        rollingSeries.push(windowSum / 30);
    }

    // 3. 計算 4 次方平均
    let sumQuartic = 0;
    for (const val of rollingSeries) {
        sumQuartic += Math.pow(val, 4);
    }
    const avgQuartic = sumQuartic / rollingSeries.length;

    // 4. 開 4 次方根
    return Math.round(Math.pow(avgQuartic, 0.25));
};


// ============================================================================
// 1. Morton's 3-Parameter CP Model (TCU Default)
// Formula: P(t) = CP + W' / (t - τ)
// Algorithm: Grid Search on τ + OLS for (CP, W')
// Range: 3 min ~ 20 min (Classic CP Range)
// ============================================================================
export const fitMorton3P = (pdCurve: { duration: number; power: number }[]): CPModelResult | null => {
    // 限制範圍：3分鐘 ~ 20分鐘 (CP 黃金區間)
    const validPoints = pdCurve.filter(p => p.power > 0 && p.duration >= 180 && p.duration <= 1200);
    if (validPoints.length < 3) return null;

    const meanPower = validPoints.reduce((sum, p) => sum + p.power, 0) / validPoints.length;
    const ssTotal = validPoints.reduce((sum, p) => sum + (p.power - meanPower) ** 2, 0);
    if (ssTotal === 0) return null;

    const solveForTau = (tau: number) => {
        const n = validPoints.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (const p of validPoints) {
            const denominator = p.duration - tau;
            if (denominator <= 1) return null;
            const x = 1 / denominator;
            const y = p.power;
            sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
        }

        const denom = n * sumXX - sumX * sumX;
        if (Math.abs(denom) < 1e-10) return null;

        const wPrime = (n * sumXY - sumX * sumY) / denom;
        const cp = (sumY - wPrime * sumX) / n;

        if (cp <= 0 || wPrime <= 0) return null;

        let ssResidual = 0;
        for (const p of validPoints) {
            const predicted = cp + wPrime / (p.duration - tau);
            ssResidual += (p.power - predicted) ** 2;
        }
        const rSquared = 1 - ssResidual / ssTotal;

        return { cp, wPrime, tau, rSquared };
    };

    let bestResult = solveForTau(0);
    // Grid Search from 0.5s to 30s
    for (let testTau = 0.5; testTau <= 30; testTau += 0.5) {
        if (testTau >= 170) break; // Ensure tau < min_duration
        const result = solveForTau(testTau);
        if (result && (!bestResult || result.rSquared > bestResult.rSquared)) {
            bestResult = result;
        }
    }

    if (!bestResult) return null;

    const { cp, wPrime, tau, rSquared } = bestResult;
    return {
        cp: Math.round(cp),
        wPrime: Math.round(wPrime),
        tau: Math.round(tau * 10) / 10,
        rSquared: Math.round(rSquared * 1000) / 1000,
        modelName: 'Morton 3-Parameter',
        fittedCurve: MMP_DURATIONS
            .filter(d => d > tau + 1 && d >= 60)
            .map(d => ({ duration: d, power: Math.round(cp + wPrime / (d - tau)) })),
    };
};

// ============================================================================
// 2. Cycling Analytics (Monod & Scherrer 2P)
// Reference: https://github.com/velozs/cycling-analytics
// Formula: Work = CP * time + W' (Linear Regression on Work vs Time)
// Range: 3 min ~ 20 min
// ============================================================================
export const fitCyclingAnalytics = (pdCurve: { duration: number; power: number }[]): CPModelResult | null => {
    const validPoints = pdCurve.filter(p => p.power > 0 && p.duration >= 180 && p.duration <= 1200);
    if (validPoints.length < 3) return null;

    const n = validPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const p of validPoints) {
        const x = p.duration;
        const y = p.power * p.duration; // Work
        sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
    }

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return null;

    const cp = (n * sumXY - sumX * sumY) / denom;
    const wPrime = (sumY - cp * sumX) / n;

    // Calculate R² (in Power domain for fair comparison)
    const meanPower = validPoints.reduce((sum, p) => sum + p.power, 0) / validPoints.length;
    const ssTotal = validPoints.reduce((sum, p) => sum + (p.power - meanPower) ** 2, 0);
    let ssResidual = 0;
    for (const p of validPoints) {
        const predicted = cp + wPrime / p.duration;
        ssResidual += (p.power - predicted) ** 2;
    }
    const rSquared = ssTotal !== 0 ? Math.max(0, 1 - ssResidual / ssTotal) : 0;

    return {
        cp: Math.round(cp),
        wPrime: Math.round(wPrime),
        tau: 0,
        rSquared: Math.round(rSquared * 1000) / 1000,
        modelName: 'Cycling Analytics (2P)',
        fittedCurve: MMP_DURATIONS
            .filter(d => d >= 60)
            .map(d => ({ duration: d, power: Math.round(cp + wPrime / d) })),
    };
};

// ============================================================================
// 3. GoldenCheetah (Inverse Time 2P)
// Reference: https://github.com/GoldenCheetah/GoldenCheetah
// Formula: Power = CP + W' * (1/time) (Linear Regression on Power vs 1/Time)
// Note: This minimizes error in Watts, unlike Monod-Scherrer which minimizes Work error.
// Range: 3 min ~ 20 min
// ============================================================================
export const fitGoldenCheetah = (pdCurve: { duration: number; power: number }[]): CPModelResult | null => {
    const validPoints = pdCurve.filter(p => p.power > 0 && p.duration >= 180 && p.duration <= 1200);
    if (validPoints.length < 3) return null;

    // Linear Regression: y = mx + c
    // y = Power, x = 1 / Time
    // m (Slope) = W'
    // c (Intercept) = CP

    const n = validPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const p of validPoints) {
        const x = 1 / p.duration;
        const y = p.power;
        sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
    }

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return null;

    const wPrime = (n * sumXY - sumX * sumY) / denom;
    const cp = (sumY - wPrime * sumX) / n;

    // Calculate R²
    const meanPower = validPoints.reduce((sum, p) => sum + p.power, 0) / validPoints.length;
    const ssTotal = validPoints.reduce((sum, p) => sum + (p.power - meanPower) ** 2, 0);
    let ssResidual = 0;
    for (const p of validPoints) {
        const predicted = cp + wPrime / p.duration;
        ssResidual += (p.power - predicted) ** 2;
    }
    const rSquared = ssTotal !== 0 ? Math.max(0, 1 - ssResidual / ssTotal) : 0;

    return {
        cp: Math.round(cp),
        wPrime: Math.round(wPrime),
        tau: 0,
        rSquared: Math.round(rSquared * 1000) / 1000,
        modelName: 'GoldenCheetah (2P)',
        fittedCurve: MMP_DURATIONS
            .filter(d => d >= 60)
            .map(d => ({ duration: d, power: Math.round(cp + wPrime / d) })),
    };
};

// 計算 MMP (Mean Maximal Power) 曲線
export const calculateMMP = (allPowerArrays: number[][]): { duration: number; power: number }[] => {
    const result: { duration: number; power: number }[] = [];

    for (const duration of MMP_DURATIONS) {
        let maxAvg = 0;
        for (const powerData of allPowerArrays) {
            if (powerData.length < duration) continue;
            let windowSum = 0;
            // First window
            for (let i = 0; i < duration; i++) windowSum += powerData[i];
            maxAvg = Math.max(maxAvg, windowSum / duration);
            // Sliding window
            for (let i = duration; i < powerData.length; i++) {
                windowSum += powerData[i] - powerData[i - duration];
                maxAvg = Math.max(maxAvg, windowSum / duration);
            }
        }
        if (maxAvg > 0) result.push({ duration, power: Math.round(maxAvg) });
    }
    return result;
};

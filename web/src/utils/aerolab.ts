/**
 * Aerolab — Virtual Elevation 演算法模組
 * 
 * 基於 Robert Chung 的 Virtual Elevation 方法（Chung Method），
 * 透過功率、速度、海拔數據推估氣動阻力面積 (CdA) 與滾動阻力係數 (Crr)。
 * 
 * 核心原理：
 * 當 CdA 和 Crr 估算正確時，由功率數據反推的「虛擬海拔」
 * 將與 GPS 記錄的「實際海拔」曲線吻合。
 * 
 * 靈感來源：GoldenCheetah (GPL v2) — https://github.com/GoldenCheetah/GoldenCheetah
 */

// ============================================
// 型別定義
// ============================================

/** Aerolab 計算所需的物理參數 */
export interface AerolabParams {
    /** 氣動阻力面積 (m²)，典型公路車：0.25–0.40 */
    cda: number;
    /** 滾動阻力係數，典型公路車胎：0.003–0.008 */
    crr: number;
    /** 人+車+裝備總重 (kg) */
    totalMass: number;
    /** 空氣密度 (kg/m³)，海平面標準大氣約 1.226 */
    airDensity: number;
}

/** Aerolab 計算輸入的串流數據 */
export interface AerolabStreams {
    /** 功率串流 (W)，每秒 */
    power: number[];
    /** 速度串流 (m/s)，每秒 */
    velocity: number[];
    /** 實際海拔串流 (m)，每秒 */
    altitude: number[];
    /** 累計距離串流 (m)，每秒 */
    distance: number[];
}

/** Aerolab 計算結果 */
export interface AerolabResult {
    /** 虛擬海拔曲線 (m) */
    virtualElevation: number[];
    /** 實際海拔曲線 (m)，經偏移對齊 */
    actualElevation: number[];
    /** 距離軸 (m) */
    distance: number[];
    /** 均方根誤差 (m)，越小表示擬合越好 */
    rmse: number;
    /** 圖表用的降採樣數據 */
    chartData: AerolabChartPoint[];
}

/** 圖表用的單點數據 */
export interface AerolabChartPoint {
    /** 距離 (km) */
    distanceKm: number;
    /** 虛擬海拔 (m) */
    virtualElev: number;
    /** 實際海拔 (m) */
    actualElev: number;
    /** 殘差 (m) = virtual - actual */
    residual: number;
    /** 功率 (W) */
    power: number;
    /** 速度 (km/h) */
    speedKmh: number;
}

/** 自動擬合結果 */
export interface AutoFitResult {
    /** 最佳 CdA */
    cda: number;
    /** 最佳 Crr */
    crr: number;
    /** 最佳擬合的 RMSE */
    rmse: number;
}

// ============================================
// 常數
// ============================================

/** 重力加速度 (m/s²) */
const GRAVITY = 9.80665;

/** 最低有效速度閾值 (m/s)，低於此值跳過計算以避免除零 */
const MIN_VELOCITY = 1.0;

// ============================================
// 預設參數
// ============================================

/** 預設 Aerolab 參數（典型公路車騎手） */
export const DEFAULT_AEROLAB_PARAMS: AerolabParams = {
    cda: 0.320,       // 公路車下把位典型值
    crr: 0.005,       // 良好柏油路面 + 公路車胎
    totalMass: 78,     // 70kg 騎手 + 8kg 公路車
    airDensity: 1.226, // 標準大氣壓 (1013.25 hPa)、15°C
};

// ============================================
// 核心演算法
// ============================================

/**
 * 計算虛擬海拔曲線
 * 
 * 使用能量平衡方程式，從功率數據反推每個時間步的海拔變化：
 * 
 * Δh = [P/(m×g×v)] - [0.5×ρ×CdA×v²/(m×g)] - Crr - [v×Δv/(g×Δt)]
 * 
 * 其中：
 * - P = 功率 (W)
 * - m = 總質量 (kg)
 * - g = 重力加速度 (m/s²)
 * - v = 速度 (m/s)
 * - ρ = 空氣密度 (kg/m³)
 * - CdA = 氣動阻力面積 (m²)
 * - Crr = 滾動阻力係數
 * - Δv = 速度變化 (m/s)
 * - Δt = 時間間隔 (s)
 * 
 * @param streams 串流數據
 * @param params 物理參數
 * @returns 計算結果（含圖表數據）
 */
export function calculateVirtualElevation(
    streams: AerolabStreams,
    params: AerolabParams
): AerolabResult {
    const { power, velocity, altitude, distance } = streams;
    const { cda, crr, totalMass, airDensity } = params;
    const mg = totalMass * GRAVITY;

    const len = Math.min(power.length, velocity.length, altitude.length, distance.length);
    if (len < 2) {
        return {
            virtualElevation: [],
            actualElevation: [],
            distance: [],
            rmse: 0,
            chartData: [],
        };
    }

    // 計算虛擬海拔
    const virtualElev: number[] = [0]; // 起始為 0，之後偏移對齊

    for (let i = 1; i < len; i++) {
        const v = velocity[i];
        const p = power[i];
        const dt = 1; // 假設 1 秒間隔

        // 速度過低時跳過（避免除零與雜訊放大）
        if (v < MIN_VELOCITY) {
            virtualElev.push(virtualElev[i - 1]);
            continue;
        }

        // 加速度項
        const dv = velocity[i] - velocity[i - 1];
        const accelTerm = v * dv / (GRAVITY * dt);

        // 空氣阻力的坡度等效
        const aeroDragSlope = 0.5 * airDensity * cda * v * v / mg;

        // Virtual slope = Power-derived slope - aero - rolling - accel
        const virtualSlope = p / (mg * v) - aeroDragSlope - crr - accelTerm;

        // 距離增量
        const dd = distance[i] - distance[i - 1];
        const elevChange = dd > 0 ? virtualSlope * dd : 0;

        virtualElev.push(virtualElev[i - 1] + elevChange);
    }

    // 偏移對齊：使虛擬海拔的起點與實際海拔吻合
    const actualBase = altitude[0];
    const alignedVirtual = virtualElev.map(v => v + actualBase);

    // 計算 RMSE
    let squaredErrorSum = 0;
    let validCount = 0;
    for (let i = 0; i < len; i++) {
        if (velocity[i] >= MIN_VELOCITY) {
            const diff = alignedVirtual[i] - altitude[i];
            squaredErrorSum += diff * diff;
            validCount++;
        }
    }
    const rmse = validCount > 0 ? Math.sqrt(squaredErrorSum / validCount) : 0;

    // 降採樣生成圖表數據
    const chartData = downsampleForChart(
        alignedVirtual, altitude, distance, power, velocity, len
    );

    return {
        virtualElevation: alignedVirtual,
        actualElevation: altitude.slice(0, len),
        distance: distance.slice(0, len),
        rmse: Math.round(rmse * 100) / 100,
        chartData,
    };
}

/**
 * 降採樣產生圖表數據
 * 
 * 長距離活動數據點可能 > 10000，降採樣至 ~500-1000 點
 * 以保持圖表互動流暢
 */
function downsampleForChart(
    virtualElev: number[],
    actualElev: number[],
    distance: number[],
    power: number[],
    velocity: number[],
    len: number
): AerolabChartPoint[] {
    // 目標約 800 點
    const step = len > 4000 ? Math.ceil(len / 800) : len > 2000 ? Math.ceil(len / 600) : 1;
    const data: AerolabChartPoint[] = [];

    for (let i = 0; i < len; i += step) {
        data.push({
            distanceKm: Math.round(distance[i] / 10) / 100, // 保留兩位小數
            virtualElev: Math.round(virtualElev[i] * 10) / 10,
            actualElev: Math.round(actualElev[i] * 10) / 10,
            residual: Math.round((virtualElev[i] - actualElev[i]) * 10) / 10,
            power: power[i] || 0,
            speedKmh: Math.round((velocity[i] || 0) * 3.6 * 10) / 10,
        });
    }

    return data;
}

// ============================================
// 空氣密度計算
// ============================================

/**
 * 根據環境條件計算空氣密度
 * 
 * 使用理想氣體定律的近似公式：
 * ρ = (P_dry / (R_dry × T)) + (P_vapor / (R_vapor × T))
 * 
 * @param temperatureC 氣溫 (°C)
 * @param pressureHPa 大氣壓 (hPa / mbar)
 * @param dewPointC 露點溫度 (°C)，用於修正濕度影響
 * @returns 空氣密度 (kg/m³)
 */
export function calculateAirDensity(
    temperatureC: number,
    pressureHPa: number,
    dewPointC: number = 10
): number {
    const T = temperatureC + 273.15; // 轉為開爾文

    // Magnus 公式計算飽和蒸氣壓 (hPa)
    const satVaporPressure = 6.1078 * Math.pow(10, (7.5 * dewPointC) / (237.3 + dewPointC));

    // 乾空氣壓力 (Pa)
    const dryPressure = (pressureHPa - satVaporPressure) * 100;

    // 水蒸氣壓力 (Pa)
    const vaporPressure = satVaporPressure * 100;

    // 乾空氣氣體常數 R_dry = 287.058 J/(kg·K)
    // 水蒸氣氣體常數 R_vapor = 461.495 J/(kg·K)
    const rho = dryPressure / (287.058 * T) + vaporPressure / (461.495 * T);

    return Math.round(rho * 1000) / 1000;
}

// ============================================
// 自動擬合
// ============================================

/**
 * 自動擬合最佳 CdA
 * 
 * 使用黃金分割搜索法在指定範圍內尋找使 RMSE 最小的 CdA 值。
 * 固定 Crr 不動（因 CdA 的影響遠大於 Crr，
 * 且兩者同時擬合容易產生不穩定的結果）。
 * 
 * @param streams 串流數據
 * @param baseParams 基礎參數（Crr、totalMass、airDensity 固定）
 * @param cdaRange CdA 搜索範圍 [min, max]
 * @returns 最佳 CdA 與對應的 RMSE
 */
export function autoFitCdA(
    streams: AerolabStreams,
    baseParams: AerolabParams,
    cdaRange: [number, number] = [0.15, 0.50]
): AutoFitResult {
    const PHI = (1 + Math.sqrt(5)) / 2; // 黃金比率
    const TOLERANCE = 0.001; // CdA 精度
    const MAX_ITERATIONS = 50;

    let a = cdaRange[0];
    let b = cdaRange[1];

    let x1 = b - (b - a) / PHI;
    let x2 = a + (b - a) / PHI;

    const evaluateCdA = (cda: number): number => {
        const result = calculateVirtualElevation(streams, { ...baseParams, cda });
        return result.rmse;
    };

    let f1 = evaluateCdA(x1);
    let f2 = evaluateCdA(x2);

    for (let i = 0; i < MAX_ITERATIONS && (b - a) > TOLERANCE; i++) {
        if (f1 < f2) {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = b - (b - a) / PHI;
            f1 = evaluateCdA(x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = a + (b - a) / PHI;
            f2 = evaluateCdA(x2);
        }
    }

    const bestCdA = Math.round((a + b) / 2 * 1000) / 1000;
    const bestResult = calculateVirtualElevation(streams, { ...baseParams, cda: bestCdA });

    return {
        cda: bestCdA,
        crr: baseParams.crr,
        rmse: bestResult.rmse,
    };
}

// ============================================
// 輔助函式
// ============================================

/**
 * 驗證串流數據是否足以進行 Aerolab 分析
 * 
 * @returns 錯誤訊息，若有效則返回 null
 */
export function validateAerolabStreams(streams: Partial<AerolabStreams>): string | null {
    if (!streams.power || streams.power.length === 0) {
        return '缺少功率數據';
    }
    if (!streams.velocity || streams.velocity.length === 0) {
        return '缺少速度數據（需要速度感應器或 GPS 記錄）';
    }
    if (!streams.altitude || streams.altitude.length === 0) {
        return '缺少海拔數據';
    }
    if (!streams.distance || streams.distance.length === 0) {
        return '缺少距離數據';
    }

    // 檢查最低數據量（至少 60 秒）
    const minLen = Math.min(
        streams.power.length,
        streams.velocity.length,
        streams.altitude.length,
        streams.distance.length
    );
    if (minLen < 60) {
        return '數據不足（需要至少 60 秒的記錄）';
    }

    return null;
}

/**
 * 格式化 CdA 值為易讀字串
 * 
 * @example formatCdA(0.321) → "0.321 m²"
 */
export function formatCdA(cda: number): string {
    return `${cda.toFixed(3)} m²`;
}

/**
 * 格式化 Crr 值為易讀字串
 * 
 * @example formatCrr(0.005) → "0.0050"
 */
export function formatCrr(crr: number): string {
    return crr.toFixed(4);
}

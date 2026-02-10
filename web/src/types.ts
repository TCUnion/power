
export const ViewType = {
    LANDING: 'LANDING',
    DASHBOARD: 'DASHBOARD',
    LEADERBOARD: 'LEADERBOARD',
    RACE: 'RACE',
    ADMIN: 'ADMIN',
    REGISTER: 'REGISTER',
    MAINTENANCE: 'MAINTENANCE',
    MEMBER_BINDING: 'MEMBER_BINDING',
    AI_COACH: 'AI_COACH',
    TEAM_DASHBOARD: 'TEAM_DASHBOARD',
    MANAGER_DASHBOARD: 'MANAGER_DASHBOARD',
    SETTINGS: 'SETTINGS',
} as const;
export type ViewType = typeof ViewType[keyof typeof ViewType];

export const RaceStatus = {
    AWAITING: 'AWAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    FINISHED: 'FINISHED',
} as const;
export type RaceStatus = typeof RaceStatus[keyof typeof RaceStatus];


export interface Participant {
    id: number | string;
    rank: number;
    name: string;
    avatar: string;
    bike?: string;
    team?: string;
    tcu_id?: string;
    number?: string;
    time: string;
    time_seconds?: number;
    speed: string;
    speed_kmh?: number;
    avg_power?: string;
    avg_power_value?: number;
    heart_rate?: string;
    heart_rate_avg?: number;
    cadence?: string;
    distance_completed?: string;
    distance_meters?: number;
    date: string;
    strava_activity_id?: string | number;
}

export interface StravaZoneBucket {
    min: number;
    max: number;
    time?: number;
}

export interface StravaZoneSummary {
    score?: number;
    distribution_buckets?: StravaZoneBucket[];
    type: 'heartrate' | 'power';
    resource_state?: number;
}

export interface TCUMember {
    email: string;
    real_name: string;
    tcu_id: string;
    account?: string;
    nickname?: string;
    team?: string;
    member_type?: string;
    self_introduction?: string;
    skills?: string;
    otp_code?: string;
    otp_expires_at?: string;
}

export interface StravaActivity {
    id: number;
    athlete_id: number;
    athlete?: Record<string, unknown>; // 原始 Athlete 物件
    name: string;
    distance: number;
    moving_time: number; // 使用秒
    elapsed_time?: number; // 總耗時 (秒)
    start_date: string;
    start_date_local?: string;
    gear_id?: string; // 對應 bikes.id
    zones?: StravaZoneSummary[]; // 活動區間摘要
    total_elevation_gain: number; // 總爬升 (公尺)
    elev_high?: number;
    elev_low?: number;
    average_watts?: number;
    max_watts?: number;
    weighted_average_watts?: number;
    device_watts?: boolean;
    average_heartrate?: number;
    max_heartrate?: number;
    has_heartrate?: boolean;
    average_speed?: number;
    max_speed?: number;
    average_cadence?: number;
    average_temp?: number;
    kilojoules?: number;
    calories?: number;
    device_name?: string;
    trainer?: boolean;
    commute?: boolean;
    manual?: boolean;
    private?: boolean;
    visibility?: string;
    sport_type?: string;
    suffer_score?: number;
    map?: {
        id: string;
        polyline: string;
        summary_polyline: string;
    };
    start_latlng?: [number, number];
    end_latlng?: [number, number];
    upload_id?: number;
    external_id?: string;
    description?: string;
    timezone?: string;
    utc_offset?: number;
}

export interface Activity {
    id: number | string;
    title: string;
    date: string;
    power: string;
    time: string;
    is_pr?: boolean;
}

export interface SegmentData {
    id: number | string;
    name: string;
    description?: string;
    activity_type: string;
    distance: number;
    average_grade: number;
    maximum_grade: number;
    elevation_high: number;
    elevation_low: number;
    map?: {
        polyline: string;
    };
    start_date?: string;
    end_date?: string;
}

export interface LeaderboardStats {
    total_athletes: number;
    completed_athletes: number;
    best_time: string;
    avg_time: string;
    max_power: number;
    avg_speed: number;
}

export interface LeaderboardResponse {
    leaderboard: Participant[];
    stats: LeaderboardStats;
    segment: SegmentData;
    last_updated: string;
}

export interface MaintenanceItem {
    id?: string;
    name: string;
    cost: number;
    note?: string;
}

export interface MaintenanceRecord {
    id: string;
    vehicle_id: string;
    date: string;
    mileage: number;
    total_cost: number;
    description: string;
    service_type: 'Shop' | 'DIY';
    items: MaintenanceItem[];
    other?: string; // 其他資訊欄位
    created_at: string;
}

export interface Vehicle {
    id: string;
    user_id?: string;
    strava_athlete_id?: number | string;
    brand: string;
    model: string;
    year?: number;
    transmission?: string;
    initial_mileage: number;
    current_mileage: number;
    created_at: string;
    maintenance_records?: MaintenanceRecord[];
}

export interface Wheelset {
    id: string;
    athlete_id: string;
    bike_id?: string;
    name: string;
    brand?: string;
    model?: string;
    tire_brand?: string;
    tire_specs?: string;
    tire_type?: string;
    distance: number; // in meters
    is_active: boolean;
    active_date?: string;
    color?: string;
    created_at: string;
    updated_at: string;
}

// ====================================
// 管理後台系統型別定義
// ====================================

// 授權狀態
export type AuthorizationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// 授權類型
export type AuthorizationType = 'maintenance' | 'activity' | 'statistics' | 'all';

// 通知類型
export type NotificationType = 'maintenance_due' | 'parts_prep' | 'activity_summary' | 'overdue_alert';

// 通知管道
export type NotificationChannel = 'line' | 'email' | 'push' | 'all';

// 管理者角色
export type ManagerRole = 'admin' | 'shop_owner' | 'team_leader' | 'technician' | 'team_coach' | 'power_coach';

// 授權關係
export interface UserAuthorization {
    id: string;
    manager_athlete_id: number;
    athlete_id: number;
    manager_email?: string; // 新增：用於邀請尚未綁定 Strava 的管理者
    authorization_type: AuthorizationType;
    status: AuthorizationStatus;
    shop_name?: string;
    notes?: string;
    created_at: string;
    approved_at?: string;
    expires_at?: string;
    updated_at: string;
    // 關聯資料 (前端組合)
    athlete_info?: {
        firstname?: string;
        lastname?: string;
        profile?: string;
    };
    manager_role?: ManagerRole; // 新增：管理者角色 (用於顯示不同授權文字)
}

// 通知設定
export interface NotificationSetting {
    id: string;
    manager_athlete_id: number;
    notification_type: NotificationType;
    channel: NotificationChannel;
    is_enabled: boolean;
    threshold_days: number;
    threshold_percentage: number;
    schedule_time: string;
    created_at: string;
    updated_at: string;
}

// 通知記錄
export interface NotificationLog {
    id: string;
    manager_athlete_id: number;
    athlete_id?: number;
    notification_type: NotificationType;
    title?: string;
    message: string;
    channel: NotificationChannel;
    status: 'pending' | 'sent' | 'failed' | 'read';
    error_message?: string;
    sent_at?: string;
    read_at?: string;
    created_at: string;
}

// 管理者角色資料
export interface ManagerRoleData {
    id: string;
    athlete_id: number;
    role: ManagerRole;
    shop_name?: string;
    real_name?: string; // 管理員自訂姓名
    // 新增聯絡資訊欄位
    address?: string;
    phone?: string;
    social_links?: {
        facebook?: string;
        instagram?: string;
        youtube?: string;
        website?: string;
    };
    // Legacy fields (optional)
    shop_address?: string;
    shop_phone?: string;
    line_notify_token?: string;
    email?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// 車友保養摘要 (用於報表顯示)
export interface AthleteMaintenanceSummary {
    athlete_id: number;
    athlete_name: string;
    athlete_profile?: string;
    bikes: {
        id: string;
        name: string;
        distance: number;
        maintenanceStatus: 'ok' | 'due_soon' | 'overdue';
        dueSoonCount: number;
        overdueCount: number;
        lastServiceDate?: string;
        nextServiceDate?: string;
        items?: {
            type_id: string;
            name: string;
            percentage: number;
            mileageSince: number;
            interval: number;
            status: 'ok' | 'due_soon' | 'overdue';
        }[];
    }[];
    totalOverdue: number;
    totalDueSoon: number;
}

// 活動摘要統計
export interface ActivitySummary {
    athlete_id: number;
    athlete_name: string;
    total_activities: number;
    total_distance: number; // km
    total_elevation: number; // m
    total_time: number; // hours
    bikes_used: {
        bike_id: string;
        bike_name: string;
        distance: number;
        activity_count: number;
    }[];
    ftp: number; // Current Athlete FTP
    most_active_region?: string;
    // Performance Data
    avg_watts?: number;
    max_watts?: number;
    avg_heartrate?: number;
    max_heartrate?: number;
    avg_cadence?: number;
    recent_activities?: StravaActivity[];
    full_history_activities?: StravaActivity[];
    // PMC Data
    total_tss?: number;
    ctl?: number;
    atl?: number;
    tsb?: number;
}

// 保養項目統計
export interface MaintenanceStatistics {
    type_id: string;
    type_name: string;
    total_count: number;
    total_cost: number;
    avg_interval_km: number;
    athletes_count: number;
}

// ====================================
// 功率訓練分析型別定義
// ====================================

// Strava Stream 數據類型
export type StreamType = 'time' | 'watts' | 'heartrate' | 'cadence' | 'velocity_smooth' | 'altitude' | 'grade_smooth' | 'distance' | 'temp' | 'moving' | 'latlng';

// Strava Zone 數據結構
export interface StravaZone {
    min: number;
    max: number;
    time?: number;
}

// 單一 Stream 數據
export interface StreamData {
    type: StreamType;
    data: number[];
    series_type?: 'time' | 'distance';
    original_size?: number;
    resolution?: 'low' | 'medium' | 'high';
}

// Strava Streams 完整紀錄
export interface StravaStreams {
    id: string;
    activity_id: number;
    streams: StreamData[];
    ftp?: number; // Snapshot FTP at the time of activity
    max_heartrate?: number;
    strava_zones?: StravaZoneBucket[]; // Raw Strava Zone Data
    created_at: string;
    updated_at: string;
}

// 功率區間定義
export interface PowerZone {
    zone: number;
    name: string;
    minPower: number;
    maxPower: number;
    color: string;
}

// 功率區間分析結果
export interface PowerZoneAnalysis {
    zone: number;
    name: string;
    timeInZone: number; // 秒
    percentageTime: number;
    avgPower: number;
    color: string;
}

// 心率區間分析結果
export interface HRZoneAnalysis {
    zone: number;
    name: string;
    timeInZone: number;
    percentageTime: number;
    avgHR: number;
    color: string;
}

// 訓練負荷摘要
export interface TrainingLoadSummary {
    np: number; // Normalized Power
    avgPower: number; // Average Power
    maxPower: number; // Max Power
    if: number; // Intensity Factor (NP / FTP)
    tss: number; // Training Stress Score
    vi: number; // Variability Index (NP / Avg Power)
    duration: number; // 總時間（秒）
    kilojoules: number; // 總功（千焦耳）
}

// 活動功率分析完整結果
export interface ActivityPowerAnalysis {
    activityId: number;
    activityName: string;
    date: string;
    ftp: number;
    max_heartrate?: number;
    stravaZones?: StravaZoneBucket[]; // Raw Strava Zone Data
    trainingLoad: TrainingLoadSummary;
    powerZones: PowerZoneAnalysis[];
    hrZones?: HRZoneAnalysis[];
    // 時序數據（用於圖表）
    timeSeriesData?: {
        time: number[];
        watts: number[];
        heartrate?: number[];
        cadence?: number[];
        velocity?: number[];
        grade?: number[];
        altitude?: number[];
        temp?: number[];
    };
}

// 選手功率分析總覽
export interface AthletePowerProfile {
    athleteId: number;
    athleteName: string;
    ftp: number;
    maxHR?: number;
    weeklyTSS: number;
    monthlyTSS: number;
    ctl: number;
    atl: number;
    tsb: number;
    recentActivities: ActivityPowerAnalysis[];
}

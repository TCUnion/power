import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

export const TSBIndicator: React.FC<{ tsb: number }> = ({ tsb }) => {
    if (tsb > 25) {
        return (
            <div className="flex items-center gap-1 text-blue-400">
                <TrendingUp className="w-4 h-4" />
                <span>過度恢復</span>
            </div>
        );
    } else if (tsb > 5) {
        return (
            <div className="flex items-center gap-1 text-green-400">
                <TrendingUp className="w-4 h-4" />
                <span>狀態良好</span>
            </div>
        );
    } else if (tsb > -10) {
        return (
            <div className="flex items-center gap-1 text-yellow-400">
                <Minus className="w-4 h-4" />
                <span>適度疲勞</span>
            </div>
        );
    } else if (tsb > -30) {
        return (
            <div className="flex items-center gap-1 text-orange-400">
                <TrendingDown className="w-4 h-4" />
                <span>累積疲勞</span>
            </div>
        );
    } else {
        return (
            <div className="flex items-center gap-1 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>過度訓練風險</span>
            </div>
        );
    }
};

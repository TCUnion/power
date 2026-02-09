import React from 'react';
import type { HRZoneAnalysis } from '../../../types';

interface HRZoneChartProps {
    zones: HRZoneAnalysis[];
    totalTime: number;
}

const HRZoneChart: React.FC<HRZoneChartProps> = ({ zones, totalTime }) => {
... [CONTENT OF HRZoneChart.tsx] ...

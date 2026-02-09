import React from 'react';
import type { PowerZoneAnalysis } from '../../../types';

interface PowerZoneChartProps {
    zones: PowerZoneAnalysis[];
    totalTime: number;
}

const PowerZoneChart: React.FC<PowerZoneChartProps> = ({ zones, totalTime }) => {
... [CONTENT OF PowerZoneChart.tsx] ...

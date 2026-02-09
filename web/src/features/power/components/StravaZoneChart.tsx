import React from 'react';

interface StravaZoneChartProps {
    title: string;
    zones: any[];
    type: 'power' | 'heartrate';
}

const StravaZoneChart: React.FC<StravaZoneChartProps> = ({ title, zones, type }) => {
... [CONTENT OF StravaZoneChart.tsx] ...

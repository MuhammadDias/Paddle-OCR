import React from 'react';
import { Layers, CheckCircle2, Clock, Cpu, Maximize } from 'lucide-react';
import type { Stats } from '../services/api';

interface StatsCardProps {
  stats: Stats;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Total Text Region',
      value: stats.total_regions,
      icon: <Layers className="w-5 h-5 text-indigo-500" />,
      unit: 'blok teks',
    },
    {
      title: 'Average Confidence',
      value: `${stats.average_confidence}%`,
      icon: <CheckCircle2 className="w-5 h-5 text-indigo-500" />,
      unit: 'akurasi',
    },
    {
      title: 'Processing Time',
      value: `${stats.processing_time}s`,
      icon: <Clock className="w-5 h-5 text-indigo-500" />,
      unit: 'kecepatan',
    },
    {
      title: 'Device Backend',
      value: stats.device,
      icon: <Cpu className="w-5 h-5 text-indigo-500" />,
      unit: 'akselerasi',
    },
    {
      title: 'Resolusi Gambar',
      value: stats.resolution,
      icon: <Maximize className="w-5 h-5 text-indigo-500" />,
      unit: 'dimensi piksel',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 w-full">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`flex flex-col gap-2 p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/50 hover:shadow-neo-btn-hover transition-all duration-300 ${
            idx === 4 ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neo-muted">
              {card.title}
            </span>
            <div className="w-8 h-8 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center border border-white/40">
              {card.icon}
            </div>
          </div>
          <div className="flex flex-col mt-1">
            <span className="text-lg font-bold text-neo-text truncate">
              {card.value}
            </span>
            <span className="text-[9px] text-neo-muted">
              {card.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

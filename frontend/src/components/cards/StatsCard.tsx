import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  onClick?: () => void;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-[#5B6CFF]',   text: 'text-[#5B6CFF]' },
  green:  { bg: 'bg-green-50',  icon: 'bg-[#3FAF7D]',   text: 'text-[#3FAF7D]' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-500',  text: 'text-purple-600' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-500',  text: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-500',     text: 'text-red-600' },
};

const StatsCard: React.FC<StatsCardProps> = ({
  title, value, subtitle, icon: Icon, color, onClick, trend, trendValue
}) => {
  const colors = colorMap[color];
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl p-5 border border-gray-100 transition-all',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trendValue && (
            <p className={cn(
              'text-xs font-medium mt-2',
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
            )}>
              {trendValue}
            </p>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', colors.icon)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

export default StatsCard;

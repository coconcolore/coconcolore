import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <Card className={cn("relative overflow-hidden p-6 group hover:shadow-lg transition-all duration-300", className)}>
      <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-6 -translate-y-6 bg-primary/5 rounded-full group-hover:scale-110 transition-transform duration-500" />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2 font-display">{value}</p>
          {trend && (
            <p className="text-xs text-primary font-medium mt-2">{trend}</p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}
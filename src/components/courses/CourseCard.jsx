import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Link2, Check } from 'lucide-react';

const categoryLabels = {
  malerei: 'Malerei',
  zeichnung: 'Zeichnung',
  fotografie: 'Fotografie',
  skulptur: 'Skulptur',
  digitale_kunst: 'Digitale Kunst',
  musik: 'Musik',
  tanz: 'Tanz',
  sonstiges: 'Sonstiges',
};

const statusLabels = {
  entwurf: 'Entwurf',
  ausstehend_freigabe: 'Wartet auf Freigabe',
  freigegeben_intern: 'Intern freigegeben',
  veroeffentlicht: 'Veröffentlicht',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
};

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  ausstehend_freigabe: 'bg-amber-100 text-amber-700',
  freigegeben_intern: 'bg-blue-100 text-blue-700',
  veroeffentlicht: 'bg-primary/10 text-primary',
  abgelehnt: 'bg-red-100 text-red-700',
  archiviert: 'bg-destructive/10 text-destructive',
};

export default function CourseCard({ course, enrollmentCount = 0, linkTo }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/kurs/${course.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1">
    <Link to={linkTo || `/courses/${course.id}`}>
      <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {course.image_url ? (
            <img 
              src={course.image_url} 
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-4xl font-display font-bold text-primary/30">
                {course.title?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute top-3 right-3">
            <Badge className={statusColors[course.status]}>
              {statusLabels[course.status]}
            </Badge>
          </div>
        </div>
        <div className="p-5">
          {course.category && (
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
              {categoryLabels[course.category]}
            </p>
          )}
          <h3 className="font-display text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{course.description}</p>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {course.duration_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {course.duration_hours}h
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {enrollmentCount}
              </span>
            </div>
            <span className="text-lg font-bold text-primary">
              {course.price?.toFixed(2)} €
            </span>
          </div>
        </div>
      </Card>
    </Link>
    {course.status === 'veroeffentlicht' && (
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors self-start px-1 py-0.5"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? 'Link kopiert!' : 'Buchungslink kopieren'}
      </button>
    )}
    </div>
  );
}
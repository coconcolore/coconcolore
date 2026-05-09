import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, Instagram, ArrowLeft, BookOpen } from 'lucide-react';
import CourseCard from '@/components/courses/CourseCard';
import { useTranslation } from 'react-i18next';

export default function ArtistPublicProfile() {
  const { id } = useParams();
  const { t } = useTranslation();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['artist-profile', id],
    queryFn: () => api.entities.ArtistProfile.filter({ id }),
  });
  const artist = profiles[0];

  const { data: courses = [] } = useQuery({
    queryKey: ['artist-courses', artist?.user_email],
    queryFn: () => api.entities.Course.filter({ artist_email: artist.user_email, status: 'veroeffentlicht' }),
    enabled: !!artist?.user_email,
  });

  if (isLoading) return (
    <div className="min-h-screen p-8 space-y-4">
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32" />
    </div>
  );

  if (!artist) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h2 className="font-display text-2xl font-bold">{t('artistProfile.notFound')}</h2>
      <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />{t('common.back')}</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-br from-sidebar to-sidebar/80 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-white/10 mx-auto mb-4 ring-4 ring-primary/50">
            {artist.avatar_url ? (
              <img src={artist.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                {artist.display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="font-display text-4xl font-bold mb-3">{artist.display_name}</h1>
          {artist.bio && <p className="text-white/80 max-w-xl mx-auto leading-relaxed">{artist.bio}</p>}
          <div className="flex items-center justify-center gap-4 mt-5">
            {artist.website && (
              <a href={artist.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
                <Globe className="w-4 h-4" />{artist.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {artist.instagram && (
              <a href={`https://instagram.com/${artist.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
                <Instagram className="w-4 h-4" />{artist.instagram}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="font-display text-2xl font-semibold">{t('artistProfile.coursesBy', { name: artist.display_name })}</h2>
          <Badge variant="secondary">{courses.length}</Badge>
        </div>
        {courses.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">{t('artistProfile.noCourses')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

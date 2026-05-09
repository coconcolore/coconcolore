import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Link } from 'react-router-dom';
import { Plus, Search, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import CourseCard from '@/components/courses/CourseCard';
import { useTranslation } from 'react-i18next';

export default function Courses() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { t } = useTranslation();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  });

  const { data: allCourses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.entities.Course.list('-created_date'),
  });

  const isManager = user?.role === 'admin' || user?.role === 'kuenstler_manager';

  const courses = isManager
    ? allCourses
    : allCourses.filter(
        (c) =>
          (c.artist_email === user?.email || c.created_by === user?.email) &&
          c.event_date != null,
      );

  const hasApprovedProposal =
    isManager ||
    allCourses.some(
      (c) =>
        (c.artist_email === user?.email || c.created_by === user?.email) &&
        (c.status === 'freigegeben_intern' || c.status === 'veroeffentlicht'),
    );

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.entities.Booking.list(),
  });

  const getBookingCount = (courseId) =>
    bookings.filter(b => b.course_id === courseId && b.payment_status === 'bezahlt').length;
  const getPendingCount = (courseId) =>
    bookings.filter(b => b.course_id === courseId && b.payment_status === 'ausstehend').length;

  const filtered = courses.filter(c => {
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t('courses.title')}</h1>
          <p className="text-muted-foreground mt-1">{courses.length} {t('courses.total')}</p>
        </div>
        {hasApprovedProposal ? (
          <Link to="/courses/new">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              {t('courses.planDate')}
            </Button>
          </Link>
        ) : user?.role === 'kuenstler' ? (
          <Link to="/profil">
            <Button variant="outline" className="gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              {t('courses.propose')}
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('courses.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('courses.statusLabel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('courses.allStatuses')}</SelectItem>
            <SelectItem value="entwurf">{t('courses.status.entwurf')}</SelectItem>
            <SelectItem value="ausstehend_freigabe">{t('courses.status.ausstehend_freigabe')}</SelectItem>
            <SelectItem value="freigegeben_intern">{t('courses.status.freigegeben_intern')}</SelectItem>
            <SelectItem value="veroeffentlicht">{t('courses.status.veroeffentlicht')}</SelectItem>
            <SelectItem value="abgelehnt">{t('courses.status.abgelehnt')}</SelectItem>
            <SelectItem value="archiviert">{t('courses.status.archiviert')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t('courses.categoryLabel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('courses.allCategories')}</SelectItem>
            <SelectItem value="malerei">{t('courses.category.malerei')}</SelectItem>
            <SelectItem value="zeichnung">{t('courses.category.zeichnung')}</SelectItem>
            <SelectItem value="fotografie">{t('courses.category.fotografie')}</SelectItem>
            <SelectItem value="skulptur">{t('courses.category.skulptur')}</SelectItem>
            <SelectItem value="digitale_kunst">{t('courses.category.digitale_kunst')}</SelectItem>
            <SelectItem value="musik">{t('courses.category.musik')}</SelectItem>
            <SelectItem value="tanz">{t('courses.category.tanz')}</SelectItem>
            <SelectItem value="sonstiges">{t('courses.category.sonstiges')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/50 rounded-2xl">
          <p className="text-muted-foreground">{t('courses.notFound')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              enrollmentCount={getBookingCount(course.id)}
              pendingCount={getPendingCount(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

export default function Courses() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  });

  const { data: allCourses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.entities.Course.list('-created_date'),
  });

  const isManager = user?.role === 'admin' || user?.role === 'kuenstler_manager';

  // Admins/managers see all; artists only their own scheduled courses (with event_date)
  const courses = isManager
    ? allCourses
    : allCourses.filter(
        (c) =>
          (c.artist_email === user?.email || c.created_by === user?.email) &&
          c.event_date != null,
      );

  // For artists: check if they have approved proposals to unlock "Neuer Kurs"
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
    bookings.filter(b => b.course_id === courseId && b.payment_status !== 'erstattet').length;

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
          <h1 className="font-display text-3xl md:text-4xl font-bold">Kurse</h1>
          <p className="text-muted-foreground mt-1">{courses.length} Kurse insgesamt</p>
        </div>
        {hasApprovedProposal ? (
          <Link to="/courses/new">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Kurstermin planen
            </Button>
          </Link>
        ) : user?.role === 'kuenstler' ? (
          <Link to="/profil">
            <Button variant="outline" className="gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Kurs vorschlagen
            </Button>
          </Link>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Kurse durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="entwurf">Entwurf</SelectItem>
            <SelectItem value="ausstehend_freigabe">Wartet auf Freigabe</SelectItem>
            <SelectItem value="freigegeben_intern">Intern freigegeben</SelectItem>
            <SelectItem value="veroeffentlicht">Veröffentlicht</SelectItem>
            <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
            <SelectItem value="archiviert">Archiviert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            <SelectItem value="malerei">Malerei</SelectItem>
            <SelectItem value="zeichnung">Zeichnung</SelectItem>
            <SelectItem value="fotografie">Fotografie</SelectItem>
            <SelectItem value="skulptur">Skulptur</SelectItem>
            <SelectItem value="digitale_kunst">Digitale Kunst</SelectItem>
            <SelectItem value="musik">Musik</SelectItem>
            <SelectItem value="tanz">Tanz</SelectItem>
            <SelectItem value="sonstiges">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/50 rounded-2xl">
          <p className="text-muted-foreground">Keine Kurse gefunden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(course => (
            <CourseCard 
              key={course.id} 
              course={course} 
              enrollmentCount={getBookingCount(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
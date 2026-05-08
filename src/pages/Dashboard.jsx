import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { BookOpen, Users, FileText, Euro, ChevronRight, Plus } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import CourseCard from '@/components/courses/CourseCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.entities.Course.list('-created_date'),
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.entities.Booking.list(),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.entities.Invoice.list('-created_date'),
  });

  const isLoading = coursesLoading || bookingsLoading || invoicesLoading;

  const publishedCourses = courses.filter(c => c.status === 'veroeffentlicht');
  const totalRevenue = bookings
    .filter(b => b.payment_status === 'bezahlt')
    .reduce((sum, b) => sum + (b.amount_total || 0), 0);

  const getBookingCount = (courseId) => 
    bookings.filter(b => b.course_id === courseId && b.payment_status !== 'erstattet').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Willkommen zurück in deinem KursStudio</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard title="Kurse gesamt" value={courses.length} icon={BookOpen} />
            <StatCard title="Veröffentlicht" value={publishedCourses.length} icon={BookOpen} />
            <StatCard title="Buchungen" value={bookings.filter(b => b.payment_status !== 'erstattet').length} icon={Users} />
            <StatCard title="Einnahmen" value={`${totalRevenue.toFixed(2)} €`} icon={Euro} />
          </>
        )}
      </div>

      {/* Recent Courses */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold">Neueste Kurse</h2>
          <Link to="/courses">
            <Button variant="ghost" className="text-primary">Alle anzeigen <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 bg-muted/50 rounded-2xl">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold mb-2">Noch keine Kurse</h3>
            <p className="text-muted-foreground mb-6">Erstelle deinen ersten Kurs und starte durch!</p>
            <Link to="/courses/new">
              <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Ersten Kurs erstellen</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.slice(0, 3).map(course => (
              <CourseCard 
                key={course.id} 
                course={course} 
                enrollmentCount={getBookingCount(course.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
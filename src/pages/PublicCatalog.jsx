import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Palette } from 'lucide-react';
import CourseCard from '@/components/courses/CourseCard';

export default function PublicCatalog() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['public-courses'],
    queryFn: () => api.entities.Course.filter({ status: 'veroeffentlicht' }, '-created_date'),
  });

  const filtered = courses.filter(c => {
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || c.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kurse suchen..." className="pl-10" />
          </div>
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Keine Kurse gefunden</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(course => <CourseCard key={course.id} course={course} linkTo={`/kurs/${course.id}`} />)}
          </div>
        )}
      </div>
    </div>
  );
}
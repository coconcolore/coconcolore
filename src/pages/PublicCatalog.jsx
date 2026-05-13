import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import CourseCard from '@/components/courses/CourseCard';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { pageContainer, fadeUp } from '@/lib/motion';

import Footer from '@/components/Footer';

export default function PublicCatalog() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { t } = useTranslation();

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
    <motion.div className="min-h-screen bg-background flex flex-col" variants={pageContainer} initial="hidden" animate="show">
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-12">
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t('catalog.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('catalog.subtitle')}</p>
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('catalog.searchPlaceholder')} className="pl-10" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t('courses.categoryLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('catalog.allCategories')}</SelectItem>
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
        </motion.div>

        <motion.div variants={fadeUp}>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">{t('catalog.notFound')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(course => <CourseCard key={course.id} course={course} linkTo={`/kurs/${course.id}`} />)}
          </div>
        )}
        </motion.div>
      </div>
      <Footer />
    </motion.div>
  );
}

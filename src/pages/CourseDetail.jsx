import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { pageContainer, fadeUp } from '@/lib/motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Plus, GripVertical, Trash2,
  Eye, Pencil, Globe, Archive, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';

export default function CourseDetail() {
  const { id: routeCourseId } = useParams();
  const courseId = routeCourseId ? routeCourseId.replace(/\/+$/, '') : '';
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    api.auth.me().then(setUser).catch(() => {});
  }, []);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: '', content: '', video_url: '', is_free_preview: false });

  const statusLabels = {
    entwurf: t('courses.status.entwurf'),
    ausstehend_freigabe: t('courses.status.ausstehend_freigabe'),
    freigegeben_intern: t('courses.status.freigegeben_intern'),
    veroeffentlicht: t('courses.status.veroeffentlicht'),
    abgelehnt: t('courses.status.abgelehnt'),
    archiviert: t('courses.status.archiviert'),
  };

  const statusColors = {
    entwurf: 'bg-muted text-muted-foreground',
    ausstehend_freigabe: 'bg-amber-100 text-amber-700',
    freigegeben_intern: 'bg-blue-100 text-blue-700',
    veroeffentlicht: 'bg-primary/10 text-primary',
    abgelehnt: 'bg-red-100 text-red-700',
    archiviert: 'bg-destructive/10 text-destructive'
  };

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const courses = await api.entities.Course.filter({ id: courseId });
      return courses[0];
    },
    enabled: !!courseId,
  });

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => api.entities.Lesson.filter({ course_id: courseId }, 'order'),
    enabled: !!courseId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', courseId],
    queryFn: () => api.entities.Booking.filter({ course_id: courseId }),
    enabled: !!courseId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, admin_notes }) => {
      const payload = { status };
      if (typeof admin_notes !== 'undefined') {
        payload.admin_notes = admin_notes;
      }
      return api.entities.Course.update(courseId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success(t('courseDetail.statusUpdated'));
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: (data) => api.entities.Lesson.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
      setLessonDialog(false);
      setNewLesson({ title: '', content: '', video_url: '', is_free_preview: false });
      toast.success(t('courseDetail.lessonAdded'));
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (id) => api.entities.Lesson.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
      toast.success(t('courseDetail.lessonDeleted'));
    },
  });

  const handleCreateLesson = (e) => {
    e.preventDefault();
    createLessonMutation.mutate({
      ...newLesson,
      course_id: courseId,
      order: lessons.length + 1,
    });
  };

  if (courseLoading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>;
  }

  if (!course) {
    return <div className="text-center py-16"><p className="text-muted-foreground">{t('courseDetail.notFound')}</p></div>;
  }

  return (
    <motion.div className="space-y-8" variants={pageContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/courses">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-3xl font-bold">{course.title}</h1>
              <Badge className={statusColors[course.status]}>{statusLabels[course.status]}</Badge>
            </div>
            <p className="text-muted-foreground">{course.description}</p>
            <p className="text-lg font-bold text-primary mt-2">
              {course.price?.toFixed(2)} € · {bookings.filter(b => b.payment_status === 'bezahlt').length} {t('courseDetail.bookingsCount')}
              {bookings.filter(b => b.payment_status === 'ausstehend').length > 0 && (
                <span className="text-sm font-normal text-amber-600 ml-2">
                  · {bookings.filter(b => b.payment_status === 'ausstehend').length} {t('courseDetail.pendingPayments')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(user?.role === 'kuenstler' || user?.role === 'kuenstler_manager' || user?.role === 'admin') && (
            <a href={`/kurs/${courseId}?preview=true`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />{t('courseDetail.preview')}
              </Button>
            </a>
          )}
          {user?.role === 'kuenstler' && (course.status === 'entwurf' || course.status === 'abgelehnt') && (
            <Button onClick={() => updateStatusMutation.mutate({ status: 'ausstehend_freigabe' })} className="bg-primary hover:bg-primary/90">
              <Globe className="w-4 h-4 mr-2" />{t('courseDetail.submitForApproval')}
            </Button>
          )}
          {(user?.role === 'kuenstler_manager' || user?.role === 'admin') && course.status === 'ausstehend_freigabe' && (
            <Button onClick={() => updateStatusMutation.mutate({ status: 'freigegeben_intern' })} className="bg-primary hover:bg-primary/90">
              <CheckCircle className="w-4 h-4 mr-2" />{t('courseDetail.approveInternally')}
            </Button>
          )}
          {(user?.role === 'kuenstler_manager' || user?.role === 'admin') && course.status === 'ausstehend_freigabe' && (
            <Button
              variant="outline"
              onClick={() => {
                const note = window.prompt(t('courseDetail.rejectPrompt'));
                if (!note || !note.trim()) {
                  toast.error(t('courseDetail.rejectEmpty'));
                  return;
                }
                updateStatusMutation.mutate({ status: 'abgelehnt', admin_notes: note.trim() });
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />{t('courseDetail.reject')}
            </Button>
          )}
          {(user?.role === 'kuenstler_manager' || user?.role === 'admin') && course.status === 'freigegeben_intern' && (
            <Button onClick={() => updateStatusMutation.mutate({ status: 'veroeffentlicht' })} className="bg-primary hover:bg-primary/90">
              <Globe className="w-4 h-4 mr-2" />{t('courseDetail.publish')}
            </Button>
          )}
          {(user?.role === 'kuenstler_manager' || user?.role === 'admin') && course.status === 'veroeffentlicht' && (
            <Button variant="outline" onClick={() => updateStatusMutation.mutate({ status: 'archiviert' })}>
              <Archive className="w-4 h-4 mr-2" />{t('courseDetail.archive')}
            </Button>
          )}
        </div>
      </motion.div>

      {course.status === 'abgelehnt' && course.admin_notes && (
        <motion.div variants={fadeUp}>
        <Card className="p-4 border border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-800 mb-1">{t('courseDetail.feedbackTitle')}</h3>
          <p className="text-sm text-red-700 whitespace-pre-wrap">{course.admin_notes}</p>
        </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold">{t('courseDetail.lessons', { count: lessons.length })}</h2>
          <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />{t('courseDetail.addLesson')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{t('courseDetail.newLesson')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLesson} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('courseDetail.lessonTitle')}</Label>
                  <Input value={newLesson.title} onChange={(e) => setNewLesson(p => ({ ...p, title: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('courseDetail.lessonContent')}</Label>
                  <Textarea value={newLesson.content} onChange={(e) => setNewLesson(p => ({ ...p, content: e.target.value }))} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>{t('courseDetail.lessonVideoUrl')}</Label>
                  <Input value={newLesson.video_url} onChange={(e) => setNewLesson(p => ({ ...p, video_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={newLesson.is_free_preview} onCheckedChange={(c) => setNewLesson(p => ({ ...p, is_free_preview: c }))} />
                  <Label>{t('courseDetail.freePreview')}</Label>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setLessonDialog(false)}>{t('common.cancel')}</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={createLessonMutation.isPending}>
                    {createLessonMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('common.create')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {lessonsLoading ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t('courseDetail.noLessons')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson, idx) => (
              <div key={lesson.id} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
                <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                <span className="text-sm font-medium text-muted-foreground w-8">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{lesson.title}</p>
                  {lesson.is_free_preview && <Badge variant="outline" className="mt-1 text-xs">{t('courseDetail.lessonPreviewBadge')}</Badge>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => deleteLessonMutation.mutate(lesson.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      </motion.div>
    </motion.div>
  );
}

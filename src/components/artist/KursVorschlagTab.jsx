import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, X, ImagePlus, Lock, Calendar, Clock, MapPin, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  ausstehend_freigabe: 'bg-amber-100 text-amber-700',
  freigegeben_intern: 'bg-blue-100 text-blue-700',
  veroeffentlicht: 'bg-primary/10 text-primary',
  abgelehnt: 'bg-red-100 text-red-700',
  archiviert: 'bg-destructive/10 text-destructive',
};

const emptyForm = {
  title: '',
  description: '',
  price: '',
  min_participants: '',
  max_participants: '',
  images: [],
};

export default function KursVorschlagTab({ user, existingProfile, profileComplete }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

  const statusLabels = {
    entwurf: t('courses.status.entwurf'),
    ausstehend_freigabe: t('courses.status.ausstehend_freigabe'),
    freigegeben_intern: t('courses.status.freigegeben_intern'),
    veroeffentlicht: t('courses.status.veroeffentlicht'),
    abgelehnt: t('courses.status.abgelehnt'),
    archiviert: t('courses.status.archiviert'),
  };

  const { data: myCourses = [], isLoading } = useQuery({
    queryKey: ['my-suggested-courses', user?.email],
    queryFn: () => api.entities.Course.filter({ artist_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: allSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['calendar-slots-free'],
    queryFn: () => api.entities.CalendarSlot.list('start_datetime', 500),
  });

  const now = new Date();
  const freeSlots = allSlots.filter(
    s => s.status === 'frei' && new Date(s.start_datetime) >= now
  );

  const submitMutation = useMutation({
    mutationFn: async ({ courseData, slotId }) => {
      const course = await api.entities.Course.create(courseData);
      await api.entities.CalendarSlot.update(slotId, {
        status: 'gebucht',
        booked_by_email: user.email,
        booked_by_name: existingProfile?.display_name || user.full_name || user.email,
      });
      return course;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-suggested-courses', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['calendar-slots-free'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
      setForm(emptyForm);
      setSelectedSlot(null);
      setSubmitFeedback({ type: 'success', message: t('proposal.successMessage') });
      toast.success(t('proposal.toastSuccess'));
    },
    onError: (error) => {
      const message = error?.message || t('proposal.toastSuccess');
      setSubmitFeedback({ type: 'error', message });
      toast.error(message);
    },
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.images.length + files.length > 10) {
      return toast.error(t('proposal.errorMaxImages'));
    }
    for (let i = 0; i < files.length; i++) {
      const localUrl = URL.createObjectURL(files[i]);
      setForm(p => ({ ...p, images: [...p.images, localUrl] }));
      setUploadingIdx(i);
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file: files[i] });
        setForm(p => {
          const images = [...p.images];
          const idx = images.indexOf(localUrl);
          if (idx !== -1) images[idx] = file_url;
          return { ...p, images };
        });
      } catch {
        toast.error(`Fehler beim Hochladen von ${files[i].name}`);
        setForm(p => ({ ...p, images: p.images.filter(u => u !== localUrl) }));
      }
    }
    setUploadingIdx(null);
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setForm(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitFeedback(null);
    if (!selectedSlot) return toast.error('Bitte wähle einen Termin aus.');
    if (!form.title.trim()) return toast.error(t('proposal.errorTitle'));
    if (!form.price || parseFloat(form.price) <= 0) return toast.error(t('proposal.errorPrice'));
    if (form.images.length < 1) return toast.error(t('proposal.errorImage'));
    if (form.images.some(u => u.startsWith('blob:'))) return toast.error('Bitte warte bis alle Bilder hochgeladen sind.');

    submitMutation.mutate({
      courseData: {
        title: form.title.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        min_participants: form.min_participants ? parseInt(form.min_participants) : undefined,
        max_participants: form.max_participants ? parseInt(form.max_participants) : undefined,
        image_url: form.images[0],
        image_urls: form.images,
        artist_email: user.email,
        artist_name: existingProfile?.display_name || user.full_name || user.email,
        status: 'ausstehend_freigabe',
        event_date: selectedSlot.start_datetime,
        location: selectedSlot.location || '',
        room_id: selectedSlot.room_id || null,
      },
      slotId: selectedSlot.id,
    });
  };

  if (!existingProfile || !profileComplete) {
    const missing = [];
    if (!existingProfile?.display_name?.trim()) missing.push(t('artist.artistName').replace(' *', ''));
    if (!existingProfile?.phone?.trim()) missing.push(t('invoice.phone').replace(' *', ''));
    if (!existingProfile?.invoice_street?.trim()) missing.push(t('invoice.street'));
    if (!existingProfile?.invoice_zip?.trim()) missing.push(t('invoice.zip'));
    if (!existingProfile?.invoice_city?.trim()) missing.push(t('invoice.city'));

    return (
      <Card className="p-8 text-center space-y-4">
        <Lock className="w-10 h-10 text-muted-foreground/50 mx-auto" />
        <h3 className="font-semibold text-lg">{t('proposal.incompleteTitle')}</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">{t('proposal.incompleteDesc')}</p>
        {missing.length > 0 && (
          <div className="inline-flex flex-wrap justify-center gap-2 pt-1">
            {missing.map(f => (
              <span key={f} className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">{f}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2">{t('proposal.incompleteHint')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 border border-blue-200 bg-blue-50">
        <h4 className="font-semibold text-blue-900 mb-1">{t('proposal.workflowTitle')}</h4>
        <p className="text-sm text-blue-800">{t('proposal.workflowDesc')}</p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-5">{t('proposal.formTitle')}</h3>

        {submitMutation.isPending && (
          <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('proposal.saving')}
          </div>
        )}

        {submitFeedback && !submitMutation.isPending && (
          <div className={`mb-4 p-3 rounded-lg border text-sm ${submitFeedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {submitFeedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>{t('proposal.titleLabel')}</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t('proposal.titlePlaceholder')} required />
          </div>

          <div className="space-y-2">
            <Label>{t('proposal.description')}</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} placeholder={t('proposal.descPlaceholder')} />
          </div>

          <div className="space-y-2">
            <Label>{t('proposal.price')}</Label>
            <Input type="number" step="0.01" min="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="49.00" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('proposal.minParticipants')}</Label>
              <Input type="number" min="1" value={form.min_participants} onChange={e => setForm(p => ({ ...p, min_participants: e.target.value }))} placeholder="2" />
            </div>
            <div className="space-y-2">
              <Label>{t('proposal.maxParticipants')}</Label>
              <Input type="number" min="1" value={form.max_participants} onChange={e => setForm(p => ({ ...p, max_participants: e.target.value }))} placeholder="12" />
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t('proposal.images')}</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {form.images.map((url, idx) => {
                const isPending = url.startsWith('blob:');
                return (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {isPending ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    ) : (
                      <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        {t('proposal.imagesMain')}
                      </span>
                    )}
                  </div>
                );
              })}

              {form.images.length < 10 && uploadingIdx === null && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">{t('proposal.imagesAdd')}</span>
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('proposal.imagesCount', { count: form.images.length })}</p>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">💡 {t('proposal.imagesSlotHint')}</div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Termin auswählen *
            </Label>
            {selectedSlot && (
              <div className="p-3 bg-primary/5 border border-primary/30 rounded-xl flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy HH:mm', { locale: dateLocale })}
              </div>
            )}
            {loadingSlots ? (
              <div className="h-12 bg-muted rounded-xl animate-pulse" />
            ) : freeSlots.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                Aktuell keine freien Termine verfügbar.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {freeSlots.map(slot => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlot(selectedSlot?.id === slot.id ? null : slot)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedSlot?.id === slot.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/40 hover:bg-accent/50'
                    }`}
                  >
                    <p className="font-medium text-sm">{slot.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(slot.start_datetime), 'EEE, dd.MM.yyyy HH:mm', { locale: dateLocale })} –{' '}
                        {format(parseISO(slot.end_datetime), 'HH:mm')}
                      </span>
                      {slot.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{slot.location}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={submitMutation.isPending || !selectedSlot || freeSlots.length === 0}>
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {submitMutation.isPending ? t('proposal.submitting') : t('proposal.submit')}
          </Button>
        </form>
      </Card>

      {myCourses.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">{t('proposal.myCoursesTitle')} ({myCourses.length})</h3>
          <div className="space-y-3">
            {isLoading ? (
              <div className="h-16 bg-muted rounded-xl animate-pulse" />
            ) : myCourses.map(course => (
              <Card key={course.id} className="p-4">
                <div className="flex items-center gap-3">
                  {course.image_url && (
                    <img src={course.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{course.title}</p>
                    <p className="text-sm text-muted-foreground">{course.price?.toFixed(2)} €
                      {course.max_participants ? ` · ${t('proposal.participants', { count: course.max_participants })}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(course.created_date), 'dd. MMM yyyy', { locale: dateLocale })}
                    </p>
                  </div>
                  <Badge className={statusColors[course.status]}>
                    {statusLabels[course.status] || course.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

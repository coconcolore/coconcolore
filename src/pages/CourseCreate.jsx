import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, Loader2, Calendar, Clock, MapPin, ShieldCheck, X, BookOpen, CheckCircle, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from 'react-i18next';

function ArtistCourseCreate({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

  const { data: allProposals = [], isLoading: loadingProposals } = useQuery({
    queryKey: ['my-approved-proposals', user?.email],
    queryFn: () => api.entities.Course.filter({ artist_email: user?.email }),
    enabled: !!user?.email,
    select: (courses) =>
      courses.filter((c) => c.status === 'freigegeben_intern' || c.status === 'veroeffentlicht'),
  });

  const { data: allSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['calendar-slots-free'],
    queryFn: () => api.entities.CalendarSlot.list('start_datetime', 500),
  });

  React.useEffect(() => {
    if (allSlots.length > 0) {
      console.log('Available slots loaded:', allSlots.length, {
        firstSlot: allSlots[0],
        hasId: !!allSlots[0]?.id,
      });
    }
  }, [allSlots]);

  const now = new Date();
  const freeSlots = allSlots.filter(
    (s) => s.status === 'frei' && new Date(s.start_datetime) >= now,
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const course = await api.entities.Course.create({
        title: selectedProposal.title,
        description: selectedProposal.description,
        price: selectedProposal.price,
        image_url: selectedProposal.image_url,
        image_urls: selectedProposal.image_urls || [],
        category: selectedProposal.category,
        level: selectedProposal.level,
        duration_hours: selectedProposal.duration_hours,
        min_participants: selectedProposal.min_participants,
        max_participants: selectedProposal.max_participants,
        artist_email: user.email,
        artist_name: selectedProposal.artist_name || user.full_name || user.email,
        status: 'entwurf',
        event_date: selectedSlot.start_datetime,
        location: selectedSlot.location || '',
        room_id: selectedSlot.room_id || null,
      });
      await api.entities.CalendarSlot.update(selectedSlot.id, {
        status: 'gebucht',
        booked_by_email: user.email,
        booked_by_name: user.full_name || user.email,
      });
      return course;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-slots-free'] });
      queryClient.invalidateQueries({ queryKey: ['my-approved-proposals'] });
      toast.success(t('courseCreate.successCreate'));
      navigate(`/courses/${result.id}`);
    },
    onError: () => toast.error(t('courseCreate.errorCreate')),
  });

  const canSubmit = !!selectedProposal && !!selectedSlot;

  if (loadingProposals) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allProposals.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/courses">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="font-display text-3xl font-bold">{t('courseCreate.titleArtist')}</h1>
        </div>
        <Card className="p-8 text-center space-y-4">
          <Lightbulb className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="font-semibold text-lg">{t('courseCreate.noProposal')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('courseCreate.noProposalDesc').replace('<1>', '').replace('</1>', '')}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/profil">
              <Button variant="outline">{t('courseCreate.toProfile')}</Button>
            </Link>
            <Link to="/courses">
              <Button variant="ghost">{t('courseCreate.backToOverview')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/courses">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold">{t('courseCreate.titleArtist')}</h1>
          <p className="text-muted-foreground mt-1">{t('courseCreate.subtitleArtist')}</p>
        </div>
      </div>

      <Card className="p-6 space-y-6">

        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            {t('courseCreate.step1')}
          </Label>
          {selectedProposal && (
            <div className="p-3 bg-primary/5 border border-primary/30 rounded-xl flex items-center gap-2 text-sm text-primary font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {selectedProposal.title}
            </div>
          )}
          <div className="space-y-2">
            {allProposals.map((proposal) => (
              <button
                key={proposal.id}
                type="button"
                onClick={() => setSelectedProposal(selectedProposal?.id === proposal.id ? null : proposal)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedProposal?.id === proposal.id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                {proposal.image_url && (
                  <img
                    src={proposal.image_url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{proposal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {proposal.price?.toFixed(2)} €
                    {proposal.max_participants ? ` · ${t('courseCreate.maxTN', { count: proposal.max_participants })}` : ''}
                  </p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 shrink-0 text-xs">{t('courseCreate.approved')}</Badge>
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {t('courseCreate.step2')}
          </Label>
          {selectedSlot && (
            <div className="p-3 bg-primary/5 border border-primary/30 rounded-xl flex items-center gap-2 text-sm text-primary font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              ✓ {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy HH:mm', { locale: dateLocale })}
            </div>
          )}
          {loadingSlots ? (
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
          ) : freeSlots.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              {t('courseCreate.noFreeSlots')}
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {freeSlots.map((slot) => (
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
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
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
                    </div>
                    <Badge className="bg-primary/10 text-primary text-xs shrink-0 ml-2">{t('courseCreate.free')}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {canSubmit && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 space-y-1">
            <p className="font-medium">{t('courseCreate.summary')}</p>
            <p>{t('courseCreate.summaryCourseLine')} <strong>{selectedProposal.title}</strong></p>
            <p>
              {t('courseCreate.summaryTimeLine')}{' '}
              <strong>
                {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy, HH:mm', { locale: dateLocale })} –{' '}
                {format(parseISO(selectedSlot.end_datetime), 'HH:mm')}
              </strong>
            </p>
          </div>
        )}

        {!canSubmit && (selectedProposal || selectedSlot) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-1">
            {!selectedProposal && <p className="font-medium">{t('courseCreate.step1')} auswählen</p>}
            {!selectedSlot && <p className="font-medium">{t('courseCreate.step2')} auswählen</p>}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/courses">
            <Button type="button" variant="outline">
              <X className="w-4 h-4 mr-2" />{t('common.cancel')}
            </Button>
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="bg-primary hover:bg-primary/90"
            type="button"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4 mr-2" />
            )}
            {t('courseCreate.createDate')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ManagerCourseCreate({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    level: 'anfaenger',
    duration_hours: '',
    image_url: '',
    location: '',
    max_participants: '',
  });

  const { data: allSlots = [] } = useQuery({
    queryKey: ['calendar-slots-free'],
    queryFn: () => api.entities.CalendarSlot.list('start_datetime', 500),
  });

  const now = new Date();
  const freeSlots = allSlots.filter(
    (s) => s.status === 'frei' && new Date(s.start_datetime) >= now,
  );

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const course = await api.entities.Course.create(data);
      if (selectedSlot) {
        await api.entities.CalendarSlot.update(selectedSlot.id, {
          status: 'gebucht',
          booked_by_email: user?.email,
          booked_by_name: user?.full_name || user?.email,
        });
      }
      return course;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-slots-free'] });
      toast.success(t('courseCreate.draftSaved'));
      navigate(`/courses/${result.id}`);
    },
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    setFormData((prev) => ({ ...prev, image_url: file_url }));
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      toast.error(t('courseCreate.errorNoSlot'));
      return;
    }
    createMutation.mutate({
      ...formData,
      price: parseFloat(formData.price) || 0,
      duration_hours: parseFloat(formData.duration_hours) || undefined,
      max_participants: parseInt(formData.max_participants) || undefined,
      status: 'entwurf',
      artist_email: user?.email,
      artist_name: user?.full_name || user?.email,
      event_date: selectedSlot.start_datetime,
      location: formData.location || selectedSlot.location || '',
      room_id: selectedSlot.room_id || null,
    });
  };

  const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/courses">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold">{t('courseCreate.titleManager')}</h1>
          <p className="text-muted-foreground mt-1">{t('courseCreate.subtitleManager')}</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {t('courseCreate.selectSlot')}
            </Label>
            {freeSlots.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                {t('courseCreate.noSlotsManager')}
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {freeSlots.map((slot) => (
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
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{slot.title}</p>
                      <Badge className="bg-primary/10 text-primary text-xs">{t('courseCreate.free')}</Badge>
                    </div>
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
            {selectedSlot && (
              <p className="text-xs text-primary font-medium">
                {t('courseCreate.selectedSlotLabel')} {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy HH:mm', { locale: dateLocale })}
              </p>
            )}
          </div>

          <hr className="border-border" />

          <div>
            <Label>{t('courseCreate.coverImage')}</Label>
            <div className="mt-2">
              {formData.image_url ? (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                  <Button type="button" variant="secondary" size="sm" className="absolute bottom-3 right-3" onClick={() => update('image_url', '')}>
                    {t('courseCreate.change')}
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/50">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">{t('courseCreate.uploadImage')}</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{t('courseCreate.titleLabel')}</Label>
            <Input id="title" value={formData.title} onChange={(e) => update('title', e.target.value)} placeholder="z.B. Aquarellmalerei für Anfänger" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('courseCreate.description')}</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => update('description', e.target.value)} placeholder="Beschreibe deinen Kurs..." rows={4} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">{t('courseCreate.priceLabel')}</Label>
              <Input id="price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => update('price', e.target.value)} placeholder="49.99" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">{t('courseCreate.duration')}</Label>
              <Input id="duration" type="number" step="0.5" min="0" value={formData.duration_hours} onChange={(e) => update('duration_hours', e.target.value)} placeholder="z.B. 2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('courseCreate.category')}</Label>
              <Select value={formData.category} onValueChange={(v) => update('category', v)}>
                <SelectTrigger><SelectValue placeholder={t('courseCreate.chooseCategory')} /></SelectTrigger>
                <SelectContent>
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
            <div className="space-y-2">
              <Label>{t('courseCreate.level')}</Label>
              <Select value={formData.level} onValueChange={(v) => update('level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anfaenger">{t('courseCreate.levelAnfaenger')}</SelectItem>
                  <SelectItem value="fortgeschritten">{t('courseCreate.levelFortgeschritten')}</SelectItem>
                  <SelectItem value="profi">{t('courseCreate.levelProfi')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_participants">{t('courseCreate.maxParticipants')}</Label>
              <Input id="max_participants" type="number" min="1" value={formData.max_participants} onChange={(e) => update('max_participants', e.target.value)} placeholder="z.B. 15" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t('courseCreate.location')}</Label>
              <Input id="location" value={formData.location} onChange={(e) => update('location', e.target.value)} placeholder={selectedSlot?.location || 'Atelier, Adresse oder Link'} />
            </div>
          </div>

          <div className="p-4 bg-accent rounded-xl border border-primary/20 text-sm text-accent-foreground">
            ℹ️ {t('courseCreate.draftHint')}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link to="/courses">
              <Button type="button" variant="outline"><X className="w-4 h-4 mr-2" />{t('common.cancel')}</Button>
            </Link>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={createMutation.isPending || !selectedSlot}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
              {t('courseCreate.createCourse')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function CourseCreate() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin;
  const isArtist = user?.role === 'kuenstler' || isManager;

  if (!isArtist) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">{t('courseCreate.noAccess')}</h2>
        <p className="text-muted-foreground">{t('courseCreate.noAccessDesc')}</p>
      </div>
    );
  }

  if (isManager) {
    return <ManagerCourseCreate user={user} />;
  }

  return <ArtistCourseCreate user={user} />;
}

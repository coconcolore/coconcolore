import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Clock, Users, Calendar, MapPin, CheckCircle,
  ArrowLeft, CreditCard, Eye, Building2, ChevronLeft, ChevronRight, X, Grid2x2
} from 'lucide-react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import CheckoutDialog from '@/components/booking/CheckoutDialog';
import Footer from '@/components/Footer';
import { useTranslation } from 'react-i18next';

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  ausstehend_freigabe: 'bg-amber-100 text-amber-700',
  freigegeben_intern: 'bg-blue-100 text-blue-700',
  veroeffentlicht: 'bg-primary/10 text-primary',
  abgelehnt: 'bg-red-100 text-red-700',
  archiviert: 'bg-destructive/10 text-destructive',
};

export default function PublicCoursePage() {
  const { id } = useParams();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { t, i18n } = useTranslation();
  const urlParams = new URLSearchParams(window.location.search);
  const bookingStatus = urlParams.get('booking');
  const isPreview = urlParams.get('preview') === 'true';

  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

  const categoryLabels = {
    malerei: t('courses.category.malerei'),
    zeichnung: t('courses.category.zeichnung'),
    fotografie: t('courses.category.fotografie'),
    skulptur: t('courses.category.skulptur'),
    digitale_kunst: t('courses.category.digitale_kunst'),
    musik: t('courses.category.musik'),
    tanz: t('courses.category.tanz'),
    sonstiges: t('courses.category.sonstiges'),
  };

  const statusLabels = {
    entwurf: t('courses.status.entwurf'),
    ausstehend_freigabe: t('courses.status.ausstehend_freigabe'),
    freigegeben_intern: t('courses.status.freigegeben_intern'),
    veroeffentlicht: t('courses.status.veroeffentlicht'),
    abgelehnt: t('courses.status.abgelehnt'),
    archiviert: t('courses.status.archiviert'),
  };

  const levelLabels = {
    anfaenger: t('coursePage.level.anfaenger'),
    fortgeschritten: t('coursePage.level.fortgeschritten'),
    profi: t('coursePage.level.profi'),
  };

  useEffect(() => {
    api.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['public-course', id],
    queryFn: async () => {
      try {
        const result = await api.functions.invoke('getPublicCourse', { course_id: id });
        return result.data;
      } catch {
        const courses = await api.entities.Course.filter({ id });
        const fallbackCourse = courses?.[0];
        if (!fallbackCourse || fallbackCourse.status !== 'veroeffentlicht') {
          return { course: null, artistProfile: null, bookings: [], settings: [] };
        }
        const profiles = fallbackCourse.artist_email
          ? await api.entities.ArtistProfile.filter({ user_email: fallbackCourse.artist_email })
          : [];
        let settings = [];
        try { settings = await api.entities.PlatformSettings.list(); } catch { settings = []; }
        return { course: fallbackCourse, artistProfile: profiles?.[0] || null, bookings: [], settings: settings || [] };
      }
    },
    enabled: !!id,
  });

  const publicCourse = data?.course;
  const commission = data?.settings?.[0]?.commission_percent ?? 15;
  const publicBookings = data?.bookings || [];

  const { data: previewCourses = [], isLoading: previewLoading } = useQuery({
    queryKey: ['preview-course-direct', id],
    queryFn: () => api.entities.Course.filter({ id }),
    enabled: isPreview && !publicCourse && !isLoading && !!id,
  });
  const previewCourse = previewCourses[0] || null;

  const { data: previewProfiles = [] } = useQuery({
    queryKey: ['preview-artist-profile', previewCourse?.artist_email],
    queryFn: () => api.entities.ArtistProfile.filter({ user_email: previewCourse.artist_email }),
    enabled: !!previewCourse?.artist_email,
  });

  const course = publicCourse || (isPreview ? previewCourse : null);
  const artistProfile = data?.artistProfile || previewProfiles[0] || null;
  const bookings = publicBookings;

  const { data: roomData = [] } = useQuery({
    queryKey: ['room', course?.room_id],
    queryFn: () => api.entities.Room.filter({ id: course.room_id }),
    enabled: !!course?.room_id,
  });
  const room = roomData[0] || null;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const allImages = [...new Set([
    course?.image_url,
    ...(course?.image_urls || []),
    ...(room?.image_urls || []),
  ])].filter(Boolean);

  const openLightbox = (index = 0) => { setLightboxIndex(index); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);
  const prevImage = () => setLightboxIndex(i => (i - 1 + allImages.length) % allImages.length);
  const nextImage = () => setLightboxIndex(i => (i + 1) % allImages.length);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, allImages.length]);

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'kuenstler_manager';
  const isOwner = currentUser?.email === course?.artist_email;
  const hasPreviewAccess = isManagerOrAdmin || isOwner;

  const loading = isLoading || (isPreview && !publicCourse && previewLoading);

  if (loading) return (
    <div className="min-h-screen bg-background p-8">
      <Skeleton className="h-64 w-full mb-6 rounded-2xl" />
      <Skeleton className="h-8 w-96 mb-4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (isPreview && previewCourse && !hasPreviewAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h2 className="font-display text-2xl font-bold">{t('coursePage.noAccess')}</h2>
        <p className="text-muted-foreground">{t('coursePage.noAccessDesc')}</p>
        <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />{t('common.back')}</Button></Link>
      </div>
    );
  }

  if (!course) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <h2 className="font-display text-2xl font-bold">{t('coursePage.notFound')}</h2>
      <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />{t('common.back')}</Button></Link>
    </div>
  );

  const spotsLeft = course.max_participants
    ? course.max_participants - bookings.filter(b => b.payment_status === 'bezahlt').length
    : null;

  const isUnpublished = course.status !== 'veroeffentlicht';

  return (
    <div className="min-h-screen bg-background">
      {isPreview && (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4 shrink-0" />
          <span>
            {t('coursePage.previewMode')}{' '}
            <strong>{statusLabels[course.status] ?? course.status}</strong>
          </span>
          <Link to={`/courses/${id}`} className="underline ml-3 hover:no-underline">
            {t('coursePage.backToOverview')}
          </Link>
        </div>
      )}

      {/* Airbnb-style photo gallery */}
      <div className="relative bg-muted overflow-hidden">
        {allImages.length > 1 ? (
          <div className="hidden md:grid grid-cols-2 gap-2 h-[480px] p-2">
            <div
              className="relative overflow-hidden rounded-l-2xl cursor-pointer group"
              onClick={() => openLightbox(0)}
            >
              <img src={allImages[0]} alt={course.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div className="grid grid-cols-2 grid-rows-2 gap-2">
              {allImages.slice(1, 5).map((url, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden cursor-pointer group ${i === 1 ? 'rounded-tr-2xl' : i === 3 ? 'rounded-br-2xl' : ''}`}
                  onClick={() => openLightbox(i + 1)}
                >
                  <img src={url} alt={course.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {i === 3 && allImages.length > 5 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">+{allImages.length - 5}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : allImages.length === 1 ? (
          <div className="hidden md:block h-[480px] cursor-pointer" onClick={() => openLightbox(0)}>
            <img src={allImages[0]} alt={course.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="hidden md:block h-[480px] bg-gradient-to-br from-primary/30 to-primary/5" />
        )}

        {/* Mobile: single image with swipe hint */}
        <div className="md:hidden h-64 relative overflow-hidden cursor-pointer" onClick={() => allImages.length > 0 && openLightbox(0)}>
          {allImages.length > 0 ? (
            <img src={allImages[0]} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5" />
          )}
          {allImages.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              1 / {allImages.length}
            </div>
          )}
        </div>

        {/* Title overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 md:p-8 pointer-events-none">
          <div className="max-w-4xl mx-auto">
            {course.category && (
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                {categoryLabels[course.category]}
              </p>
            )}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-1">{course.title}</h1>
            <p className="text-white/80 text-sm">
              {levelLabels[course.level]}{course.duration_hours ? ` · ${course.duration_hours}h` : ''}
            </p>
          </div>
        </div>

        {/* "Alle Fotos anzeigen" button */}
        {allImages.length > 1 && (
          <button
            onClick={() => openLightbox(0)}
            className="absolute bottom-4 right-4 flex items-center gap-2 bg-white text-foreground text-sm font-semibold px-4 py-2 rounded-xl shadow-lg hover:bg-white/90 transition-colors border border-border pointer-events-auto"
          >
            <Grid2x2 className="w-4 h-4" />
            Alle Fotos anzeigen
          </button>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-white/70 text-sm">{lightboxIndex + 1} / {allImages.length}</span>
            <button onClick={closeLightbox} className="text-white hover:text-white/70 p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center px-4 overflow-hidden">
            <img
              src={allImages[lightboxIndex]}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg select-none"
            />
            {allImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 shrink-0 justify-center">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === lightboxIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-90'}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {bookingStatus === 'success' && (
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6">
          <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-xl text-primary">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">{t('coursePage.paymentSuccess')}</p>
              <p className="text-sm text-primary/80">{t('coursePage.paymentSuccessDesc')}</p>
            </div>
          </div>
        </div>
      )}
      {bookingStatus === 'cancelled' && (
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            {t('coursePage.paymentCancelled')}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {course.event_date && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <Calendar className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">{t('coursePage.date')}</p>
                  <p className="text-sm font-medium">{format(new Date(course.event_date), 'dd. MMM', { locale: dateLocale })}</p>
                </div>
              )}
              {(room || course.location) && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <MapPin className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">{t('coursePage.location')}</p>
                  <p className="text-sm font-medium truncate max-w-full">{room ? room.name : course.location}</p>
                </div>
              )}
              {course.duration_hours && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <Clock className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">{t('coursePage.duration')}</p>
                  <p className="text-sm font-medium">{course.duration_hours}h</p>
                </div>
              )}
              {spotsLeft !== null && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <Users className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">{t('coursePage.spotsLeft')}</p>
                  <p className="text-sm font-medium">{spotsLeft}</p>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold mb-3">{t('coursePage.aboutCourse')}</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{course.description}</p>
            </div>

            {room && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">{t('coursePage.room')}</h2>
                <Card className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{room.name}</p>
                      {room.address && (
                        <p className="text-sm text-muted-foreground mt-0.5">{room.address}</p>
                      )}
                      {room.description && (
                        <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {artistProfile && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">{t('coursePage.instructor')}</h2>
                <Card className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0">
                      {artistProfile.avatar_url ? (
                        <img src={artistProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xl text-muted-foreground">
                          {artistProfile.display_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <Link to={`/kuenstler/${artistProfile.id}`} className="font-display text-lg font-semibold hover:text-primary transition-colors">
                        {artistProfile.display_name}
                      </Link>
                      {artistProfile.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{artistProfile.bio}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <Card className="p-6 shadow-xl border-primary/10">
                <p className="font-display text-3xl font-bold text-primary mb-1">{course.price?.toFixed(2)} €</p>
                <p className="text-sm text-muted-foreground mb-5">{t('coursePage.vatIncl')}</p>

                {isPreview && isUnpublished ? (
                  <div className="space-y-3">
                    <Badge className={`w-full justify-center py-2 text-sm ${statusColors[course.status]}`}>
                      {statusLabels[course.status] ?? course.status}
                    </Badge>
                    <Button disabled className="w-full text-lg py-6">
                      <CreditCard className="w-5 h-5 mr-2" />{t('coursePage.bookingNotActive')}
                    </Button>
                  </div>
                ) : spotsLeft === 0 ? (
                  <Button disabled className="w-full">{t('coursePage.bookedOut')}</Button>
                ) : (
                  <>
                    {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && (
                      <p className="text-xs text-amber-600 font-medium mb-3">{t('coursePage.spotsWarning', { count: spotsLeft })}</p>
                    )}
                    <Button className="w-full bg-primary hover:bg-primary/90 text-lg py-6" onClick={() => setCheckoutOpen(true)}>
                      <CreditCard className="w-5 h-5 mr-2" />{t('coursePage.bookNow')}
                    </Button>
                    {checkoutOpen && (
                      <CheckoutDialog
                        course={course}
                        room={room}
                        commission={commission}
                        spotsLeft={spotsLeft}
                        onClose={() => setCheckoutOpen(false)}
                      />
                    )}
                  </>
                )}

                <ul className="mt-5 space-y-2">
                  {[
                    t('coursePage.confirmationEmail'),
                    t('coursePage.personalSupport'),
                    course.max_participants ? t('coursePage.maxParticipants', { count: course.max_participants }) : null,
                  ].filter(Boolean).map((text, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

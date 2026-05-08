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
  ArrowLeft, CreditCard, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import CheckoutDialog from '@/components/booking/CheckoutDialog';
import Footer from '@/components/Footer';

const categoryLabels = {
  malerei: 'Malerei', zeichnung: 'Zeichnung', fotografie: 'Fotografie',
  skulptur: 'Skulptur', digitale_kunst: 'Digitale Kunst',
  musik: 'Musik', tanz: 'Tanz', sonstiges: 'Sonstiges',
};
const levelLabels = { anfaenger: 'Anfänger', fortgeschritten: 'Fortgeschritten', profi: 'Profi' };

const statusLabels = {
  entwurf: 'Entwurf',
  ausstehend_freigabe: 'Wartet auf Freigabe',
  freigegeben_intern: 'Intern freigegeben',
  veroeffentlicht: 'Veröffentlicht',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
};
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
  const urlParams = new URLSearchParams(window.location.search);
  const bookingStatus = urlParams.get('booking');
  const isPreview = urlParams.get('preview') === 'true';

  useEffect(() => {
    api.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Public query via Edge Function (only returns published courses)
  const { data, isLoading } = useQuery({
    queryKey: ['public-course', id],
    queryFn: async () => {
      try {
        const result = await api.functions.invoke('getPublicCourse', { course_id: id });
        return result.data;
      } catch {
        // Fallback for local dev / CORS issues
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

  // Preview query: authenticated direct load for admins/managers/owners
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

  // Resolve what to display
  const course = publicCourse || (isPreview ? previewCourse : null);
  const artistProfile = data?.artistProfile || previewProfiles[0] || null;
  const bookings = publicBookings;

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

  // Preview mode but no permission
  if (isPreview && previewCourse && !hasPreviewAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h2 className="font-display text-2xl font-bold">Kein Zugriff</h2>
        <p className="text-muted-foreground">Diese Vorschau ist nur für den Künstler und Admins verfügbar.</p>
        <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button></Link>
      </div>
    );
  }

  if (!course) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <h2 className="font-display text-2xl font-bold">Kurs nicht gefunden</h2>
      <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button></Link>
    </div>
  );

  const spotsLeft = course.max_participants
    ? course.max_participants - bookings.filter(b => b.payment_status !== 'erstattet').length
    : null;

  const isUnpublished = course.status !== 'veroeffentlicht';

  return (
    <div className="min-h-screen bg-background">
      {/* Preview Banner */}
      {isPreview && (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4 shrink-0" />
          <span>
            Vorschau-Modus – Status:{' '}
            <strong>{statusLabels[course.status] ?? course.status}</strong>
          </span>
          <Link to={`/courses/${id}`} className="underline ml-3 hover:no-underline">
            ← Zurück zur Übersicht
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="relative h-72 md:h-96 overflow-hidden bg-muted">
        {course.image_url ? (
          <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            {course.category && (
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                {categoryLabels[course.category]}
              </p>
            )}
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-white/80 text-sm">
              {levelLabels[course.level]}{course.duration_hours ? ` · ${course.duration_hours}h` : ''}
            </p>
          </div>
        </div>
      </div>

      {bookingStatus === 'success' && (
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6">
          <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-xl text-primary">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Zahlung erfolgreich!</p>
              <p className="text-sm text-primary/80">Deine Buchung wurde bestätigt. Eine E-Mail ist unterwegs.</p>
            </div>
          </div>
        </div>
      )}
      {bookingStatus === 'cancelled' && (
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            Zahlung abgebrochen. Du kannst es jederzeit erneut versuchen.
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {course.event_date && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <Calendar className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Datum</p>
                  <p className="text-sm font-medium">{format(new Date(course.event_date), 'dd. MMM', { locale: de })}</p>
                </div>
              )}
              {course.location && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <MapPin className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Ort</p>
                  <p className="text-sm font-medium truncate max-w-full">{course.location}</p>
                </div>
              )}
              {course.duration_hours && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <Clock className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Dauer</p>
                  <p className="text-sm font-medium">{course.duration_hours}h</p>
                </div>
              )}
              {spotsLeft !== null && (
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl text-center">
                  <Users className="w-5 h-5 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Plätze frei</p>
                  <p className="text-sm font-medium">{spotsLeft}</p>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold mb-3">Über diesen Kurs</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{course.description}</p>
            </div>

            {artistProfile && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">Dein Kursleiter</h2>
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

          {/* Booking sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <Card className="p-6 shadow-xl border-primary/10">
                <p className="font-display text-3xl font-bold text-primary mb-1">{course.price?.toFixed(2)} €</p>
                <p className="text-sm text-muted-foreground mb-5">inkl. MwSt.</p>

                {isPreview && isUnpublished ? (
                  <div className="space-y-3">
                    <Badge className={`w-full justify-center py-2 text-sm ${statusColors[course.status]}`}>
                      {statusLabels[course.status] ?? course.status}
                    </Badge>
                    <Button disabled className="w-full text-lg py-6">
                      <CreditCard className="w-5 h-5 mr-2" />Buchung (noch nicht aktiv)
                    </Button>
                  </div>
                ) : spotsLeft === 0 ? (
                  <Button disabled className="w-full">Ausgebucht</Button>
                ) : (
                  <>
                    {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && (
                      <p className="text-xs text-amber-600 font-medium mb-3">⚡ Nur noch {spotsLeft} Plätze frei!</p>
                    )}
                    <Button className="w-full bg-primary hover:bg-primary/90 text-lg py-6" onClick={() => setCheckoutOpen(true)}>
                      <CreditCard className="w-5 h-5 mr-2" />Jetzt buchen
                    </Button>
                    {checkoutOpen && (
                      <CheckoutDialog
                        course={course}
                        commission={commission}
                        spotsLeft={spotsLeft}
                        onClose={() => setCheckoutOpen(false)}
                      />
                    )}
                  </>
                )}

                <ul className="mt-5 space-y-2">
                  {[
                    'Sofortige Buchungsbestätigung per E-Mail',
                    'Persönliche Betreuung',
                    course.max_participants ? `Max. ${course.max_participants} Teilnehmer` : null,
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

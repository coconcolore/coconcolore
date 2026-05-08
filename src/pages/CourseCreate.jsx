import React, { useState } from 'react';
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
import { de } from 'date-fns/locale';
import { useAuth } from '@/lib/AuthContext';

// ── Artist flow: pick approved proposal + free slot ──────────────────────────

function ArtistCourseCreate({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

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
        min_participants: selectedProposal.min_participants,
        max_participants: selectedProposal.max_participants,
        artist_email: user.email,
        artist_name: selectedProposal.artist_name || user.full_name || user.email,
        status: 'entwurf',
        event_date: selectedSlot.start_datetime,
        location: selectedSlot.location || '',
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
      toast.success('Kurstermin erfolgreich angelegt.');
      navigate(`/courses/${result.id}`);
    },
    onError: () => toast.error('Fehler beim Anlegen. Bitte versuche es erneut.'),
  });

  const canSubmit = selectedProposal && selectedSlot;

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
          <h1 className="font-display text-3xl font-bold">Kurstermin planen</h1>
        </div>
        <Card className="p-8 text-center space-y-4">
          <Lightbulb className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="font-semibold text-lg">Noch kein freigegebener Kurs</h2>
          <p className="text-muted-foreground text-sm">
            Du kannst erst einen Termin buchen, sobald mindestens ein Kursvorschlag intern freigegeben wurde.
            Schlage zuerst einen Kurs im Bereich <strong>Profil → Kurs vorschlagen</strong> vor.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/profil">
              <Button variant="outline">Zum Profil</Button>
            </Link>
            <Link to="/courses">
              <Button variant="ghost">Zurück zur Übersicht</Button>
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
          <h1 className="font-display text-3xl font-bold">Kurstermin planen</h1>
          <p className="text-muted-foreground mt-1">Wähle einen genehmigten Kurs und einen freien Zeitslot.</p>
        </div>
      </div>

      <Card className="p-6 space-y-6">

        {/* Step 1: Approved proposal */}
        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            Schritt 1 – Freigegebenen Kurs wählen
          </Label>
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
                    {proposal.max_participants ? ` · max. ${proposal.max_participants} TN` : ''}
                  </p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 shrink-0 text-xs">Freigegeben</Badge>
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* Step 2: Time slot */}
        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Schritt 2 – Zeitslot wählen
          </Label>
          {loadingSlots ? (
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
          ) : freeSlots.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              Keine freien Slots verfügbar. Bitte wende dich an einen Manager, um Slots freizugeben.
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
                    <Badge className="bg-primary/10 text-primary text-xs">Frei</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(slot.start_datetime), 'EEE, dd.MM.yyyy HH:mm', { locale: de })} –{' '}
                      {format(parseISO(slot.end_datetime), 'HH:mm')} Uhr
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
              ✓ {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy HH:mm', { locale: de })} Uhr
            </p>
          )}
        </div>

        {/* Summary */}
        {canSubmit && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 space-y-1">
            <p className="font-medium">Zusammenfassung</p>
            <p>Kurs: <strong>{selectedProposal.title}</strong></p>
            <p>
              Termin:{' '}
              <strong>
                {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy, HH:mm', { locale: de })} –{' '}
                {format(parseISO(selectedSlot.end_datetime), 'HH:mm')} Uhr
              </strong>
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/courses">
            <Button type="button" variant="outline">
              <X className="w-4 h-4 mr-2" />Abbrechen
            </Button>
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4 mr-2" />
            )}
            Kurstermin anlegen
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Manager / Admin flow: full form (unchanged) ───────────────────────────────

function ManagerCourseCreate({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
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
      toast.success('Kurs als Entwurf gespeichert.');
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
      toast.error('Bitte wähle einen freien Zeitslot aus dem Kalender.');
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
          <h1 className="font-display text-3xl font-bold">Neuer Kurs</h1>
          <p className="text-muted-foreground mt-1">Erstelle einen neuen Kurs</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Zeitslot wählen *
            </Label>
            {freeSlots.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                Keine freien Slots verfügbar.
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
                      <Badge className="bg-primary/10 text-primary text-xs">Frei</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(slot.start_datetime), 'EEE, dd.MM.yyyy HH:mm', { locale: de })} –{' '}
                        {format(parseISO(slot.end_datetime), 'HH:mm')} Uhr
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
                ✓ Ausgewählt: {format(parseISO(selectedSlot.start_datetime), 'EEEE, dd.MM.yyyy HH:mm', { locale: de })} Uhr
              </p>
            )}
          </div>

          <hr className="border-border" />

          <div>
            <Label>Titelbild</Label>
            <div className="mt-2">
              {formData.image_url ? (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                  <Button type="button" variant="secondary" size="sm" className="absolute bottom-3 right-3" onClick={() => update('image_url', '')}>
                    Ändern
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
                      <span className="text-sm text-muted-foreground">Bild hochladen</span>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input id="title" value={formData.title} onChange={(e) => update('title', e.target.value)} placeholder="z.B. Aquarellmalerei für Anfänger" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => update('description', e.target.value)} placeholder="Beschreibe deinen Kurs..." rows={4} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preis (€) *</Label>
              <Input id="price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => update('price', e.target.value)} placeholder="49.99" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Dauer (Stunden)</Label>
              <Input id="duration" type="number" step="0.5" min="0" value={formData.duration_hours} onChange={(e) => update('duration_hours', e.target.value)} placeholder="z.B. 2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={formData.category} onValueChange={(v) => update('category', v)}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
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
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={formData.level} onValueChange={(v) => update('level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anfaenger">Anfänger</SelectItem>
                  <SelectItem value="fortgeschritten">Fortgeschritten</SelectItem>
                  <SelectItem value="profi">Profi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_participants">Max. Teilnehmer</Label>
              <Input id="max_participants" type="number" min="1" value={formData.max_participants} onChange={(e) => update('max_participants', e.target.value)} placeholder="z.B. 15" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ort / Online-Link</Label>
              <Input id="location" value={formData.location} onChange={(e) => update('location', e.target.value)} placeholder={selectedSlot?.location || 'Atelier, Adresse oder Link'} />
            </div>
          </div>

          <div className="p-4 bg-accent rounded-xl border border-primary/20 text-sm text-accent-foreground">
            ℹ️ Dein Kurs wird zuerst als <strong>Entwurf</strong> gespeichert.
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link to="/courses">
              <Button type="button" variant="outline"><X className="w-4 h-4 mr-2" />Abbrechen</Button>
            </Link>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={createMutation.isPending || !selectedSlot}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
              Kurs erstellen
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function CourseCreate() {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin;
  const isArtist = user?.role === 'kuenstler' || isManager;

  if (!isArtist) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Kein Zugriff</h2>
        <p className="text-muted-foreground">Nur Künstler, Manager und Admins können Kurse erstellen.</p>
      </div>
    );
  }

  if (isManager) {
    return <ManagerCourseCreate user={user} />;
  }

  return <ArtistCourseCreate user={user} />;
}

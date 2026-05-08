import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, X, ImagePlus, CheckCircle, Clock, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  ausstehend_freigabe: 'bg-amber-100 text-amber-700',
  freigegeben_intern: 'bg-blue-100 text-blue-700',
  veroeffentlicht: 'bg-primary/10 text-primary',
  abgelehnt: 'bg-red-100 text-red-700',
  archiviert: 'bg-destructive/10 text-destructive',
};
const statusLabels = {
  entwurf: 'Entwurf',
  ausstehend_freigabe: 'Wartet auf Freigabe',
  freigegeben_intern: 'Intern freigegeben',
  veroeffentlicht: 'Veröffentlicht',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
};

const emptyForm = {
  title: '',
  description: '',
  price: '',
  min_participants: '',
  max_participants: '',
  images: [], // array of URLs
};

export default function KursVorschlagTab({ user, existingProfile, profileComplete }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  const { data: myCourses = [], isLoading } = useQuery({
    queryKey: ['my-suggested-courses', user?.email],
    queryFn: () => api.entities.Course.filter({ artist_email: user?.email }),
    enabled: !!user?.email,
  });

  const submitMutation = useMutation({
    mutationFn: (data) => api.entities.Course.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-suggested-courses', user?.email] });
      setForm(emptyForm);
      setSubmitFeedback({
        type: 'success',
        message: 'Dein Kursvorschlag wurde gespeichert und ist jetzt im Status "Wartet auf Freigabe".'
      });
      toast.success('Kurs eingereicht! Der Admin wird ihn prüfen.');
    },
    onError: (error) => {
      const message = error?.message || 'Fehler beim Einreichen. Bitte versuche es erneut.';
      setSubmitFeedback({ type: 'error', message });
      toast.error(message);
    },
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.images.length + files.length > 10) {
      return toast.error('Maximal 10 Bilder erlaubt.');
    }
    for (let i = 0; i < files.length; i++) {
      setUploadingIdx(form.images.length + i);
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file: files[i] });
        setForm(p => ({ ...p, images: [...p.images, file_url] }));
      } catch {
        toast.error(`Fehler beim Hochladen von ${files[i].name}`);
      }
    }
    setUploadingIdx(null);
  };

  const removeImage = (idx) => {
    setForm(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitFeedback(null);
    if (!form.title.trim()) return toast.error('Bitte einen Titel eingeben.');
    if (!form.price || parseFloat(form.price) <= 0) return toast.error('Bitte einen gültigen Preis eingeben.');
    if (form.images.length < 1) return toast.error('Bitte mindestens 1 Bild hochladen.');

    submitMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      min_participants: form.min_participants ? parseInt(form.min_participants) : undefined,
      max_participants: form.max_participants ? parseInt(form.max_participants) : undefined,
      image_url: form.images[0], // Hauptbild
      artist_email: user.email,
      artist_name: existingProfile?.display_name || user.full_name || user.email,
      status: 'ausstehend_freigabe',
    });
  };

  if (!existingProfile || !profileComplete) {
    const missing = [];
    if (!existingProfile?.display_name?.trim()) missing.push('Künstlername');
    if (!existingProfile?.phone?.trim()) missing.push('Telefonnummer');
    if (!existingProfile?.invoice_street?.trim()) missing.push('Straße');
    if (!existingProfile?.invoice_zip?.trim()) missing.push('PLZ');
    if (!existingProfile?.invoice_city?.trim()) missing.push('Stadt');

    return (
      <Card className="p-8 text-center space-y-4">
        <Lock className="w-10 h-10 text-muted-foreground/50 mx-auto" />
        <h3 className="font-semibold text-lg">Profil zuerst vervollständigen</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Bevor du einen Kurs vorschlagen kannst, müssen alle Pflichtfelder gespeichert sein.
        </p>
        {missing.length > 0 && (
          <div className="inline-flex flex-wrap justify-center gap-2 pt-1">
            {missing.map(f => (
              <span key={f} className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">{f}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2">
          Fülle die fehlenden Felder in den Tabs <strong>Profil</strong> und <strong>Rechnung</strong> aus und klicke auf <strong>Profil speichern</strong>.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 border border-blue-200 bg-blue-50">
        <h4 className="font-semibold text-blue-900 mb-1">Atelier-Workflow</h4>
        <p className="text-sm text-blue-800">
          Dein Kurs durchläuft die Schritte <strong>Entwurf</strong> → <strong>Wartet auf Freigabe</strong> → <strong>Intern freigegeben</strong> → <strong>Veröffentlicht</strong>.
          Bei Ablehnung erhältst du ein Feedback und kannst den Kurs überarbeitet erneut einreichen.
        </p>
      </Card>

      {/* Formular */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-5">Neuen Kurs vorschlagen</h3>

        {submitMutation.isPending && (
          <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Kursvorschlag wird gespeichert...
          </div>
        )}

        {submitFeedback && !submitMutation.isPending && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm ${
              submitFeedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {submitFeedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Titel */}
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="z.B. Aquarell für Anfänger"
              required
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="Was erwartet die Teilnehmer? Was werden sie lernen?"
            />
          </div>

          {/* Preis */}
          <div className="space-y-2">
            <Label>Preis (€) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
              placeholder="49.00"
              required
            />
          </div>

          {/* Teilnehmerzahl */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min. Teilnehmer</Label>
              <Input
                type="number"
                min="1"
                value={form.min_participants}
                onChange={e => setForm(p => ({ ...p, min_participants: e.target.value }))}
                placeholder="z.B. 2"
              />
            </div>
            <div className="space-y-2">
              <Label>Max. Teilnehmer</Label>
              <Input
                type="number"
                min="1"
                value={form.max_participants}
                onChange={e => setForm(p => ({ ...p, max_participants: e.target.value }))}
                placeholder="z.B. 12"
              />
            </div>
          </div>

          {/* Bilder */}
          <div className="space-y-3">
            <Label>Bilder * (min. 1, max. 10)</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      Haupt
                    </span>
                  )}
                </div>
              ))}

              {uploadingIdx !== null && (
                <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {form.images.length < 10 && uploadingIdx === null && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Hinzufügen</span>
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{form.images.length}/10 Bilder · Das erste Bild wird als Titelbild verwendet.</p>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">💡 Du kannst Zeitslots buchen, sobald dein Konto freigegeben ist. <strong>Wichtig:</strong> Der vorgeschlagene Kurs bleibt dir als Vorlage.</div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {submitMutation.isPending ? 'Wird gespeichert...' : 'Kurs vorschlagen'}
          </Button>
        </form>
      </Card>

      {/* Bereits eingereichte Kurse */}
      {myCourses.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Meine eingereichten Kurse ({myCourses.length})</h3>
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
                      {course.max_participants ? ` · max. ${course.max_participants} Teilnehmer` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(course.created_date), 'dd. MMM yyyy', { locale: de })}
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
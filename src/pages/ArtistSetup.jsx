import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, CheckCircle, AlertCircle, User, FileText, CreditCard, Banknote, Lightbulb, MapPin } from 'lucide-react';
import AuszahlungTab from '@/components/artist/AuszahlungTab';
import KursVorschlagTab from '@/components/artist/KursVorschlagTab';
import InvoiceTab from '@/components/artist/InvoiceTab';
import LocationTab from '@/components/artist/LocationTab';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function ArtistSetup() {
  const { user: authUser } = useAuth();
  const showStripeTab = authUser?.role === 'admin' || authUser?.role === 'kuenstler_manager';
  const showLocationTab = authUser?.role === 'admin' || authUser?.role === 'kuenstler_manager' || authUser?.role === 'location_manager';
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    display_name: '', bio: '', avatar_url: '',
    website: '', instagram: '',
    invoice_name: '', invoice_street: '', invoice_zip: '', invoice_city: '', invoice_country: 'Deutschland',
    invoice_tax_id: '', phone: '',
  });

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  });

  const { data: existingProfiles = [] } = useQuery({
    queryKey: ['my-artist-profile'],
    queryFn: () => api.entities.ArtistProfile.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const existingProfile = existingProfiles[0];

  useEffect(() => {
    if (existingProfile) {
      setProfile({
        display_name: existingProfile.display_name || '',
        bio: existingProfile.bio || '',
        avatar_url: existingProfile.avatar_url || '',
        website: existingProfile.website || '',
        instagram: existingProfile.instagram || '',
        invoice_name: existingProfile.invoice_name || '',
        invoice_street: existingProfile.invoice_street || '',
        invoice_zip: existingProfile.invoice_zip || '',
        invoice_city: existingProfile.invoice_city || '',
        invoice_country: existingProfile.invoice_country || 'Deutschland',
        invoice_tax_id: existingProfile.invoice_tax_id || '',
        phone: existingProfile.phone || '',
      });
    } else if (user) {
      setProfile(p => ({ ...p, display_name: user.full_name || '' }));
    }
  }, [existingProfile, user]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (existingProfile) {
        return api.entities.ArtistProfile.update(existingProfile.id, data);
      }
      return api.entities.ArtistProfile.create({ ...data, user_email: user.email, is_approved: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-artist-profile'] });
      toast.success('Profil gespeichert!');
    },
    onError: () => {
      toast.error('Fehler beim Speichern. Bitte versuche es erneut.');
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setProfile(p => ({ ...p, avatar_url: file_url }));
      toast.success('Foto hochgeladen!');
    } catch {
      toast.error('Fehler beim Hochladen des Fotos.');
    } finally {
      setUploading(false);
    }
  };

  const update = (field, value) => setProfile(p => ({ ...p, [field]: value }));

  const missingFields = [];
  if (!profile.display_name?.trim()) missingFields.push('Künstlername');
  if (!profile.phone?.trim()) missingFields.push('Telefonnummer');
  if (!profile.invoice_street?.trim()) missingFields.push('Straße');
  if (!profile.invoice_zip?.trim()) missingFields.push('PLZ');
  if (!profile.invoice_city?.trim()) missingFields.push('Stadt');
  const profileComplete = missingFields.length === 0;

  const handleSave = () => {
    if (!profileComplete) {
      toast.error(`Bitte fülle folgende Pflichtfelder aus: ${missingFields.join(', ')}`);
      return;
    }
    saveMutation.mutate(profile);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Mein Künstlerprofil</h1>
        <p className="text-muted-foreground mt-1">Verwalte dein Profil und deine Rechnungsdaten</p>
      </div>

      {!profileComplete && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Pflichtfelder fehlen für die Freischaltung</p>
            <p className="text-sm text-amber-700 mt-0.5">Bitte ergänze: <strong>{missingFields.join(', ')}</strong></p>
          </div>
        </div>
      )}

      {existingProfile && !existingProfile.is_approved && profileComplete && (
        <div className="flex items-center gap-3 p-4 bg-accent rounded-xl border border-primary/20">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <div>
            <p className="font-medium text-accent-foreground">Warte auf Admin-Freischaltung</p>
            <p className="text-sm text-muted-foreground">Dein Profil wird vom Admin geprüft und freigeschaltet.</p>
          </div>
        </div>
      )}

      {existingProfile?.is_approved && (
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <CheckCircle className="w-5 h-5 text-primary" />
          <p className="font-medium">Dein Profil ist freigeschaltet</p>
        </div>
      )}

      <Tabs defaultValue="profil">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${4 + (showLocationTab ? 1 : 0) + (showStripeTab ? 1 : 0)}, minmax(0, 1fr))` }}>
          <TabsTrigger value="profil"><User className="w-4 h-4 mr-1" />Profil</TabsTrigger>
          <TabsTrigger value="rechnung"><FileText className="w-4 h-4 mr-1" />Rechnung</TabsTrigger>
          {showLocationTab && <TabsTrigger value="location"><MapPin className="w-4 h-4 mr-1" />Location</TabsTrigger>}
          <TabsTrigger value="kursvorschlag"><Lightbulb className="w-4 h-4 mr-1" />Kurs vorschlagen</TabsTrigger>
          <TabsTrigger value="auszahlung"><Banknote className="w-4 h-4 mr-1" />Auszahlung</TabsTrigger>
          {showStripeTab && <TabsTrigger value="stripe"><CreditCard className="w-4 h-4 mr-1" />Stripe</TabsTrigger>}
        </TabsList>

        <TabsContent value="profil">
          <Card className="p-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4 mr-2" />Foto hochladen</>}</span>
                </Button>
              </label>
            </div>

            <div className="space-y-2">
              <Label>Künstlername *</Label>
              <Input value={profile.display_name} onChange={e => update('display_name', e.target.value)} placeholder="Dein Künstlername" />
            </div>
            <div className="space-y-2">
              <Label>Biographie</Label>
              <Textarea value={profile.bio} onChange={e => update('bio', e.target.value)} rows={4} placeholder="Erzähle etwas über dich und deine Kunst..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={profile.website} onChange={e => update('website', e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={profile.instagram} onChange={e => update('instagram', e.target.value)} placeholder="@dein_handle" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rechnung">
          <InvoiceTab profile={profile} update={update} />
        </TabsContent>

        <TabsContent value="location">
          <LocationTab />
        </TabsContent>

        <TabsContent value="kursvorschlag">
          <KursVorschlagTab user={user} existingProfile={existingProfile} profileComplete={profileComplete} />
        </TabsContent>

        <TabsContent value="auszahlung">
          <AuszahlungTab existingProfile={existingProfile} user={user} />
        </TabsContent>

        <TabsContent value="stripe">
          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <CreditCard className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Stripe Connect – Builder+ erforderlich</p>
                <p className="text-sm text-amber-700 mt-1">
                  Für echte Stripe-Zahlungen direkt auf dein Konto ist ein Backend (Builder+-Abo) erforderlich.
                  Dann verbindest du hier dein Stripe-Konto und erhältst Zahlungen automatisch, abzüglich der Plattform-Provision.
                </p>
              </div>
            </div>
            {existingProfile?.stripe_account_id ? (
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Stripe-Konto verbunden</span>
              </div>
            ) : (
              <Button disabled variant="outline" className="w-full">
                <CreditCard className="w-4 h-4 mr-2" />
                Mit Stripe verbinden (bald verfügbar)
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90" disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Profil speichern
        </Button>
      </div>
    </div>
  );
}
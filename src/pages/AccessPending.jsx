import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock3, CircleCheckBig, UserRoundPlus, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AccessPending() {
  const { data: me, isLoading: loadingMe, refetch: refetchMe } = useQuery({
    queryKey: ['me-pending-access'],
    queryFn: () => api.auth.me()
  });

  const {
    data: profiles = [],
    isLoading: loadingProfile,
    refetch: refetchProfile
  } = useQuery({
    queryKey: ['pending-access-profile', me?.email],
    queryFn: () => api.entities.ArtistProfile.filter({ user_email: me?.email }),
    enabled: !!me?.email
  });

  const profile = profiles[0];
  const isLoading = loadingMe || loadingProfile;

  const status = !profile
    ? {
        title: 'Noch kein Künstlerprofil eingereicht',
        description: 'Bitte hinterlege dein Profil im nächsten Schritt, damit Admin oder Manager dich freischalten können.',
        badge: 'Profil fehlt',
        icon: UserRoundPlus
      }
    : !profile.is_approved
      ? {
          title: 'Profil eingereicht, Freischaltung ausstehend',
          description: 'Dein Profil liegt zur Prüfung vor. Nach der Freigabe erhältst du Zugriff auf Kurse, Rechnungen und weitere Backend-Bereiche.',
          badge: 'Wartet auf Freigabe',
          icon: Clock3
        }
      : {
          title: 'Profil freigeschaltet, Zugang wird vorbereitet',
          description: 'Dein Künstlerprofil ist freigegeben. Falls dein Zugriff noch nicht aktiv ist, lade die Seite neu oder melde dich einmal ab und wieder an.',
          badge: 'Fast bereit',
          icon: CircleCheckBig
        };

  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/60 px-4 py-10 flex items-center justify-center">
      <Card className="w-full max-w-2xl p-6 md:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">cocon coloré</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Zugang wird freigeschaltet</h1>
          <p className="text-muted-foreground">Dein Account ist registriert, aber noch nicht für alle internen Bereiche aktiv.</p>
        </div>

        <div className="rounded-xl border bg-muted/30 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/15 text-sidebar-primary flex items-center justify-center shrink-0">
            <StatusIcon className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <Badge variant="outline">{status.badge}</Badge>
            <h2 className="font-semibold text-lg">{status.title}</h2>
            <p className="text-sm text-muted-foreground">{status.description}</p>
            {me?.email && <p className="text-xs text-muted-foreground">Account: {me.email}</p>}
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-background space-y-2">
          <p className="font-medium">Nächste Schritte</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Status wird geladen...</p>
          ) : (
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Profil vollständig hinterlegen (Mein Profil)</li>
              <li>Freigabe durch Admin oder Künstler-Manager abwarten</li>
              <li>Nach Freigabe erneut einloggen</li>
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            onClick={async () => {
              await refetchMe();
              await refetchProfile();
            }}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />Status aktualisieren
          </Button>
          <Link to="/kurskatalog-public">
            <Button variant="outline">Öffentlicher Kurskatalog</Button>
          </Link>
          <Button onClick={() => api.auth.logout()}>Abmelden</Button>
        </div>
      </Card>
    </div>
  );
}

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock3, CircleCheckBig, UserRoundPlus, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

export default function AccessPending() {
  const { t, i18n } = useTranslation();

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
        title: t('access.noProfile.title'),
        description: t('access.noProfile.desc'),
        badge: t('access.noProfile.badge'),
        icon: UserRoundPlus
      }
    : !profile.is_approved
      ? {
          title: t('access.pending.title'),
          description: t('access.pending.desc'),
          badge: t('access.pending.badge'),
          icon: Clock3
        }
      : {
          title: t('access.approved.title'),
          description: t('access.approved.desc'),
          badge: t('access.approved.badge'),
          icon: CircleCheckBig
        };

  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/60 px-4 py-10 flex items-center justify-center">
      <Card className="w-full max-w-2xl p-6 md:p-8 space-y-6">
        <div className="flex justify-end">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs font-medium ${i18n.language?.startsWith('de') ? 'bg-muted' : 'text-muted-foreground'}`}
              onClick={() => i18n.changeLanguage('de')}
            >
              DE
            </Button>
            <span className="text-muted-foreground/50 text-xs">|</span>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs font-medium ${!i18n.language?.startsWith('de') ? 'bg-muted' : 'text-muted-foreground'}`}
              onClick={() => i18n.changeLanguage('en')}
            >
              EN
            </Button>
          </div>
        </div>
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">cocon coloré</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t('access.title')}</h1>
          <p className="text-muted-foreground">{t('access.subtitle')}</p>
        </div>

        <div className="rounded-xl border bg-muted/30 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/15 text-sidebar-primary flex items-center justify-center shrink-0">
            <StatusIcon className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <Badge variant="outline">{status.badge}</Badge>
            <h2 className="font-semibold text-lg">{status.title}</h2>
            <p className="text-sm text-muted-foreground">{status.description}</p>
            {me?.email && <p className="text-xs text-muted-foreground">{t('access.account')} {me.email}</p>}
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-background space-y-2">
          <p className="font-medium">{t('access.nextSteps')}</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('access.loadingStatus')}</p>
          ) : (
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('access.step1')}</li>
              <li>{t('access.step2')}</li>
              <li>{t('access.step3')}</li>
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
            <RefreshCw className="w-4 h-4 mr-2" />{t('access.refreshStatus')}
          </Button>
          <Link to="/kurskatalog-public">
            <Button variant="outline">{t('access.publicCatalog')}</Button>
          </Link>
          <Button onClick={() => api.auth.logout()}>{t('access.logout')}</Button>
        </div>
      </Card>
    </div>
  );
}

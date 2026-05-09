import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const FALLBACK_TEXTS = {
  agb: `§ 1 Geltungsbereich\nDiese AGB gelten für alle Buchungen und Dienstleistungen über die Plattform cocon coloré.\n\n§ 2 Vertragsschluss\nMit dem Abschluss einer Buchung kommt ein verbindlicher Vertrag zustande.\n\n§ 7 Anwendbares Recht\nEs gilt deutsches Recht. Gerichtsstand ist Berlin.`,
  datenschutz: `1. Verantwortlicher\ncocon coloré\nInhaberin: Priscilla Haage\nAmsterdamer Straße 6, 13347 Berlin\nTelefon: +49 (0) 176 56 84 48 30\n\n2. Ihre Rechte\nSie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten.`,
};

export default function LegalTextPage() {
  const { legalType } = useParams();
  const { t } = useTranslation();

  const LEGAL_PAGES = {
    agb: {
      title: t('footer.agbFull'),
      settingKey: 'legal_agb',
    },
    datenschutz: {
      title: t('footer.datenschutzFull'),
      settingKey: 'legal_datenschutz',
    },
  };

  const pageConfig = LEGAL_PAGES[legalType];

  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });

  if (!pageConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{t('legalPage.notFound')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{t('legalPage.notFoundDesc')}</p>
            <Link to="/login" className="underline underline-offset-4 hover:text-foreground">{t('legalPage.toLogin')}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = settings[0];
  const text = s?.[pageConfig.settingKey] || FALLBACK_TEXTS[legalType] || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">{pageConfig.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {text || t('legalPage.empty')}
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center space-x-4">
          <Link to="/login" className="underline underline-offset-4 hover:text-foreground">{t('legalPage.toLogin')}</Link>
          <Link to="/kurskatalog-public" className="underline underline-offset-4 hover:text-foreground">{t('legalPage.toCatalog')}</Link>
        </div>
      </div>
    </div>
  );
}

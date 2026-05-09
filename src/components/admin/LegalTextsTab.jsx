import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const DEFAULTS = {
  impressum: `cocon coloré
Inhaberin: Priscilla Sarah Candida Haage
Amsterdamer Straße 6
13347 Berlin

Telefon: +49 (0) 176 56844830
E-Mail: email@coconcolore.de`,
  agb: `§ 1 Geltungsbereich
Diese AGB gelten für alle Buchungen und Dienstleistungen über die Plattform cocon coloré.

§ 2 Vertragsschluss
Mit dem Abschluss einer Buchung kommt ein verbindlicher Vertrag zwischen dem Kunden und dem jeweiligen Kursanbieter zustande. cocon coloré vermittelt dabei lediglich als Plattform.

§ 3 Preise & Zahlung
Alle angegebenen Preise sind Endpreise. Die Zahlung erfolgt sicher über Stripe.

§ 4 Stornierung & Rücktritt
Stornierungen sind gegen eine Gebühr möglich. Bitte kontaktieren Sie uns unter email@coconcolore.de.

§ 5 Haftung
cocon coloré übernimmt keine Haftung für Inhalte der angebotenen Kurse.

§ 6 Datenschutz
Ihre personenbezogenen Daten werden gemäß DSGVO verarbeitet.

§ 7 Anwendbares Recht
Es gilt deutsches Recht. Gerichtsstand ist Berlin.`,
  datenschutz: `1. Verantwortlicher
cocon coloré
Inhaberin: Priscilla Haage
Amsterdamer Straße 6, 13347 Berlin
Telefon: +49 (0) 176 56 84 48 30

2. Erhebung und Verarbeitung personenbezogener Daten
Wir erheben personenbezogene Daten nur, soweit dies zur Bereitstellung unserer Dienste erforderlich ist.

3. Rechtsgrundlage der Verarbeitung
Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf Grundlage von Art. 6 Abs. 1 DSGVO.

4. Weitergabe von Daten
Ihre Daten werden nicht an Dritte verkauft. Eine Weitergabe erfolgt nur zur Vertragserfüllung.

5. Zahlungsdienstleister – Stripe
Für die Zahlungsabwicklung nutzen wir Stripe Payments Europe, Ltd.

6. Cookies
Unsere Website verwendet technisch notwendige Cookies sowie optionale Analyse-Cookies.

7. Speicherdauer
Personenbezogene Daten werden nur so lange gespeichert, wie es erforderlich ist.

8. Ihre Rechte
Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Widerspruch.
Kontakt: Telefon: +49 (0) 176 56 84 48 30

9. Beschwerderecht
Sie können sich bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit beschweren.`,
};

export default function LegalTextsTab() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });

  const currentSettings = settings[0];

  const [texts, setTexts] = useState({
    impressum: '',
    agb: '',
    datenschutz: '',
  });

  useEffect(() => {
    if (currentSettings) {
      setTexts({
        impressum: currentSettings.legal_impressum || DEFAULTS.impressum,
        agb: currentSettings.legal_agb || DEFAULTS.agb,
        datenschutz: currentSettings.legal_datenschutz || DEFAULTS.datenschutz,
      });
    } else {
      setTexts({
        impressum: DEFAULTS.impressum,
        agb: DEFAULTS.agb,
        datenschutz: DEFAULTS.datenschutz,
      });
    }
  }, [currentSettings]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (currentSettings) return api.entities.PlatformSettings.update(currentSettings.id, data);
      return api.entities.PlatformSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success(t('legalTexts.saved'));
    },
  });

  const handleSave = (key) => {
    saveMutation.mutate({ [`legal_${key}`]: texts[key] });
  };

  const sections = [
    { key: 'impressum', label: t('legalTexts.impressum') },
    { key: 'agb', label: t('legalTexts.agb') },
    { key: 'datenschutz', label: t('legalTexts.datenschutz') },
  ];

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-muted-foreground" />
        <h2 className="font-semibold text-lg">{t('legalTexts.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('legalTexts.desc')}</p>

      <Tabs defaultValue="impressum">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="impressum">{t('legalTexts.impressum')}</TabsTrigger>
          <TabsTrigger value="agb">{t('legalTexts.agb')}</TabsTrigger>
          <TabsTrigger value="datenschutz">{t('legalTexts.datenschutz')}</TabsTrigger>
        </TabsList>

        {sections.map(({ key, label }) => (
          <TabsContent key={key} value={key} className="mt-4">
            <Card className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>{label}</Label>
                <Textarea
                  value={texts[key]}
                  onChange={e => setTexts(p => ({ ...p, [key]: e.target.value }))}
                  rows={20}
                  className="font-mono text-sm resize-y"
                  placeholder={t('legalTexts.placeholder', { label })}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => handleSave(key)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('legalTexts.save', { label })}
                </Button>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

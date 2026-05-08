import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

function LegalDialog({ open, onClose, title, text }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      </DialogContent>
    </Dialog>
  );
}




function CookieDialog({ open, onClose }) {
  const [analytics, setAnalytics] = useState(() => {
    return localStorage.getItem('cookie_analytics') !== 'false';
  });

  const save = () => {
    localStorage.setItem('cookie_analytics', analytics ? 'true' : 'false');
    onClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Cookie-Einstellungen</DialogTitle>
        </DialogHeader>
        <div className="text-sm space-y-4 text-muted-foreground">
          <div className="flex items-start justify-between gap-4 py-3 border-b border-border">
            <div>
              <p className="font-semibold text-foreground">Notwendige Cookies</p>
              <p className="text-xs mt-0.5">Für den Betrieb der Plattform erforderlich. Können nicht deaktiviert werden.</p>
            </div>
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded shrink-0">Immer aktiv</span>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="font-semibold text-foreground">Analyse-Cookies</p>
              <p className="text-xs mt-0.5">Helfen uns, die Nutzung der Plattform zu verstehen und zu verbessern.</p>
            </div>
            <button
              onClick={() => setAnalytics(a => !a)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${analytics ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${analytics ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          <button
            onClick={save}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-md text-sm font-medium"
          >
            Einstellungen speichern
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FALLBACK_TEXTS = {
  impressum: `cocon coloré\nInhaberin: Priscilla Sarah Candida Haage\nAmsterdamer Straße 6\n13347 Berlin\n\nTelefon: +49 (0) 176 56844830\nE-Mail: email@coconcolore.de`,
  agb: `§ 1 Geltungsbereich\nDiese AGB gelten für alle Buchungen und Dienstleistungen über die Plattform cocon coloré.\n\n§ 2 Vertragsschluss\nMit dem Abschluss einer Buchung kommt ein verbindlicher Vertrag zustande.\n\n§ 7 Anwendbares Recht\nEs gilt deutsches Recht. Gerichtsstand ist Berlin.`,
  datenschutz: `1. Verantwortlicher\ncocon coloré\nInhaberin: Priscilla Haage\nAmsterdamer Straße 6, 13347 Berlin\nTelefon: +49 (0) 176 56 84 48 30\n\n2. Ihre Rechte\nSie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten.`,
};

export default function Footer() {
  const [openDialog, setOpenDialog] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });
  const s = settings[0];

  const texts = {
    impressum: s?.legal_impressum || FALLBACK_TEXTS.impressum,
    agb: s?.legal_agb || FALLBACK_TEXTS.agb,
    datenschutz: s?.legal_datenschutz || FALLBACK_TEXTS.datenschutz,
  };

  return (
    <>
      <footer className="border-t border-border bg-background mt-auto py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} cocon coloré</span>
          <button onClick={() => setOpenDialog('impressum')} className="hover:text-foreground transition-colors underline underline-offset-2">Impressum</button>
          <button onClick={() => setOpenDialog('agb')} className="hover:text-foreground transition-colors underline underline-offset-2">AGB</button>
          <button onClick={() => setOpenDialog('datenschutz')} className="hover:text-foreground transition-colors underline underline-offset-2">Datenschutz</button>
          <button onClick={() => setOpenDialog('cookies')} className="hover:text-foreground transition-colors underline underline-offset-2">Cookie-Einstellungen</button>
        </div>
      </footer>

      <LegalDialog open={openDialog === 'impressum'} onClose={() => setOpenDialog(null)} title="Impressum" text={texts.impressum} />
      <LegalDialog open={openDialog === 'agb'} onClose={() => setOpenDialog(null)} title="Allgemeine Geschäftsbedingungen" text={texts.agb} />
      <LegalDialog open={openDialog === 'datenschutz'} onClose={() => setOpenDialog(null)} title="Datenschutzerklärung" text={texts.datenschutz} />
      <CookieDialog open={openDialog === 'cookies'} onClose={() => setOpenDialog(null)} />
    </>
  );
}
import React, { useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Minus, Plus, CreditCard,
  Calendar, MapPin, Clock, Mail, User, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog as LegalDialogRoot, DialogContent as LegalDialogContent,
  DialogHeader as LegalDialogHeader, DialogTitle as LegalDialogTitle,
} from '@/components/ui/dialog';

const STEPS = ['tickets', 'details', 'confirm'];

export default function CheckoutDialog({ course, commission, spotsLeft, onClose }) {
  const [step, setStep] = useState('tickets');
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null); // 'agb' | 'datenschutz'
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_email_confirm: '',
    notes: '',
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });
  const s = settings[0];

  const maxTickets = spotsLeft !== null ? Math.min(spotsLeft, 10) : 10;
  const pricePerTicket = course.price || 0;
  const totalPrice = pricePerTicket * quantity;

  const canProceedToConfirm =
    form.customer_name.trim() &&
    form.customer_email.trim() &&
    form.customer_email === form.customer_email_confirm;

  const update = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const handleStripeCheckout = async () => {
    setLoading(true);
    const currentUrl = window.location.href.split('?')[0];
    const response = await api.functions.invoke('createCheckoutSession', {
      course_id: course.id,
      quantity,
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      notes: form.notes,
      success_url: `${currentUrl}?booking=success`,
      cancel_url: `${currentUrl}?booking=cancelled`,
    });
    const { url } = response.data;
    window.location.href = url;
  };

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Tickets buchen</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {[
            { key: 'tickets', label: 'Tickets' },
            { key: 'details', label: 'Kontakt' },
            { key: 'confirm', label: 'Zahlung' },
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 text-xs font-medium ${step === s.key ? 'text-primary' : STEPS.indexOf(step) > i ? 'text-primary/60' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${step === s.key ? 'bg-primary text-white border-primary' : STEPS.indexOf(step) > i ? 'bg-primary/20 text-primary border-primary/30' : 'border-border'}`}>
                  {STEPS.indexOf(step) > i ? <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < 2 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Kurs-Kurzinfo */}
        <div className="bg-muted/50 rounded-xl p-3 space-y-1 text-sm mb-2">
          <p className="font-semibold truncate">{course.title}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {course.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(course.event_date), 'dd. MMM yyyy, HH:mm', { locale: de })} Uhr
              </span>
            )}
            {course.location && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{course.location}</span>
            )}
            {course.duration_hours && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_hours}h</span>
            )}
          </div>
        </div>

        {/* STEP 1: Tickets */}
        {step === 'tickets' && (
          <div className="space-y-5">
            <div>
              <Label className="text-base font-semibold">Anzahl Tickets</Label>
              {spotsLeft !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">{spotsLeft} Plätze verfügbar</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold font-display w-12 text-center">{quantity}</span>
                <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(q => Math.min(maxTickets, q + 1))} disabled={quantity >= maxTickets}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{quantity}× Ticket à {pricePerTicket.toFixed(2)} €</span>
                <span>{totalPrice.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Gesamt</span>
                <span className="text-primary text-lg">{totalPrice.toFixed(2)} €</span>
              </div>
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setStep('details')}>
              Weiter <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP 2: Kontaktdaten */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Vor- und Nachname" value={form.customer_name} onChange={e => update('customer_name', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-Mail *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" type="email" placeholder="deine@email.de" value={form.customer_email} onChange={e => update('customer_email', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-Mail bestätigen *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className={`pl-9 ${form.customer_email_confirm && form.customer_email !== form.customer_email_confirm ? 'border-destructive' : ''}`}
                  type="email"
                  placeholder="deine@email.de"
                  value={form.customer_email_confirm}
                  onChange={e => update('customer_email_confirm', e.target.value)}
                />
              </div>
              {form.customer_email_confirm && form.customer_email !== form.customer_email_confirm && (
                <p className="text-xs text-destructive">E-Mail-Adressen stimmen nicht überein</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Anmerkungen (optional)</Label>
              <Textarea placeholder="Besondere Wünsche, Fragen..." value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('tickets')} className="flex-1">Zurück</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => setStep('confirm')} disabled={!canProceedToConfirm}>
                Weiter <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Zahlung via Stripe */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="border rounded-xl divide-y text-sm">
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{form.customer_name}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">E-Mail</span>
                <span className="font-medium">{form.customer_email}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Tickets</span>
                <span className="font-medium">{quantity}×</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="font-bold">Gesamt</span>
                <span className="font-bold text-primary">{totalPrice.toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <CreditCard className="w-4 h-4 shrink-0" />
              Du wirst zu Stripe weitergeleitet, um sicher mit Kreditkarte oder anderen Zahlungsmethoden zu bezahlen.
            </div>

            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <Checkbox
                id="agb-accept"
                checked={agbAccepted}
                onCheckedChange={setAgbAccepted}
                className="mt-0.5"
              />
              <label htmlFor="agb-accept" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                Ich habe die{' '}
                <button type="button" onClick={() => setLegalOpen('agb')} className="underline text-foreground hover:text-primary">AGB</button>
                {' '}und die{' '}
                <button type="button" onClick={() => setLegalOpen('datenschutz')} className="underline text-foreground hover:text-primary">Datenschutzerklärung</button>
                {' '}gelesen und akzeptiere diese. Ich bestätige, dass ich diesen Kurs zahlungspflichtig buche ({totalPrice.toFixed(2)} €).
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1" disabled={loading}>Zurück</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleStripeCheckout} disabled={loading || !agbAccepted}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Jetzt zahlungspflichtig buchen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Legal text dialogs */}
    {legalOpen && (
      <LegalDialogRoot open onOpenChange={() => setLegalOpen(null)}>
        <LegalDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <LegalDialogHeader>
            <LegalDialogTitle className="font-display text-xl">
              {legalOpen === 'agb' ? 'Allgemeine Geschäftsbedingungen' : 'Datenschutzerklärung'}
            </LegalDialogTitle>
          </LegalDialogHeader>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {legalOpen === 'agb' ? (s?.legal_agb || '') : (s?.legal_datenschutz || '')}
          </div>
        </LegalDialogContent>
      </LegalDialogRoot>
    )}
    </>
  );
}
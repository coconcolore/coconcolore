import React, { useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Minus, Plus, Banknote, CheckCircle,
  Calendar, MapPin, Clock, Mail, User, ChevronRight, Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog as LegalDialogRoot, DialogContent as LegalDialogContent,
  DialogHeader as LegalDialogHeader, DialogTitle as LegalDialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const STEPS = ['tickets', 'details', 'confirm'];

export default function CheckoutDialog({ course, room, commission, spotsLeft, onClose }) {
  const [step, setStep] = useState('tickets');
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null);
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_email_confirm: '',
    notes: '',
  });
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

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

  const handleBooking = async () => {
    setLoading(true);
    try {
      const commissionPercent = s?.commission_percent ?? 15;
      const amountCommission = totalPrice * commissionPercent / 100;
      await api.entities.Booking.create({
        course_id: course.id,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        notes: form.notes,
        payment_status: 'ausstehend',
        amount_total: totalPrice,
        amount_commission: amountCommission,
        amount_artist: totalPrice - amountCommission,
      });
      setBooked(true);
    } catch {
      toast.error(t('checkout.bookingError'));
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = [
    { key: 'tickets', label: t('checkout.steps.tickets') },
    { key: 'details', label: t('checkout.steps.contact') },
    { key: 'confirm', label: t('checkout.steps.payment') },
  ];

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t('checkout.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          {stepLabels.map((s, i) => (
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

        <div className="bg-muted/50 rounded-xl p-3 space-y-1 text-sm mb-2">
          <p className="font-semibold truncate">{course.title}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {course.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(course.event_date), 'dd. MMM yyyy, HH:mm', { locale: dateLocale })} Uhr
              </span>
            )}
            {course.duration_hours && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_hours}h</span>
            )}
          </div>
          {(room?.name || room?.address || course.location) && (
            <div className="flex items-start gap-1 text-xs text-muted-foreground pt-0.5">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                {room ? [room.name, room.address].filter(Boolean).join(' · ') : course.location}
              </span>
            </div>
          )}
        </div>

        {step === 'tickets' && (
          <div className="space-y-5">
            <div>
              <Label className="text-base font-semibold">{t('checkout.ticketCount')}</Label>
              {spotsLeft !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">{t('checkout.spotsAvailable', { count: spotsLeft })}</p>
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
                <span>{t('checkout.ticketLine', { count: quantity, price: pricePerTicket.toFixed(2) })}</span>
                <span>{totalPrice.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>{t('checkout.total')}</span>
                <span className="text-primary text-lg">{totalPrice.toFixed(2)} €</span>
              </div>
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setStep('details')}>
              {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('checkout.nameLabel')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t('checkout.namePlaceholder')} value={form.customer_name} onChange={e => update('customer_name', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('checkout.emailLabel')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" type="email" placeholder={t('checkout.emailPlaceholder')} value={form.customer_email} onChange={e => update('customer_email', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('checkout.emailConfirm')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className={`pl-9 ${form.customer_email_confirm && form.customer_email !== form.customer_email_confirm ? 'border-destructive' : ''}`}
                  type="email"
                  placeholder={t('checkout.emailPlaceholder')}
                  value={form.customer_email_confirm}
                  onChange={e => update('customer_email_confirm', e.target.value)}
                />
              </div>
              {form.customer_email_confirm && form.customer_email !== form.customer_email_confirm && (
                <p className="text-xs text-destructive">{t('checkout.emailMismatch')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('checkout.notes')}</Label>
              <Textarea placeholder={t('checkout.notesPlaceholder')} value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('tickets')} className="flex-1">{t('common.back')}</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => setStep('confirm')} disabled={!canProceedToConfirm}>
                {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && !booked && (
          <div className="space-y-4">
            <div className="border rounded-xl divide-y text-sm">
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">{t('checkout.nameLabel').replace(' *', '')}</span>
                <span className="font-medium">{form.customer_name}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">{t('checkout.emailLabel').replace(' *', '')}</span>
                <span className="font-medium">{form.customer_email}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">{t('checkout.steps.tickets')}</span>
                <span className="font-medium">{quantity}×</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="font-bold">{t('checkout.total')}</span>
                <span className="font-bold text-primary">{totalPrice.toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Banknote className="w-4 h-4 shrink-0" />
              {t('checkout.transferHint')}
            </div>

            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <Checkbox
                id="agb-accept"
                checked={agbAccepted}
                onCheckedChange={setAgbAccepted}
                className="mt-0.5"
              />
              <label htmlFor="agb-accept" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                {t('checkout.agbText')}{' '}
                <button type="button" onClick={() => setLegalOpen('agb')} className="underline text-foreground hover:text-primary">{t('checkout.agbLink')}</button>
                {' '}{t('checkout.agbAnd')}{' '}
                <button type="button" onClick={() => setLegalOpen('datenschutz')} className="underline text-foreground hover:text-primary">{t('checkout.datenschutzLink')}</button>
                {' '}{t('checkout.agbEnd', { price: totalPrice.toFixed(2) })}
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1" disabled={loading}>{t('common.back')}</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleBooking} disabled={loading || !agbAccepted}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
                {t('checkout.bookNow')}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && booked && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">{t('checkout.bookedTitle')}</p>
                <p className="text-xs text-green-700 mt-0.5">{t('checkout.bookedDesc')}</p>
              </div>
            </div>

            {(s?.platform_iban || s?.platform_iban_owner) && (
              <div className="border rounded-xl divide-y text-sm">
                {s?.platform_iban_owner && (
                  <div className="p-3 flex justify-between">
                    <span className="text-muted-foreground">{t('checkout.transferOwner')}</span>
                    <span className="font-medium">{s.platform_iban_owner}</span>
                  </div>
                )}
                {s?.platform_bank && (
                  <div className="p-3 flex justify-between">
                    <span className="text-muted-foreground">{t('checkout.transferBank')}</span>
                    <span className="font-medium">{s.platform_bank}</span>
                  </div>
                )}
                {s?.platform_iban && (
                  <div className="p-3 flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">IBAN</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{s.platform_iban}</span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(s.platform_iban); toast.success(t('checkout.ibanCopied')); }}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">{t('checkout.total')}</span>
                  <span className="font-bold text-primary">{totalPrice.toFixed(2)} €</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-muted-foreground">{t('checkout.transferRef')}</span>
                  <span className="font-medium text-right max-w-[55%] truncate">{form.customer_name} – {course.title}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
              {t('checkout.transferNote')}
            </p>

            <Button className="w-full bg-primary hover:bg-primary/90" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {legalOpen && (
      <LegalDialogRoot open onOpenChange={() => setLegalOpen(null)}>
        <LegalDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <LegalDialogHeader>
            <LegalDialogTitle className="font-display text-xl">
              {legalOpen === 'agb' ? t('checkout.agbTitle') : t('checkout.datenschutzTitle')}
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

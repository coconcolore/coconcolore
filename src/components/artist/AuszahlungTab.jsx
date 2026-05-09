import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Banknote, CheckCircle, Clock, XCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function AuszahlungTab({ existingProfile, user }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [iban, setIban] = useState(existingProfile?.iban || '');
  const [notes, setNotes] = useState('');
  const { t } = useTranslation();

  const statusConfig = {
    beantragt: { label: t('payout.status.beantragt'), color: 'bg-amber-100 text-amber-700', icon: Clock },
    verarbeitet: { label: t('payout.status.verarbeitet'), color: 'bg-primary/10 text-primary', icon: CheckCircle },
    abgelehnt: { label: t('payout.status.abgelehnt'), color: 'bg-destructive/10 text-destructive', icon: XCircle },
  };

  useEffect(() => {
    if (existingProfile?.iban) setIban(existingProfile.iban);
  }, [existingProfile?.iban]);

  const saveIbanMutation = useMutation({
    mutationFn: (newIban) => api.entities.ArtistProfile.update(existingProfile.id, { iban: newIban }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-artist-profile'] });
      toast.success(t('payout.ibanSuccess'));
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['my-bookings', user?.email],
    queryFn: () => api.entities.Booking.filter({ payment_status: 'bezahlt' }),
    enabled: !!user?.email,
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['my-payouts', user?.email],
    queryFn: () => api.entities.PayoutRequest.filter({ artist_email: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: myCourses = [] } = useQuery({
    queryKey: ['my-courses-earnings', user?.email],
    queryFn: () => api.entities.Course.filter({ artist_email: user?.email }),
    enabled: !!user?.email,
  });

  const myCourseIds = new Set(myCourses.map(c => c.id));
  const myBookings = bookings.filter(b => myCourseIds.has(b.course_id));
  const totalEarned = myBookings.reduce((sum, b) => sum + (b.amount_artist || 0), 0);
  const totalPaidOut = payouts.filter(p => p.status === 'verarbeitet').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = payouts.filter(p => p.status === 'beantragt').reduce((sum, p) => sum + (p.amount || 0), 0);
  const available = Math.max(0, totalEarned - totalPaidOut - totalPending);
  const hasPendingPayout = payouts.some(p => p.status === 'beantragt');

  const payoutMutation = useMutation({
    mutationFn: async (data) => {
      const payoutRequest = await api.entities.PayoutRequest.create(data);
      const res = await api.functions.invoke('stripePayouts', {
        action: 'self_payout',
        payout_request_id: payoutRequest.id,
        amount_cents: Math.round(data.amount * 100),
        iban: data.iban,
        artist_name: data.artist_name,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-payouts', user?.email] });
      setAmount('');
      setNotes('');
      toast.success(t('payout.success'));
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['my-payouts', user?.email] });
      toast.error(t('payout.error') + ' ' + (err?.message || ''));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error(t('payout.errorAmount'));
    if (amt > available) return toast.error(t('payout.errorExceeds'));
    if (!iban.trim()) return toast.error(t('payout.errorIban'));
    if (hasPendingPayout) return toast.error(t('payout.errorPending'));
    payoutMutation.mutate({
      artist_email: user.email,
      artist_name: existingProfile?.display_name || user.full_name || user.email,
      iban: iban.trim(),
      amount: amt,
      notes,
      status: 'beantragt',
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xl font-bold font-display text-primary">{totalEarned.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground mt-1">{t('payout.totalEarned')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xl font-bold font-display">{totalPaidOut.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground mt-1">{t('payout.paid')}</p>
        </Card>
        <Card className="p-4 text-center border-primary/30">
          <p className="text-xl font-bold font-display text-primary">{available.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground mt-1">{t('payout.available')}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-primary" />{t('payout.bankTitle')}
        </h3>
        <div className="space-y-2">
          <Label>{t('payout.ibanLabel')}</Label>
          <div className="flex gap-2">
            <Input value={iban} onChange={e => setIban(e.target.value)} placeholder="DE00 0000 0000 0000 0000 00" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!iban.trim() || saveIbanMutation.isPending || iban === existingProfile?.iban}
              onClick={() => saveIbanMutation.mutate(iban.trim())}
              title={t('common.save')}
            >
              {saveIbanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </div>
          {existingProfile?.iban && <p className="text-xs text-muted-foreground">{t('payout.ibanSaved')} {existingProfile.iban}</p>}
        </div>
      </Card>

      <Card className="p-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <Banknote className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">{t('payout.notAvailableTitle')}</p>
            <p className="text-sm text-amber-700 mt-1">{t('payout.notAvailableDesc')}</p>
          </div>
        </div>
      </Card>

      {payouts.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">{t('payout.history')}</h3>
          <div className="space-y-2">
            {payouts.map(p => {
              const cfg = statusConfig[p.status] || statusConfig.beantragt;
              const Icon = cfg.icon;
              return (
                <Card key={p.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{p.amount?.toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.iban}</p>
                    </div>
                  </div>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

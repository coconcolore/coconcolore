import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, CreditCard, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function StripePayoutPanel() {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState({});

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['all-payouts-stripe'],
    queryFn: () => api.entities.PayoutRequest.list('-created_date'),
  });

  const pendingPayouts = payouts.filter(p => p.status === 'beantragt');
  const processedPayouts = payouts.filter(p => p.status !== 'beantragt');

  const handleStripePayout = async (payout) => {
    setProcessing(prev => ({ ...prev, [payout.id]: true }));
    try {
      const res = await api.functions.invoke('stripePayouts', {
        action: 'manual_payout',
        payout_request_id: payout.id,
        amount_cents: Math.round(payout.amount * 100),
        iban: payout.iban,
        artist_name: payout.artist_name || payout.artist_email,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Auszahlung verarbeitet!');
        queryClient.invalidateQueries({ queryKey: ['all-payouts-stripe'] });
        queryClient.invalidateQueries({ queryKey: ['all-payouts'] });
      }
    } catch (err) {
      toast.error('Fehler bei der Auszahlung: ' + err.message);
    } finally {
      setProcessing(prev => ({ ...prev, [payout.id]: false }));
    }
  };

  const rejectMutation = useMutation({
    mutationFn: ({ id }) => api.entities.PayoutRequest.update(id, { status: 'abgelehnt' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-payouts-stripe'] });
      queryClient.invalidateQueries({ queryKey: ['all-payouts'] });
      toast.success('Auszahlung abgelehnt.');
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="w-4 h-4 animate-spin" />Lädt...</div>;

  return (
    <div className="space-y-6">
      {/* Stripe Info Banner */}
      <Card className="p-4 bg-primary/5 border-primary/20 flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm">Stripe-Auszahlungen aktiv</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auszahlungen werden über Stripe an die hinterlegten IBANs der Künstler verarbeitet.
            Provision wird automatisch einbehalten.
          </p>
        </div>
      </Card>

      {/* Ausstehende Auszahlungen */}
      <div>
        <h3 className="font-semibold mb-3">
          Ausstehend ({pendingPayouts.length})
        </h3>
        {pendingPayouts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Keine ausstehenden Auszahlungen</p>
        ) : pendingPayouts.map(p => (
          <Card key={p.id} className="p-4 mb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{p.artist_name || p.artist_email}</p>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">{p.iban}</p>
                <p className="text-lg font-bold text-primary mt-1">{p.amount?.toFixed(2)} €</p>
                {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => handleStripePayout(p)}
                  disabled={processing[p.id]}
                >
                  {processing[p.id] ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Stripe auszahlen
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => rejectMutation.mutate({ id: p.id })}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1" />Ablehnen
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Verlauf */}
      {processedPayouts.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Verlauf</h3>
          <div className="space-y-2">
            {processedPayouts.map(p => (
              <Card key={p.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.artist_name || p.artist_email}</p>
                    <p className="text-xs text-muted-foreground">{p.amount?.toFixed(2)} € · {p.iban}</p>
                    {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                  </div>
                  <Badge className={p.status === 'verarbeitet' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                    {p.status === 'verarbeitet' ? 'Überwiesen' : 'Abgelehnt'}
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
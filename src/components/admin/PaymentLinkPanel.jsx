import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function PaymentLinkPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [paymentLink, setPaymentLink] = useState('');

  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });

  const currentSettings = settings[0];

  useEffect(() => {
    if (currentSettings) {
      setPaymentLink(currentSettings.payment_link || '');
    }
  }, [currentSettings]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (currentSettings) return api.entities.PlatformSettings.update(currentSettings.id, data);
      return api.entities.PlatformSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success(t('paymentLinkPanel.saveSuccess'));
    },
  });

  return (
    <div className="space-y-6 max-w-md">
      <Card className="p-4 bg-primary/5 border-primary/20 flex items-start gap-3">
        <Link2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm">{t('paymentLinkPanel.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('paymentLinkPanel.hint')}</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>{t('paymentLinkPanel.linkLabel')}</Label>
          <Input
            placeholder="https://paypal.me/... oder https://buy.stripe.com/..."
            value={paymentLink}
            onChange={e => setPaymentLink(e.target.value)}
            type="url"
          />
          <p className="text-xs text-muted-foreground">{t('paymentLinkPanel.linkHint')}</p>
        </div>
        <Button
          className="w-full bg-primary hover:bg-primary/90"
          onClick={() => {
          const url = paymentLink && !paymentLink.match(/^https?:\/\//) ? `https://${paymentLink}` : paymentLink;
          saveMutation.mutate({ payment_link: url });
        }}
          disabled={saveMutation.isPending}
        >
          {t('common.save')}
        </Button>
      </Card>
    </div>
  );
}

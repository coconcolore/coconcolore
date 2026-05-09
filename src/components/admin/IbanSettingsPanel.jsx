import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function IbanSettingsPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [form, setForm] = useState({ platform_iban: '', platform_iban_owner: '', platform_bank: '' });

  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });

  const currentSettings = settings[0];

  useEffect(() => {
    if (currentSettings) {
      setForm({
        platform_iban: currentSettings.platform_iban || '',
        platform_iban_owner: currentSettings.platform_iban_owner || '',
        platform_bank: currentSettings.platform_bank || '',
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
      toast.success(t('ibanPanel.saveSuccess'));
    },
  });

  return (
    <div className="space-y-6 max-w-md">
      <Card className="p-4 bg-primary/5 border-primary/20 flex items-start gap-3">
        <Banknote className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm">{t('ibanPanel.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ibanPanel.hint')}</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>{t('ibanPanel.ibanLabel')}</Label>
          <Input
            placeholder="DE00 0000 0000 0000 0000 00"
            value={form.platform_iban}
            onChange={e => setForm(p => ({ ...p, platform_iban: e.target.value }))}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('ibanPanel.ownerLabel')}</Label>
          <Input
            placeholder="Max Mustermann"
            value={form.platform_iban_owner}
            onChange={e => setForm(p => ({ ...p, platform_iban_owner: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('ibanPanel.bankLabel')}</Label>
          <Input
            placeholder="Sparkasse..."
            value={form.platform_bank}
            onChange={e => setForm(p => ({ ...p, platform_bank: e.target.value }))}
          />
        </div>
        <Button
          className="w-full bg-primary hover:bg-primary/90"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          {t('common.save')}
        </Button>
      </Card>
    </div>
  );
}

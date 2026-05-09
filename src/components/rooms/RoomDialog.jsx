import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Loader2, X, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const EQUIPMENT_SUGGESTIONS = [
  'Staffelei', 'Waschbecken', 'Beamer', 'Leinwand', 'Tische', 'Stühle',
  'Tageslicht', 'Musikanlage', 'Whiteboard', 'Spüle', 'Kühlschrank',
  'Drucker', 'WLAN', 'Klimaanlage', 'Fenster', 'Abzugshaube'
];

export default function RoomDialog({ room, onClose, onSave }) {
  const queryClient = useQueryClient();
  const isEdit = !!room;
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: room?.name || '',
    address: room?.address || '',
    description: room?.description || '',
    capacity: room?.capacity || '',
    size_sqm: room?.size_sqm || '',
    equipment: room?.equipment || [],
    image_urls: room?.image_urls || [],
    is_bookable: room?.is_bookable ?? true,
    notes: room?.notes || '',
  });
  const [customEquip, setCustomEquip] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const toggleEquip = (item) => {
    setForm(p => ({
      ...p,
      equipment: p.equipment.includes(item)
        ? p.equipment.filter(e => e !== item)
        : [...p.equipment, item]
    }));
  };

  const addCustom = () => {
    const val = customEquip.trim();
    if (val && !form.equipment.includes(val)) {
      setForm(p => ({ ...p, equipment: [...p.equipment, val] }));
    }
    setCustomEquip('');
  };

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.entities.Room.update(room.id, data)
      : api.entities.Room.create(data),
    onSuccess: (savedRoom) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success(isEdit ? t('room.updatedSuccess') : t('room.createdSuccess'));
      onSave(savedRoom);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      ...form,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      size_sqm: form.size_sqm ? Number(form.size_sqm) : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? t('room.titleEdit') : t('room.titleCreate')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('room.nameLabel')}</Label>
            <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder={t('room.namePlaceholder')} required />
          </div>
          <div className="space-y-2">
            <Label>{t('room.address')}</Label>
            <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder={t('room.addressPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('room.description')}</Label>
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} placeholder={t('room.descPlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('room.capacity')}</Label>
              <Input type="number" min="1" value={form.capacity} onChange={e => update('capacity', e.target.value)} placeholder="z.B. 12" />
            </div>
            <div className="space-y-2">
              <Label>{t('room.size')}</Label>
              <Input type="number" min="1" value={form.size_sqm} onChange={e => update('size_sqm', e.target.value)} placeholder="z.B. 40" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('room.images')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {form.image_urls.map((url, idx) => (
                <div key={idx} className="relative group aspect-video rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, image_urls: p.image_urls.filter((_, i) => i !== idx) }))}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {!uploadingImg && (
                <label className="aspect-video rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingImg(true);
                    for (const file of files) {
                      const { file_url } = await api.integrations.Core.UploadFile({ file });
                      setForm(p => ({ ...p, image_urls: [...p.image_urls, file_url] }));
                    }
                    setUploadingImg(false);
                  }} />
                  <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">{t('room.addImage')}</span>
                </label>
              )}
              {uploadingImg && (
                <div className="aspect-video rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('room.equipment')}</Label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_SUGGESTIONS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquip(item)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                    form.equipment.includes(item)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={customEquip}
                onChange={e => setCustomEquip(e.target.value)}
                placeholder={t('room.addCustomEquip')}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                className="text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustom}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.equipment.filter(e => !EQUIPMENT_SUGGESTIONS.includes(e)).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {form.equipment.filter(e => !EQUIPMENT_SUGGESTIONS.includes(e)).map(item => (
                  <Badge key={item} variant="secondary" className="gap-1">
                    {item}
                    <button type="button" onClick={() => toggleEquip(item)}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('room.notes')}</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} placeholder={t('room.notesPlaceholder')} />
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Switch checked={form.is_bookable} onCheckedChange={v => update('is_bookable', v)} />
            <Label>{t('room.bookable')}</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? t('common.save') : t('room.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

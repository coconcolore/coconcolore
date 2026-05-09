import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, DoorOpen } from 'lucide-react';
import RoomDialog from '@/components/rooms/RoomDialog';
import { toast } from 'sonner';
import { format, addMinutes } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

export default function DaySlotGenerator({ date, onClose, onSave }) {
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [intervalMin, setIntervalMin] = useState(30);
  const [location, setLocation] = useState('');
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.entities.Room.list('name'),
  });
  const bookableRooms = rooms.filter(r => r.is_bookable);

  const dateStr = format(date, 'yyyy-MM-dd');

  const generateSlots = () => {
    const slots = [];
    let current = new Date(`${dateStr}T${startTime}:00`);
    const end = new Date(`${dateStr}T${endTime}:00`);

    while (current < end) {
      const slotEnd = addMinutes(current, intervalMin);
      if (slotEnd > end) break;
      slots.push({
        start: new Date(current),
        end: slotEnd,
      });
      current = slotEnd;
    }
    return slots;
  };

  const preview = generateSlots();

  const handleCreate = async () => {
    if (preview.length === 0) {
      toast.error(t('dayGenerator.errorNoSlots'));
      return;
    }
    setCreating(true);
    const slotData = preview.map(s => ({
      title: t('dayGenerator.studioTime', { time: format(s.start, 'HH:mm') }),
      start_datetime: s.start.toISOString(),
      end_datetime: s.end.toISOString(),
      location: location || undefined,
      room_id: roomId || undefined,
      max_bookings: 1,
      status: 'frei',
    }));
    await api.entities.CalendarSlot.bulkCreate(slotData);
    toast.success(t('dayGenerator.success', { count: slotData.length, date: format(date, 'dd.MM.yyyy', { locale: dateLocale }) }));
    setCreating(false);
    onSave();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {t('dayGenerator.title')} — {format(date, 'EEE, dd.MM.yyyy', { locale: dateLocale })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('dayGenerator.from')}</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('dayGenerator.to')}</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('dayGenerator.interval')}</Label>
            <select
              value={intervalMin}
              onChange={e => setIntervalMin(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('dayGenerator.room')}</Label>
            {rooms.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowRoomDialog(true)}
                className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition-colors"
              >
                <DoorOpen className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 text-sm text-amber-800">
                  {t('dayGenerator.noRooms')} <span className="underline font-medium">{t('dayGenerator.createRoom')}</span>
                </div>
              </button>
            ) : (
              <Select value={roomId || 'none'} onValueChange={v => setRoomId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dayGenerator.noRoom')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('dayGenerator.noRoom')}</SelectItem>
                  {bookableRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.capacity ? ` (${r.capacity} Pers.)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {showRoomDialog && (
            <RoomDialog
              onClose={() => setShowRoomDialog(false)}
              onSave={() => setShowRoomDialog(false)}
            />
          )}

          {preview.length > 0 && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-sm font-medium text-primary mb-2">{t('dayGenerator.preview', { count: preview.length })}</p>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                {preview.map((s, i) => (
                  <span key={i} className="text-xs bg-white border border-border rounded px-1.5 py-0.5">
                    {format(s.start, 'HH:mm')}–{format(s.end, 'HH:mm')}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={handleCreate} disabled={creating || preview.length === 0}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('dayGenerator.create', { count: preview.length })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

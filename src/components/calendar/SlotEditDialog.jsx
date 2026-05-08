import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import RoomDialog from '@/components/rooms/RoomDialog';

export default function SlotEditDialog({ slot, defaultDate, onClose, onSave }) {
  const isEdit = !!slot;
  const defaultDateStr = defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const [showRoomDialog, setShowRoomDialog] = useState(false);

  const [form, setForm] = useState({
    title: slot?.title || '',
    start_datetime: slot?.start_datetime ? slot.start_datetime.slice(0, 16) : `${defaultDateStr}T09:00`,
    end_datetime: slot?.end_datetime ? slot.end_datetime.slice(0, 16) : `${defaultDateStr}T11:00`,
    location: slot?.location || '',
    room_id: slot?.room_id || '',
    max_bookings: slot?.max_bookings || 1,
    status: slot?.status || 'frei',
    notes: slot?.notes || '',
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.entities.Room.list('name'),
  });

  const bookableRooms = rooms.filter(r => r.is_bookable);

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (isEdit) return api.entities.CalendarSlot.update(slot.id, data);
      return api.entities.CalendarSlot.create(data);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Slot aktualisiert!' : 'Slot erstellt!');
      onSave();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.CalendarSlot.delete(slot.id),
    onSuccess: () => {
      toast.success('Slot gelöscht.');
      onSave();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? 'Slot bearbeiten' : 'Neuen Slot erstellen'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="z.B. Atelierzeit Block A" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="datetime-local" value={form.start_datetime} onChange={e => update('start_datetime', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Ende</Label>
              <Input type="datetime-local" value={form.end_datetime} onChange={e => update('end_datetime', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Raum</Label>
            {rooms.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowRoomDialog(true)}
                className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition-colors"
              >
                <DoorOpen className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 text-sm text-amber-800">
                  Noch keine Räume angelegt. <span className="underline font-medium">Jetzt Raum erstellen →</span>
                </div>
              </button>
            ) : (
              <Select value={form.room_id || 'none'} onValueChange={v => update('room_id', v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Raum auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Raum —</SelectItem>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => update('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frei">Frei</SelectItem>
                  <SelectItem value="gebucht">Gebucht</SelectItem>
                  <SelectItem value="gesperrt">Gesperrt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max. Buchungen</Label>
              <Input type="number" min="1" value={form.max_bookings} onChange={e => update('max_bookings', parseInt(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Interne Notiz</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-between pt-2">
            {isEdit && (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEdit ? 'Speichern' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
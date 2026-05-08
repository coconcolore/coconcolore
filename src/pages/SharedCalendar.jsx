import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import SlotEditDialog from '@/components/calendar/SlotEditDialog';
import DaySlotGenerator from '@/components/calendar/DaySlotGenerator';

const statusColors = {
  frei: 'bg-primary/10 text-primary border-primary/20',
  gebucht: 'bg-amber-100 text-amber-700 border-amber-200',
  gesperrt: 'bg-muted text-muted-foreground border-border'
};
const statusLabels = { frei: 'Frei', gebucht: 'Gebucht', gesperrt: 'Gesperrt' };

export default function SharedCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [editSlot, setEditSlot] = useState(null);
  const [showNewSlot, setShowNewSlot] = useState(false);
  const [showDayGenerator, setShowDayGenerator] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isLocationManager = user?.role === 'location_manager';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin || isLocationManager;
  const isArtist = user?.role === 'kuenstler' || isManager || isAdmin;

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['calendar-slots'],
    queryFn: () => api.entities.CalendarSlot.list('start_datetime')
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.entities.Room.list('name'),
  });

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));

  const bookMutation = useMutation({
    mutationFn: (slot) => api.entities.CalendarSlot.update(slot.id, {
      status: 'gebucht',
      booked_by_email: user.email,
      booked_by_name: user.full_name || user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
      setBookingSlot(null);
      toast.success('Slot erfolgreich gebucht!');
    }
  });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (startOfMonth(currentMonth).getDay() + 6) % 7; // Mon = 0

  const getSlotsForDay = (day) => slots.filter((s) => isSameDay(parseISO(s.start_datetime), day));
  const selectedDaySlots = selectedDay ? getSlotsForDay(selectedDay) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Shared Kalender</h1>
          <p className="text-muted-foreground mt-1">Verfügbare Termine und Slots</p>
        </div>
        {isManager &&
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDayGenerator(true)}>
              <Calendar className="w-4 h-4 mr-2" />Tag freigeben
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowNewSlot(true)}>
              <Plus className="w-4 h-4 mr-2" />Slot hinzufügen
            </Button>
          </div>
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kalender */}
        <Card className="lg:col-span-2 p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-display font-semibold text-lg">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) =>
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            )}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map((day) => {
              const daySlots = getSlotsForDay(day);
              const hasFree = daySlots.some((s) => s.status === 'frei');
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const today = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                  className={`relative p-2 rounded-lg text-sm text-center transition-all hover:bg-accent min-h-[44px] flex flex-col items-center justify-start gap-1
                    ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                    ${today && !isSelected ? 'font-bold ring-2 ring-primary ring-offset-1' : ''}
                    ${!isSameMonth(day, currentMonth) ? 'opacity-30' : ''}
                  `}>
                  
                  <span>{format(day, 'd')}</span>
                  {daySlots.length > 0 &&
                  <div className="flex gap-0.5 flex-wrap justify-center">
                      {hasFree && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      {daySlots.some((s) => s.status === 'gebucht') && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </div>
                  }
                </button>);

            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="bg-[#000000] rounded-full w-2 h-2" />Freie Slots</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Gebucht</span>
          </div>
        </Card>

        {/* Slot-Liste für gewählten Tag */}
        <div className="space-y-3">
          {selectedDay ?
          <>
              <h3 className="font-semibold text-lg">
                {format(selectedDay, 'EEEE, d. MMMM', { locale: de })}
              </h3>
              {isLoading ?
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Lädt...</div> :
            selectedDaySlots.length === 0 ?
            <Card className="p-6 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Keine Slots an diesem Tag</p>
                  {isManager &&
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowNewSlot(true)}>
                      <Plus className="w-3 h-3 mr-1" />Slot erstellen
                    </Button>
              }
                </Card> :
            selectedDaySlots.map((slot) =>
            <Card key={slot.id} className={`p-4 border ${statusColors[slot.status]}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-sm">{slot.title}</p>
                        <Badge className={statusColors[slot.status]}>{statusLabels[slot.status]}</Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(slot.start_datetime), 'HH:mm')} – {format(parseISO(slot.end_datetime), 'HH:mm')}
                        </p>
                        {slot.room_id && roomMap[slot.room_id] && (
                          <p className="flex items-center gap-1 font-medium text-primary">
                            <MapPin className="w-3 h-3" />{roomMap[slot.room_id].name}
                          </p>
                        )}
                        {slot.location && !slot.room_id &&
                    <p className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{slot.location}
                          </p>
                    }
                        {slot.status === 'gebucht' && slot.booked_by_name &&
                    <p className="text-amber-600 font-medium">Gebucht von: {slot.booked_by_name}</p>
                    }
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      {slot.status === 'frei' && isArtist && user?.role === 'kuenstler' &&
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs" onClick={() => setBookingSlot(slot)}>
                          Buchen
                        </Button>
                  }
                      {isManager &&
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditSlot(slot)}>
                          Bearbeiten
                        </Button>
                  }
                    </div>
                  </div>
                </Card>
            )}
            </> :

          <Card className="p-6 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Tag im Kalender auswählen</p>
            </Card>
          }

          {/* Upcoming free slots */}
          {!selectedDay &&
          <div className="space-y-2">
              <h3 className="font-semibold">Nächste freie Slots</h3>
              {slots.filter((s) => s.status === 'frei' && new Date(s.start_datetime) >= new Date()).slice(0, 5).map((slot) =>
            <Card key={slot.id} className="p-3 border border-primary/20 cursor-pointer hover:bg-primary/5 transition-colors"
            onClick={() => setSelectedDay(parseISO(slot.start_datetime))}>
                  <p className="text-sm font-medium">{slot.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(slot.start_datetime), 'dd.MM. HH:mm', { locale: de })} Uhr
                  </p>
                </Card>
            )}
              {slots.filter((s) => s.status === 'frei' && new Date(s.start_datetime) >= new Date()).length === 0 &&
            <p className="text-sm text-muted-foreground">Keine freien Slots verfügbar</p>
            }
            </div>
          }
        </div>
      </div>

      {/* Buchungsbestätigung */}
      <Dialog open={!!bookingSlot} onOpenChange={(o) => !o && setBookingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Slot buchen</DialogTitle>
          </DialogHeader>
          {bookingSlot &&
          <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-xl space-y-2">
                <p className="font-semibold">{bookingSlot.title}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(bookingSlot.start_datetime), 'EEEE, dd.MM.yyyy HH:mm', { locale: de })} –{' '}
                  {format(parseISO(bookingSlot.end_datetime), 'HH:mm')} Uhr
                </p>
                {bookingSlot.location &&
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{bookingSlot.location}
                  </p>
              }
              </div>
              <p className="text-sm text-muted-foreground">
                Diesen Slot für dein Event buchen? Er wird als gebucht markiert und dein Name wird eingetragen.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setBookingSlot(null)}>Abbrechen</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={() => bookMutation.mutate(bookingSlot)} disabled={bookMutation.isPending}>
                  {bookMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Slot buchen
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>

      {/* Slot erstellen / bearbeiten (Manager/Admin) */}
      {(showNewSlot || editSlot) &&
      <SlotEditDialog
        slot={editSlot}
        defaultDate={selectedDay}
        onClose={() => {setShowNewSlot(false);setEditSlot(null);}}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
          setShowNewSlot(false);
          setEditSlot(null);
        }} />

      }

      {/* Tag tagesweise halbstündlich freigeben */}
      {showDayGenerator &&
      <DaySlotGenerator
        date={selectedDay || new Date()}
        onClose={() => setShowDayGenerator(false)}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
          setShowDayGenerator(false);
        }} />

      }
    </div>);

}
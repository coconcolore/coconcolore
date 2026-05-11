import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { pageContainer, fadeUp } from '@/lib/motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import SlotEditDialog from '@/components/calendar/SlotEditDialog';
import DaySlotGenerator from '@/components/calendar/DaySlotGenerator';
import { useTranslation } from 'react-i18next';

export default function SharedCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [editSlot, setEditSlot] = useState(null);
  const [showNewSlot, setShowNewSlot] = useState(false);
  const [showDayGenerator, setShowDayGenerator] = useState(false);
  const { t, i18n } = useTranslation();

  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

  const isAdmin = user?.role === 'admin';
  const isLocationManager = user?.role === 'location_manager';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin || isLocationManager;
  const statusColors = {
    frei: 'bg-primary/10 text-primary border-primary/20',
    gebucht: 'bg-amber-100 text-amber-700 border-amber-200',
    gesperrt: 'bg-muted text-muted-foreground border-border'
  };

  const statusLabels = {
    frei: t('calendar.status.frei'),
    gebucht: t('calendar.status.gebucht'),
    gesperrt: t('calendar.status.gesperrt'),
  };

  const weekdays = [
    t('calendar.weekdays.mo'),
    t('calendar.weekdays.di'),
    t('calendar.weekdays.mi'),
    t('calendar.weekdays.do'),
    t('calendar.weekdays.fr'),
    t('calendar.weekdays.sa'),
    t('calendar.weekdays.so'),
  ];

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['calendar-slots'],
    queryFn: () => api.entities.CalendarSlot.list('start_datetime')
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.entities.Room.list('name'),
  });

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (startOfMonth(currentMonth).getDay() + 6) % 7;

  const getSlotsForDay = (day) => slots.filter((s) => isSameDay(parseISO(s.start_datetime), day));
  const selectedDaySlots = selectedDay ? getSlotsForDay(selectedDay) : [];

  return (
    <motion.div className="space-y-6" variants={pageContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('calendar.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('calendar.subtitle')}</p>
        </div>
        {isManager &&
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDayGenerator(true)}>
              <Calendar className="w-4 h-4 mr-2" />{t('calendar.releaseDay')}
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowNewSlot(true)}>
              <Plus className="w-4 h-4 mr-2" />{t('calendar.addSlot')}
            </Button>
          </div>
        }
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-5">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-display font-semibold text-lg">
              {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {weekdays.map((d) =>
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            )}
          </div>

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

          <div className="flex gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="bg-[#000000] rounded-full w-2 h-2" />{t('calendar.freeSlotsLegend')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{t('calendar.bookedLegend')}</span>
          </div>
        </Card>

        <div className="space-y-3">
          {selectedDay ?
          <>
              <h3 className="font-semibold text-lg">
                {format(selectedDay, 'EEEE, d. MMMM', { locale: dateLocale })}
              </h3>
              {isLoading ?
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />{t('common.loading')}</div> :
            selectedDaySlots.length === 0 ?
            <Card className="p-6 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('calendar.noSlots')}</p>
                  {isManager &&
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowNewSlot(true)}>
                      <Plus className="w-3 h-3 mr-1" />{t('calendar.createSlot')}
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
                    <p className="text-amber-600 font-medium">{t('calendar.bookedFrom')} {slot.booked_by_name}</p>
                    }
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      {isManager &&
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditSlot(slot)}>
                          {t('calendar.edit')}
                        </Button>
                  }
                    </div>
                  </div>
                </Card>
            )}
            </> :

          <Card className="p-6 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('calendar.selectDay')}</p>
            </Card>
          }

          {!selectedDay &&
          <div className="space-y-2">
              <h3 className="font-semibold">{t('calendar.nextFreeSlots')}</h3>
              {slots.filter((s) => s.status === 'frei' && new Date(s.start_datetime) >= new Date()).slice(0, 5).map((slot) =>
            <Card key={slot.id} className="p-3 border border-primary/20 cursor-pointer hover:bg-primary/5 transition-colors"
            onClick={() => setSelectedDay(parseISO(slot.start_datetime))}>
                  <p className="text-sm font-medium">{slot.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(slot.start_datetime), 'dd.MM. HH:mm', { locale: dateLocale })} Uhr
                  </p>
                </Card>
            )}
              {slots.filter((s) => s.status === 'frei' && new Date(s.start_datetime) >= new Date()).length === 0 &&
            <p className="text-sm text-muted-foreground">{t('calendar.noFreeSlots')}</p>
            }
            </div>
          }
        </div>
      </motion.div>

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

      {showDayGenerator &&
      <DaySlotGenerator
        date={selectedDay || new Date()}
        onClose={() => setShowDayGenerator(false)}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
          setShowDayGenerator(false);
        }} />
      }
    </motion.div>);
}

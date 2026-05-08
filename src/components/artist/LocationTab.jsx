import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import RoomDialog from '@/components/rooms/RoomDialog';

export default function LocationTab() {
  const queryClient = useQueryClient();
  const [editRoom, setEditRoom] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.entities.Room.list('name'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Room.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Raum gelöscht.');
    },
  });

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    setShowNew(false);
    setEditRoom(null);
  };

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Räume des Ateliers</h3>
            <p className="text-sm text-muted-foreground">Räume anlegen und Ausstattung definieren – sie sind dann in Kalender-Slots buchbar.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />Raum anlegen
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" />Lädt...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <DoorOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Räume angelegt.</p>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {rooms.map(room => (
              <div key={room.id} className="flex items-start gap-4 p-4 border border-border rounded-xl hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{room.name}</p>
                    {!room.is_bookable && <Badge variant="outline" className="text-xs text-muted-foreground">Nicht buchbar</Badge>}
                    {room.capacity && <Badge variant="secondary" className="text-xs">{room.capacity} Personen</Badge>}
                    {room.size_sqm && <Badge variant="secondary" className="text-xs">{room.size_sqm} m²</Badge>}
                  </div>
                  {room.description && <p className="text-sm text-muted-foreground mt-1">{room.description}</p>}
                  {room.equipment?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {room.equipment.map(e => (
                        <span key={e} className="px-2 py-0.5 bg-accent text-accent-foreground text-xs rounded-full">{e}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setEditRoom(room)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(room.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(showNew || editRoom) && (
        <RoomDialog
          room={editRoom}
          onClose={() => { setShowNew(false); setEditRoom(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
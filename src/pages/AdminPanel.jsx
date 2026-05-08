import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Users, BookOpen, Settings, ShieldCheck, Eye, Trash2, Pencil, Banknote, CreditCard, ShoppingCart, FileText, Globe, AtSign, Phone, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import StripePayoutPanel from '@/components/admin/StripePayoutPanel';
import LegalTextsTab from '@/components/admin/LegalTextsTab';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  ausstehend_freigabe: 'bg-amber-100 text-amber-700',
  freigegeben_intern: 'bg-blue-100 text-blue-700',
  veroeffentlicht: 'bg-primary/10 text-primary',
  abgelehnt: 'bg-red-100 text-red-700',
  archiviert: 'bg-destructive/10 text-destructive',
};
const statusLabels = {
  entwurf: 'Entwurf',
  ausstehend_freigabe: 'Wartet auf Freigabe',
  freigegeben_intern: 'Intern freigegeben',
  veroeffentlicht: 'Veröffentlicht',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
};
const roleLabels = {
  admin: 'Admin', kuenstler_manager: 'Künstler-Manager',
  kuenstler: 'Künstler', location_manager: 'Location-Manager', user: 'User',
};
const roleColors = {
  admin: 'bg-primary/10 text-primary',
  kuenstler_manager: 'bg-purple-100 text-purple-700',
  kuenstler: 'bg-amber-100 text-amber-700',
  location_manager: 'bg-blue-100 text-blue-700',
  user: 'bg-muted text-muted-foreground',
};

export default function AdminPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commissionInput, setCommissionInput] = useState('');
  const [editCourse, setEditCourse] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [approveDialog, setApproveDialog] = useState(null); // { artistProfile, userRecord }
  const [approveRole, setApproveRole] = useState('kuenstler');

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['all-courses'],
    queryFn: () => api.entities.Course.list('-created_date'),
  });
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => api.entities.User.list(),
  });
  const { data: artistProfiles = [] } = useQuery({
    queryKey: ['all-artist-profiles'],
    queryFn: () => api.entities.ArtistProfile.list(),
  });
  const { data: settings = [] } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.entities.PlatformSettings.list(),
  });
  const { data: payouts = [] } = useQuery({
    queryKey: ['all-payouts'],
    queryFn: () => api.entities.PayoutRequest.list('-created_date'),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ['all-bookings-admin'],
    queryFn: () => api.entities.Booking.filter({ payment_status: 'bezahlt' }),
  });

  const currentSettings = settings[0];
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin;

  const approveCourseMutation = useMutation({
    mutationFn: ({ id }) => api.entities.Course.update(id, { status: 'freigegeben_intern' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success('Kurs intern freigegeben.'); },
    onError: (error) => {
      toast.error(error?.message || 'Freigabe fehlgeschlagen. Bitte Künstlerfreigabe und Kursdaten prüfen.');
    },
  });
  const publishCourseMutation = useMutation({
    mutationFn: ({ id }) => api.entities.Course.update(id, { status: 'veroeffentlicht' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success('Kurs veröffentlicht!'); },
    onError: (error) => {
      toast.error(error?.message || 'Veröffentlichung fehlgeschlagen.');
    },
  });
  const rejectCourseMutation = useMutation({
    mutationFn: ({ id, admin_notes }) => api.entities.Course.update(id, { status: 'abgelehnt', admin_notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success('Kurs abgelehnt.'); },
  });
  const deleteCourseMutation = useMutation({
    mutationFn: (id) => api.entities.Course.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success('Kurs gelöscht.'); },
  });
  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Course.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); setEditCourse(null); toast.success('Kurs aktualisiert.'); },
  });
  const approveArtistMutation = useMutation({
    mutationFn: async ({ profileId, userId, role, userEmail }) => {
      await api.entities.ArtistProfile.update(profileId, { is_approved: true });

      if (userId) {
        await api.entities.User.update(userId, { role });
        return;
      }

      // Fallback: if userId was not found (e.g. email casing mismatch), update by email.
      if (userEmail) {
        const normalized = String(userEmail).toLowerCase();
        const allUsers = await api.entities.User.list();
        const matched = allUsers.find((u) => String(u.email || '').toLowerCase() === normalized);
        if (matched?.id) {
          await api.entities.User.update(matched.id, { role });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-artist-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setApproveDialog(null);
      toast.success('Künstler freigeschaltet!');
    },
  });

  const openApproveDialog = (ap) => {
    const artistEmail = (ap.user_email || '').toLowerCase();
    const matchedUser = users.find(u => (u.email || '').toLowerCase() === artistEmail);
    setApproveDialog({ artistProfile: ap, userRecord: matchedUser });
    setApproveRole('kuenstler');
  };
  const setRoleMutation = useMutation({
    mutationFn: ({ id, role }) => api.entities.User.update(id, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-users'] }); toast.success('Rolle aktualisiert!'); },
  });
  const saveSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (currentSettings) return api.entities.PlatformSettings.update(currentSettings.id, data);
      return api.entities.PlatformSettings.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['platform-settings'] }); toast.success('Einstellungen gespeichert!'); },
  });
  const updatePayoutMutation = useMutation({
    mutationFn: ({ id, status }) => api.entities.PayoutRequest.update(id, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-payouts'] }); toast.success('Auszahlung aktualisiert.'); },
  });

  const pendingCourses = courses.filter(c => c.status === 'ausstehend_freigabe');
  const pendingPayouts = payouts.filter(p => p.status === 'beantragt');
  const approvedEmails = new Set(artistProfiles.map(ap => (ap.user_email || '').toLowerCase()));
  const pendingUsers = users.filter(
    u => u.role === 'user' && !approvedEmails.has((u.email || '').toLowerCase()),
  );
  const totalGross = bookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  const totalCommission = bookings.reduce((sum, b) => sum + (b.amount_commission || 0), 0);
  const totalArtists = bookings.reduce((sum, b) => sum + (b.amount_artist || 0), 0);

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Profil erstellen</h2>
        <p className="text-muted-foreground">Vervollständige links dein Profil.</p>
      </div>
    );
  }

  const openEdit = (course) => {
    setEditCourse(course);
    setEditForm({ title: course.title, description: course.description, price: course.price, location: course.location || '' });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          {isAdmin ? 'Admin-Panel' : 'Manager-Panel'}
        </h1>
        <p className="text-muted-foreground mt-1">Plattform verwalten</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display text-amber-600">{pendingCourses.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Zur inhaltlichen Prüfung</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display text-amber-600">{pendingPayouts.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Auszahlungen</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display">{courses.filter(c => c.status === 'veroeffentlicht').length}</p>
          <p className="text-sm text-muted-foreground mt-1">Aktive Kurse</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display text-primary">{bookings.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Buchungen bezahlt</p>
        </Card>
      </div>

      <Tabs defaultValue="kurse">
        <TabsList className={`grid w-full max-w-3xl ${isAdmin ? 'grid-cols-8' : 'grid-cols-6'}`}>
          <TabsTrigger value="kurse" className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />Kurse
            {pendingCourses.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingCourses.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="buchungen" className="flex items-center gap-1">
            <ShoppingCart className="w-4 h-4" />Buchungen
          </TabsTrigger>
          <TabsTrigger value="auszahlungen" className="flex items-center gap-1">
            <Banknote className="w-4 h-4" />Auszahlungen
            {pendingPayouts.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingPayouts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="kuenstler" className="flex items-center gap-1">
            Künstler
            {pendingUsers.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingUsers.length}</span>}
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" />User</TabsTrigger>}
          <TabsTrigger value="stripe"><CreditCard className="w-4 h-4 mr-1" />Stripe</TabsTrigger>
          {isManager && <TabsTrigger value="rechtstexte"><FileText className="w-4 h-4 mr-1" />Rechtstexte</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Settings</TabsTrigger>}
        </TabsList>

        {/* KURSE */}
        <TabsContent value="kurse" className="space-y-3 mt-6">
          <h2 className="font-semibold text-lg">Alle Kurse</h2>
          <Card className="p-4 border border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-800">
              Workflow: <strong>ausstehend_freigabe</strong> zuerst inhaltlich auf <strong>freigegeben_intern</strong> setzen,
              danach separat auf <strong>veroeffentlicht</strong> veröffentlichen. Ablehnungen benötigen einen Grund.
            </p>
          </Card>
          {coursesLoading ? <Skeleton className="h-20" /> : courses.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Keine Kurse vorhanden</p>
          ) : courses.map(course => (
            <Card key={course.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold truncate">{course.title}</p>
                    <Badge className={statusColors[course.status]}>{statusLabels[course.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{course.artist_name || course.artist_email} · {course.price?.toFixed(2)} €</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link to={course.status === 'veroeffentlicht' ? `/kurs/${course.id}` : `/kurs/${course.id}?preview=true`} target="_blank">
                    <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                  </Link>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(course)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {course.status === 'ausstehend_freigabe' && (
                    <>
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => approveCourseMutation.mutate({ id: course.id })}>
                        <CheckCircle className="w-4 h-4 mr-1" />Intern freigeben
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const note = window.prompt('Ablehnungsgrund für den Künstler:');
                          if (!note || !note.trim()) {
                            toast.error('Bitte einen Ablehnungsgrund eingeben.');
                            return;
                          }
                          rejectCourseMutation.mutate({ id: course.id, admin_notes: note.trim() });
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />Ablehnen
                      </Button>
                    </>
                  )}
                  {course.status === 'freigegeben_intern' && (
                    <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => publishCourseMutation.mutate({ id: course.id })}>
                      <CheckCircle className="w-4 h-4 mr-1" />Veröffentlichen
                    </Button>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kurs löschen?</AlertDialogTitle>
                          <AlertDialogDescription>„{course.title}" wird dauerhaft gelöscht.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteCourseMutation.mutate(course.id)}>
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* BUCHUNGEN */}
        <TabsContent value="buchungen" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display text-primary">{totalGross.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">Gesamtumsatz (brutto)</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display">{totalCommission.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">Plattform-Provision</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display">{totalArtists.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">An Künstler</p>
            </Card>
          </div>

          <div>
            <h2 className="font-semibold text-lg mb-3">Alle Buchungen ({bookings.length})</h2>
            {bookings.length === 0 ? (
              <div className="text-center py-12 bg-muted/50 rounded-2xl">
                <ShoppingCart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">Noch keine bezahlten Buchungen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map(b => {
                  const course = courses.find(c => c.id === b.course_id);
                  return (
                    <Card key={b.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{b.customer_name || b.customer_email}</p>
                          <p className="text-xs text-muted-foreground">{b.customer_email}</p>
                          {course && <p className="text-xs text-muted-foreground mt-0.5">Kurs: {course.title}</p>}
                          <p className="text-xs text-muted-foreground">{format(new Date(b.created_date), 'dd. MMM yyyy', { locale: de })}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{(b.amount_total || 0).toFixed(2)} €</p>
                          <p className="text-xs text-primary font-medium">Provision: {(b.amount_commission || 0).toFixed(2)} €</p>
                          <p className="text-xs text-muted-foreground">Künstler: {(b.amount_artist || 0).toFixed(2)} €</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* AUSZAHLUNGEN */}
        <TabsContent value="auszahlungen" className="space-y-3 mt-6">
          <h2 className="font-semibold text-lg">Auszahlungsanträge</h2>
          {payouts.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Keine Auszahlungsanträge</p>
          ) : payouts.map(p => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.artist_name || p.artist_email}</p>
                  <p className="text-sm text-muted-foreground font-mono">{p.iban}</p>
                  <p className="text-sm font-bold text-primary mt-1">{p.amount?.toFixed(2)} €</p>
                  {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={p.status === 'beantragt' ? 'bg-amber-100 text-amber-700' : p.status === 'verarbeitet' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                    {p.status === 'beantragt' ? 'Beantragt' : p.status === 'verarbeitet' ? 'Verarbeitet' : 'Abgelehnt'}
                  </Badge>
                  {p.status === 'beantragt' && (
                    <>
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: 'verarbeitet' })}>
                        <CheckCircle className="w-4 h-4 mr-1" />Verarbeitet
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: 'abgelehnt' })}>
                        <XCircle className="w-4 h-4 mr-1" />Ablehnen
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* KÜNSTLER */}
        <TabsContent value="kuenstler" className="space-y-6 mt-6">

          {/* Neue Registrierungen (role=user, noch kein ArtistProfile) */}
          {pendingUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">Neue Registrierungen</h2>
                <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingUsers.length}</span>
              </div>
              <Card className="p-3 border border-amber-200 bg-amber-50">
                <p className="text-xs text-amber-800">Diese Nutzer haben sich registriert, aber noch keine Rolle erhalten. Hier direkt eine Rolle zuweisen.</p>
              </Card>
              {pendingUsers.map(u => (
                <Card key={u.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground text-sm">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{u.full_name || '(kein Name)'}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 text-xs">Wartet</Badge>
                      {u.email !== user?.email && (
                        <Select
                          defaultValue="user"
                          onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue placeholder="Rolle wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User (keine Änderung)</SelectItem>
                            <SelectItem value="kuenstler">Künstler</SelectItem>
                            <SelectItem value="kuenstler_manager">Künstler-Manager</SelectItem>
                            <SelectItem value="location_manager">Location-Manager</SelectItem>
                            {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Bestehende Künstler-Profile */}
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Künstler-Profile</h2>
            {artistProfiles.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">Noch keine Künstlerprofile</p>
            ) : artistProfiles.map(ap => (
              <Card key={ap.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ap.avatar_url ? (
                      <img src={ap.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                        {ap.display_name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{ap.display_name}</p>
                      <p className="text-sm text-muted-foreground">{ap.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ap.is_approved ? (
                      <Badge className="bg-primary/10 text-primary">Freigeschaltet</Badge>
                    ) : (
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => openApproveDialog(ap)}>
                        <CheckCircle className="w-4 h-4 mr-1" />Freischalten
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* USER – nur Admin */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-3 mt-6">
            <h2 className="font-semibold text-lg">Alle User</h2>
            {usersLoading ? <Skeleton className="h-20" /> : users.map(u => (
              <Card key={u.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{u.full_name || '(kein Name)'}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={roleColors[u.role] || 'bg-muted text-muted-foreground'}>
                      {roleLabels[u.role] || u.role}
                    </Badge>
                    {u.email !== user?.email && (
                      <Select
                        defaultValue={u.role}
                        onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="kuenstler">Künstler</SelectItem>
                          <SelectItem value="kuenstler_manager">Künstler-Manager</SelectItem>
                          <SelectItem value="location_manager">Location-Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        )}

        {/* STRIPE PAYOUTS */}
        <TabsContent value="stripe" className="mt-6">
          <StripePayoutPanel />
        </TabsContent>

        {/* RECHTSTEXTE – Admin & Manager */}
        {isManager && (
          <TabsContent value="rechtstexte" className="mt-6">
            <LegalTextsTab />
          </TabsContent>
        )}

        {/* SETTINGS – nur Admin */}
        {isAdmin && (
          <TabsContent value="settings" className="mt-6">
            <Card className="p-6 max-w-md space-y-5">
              <h2 className="font-semibold text-lg">Plattform-Einstellungen</h2>
              <div className="space-y-2">
                <Label>Provision (%)</Label>
                <Input
                  type="number" min="0" max="100"
                  defaultValue={currentSettings?.commission_percent ?? 15}
                  onChange={e => setCommissionInput(e.target.value)}
                  placeholder="15"
                />
                <p className="text-xs text-muted-foreground">Anteil der Plattform bei jeder Buchung</p>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => saveSettingsMutation.mutate({ commission_percent: parseFloat(commissionInput) || 15 })}
                disabled={saveSettingsMutation.isPending}
              >
                Speichern
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Approve Artist Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(o) => !o && setApproveDialog(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Künstlerprofil prüfen & freischalten</DialogTitle>
          </DialogHeader>
          {approveDialog && (() => {
            const ap = approveDialog.artistProfile;
            const Section = ({ title, children }) => (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
                <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">{children}</div>
              </div>
            );
            const Row = ({ label, value }) =>
              value ? (
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium break-words">{value}</span>
                </div>
              ) : null;

            return (
              <div className="space-y-5 pt-1">

                {/* Header: Avatar + Name + E-Mail + Datum */}
                <div className="flex items-center gap-4">
                  {ap.avatar_url ? (
                    <img src={ap.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-2xl shrink-0">
                      {ap.display_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <p className="font-bold text-xl">{ap.display_name || '(kein Name)'}</p>
                    <p className="text-sm text-muted-foreground">{ap.user_email}</p>
                    {ap.created_date && (
                      <p className="text-xs text-muted-foreground">
                        Registriert: {format(new Date(ap.created_date), 'dd. MMM yyyy, HH:mm', { locale: de })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Biographie */}
                {ap.bio && (
                  <Section title="Biographie">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{ap.bio}</p>
                  </Section>
                )}

                {/* Schwerpunkte */}
                {ap.specialties?.length > 0 && (
                  <Section title="Schwerpunkte">
                    <div className="flex flex-wrap gap-1.5">
                      {ap.specialties.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{s}</span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Kontakt */}
                {(ap.phone || ap.website || ap.instagram) && (
                  <Section title="Kontakt">
                    <Row label="Telefon" value={ap.phone} />
                    {ap.website && (
                      <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                        <span className="text-muted-foreground">Website</span>
                        <a href={ap.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 break-all">{ap.website}</a>
                      </div>
                    )}
                    <Row label="Instagram" value={ap.instagram} />
                  </Section>
                )}

                {/* Rechnungsdaten */}
                {(ap.invoice_name || ap.invoice_street || ap.invoice_city || ap.invoice_tax_id || ap.invoice_bank_info || ap.iban) && (
                  <Section title="Rechnungsdaten">
                    <Row label="Rechnungsname" value={ap.invoice_name} />
                    <Row label="Straße" value={ap.invoice_street} />
                    <Row label="Adresszusatz" value={ap.invoice_address} />
                    <Row label="PLZ / Ort" value={[ap.invoice_zip, ap.invoice_city].filter(Boolean).join(' ') || null} />
                    <Row label="Land" value={ap.invoice_country !== 'Deutschland' ? ap.invoice_country : null} />
                    <Row label="Steuernummer" value={ap.invoice_tax_id} />
                    <Row label="Bankverbindung" value={ap.invoice_bank_info} />
                    <Row label="IBAN" value={ap.iban} />
                  </Section>
                )}

                {/* Stripe */}
                {ap.stripe_account_id && (
                  <Section title="Stripe">
                    <Row label="Account-ID" value={ap.stripe_account_id} />
                    <Row label="Onboarding" value={ap.stripe_onboarding_complete ? 'Abgeschlossen' : 'Ausstehend'} />
                  </Section>
                )}

                <hr className="border-border" />

                {/* Rolle zuweisen */}
                <div className="space-y-2">
                  <Label>Rolle zuweisen</Label>
                  <Select value={approveRole} onValueChange={setApproveRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="kuenstler">Künstler</SelectItem>
                      {isAdmin && <SelectItem value="kuenstler_manager">Künstler-Manager</SelectItem>}
                      {isAdmin && <SelectItem value="location_manager">Location-Manager</SelectItem>}
                      {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Diese Rolle wird dem User-Konto zugewiesen.</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setApproveDialog(null)}>Abbrechen</Button>
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    disabled={approveArtistMutation.isPending}
                    onClick={() => approveArtistMutation.mutate({
                      profileId: ap.id,
                      userId: approveDialog.userRecord?.id,
                      userEmail: ap.user_email,
                      role: approveRole,
                    })}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />Freischalten & Rolle setzen
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog open={!!editCourse} onOpenChange={(o) => !o && setEditCourse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Kurs bearbeiten</DialogTitle>
          </DialogHeader>
          {editCourse && <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={editForm.title || ''} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea value={editForm.description || ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preis (€)</Label>
                <Input type="number" step="0.01" value={editForm.price || ''} onChange={e => setEditForm(p => ({ ...p, price: parseFloat(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Ort</Label>
                <Input value={editForm.location || ''} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditCourse(null)}>Abbrechen</Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => updateCourseMutation.mutate({ id: editCourse.id, data: editForm })}>
                Speichern
              </Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { pageContainer, fadeUp } from '@/lib/motion';
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
import { CheckCircle, XCircle, Users, BookOpen, Settings, ShieldCheck, Eye, Trash2, Pencil, Banknote, CreditCard, ShoppingCart, FileText, Globe, AtSign, Phone, MapPin, ImagePlus, Loader2, X, Star } from 'lucide-react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import IbanSettingsPanel from '@/components/admin/IbanSettingsPanel';
import LegalTextsTab from '@/components/admin/LegalTextsTab';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  ausstehend_freigabe: 'bg-amber-100 text-amber-700',
  freigegeben_intern: 'bg-blue-100 text-blue-700',
  veroeffentlicht: 'bg-primary/10 text-primary',
  abgelehnt: 'bg-red-100 text-red-700',
  archiviert: 'bg-destructive/10 text-destructive',
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [approveDialog, setApproveDialog] = useState(null);
  const [approveRole, setApproveRole] = useState('kuenstler');
  const { t, i18n } = useTranslation();

  const dateLocale = i18n.language?.startsWith('de') ? de : enUS;

  const statusLabels = {
    entwurf: t('courses.status.entwurf'),
    ausstehend_freigabe: t('courses.status.ausstehend_freigabe'),
    freigegeben_intern: t('courses.status.freigegeben_intern'),
    veroeffentlicht: t('courses.status.veroeffentlicht'),
    abgelehnt: t('courses.status.abgelehnt'),
    archiviert: t('courses.status.archiviert'),
  };

  const roleLabels = {
    admin: t('admin.roles.admin'),
    kuenstler_manager: t('admin.roles.kuenstler_manager'),
    kuenstler: t('admin.roles.kuenstler'),
    location_manager: t('admin.roles.location_manager'),
    user: t('admin.roles.user'),
  };

  const { data: courses = [], isLoading: coursesLoading } = useQuery({ queryKey: ['all-courses'], queryFn: () => api.entities.Course.list('-created_date') });
  const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ['all-users'], queryFn: () => api.entities.User.list() });
  const { data: artistProfiles = [] } = useQuery({ queryKey: ['all-artist-profiles'], queryFn: () => api.entities.ArtistProfile.list() });
  const { data: settings = [] } = useQuery({ queryKey: ['platform-settings'], queryFn: () => api.entities.PlatformSettings.list() });
  const { data: payouts = [] } = useQuery({ queryKey: ['all-payouts'], queryFn: () => api.entities.PayoutRequest.list('-created_date') });
  const { data: bookings = [] } = useQuery({ queryKey: ['all-bookings-admin'], queryFn: () => api.entities.Booking.list('-created_date') });

  const currentSettings = settings[0];
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin;

  const approveCourseMutation = useMutation({
    mutationFn: ({ id }) => api.entities.Course.update(id, { status: 'veroeffentlicht' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success(t('admin.courses.published')); },
    onError: (error) => { toast.error(error?.message || t('admin.courses.approveError')); },
  });
  const publishCourseMutation = useMutation({
    mutationFn: ({ id }) => api.entities.Course.update(id, { status: 'veroeffentlicht' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success(t('admin.courses.published')); },
    onError: (error) => { toast.error(error?.message || t('admin.courses.publishError')); },
  });
  const rejectCourseMutation = useMutation({
    mutationFn: ({ id, admin_notes }) => api.entities.Course.update(id, { status: 'abgelehnt', admin_notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success(t('admin.courses.rejected')); },
  });
  const deleteCourseMutation = useMutation({
    mutationFn: (id) => api.entities.Course.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); toast.success(t('admin.courses.deleted')); },
  });
  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Course.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-courses'] }); setEditCourse(null); toast.success(t('admin.courses.updated')); },
    onError: (err) => toast.error(err?.message || 'Speichern fehlgeschlagen'),
  });
  const approveArtistMutation = useMutation({
    mutationFn: async ({ profileId, userId, role, userEmail }) => {
      await api.entities.ArtistProfile.update(profileId, { is_approved: true });
      if (userId) { await api.entities.User.update(userId, { role }); return; }
      if (userEmail) {
        const normalized = String(userEmail).toLowerCase();
        const allUsers = await api.entities.User.list();
        const matched = allUsers.find((u) => String(u.email || '').toLowerCase() === normalized);
        if (matched?.id) await api.entities.User.update(matched.id, { role });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-artist-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setApproveDialog(null);
      toast.success(t('admin.artists.artistApproved'));
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-users'] }); toast.success(t('admin.users.roleUpdated')); },
  });
  const saveSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (currentSettings) return api.entities.PlatformSettings.update(currentSettings.id, data);
      return api.entities.PlatformSettings.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['platform-settings'] }); toast.success(t('admin.settings.saved')); },
  });
  const updatePayoutMutation = useMutation({
    mutationFn: ({ id, status }) => api.entities.PayoutRequest.update(id, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-payouts'] }); toast.success(t('admin.payoutRequests.updated')); },
  });
  const updateBookingMutation = useMutation({
    mutationFn: ({ id, payment_status }) => api.entities.Booking.update(id, { payment_status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-bookings-admin'] }); toast.success(t('admin.bookings.markedPaid')); },
  });

  const pendingCourses = courses.filter(c => c.status === 'ausstehend_freigabe');
  const pendingPayouts = payouts.filter(p => p.status === 'beantragt');
  const approvedEmails = new Set(artistProfiles.map(ap => (ap.user_email || '').toLowerCase()));
  const pendingUsers = users.filter(u => u.role === 'user' && !approvedEmails.has((u.email || '').toLowerCase()));
  const paidBookings = bookings.filter(b => b.payment_status === 'bezahlt');
  const totalGross = paidBookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  const totalCommission = paidBookings.reduce((sum, b) => sum + (b.amount_commission || 0), 0);
  const totalArtists = paidBookings.reduce((sum, b) => sum + (b.amount_artist || 0), 0);

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">{t('admin.profileCreate.title')}</h2>
        <p className="text-muted-foreground">{t('admin.profileCreate.hint')}</p>
      </div>
    );
  }

  const openEdit = (course) => {
    setEditCourse(course);
    const existingUrls = course.image_urls?.length > 0
      ? course.image_urls
      : (course.image_url ? [course.image_url] : []);
    setEditForm({
      title: course.title,
      description: course.description,
      price: course.price,
      location: course.location || '',
      image_url: course.image_url || '',
      image_urls: existingUrls,
    });
  };

  const handleEditImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingImage(true);
    try {
      for (const file of files) {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        setEditForm(p => ({
          ...p,
          image_url: p.image_url || file_url,
          image_urls: [...(p.image_urls || []), file_url],
        }));
      }
    } catch {
      toast.error('Bild-Upload fehlgeschlagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeEditImage = (url) => {
    setEditForm(p => {
      const newUrls = (p.image_urls || []).filter(u => u !== url);
      const newMain = p.image_url === url ? (newUrls[0] || '') : p.image_url;
      return { ...p, image_url: newMain, image_urls: newUrls };
    });
  };

  const setEditMainImage = (url) => {
    setEditForm(p => ({ ...p, image_url: url }));
  };

  return (
    <motion.div className="space-y-8" variants={pageContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          {isAdmin ? t('admin.adminTitle') : t('admin.managerTitle')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('admin.subtitle')}</p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display text-amber-600">{pendingCourses.length}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.pendingReview')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display text-amber-600">{pendingPayouts.length}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.payouts')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display">{courses.filter(c => c.status === 'veroeffentlicht').length}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.activeCourses')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold font-display text-primary">{bookings.length}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.allBookings')}</p>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
      <Tabs defaultValue="kurse">
        <TabsList className={`grid w-full max-w-3xl ${isAdmin ? 'grid-cols-8' : 'grid-cols-6'}`}>
          <TabsTrigger value="kurse" className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />{t('admin.tabs.courses')}
            {pendingCourses.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingCourses.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="buchungen" className="flex items-center gap-1">
            <ShoppingCart className="w-4 h-4" />{t('admin.tabs.bookings')}
          </TabsTrigger>
          <TabsTrigger value="auszahlungen" className="flex items-center gap-1">
            <Banknote className="w-4 h-4" />{t('admin.tabs.payouts')}
            {pendingPayouts.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingPayouts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="kuenstler" className="flex items-center gap-1">
            {t('admin.tabs.artists')}
            {pendingUsers.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{pendingUsers.length}</span>}
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" />{t('admin.tabs.users')}</TabsTrigger>}
          <TabsTrigger value="iban"><Banknote className="w-4 h-4 mr-1" />{t('admin.tabs.iban')}</TabsTrigger>
          {isManager && <TabsTrigger value="rechtstexte"><FileText className="w-4 h-4 mr-1" />{t('admin.tabs.legal')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />{t('admin.tabs.settings')}</TabsTrigger>}
        </TabsList>

        {/* KURSE */}
        <TabsContent value="kurse" className="space-y-3 mt-6">
          <h2 className="font-semibold text-lg">{t('admin.courses.title')}</h2>
          <Card className="p-4 border border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-800">{t('admin.courses.workflow')}</p>
          </Card>
          {coursesLoading ? <Skeleton className="h-20" /> : courses.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{t('admin.courses.noCourses')}</p>
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
                        <CheckCircle className="w-4 h-4 mr-1" />{t('admin.courses.approveIntern')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const note = window.prompt(t('admin.courses.rejectPrompt'));
                        if (!note || !note.trim()) { toast.error(t('admin.courses.rejectEmpty')); return; }
                        rejectCourseMutation.mutate({ id: course.id, admin_notes: note.trim() });
                      }}>
                        <XCircle className="w-4 h-4 mr-1" />{t('admin.courses.reject')}
                      </Button>
                    </>
                  )}
                  {course.status === 'freigegeben_intern' && (
                    <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => approveCourseMutation.mutate({ id: course.id })}>
                      <CheckCircle className="w-4 h-4 mr-1" />{t('admin.courses.publish')}
                    </Button>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.courses.deleteTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('admin.courses.deleteDesc', { title: course.title })}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteCourseMutation.mutate(course.id)}>
                            {t('common.delete')}
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
              <p className="text-sm text-muted-foreground mt-1">{t('invoices.totalRevenue')}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display">{totalCommission.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">{t('invoices.platformCommission')}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display">{totalArtists.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">{t('invoices.toArtists')}</p>
            </Card>
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-3">{t('admin.bookings.title')} ({bookings.length})</h2>
            {bookings.length === 0 ? (
              <div className="text-center py-12 bg-muted/50 rounded-2xl">
                <ShoppingCart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">{t('admin.bookings.noBookings')}</p>
              </div>
            ) : (() => {
              const grouped = bookings.reduce((acc, b) => {
                const key = b.course_id || '__unknown__';
                if (!acc[key]) acc[key] = [];
                acc[key].push(b);
                return acc;
              }, {});
              return (
                <div className="space-y-6">
                  {Object.entries(grouped).map(([courseId, courseBookings]) => {
                    const course = courses.find(c => c.id === courseId);
                    const paidTotal = courseBookings.filter(b => b.payment_status === 'bezahlt').reduce((s, b) => s + (b.amount_total || 0), 0);
                    const pendingCount = courseBookings.filter(b => b.payment_status === 'ausstehend').length;
                    return (
                      <div key={courseId}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-semibold">{course?.title || t('admin.bookings.unknownCourse')}</h3>
                            <p className="text-xs text-muted-foreground">
                              {courseBookings.filter(b => b.payment_status === 'bezahlt').length} {t('admin.bookings.paid')}
                              {pendingCount > 0 && <span className="text-amber-600 ml-2">· {pendingCount} {t('admin.bookings.pending')}</span>}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-primary">{paidTotal.toFixed(2)} €</p>
                        </div>
                        <div className="space-y-2">
                          {courseBookings.map(b => (
                            <Card key={b.id} className="p-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-medium text-sm">{b.customer_name || b.customer_email}</p>
                                    <Badge className={b.payment_status === 'bezahlt' ? 'bg-primary/10 text-primary' : b.payment_status === 'erstattet' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700'}>
                                      {b.payment_status === 'bezahlt' ? t('admin.bookings.paid') : b.payment_status === 'erstattet' ? t('admin.bookings.refunded') : t('admin.bookings.pending')}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{b.customer_email}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(b.created_date), 'dd. MMM yyyy', { locale: dateLocale })}</p>
                                </div>
                                <div className="text-right shrink-0 space-y-1">
                                  <p className="font-bold text-sm">{(b.amount_total || 0).toFixed(2)} €</p>
                                  {b.payment_status === 'ausstehend' && (
                                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs h-7" onClick={() => updateBookingMutation.mutate({ id: b.id, payment_status: 'bezahlt' })}>
                                      <CheckCircle className="w-3 h-3 mr-1" />{t('admin.bookings.markPaid')}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* AUSZAHLUNGEN */}
        <TabsContent value="auszahlungen" className="space-y-3 mt-6">
          <h2 className="font-semibold text-lg">{t('admin.payoutRequests.title')}</h2>
          {payouts.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{t('admin.payoutRequests.none')}</p>
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
                    {p.status === 'beantragt' ? t('admin.payoutRequests.requested') : p.status === 'verarbeitet' ? t('admin.payoutRequests.processed') : t('admin.payoutRequests.rejected')}
                  </Badge>
                  {p.status === 'beantragt' && (
                    <>
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: 'verarbeitet' })}>
                        <CheckCircle className="w-4 h-4 mr-1" />{t('admin.payoutRequests.markProcessed')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: 'abgelehnt' })}>
                        <XCircle className="w-4 h-4 mr-1" />{t('common.cancel')}
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
          {pendingUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">{t('admin.artists.newRegistrations')}</h2>
                <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingUsers.length}</span>
              </div>
              <Card className="p-3 border border-amber-200 bg-amber-50">
                <p className="text-xs text-amber-800">{t('admin.artists.pendingHint')}</p>
              </Card>
              {pendingUsers.map(u => (
                <Card key={u.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground text-sm">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{u.full_name || t('admin.artists.noName')}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 text-xs">{t('admin.artists.waiting')}</Badge>
                      {u.email !== user?.email && (
                        <Select defaultValue="user" onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}>
                          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder={t('admin.artists.assignRole')} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{t('admin.roles.userNoChange')}</SelectItem>
                            <SelectItem value="kuenstler">{t('admin.roles.kuenstler')}</SelectItem>
                            <SelectItem value="kuenstler_manager">{t('admin.roles.kuenstler_manager')}</SelectItem>
                            <SelectItem value="location_manager">{t('admin.roles.location_manager')}</SelectItem>
                            {isAdmin && <SelectItem value="admin">{t('admin.roles.admin')}</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="font-semibold text-lg">{t('admin.artists.artistProfiles')}</h2>
            {artistProfiles.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">{t('admin.artists.noProfiles')}</p>
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
                      <Badge className="bg-primary/10 text-primary">{t('admin.artists.approved')}</Badge>
                    ) : (
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => openApproveDialog(ap)}>
                        <CheckCircle className="w-4 h-4 mr-1" />{t('admin.artists.approve')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* USER */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-3 mt-6">
            <h2 className="font-semibold text-lg">{t('admin.users.title')}</h2>
            {usersLoading ? <Skeleton className="h-20" /> : users.map(u => (
              <Card key={u.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{u.full_name || t('admin.users.noName')}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={roleColors[u.role] || 'bg-muted text-muted-foreground'}>{roleLabels[u.role] || u.role}</Badge>
                    {u.email !== user?.email && (
                      <Select defaultValue={u.role} onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}>
                        <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t('admin.roles.user')}</SelectItem>
                          <SelectItem value="kuenstler">{t('admin.roles.kuenstler')}</SelectItem>
                          <SelectItem value="kuenstler_manager">{t('admin.roles.kuenstler_manager')}</SelectItem>
                          <SelectItem value="location_manager">{t('admin.roles.location_manager')}</SelectItem>
                          <SelectItem value="admin">{t('admin.roles.admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        )}

        <TabsContent value="iban" className="mt-6"><IbanSettingsPanel /></TabsContent>
        {isManager && <TabsContent value="rechtstexte" className="mt-6"><LegalTextsTab /></TabsContent>}

        {isAdmin && (
          <TabsContent value="settings" className="mt-6">
            <Card className="p-6 max-w-md space-y-5">
              <h2 className="font-semibold text-lg">{t('admin.settings.title')}</h2>
              <div className="space-y-2">
                <Label>{t('admin.settings.commission')}</Label>
                <Input type="number" min="0" max="100" defaultValue={currentSettings?.commission_percent ?? 15} onChange={e => setCommissionInput(e.target.value)} placeholder="15" />
                <p className="text-xs text-muted-foreground">{t('admin.settings.commissionHint')}</p>
              </div>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => saveSettingsMutation.mutate({ commission_percent: parseFloat(commissionInput) || 15 })} disabled={saveSettingsMutation.isPending}>
                {t('common.save')}
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      </motion.div>

      {/* Approve Artist Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(o) => !o && setApproveDialog(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t('admin.artists.checkAndApprove')}</DialogTitle>
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
                <div className="flex items-center gap-4">
                  {ap.avatar_url ? (
                    <img src={ap.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-2xl shrink-0">
                      {ap.display_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <p className="font-bold text-xl">{ap.display_name || t('admin.artists.noName')}</p>
                    <p className="text-sm text-muted-foreground">{ap.user_email}</p>
                    {ap.created_date && (
                      <p className="text-xs text-muted-foreground">
                        {t('admin.artists.registered')} {format(new Date(ap.created_date), 'dd. MMM yyyy, HH:mm', { locale: dateLocale })}
                      </p>
                    )}
                  </div>
                </div>

                {ap.bio && <Section title={t('admin.artists.biography')}><p className="text-sm leading-relaxed whitespace-pre-wrap">{ap.bio}</p></Section>}

                {ap.specialties?.length > 0 && (
                  <Section title={t('admin.artists.specialties')}>
                    <div className="flex flex-wrap gap-1.5">
                      {ap.specialties.map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{s}</span>)}
                    </div>
                  </Section>
                )}

                {(ap.phone || ap.website || ap.instagram) && (
                  <Section title={t('admin.artists.contact')}>
                    <Row label={t('admin.artists.phone')} value={ap.phone} />
                    {ap.website && (
                      <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                        <span className="text-muted-foreground">{t('admin.artists.website')}</span>
                        <a href={ap.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 break-all">{ap.website}</a>
                      </div>
                    )}
                    <Row label={t('admin.artists.instagram')} value={ap.instagram} />
                  </Section>
                )}

                {(ap.invoice_name || ap.invoice_street || ap.invoice_city || ap.invoice_tax_id || ap.invoice_bank_info || ap.iban) && (
                  <Section title={t('admin.artists.invoiceData')}>
                    <Row label={t('admin.artists.invoiceName')} value={ap.invoice_name} />
                    <Row label={t('admin.artists.street')} value={ap.invoice_street} />
                    <Row label={t('admin.artists.addressExtra')} value={ap.invoice_address} />
                    <Row label={t('admin.artists.zipCity')} value={[ap.invoice_zip, ap.invoice_city].filter(Boolean).join(' ') || null} />
                    <Row label={t('admin.artists.country')} value={ap.invoice_country !== 'Deutschland' ? ap.invoice_country : null} />
                    <Row label={t('admin.artists.taxId')} value={ap.invoice_tax_id} />
                    <Row label={t('admin.artists.bankInfo')} value={ap.invoice_bank_info} />
                    <Row label={t('admin.artists.iban')} value={ap.iban} />
                  </Section>
                )}

                {ap.stripe_account_id && (
                  <Section title="Stripe">
                    <Row label={t('admin.artists.accountId')} value={ap.stripe_account_id} />
                    <Row label={t('admin.artists.onboarding')} value={ap.stripe_onboarding_complete ? t('admin.artists.onboardingComplete') : t('admin.artists.onboardingPending')} />
                  </Section>
                )}

                <hr className="border-border" />

                <div className="space-y-2">
                  <Label>{t('admin.artists.assignRoleLabel')}</Label>
                  <Select value={approveRole} onValueChange={setApproveRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t('admin.roles.user')}</SelectItem>
                      <SelectItem value="kuenstler">{t('admin.roles.kuenstler')}</SelectItem>
                      {isAdmin && <SelectItem value="kuenstler_manager">{t('admin.roles.kuenstler_manager')}</SelectItem>}
                      {isAdmin && <SelectItem value="location_manager">{t('admin.roles.location_manager')}</SelectItem>}
                      {isAdmin && <SelectItem value="admin">{t('admin.roles.admin')}</SelectItem>}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('admin.artists.roleHint')}</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setApproveDialog(null)}>{t('common.cancel')}</Button>
                  <Button className="bg-primary hover:bg-primary/90" disabled={approveArtistMutation.isPending}
                    onClick={() => approveArtistMutation.mutate({ profileId: ap.id, userId: approveDialog.userRecord?.id, userEmail: ap.user_email, role: approveRole })}>
                    <CheckCircle className="w-4 h-4 mr-1" />{t('admin.artists.approveAndSet')}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog open={!!editCourse} onOpenChange={(o) => !o && setEditCourse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t('admin.editCourse.title')}</DialogTitle>
          </DialogHeader>
          {editCourse && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>{t('admin.editCourse.titleLabel')}</Label>
                <Input value={editForm.title || ''} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.editCourse.description')}</Label>
                <Textarea value={editForm.description || ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('admin.editCourse.price')}</Label>
                  <Input type="number" step="0.01" value={editForm.price || ''} onChange={e => setEditForm(p => ({ ...p, price: parseFloat(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.editCourse.location')}</Label>
                  <Input value={editForm.location || ''} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
                </div>
              </div>

              {/* Image management */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Bilder ({(editForm.image_urls || []).length})</Label>
                  <p className="text-xs text-muted-foreground">Stern = Hauptbild (Cover)</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(editForm.image_urls || []).map((url, i) => (
                    <div key={i} className="relative group aspect-video rounded-lg overflow-hidden bg-muted border border-border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          title="Als Hauptbild setzen"
                          onClick={() => setEditMainImage(url)}
                          className={`p-1.5 rounded-full transition-colors ${editForm.image_url === url ? 'bg-amber-400 text-white' : 'bg-white/80 text-foreground hover:bg-amber-400 hover:text-white'}`}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Bild entfernen"
                          onClick={() => removeEditImage(url)}
                          className="p-1.5 bg-white/80 text-foreground hover:bg-destructive hover:text-white rounded-full transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {editForm.image_url === url && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-400 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-2.5 h-2.5" /> Cover
                        </div>
                      )}
                    </div>
                  ))}

                  <label className={`aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/50 flex flex-col items-center justify-center gap-1 ${uploadingImage ? 'opacity-60 pointer-events-none' : ''}`}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleEditImageUpload} disabled={uploadingImage} />
                    {uploadingImage ? (
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Hinzufügen</span>
                      </>
                    )}
                  </label>
                </div>

                {(editForm.image_urls || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Noch keine Bilder — lade Bilder hoch um die Galerie zu füllen.</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditCourse(null)}>{t('common.cancel')}</Button>
                <Button className="bg-primary hover:bg-primary/90" disabled={updateCourseMutation.isPending} onClick={() => updateCourseMutation.mutate({ id: editCourse.id, data: editForm })}>
                  {updateCourseMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('common.save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

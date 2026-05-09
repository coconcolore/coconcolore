import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Eye, TrendingUp, Euro, Send, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import InvoicePreview from '@/components/invoices/InvoicePreview';
import { useTranslation } from 'react-i18next';

const statusColors = {
  entwurf: 'bg-muted text-muted-foreground',
  gesendet: 'bg-accent text-accent-foreground',
  bezahlt: 'bg-primary/10 text-primary',
  storniert: 'bg-destructive/10 text-destructive',
};

export default function Invoices() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'kuenstler_manager' || isAdmin;
  const isArtistOnly = user?.role === 'kuenstler';

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.entities.Invoice.list('-created_date'),
    enabled: isManager,
  });

  const { data: allBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['all-bookings-paid'],
    queryFn: () => api.entities.Booking.filter({ payment_status: 'bezahlt' }),
    enabled: isManager,
  });

  const { data: myCourses = [] } = useQuery({
    queryKey: ['my-courses-invoices', user?.email],
    queryFn: () => api.entities.Course.filter({ artist_email: user?.email }),
    enabled: !!user?.email && isArtistOnly,
  });

  const { data: myBookings = [], isLoading: myBookingsLoading } = useQuery({
    queryKey: ['my-bookings-invoices', user?.email],
    queryFn: () => api.entities.Booking.filter({ payment_status: 'bezahlt' }),
    enabled: !!user?.email && isArtistOnly,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.entities.Invoice.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const myCourseIds = new Set(myCourses.map(c => c.id));
  const artistBookings = myBookings.filter(b => myCourseIds.has(b.course_id) && b.payment_status === 'bezahlt');
  const artistTotal = artistBookings.reduce((sum, b) => sum + (b.amount_artist || 0), 0);
  const artistGross = artistBookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  const artistCommission = artistBookings.reduce((sum, b) => sum + (b.amount_commission || 0), 0);

  const totalGross = allBookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  const totalCommission = allBookings.reduce((sum, b) => sum + (b.amount_commission || 0), 0);
  const totalArtists = allBookings.reduce((sum, b) => sum + (b.amount_artist || 0), 0);

  const dateLocale = de;

  if (isArtistOnly) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t('invoices.artistTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('invoices.artistSubtitle')}</p>
        </div>

        {myBookingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display text-primary">{artistTotal.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">{t('invoices.yourRevenue')}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display">{artistGross.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">{t('invoices.totalRevenue')}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold font-display text-muted-foreground">{artistCommission.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground mt-1">{t('invoices.platformCommission')}</p>
            </Card>
          </div>
        )}

        <div>
          <h2 className="font-semibold text-lg mb-3">{t('invoices.individualBookings')} ({artistBookings.length})</h2>
          {myBookingsLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : artistBookings.length === 0 ? (
            <div className="text-center py-16 bg-muted/50 rounded-2xl">
              <TrendingUp className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground">{t('invoices.noPaidBookings')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {artistBookings.map(b => (
                <Card key={b.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{b.customer_name || b.customer_email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(b.created_date), 'dd. MMMM yyyy', { locale: dateLocale })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{(b.amount_artist || 0).toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground">{t('invoices.fromTotal', { amount: (b.amount_total || 0).toFixed(2) })}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t('invoices.managerTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('invoices.managerSubtitle')}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />{t('invoices.newInvoice')}
        </Button>
      </div>

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

      {allBookings.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3">{t('invoices.allBookings')} ({allBookings.length})</h2>
          <div className="space-y-2">
            {allBookings.slice(0, 10).map(b => (
              <Card key={b.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.customer_name || b.customer_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(b.created_date), 'dd.MM.yyyy', { locale: dateLocale })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{(b.amount_total || 0).toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground">{t('invoices.provision', { amount: (b.amount_commission || 0).toFixed(2) })}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <InvoiceForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          isSubmitting={createMutation.isPending}
          nextNumber={`RE-${String(invoices.length + 1).padStart(4, '0')}`}
        />
      )}

      {previewInvoice && (
        <InvoicePreview invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}

      <div>
        <h2 className="font-semibold text-lg mb-3">{t('invoices.invoicesCount')} ({invoices.length})</h2>
        {invoicesLoading ? (
          <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 bg-muted/50 rounded-2xl">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('invoices.noInvoices')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="p-5 hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold">{invoice.invoice_number}</p>
                      <Badge className={statusColors[invoice.status]}>{t(`invoices.status.${invoice.status}`)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                    {invoice.due_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('invoices.due')} {format(new Date(invoice.due_date), 'dd. MMMM yyyy', { locale: dateLocale })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold font-display">{invoice.total_amount?.toFixed(2)} €</span>
                    <Button variant="ghost" size="icon" onClick={() => setPreviewInvoice(invoice)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {invoice.status === 'entwurf' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'gesendet' })}>
                        <Send className="w-3 h-3 mr-1" />{t('common.send')}
                      </Button>
                    )}
                    {invoice.status === 'gesendet' && (
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'bezahlt' })}>
                        <CheckCircle className="w-3 h-3 mr-1" />{t('invoices.markAsPaid')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

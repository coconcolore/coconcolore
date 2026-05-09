import { supabase } from '@/api/client';
import React, { useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Plus, FileText,
  Menu, X, LogOut, ChevronRight, User, ShieldCheck, Palette, CalendarDays, Trash2 } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const role = user?.role || 'user';
  const isPlainUser = role === 'user';

  if (isPlainUser) {
    return <Navigate to="/zugang-wartet" replace />;
  }

  const isAdmin = role === 'admin';
  const isManager = role === 'kuenstler_manager';
  const isArtist = role === 'kuenstler';
  const isLocationManager = role === 'location_manager';

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/kurskatalog', label: t('nav.catalog'), icon: Palette },
    ...(!isLocationManager ? [{ path: '/courses', label: t('nav.myCourses'), icon: BookOpen }] : []),
    ...(!isLocationManager ? [{ path: '/invoices', label: isArtist ? t('nav.revenue') : t('nav.billing'), icon: FileText }] : []),
    ...((isAdmin || isArtist) ? [{ path: '/profil', label: t('nav.profile'), icon: User }] : []),
    { path: '/kalender', label: t('nav.calendar'), icon: CalendarDays },
    ...((isAdmin || isManager) ? [{ path: '/admin', label: isAdmin ? t('nav.adminPanel') : t('nav.managerPanel'), icon: ShieldCheck }] : [])
  ];


  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen &&
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      }

      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-sidebar-border">
                <img src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=1200&auto=format&fit=crop" alt="Atelier cocon coloré" className="w-40 object-contain" />
          <p className="text-xs text-sidebar-foreground/60 mt-1">{user?.full_name || user?.email}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive ?
                  "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20" :
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}>

                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>);

          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          <LanguageSwitcher className="mb-2 px-1" />
          <button
            onClick={() => api.auth.logout()}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors">
            <LogOut className="w-4 h-4" />
            {t('nav.logout')}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 w-full transition-colors">
                <Trash2 className="w-4 h-4" />
                {t('nav.deleteAccount')}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('nav.deleteAccountTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('nav.deleteAccountDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      // 1. Lösche alle Avatar-Bilder des Künstlers
                      const profiles = await api.entities.ArtistProfile.filter({ user_email: user.email });
                      for (const profile of profiles) {
                        if (profile.avatar_url) {
                          try {
                            const urlParts = profile.avatar_url.split('/');
                            const filePath = urlParts.slice(-1)[0];
                            if (filePath) {
                              const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public';
                              await supabase.storage.from(bucket).remove([`uploads/${filePath}`]);
                            }
                          } catch (e) {
                            console.warn('Avatar-Löschfehler:', e);
                          }
                        }
                      }

                      // 2. Lösche alle Kursbilder
                      const courses = await api.entities.Course.filter({ artist_email: user.email });
                      for (const course of courses) {
                        if (course.image_url) {
                          try {
                            const urlParts = course.image_url.split('/');
                            const filePath = urlParts.slice(-1)[0];
                            if (filePath) {
                              const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public';
                              await supabase.storage.from(bucket).remove([`uploads/${filePath}`]);
                            }
                          } catch (e) {
                            console.warn('Kurs-Bildlöschfehler:', e);
                          }
                        }
                      }

                      // 3. Lösche alle Kurse
                      for (const course of courses) {
                        await api.entities.Course.delete(course.id);
                      }

                      // 4. Lösche alle Künstler-Profile
                      for (const profile of profiles) {
                        await api.entities.ArtistProfile.delete(profile.id);
                      }

                      // 5. Lösche alle Buchungen (als Kunde)
                      const bookings = await api.entities.Booking.filter({ customer_email: user.email });
                      for (const booking of bookings) {
                        await api.entities.Booking.delete(booking.id);
                      }

                      // 6. Lösche alle Auszahlungsanträge
                      const payouts = await api.entities.PayoutRequest.filter({ artist_email: user.email });
                      for (const payout of payouts) {
                        await api.entities.PayoutRequest.delete(payout.id);
                      }

                      // 7. Lösche alle Rechnungen
                      const invoices = await api.entities.Invoice.filter({ artist_email: user.email });
                      for (const invoice of invoices) {
                        await api.entities.Invoice.delete(invoice.id);
                      }

                      // 8. Lösche alle Kalender-Slot Buchungen dieses Users
                      const allSlots = await api.entities.CalendarSlot.list();
                      for (const slot of allSlots) {
                        if (slot.booked_by_email === user.email) {
                          await api.entities.CalendarSlot.update(slot.id, { 
                            status: 'frei', 
                            booked_by_email: null, 
                            booked_by_name: null 
                          });
                        }
                      }

                      // 9. Lösche den User
                      await api.entities.User.delete(user.id);

                      // 10. Logout
                      api.auth.logout();
                    } catch (error) {
                      console.error('Fehler beim Löschen des Accounts:', error);
                      toast.error('Fehler beim Löschen des Accounts. Bitte versuche es später erneut.');
                    }
                  }}
                >
                  {t('nav.deleteAccountConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>);

}

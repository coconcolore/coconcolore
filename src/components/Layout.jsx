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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, isLoadingAuth } = useAuth();

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
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/kurskatalog', label: 'Kurskatalog', icon: Palette },
    ...(!isLocationManager ? [{ path: '/courses', label: 'Meine Kurse', icon: BookOpen }] : []),
    ...(!isLocationManager ? [{ path: '/invoices', label: isArtist ? 'Einnahmen' : 'Abrechnung', icon: FileText }] : []),
    ...((isAdmin || isArtist) ? [{ path: '/profil', label: 'Mein Profil', icon: User }] : []),
    { path: '/kalender', label: 'Shared Kalender', icon: CalendarDays },
    ...((isAdmin || isManager) ? [{ path: '/admin', label: isAdmin ? 'Admin-Panel' : 'Manager-Panel', icon: ShieldCheck }] : [])
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
          <button
            onClick={() => api.auth.logout()}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors">
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 w-full transition-colors">
                <Trash2 className="w-4 h-4" />
                Konto und Daten löschen
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konto unwiderruflich löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dein Konto und alle damit verbundenen Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    await api.entities.User.delete(user.id);
                    api.auth.logout();
                  }}
                >
                  Ja, Konto löschen
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
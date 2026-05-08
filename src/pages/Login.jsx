import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get('next') || '/';

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, navigate, next]);

  const getAuthErrorMessage = (error) => {
    if (!error) return 'Unbekannter Fehler bei der Anmeldung.';

    if (error.code === 'over_email_send_rate_limit') {
      return 'Zu viele Registrierungs-E-Mails in kurzer Zeit. Bitte 60 Sekunden warten und erneut versuchen.';
    }

    return error.message || 'Authentifizierung fehlgeschlagen.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supabase) {
      toast.error('Supabase ist nicht konfiguriert. Bitte .env.local prüfen.');
      return;
    }

    setSubmitting(true);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'user'
          }
        }
      });

      setSubmitting(false);

      if (error) {
        toast.error(getAuthErrorMessage(error));
        return;
      }

      toast.success('Registrierung erfolgreich. Dein Zugang wird nach Freischaltung aktiviert.');
      setMode('signin');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setSubmitting(false);

    if (error) {
      toast.error(getAuthErrorMessage(error));
      return;
    }

    toast.success('Erfolgreich eingeloggt');
    navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">{mode === 'signin' ? 'Sign in' : 'Registrieren'}</CardTitle>
            <CardDescription>
              {mode === 'signin'
                ? 'Melde dich mit deinem Account an.'
                : 'Erstelle einen neuen Benutzeraccount.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button type="button" variant={mode === 'signin' ? 'default' : 'outline'} onClick={() => setMode('signin')}>
                Anmelden
              </Button>
              <Button type="button" variant={mode === 'signup' ? 'default' : 'outline'} onClick={() => setMode('signup')}>
                Registrieren
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Max Mustermann"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                {mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          Öffentliche Seiten bleiben erreichbar. Zurück zum{' '}
          <Link to="/kurskatalog-public" className="underline underline-offset-4 hover:text-foreground">
            Kurskatalog
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

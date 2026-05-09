import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { t, i18n } = useTranslation();

  const next = searchParams.get('next') || '/';

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, navigate, next]);

  const getAuthErrorMessage = (error) => {
    if (!error) return t('login.errorUnknown');
    if (error.code === 'over_email_send_rate_limit') return t('login.errorRateLimit');
    return error.message || t('login.errorAuth');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supabase) {
      toast.error(t('login.errorSupabase'));
      return;
    }

    if (!legalAccepted) {
      toast.error(t('login.errorLegal'));
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

      toast.success(t('login.registerSuccess'));
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

    toast.success(t('login.loginSuccess'));
    navigate(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-end">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs font-medium ${i18n.language?.startsWith('de') ? 'bg-muted' : 'text-muted-foreground'}`}
              onClick={() => i18n.changeLanguage('de')}
            >
              DE
            </Button>
            <span className="text-muted-foreground/50 text-xs">|</span>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs font-medium ${!i18n.language?.startsWith('de') ? 'bg-muted' : 'text-muted-foreground'}`}
              onClick={() => i18n.changeLanguage('en')}
            >
              EN
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">{mode === 'signin' ? t('login.signinTitle') : t('login.registerTitle')}</CardTitle>
            <CardDescription>
              {mode === 'signin' ? t('login.signinDesc') : t('login.registerDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button type="button" variant={mode === 'signin' ? 'default' : 'outline'} onClick={() => setMode('signin')}>
                {t('login.signin')}
              </Button>
              <Button type="button" variant={mode === 'signup' ? 'default' : 'outline'} onClick={() => setMode('signup')}>
                {t('login.register')}
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('login.name')}</Label>
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
                <Label htmlFor="email">{t('login.email')}</Label>
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
                <Label htmlFor="password">{t('login.password')}</Label>
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
              <div className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  id="legal-accept"
                  checked={legalAccepted}
                  onCheckedChange={(checked) => setLegalAccepted(Boolean(checked))}
                  className="mt-0.5"
                />
                <label htmlFor="legal-accept" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  {t('login.legalText')}{' '}
                  <Link to="/rechtliches/agb" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                    {t('login.agb')}
                  </Link>{' '}
                  {t('login.and')}{' '}
                  <Link to="/rechtliches/datenschutz" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                    {t('login.datenschutz')}
                  </Link>{' '}
                  {t('login.legalTextEnd')}
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                {mode === 'signin' ? t('login.signin') : t('login.createAccount')}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          {t('login.publicPages')}{' '}
          <Link to="/kurskatalog-public" className="underline underline-offset-4 hover:text-foreground">
            {t('login.catalog')}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

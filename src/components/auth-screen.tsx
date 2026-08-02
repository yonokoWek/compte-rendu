'use client';

import React, { useState, useCallback } from 'react';
import { Phone, Mail, Lock, User, ArrowLeft, Shield, MessageCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/use-t';

interface AuthScreenProps {
  onAuthSuccess: (token: string) => void;
}

type AuthStep = 'contact' | 'verify' | 'setPin' | 'login';
type ContactType = 'whatsapp' | 'email';

type StepData = {
  contact: string;
  contactType: ContactType;
  code: string;
  pin: string;
  pinConfirm: string;
  name: string;
  loginPin: string;
};

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const t = useT();
  const [step, setStep] = useState<AuthStep>('contact');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [contactType, setContactType] = useState<ContactType>('whatsapp');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StepData>({
    contact: '',
    contactType: 'whatsapp',
    code: '',
    pin: '',
    pinConfirm: '',
    name: '',
    loginPin: '',
  });

  const updateData = useCallback(<K extends keyof StepData>(key: K, value: StepData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goBack = useCallback(() => {
    if (step === 'setPin') setStep('verify');
    else if (step === 'verify') setStep('contact');
    else if (step === 'login') setStep('contact');
  }, [step]);

  const handleContactTypeChange = useCallback((value: string) => {
    const ct = value as ContactType;
    setContactType(ct);
    updateData('contactType', ct);
    updateData('contact', '');
  }, [updateData]);

  const handleRegister = useCallback(async () => {
    const contact = data.contact.trim();
    if (!contact) {
      toast.error(contactType === 'whatsapp' ? t('auth.enterPhone') : t('auth.enterEmail'));
      return;
    }
    if (contactType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      toast.error('Adresse email invalide');
      return;
    }
    if (contactType === 'whatsapp' && contact.length < 7) {
      toast.error('Numéro de téléphone invalide');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, contactType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur d\'inscription');
      if (json.code) {
        toast.info(`Code de vérification : ${json.code}`);
      }
      setStep('verify');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  }, [data.contact, contactType, t]);

  const handleVerify = useCallback(async () => {
    const contact = data.contact.trim();
    const code = data.code.trim();
    const pin = data.pin.trim();
    const pinConfirm = data.pinConfirm.trim();
    const name = data.name.trim();

    if (!code) {
      toast.error(t('auth.enterCode'));
      return;
    }
    if (!pin) {
      toast.error(t('auth.setPin'));
      return;
    }
    if (pin.length < 4) {
      toast.error('Le code PIN doit contenir 4 chiffres');
      return;
    }
    if (pin !== pinConfirm) {
      toast.error(t('auth.pinMismatch'));
      return;
    }
    if (!name) {
      toast.error(t('auth.enterName'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, code, pin, name, contactType: data.contactType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur de vérification');
      if (json.token) {
        localStorage.setItem('cr_session_token', json.token);
        onAuthSuccess(json.token);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de vérification');
    } finally {
      setLoading(false);
    }
  }, [data.code, data.pin, data.pinConfirm, data.name, data.contact, onAuthSuccess, t]);

  const handleLogin = useCallback(async () => {
    const contact = data.contact.trim();
    const pin = data.loginPin.trim();

    if (!contact) {
      toast.error(contactType === 'whatsapp' ? t('auth.enterPhone') : t('auth.enterEmail'));
      return;
    }
    if (!pin) {
      toast.error(t('auth.enterPin'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, pin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur de connexion');
      if (json.token) {
        localStorage.setItem('cr_session_token', json.token);
        onAuthSuccess(json.token);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [data.contact, data.loginPin, contactType, onAuthSuccess, t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 30%, #fecaca 60%, #e9d5ff 100%)' }}>
      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="text-center pb-2 pt-6 px-6">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <Shield className="h-7 w-7 text-orange-600" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">{t('app.title')}</CardTitle>
          <CardDescription className="text-sm">{t('app.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          {/* Contact Step / Login Step */}
          {(step === 'contact' || step === 'login') && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Back button for login mode */}
              {step === 'login' && (
                <button
                  onClick={() => setStep('contact')}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('common.back')}
                </button>
              )}

              <div className="text-center mb-2">
                <h3 className="text-lg font-semibold">
                  {step === 'contact' ? (mode === 'register' ? t('auth.createAccount') : t('auth.login')) : t('auth.login')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {step === 'contact' && mode === 'register' && 'Entrez vos coordonnées pour commencer'}
                  {step === 'contact' && mode === 'login' && 'Entrez vos identifiants'}
                  {step === 'login' && 'Entrez votre PIN pour vous connecter'}
                </p>
              </div>

              {/* Contact type tabs (only on contact step) */}
              {step === 'contact' && (
                <Tabs value={contactType} onValueChange={handleContactTypeChange} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
                      <Phone className="h-3.5 w-3.5" />
                      {t('auth.whatsapp')}
                    </TabsTrigger>
                    <TabsTrigger value="email" className="gap-1.5 text-xs">
                      <Mail className="h-3.5 w-3.5" />
                      {t('auth.email')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {/* Contact input */}
              {step !== 'login' && (
                <div className="space-y-2">
                  <Label htmlFor="contact" className="text-xs">
                    {contactType === 'whatsapp' ? t('auth.phoneNumber') : t('auth.email')}
                  </Label>
                  <div className="relative">
                    {contactType === 'whatsapp' ? (
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      id="contact"
                      type={contactType === 'email' ? 'email' : 'tel'}
                      placeholder={contactType === 'whatsapp' ? t('auth.phonePlaceholder') : t('auth.emailPlaceholder')}
                      value={data.contact}
                      onChange={(e) => updateData('contact', e.target.value)}
                      className="pl-10 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRegister();
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Login: Contact display + PIN input */}
              {step === 'login' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{t('auth.account')}</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {contactType === 'whatsapp' ? (
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      )}
                      {data.contact}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPin" className="text-xs">{t('auth.pin')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="loginPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder={t('auth.pin')}
                        value={data.loginPin}
                        onChange={(e) => updateData('loginPin', e.target.value.replace(/\D/g, ''))}
                        className="pl-10 text-sm tracking-widest"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLogin();
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contact step actions */}
              {step === 'contact' && mode === 'register' && (
                <Button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                  {t('auth.sendCode')}
                </Button>
              )}

              {step === 'contact' && mode === 'login' && (
                <Button
                  onClick={() => setStep('login')}
                  disabled={loading || !data.contact.trim()}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {t('auth.continue')}
                </Button>
              )}

              {step === 'login' && (
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  {t('auth.login')}
                </Button>
              )}

              {/* Toggle register/login */}
              {step === 'contact' && (
                <p className="text-center text-xs text-muted-foreground">
                  {mode === 'register' ? (
                    <>
                      {t('auth.alreadyHaveAccount')}{' '}
                      <button
                        onClick={() => setMode('login')}
                        className="text-orange-600 font-medium hover:underline"
                      >
                        {t('auth.login')}
                      </button>
                    </>
                  ) : (
                    <>
                      {t('auth.noAccount')}{' '}
                      <button
                        onClick={() => setMode('register')}
                        className="text-orange-600 font-medium hover:underline"
                      >
                        {t('auth.createAccount')}
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Verification Code Step */}
          {step === 'verify' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </button>

              <div className="text-center">
                <h3 className="text-lg font-semibold">{t('auth.verify')}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('auth.verifyDesc')}{' '}
                  <span className="font-medium text-foreground">{data.contact}</span>
                </p>
              </div>

              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={4}
                  value={data.code}
                  onChange={(value) => updateData('code', value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="text-center text-[11px] text-amber-700 bg-amber-50 rounded-md px-3 py-2">
                {t('auth.sandboxHint')}
              </p>

              <Button
                onClick={() => setStep('setPin')}
                disabled={loading || data.code.length < 4}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {t('auth.continue')}
              </Button>
            </div>
          )}

          {/* Set PIN + Name Step */}
          {step === 'setPin' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </button>

              <div className="text-center">
                <h3 className="text-lg font-semibold">{t('auth.finishSignup')}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('auth.finishSignupDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">
                  {t('auth.fullName')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder={t('auth.enterName')}
                    value={data.name}
                    onChange={(e) => updateData('name', e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin" className="text-xs">
                  {t('auth.pin')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('auth.pinMin')}
                    value={data.pin}
                    onChange={(e) => updateData('pin', e.target.value.replace(/\D/g, ''))}
                    className="pl-10 text-sm tracking-widest"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinConfirm" className="text-xs">
                  {t('auth.confirmPin')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pinConfirm"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('auth.confirmPin')}
                    value={data.pinConfirm}
                    onChange={(e) => updateData('pinConfirm', e.target.value.replace(/\D/g, ''))}
                    className={cn(
                      'pl-10 text-sm tracking-widest',
                      data.pinConfirm && data.pin !== data.pinConfirm && 'border-red-400 focus-visible:ring-red-400'
                    )}
                  />
                </div>
                {data.pinConfirm && data.pin !== data.pinConfirm && (
                  <p className="text-xs text-red-500">{t('auth.pinMismatch')}</p>
                )}
              </div>

              <Button
                onClick={handleVerify}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                {t('auth.createAccountBtn')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

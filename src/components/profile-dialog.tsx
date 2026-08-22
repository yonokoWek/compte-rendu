'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { useT } from '@/lib/use-t';
import { LANGUAGES } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Save, Palette, Globe, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import ThemePicker from '@/components/theme-picker';
import type { Lang } from '@/lib/i18n';

const PDF_COLOR_KEY = 'cr_pdf_color';
const DEFAULT_PDF_COLOR = '#1e3a5f';

const PDF_COLOR_PRESETS = [
  { label: 'Bleu foncé', value: '#1e3a5f' },
  { label: 'Vert forêt', value: '#14532d' },
  { label: 'Bordeaux', value: '#7f1d1d' },
  { label: 'Violet', value: '#5b21b6' },
  { label: 'Anthracite', value: '#374151' },
  { label: 'Teal', value: '#115e59' },
  { label: 'Orange brûlé', value: '#9a3412' },
];

export default function ProfileDialog() {
  const open = useAppStore((s) => s.profileDialogOpen);
  const setOpen = useAppStore((s) => s.setProfileDialogOpen);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const queryClient = useQueryClient();
  const t = useT();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authFetch('/api/profile').then((r) => r.json()),
  });

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [assembly, setAssembly] = React.useState('');
  const [mentor, setMentor] = React.useState('');
  const [pdfColor, setPdfColor] = React.useState(DEFAULT_PDF_COLOR);

  React.useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setAssembly(profile.assembly || '');
      setMentor(profile.mentor || '');
    }
  }, [profile]);

  // Load PDF color from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(PDF_COLOR_KEY);
    if (saved) setPdfColor(saved);
  }, []);

  // Save PDF color to localStorage whenever it changes
  const handlePdfColorChange = (color: string) => {
    setPdfColor(color);
    localStorage.setItem(PDF_COLOR_KEY, color);
  };

  const saveProfile = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; assembly: string; mentor: string }) =>
      authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast.success(t('profile.saved'));
    },
  });

  const handleLanguageChange = React.useCallback(async (newLang: string) => {
    const lang = newLang as Lang;
    setLanguage(lang);
    try {
      await authFetch('/api/auth/theme', {
        method: 'PUT',
        body: JSON.stringify({ language: lang }),
      });
    } catch {
      // Silently fail - language is already updated locally
    }
  }, [setLanguage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-[var(--theme-primary)]" />
            {t('profile.myProfile')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.editDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('profile.firstName')}</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('profile.firstName')}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('profile.lastName')}</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('profile.lastName')}
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.assembly')}</Label>
            <Input
              value={assembly}
              onChange={(e) => setAssembly(e.target.value)}
              placeholder={t('profile.assemblyPlaceholder')}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.mentor')}</Label>
            <Input
              value={mentor}
              onChange={(e) => setMentor(e.target.value)}
              placeholder={t('profile.mentorPlaceholder')}
              className="text-sm"
            />
          </div>
          <Button
            onClick={() =>
              saveProfile.mutate({ firstName, lastName, assembly, mentor })
            }
            disabled={saveProfile.isPending}
            className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {t('profile.save')}
          </Button>

          <Separator />

          {/* PDF Theme Color section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--theme-primary)]" />
              <h4 className="text-sm font-semibold">Couleur du PDF</h4>
            </div>
            <p className="text-[10px] text-gray-500">Choisissez la couleur principale du compte rendu PDF</p>
            <div className="flex flex-wrap gap-2">
              {PDF_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePdfColorChange(preset.value)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${pdfColor === preset.value ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:border-gray-300'}`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="color"
                  value={pdfColor}
                  onChange={(e) => handlePdfColorChange(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border-2 border-dashed border-gray-300 p-0 bg-transparent"
                  title="Couleur personnalisée"
                />
              </label>
            </div>
          </div>

          <Separator />

          {/* Theme section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-[var(--theme-primary)]" />
              <h4 className="text-sm font-semibold">{t('profile.themeColor')}</h4>
            </div>
            <ThemePicker />
          </div>

          <Separator />

          {/* Language section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--theme-primary)]" />
              <h4 className="text-sm font-semibold">{t('profile.language')}</h4>
            </div>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

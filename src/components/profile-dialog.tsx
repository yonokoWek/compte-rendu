'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { User, Save, Palette, Globe, FileText, Loader2 } from 'lucide-react';
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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [assembly, setAssembly] = useState('');
  const [mentor, setMentor] = useState('');
  const [pdfColor, setPdfColor] = useState(DEFAULT_PDF_COLOR);
  const [saving, setSaving] = useState(false);

  // Track original values for dirty detection
  const [originalValues, setOriginalValues] = useState({ firstName: '', lastName: '', assembly: '', mentor: '' });

  // Populate fields when profile data loads
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (profile) {
      const vals = {
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        assembly: profile.assembly || '',
        mentor: profile.mentor || '',
      };
      setFirstName(vals.firstName);
      setLastName(vals.lastName);
      setAssembly(vals.assembly);
      setMentor(vals.mentor);
      setOriginalValues(vals);
    }
  }, [profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Dirty detection: compare current field values against original saved values
  const isDirty =
    firstName !== originalValues.firstName ||
    lastName !== originalValues.lastName ||
    assembly !== originalValues.assembly ||
    mentor !== originalValues.mentor;

  // Load PDF color from localStorage on mount
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PDF_COLOR_KEY);
      if (saved) setPdfColor(saved);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePdfColorChange = (color: string) => {
    setPdfColor(color);
    localStorage.setItem(PDF_COLOR_KEY, color);
  };

  // Simple, reliable save handler — no react-query mutation
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName, lastName, assembly, mentor }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Reset dirty state to match newly saved values
      setOriginalValues({ firstName, lastName, assembly, mentor });

      // PDF color is already saved to localStorage in handlePdfColorChange
      // Theme color is handled by ThemePicker component

      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profil enregistré ✓');
      setOpen(false);
    } catch (err) {
      console.error('Profile save error:', err);
      toast.error('Erreur lors de l\'enregistrement. Vérifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  }, [firstName, lastName, assembly, mentor, queryClient, setOpen]);

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
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="w-full font-semibold transition-all"
            style={isDirty && !saving
              ? { backgroundColor: 'var(--theme-primary, #f97316)', color: '#fff' }
              : undefined
            }
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
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
                  type="button"
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

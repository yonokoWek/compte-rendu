'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
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
import { User, Save, Palette } from 'lucide-react';
import { toast } from 'sonner';
import ThemePicker from '@/components/theme-picker';

export default function ProfileDialog() {
  const open = useAppStore((s) => s.profileDialogOpen);
  const setOpen = useAppStore((s) => s.setProfileDialogOpen);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then((r) => r.json()),
  });

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [assembly, setAssembly] = React.useState('');
  const [mentor, setMentor] = React.useState('');

  React.useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setAssembly(profile.assembly || '');
      setMentor(profile.mentor || '');
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; assembly: string; mentor: string }) =>
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast.success('Profil mis à jour');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-[var(--theme-primary)]" />
            Mon Profil
          </DialogTitle>
          <DialogDescription>
            Modifiez vos informations personnelles
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prénom</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nom</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assemblée</Label>
            <Input
              value={assembly}
              onChange={(e) => setAssembly(e.target.value)}
              placeholder="Nom de l'assemblée"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Faiseur de disciple</Label>
            <Input
              value={mentor}
              onChange={(e) => setMentor(e.target.value)}
              placeholder="Nom du mentor"
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
            Enregistrer
          </Button>

          <Separator />

          {/* Theme section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-[var(--theme-primary)]" />
              <h4 className="text-sm font-semibold">Couleur du thème</h4>
            </div>
            <ThemePicker />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

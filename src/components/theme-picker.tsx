'use client';

import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { THEME_PRESETS } from '@/lib/themes';
import { toast } from 'sonner';

export default function ThemePicker() {
  const [activeId, setActiveId] = useState('orange');

  useEffect(() => {
    const token = localStorage.getItem('cr_session_token');
    if (!token) return;

    fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((user) => {
        if (user?.themeColor) {
          setActiveId(user.themeColor);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelect = async (preset: typeof THEME_PRESETS[number]) => {
    setActiveId(preset.id);

    const token = localStorage.getItem('cr_session_token');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ themeColor: preset.id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Thème ${preset.name} appliqué`);
    } catch {
      toast.error('Erreur lors de la sauvegarde du thème');
    }
  };

  return (
    <div className="grid grid-cols-4 gap-3 justify-items-center">
      {THEME_PRESETS.map((preset) => {
        const isActive = activeId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={
                'relative h-9 w-9 rounded-full transition-all ' +
                (isActive
                  ? 'ring-2 ring-offset-2 ring-[var(--theme-primary)]'
                  : 'ring-1 ring-gray-200 group-hover:ring-gray-300')
              }
              style={{ backgroundColor: preset.colors.primary }}
            >
              {isActive && (
                <Check
                  className="absolute inset-0 m-auto h-4 w-4 text-white"
                  strokeWidth={3}
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {preset.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

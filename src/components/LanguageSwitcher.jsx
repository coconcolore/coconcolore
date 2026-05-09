import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const isDE = i18n.language?.startsWith('de');

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2 text-xs font-medium ${isDE ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'}`}
        onClick={() => i18n.changeLanguage('de')}
      >
        DE
      </Button>
      <span className="text-sidebar-foreground/30 text-xs">|</span>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2 text-xs font-medium ${!isDE ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'}`}
        onClick={() => i18n.changeLanguage('en')}
      >
        EN
      </Button>
    </div>
  );
}

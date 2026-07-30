'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  title: string;
}

export default function PdfViewerDialog({ open, onOpenChange, pdfUrl, title }: PdfViewerDialogProps) {
  const [scale, setScale] = React.useState(100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] max-h-[95vh] p-0 flex flex-col gap-0">
        <DialogHeader className="flex flex-row items-center justify-between p-3 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">📖 {title}</DialogTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setScale((s) => Math.max(50, s - 25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500 w-10 text-center">{scale}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setScale((s) => Math.min(200, s + 25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                const iframe = document.getElementById('pdf-iframe') as HTMLIFrameElement | null;
                if (iframe?.requestFullscreen) iframe.requestFullscreen();
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <iframe
            id="pdf-iframe"
            src={`${pdfUrl}#zoom=${scale}`}
            className="w-full h-[85vh] border-0"
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

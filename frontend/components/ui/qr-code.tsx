'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export function QRCodeDisplay({ value, size = 220, className = '', alt = 'QR Code Anchor' }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!value) {
      setDataUrl(null);
      return;
    }
    setError(false);
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => {
        console.error('Failed to generate QR code graphic:', err);
        setError(true);
      });
  }, [value, size]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-coral-50 border border-coral-200 p-4 text-center text-xs text-coral-600 ${className}`}
        style={{ width: size, height: size }}
      >
        Could not render QR graphic
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-mono animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        Generating QR graphic...
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <img src={dataUrl} width={size} height={size} alt={alt} className="block rounded-lg border border-slate-100" />
    </div>
  );
}

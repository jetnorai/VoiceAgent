'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HotelGalleryProps {
  images: string[];
  name: string;
}

export function HotelGallery({ images, name }: HotelGalleryProps) {
  const [current, setCurrent] = useState(0);
  const hasImages = images.length > 0;

  if (!hasImages) {
    return (
      <div className="w-full h-64 sm:h-80 rounded-card-lg bg-bg-elevated flex items-center justify-center">
        <span className="text-6xl">🏨</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 sm:h-80 rounded-card-lg overflow-hidden group">
      <Image
        src={images[current]}
        alt={`${name} — image ${current + 1}`}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 1152px) 100vw, 1152px"
      />

      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-bg-base/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={18} className="text-text-primary" />
          </button>
          <button
            onClick={() => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1))}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-bg-base/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={18} className="text-text-primary" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.slice(0, 8).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  current === i ? 'bg-white w-3' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

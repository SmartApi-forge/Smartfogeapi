import Image from 'next/image';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  caption?: string;
  priority?: boolean;
}

/**
 * OptimizedImage Component
 * 
 * Wrapper around Next.js Image component with:
 * - Automatic lazy loading (unless priority is set)
 * - Responsive sizing
 * - Optional caption
 * - Optimized loading with blur placeholder
 * 
 * Requirements: 8.4 - Image lazy loading
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  caption,
  priority = false,
}: OptimizedImageProps) {
  return (
    <figure className="my-6">
      <div className={cn('relative overflow-hidden rounded-lg border border-border', className)}>
        <Image
          src={src}
          alt={alt}
          width={width || 800}
          height={height || 600}
          className="w-full h-auto"
          loading={priority ? 'eager' : 'lazy'}
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
          quality={85}
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

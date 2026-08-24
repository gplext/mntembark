import { useState } from "react";

interface DestinationCoverImageProps {
  coverImage: string | null | undefined;
  alt: string;
  className?: string;
}

/**
 * Renders a cover image when available and loadable.
 * Falls back to a neutral muted placeholder — preserving the box dimensions —
 * when coverImage is null, undefined, or fails to load (404 / broken path),
 * so layout never shifts and no broken-image icon is shown.
 */
export function DestinationCoverImage({
  coverImage,
  alt,
  className,
}: DestinationCoverImageProps) {
  const [errored, setErrored] = useState(false);

  if (coverImage && !errored) {
    return (
      <img
        src={coverImage}
        alt={alt}
        className={className}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`bg-muted flex items-end justify-start ${className ?? ""}`}
    >
      <span className="font-serif text-muted-foreground/50 text-sm tracking-wide px-5 pb-4 select-none leading-snug">
        {alt}
      </span>
    </div>
  );
}

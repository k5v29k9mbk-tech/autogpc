// Resolves a record's imageUri (data: URL for samples, blob-store for uploads)
// to a displayable <img> src.

import { useEffect, useState } from "react";
import { useStore } from "../store";

export function RecordImage({
  uri,
  className,
  alt = "Document",
}: {
  uri: string;
  className?: string;
  alt?: string;
}) {
  const { resolveImage } = useStore();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveImage(uri).then((s) => {
      if (active) setSrc(s);
    });
    return () => {
      active = false;
    };
  }, [uri, resolveImage]);

  if (!src) return <div className={className} style={{ background: "var(--bg)" }} aria-hidden />;
  return <img src={src} className={className} alt={alt} />;
}

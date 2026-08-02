// Resolves a record's imageUri (blob store, or a plain data:/http: URI) to a
// displayable <img> src. A record's stored document may be a PDF no <img> can
// render — fall back to the placeholder rather than a broken-image icon.

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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    resolveImage(uri).then((s) => {
      if (active) setSrc(s);
    });
    return () => {
      active = false;
    };
  }, [uri, resolveImage]);

  if (!src || failed)
    return <div className={className} style={{ background: "var(--bg)" }} aria-hidden />;
  return <img src={src} className={className} alt={alt} onError={() => setFailed(true)} />;
}

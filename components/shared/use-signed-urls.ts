"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

// Signed URLs live 1 hour (convex/files.ts). Asking again every 45 minutes keeps
// every URL on screen valid, even when it came from a cached query result.
const BUCKET_MS = 45 * 60_000;

/** A number that changes every 45 minutes; pass it to queries that sign URLs. */
export function useTimeBucket() {
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / BUCKET_MS));
  useEffect(() => {
    const timer = setTimeout(
      () => setBucket(Math.floor(Date.now() / BUCKET_MS)),
      Math.max((bucket + 1) * BUCKET_MS - Date.now(), 1000),
    );
    return () => clearTimeout(timer);
  }, [bucket]);
  return bucket;
}

/** Signed URLs (`{ [key]: url }`) for R2 keys of the org; `{}` while loading or without keys. */
export function useSignedUrls(keys: (string | undefined)[]): Record<string, string> {
  const bucket = useTimeBucket();
  const present = keys.filter((key): key is string => Boolean(key));
  const urls = useQuery(api.files.getUrls, present.length > 0 ? { keys: present, bucket } : "skip");
  // Keep showing the previous URLs (still valid) while the next bucket loads.
  const [previous, setPrevious] = useState<Record<string, string>>({});
  if (urls && urls !== previous) setPrevious(urls);
  return urls ?? previous;
}

/** Signed URL for one R2 key of the org. */
export function useSignedUrl(key: string | undefined): string | undefined {
  return useSignedUrls([key])[key ?? ""];
}

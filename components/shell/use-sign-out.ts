"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { resetAnalytics } from "@/lib/analytics";

/** Signs out, forgets the analytics identity, and goes to /ingresar. */
export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    resetAnalytics();
    router.replace("/ingresar");
  };
}

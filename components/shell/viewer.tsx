"use client";

import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, type ReactNode } from "react";
import type { api } from "@/convex/_generated/api";

type ViewerResult = NonNullable<FunctionReturnType<typeof api.auth.viewer>>;

/** Signed-in user with an active membership. Inside `app/(app)`, member and org are never null. */
export type Viewer = ViewerResult & {
  member: NonNullable<ViewerResult["member"]>;
  org: NonNullable<ViewerResult["org"]>;
};

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

/** Current user, member (role, color), and org. Only usable inside `app/(app)` pages. */
export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside the app shell");
  return viewer;
}

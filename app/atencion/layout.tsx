import { MemberGate } from "@/components/attention/member-gate";
import { Skeleton } from "@/components/ui/skeleton";

/** Full screen: no sidebar or tab bar while attending a client. */
export default function AtencionLayout({ children }: LayoutProps<"/atencion">) {
  return (
    <MemberGate
      fallback={
        <div aria-busy className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      {children}
    </MemberGate>
  );
}

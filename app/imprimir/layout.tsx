import { MemberGate } from "@/components/attention/member-gate";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImprimirLayout({ children }: LayoutProps<"/imprimir">) {
  return (
    <>
      <style>{"@page { size: A4; margin: 16mm; } @media print { body { background: #fff; } }"}</style>
      <MemberGate
        fallback={
          <div aria-busy className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-4 py-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        {children}
      </MemberGate>
    </>
  );
}

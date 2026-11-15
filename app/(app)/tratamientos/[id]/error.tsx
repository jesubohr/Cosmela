"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";

export default function TratamientoError() {
  return (
    <>
      <PageHeader title="Tratamiento" backHref="/tratamientos" />
      <PageBody>
        <EmptyState
          message="No encontramos este tratamiento. Puede que lo hayan eliminado."
          action={
            <Button asChild variant="secondary">
              <Link href="/tratamientos">Ver tratamientos</Link>
            </Button>
          }
        />
      </PageBody>
    </>
  );
}

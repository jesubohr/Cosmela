"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";

export default function ClientError() {
  return (
    <>
      <PageHeader title="Cliente" backHref="/clientes" />
      <PageBody>
        <EmptyState
          message="No encontramos este cliente. Puede que el enlace esté incompleto o que pertenezca a otro negocio."
          action={
            <Button asChild variant="secondary">
              <Link href="/clientes">Ver clientes</Link>
            </Button>
          }
        />
      </PageBody>
    </>
  );
}

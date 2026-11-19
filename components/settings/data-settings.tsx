"use client";

import { CookiePreferencesLink } from "@/components/cookie-preferences";

import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/forms/error-message";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { bogotaDateKey } from "@/convex/lib/time";
import { DOCUMENT_TYPE_LABELS, SEX_LABELS } from "@/lib/constants";
import { formatPhone, todayKey } from "@/lib/format";
import { DataRecoveryTools } from "./data-recovery-tools";
import { SettingsSection } from "./settings-page";

type ClientRow = FunctionReturnType<typeof api.orgs.exportClients>[number];

const COLUMNS: [string, (c: ClientRow) => string | undefined][] = [
  ["Nombres", (c) => c.firstName],
  ["Apellidos", (c) => c.lastName],
  ["Tipo de documento", (c) => c.documentType && DOCUMENT_TYPE_LABELS[c.documentType]],
  ["Número de documento", (c) => c.documentNumber],
  ["Fecha de nacimiento", (c) => c.birthDate],
  ["Sexo", (c) => c.sex && SEX_LABELS[c.sex]],
  ["Teléfono", (c) => formatPhone(c.phone)],
  ["Correo", (c) => c.email],
  ["Ocupación", (c) => c.occupation],
  ["Dirección", (c) => c.address],
  ["Contacto de emergencia", (c) => c.emergencyContact?.name],
  ["Teléfono de emergencia", (c) => c.emergencyContact && formatPhone(c.emergencyContact.phone)],
  ["Fecha de registro", (c) => bogotaDateKey(c.createdAt)],
  ["Última visita", (c) => (c.lastVisitAt ? bogotaDateKey(c.lastVisitAt) : undefined)],
  ["Archivado", (c) => (c.isArchived ? "Sí" : "No")],
];

function cell(value: string | undefined): string {
  let text = value ?? "";
  // Spreadsheets run cells that start with these characters as formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * CSV for Excel in Colombia: UTF-8 with BOM (keeps accents) and ";" as the
 * separator (the es-CO list separator, so columns split on open).
 */
export function clientsCsv(rows: ClientRow[]): string {
  const lines = [COLUMNS.map(([header]) => cell(header)), ...rows.map((row) => COLUMNS.map(([, get]) => cell(get(row))))];
  return `﻿${lines.map((line) => line.join(";")).join("\r\n")}\r\n`;
}

export function DataSettings() {
  const viewer = useViewer();
  const convex = useConvex();
  const [exporting, setExporting] = useState(false);
  const isAdmin = viewer.member.role === "admin";

  async function exportClients() {
    setExporting(true);
    try {
      const rows = await convex.action(api.orgs.exportClients, {});
      const blob = new Blob([clientsCsv(rows)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clientes-${viewer.org.slug}-${todayKey()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Clientes exportados");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {isAdmin && <SettingsSection title="Datos del negocio"><DataRecoveryTools /></SettingsSection>}
      <SettingsSection
        title="Exportar clientes"
        description={
          isAdmin
            ? "Descarga un archivo CSV con los datos de identificación y contacto de tus clientes. Se abre en Excel."
            : "Solo un administrador puede exportar los clientes."
        }
      >
        {isAdmin && (
          <Button variant="secondary" className="self-start" disabled={exporting} onClick={() => void exportClients()}>
            <Download />
            {exporting ? "Exportando…" : "Exportar clientes"}
          </Button>
        )}
      </SettingsSection>
      <SettingsSection title="Documentos legales">
        <ul className="flex flex-col gap-1">
          <li>
            <Link href="/terminos" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">
              Términos y condiciones
            </Link>
          </li>
          <li>
            <Link href="/privacidad" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">
              Política de privacidad de Cosmela
            </Link>
          </li>
          <li><Link href="/cookies" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Política de cookies</Link></li>
          <li><Link href="/reembolsos" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Cancelaciones y reembolsos</Link></li>
          <li><Link href="/acuerdo-datos" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Acuerdo de tratamiento de datos</Link></li>
          <li><a href="mailto:ayuda@cosmela.app" className="inline-flex min-h-11 items-center text-plum underline underline-offset-4">Contacto</a></li>
          <li className="text-plum"><CookiePreferencesLink /></li>
        </ul>
      </SettingsSection>
    </div>
  );
}

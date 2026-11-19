import type { Metadata } from "next";
import Link from "next/link";
import { DocumentPage } from "@/components/booking/document";
import { clientRecordGuidePath } from "@/lib/seo";

const title = "Ficha de cosmetología: qué registrar en cada cita";
const description =
  "Organiza la ficha de tus clientes con un ejemplo de cosmetología. Aprende qué guardar en el perfil, qué registrar por sesión y cómo archivar el consentimiento.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: clientRecordGuidePath },
  openGraph: {
    title,
    description,
    type: "article",
    url: clientRecordGuidePath,
    siteName: "Cosmela",
    locale: "es_CO",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Cosmela" }],
  },
};

export default function ClientRecordGuide() {
  return (
    <DocumentPage back={{ href: "/", label: "Cosmela", display: true }} title={title}>
      <p>
        Una ficha de cosmetología reúne la información del cliente y el historial de sus
        tratamientos. Organízala en dos partes: una ficha general que puedas actualizar y
        un registro por cada visita con lo que ocurrió ese día.
      </p>

      <h2>Qué guardar en la ficha general</h2>
      <ul>
        <li><strong>Datos de contacto.</strong> Nombre, teléfono y correo si el cliente lo proporciona.</li>
        <li><strong>Antecedentes relevantes.</strong> Alergias, reacciones previas y otros datos que necesites revisar antes de la atención.</li>
        <li><strong>Información de referencia.</strong> Valoración inicial, hábitos de cuidado y tratamientos anteriores.</li>
      </ul>
      <p>
        Cuando el cliente vuelva, confirma si su información cambió y actualiza la ficha.
        Conserva en cada visita lo que registraste ese día para poder comparar sesiones.
      </p>

      <h2>Qué registrar en cada sesión</h2>
      <ul>
        <li><strong>Antes.</strong> Fecha, profesional, motivo de la visita y observaciones de la valoración.</li>
        <li><strong>Durante.</strong> Consentimiento firmado y registro del procedimiento. Adjunta fotos según la autorización del cliente.</li>
        <li><strong>Al terminar.</strong> Indicaciones que compartiste con el cliente y fecha de seguimiento, si la acordaron.</li>
      </ul>

      <h2>Ejemplo de una ficha para dos visitas</h2>
      <p>
        En la primera visita de una limpieza facial, creas la ficha del cliente, registras sus
        antecedentes y guardas la valoración y el consentimiento con la sesión. Al cerrar,
        anotas las indicaciones que entregaste y la fecha acordada para el seguimiento.
      </p>
      <p>
        En la segunda visita, el cliente te cuenta que cambió un producto de su rutina.
        Actualizas sus hábitos en la ficha general y anotas el cambio en el registro de hoy.
        Así puedes leer la valoración anterior y la de hoy en orden, con sus fechas.
      </p>

      <h2>Dónde guardar el consentimiento informado</h2>
      <p>
        Guarda el documento firmado con la sesión correspondiente para consultar qué texto
        leyó y firmó el cliente ese día. En Cosmela puedes ajustar el consentimiento por
        tratamiento, recoger la firma en pantalla y consultar el documento desde el historial
        de la sesión.
      </p>
      <p><Link href="/#workflow">Ver cómo funciona una sesión en Cosmela</Link></p>
    </DocumentPage>
  );
}

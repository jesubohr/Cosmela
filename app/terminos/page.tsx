import type { Metadata } from "next";
import Link from "next/link";
import { DocumentPage } from "@/components/booking/document";

export const metadata: Metadata = { title: "Términos y condiciones" };

// Draft pending review by a Colombian lawyer: see docs/LEGAL-REVIEW.md.
export default function TermsPage() {
  return (
    <DocumentPage
      back={{ href: "/", label: "Cosmela", display: true }}
      title="Términos y condiciones"
      meta="Vigentes desde el 15 de noviembre de 2026"
    >
      <p>
        Estos términos regulan el uso de Cosmela, operada por [razón social], identificada con NIT [NIT]. Al crear
        una cuenta o usar la aplicación, los aceptas. Si los aceptas en nombre de un negocio, declaras que puedes
        obligarlo.
      </p>

      <h2>1. Qué es Cosmela</h2>
      <p>
        Cosmela es una aplicación web para profesionales de la cosmetología y la estética. Permite manejar la agenda,
        las fichas de los clientes, los consentimientos informados, los pagos, los seguimientos y una página de
        reservas en línea.
      </p>
      <p>
        Cosmela es una herramienta de registro y organización. No presta servicios de salud, no da consejo médico y no
        reemplaza el criterio profesional. Las plantillas de tratamientos, consentimientos y contraindicaciones son
        guías que cada negocio debe revisar y ajustar.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Ingresas con un código que enviamos a tu correo. No compartas tus códigos ni tu dispositivo abierto.</li>
        <li>Cada negocio tiene administradores y miembros del equipo. Los administradores deciden quién tiene acceso.</li>
        <li>Debes darnos información real y mantenerla actualizada.</li>
        <li>Avísanos de inmediato a [correo de contacto] si crees que alguien entró a tu cuenta sin permiso.</li>
      </ul>

      <h2>3. Beta gratuita</h2>
      <p>
        Durante la beta, Cosmela no tiene costo. Si más adelante creamos planes de pago, te avisaremos con al menos
        [días de aviso] días de anticipación y podrás decidir si continúas. Durante la beta el servicio puede cambiar
        y no garantizamos una disponibilidad determinada.
      </p>

      <h2>4. Responsabilidades del negocio</h2>
      <p>Cada negocio que usa Cosmela es responsable de:</p>
      <ul>
        <li>
          Los datos de sus clientes, como responsable del tratamiento: tener una política de tratamiento de datos,
          obtener la autorización de sus clientes y atender sus solicitudes.
        </li>
        <li>La veracidad de la información que registra y del contenido de sus consentimientos.</li>
        <li>
          Prestar solo servicios permitidos a su perfil profesional y cumplir la regulación aplicable a los
          establecimientos de estética.
        </li>
        <li>Las decisiones sobre cada tratamiento, incluida la decisión de continuar ante una contraindicación.</li>
        <li>Lo que hacen las personas de su equipo con acceso a la cuenta.</li>
      </ul>

      <h2>5. Cosmela como encargado del tratamiento</h2>
      <p>Sobre los datos de los clientes del negocio, Cosmela actúa como encargado del tratamiento y se compromete a:</p>
      <ul>
        <li>Tratarlos solo para prestar el servicio y según las instrucciones del negocio.</li>
        <li>Mantenerlos confidenciales y protegidos con medidas de seguridad adecuadas.</li>
        <li>No usarlos para fines propios, no venderlos y no enviarlos a herramientas de analítica.</li>
        <li>Apoyar al negocio para atender las consultas y reclamos de sus clientes.</li>
        <li>Informar al negocio sin demora sobre incidentes de seguridad que afecten sus datos.</li>
        <li>Devolverlos o eliminarlos al terminar el servicio, salvo deber legal de conservarlos.</li>
      </ul>
      <p>
        Los detalles están en la <Link href="/privacidad">política de tratamiento de datos personales</Link>.
      </p>

      <h2>6. Firma electrónica</h2>
      <p>
        Los consentimientos y autorizaciones se firman en la pantalla del dispositivo. Cosmela guarda la firma junto
        con la fecha, la hora, el dispositivo y un código de verificación del documento, y no permite cambiarlo
        después. El negocio y sus clientes aceptan este mecanismo como firma electrónica, conforme a la Ley 527 de 1999
        y al Decreto 2364 de 2012.
      </p>

      <h2>7. Uso aceptable</h2>
      <p>No puedes usar Cosmela para:</p>
      <ul>
        <li>Registrar datos de personas sin una base legal para hacerlo.</li>
        <li>Enviar mensajes no solicitados o publicidad desde la página de reservas.</li>
        <li>Intentar acceder a datos de otros negocios o afectar la seguridad del servicio.</li>
        <li>Copiar, revender o desarmar la aplicación.</li>
      </ul>

      <h2>8. Tus datos y nuestra propiedad intelectual</h2>
      <p>
        La información que registras pertenece a tu negocio. Nos das permiso para guardarla y procesarla solo para
        prestarte el servicio. Puedes exportar tus clientes en cualquier momento desde Configuración. La aplicación,
        su diseño, su código y las plantillas son propiedad de [razón social].
      </p>

      <h2>9. Disponibilidad y cambios</h2>
      <p>
        Trabajamos para que Cosmela esté disponible y segura, pero puede haber interrupciones por mantenimiento o
        fallas de proveedores. Podemos mejorar o cambiar funciones; si un cambio afecta de forma importante cómo usas
        el servicio, te avisaremos con anticipación.
      </p>

      <h2>10. Responsabilidad</h2>
      <p>
        En la medida que permite la ley colombiana, Cosmela no responde por daños indirectos, lucro cesante ni por
        decisiones profesionales tomadas con la información registrada. Nada en estos términos limita los derechos
        que la ley te reconoce como consumidor.
      </p>

      <h2>11. Terminación</h2>
      <p>
        Puedes dejar de usar Cosmela cuando quieras y pedirnos cerrar tu cuenta en [correo de contacto]. Podemos
        suspender una cuenta que incumpla estos términos, con aviso previo salvo en casos graves. Al cerrar una cuenta
        de negocio, tendrás [plazo de exportación] días para exportar tus datos antes de que los eliminemos.
      </p>

      <h2>12. Cambios a estos términos</h2>
      <p>
        Si cambiamos estos términos, publicaremos la nueva versión con su fecha de vigencia y te avisaremos por correo
        o dentro de la aplicación. Si sigues usando Cosmela después de esa fecha, aceptas los cambios.
      </p>

      <h2>13. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Las diferencias se resolverán ante los
        jueces de [ciudad], sin perjuicio de los derechos del consumidor.
      </p>

      <h2>14. Contacto</h2>
      <p>Escríbenos a [correo de contacto].</p>
    </DocumentPage>
  );
}

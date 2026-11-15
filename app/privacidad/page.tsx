import type { Metadata } from "next";
import Link from "next/link";
import { DocumentPage } from "@/components/booking/document";

export const metadata: Metadata = { title: "Política de privacidad" };

// Draft pending review by a Colombian lawyer: see docs/LEGAL-REVIEW.md.
export default function PrivacyPage() {
  return (
    <DocumentPage
      back={{ href: "/", label: "Cosmela", display: true }}
      title="Política de tratamiento de datos personales"
      meta="Vigente desde el 15 de noviembre de 2026"
    >
      <p>
        Esta política explica cómo Cosmela trata los datos personales, conforme a la Ley 1581 de 2012 y al Decreto
        1377 de 2013 (compilado en el Decreto 1074 de 2015).
      </p>

      <h2>1. Quiénes somos</h2>
      <p>
        Cosmela es una aplicación para profesionales de la cosmetología y la estética en Colombia. La opera [razón
        social], identificada con NIT [NIT], con domicilio en [dirección], [ciudad], Colombia.
      </p>
      <ul>
        <li>Correo: [correo de contacto]</li>
        <li>Teléfono: [teléfono de contacto]</li>
      </ul>

      <h2>2. Nuestros dos papeles</h2>
      <p>Tratamos datos personales en dos calidades distintas:</p>
      <ul>
        <li>
          <strong>Responsables del tratamiento</strong> de los datos de las personas que crean una cuenta y usan
          Cosmela: dueños de negocios y miembros de sus equipos.
        </li>
        <li>
          <strong>Encargados del tratamiento</strong> de los datos de los clientes de cada negocio (fichas, citas,
          consentimientos, fotografías y pagos). El negocio es el responsable de esos datos y decide para qué los
          usa. Cosmela solo los trata por cuenta del negocio y según sus instrucciones.
        </li>
      </ul>
      <p>
        Si eres cliente de un negocio que usa Cosmela, la política que aplica a tus datos es la del negocio. La
        encuentras en su página de reservas o puedes pedírsela directamente.
      </p>

      <h2>3. Datos que tratamos como responsables</h2>
      <ul>
        <li>Datos de cuenta: nombre, correo electrónico, cargo, rol en el equipo y firma profesional.</li>
        <li>Datos del negocio: nombre, ciudad, dirección, WhatsApp, razón social, NIT o cédula y logo.</li>
        <li>
          Datos de uso: páginas visitadas y acciones dentro de la aplicación, asociadas a un identificador interno,
          sin datos de salud.
        </li>
        <li>Datos técnicos: dirección IP, tipo de dispositivo y navegador, y registros de errores.</li>
        <li>Las comunicaciones que nos envías.</li>
      </ul>

      <h2>4. Para qué los usamos</h2>
      <ul>
        <li>Crear tu cuenta, permitirte ingresar con un código enviado a tu correo y mantener tu sesión.</li>
        <li>Prestar el servicio: agenda, fichas, consentimientos, recordatorios y reportes de tu negocio.</li>
        <li>Enviarte correos necesarios para el servicio, como códigos de acceso, invitaciones y avisos.</li>
        <li>Entender cómo se usa la aplicación para mejorarla, con datos de uso sin información de salud.</li>
        <li>Atender tus solicitudes, prevenir fraudes y proteger la seguridad del servicio.</li>
        <li>Cumplir obligaciones legales.</li>
      </ul>
      <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>

      <h2>5. Datos que tratamos como encargados</h2>
      <p>
        Los negocios registran en Cosmela datos de sus clientes, entre ellos datos sensibles: información de salud,
        fotografías de la zona tratada y firmas. Sobre esos datos nos comprometemos a:
      </p>
      <ul>
        <li>Tratarlos solo para prestar el servicio al negocio y según sus instrucciones.</li>
        <li>No usarlos para fines propios, no enviarlos a herramientas de analítica y no venderlos.</li>
        <li>Protegerlos con acceso restringido por negocio, conexiones cifradas y archivos privados.</li>
        <li>Apoyar al negocio para atender las solicitudes de sus clientes.</li>
        <li>Avisar al negocio sin demora si ocurre un incidente de seguridad que los afecte.</li>
        <li>Devolverlos o eliminarlos cuando termine la relación con el negocio, salvo deber legal de conservarlos.</li>
      </ul>
      <p>
        El negocio debe obtener la autorización previa, expresa e informada de sus clientes para tratar sus datos
        sensibles. Cosmela le ofrece herramientas para registrarla, como la firma en pantalla o la casilla de
        autorización de la página de reservas.
      </p>

      <h2>6. Datos sensibles</h2>
      <p>
        No es obligatorio responder preguntas sobre datos sensibles ni autorizar su tratamiento. Ningún servicio de
        Cosmela depende de que lo hagas. Los datos de niñas, niños y adolescentes se tratan respetando sus derechos
        prevalentes y con la autorización de su representante legal.
      </p>

      <h2>7. Proveedores que nos ayudan</h2>
      <p>
        Usamos proveedores tecnológicos que tratan datos por cuenta nuestra. Algunos guardan los datos fuera de
        Colombia, principalmente en Estados Unidos. Les exigimos medidas de seguridad y confidencialidad adecuadas.
      </p>
      <ul>
        <li>Convex: base de datos y funciones del servicio.</li>
        <li>Cloudflare R2: almacenamiento privado de fotografías, firmas y logos.</li>
        <li>Resend: envío de correos electrónicos.</li>
        <li>PostHog: analítica de uso, sin datos de salud y sin grabación de pantalla.</li>
        <li>Vercel: alojamiento de la aplicación web.</li>
      </ul>

      <h2>8. Tus derechos</h2>
      <p>Como titular de los datos tienes derecho a:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que diste.</li>
        <li>Saber cómo se han usado tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
        <li>
          Revocar la autorización o pedir que eliminemos tus datos, cuando no exista un deber legal o contractual de
          conservarlos.
        </li>
        <li>Acceder gratis a tus datos.</li>
      </ul>

      <h2>9. Cómo ejercer tus derechos</h2>
      <p>
        Escríbenos a [correo de contacto] con tu nombre, tu número de documento, tu solicitud y un medio para
        responderte. El área encargada de atender estas solicitudes es [área o persona responsable].
      </p>
      <ul>
        <li>Respondemos las consultas en un máximo de 10 días hábiles.</li>
        <li>Respondemos los reclamos en un máximo de 15 días hábiles.</li>
      </ul>
      <p>
        Si necesitamos más tiempo, te avisamos antes de que venza el plazo y te explicamos el motivo. Si eres cliente
        de un negocio, dirige tu solicitud al negocio; si nos llega a nosotros, se la trasladamos.
      </p>

      <h2>10. Seguridad</h2>
      <p>
        Cada negocio solo puede ver sus propios datos. Las conexiones van cifradas, los archivos se guardan en
        almacenamiento privado y se muestran con enlaces que vencen en minutos. Los consentimientos firmados quedan
        guardados sin cambios, con un código de verificación.
      </p>

      <h2>11. Cuánto tiempo conservamos los datos</h2>
      <p>
        Conservamos los datos de cuenta mientras la cuenta esté activa y hasta [plazo de conservación] después de
        cerrarla. Cuando un negocio deja Cosmela, puede exportar sus datos y luego los eliminamos en un máximo de
        [plazo de eliminación], salvo que la ley nos obligue a conservarlos más tiempo.
      </p>

      <h2>12. Cookies y almacenamiento local</h2>
      <p>
        Usamos cookies necesarias para mantener tu sesión. La analítica de uso guarda un identificador en tu
        navegador para contar visitas y acciones, sin datos de salud.
      </p>

      <h2>13. Cambios y vigencia</h2>
      <p>
        Esta política rige desde el 15 de noviembre de 2026. Las bases de datos estarán vigentes mientras Cosmela
        preste el servicio. Si la cambiamos de forma importante, te avisaremos por correo o dentro de la aplicación
        antes de que el cambio aplique. Consulta también los <Link href="/terminos">términos y condiciones</Link>.
      </p>
    </DocumentPage>
  );
}

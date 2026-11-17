import { CookiePreferencesLink } from "@/components/cookie-preferences";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
} from "lucide-react";
import { ProductPreview } from "@/components/landing/product-preview";
import { styles } from "@/components/landing/styles";
import { ThemeToggle } from "@/components/landing/theme-toggle";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://cosmela.app",
  ),
  title: "Cosmela: agenda y fichas para profesionales de la estética",
  description:
    "Organiza citas, fichas de clientes, consentimientos y seguimientos. Para profesionales independientes y centros de estética en Colombia.",
  other: { "page-type": "software", "site-kind": "software" },
  openGraph: {
    title: "Cosmela: tu agenda y tus clientes en un solo lugar",
    description:
      "Tus citas, fichas de clientes y seguimientos en un solo lugar.",
    type: "website",
    images: [
      { url: "/icons/icon-512.png", width: 512, height: 512, alt: "Cosmela" },
    ],
  },
  twitter: {
    card: "summary",
    title: "Cosmela",
    description: "Agenda y fichas para profesionales de la estética.",
    images: ["/icons/icon-512.png"],
  },
};

const workflow = [
  [
    "01",
    "Ficha del cliente",
    "Revisa los antecedentes de salud y los cambios desde la última visita.",
  ],
  [
    "02",
    "Valoración",
    "Registra el estado de la piel y agrega fotos antes del tratamiento.",
  ],
  [
    "03",
    "Contraindicaciones",
    "Revisa las alertas antes de iniciar el tratamiento.",
  ],
  [
    "04",
    "Consentimiento",
    "Revisa el consentimiento informado con tu cliente y recoge su firma.",
  ],
  [
    "05",
    "Procedimiento",
    "Usa un formulario adaptado al tratamiento que realizas.",
  ],
  [
    "06",
    "Cierre",
    "Indica los cuidados posteriores, registra el pago y programa el seguimiento.",
  ],
];

export default function Home() {
  return (
    <div className={styles.landing} lang="es-419">
      <a className={styles.skip} href="#main">
        Ir al contenido
      </a>
      <header className={styles.header}>
        <div className={styles.wrap}>
          <Link
            href="/"
            className={styles.wordmark}
            aria-label="Inicio de Cosmela"
          >
            cosmela<span aria-hidden="true">.</span>
          </Link>
          <nav className={styles.nav} aria-label="Navegación principal">
            <a href="#practice">Funciones</a>
            <a href="#workflow">Sesiones</a>
            <a href="#questions">Preguntas</a>
          </nav>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <Link className={styles.signIn} href="/ingresar">
              Ingresar <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-h">
          <div className={styles.wrap}>
            <div className={styles.heroGrid}>
              <div className={styles.heroText}>
                <h1 id="hero-h">
                  Menos papeleo,
                  <br className={styles.desktopBreak} /> más tiempo para tus
                  clientes.
                </h1>
                <p className={styles.lead}>
                  Tu agenda, las fichas, los consentimientos y los seguimientos
                  en un solo lugar. Desde tu celular o tu computadora.
                </p>
                <div className={styles.actions}>
                  <Link className={styles.primary} href="/ingresar">
                    Empieza ahora <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <a className={styles.textLink} href="#practice">
                    Ver cómo funciona <span aria-hidden="true">↓</span>
                  </a>
                </div>
              </div>
              <div className={styles.heroVisual}>
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>
        <section
          id="practice"
          className={`${styles.section} ${styles.practice}`}
          aria-labelledby="practice-h"
        >
          <div className={styles.wrap}>
            <h2 id="practice-h">
              Citas, fichas
              <br />y seguimientos.
            </h2>
            <div className={styles.practiceGrid}>
              <article>
                <CalendarDays aria-hidden="true" size={24} />
                <h3>Tu agenda organizada</h3>
                <p>
                  Consulta las citas del día, confirma solicitudes y bloquea
                  horarios. Comparte tu página de reservas para que tus clientes
                  soliciten una cita.
                </p>
                <div
                  className={styles.schedule}
                  aria-label="Ejemplo de agenda de citas"
                >
                  <div>
                    <time>09:00</time>
                    <span>
                      <strong>Limpieza facial</strong>
                      <small>Camila Restrepo</small>
                    </span>
                    <Check size={16} aria-label="Agendada" />
                  </div>
                  <div>
                    <time>10:30</time>
                    <span>
                      <strong>Peeling químico</strong>
                      <small>Valentina Ríos</small>
                    </span>
                    <Check size={16} aria-label="Agendada" />
                  </div>
                  <div className={styles.break}>
                    <time>12:00</time>
                    <span>Descanso</span>
                  </div>
                </div>
              </article>
              <article>
                <ClipboardList aria-hidden="true" size={24} />
                <h3>La ficha de cada cliente</h3>
                <p>
                  Consulta los antecedentes de salud, las fotos y los
                  consentimientos firmados de cada cliente. Registra lo que
                  haces en cada sesión.
                </p>
                <div
                  className={styles.record}
                  aria-label="Ejemplo de ficha del cliente"
                >
                  <div className={styles.recordName}>
                    <span className={styles.avatar}>VR</span>
                    <span>
                      <strong>Valentina Ríos</strong>
                      <small>Ficha del cliente</small>
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Tipo de piel</dt>
                      <dd>Mixta</dd>
                    </div>
                    <div>
                      <dt>Tratamiento</dt>
                      <dd>Peeling químico</dd>
                    </div>
                    <div>
                      <dt>Consentimiento</dt>
                      <dd>
                        <Check size={14} aria-hidden="true" /> Firmado
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
              <article>
                <HeartHandshake aria-hidden="true" size={24} />
                <h3>Seguimiento después de cada cita</h3>
                <p>
                  Envía las indicaciones por WhatsApp y programa recordatorios
                  para contactar a tus clientes. Revisa también los pagos
                  pendientes.
                </p>
                <div
                  className={styles.followup}
                  aria-label="Ejemplo de recordatorio de seguimiento"
                >
                  <span className={styles.checkCircle}>
                    <Check size={20} aria-hidden="true" />
                  </span>
                  <strong>Contactar a Valentina</strong>
                  <p>
                    Pregunta cómo sigue su piel y si tiene dudas sobre los
                    cuidados posteriores.
                  </p>
                  <span>Recordatorio de seguimiento</span>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section
          id="workflow"
          className={styles.section}
          aria-labelledby="workflow-h"
        >
          <div className={styles.wrap}>
            <h2 id="workflow-h">
              Una guía para
              <br />
              cada sesión.
            </h2>
            <div className={styles.workflowBody}>
              <div className={styles.workflowIntro}>
                <p className={styles.figure}>6</p>
                <p className={styles.stepLabel}>
                  pasos, desde la ficha hasta el cierre.
                </p>
                <p>
                  Cosmela te guía en cada sesión y guarda tu avance. Si
                  necesitas hacer una pausa, puedes continuar donde te quedaste.
                </p>
                <Link className={styles.textLink} href="/ingresar">
                  Empieza ahora <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <ol className={styles.steps}>
                {workflow.map(([number, title, description]) => (
                  <li key={number}>
                    <span>{number}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
        <section
          id="questions"
          className={`${styles.section} ${styles.questions}`}
          aria-labelledby="questions-h"
        >
          <div className={styles.wrap}>
            <h2 id="questions-h">Preguntas frecuentes</h2>
            <div className={styles.questionGrid}>
              <div className={styles.questionIntro}>
                <p>
                  Trabaja desde el celular o la computadora y comparte la agenda
                  y las fichas con tu equipo.
                </p>
                <span className={styles.largeMark} aria-hidden="true">
                  c.
                </span>
              </div>
              <dl className={styles.answers}>
                <div>
                  <dt>¿Puedo usar Cosmela en mi celular?</dt>
                  <dd>
                    Sí. Abre Cosmela en el navegador de tu celular, tablet o
                    computadora. También puedes agregarlo a tu pantalla de
                    inicio.
                  </dd>
                </div>
                <div>
                  <dt>¿Puedo usarlo con mi equipo?</dt>
                  <dd>
                    Sí. Comparte la agenda y las fichas con tu equipo. Si
                    administras el negocio, también puedes editar tratamientos y
                    consultar reportes.
                  </dd>
                </div>
                <div>
                  <dt>¿Puedo adaptarlo a mis tratamientos?</dt>
                  <dd>
                    Usa una plantilla o crea un tratamiento desde cero. Ajusta
                    el formulario, el consentimiento, las contraindicaciones y
                    los cuidados posteriores.
                  </dd>
                </div>
                <div>
                  <dt>¿Mis clientes necesitan una cuenta?</dt>
                  <dd>
                    No. Pueden solicitar citas desde tu página de reservas y
                    firmar el consentimiento en tu dispositivo sin crear una
                    cuenta.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>
      <footer className={`${styles.section} ${styles.footer}`}>
        <div className={styles.wrap}>
          <div className={styles.close}>
            <h2>
              Más orden
              <br />
              para tu negocio.
            </h2>
            <p>Consulta tu agenda y las fichas desde el mismo lugar.</p>
            <Link className={styles.primary} href="/ingresar">
              Empieza ahora <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.footerBottom}>
            <Link className={styles.wordmark} href="/">
              cosmela.
            </Link>
            <p>Pensado para cuidar a tus clientes.</p>
            <nav aria-label="Información legal">
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/reembolsos">Reembolsos</Link>
              <Link href="/acuerdo-datos">Acuerdo de datos</Link>
              <a href="mailto:ayuda@cosmela.app">Contacto</a>
              <CookiePreferencesLink />
              <Link href="/terminos">Términos</Link>
              <a href="#main">Volver al inicio ↑</a>
            </nav>
            <span>© {new Date().getFullYear()} Cosmela</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

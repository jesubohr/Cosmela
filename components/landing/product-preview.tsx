"use client";

import { useState } from "react";
import {
  CalendarDays,
  Users,
  FolderHeart,
  Sun,
  Check,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { styles } from "./styles";

const appointments = [
  {
    time: "09:00",
    name: "Camila Restrepo",
    treatment: "Limpieza facial",
    initials: "CR",
    status: "Atendida",
    note: "Cuidados posteriores enviados. Seguimiento en 7 días.",
  },
  {
    time: "10:30",
    name: "Valentina Ríos",
    treatment: "Peeling químico",
    initials: "VR",
    status: "Agendada",
    note: "Revisa si hubo cambios en su salud antes de iniciar la sesión.",
  },
  {
    time: "14:00",
    name: "Daniela Mejía",
    treatment: "Valoración de la piel",
    initials: "DM",
    status: "Agendada",
    note: "Primera visita. Completa la ficha con tu cliente.",
  },
];

export function ProductPreview() {
  const [selected, setSelected] = useState(1);
  const [showRecord, setShowRecord] = useState(false);
  const appointment = appointments[selected];
  return (
    <div className={styles.previewGround}>
      <div
        className={styles.appFrame}
        aria-label="Demostración interactiva de Cosmela"
      >
        <div className={styles.appBar}>
          <span className={styles.miniBrand}>cosmela.</span>
          <span className={styles.userAvatar}>AM</span>
        </div>
        <div className={styles.appLayout}>
          <aside className={styles.appSidebar} aria-hidden="true">
            <span className={styles.sidebarActive}>
              <Sun size={16} /> Hoy
            </span>
            <span>
              <CalendarDays size={16} /> Agenda
            </span>
            <span>
              <Users size={16} /> Clientes
            </span>
            <span>
              <FolderHeart size={16} /> Casos
            </span>
            <p>Centro de Ana</p>
          </aside>
          <div className={styles.appContent}>
            <div className={styles.appGreeting}>
              <span>Lunes, 16 de noviembre</span>
              <p className={styles.appGreetingTitle}>Buenos días, Ana.</p>
              <p>Consulta las citas de hoy.</p>
            </div>
            {showRecord ? (
              <div className={styles.previewRecord}>
                <button
                  onClick={() => setShowRecord(false)}
                  className={styles.backButton}
                >
                  <ArrowLeft size={15} /> Volver a Hoy
                </button>
                <div className={styles.recordName}>
                  <span className={styles.avatar}>{appointment.initials}</span>
                  <strong>{appointment.name}</strong>
                </div>
                <p className={styles.recordTitle}>Ficha del cliente</p>
                <dl>
                  <div>
                    <dt>Tratamiento</dt>
                    <dd>{appointment.treatment}</dd>
                  </div>
                  <div>
                    <dt>Cita</dt>
                    <dd>{appointment.time}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{appointment.status}</dd>
                  </div>
                </dl>
                <p>{appointment.note}</p>
              </div>
            ) : (
              <>
                <div className={styles.nextAppointment}>
                  <div className={styles.nextTop}>
                    <span>{appointment.status}</span>
                    <time>{appointment.time}</time>
                  </div>
                  <div className={styles.personRow}>
                    <span className={styles.avatar}>
                      {appointment.initials}
                    </span>
                    <div>
                      <strong>{appointment.name}</strong>
                      <p>{appointment.treatment}</p>
                    </div>
                  </div>
                  <button
                    className={styles.previewButton}
                    onClick={() => setShowRecord(true)}
                  >
                    Ver ficha del cliente <ChevronRight size={16} />
                  </button>
                </div>
                <div className={styles.dayHeading}>
                  <strong>Tus citas</strong>
                  <span>3 citas hoy</span>
                </div>
                <div className={styles.appointments}>
                  {appointments.map((item, index) => (
                    <button
                      key={item.initials}
                      className={
                        index === selected
                          ? styles.selectedAppointment
                          : undefined
                      }
                      aria-pressed={index === selected}
                      onClick={() => setSelected(index)}
                    >
                      <time>{item.time}</time>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.treatment}</small>
                      </span>
                      {index === 0 ? (
                        <Check size={14} aria-label="Atendida" />
                      ) : (
                        <ChevronRight size={14} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

# Política de cookies y almacenamiento del navegador

Borrador `2026-11-16-draft.1`. No vigente. Esta tabla describe la configuración propuesta; falta verificar nombres y duraciones en producción.

Las cookies y el almacenamiento local permiten conservar una sesión o una preferencia. Algunas tecnologías permiten asociar actividades con una persona y requieren las protecciones aplicables a datos personales.

| Tecnología | Proveedor y finalidad | Categoría | Duración propuesta / validación |
| --- | --- | --- | --- |
| Cookies de sesión y verificación de Better Auth | Cosmela / Better Auth: autenticación y seguridad | Necesaria | [TODO: verificar nombres, prefijos y expiración configurada]. Los códigos OTP vencen a los 10 minutos; esto no describe la duración de la cookie de sesión. |
| Preferencia de tema de next-themes | Cosmela: recordar el tema elegido | Preferencia solicitada | Hasta cambio o eliminación del almacenamiento local; confirmar clave `theme`. |
| Preferencia de analítica | Cosmela: recordar aceptación o rechazo y versión del aviso | Necesaria para respetar la elección | 12 meses propuestos; renovar ante cambios materiales. |
| Identificador y eventos de PostHog | PostHog: medir uso con autorización | Analítica opcional | Identificador de navegador: máximo 12 meses; eventos: 90 días. Confirmar claves, cookies, perfiles y configuración antes de publicar. |
| Tecnologías del checkout de Polar | Polar y sus proveedores: pago y prevención de fraude en su checkout | Según el uso del proveedor | Consultar y comprobar el aviso de Polar al abrir el checkout; no se cargan como analítica general de Cosmela. |

Las cookies necesarias permiten prestar la función solicitada; no se usan para finalidades adicionales incompatibles. Publicaremos sus características verificadas. No instalaremos ni activaremos analítica opcional antes de tu aceptación. Mostraremos opciones igualmente claras para aceptar o rechazar y mantendremos disponible “Preferencias de cookies” para cambiar la decisión.

Rechazar o retirar la analítica no bloquea la cuenta. Al retirarla, cesan nuevos eventos, se elimina el identificador opcional del navegador y se tramita la eliminación del perfil asociado cuando corresponda. No activamos grabación de sesiones. No utilizamos cookies publicitarias.

Puedes eliminar almacenamiento en la configuración del navegador; eliminar cookies de sesión puede cerrar tu sesión. PostHog puede procesar datos en Estados Unidos. Consulta la política de tratamiento de datos para proveedores, derechos y contacto: ayuda@cosmela.app.

[TODO: completar una comprobación real del navegador y de las solicitudes de red, tanto antes como después de aceptar, rechazar y retirar. No publicar la tabla como inventario verificado hasta completar esa comprobación.]

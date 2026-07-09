import LegalDoc from '@/components/legal/legal-doc';

const MARKDOWN = `
> *Este documento fue elaborado con base en la legislación colombiana aplicable (Código de Comercio, Ley 527 de 1999 sobre comercio electrónico, Estatuto del Consumidor - Ley 1480 de 2011, y demás normas concordantes). Se recomienda su revisión por un abogado antes de su publicación definitiva.*

## 1. Aceptación de los términos

Al crear una cuenta, registrar un club o utilizar de cualquier forma la plataforma **VeloClub** ("la Plataforma", "el Servicio"), usted ("el Usuario") declara haber leído, entendido y aceptado íntegramente estos Términos y Condiciones, así como la Política de Tratamiento de Datos Personales. Si no está de acuerdo con alguno de los términos aquí descritos, no debe utilizar la Plataforma.

Cuando un club sea registrado por un administrador en representación de menores de edad, dicho administrador acepta estos Términos también en nombre y representación de los acudientes de los deportistas menores registrados, bajo su responsabilidad.

## 2. Descripción del servicio

VeloClub es un software como servicio (SaaS) que permite a clubes deportivos de cualquier disciplina gestionar registro y administración de miembros, control de asistencia, gestión financiera, registro de resultados deportivos, comunicación interna y funciones de comunidad. VeloClub se ofrece bajo un modelo de suscripción, con un período de prueba gratuito inicial.

## 3. Registro y cuentas de usuario

### 3.1. Requisitos
Para crear una cuenta como administrador de club, el Usuario debe ser mayor de edad y proporcionar información veraz, completa y actualizada. VeloClub no permite el auto-registro de menores de edad.

### 3.2. Veracidad de la información
El Usuario es responsable de la exactitud de los datos suministrados y de mantenerlos actualizados.

### 3.3. Custodia de credenciales
El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas desde su cuenta.

### 3.4. Roles y permisos
La Plataforma opera bajo un esquema de roles (administrador, entrenador, deportista, superadministrador), cada uno con distintos niveles de acceso a la información.

## 4. Planes, pagos y facturación

### 4.1. Período de prueba
VeloClub ofrece un período de prueba gratuito de duración determinada, indicada al momento del registro.

### 4.2. Suscripción
Vencido el período de prueba, la continuidad del servicio está sujeta a la contratación de un plan de suscripción (mensual, trimestral o anual).

### 4.3. Forma de pago
VeloClub no almacena información de tarjetas de crédito, débito ni datos bancarios sensibles en su infraestructura.

### 4.4. Mora y suspensión
El incumplimiento en el pago de la suscripción podrá dar lugar a la suspensión temporal del acceso del club a la Plataforma, previa notificación.

### 4.5. No reembolsos
Salvo que la ley disponga lo contrario, los pagos realizados por la suscripción no son reembolsables.

## 5. Uso aceptable de la Plataforma

1. Utilizar la Plataforma únicamente para fines lícitos relacionados con la gestión de su club deportivo.
2. No suplantar la identidad de terceros ni registrar datos falsos de otras personas.
3. No cargar contenido difamatorio, discriminatorio, obsceno o que infrinja derechos de terceros.
4. No utilizar la Plataforma para enviar spam o contenido malicioso.
5. Obtener las autorizaciones necesarias antes de registrar datos de terceros en la Plataforma.
6. No intentar acceder sin autorización a cuentas, datos o sistemas de otros clubes o usuarios.

VeloClub se reserva el derecho de suspender o eliminar cuentas que incumplan lo aquí dispuesto.

## 6. Contenido generado por el usuario

El Usuario conserva la titularidad de los contenidos que carga en la Plataforma. Al cargar dicho contenido, otorga a VeloClub una licencia limitada, no exclusiva y revocable para almacenarlo, procesarlo y mostrarlo dentro de la Plataforma, con el único fin de prestar el Servicio.

## 7. Perfil público y funciones de comunidad

Algunas funciones permiten que la información básica de un club y de sus miembros sea visible para otros usuarios de la comunidad VeloClub. Esta información **no incluye datos de contacto privados, financieros ni documentos de identidad**.

## 8. Propiedad intelectual

El software, diseño, marca, logotipos y demás elementos de VeloClub son propiedad del titular de la plataforma o de sus licenciantes. Estos Términos no otorgan al Usuario ningún derecho de propiedad sobre la Plataforma, sino únicamente una licencia de uso limitada, no exclusiva e intransferible.

## 9. Disponibilidad del servicio

VeloClub hará sus mejores esfuerzos para mantener la Plataforma disponible de forma continua, pero no garantiza que el servicio esté libre de interrupciones, errores o fallas.

## 10. Limitación de responsabilidad

1. VeloClub no será responsable por daños indirectos, lucro cesante o pérdida de datos derivados del uso de la Plataforma.
2. VeloClub no es responsable por la exactitud de la información registrada por los clubes o sus miembros.
3. VeloClub no es responsable por las relaciones contractuales, deportivas o económicas entre el club y sus miembros.
4. La responsabilidad total de VeloClub frente a cualquier reclamación se limitará al valor pagado por el club durante los últimos meses de suscripción.

## 11. Terminación

### 11.1. Por el Usuario
El club puede cancelar su suscripción y solicitar la eliminación de su cuenta en cualquier momento.

### 11.2. Por VeloClub
VeloClub podrá suspender o terminar el acceso de un Usuario o club que incumpla estos Términos o la ley aplicable.

### 11.3. Efectos de la terminación
Terminada la relación, VeloClub conservará los datos únicamente durante el tiempo necesario para dar cumplimiento a obligaciones legales o contractuales, tras lo cual serán eliminados o anonimizados.

## 12. Modificaciones a los Términos

VeloClub podrá modificar estos Términos en cualquier momento. Las modificaciones sustanciales serán notificadas a través de la Plataforma o del correo electrónico registrado.

## 13. Contacto

- **Correo electrónico:** veloclub.tech@gmail.com
- **Formulario de contacto dentro de la Plataforma**, en el módulo de Ajustes / Centro de ayuda.

## 14. Ley aplicable y jurisdicción

Estos Términos y Condiciones se rigen por las leyes de la República de Colombia. Cualquier controversia derivada de su interpretación o cumplimiento será sometida a los jueces y tribunales competentes de Colombia.

---

*Documento redactado con fines de referencia inicial. Debe ser revisado y validado por un abogado antes de su publicación.*
`;

export const metadata = { title: 'Términos y Condiciones — VeloClub' };

export default function TerminosPage() {
  return (
    <LegalDoc
      title="Términos y Condiciones de Uso"
      subtitle="VeloClub — Plataforma de gestión para clubes deportivos"
      updatedAt="Julio de 2026"
      markdown={MARKDOWN}
    />
  );
}

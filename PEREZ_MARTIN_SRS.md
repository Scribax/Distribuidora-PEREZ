# PEREZ MARTIN Distribuidora — Software Requirements Specification (SRS)

**Versión:** 1.0.0  
**Fecha:** Junio 2026  
**Estado:** Borrador para revisión  
**Preparado por:** Equipo de Arquitectura y Análisis  
**Destinatario:** Equipo de Desarrollo  
**Clasificación:** Documento interno confidencial

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Objetivos](#2-objetivos)
3. [Alcance](#3-alcance)
4. [Requerimientos Funcionales](#4-requerimientos-funcionales)
5. [Requerimientos No Funcionales](#5-requerimientos-no-funcionales)
6. [Reglas de Negocio](#6-reglas-de-negocio)
7. [Casos de Uso](#7-casos-de-uso)
8. [Flujos Completos del Sistema](#8-flujos-completos-del-sistema)
9. [Restricciones](#9-restricciones)
10. [Roles](#10-roles)
11. [Permisos](#11-permisos)
12. [Entidades Principales](#12-entidades-principales)
13. [Relaciones entre Entidades](#13-relaciones-entre-entidades)
14. [Validaciones](#14-validaciones)
15. [Manejo de Errores](#15-manejo-de-errores)
16. [Consideraciones de Rendimiento](#16-consideraciones-de-rendimiento)
17. [Seguridad](#17-seguridad)
18. [Backups](#18-backups)
19. [Escalabilidad](#19-escalabilidad)
20. [Futuras Mejoras](#20-futuras-mejoras)
21. [Glosario](#21-glosario)
22. [Checklist de Funcionalidades](#22-checklist-de-funcionalidades)

---

## 1. Introducción

### 1.1 Propósito del documento

Este documento constituye la Especificación de Requisitos de Software (SRS) del sistema de gestión interna para **PEREZ MARTIN Distribuidora**. Su propósito es definir de forma precisa, completa y no ambigua todos los requerimientos funcionales y no funcionales que deberá satisfacer el sistema a desarrollar.

Este documento es la **única fuente de verdad** durante todo el ciclo de vida del desarrollo. Cualquier decisión de diseño, implementación o testing debe ser validada contra este documento. En caso de contradicción entre este documento y cualquier otra fuente, prevalece este documento.

### 1.2 Alcance del documento

Este SRS cubre:

- La totalidad de los módulos funcionales definidos para la versión 1.0 del sistema.
- Los flujos de usuario, reglas de negocio y validaciones de datos.
- Los requisitos de infraestructura, seguridad y operación.
- Los roles de usuario y sus permisos asociados.
- Los criterios de aceptación implícitos en cada funcionalidad.

Este SRS **no cubre**:

- El diseño visual detallado (UI/UX) de las pantallas.
- La implementación técnica ni el código fuente.
- La integración con sistemas fiscales (AFIP u otros organismos).
- Módulos no solicitados: contabilidad, caja, punto de venta, RRHH, CRM, multiempresa.

### 1.3 Audiencia

Este documento está dirigido a:

- El equipo de desarrollo backend y frontend.
- El equipo de QA y testing.
- El product owner del proyecto.
- Los administradores de infraestructura.
- El cliente (PEREZ MARTIN Distribuidora) para validación y aprobación.

### 1.4 Contexto del negocio

PEREZ MARTIN Distribuidora es una empresa distribuidora que ha experimentado un crecimiento significativo en su catálogo de productos. Actualmente opera con un sistema básico de emisión de facturas que resulta insuficiente para gestionar correctamente el stock, los clientes y las operaciones diarias.

El crecimiento del catálogo ha generado los siguientes problemas concretos:

- Imposibilidad de controlar el stock en tiempo real.
- Falta de visibilidad sobre el estado económico del inventario.
- Ausencia de historial de movimientos de stock.
- Dificultad para gestionar el saldo de los clientes.
- Inexistencia de indicadores de gestión simples para la toma de decisiones.

### 1.5 Definición del problema

El sistema actual no satisface las necesidades operativas mínimas de la distribuidora. Se requiere un sistema nuevo que permita a los operadores registrar compras a proveedores, generar remitos a clientes, controlar el stock automáticamente y visualizar indicadores básicos de gestión, todo desde una interfaz simple y rápida, accesible tanto desde computadoras como desde teléfonos móviles.

---

## 2. Objetivos

### 2.1 Objetivo general

Desarrollar un sistema de gestión operativa simple, estable y eficiente que resuelva los problemas reales de PEREZ MARTIN Distribuidora sin agregar complejidad innecesaria.

### 2.2 Objetivos específicos

**OBJ-01 — Control de stock en tiempo real**
El sistema debe mantener el stock actualizado automáticamente ante cada operación registrada (compra, remito, cancelación), eliminando la posibilidad de errores manuales y stock negativo.

**OBJ-02 — Gestión de clientes y saldos**
El sistema debe permitir registrar clientes, consultar su historial de remitos y visualizar su saldo pendiente, incluyendo dicha información en cada remito generado.

**OBJ-03 — Generación de remitos digitales**
El sistema debe permitir crear, editar, cancelar e imprimir remitos en formato PDF de forma simple y rápida, sin integración con AFIP.

**OBJ-04 — Registro de compras a proveedores**
El sistema debe registrar las compras realizadas a proveedores, actualizando automáticamente el stock y el costo de los productos.

**OBJ-05 — Visibilidad económica básica**
El sistema debe mostrar indicadores simples de gestión: ventas del mes, compras del mes, balance general y valor del stock, con comparativos mensuales.

**OBJ-06 — Acceso móvil**
El sistema debe ser una Progressive Web App que funcione correctamente en teléfonos para consultas de stock, y de forma completa en computadoras.

**OBJ-07 — Infraestructura autónoma**
El sistema debe ejecutarse completamente en la infraestructura propia del cliente (VPS Linux con Docker), sin dependencia de ningún servicio externo de terceros.

---

## 3. Alcance

### 3.1 Módulos incluidos en la versión 1.0

| Módulo | Descripción resumida |
|---|---|
| Autenticación | Login, roles, sesiones con JWT y refresh tokens |
| Dashboard | Indicadores clave del negocio y gráficos mensuales |
| Productos | ABM de productos con precios, costos y stock mínimo |
| Stock | Control automático con historial de movimientos |
| Clientes | ABM de clientes con saldo y historial de remitos |
| Compras | Registro de compras a proveedores |
| Remitos | Generación, edición, cancelación e impresión PDF |
| Listas de precios | Precio mayorista y minorista por producto |
| Balance | Indicadores financieros simples y comparativos |
| PWA | Soporte para dispositivos móviles |

### 3.2 Módulos explícitamente excluidos

Los siguientes módulos están fuera del alcance de este proyecto y no deben ser desarrollados ni contemplados en el diseño de la arquitectura:

- Facturación electrónica (AFIP / CAE / CUIT)
- Contabilidad y balances contables
- Caja y punto de venta
- Gestión de recursos humanos
- CRM avanzado
- Multiempresa / multisucursal
- Inteligencia artificial o automatizaciones complejas
- Módulo de pagos o cobranzas
- Portal de clientes externo

---

## 4. Requerimientos Funcionales

Los requerimientos funcionales están organizados por módulo. Cada requerimiento tiene un identificador único, una descripción y su prioridad.

**Escala de prioridad:**
- **P1 — Crítico:** El sistema no es funcional sin este requerimiento.
- **P2 — Alto:** Esencial para la operación diaria.
- **P3 — Medio:** Importante pero no bloquea la operación.

---

### 4.1 Módulo de Autenticación

**RF-AUTH-01 — Login con credenciales** (P1)
El sistema debe permitir el acceso mediante usuario (email o nombre de usuario) y contraseña. Las contraseñas deben almacenarse hasheadas con Argon2. El sistema no debe revelar si el error de login corresponde al usuario o a la contraseña.

**RF-AUTH-02 — Sesión con JWT** (P1)
Una vez autenticado, el sistema debe emitir un Access Token (JWT) de corta duración y un Refresh Token de larga duración. El Access Token debe contener el rol del usuario y su identificador.

**RF-AUTH-03 — Renovación de sesión** (P1)
El sistema debe renovar el Access Token automáticamente utilizando el Refresh Token, sin requerir que el usuario vuelva a ingresar sus credenciales, mientras el Refresh Token sea válido.

**RF-AUTH-04 — Cierre de sesión** (P1)
El sistema debe permitir al usuario cerrar sesión. Al hacerlo, el Refresh Token debe ser invalidado en base de datos.

**RF-AUTH-05 — Control de acceso por rol** (P1)
Cada endpoint y cada vista deben verificar el rol del usuario autenticado. Un usuario con rol `Consulta` no puede acceder a operaciones de escritura. Un usuario con rol `Empleado` no puede acceder a funciones exclusivas del Administrador.

**RF-AUTH-06 — Gestión de usuarios** (P2)
El Administrador debe poder crear, editar, activar y desactivar usuarios del sistema. No debe existir registro público. Los usuarios son creados exclusivamente por el Administrador.

---

### 4.2 Módulo Dashboard

**RF-DASH-01 — Indicadores del mes** (P1)
El dashboard debe mostrar en forma destacada los siguientes indicadores correspondientes al mes en curso:
- Total de ventas (suma de remitos activos del mes)
- Total de compras (suma de compras del mes)
- Balance del mes (ventas − compras)
- Valor económico total del stock (suma de costo × stock actual de cada producto activo)

**RF-DASH-02 — Alertas de stock bajo** (P1)
El dashboard debe listar todos los productos cuyo stock actual sea igual o inferior al stock mínimo definido. Cada ítem debe mostrar el nombre del producto, el stock actual y el stock mínimo.

**RF-DASH-03 — Últimos remitos emitidos** (P2)
El dashboard debe mostrar los últimos 10 remitos emitidos, con número, cliente, fecha, total y estado.

**RF-DASH-04 — Gráficos comparativos** (P2)
El dashboard debe incluir al menos un gráfico de barras que compare las ventas y compras de los últimos 6 meses. El gráfico debe actualizarse automáticamente con los datos reales del sistema.

**RF-DASH-05 — Acceso según rol** (P1)
El dashboard es visible para todos los roles. El rol `Consulta` solo visualiza, no puede acceder a los módulos operativos desde el dashboard.

---

### 4.3 Módulo de Productos

**RF-PROD-01 — Creación de producto** (P1)
El Administrador y el Empleado deben poder crear nuevos productos con los siguientes campos obligatorios: código interno, nombre, categoría, precio mayorista, precio minorista, costo, stock inicial, stock mínimo y estado.

**RF-PROD-02 — Edición de producto** (P1)
El Administrador y el Empleado deben poder editar cualquier campo de un producto existente. La edición del costo debe registrar el cambio en el historial de movimientos de stock cuando corresponda.

**RF-PROD-03 — Desactivación de producto** (P1)
Un producto no debe eliminarse físicamente de la base de datos. En cambio, debe marcarse como `Inactivo`. Los productos inactivos no deben aparecer en los selectores de remitos ni de compras, pero deben mantenerse en el historial.

**RF-PROD-04 — Listado de productos** (P1)
El sistema debe mostrar un listado paginado de productos con la posibilidad de filtrar por nombre, código, categoría y estado. El listado debe incluir columnas para: código, nombre, categoría, precio mayorista, precio minorista, costo, stock actual y estado.

**RF-PROD-05 — Vista de detalle del producto** (P2)
Al seleccionar un producto del listado, el sistema debe mostrar su ficha completa incluyendo el historial de movimientos de stock asociados.

**RF-PROD-06 — Código interno único** (P1)
El código interno de cada producto debe ser único en el sistema. El sistema debe rechazar la creación o edición que intente asignar un código ya existente.

**RF-PROD-07 — Gestión de categorías** (P2)
El Administrador debe poder crear, editar y desactivar categorías. Las categorías son etiquetas simples para organizar los productos. No deben tener jerarquías ni subcategorías.

---

### 4.4 Módulo de Stock

**RF-STOCK-01 — Actualización automática por compra** (P1)
Cuando se registra una compra, el stock de cada producto incluido debe aumentarse automáticamente según las cantidades registradas. Esta operación debe ser atómica: o se actualiza todo o no se actualiza nada.

**RF-STOCK-02 — Actualización automática por remito** (P1)
Cuando se genera un remito, el stock de cada producto incluido debe disminuirse automáticamente según las cantidades del remito. Si algún producto no tiene stock suficiente, el sistema debe rechazar la operación completa e informar al usuario cuáles productos son insuficientes.

**RF-STOCK-03 — Restauración automática por cancelación** (P1)
Cuando un remito es cancelado, el stock de todos los productos incluidos en ese remito debe restaurarse a los valores previos a la emisión. Esta operación debe ser atómica.

**RF-STOCK-04 — Prohibición de stock negativo** (P1)
Bajo ninguna circunstancia el stock de un producto puede quedar en valor negativo. El sistema debe validar disponibilidad antes de confirmar cualquier operación que reduzca el stock.

**RF-STOCK-05 — Historial de movimientos** (P1)
Cada variación de stock debe registrarse en un historial con: fecha y hora, tipo de movimiento (compra, remito, cancelación, ajuste manual), cantidad (positiva o negativa), referencia al documento origen (número de compra o número de remito) y stock resultante.

**RF-STOCK-06 — Ajuste manual de stock** (P2)
El Administrador debe poder realizar ajustes manuales de stock (corrección de inventario). Cada ajuste debe registrarse en el historial con el campo "motivo" obligatorio y la indicación de que fue un ajuste manual.

**RF-STOCK-07 — Consulta de movimientos** (P2)
El sistema debe permitir filtrar el historial de movimientos por producto, por tipo de movimiento y por rango de fechas.

---

### 4.5 Módulo de Clientes

**RF-CLI-01 — Creación de cliente** (P1)
El Administrador y el Empleado deben poder crear clientes con los siguientes campos: nombre completo (obligatorio), empresa (opcional), dirección (opcional), teléfono (opcional), email (opcional), observaciones (opcional).

**RF-CLI-02 — Edición de cliente** (P1)
El Administrador y el Empleado deben poder editar los datos de un cliente existente. La edición no afecta el historial de remitos ni el saldo.

**RF-CLI-03 — Listado de clientes** (P1)
El sistema debe mostrar un listado paginado de clientes con posibilidad de búsqueda por nombre, empresa y email.

**RF-CLI-04 — Ficha de cliente** (P1)
Cada cliente debe tener una ficha que muestre: sus datos completos, el saldo pendiente actual, y un listado de sus remitos históricos (número, fecha, total, estado).

**RF-CLI-05 — Saldo del cliente** (P1)
El sistema debe mantener un campo `saldo_pendiente` por cliente. Este saldo es informativo y representa el monto total adeudado por el cliente. El Administrador puede actualizarlo manualmente. El saldo no se actualiza automáticamente al generar remitos: su gestión queda a criterio del operador.

**RF-CLI-06 — Saldo en remito** (P1)
El saldo pendiente del cliente debe imprimirse dentro del PDF del remito generado, en la sección de datos del cliente.

**RF-CLI-07 — Desactivación de cliente** (P1)
Los clientes no deben eliminarse físicamente. Deben poder marcarse como inactivos. Un cliente inactivo no aparece en el selector al crear un remito, pero su historial se conserva.

---

### 4.6 Módulo de Compras

**RF-COMP-01 — Registro de compra** (P1)
El Administrador y el Empleado deben poder registrar una compra a un proveedor. La compra debe incluir: proveedor (texto libre o entidad simple), fecha, y uno o más ítems (producto, cantidad, costo unitario de compra).

**RF-COMP-02 — Actualización de stock por compra** (P1)
Al confirmar una compra, el sistema debe incrementar automáticamente el stock de cada producto incluido según la cantidad registrada.

**RF-COMP-03 — Actualización de costo por compra** (P1)
Al registrar una compra, el costo del producto en el catálogo debe actualizarse con el costo unitario informado en la compra. Si el operador no desea actualizar el costo, debe poder indicarlo explícitamente mediante un checkbox o control equivalente en el formulario de compra.

**RF-COMP-04 — Impacto en balance** (P1)
El monto total de cada compra debe ser tenido en cuenta en el balance del mes correspondiente como egreso.

**RF-COMP-05 — Listado de compras** (P2)
El sistema debe mostrar un listado paginado de compras, con filtros por proveedor, producto y rango de fechas. Cada fila debe mostrar: proveedor, fecha, total y cantidad de ítems.

**RF-COMP-06 — Detalle de compra** (P2)
Al seleccionar una compra del listado, el sistema debe mostrar el detalle completo con todos los productos, cantidades y costos.

**RF-COMP-07 — Anulación de compra** (P2)
El Administrador debe poder anular una compra. Al hacerlo, el stock debe revertirse a los valores previos y el impacto en balance debe eliminarse. La anulación debe registrarse en el historial de movimientos de stock.

---

### 4.7 Módulo de Remitos

**RF-REM-01 — Creación de remito** (P1)
El Administrador y el Empleado deben poder crear un remito seleccionando un cliente, eligiendo la lista de precios (mayorista o minorista) y agregando productos con cantidades.

**RF-REM-02 — Numeración automática** (P1)
Cada remito debe recibir un número único, secuencial y automático generado por el sistema. No debe ser editable por el usuario.

**RF-REM-03 — Selección de lista de precios** (P1)
Al crear un remito, el usuario debe seleccionar si utiliza la lista mayorista o la lista minorista. El sistema debe mostrar los precios correspondientes a la lista seleccionada. Una vez seleccionada la lista, los precios se fijan en el remito y no se modifican si el precio del producto cambia posteriormente.

**RF-REM-04 — Verificación de stock al crear** (P1)
Antes de confirmar la creación del remito, el sistema debe verificar que todos los productos tengan stock suficiente. Si alguno no lo tiene, el sistema debe informar cuáles son los productos con stock insuficiente y no confirmar el remito.

**RF-REM-05 — Edición de remito** (P1)
Un remito en estado `Activo` puede ser editado. La edición debe recalcular el impacto en stock: si se aumenta la cantidad de un ítem, debe descontarse más stock; si se reduce, debe restaurarse la diferencia. Si se elimina un ítem, su stock debe restaurarse completamente.

**RF-REM-06 — Cancelación de remito** (P1)
Un remito activo puede ser cancelado. Al cancelar, el stock de todos los productos debe restaurarse. El remito queda en estado `Cancelado` y no puede ser reactivado.

**RF-REM-07 — Generación de PDF** (P1)
El sistema debe permitir generar un PDF del remito que incluya: número de remito, fecha, datos completos del cliente (nombre, empresa, dirección, teléfono, email), saldo pendiente del cliente, tabla de productos (código, nombre, cantidad, precio unitario, subtotal), total general y lista de precios utilizada (mayorista o minorista).

**RF-REM-08 — Impresión** (P2)
El sistema debe ofrecer la opción de enviar el PDF del remito directamente al diálogo de impresión del navegador.

**RF-REM-09 — Listado de remitos** (P1)
El sistema debe mostrar un listado paginado de remitos con filtros por cliente, estado (activo/cancelado), rango de fechas y número de remito. El listado debe mostrar: número, cliente, fecha, total y estado.

**RF-REM-10 — Estados del remito** (P1)
Un remito puede estar en uno de los siguientes estados:
- `Activo`: fue creado y está vigente.
- `Cancelado`: fue anulado, el stock fue restaurado.

No existe el estado "pagado" ya que la gestión de cobranzas está fuera del alcance.

---

### 4.8 Módulo de Listas de Precios

**RF-LP-01 — Precio mayorista y minorista por producto** (P1)
Cada producto debe tener exactamente dos precios: precio mayorista y precio minorista. Ambos campos son obligatorios al crear un producto.

**RF-LP-02 — Selección al crear remito** (P1)
Al crear un remito, el usuario debe elegir entre lista mayorista o lista minorista. Esta selección aplica a todos los productos del remito.

**RF-LP-03 — Precio fijo en remito** (P1)
Los precios que se registran en un remito son los vigentes en el momento de su creación. Una modificación posterior de los precios del producto no afecta los remitos ya emitidos.

**RF-LP-04 — Actualización de precios** (P1)
El Administrador y el Empleado deben poder actualizar los precios mayorista y minorista de cualquier producto sin afectar remitos anteriores.

---

### 4.9 Módulo de Balance

**RF-BAL-01 — Resumen mensual** (P1)
El módulo de balance debe mostrar para el mes seleccionado:
- Total de ventas (suma de totales de remitos activos)
- Total de compras (suma de totales de compras registradas)
- Resultado del mes (ventas − compras)
- Valor total del stock al cierre del mes (o valor actual si es el mes en curso)

**RF-BAL-02 — Valor del stock** (P1)
El valor económico del stock se calcula como la suma de (costo unitario × stock actual) de todos los productos activos.

**RF-BAL-03 — Comparativo mensual con gráficos** (P2)
El módulo debe mostrar un gráfico de barras que compare ventas y compras de los últimos 6 meses. Los datos deben provenir exclusivamente de los registros del sistema.

**RF-BAL-04 — Selector de período** (P2)
El usuario debe poder seleccionar el mes y año a visualizar, no solo el mes en curso.

**RF-BAL-05 — Sin contabilidad formal** (P1)
El módulo de balance no constituye un sistema contable. No genera asientos, no calcula impuestos, no produce estados contables. Es una herramienta de indicadores operativos simples.

---

### 4.10 Módulo PWA

**RF-PWA-01 — Instalación como PWA** (P2)
La aplicación debe ser instalable en dispositivos móviles y computadoras de escritorio como Progressive Web App, permitiendo el acceso desde el ícono de pantalla de inicio sin requerir tienda de aplicaciones.

**RF-PWA-02 — Diseño responsive** (P1)
La interfaz debe adaptarse correctamente a pantallas de escritorio (≥1024px), tablets (768px–1023px) y móviles (<768px).

**RF-PWA-03 — Funcionalidades en móvil** (P2)
Desde dispositivos móviles, la aplicación debe permitir principalmente: consulta de stock, consulta de productos y visualización del dashboard. Las operaciones de creación y edición deben ser accesibles pero la experiencia está optimizada para escritorio.

**RF-PWA-04 — Sin modo offline** (P1)
La aplicación no requiere soporte offline. Requiere conexión a internet para operar. No se implementará service worker para caché de datos de negocio.

---

## 5. Requerimientos No Funcionales

### 5.1 Rendimiento

**RNF-PERF-01 — Tiempo de respuesta**
El 95% de las operaciones de lectura (listados, dashboards, fichas) deben responder en menos de 1 segundo en condiciones normales de carga (hasta 5 usuarios concurrentes).

**RNF-PERF-02 — Tiempo de generación de PDF**
La generación de un remito en PDF no debe superar los 3 segundos.

**RNF-PERF-03 — Paginación obligatoria**
Todos los listados con más de 20 registros deben implementar paginación server-side. Nunca se deben enviar conjuntos de datos sin paginar al frontend.

### 5.2 Disponibilidad

**RNF-DISP-01 — Alta disponibilidad esperada**
El sistema debe apuntar a una disponibilidad del 99% en horario de uso (lunes a sábado, 7:00–20:00 hs). Las tareas de mantenimiento deben planificarse fuera de ese horario.

**RNF-DISP-02 — Recuperación ante fallos**
En caso de reinicio del servidor, todos los servicios Docker deben levantarse automáticamente mediante la política `restart: unless-stopped`.

### 5.3 Usabilidad

**RNF-USA-01 — Simplicidad de la interfaz**
La interfaz debe minimizar la cantidad de clics necesarios para las operaciones más frecuentes: crear remito, consultar stock, registrar compra.

**RNF-USA-02 — Mensajes claros**
Todos los errores de validación deben mostrarse con mensajes en español, específicos y accionables. No deben mostrarse mensajes técnicos ni de sistema al usuario final.

**RNF-USA-03 — Confirmaciones destructivas**
Toda operación irreversible (cancelación de remito, anulación de compra, desactivación de producto) debe requerir confirmación explícita del usuario antes de ejecutarse.

### 5.4 Mantenibilidad

**RNF-MANT-01 — Logs de aplicación**
El backend debe generar logs estructurados de todas las operaciones relevantes: autenticación, creación/edición/cancelación de documentos, errores de validación, errores del sistema. Los logs deben rotarse automáticamente para no consumir espacio en disco de forma ilimitada.

**RNF-MANT-02 — Variables de entorno**
Toda configuración sensible (credenciales de base de datos, secretos JWT, etc.) debe gestionarse exclusivamente mediante variables de entorno (`.env`). Ningún valor sensible debe estar hardcodeado en el código fuente.

**RNF-MANT-03 — Migraciones de base de datos**
Los cambios en el esquema de la base de datos deben gestionarse mediante migraciones versionadas (Prisma Migrate). No deben realizarse cambios manuales directos sobre la base de datos de producción.

---

## 6. Reglas de Negocio

Las reglas de negocio son invariantes del sistema que deben respetarse en toda circunstancia, independientemente de la interfaz o el proceso que las dispare.

| ID | Regla |
|---|---|
| RN-01 | El stock de un producto nunca puede ser negativo. |
| RN-02 | Un remito cancelado no puede reactivarse. |
| RN-03 | El número de remito es asignado por el sistema, es secuencial, único y no editable. |
| RN-04 | Los precios registrados en un remito son invariables; cambios posteriores en el catálogo no afectan remitos emitidos. |
| RN-05 | Un producto solo puede tener un código interno. El código interno no puede modificarse si el producto tiene movimientos registrados. |
| RN-06 | Los usuarios son creados exclusivamente por el Administrador. No existe registro público. |
| RN-07 | Un usuario desactivado no puede iniciar sesión. Sus tokens existentes deben invalidarse. |
| RN-08 | El saldo del cliente es un campo informativo gestionado manualmente por el Administrador. No se actualiza automáticamente. |
| RN-09 | La anulación de una compra revierte el stock a los valores anteriores al momento de la compra. |
| RN-10 | Un producto inactivo no puede ser incluido en nuevos remitos ni en nuevas compras. |
| RN-11 | El ajuste manual de stock requiere un campo "motivo" obligatorio y queda registrado en el historial. |
| RN-12 | La lista de precios (mayorista/minorista) se selecciona una vez por remito y aplica a todos sus ítems. |
| RN-13 | Toda operación que afecte el stock debe registrarse en el historial de movimientos con referencia al documento origen. |
| RN-14 | El costo de un producto puede actualizarse manualmente desde el catálogo o automáticamente al registrar una compra (si el operador lo confirma). |
| RN-15 | El balance no constituye información contable ni fiscal. Es un indicador operativo. |
| RN-16 | La edición de un remito activo recalcula el impacto en stock solo por la diferencia entre las cantidades anterior y nueva. |

---

## 7. Casos de Uso

### Convención de identificación

Los casos de uso se identifican como `CU-[MÓDULO]-[NÚMERO]`.

---

### 7.1 CU-AUTH-01 — Iniciar sesión

**Actor:** Cualquier usuario (Administrador, Empleado, Consulta)  
**Precondición:** El usuario existe en el sistema y está activo.  
**Flujo principal:**
1. El usuario ingresa sus credenciales (usuario y contraseña).
2. El sistema verifica la existencia del usuario.
3. El sistema verifica que la cuenta esté activa.
4. El sistema valida la contraseña usando Argon2.
5. El sistema emite un Access Token y un Refresh Token.
6. El sistema redirige al usuario al Dashboard.

**Flujos alternativos:**
- 2a. El usuario no existe → El sistema muestra "Credenciales inválidas" (no especifica si el error es de usuario o contraseña).
- 3a. La cuenta está desactivada → El sistema muestra "Cuenta desactivada. Contacte al administrador".
- 4a. La contraseña es incorrecta → El sistema muestra "Credenciales inválidas".

**Postcondición:** El usuario accede al sistema con los permisos de su rol.

---

### 7.2 CU-AUTH-02 — Crear usuario

**Actor:** Administrador  
**Precondición:** El actor está autenticado con rol Administrador.  
**Flujo principal:**
1. El Administrador accede al módulo de gestión de usuarios.
2. Selecciona "Nuevo usuario".
3. Completa nombre, email, contraseña y rol (Empleado o Consulta).
4. El sistema valida que el email no esté en uso.
5. El sistema hashea la contraseña y crea el usuario con estado Activo.
6. El sistema confirma la creación.

**Flujos alternativos:**
- 4a. El email ya existe → El sistema muestra error "El email ya está registrado".

---

### 7.3 CU-PROD-01 — Crear producto

**Actor:** Administrador, Empleado  
**Precondición:** El actor está autenticado. El actor no tiene rol Consulta.  
**Flujo principal:**
1. El actor accede al módulo de Productos y selecciona "Nuevo producto".
2. Completa todos los campos obligatorios: código interno, nombre, categoría, precio mayorista, precio minorista, costo, stock inicial, stock mínimo.
3. El sistema verifica que el código interno no exista.
4. El sistema guarda el producto con estado Activo.
5. El sistema registra un movimiento de stock inicial en el historial.

**Flujos alternativos:**
- 3a. El código ya existe → El sistema muestra error "El código ya está en uso".
- 2a. Algún campo obligatorio está vacío → El sistema indica qué campos faltan.

---

### 7.4 CU-STOCK-01 — Consultar historial de movimientos

**Actor:** Administrador, Empleado, Consulta  
**Precondición:** El actor está autenticado.  
**Flujo principal:**
1. El actor accede al módulo de Stock y selecciona un producto.
2. El sistema muestra el historial de movimientos paginado.
3. El actor puede filtrar por tipo de movimiento y rango de fechas.

---

### 7.5 CU-STOCK-02 — Ajuste manual de stock

**Actor:** Administrador  
**Precondición:** El actor está autenticado con rol Administrador.  
**Flujo principal:**
1. El Administrador accede al historial de un producto.
2. Selecciona "Ajuste manual".
3. Ingresa la nueva cantidad de stock y el motivo obligatorio.
4. El sistema muestra la diferencia (positiva o negativa).
5. El Administrador confirma.
6. El sistema actualiza el stock y registra el movimiento.

**Flujos alternativos:**
- 3a. La nueva cantidad resultaría en stock negativo → El sistema rechaza la operación.
- 3b. El motivo está vacío → El sistema rechaza la operación.

---

### 7.6 CU-CLI-01 — Crear cliente

**Actor:** Administrador, Empleado  
**Flujo principal:**
1. El actor accede al módulo de Clientes y selecciona "Nuevo cliente".
2. Completa al menos el campo "Nombre" (obligatorio).
3. Opcionalmente completa: empresa, dirección, teléfono, email, observaciones.
4. El sistema guarda el cliente con saldo pendiente en 0 y estado Activo.

---

### 7.7 CU-CLI-02 — Actualizar saldo de cliente

**Actor:** Administrador  
**Flujo principal:**
1. El Administrador accede a la ficha del cliente.
2. Selecciona "Editar saldo pendiente".
3. Ingresa el nuevo valor del saldo.
4. El sistema actualiza el campo informativo.

---

### 7.8 CU-COMP-01 — Registrar compra

**Actor:** Administrador, Empleado  
**Precondición:** Existen al menos un producto activo en el catálogo.  
**Flujo principal:**
1. El actor accede al módulo de Compras y selecciona "Nueva compra".
2. Ingresa el nombre del proveedor y la fecha de la compra.
3. Agrega ítems: selecciona producto (solo productos activos), ingresa cantidad y costo unitario.
4. El sistema muestra el total calculado.
5. Para cada ítem, el sistema muestra un checkbox "Actualizar costo del producto" (marcado por defecto).
6. El actor confirma la compra.
7. El sistema actualiza el stock de cada producto en forma atómica.
8. El sistema actualiza el costo de los productos donde el checkbox esté marcado.
9. El sistema registra los movimientos de stock en el historial.
10. El sistema registra la compra como egreso en el balance.

**Flujos alternativos:**
- 3a. El actor selecciona un producto que no existe → El sistema no lo permite.
- 6a. No se agregaron ítems → El sistema rechaza la operación.

---

### 7.9 CU-REM-01 — Crear remito

**Actor:** Administrador, Empleado  
**Precondición:** Existe al menos un cliente activo y al menos un producto activo con stock disponible.  
**Flujo principal:**
1. El actor accede al módulo de Remitos y selecciona "Nuevo remito".
2. Selecciona el cliente (solo clientes activos).
3. Selecciona la lista de precios (Mayorista o Minorista).
4. Agrega ítems: selecciona producto (solo activos), ingresa cantidad. El sistema muestra automáticamente el precio según la lista seleccionada.
5. El sistema calcula el subtotal y el total en tiempo real.
6. El actor confirma la creación.
7. El sistema verifica stock disponible para todos los ítems.
8. El sistema genera el remito con número automático y estado Activo.
9. El sistema descuenta el stock en forma atómica.
10. El sistema registra los movimientos en el historial.

**Flujos alternativos:**
- 7a. Algún producto no tiene stock suficiente → El sistema informa los productos afectados y no confirma el remito.
- 2a. El actor selecciona un cliente inactivo → El sistema no lo permite.
- 4a. El actor selecciona un producto inactivo → El sistema no lo permite.

**Postcondición:** El remito queda en estado Activo. El PDF puede generarse inmediatamente.

---

### 7.10 CU-REM-02 — Editar remito

**Actor:** Administrador, Empleado  
**Precondición:** El remito existe y está en estado Activo.  
**Flujo principal:**
1. El actor selecciona el remito del listado.
2. Selecciona "Editar".
3. Modifica cantidades, agrega o elimina ítems. El cliente y la lista de precios no son editables.
4. El sistema recalcula el total.
5. El actor confirma los cambios.
6. El sistema verifica la disponibilidad de stock para las diferencias positivas.
7. El sistema actualiza el stock con las diferencias (suma o resta según el cambio).
8. El sistema registra los movimientos correspondientes.

**Flujos alternativos:**
- 6a. El incremento de cantidad supera el stock disponible → El sistema rechaza la operación e informa el producto afectado.

---

### 7.11 CU-REM-03 — Cancelar remito

**Actor:** Administrador, Empleado  
**Precondición:** El remito existe y está en estado Activo.  
**Flujo principal:**
1. El actor selecciona el remito del listado.
2. Selecciona "Cancelar remito".
3. El sistema solicita confirmación explícita.
4. El actor confirma.
5. El sistema cambia el estado del remito a `Cancelado`.
6. El sistema restaura el stock de todos los productos incluidos.
7. El sistema registra los movimientos de restauración en el historial.

**Postcondición:** El remito queda en estado `Cancelado` de forma permanente e irreversible.

---

### 7.12 CU-REM-04 — Generar PDF del remito

**Actor:** Administrador, Empleado, Consulta  
**Precondición:** El remito existe.  
**Flujo principal:**
1. El actor accede al detalle del remito.
2. Selecciona "Descargar PDF" o "Imprimir".
3. El sistema genera el PDF con todos los datos requeridos.
4. El sistema entrega el archivo al navegador para descarga o impresión.

---

## 8. Flujos Completos del Sistema

Esta sección describe los flujos end-to-end de las operaciones más críticas del negocio, integrando múltiples módulos.

---

### 8.1 Flujo: Alta de producto y primer ingreso de stock

```
[Administrador / Empleado]
        │
        ▼
  Módulo Productos → "Nuevo producto"
        │
        ▼
  Completar: código, nombre, categoría, precios, costo,
             stock inicial, stock mínimo
        │
        ▼
  ¿Código duplicado? → SÍ → Error, fin del flujo
        │ NO
        ▼
  Guardar producto (estado: Activo)
        │
        ▼
  Registrar movimiento inicial en historial
  (tipo: "Alta de producto", cantidad: stock inicial)
        │
        ▼
  Producto disponible en catálogo
```

---

### 8.2 Flujo: Registro de compra a proveedor

```
[Administrador / Empleado]
        │
        ▼
  Módulo Compras → "Nueva compra"
        │
        ▼
  Ingresar: proveedor, fecha
        │
        ▼
  Agregar ítems: producto + cantidad + costo unitario
  (solo productos activos)
        │
        ▼
  Seleccionar para cada ítem:
  ¿Actualizar costo en catálogo? (checkbox)
        │
        ▼
  Confirmar compra
        │
        ▼
  [TRANSACCIÓN ATÓMICA]
  ┌─────────────────────────────────────────────┐
  │ Para cada ítem:                             │
  │   stock_actual += cantidad_comprada         │
  │   Si checkbox marcado:                      │
  │     producto.costo = costo_unitario_compra  │
  │   Registrar movimiento en historial         │
  │     (tipo: "Compra", ref: ID compra)        │
  └─────────────────────────────────────────────┘
        │
        ▼
  Registrar compra con total en balance (egreso)
        │
        ▼
  Confirmar operación al usuario
```

---

### 8.3 Flujo: Creación de remito

```
[Administrador / Empleado]
        │
        ▼
  Módulo Remitos → "Nuevo remito"
        │
        ▼
  Seleccionar cliente (solo activos)
        │
        ▼
  Seleccionar lista de precios: Mayorista | Minorista
        │
        ▼
  Agregar ítems:
    - Seleccionar producto (solo activos)
    - Ingresar cantidad
    - Sistema muestra precio según lista y calcula subtotal
        │
        ▼
  Confirmar remito
        │
        ▼
  Verificar stock para cada ítem
        │
        ▼
  ¿Algún producto sin stock suficiente?
     │ SÍ → Mostrar lista de productos insuficientes
     │       Fin del flujo (sin cambios)
     │ NO
     ▼
  [TRANSACCIÓN ATÓMICA]
  ┌─────────────────────────────────────────────┐
  │ Asignar número automático secuencial        │
  │ Guardar remito con estado "Activo"          │
  │ Para cada ítem:                             │
  │   stock_actual -= cantidad_remito           │
  │   Registrar movimiento en historial         │
  │     (tipo: "Remito", ref: número remito)    │
  └─────────────────────────────────────────────┘
        │
        ▼
  Mostrar remito creado con opción de PDF / imprimir
```

---

### 8.4 Flujo: Cancelación de remito

```
[Administrador / Empleado]
        │
        ▼
  Módulo Remitos → Seleccionar remito Activo
        │
        ▼
  "Cancelar remito"
        │
        ▼
  Mostrar confirmación: "¿Está seguro? Esta acción es irreversible."
        │
        ▼
  ¿Confirma? → NO → Fin del flujo
        │ SÍ
        ▼
  [TRANSACCIÓN ATÓMICA]
  ┌─────────────────────────────────────────────┐
  │ Cambiar estado remito a "Cancelado"         │
  │ Para cada ítem del remito:                  │
  │   stock_actual += cantidad_del_item         │
  │   Registrar movimiento en historial         │
  │     (tipo: "Cancelación remito",            │
  │      ref: número remito)                    │
  └─────────────────────────────────────────────┘
        │
        ▼
  Confirmar cancelación al usuario
```

---

### 8.5 Flujo: Edición de remito activo

```
[Administrador / Empleado]
        │
        ▼
  Módulo Remitos → Seleccionar remito Activo → "Editar"
        │
        ▼
  Modificar cantidades / agregar ítems / eliminar ítems
  (cliente y lista de precios: NO editables)
        │
        ▼
  Para cada ítem modificado:
    diferencia = cantidad_nueva − cantidad_anterior
        │
        ▼
  ¿Alguna diferencia positiva supera el stock disponible?
     │ SÍ → Mostrar error. Fin del flujo.
     │ NO
     ▼
  [TRANSACCIÓN ATÓMICA]
  ┌────────────────────────────────────────────────────┐
  │ Para cada ítem:                                    │
  │   Si diferencia > 0: stock -= diferencia           │
  │   Si diferencia < 0: stock += abs(diferencia)      │
  │   Si ítem eliminado: stock += cantidad_eliminada   │
  │   Registrar movimiento en historial                │
  │ Actualizar total del remito                        │
  └────────────────────────────────────────────────────┘
        │
        ▼
  Confirmar edición al usuario
```

---

## 9. Restricciones

### 9.1 Restricciones técnicas

**REST-TEC-01 — Self-hosted obligatorio**
El sistema debe desplegarse exclusivamente en el VPS del cliente mediante Docker Compose. No está permitido utilizar ningún servicio SaaS de terceros para ningún componente del sistema (base de datos, autenticación, almacenamiento, etc.).

**REST-TEC-02 — Sin integración AFIP**
El sistema no debe integrar facturación electrónica, no debe comunicarse con servicios de la AFIP, y no debe generar comprobantes fiscales de ningún tipo. Los remitos generados son documentos internos sin validez fiscal.

**REST-TEC-03 — Sin contabilidad**
El sistema no debe implementar plan de cuentas, asientos contables, libros mayores, estados de resultados formales ni ningún otro concepto propio de un sistema contable.

**REST-TEC-04 — Sin multiempresa**
El sistema gestiona una única empresa (PEREZ MARTIN Distribuidora). No debe contemplarse arquitectura multitenancy ni separación de datos por empresa o sucursal.

**REST-TEC-05 — Stack tecnológico definido**
El sistema debe desarrollarse usando el stack especificado en la sección de contexto tecnológico. No se deben introducir dependencias adicionales no justificadas.

### 9.2 Restricciones de negocio

**REST-NEG-01 — Sin portal externo**
No se desarrolla portal para clientes. Los clientes no acceden al sistema.

**REST-NEG-02 — Sin gestión de cobranzas**
El sistema no gestiona pagos, cobros parciales, cuotas ni estado de cuenta automatizado. El saldo del cliente es informativo.

**REST-NEG-03 — Sin multiusuario concurrente avanzado**
El sistema no está diseñado para soportar decenas de usuarios concurrentes. El uso esperado es de 2 a 5 usuarios simultáneos como máximo.

---

## 10. Roles

El sistema define exactamente tres roles de usuario. Los roles son asignados por el Administrador en el momento de crear el usuario y pueden modificarse posteriormente.

### 10.1 Administrador

Rol con acceso completo al sistema. Existe al menos un usuario con este rol en todo momento. El sistema no debe permitir que el último Administrador activo sea desactivado.

Responsabilidades típicas:
- Gestionar usuarios del sistema.
- Configurar productos, precios y categorías.
- Realizar ajustes manuales de stock.
- Anular compras y cancelar remitos.
- Acceder al módulo de balance.
- Actualizar saldos de clientes.

### 10.2 Empleado

Rol operativo con acceso a las funciones del día a día, sin acceso a funciones de configuración crítica ni a la gestión de usuarios.

Responsabilidades típicas:
- Crear y editar remitos.
- Registrar compras.
- Gestionar clientes (alta, edición).
- Consultar stock y productos.

### 10.3 Consulta

Rol de solo lectura. No puede crear, editar ni eliminar ningún registro. Es útil para personal de depósito o directivos que necesiten consultar información sin riesgo de modificarla.

Acceso típico:
- Visualizar dashboard.
- Consultar stock de productos.
- Ver listado de remitos y clientes.
- Descargar PDF de remitos existentes.

---

## 11. Permisos

La siguiente matriz define los permisos de cada rol sobre cada módulo y operación. Una celda marcada con ✅ indica que el rol tiene permiso. Una celda con ❌ indica que no tiene permiso.

### 11.1 Módulo de Usuarios

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver listado de usuarios | ✅ | ❌ | ❌ |
| Crear usuario | ✅ | ❌ | ❌ |
| Editar usuario | ✅ | ❌ | ❌ |
| Activar / desactivar usuario | ✅ | ❌ | ❌ |

### 11.2 Módulo de Productos

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver listado | ✅ | ✅ | ✅ |
| Ver detalle / ficha | ✅ | ✅ | ✅ |
| Crear producto | ✅ | ✅ | ❌ |
| Editar producto | ✅ | ✅ | ❌ |
| Desactivar producto | ✅ | ❌ | ❌ |
| Gestionar categorías | ✅ | ❌ | ❌ |

### 11.3 Módulo de Stock

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver stock actual | ✅ | ✅ | ✅ |
| Ver historial de movimientos | ✅ | ✅ | ✅ |
| Realizar ajuste manual | ✅ | ❌ | ❌ |

### 11.4 Módulo de Clientes

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver listado | ✅ | ✅ | ✅ |
| Ver ficha de cliente | ✅ | ✅ | ✅ |
| Crear cliente | ✅ | ✅ | ❌ |
| Editar cliente | ✅ | ✅ | ❌ |
| Desactivar cliente | ✅ | ❌ | ❌ |
| Actualizar saldo pendiente | ✅ | ❌ | ❌ |

### 11.5 Módulo de Compras

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver listado de compras | ✅ | ✅ | ✅ |
| Ver detalle de compra | ✅ | ✅ | ✅ |
| Registrar compra | ✅ | ✅ | ❌ |
| Anular compra | ✅ | ❌ | ❌ |

### 11.6 Módulo de Remitos

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver listado de remitos | ✅ | ✅ | ✅ |
| Ver detalle de remito | ✅ | ✅ | ✅ |
| Generar / descargar PDF | ✅ | ✅ | ✅ |
| Crear remito | ✅ | ✅ | ❌ |
| Editar remito activo | ✅ | ✅ | ❌ |
| Cancelar remito | ✅ | ✅ | ❌ |

### 11.7 Módulo de Balance y Dashboard

| Operación | Administrador | Empleado | Consulta |
|---|:---:|:---:|:---:|
| Ver dashboard | ✅ | ✅ | ✅ |
| Ver balance | ✅ | ✅ | ❌ |
| Seleccionar período en balance | ✅ | ✅ | ❌ |

---

## 12. Entidades Principales

Esta sección define las entidades del modelo de datos. Se describe cada campo con su tipo, restricciones y propósito de negocio. No constituye un esquema SQL estricto; el equipo de desarrollo implementará el esquema usando Prisma.

---

### 12.1 Usuario (`User`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `nombre` | String | not null, max 100 | Nombre completo del usuario |
| `email` | String | not null, unique | Email de acceso al sistema |
| `password_hash` | String | not null | Hash Argon2 de la contraseña |
| `rol` | Enum | not null | `ADMINISTRADOR`, `EMPLEADO`, `CONSULTA` |
| `activo` | Boolean | default: true | Si el usuario puede iniciar sesión |
| `created_at` | DateTime | not null | Fecha de creación |
| `updated_at` | DateTime | not null | Fecha de última modificación |

---

### 12.2 Refresh Token (`RefreshToken`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `user_id` | UUID | FK → User | Usuario propietario |
| `token_hash` | String | not null, unique | Hash del refresh token |
| `expires_at` | DateTime | not null | Fecha de expiración |
| `revoked` | Boolean | default: false | Si fue revocado |
| `created_at` | DateTime | not null | Fecha de creación |

---

### 12.3 Categoría (`Categoria`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `nombre` | String | not null, unique, max 80 | Nombre de la categoría |
| `activo` | Boolean | default: true | Si la categoría está activa |
| `created_at` | DateTime | not null | Fecha de creación |

---

### 12.4 Producto (`Producto`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `codigo_interno` | String | not null, unique, max 50 | Código interno del producto |
| `nombre` | String | not null, max 200 | Nombre descriptivo |
| `categoria_id` | UUID | FK → Categoria, not null | Categoría a la que pertenece |
| `precio_mayorista` | Decimal | not null, ≥ 0 | Precio lista mayorista |
| `precio_minorista` | Decimal | not null, ≥ 0 | Precio lista minorista |
| `costo` | Decimal | not null, ≥ 0 | Costo de adquisición actual |
| `stock_actual` | Integer | not null, ≥ 0 | Unidades disponibles |
| `stock_minimo` | Integer | not null, ≥ 0 | Umbral de alerta de stock bajo |
| `activo` | Boolean | default: true | Estado del producto |
| `created_at` | DateTime | not null | Fecha de creación |
| `updated_at` | DateTime | not null | Fecha de última modificación |

---

### 12.5 Movimiento de Stock (`MovimientoStock`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `producto_id` | UUID | FK → Producto, not null | Producto afectado |
| `tipo` | Enum | not null | `COMPRA`, `REMITO`, `CANCELACION_REMITO`, `ANULACION_COMPRA`, `AJUSTE_MANUAL`, `ALTA_PRODUCTO` |
| `cantidad` | Integer | not null | Positivo (entrada) o negativo (salida) |
| `stock_resultante` | Integer | not null, ≥ 0 | Stock luego del movimiento |
| `referencia_id` | UUID | nullable | ID del documento origen (compra o remito) |
| `referencia_tipo` | String | nullable | `"Compra"` o `"Remito"` |
| `motivo` | String | nullable, max 300 | Requerido en ajustes manuales |
| `usuario_id` | UUID | FK → User, not null | Usuario que realizó la operación |
| `created_at` | DateTime | not null | Fecha y hora del movimiento |

---

### 12.6 Cliente (`Cliente`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `nombre` | String | not null, max 150 | Nombre completo |
| `empresa` | String | nullable, max 150 | Razón social o nombre comercial |
| `direccion` | String | nullable, max 300 | Dirección postal |
| `telefono` | String | nullable, max 30 | Teléfono de contacto |
| `email` | String | nullable, max 150 | Email de contacto |
| `observaciones` | Text | nullable | Notas internas libres |
| `saldo_pendiente` | Decimal | default: 0 | Saldo informativo gestionado manualmente |
| `activo` | Boolean | default: true | Estado del cliente |
| `created_at` | DateTime | not null | Fecha de creación |
| `updated_at` | DateTime | not null | Fecha de última modificación |

---

### 12.7 Proveedor (`Proveedor`)

Nota: Los proveedores son entidades simples. En la versión 1.0 el proveedor se registra como texto libre dentro de la compra. Se define aquí como entidad para permitir su evolución futura.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `nombre` | String | not null, max 150 | Nombre del proveedor |
| `created_at` | DateTime | not null | Fecha de creación |

---

### 12.8 Compra (`Compra`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `proveedor_nombre` | String | not null, max 150 | Nombre del proveedor (texto libre) |
| `fecha` | Date | not null | Fecha de la compra |
| `total` | Decimal | not null, ≥ 0 | Suma de (cantidad × costo) de todos los ítems |
| `estado` | Enum | default: `ACTIVA` | `ACTIVA`, `ANULADA` |
| `usuario_id` | UUID | FK → User, not null | Usuario que registró la compra |
| `created_at` | DateTime | not null | Fecha de registro |
| `updated_at` | DateTime | not null | Fecha de última modificación |

---

### 12.9 Ítem de Compra (`CompraItem`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `compra_id` | UUID | FK → Compra, not null | Compra a la que pertenece |
| `producto_id` | UUID | FK → Producto, not null | Producto comprado |
| `cantidad` | Integer | not null, > 0 | Unidades compradas |
| `costo_unitario` | Decimal | not null, ≥ 0 | Costo por unidad al momento de la compra |
| `actualizar_costo` | Boolean | not null | Si se actualizó el costo del producto |
| `subtotal` | Decimal | not null, ≥ 0 | cantidad × costo_unitario |

---

### 12.10 Remito (`Remito`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `numero` | Integer | not null, unique, autoincrement | Número de remito secuencial |
| `cliente_id` | UUID | FK → Cliente, not null | Cliente del remito |
| `lista_precios` | Enum | not null | `MAYORISTA`, `MINORISTA` |
| `saldo_cliente_al_emitir` | Decimal | not null | Saldo del cliente al momento de emisión |
| `total` | Decimal | not null, ≥ 0 | Total del remito |
| `estado` | Enum | default: `ACTIVO` | `ACTIVO`, `CANCELADO` |
| `fecha` | Date | not null | Fecha del remito |
| `usuario_id` | UUID | FK → User, not null | Usuario que creó el remito |
| `created_at` | DateTime | not null | Fecha de creación |
| `updated_at` | DateTime | not null | Fecha de última modificación |

---

### 12.11 Ítem de Remito (`RemitoItem`)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, not null | Identificador único |
| `remito_id` | UUID | FK → Remito, not null | Remito al que pertenece |
| `producto_id` | UUID | FK → Producto, not null | Producto incluido |
| `codigo_producto` | String | not null | Código del producto al momento de emisión |
| `nombre_producto` | String | not null | Nombre del producto al momento de emisión |
| `cantidad` | Integer | not null, > 0 | Unidades remitidas |
| `precio_unitario` | Decimal | not null, ≥ 0 | Precio según lista al momento de emisión |
| `subtotal` | Decimal | not null, ≥ 0 | cantidad × precio_unitario |

> **Nota:** Los campos `codigo_producto` y `nombre_producto` se almacenan desnormalizados en el ítem del remito para garantizar que el historial no cambie si el producto es editado posteriormente.

---

## 13. Relaciones entre Entidades

```
User ──────────────────────────────────────────────────────────┐
 │                                                             │
 ├──── crea ────► RefreshToken (1:N)                          │
 │                                                             │
 ├──── crea ────► Compra (1:N) ────► CompraItem (1:N) ──── Producto
 │                                                             │
 ├──── crea ────► Remito (1:N) ────► RemitoItem (1:N) ──── Producto
 │                                                             │
 └──── crea ────► MovimientoStock (1:N) ─────────────────── Producto

Cliente ───────────────────────────────────────────────────────┐
 │                                                             │
 └──── tiene ───► Remito (1:N)

Categoria ─────────────────────────────────────────────────────┐
 │                                                             │
 └──── agrupa ──► Producto (1:N)

Producto ─────────────────────────────────────────────────────
 │
 ├──── tiene ───► MovimientoStock (1:N)
 ├──── aparece en ► CompraItem (1:N)
 └──── aparece en ► RemitoItem (1:N)
```

**Cardinalidades clave:**

- Un `Cliente` puede tener muchos `Remito`, pero cada `Remito` pertenece a un solo `Cliente`.
- Un `Remito` puede tener muchos `RemitoItem`, cada uno referenciando un `Producto`.
- Una `Compra` puede tener muchos `CompraItem`, cada uno referenciando un `Producto`.
- Un `Producto` puede aparecer en muchos `MovimientoStock`, `CompraItem` y `RemitoItem`.
- Un `Producto` pertenece a exactamente una `Categoria`.

---

## 14. Validaciones

### 14.1 Validaciones de entrada (frontend y backend)

Todas las validaciones deben aplicarse tanto en el frontend (para experiencia de usuario) como en el backend (como fuente de verdad). El backend nunca debe confiar en que el frontend ya validó.

#### Productos

| Campo | Validación |
|---|---|
| `codigo_interno` | Obligatorio. Único. Máx. 50 caracteres. Sin espacios. |
| `nombre` | Obligatorio. Máx. 200 caracteres. |
| `categoria_id` | Obligatorio. Debe existir y estar activa. |
| `precio_mayorista` | Obligatorio. Número ≥ 0. Hasta 2 decimales. |
| `precio_minorista` | Obligatorio. Número ≥ 0. Hasta 2 decimales. |
| `costo` | Obligatorio. Número ≥ 0. Hasta 2 decimales. |
| `stock_actual` | Obligatorio en alta. Entero ≥ 0. |
| `stock_minimo` | Obligatorio. Entero ≥ 0. |
| `estado` | Debe ser `ACTIVO` o `INACTIVO`. |

#### Clientes

| Campo | Validación |
|---|---|
| `nombre` | Obligatorio. Máx. 150 caracteres. |
| `email` | Opcional. Formato email válido si se ingresa. Máx. 150 caracteres. |
| `telefono` | Opcional. Máx. 30 caracteres. |
| `saldo_pendiente` | Decimal. Puede ser 0 o positivo. |

#### Compras

| Campo | Validación |
|---|---|
| `proveedor_nombre` | Obligatorio. Máx. 150 caracteres. |
| `fecha` | Obligatorio. Fecha válida. No puede ser futura más de 1 día. |
| `items` | Al menos 1 ítem. |
| `item.producto_id` | Debe existir y estar activo. |
| `item.cantidad` | Entero > 0. |
| `item.costo_unitario` | Decimal ≥ 0. |

#### Remitos

| Campo | Validación |
|---|---|
| `cliente_id` | Obligatorio. Debe existir y estar activo. |
| `lista_precios` | Obligatorio. Debe ser `MAYORISTA` o `MINORISTA`. |
| `items` | Al menos 1 ítem. |
| `item.producto_id` | Debe existir y estar activo. |
| `item.cantidad` | Entero > 0. No puede superar el stock disponible. |

#### Usuarios

| Campo | Validación |
|---|---|
| `nombre` | Obligatorio. Máx. 100 caracteres. |
| `email` | Obligatorio. Formato email. Único en el sistema. |
| `password` | Mínimo 8 caracteres. No se valida complejidad adicional en v1.0. |
| `rol` | Debe ser `ADMINISTRADOR`, `EMPLEADO` o `CONSULTA`. |

#### Ajuste manual de stock

| Campo | Validación |
|---|---|
| `cantidad_nueva` | Entero ≥ 0. |
| `motivo` | Obligatorio. Mínimo 10 caracteres. Máx. 300 caracteres. |

---

## 15. Manejo de Errores

### 15.1 Principios generales

- Los errores de negocio (stock insuficiente, código duplicado, etc.) deben retornar HTTP 422 con un mensaje descriptivo en español.
- Los errores de autenticación deben retornar HTTP 401.
- Los errores de autorización (rol insuficiente) deben retornar HTTP 403.
- Los errores de recurso no encontrado deben retornar HTTP 404.
- Los errores internos del servidor deben retornar HTTP 500 con un mensaje genérico, sin exponer detalles técnicos al frontend.
- Los errores de validación de schema deben retornar HTTP 400 con detalle de los campos inválidos.

### 15.2 Estructura de respuesta de error

Todas las respuestas de error deben seguir esta estructura JSON:

```
{
  "error": true,
  "code": "STOCK_INSUFICIENTE",
  "message": "No hay stock suficiente para los siguientes productos",
  "details": [
    {
      "producto": "Harina 000 x 1kg",
      "stock_disponible": 3,
      "cantidad_solicitada": 10
    }
  ]
}
```

### 15.3 Catálogo de errores de negocio

| Código | Descripción | HTTP |
|---|---|---|
| `STOCK_INSUFICIENTE` | El stock disponible es menor a la cantidad solicitada | 422 |
| `CODIGO_DUPLICADO` | El código interno ya existe en otro producto | 422 |
| `EMAIL_DUPLICADO` | El email ya está registrado en otro usuario | 422 |
| `PRODUCTO_INACTIVO` | Se intentó usar un producto inactivo en una operación | 422 |
| `CLIENTE_INACTIVO` | Se intentó crear un remito para un cliente inactivo | 422 |
| `REMITO_CANCELADO` | Se intentó editar un remito en estado Cancelado | 422 |
| `ULTIMO_ADMIN` | Se intentó desactivar al último administrador activo | 422 |
| `STOCK_NEGATIVO` | La operación resultaría en stock negativo | 422 |
| `COMPRA_ANULADA` | Se intentó operar sobre una compra ya anulada | 422 |
| `CREDENCIALES_INVALIDAS` | Email o contraseña incorrectos | 401 |
| `CUENTA_DESACTIVADA` | El usuario existe pero está desactivado | 401 |
| `TOKEN_INVALIDO` | El JWT no es válido o expiró | 401 |
| `TOKEN_REVOCADO` | El Refresh Token fue revocado | 401 |
| `SIN_PERMISO` | El rol del usuario no tiene permiso para esta operación | 403 |

### 15.4 Transacciones atómicas

Toda operación que modifica múltiples registros en la base de datos (creación de remito, registro de compra, cancelación de remito) debe ejecutarse dentro de una transacción de base de datos. Si cualquier paso falla, toda la operación debe revertirse (rollback). Nunca debe quedar el sistema en un estado inconsistente.

---

## 16. Consideraciones de Rendimiento

### 16.1 Indexación de base de datos

Los siguientes campos deben tener índices de base de datos para garantizar consultas eficientes:

- `Producto.codigo_interno` (unique)
- `Producto.activo`
- `Producto.categoria_id`
- `Remito.cliente_id`
- `Remito.estado`
- `Remito.fecha`
- `Remito.numero` (unique)
- `MovimientoStock.producto_id`
- `MovimientoStock.created_at`
- `Compra.fecha`
- `Compra.estado`
- `Usuario.email` (unique)
- `RefreshToken.token_hash` (unique)

### 16.2 Paginación

Todos los endpoints de listado deben implementar paginación server-side. El tamaño de página por defecto es 20 registros. El tamaño máximo permitido es 100 registros por página. El frontend nunca debe solicitar todos los registros sin paginación.

### 16.3 Caché de indicadores del dashboard

Los indicadores del dashboard (ventas del mes, compras del mes, valor del stock) pueden calcularse con una caché de corta duración (máximo 60 segundos) para evitar recalcularlos en cada acceso. La caché debe invalidarse automáticamente cuando se registre una compra, un remito o una cancelación.

### 16.4 Generación de PDF

La generación del PDF de un remito se realiza bajo demanda (no se pre-genera). Los PDFs no se almacenan en disco; se generan en memoria y se envían directamente al cliente. Esto evita la necesidad de gestionar almacenamiento de archivos.

---

## 17. Seguridad

### 17.1 Autenticación y tokens

- Las contraseñas deben hashearse con Argon2id con parámetros de costo adecuados para el hardware del servidor.
- El Access Token (JWT) debe tener una duración máxima de 15 minutos.
- El Refresh Token debe tener una duración de 7 días.
- Los Refresh Tokens deben almacenarse hasheados en la base de datos, no en texto plano.
- Al revocar un Refresh Token (logout), su registro en base de datos debe marcarse como revocado inmediatamente.
- El JWT debe incluir en su payload: `user_id`, `rol` y `iat`/`exp`.
- El secreto JWT debe configurarse como variable de entorno con una longitud mínima de 32 caracteres aleatorios.

### 17.2 Headers de seguridad HTTP

Nginx debe configurar los siguientes headers en todas las respuestas:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (solo en HTTPS)
- `Referrer-Policy: no-referrer`

### 17.3 HTTPS

El sistema debe servirse exclusivamente mediante HTTPS en producción. Nginx debe gestionar los certificados TLS. Se recomienda Let's Encrypt mediante Certbot para la gestión de certificados gratuita.

### 17.4 CORS

La API debe configurar CORS de forma restrictiva, permitiendo únicamente el origen del frontend de producción. No debe permitirse `*` como origen en producción.

### 17.5 Rate limiting

Nginx debe implementar rate limiting en el endpoint de login para prevenir ataques de fuerza bruta. Se sugiere un máximo de 10 intentos por minuto por IP.

### 17.6 Sanitización de inputs

Todos los inputs de texto deben sanitizarse para eliminar caracteres de control y espacios innecesarios antes de ser almacenados. No deben almacenarse scripts ni HTML en campos de texto.

### 17.7 Variables de entorno

Los siguientes valores deben gestionarse obligatoriamente como variables de entorno y nunca estar presentes en el código fuente ni en el repositorio:

- Credenciales de base de datos (usuario, contraseña, nombre de base de datos)
- Secret del JWT
- Cualquier otro secreto o credencial de servicio

### 17.8 Acceso a la base de datos

La base de datos PostgreSQL no debe estar expuesta al exterior del servidor. Solo debe ser accesible desde la red interna de Docker. El puerto de PostgreSQL no debe abrirse en el firewall del VPS.

---

## 18. Backups

### 18.1 Estrategia de backup

Dado que el sistema es self-hosted, la responsabilidad del backup recae en el cliente. El equipo de desarrollo debe documentar y entregar los scripts necesarios para ejecutar backups automáticos.

### 18.2 Frecuencia recomendada

- Backup diario automático de la base de datos PostgreSQL, ejecutado a las 03:00 hs mediante cron.
- Retención de los últimos 30 backups diarios.
- Retención de backups semanales durante 3 meses.

### 18.3 Mecanismo de backup

El backup debe realizarse mediante `pg_dump` sobre el contenedor de PostgreSQL en Docker. El archivo generado debe comprimirse con `gzip` y almacenarse en una carpeta local del VPS dedicada a backups.

### 18.4 Verificación de backups

El script de backup debe verificar que el archivo generado no esté vacío y registrar en un log de sistema si el backup fue exitoso o falló.

### 18.5 Responsabilidad del cliente

El cliente debe establecer un mecanismo de copia de los backups a una ubicación externa (disco externo, servicio de almacenamiento propio) que no dependa del VPS principal. El equipo de desarrollo no es responsable de la pérdida de datos si no se implementa replicación externa.

---

## 19. Escalabilidad

### 19.1 Alcance esperado de la versión 1.0

El sistema está diseñado para una carga de 2 a 5 usuarios concurrentes, un catálogo de hasta 5.000 productos y un volumen de hasta 500 remitos mensuales. Dentro de estos parámetros, el sistema debe operar con la performance definida en la sección 16.

### 19.2 Escalabilidad vertical

Si el negocio crece, el primer paso de escalado es el aumento de recursos del VPS (CPU, RAM, disco). La arquitectura Docker Compose facilita esta operación sin cambios en el código.

### 19.3 Escalabilidad horizontal (versiones futuras)

La arquitectura actual (monolito backend + PostgreSQL) no contempla escalabilidad horizontal. Si en el futuro se requiriera (múltiples instancias del backend), sería necesario migrar la gestión de sesiones a un mecanismo distribuido y revisar la estrategia de caché. Esto queda fuera del alcance de la versión 1.0.

### 19.4 Diseño agnóstico a escala

Las decisiones de diseño de la versión 1.0 no deben impedir la escalabilidad futura. En particular:

- No usar estado en memoria del proceso del servidor (las sesiones deben vivir en la base de datos).
- No asumir que hay un solo proceso corriendo (evitar archivos temporales de estado).
- Estructurar la API de forma stateless.

---

## 20. Futuras Mejoras

Las siguientes funcionalidades no forman parte del alcance de la versión 1.0 pero podrían ser incorporadas en versiones futuras si el negocio lo requiere. Se listan aquí para que el equipo de desarrollo no tome decisiones de arquitectura que las imposibiliten.

| ID | Mejora | Justificación de exclusión en v1.0 |
|---|---|---|
| FM-01 | Gestión de proveedores como entidad completa | No es necesaria; texto libre es suficiente por ahora |
| FM-02 | Historial de precios de productos | Requiere tabla adicional; no hay demanda actual |
| FM-03 | Notificaciones de stock bajo por email | Requiere configuración de SMTP; complejidad innecesaria |
| FM-04 | Exportación a Excel de listados | Útil pero no bloqueante; PDF es suficiente |
| FM-05 | Módulo de cobranzas / pagos parciales | No solicitado; el saldo manual cubre la necesidad actual |
| FM-06 | Multiusuario con auditoría avanzada | El log de movimientos cubre las necesidades actuales |
| FM-07 | Códigos de barra / QR en productos | No solicitado en v1.0 |
| FM-08 | Importación masiva de productos (CSV) | No solicitado; bajo volumen actual |
| FM-09 | Portal de cliente externo | Fuera del alcance definido |
| FM-10 | Integración AFIP (facturación electrónica) | Explícitamente excluida; podría requerirse en el futuro |

---

## 21. Glosario

| Término | Definición |
|---|---|
| **SRS** | Software Requirements Specification. Documento de especificación de requisitos de software. |
| **PWA** | Progressive Web App. Aplicación web que puede instalarse en dispositivos como si fuera una app nativa. |
| **JWT** | JSON Web Token. Estándar de token compacto y firmado usado para autenticación. |
| **Argon2** | Algoritmo de hashing de contraseñas ganador del Password Hashing Competition (PHC). Se usa Argon2id. |
| **Refresh Token** | Token de larga duración que permite renovar el Access Token sin requerir login. |
| **Access Token** | Token de corta duración que autoriza el acceso a los recursos de la API. |
| **Remito** | Documento comercial interno que registra la entrega de productos a un cliente. No tiene validez fiscal. |
| **Stock mínimo** | Cantidad mínima de unidades de un producto por debajo de la cual se genera una alerta. |
| **Ajuste manual** | Modificación directa del stock de un producto realizada por el Administrador para corregir errores o discrepancias. |
| **Lista mayorista** | Lista de precios aplicable a clientes mayoristas o compradores en cantidad. |
| **Lista minorista** | Lista de precios aplicable a clientes minoristas o compras individuales. |
| **Balance** | Módulo de indicadores operativos simples (ventas, compras, resultado). No es un balance contable. |
| **VPS** | Virtual Private Server. Servidor virtual privado Linux en el que se despliega el sistema. |
| **Docker Compose** | Herramienta para definir y ejecutar aplicaciones Docker multicontenedor. |
| **Nginx** | Servidor web y proxy reverso que sirve el frontend y enruta las peticiones al backend. |
| **Prisma** | ORM (Object-Relational Mapper) para Node.js que abstrae el acceso a PostgreSQL. |
| **Operación atómica** | Operación que se ejecuta completamente o no se ejecuta, sin estados intermedios. |
| **Self-hosted** | Sistema desplegado en infraestructura propia del cliente, sin dependencia de servicios en la nube. |
| **Soft delete** | Técnica de "eliminación" que marca un registro como inactivo en lugar de borrarlo físicamente. |
| **Rol** | Nivel de acceso asignado a un usuario que determina qué operaciones puede realizar. |
| **CORS** | Cross-Origin Resource Sharing. Mecanismo HTTP que controla qué dominios pueden acceder a la API. |

---

## 22. Checklist de Funcionalidades

Este checklist debe ser utilizado por el equipo de QA para verificar que todas las funcionalidades han sido implementadas y probadas antes de cada release.

### Autenticación

- [ ] Login con usuario y contraseña
- [ ] Hash de contraseña con Argon2
- [ ] Emisión de Access Token (JWT) y Refresh Token
- [ ] Renovación automática de Access Token
- [ ] Logout con revocación de Refresh Token
- [ ] Bloqueo de usuario desactivado
- [ ] Mensaje de error genérico en login fallido
- [ ] Rate limiting en endpoint de login

### Gestión de Usuarios

- [ ] Creación de usuario por Administrador
- [ ] Edición de usuario (nombre, email, rol)
- [ ] Activación y desactivación de usuario
- [ ] Protección del último Administrador activo
- [ ] Control de rol en cada endpoint

### Dashboard

- [ ] Ventas del mes en curso
- [ ] Compras del mes en curso
- [ ] Balance del mes (ventas − compras)
- [ ] Valor económico del stock
- [ ] Lista de productos con stock bajo
- [ ] Últimos 10 remitos emitidos
- [ ] Gráfico comparativo mensual (últimos 6 meses)

### Productos

- [ ] Crear producto con todos los campos
- [ ] Validación de código interno único
- [ ] Editar producto
- [ ] Desactivar producto (soft delete)
- [ ] Reactivar producto
- [ ] Listado con filtros (nombre, código, categoría, estado)
- [ ] Paginación del listado
- [ ] Ficha de producto con historial de movimientos
- [ ] Gestión de categorías (crear, editar, desactivar)

### Stock

- [ ] Incremento automático al registrar compra
- [ ] Decremento automático al crear remito
- [ ] Restauración automática al cancelar remito
- [ ] Restauración automática al anular compra
- [ ] Prohibición de stock negativo
- [ ] Historial de movimientos por producto
- [ ] Ajuste manual con motivo obligatorio
- [ ] Filtros en historial (tipo, rango de fechas)

### Clientes

- [ ] Crear cliente (nombre obligatorio)
- [ ] Editar cliente
- [ ] Desactivar cliente (soft delete)
- [ ] Listado con búsqueda
- [ ] Ficha de cliente con historial de remitos
- [ ] Campo de saldo pendiente editable por Administrador
- [ ] Cliente inactivo no disponible en nuevos remitos

### Compras

- [ ] Registrar compra con uno o más ítems
- [ ] Solo productos activos en selector
- [ ] Actualización de stock al confirmar (transacción atómica)
- [ ] Actualización opcional de costo en catálogo (checkbox por ítem)
- [ ] Registro de egreso en balance
- [ ] Listado con filtros y paginación
- [ ] Detalle de compra
- [ ] Anulación de compra (solo Administrador)
- [ ] Reversión de stock al anular

### Remitos

- [ ] Crear remito con cliente y lista de precios
- [ ] Solo clientes activos en selector
- [ ] Solo productos activos en selector
- [ ] Precio según lista seleccionada (mayorista / minorista)
- [ ] Cálculo automático de subtotales y total
- [ ] Verificación de stock antes de confirmar
- [ ] Numeración automática secuencial
- [ ] Descuento de stock al confirmar (transacción atómica)
- [ ] Precios fijos en remito (no se alteran por cambios futuros)
- [ ] Saldo del cliente capturado al momento de emisión
- [ ] Editar remito activo con recálculo de diferencias de stock
- [ ] Cancelar remito con restauración de stock
- [ ] Estado irreversible de cancelación
- [ ] Listado con filtros (cliente, estado, fecha, número)
- [ ] Paginación del listado
- [ ] Generación de PDF con todos los campos requeridos
- [ ] Opción de impresión

### Contenido del PDF del remito

- [ ] Número de remito
- [ ] Fecha
- [ ] Nombre del cliente
- [ ] Empresa del cliente
- [ ] Dirección del cliente
- [ ] Teléfono del cliente
- [ ] Email del cliente
- [ ] Saldo pendiente del cliente
- [ ] Tabla de productos (código, nombre, cantidad, precio unitario, subtotal)
- [ ] Total general
- [ ] Lista de precios utilizada (Mayorista / Minorista)

### Balance

- [ ] Resumen del mes en curso
- [ ] Selector de mes y año
- [ ] Total de ventas del período
- [ ] Total de compras del período
- [ ] Resultado del período
- [ ] Valor del stock actual
- [ ] Gráfico comparativo últimos 6 meses

### Seguridad

- [ ] HTTPS configurado en Nginx
- [ ] Headers de seguridad HTTP
- [ ] CORS restrictivo (solo origen del frontend)
- [ ] Rate limiting en login
- [ ] PostgreSQL no expuesto al exterior
- [ ] Secretos en variables de entorno
- [ ] Tokens en base de datos hasheados

### Infraestructura

- [ ] Todos los servicios en Docker Compose
- [ ] Política `restart: unless-stopped` en todos los contenedores
- [ ] Variables de entorno en archivo `.env` (no en repositorio)
- [ ] Script de backup con `pg_dump` y compresión
- [ ] Rotación de logs configurada
- [ ] Migraciones de base de datos con Prisma Migrate

### PWA

- [ ] Diseño responsive (escritorio, tablet, móvil)
- [ ] Instalable como PWA
- [ ] Consulta de stock optimizada para móvil
- [ ] Sin modo offline (no se requiere)

---

*Fin del documento — PEREZ MARTIN Distribuidora SRS v1.0.0*

---

**Control de versiones del documento**

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0.0 | Junio 2026 | Versión inicial completa |

# Punto de integración de pedidos externos (HU019)

Especificación del endpoint con el que agregadores y otros canales envían pedidos a la misma cola de cocina que los del comandero.

## Endpoint

| | |
|---|---|
| Método y ruta | `POST /api/v1/integracion/pedidos` |
| Formato | `Content-Type: application/json` |
| Autenticación | Encabezado `X-Api-Key` con la clave de integración (no usa sesión ni JWT) |
| Respuesta correcta | `201 Created` con el identificador interno del pedido; `200 OK` con el mismo identificador si es un reenvío igual (HU034) |

### Clave de integración

- Se define con la variable de entorno `KDS_INTEGRACION_API_KEY` del backend.
- En `compose.local.yml` tiene un valor por defecto **solo para el entorno local**: `kds-integracion-local-2026`. En el restaurante debe cambiarse por una clave propia y larga.
- Si la variable está vacía la integración queda **deshabilitada**: todas las solicitudes responden `401`.
- La clave nunca se escribe en los logs ni se devuelve en las respuestas. Se compara en tiempo constante.
- Una solicitud sin la clave, o con una incorrecta, responde `401` y **no registra nada**; esto incluye a un administrador con sesión: en esta ruta solo vale la clave.

## Payload

```json
{
  "canal": "RAPPI",
  "numeroOrden": "RP-48213",
  "cliente": { "nombre": "Ana Torres" },
  "observaciones": "Tocar el timbre",
  "items": [
    { "codigoPlato": "PLT-007", "cantidad": 2, "modificadores": ["Sin cebolla"] },
    { "codigoPlato": "PLT-012", "cantidad": 1 }
  ]
}
```

| Campo | Obligatorio | Regla |
|---|---|---|
| `canal` | Sí | Código de un canal registrado y activo (por ejemplo `RAPPI`, `DELIVERY`, `PARA_LLEVAR`). `SALON` no se admite: exige mesa y atención abierta. No distingue mayúsculas. |
| `numeroOrden` | Sí | Identificador del pedido en el canal de origen, hasta 60 caracteres. Se muestra en la tarjeta de cocina y del pase. |
| `cliente.nombre` | Según canal | Hasta 120 caracteres. Obligatorio en `DELIVERY` y `PARA_LLEVAR`; opcional en agregadores. |
| `cliente.telefono` | Según canal | Celular peruano: 9 dígitos y empieza con 9. Obligatorio en `DELIVERY` y `PARA_LLEVAR`. Los agregadores no guardan celular: si llega, se descarta. |
| `cliente.direccion` | Según canal | Hasta 255 caracteres. Obligatoria en `DELIVERY` (entrega a domicilio). `PARA_LLEVAR` es recojo en el local y los agregadores entregan por su cuenta: si llega, se descarta. |
| `observaciones` | No | Hasta 500 caracteres. |
| `items` | Sí | Entre 1 y 50 ítems. |
| `items[].codigoPlato` | Sí | Código del plato en el catálogo: `PLT-` y el número del plato (`PLT-007`). Es el mismo que muestra la pantalla de administración de platos. No distingue mayúsculas. |
| `items[].cantidad` | Sí | De 1 a 50. |
| `items[].modificadores` | No | Hasta 20, de hasta 60 caracteres cada uno y sin comas. Deben existir en el catálogo de modificadores del plato: los desconocidos se rechazan. Un plato sin modificadores solo admite cantidad. |

Un canal de agregador (`externo`, hoy Rappi) solo necesita el número de orden; el nombre del cliente es opcional. `DELIVERY` pide nombre, celular y dirección; `PARA_LLEVAR`, nombre y celular.

## Respuesta `201`

```json
{
  "pedidoId": 123,
  "codigoPedido": "CMD-261113-0042",
  "canal": "RAPPI",
  "numeroOrden": "RP-48213",
  "estado": "ENVIADO"
}
```

El pedido recibe código correlativo, historial y enrutamiento por estación como cualquiera del comandero, y queda registrado a nombre de la cuenta de servicio `Integración Externa`.

## Errores

Todos devuelven JSON con el campo `mensaje`.

| Caso | Estado | `mensaje` (ejemplo) |
|---|---|---|
| Sin clave o clave incorrecta | `401` | `Clave de integración ausente o inválida.` |
| Payload incompleto o con valores fuera de rango | `400` | `Payload inválido: El campo 'canal' es obligatorio; El campo 'items' debe incluir al menos un ítem.` (lista todos los errores juntos) |
| Canal inexistente o inactivo | `400` | `El canal 'XYZ' no existe o no está activo.` |
| Canal Salón | `400` | `El canal 'SALON' no admite pedidos externos: requiere mesa y atención abierta.` |
| Plato desconocido | `400` | `Ítem 2: el código de plato 'PLT-999' no existe en el catálogo.` |
| Código de plato con formato inválido | `400` | `Ítem 1: el código de plato 'LOMO' no tiene el formato PLT-001.` |
| Modificador que no es del plato | `400` | `El modificador 'Con helado' no está disponible para 'Lomo Saltado'.` |
| Reenvío del mismo canal y número de orden con otros ítems (HU034) | `409` | `El pedido RP-48213 de Rappi ya fue recibido como CMD-261113-0042 con otros ítems; el pedido original no se modificó.` (`codigo`: `PEDIDO_EXTERNO_CONFLICTO`) |
| Plato agotado o fuera de la carta | `400` | `El plato 'Lomo Saltado' está agotado. Retírelo de la comanda.` |
| Datos de cliente faltantes (`DELIVERY`, `PARA_LLEVAR`) | `400` | `Falta el nombre del cliente.` / `El celular del cliente no es válido (9 dígitos y empieza con 9).` / `Falta la dirección de entrega del cliente.` (solo `DELIVERY`) |

## Ejemplo (PowerShell)

```powershell
$cuerpo = @{
  canal = "RAPPI"
  numeroOrden = "RP-48213"
  items = @(@{ codigoPlato = "PLT-007"; cantidad = 2 })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/integracion/pedidos" `
  -Headers @{ "X-Api-Key" = "kds-integracion-local-2026" } `
  -ContentType "application/json; charset=utf-8" -Body $cuerpo
```

## Alcance y límites

- Este punto es **genérico**: lo puede llamar un adaptador propio, un middleware o un script. No incluye conexiones directas con los agregadores.
- PedidosYa (Delivery Hero) y Rappi ofrecen APIs oficiales de integración, pero solo para aliados aprobados: las credenciales las entrega su equipo comercial. Además envían o piden los pedidos por internet, algo que el KDS, pensado para operar en red local sin internet, no recibe por sí solo. Conectarlos exigiría un adaptador aparte que traduzca sus pedidos a este payload.
- Duplicados (HU034): un pedido es único por canal y número de orden. Un reenvío con los mismos ítems responde `200` con el identificador existente y no genera una tarjeta nueva; con otros ítems responde `409` sin modificar el original. El mismo número en otro canal es otro pedido.

#!/usr/bin/env bash
# Smoke HU009 - Enviar comanda a cocina contra la API real
source "$(dirname "$0")/lib.sh"

MOZO=$(token_mozo); ADM=$(token_admin)
PLATO=$(curl -s $B/platos -H "Authorization: Bearer $MOZO" | json "[p['id'] for p in d if p['disponible']][0]")
contar() { docker exec kds-postgres psql -U kds_user -d kds_db -tAc "SELECT COUNT(*) FROM pedidos WHERE clave_idempotencia='$1'"; }

CLAVE="cmd-smoke$(date +%s%N | tail -c 12)"
BODY="{\"claveIdempotencia\":\"$CLAVE\",\"canalId\":3,\"items\":[{\"platoId\":$PLATO,\"cantidad\":1}]}"
R1=$(api "$MOZO" POST /pedidos "$BODY")
check "Esc.1 envío confirmado por el servidor (201)" "$(echo "$R1" | cut -d' ' -f1)" "201"
check "Esc.1 acuse con código y hora de envío" "$(echo "$R1" | cut -d' ' -f2- | json "bool(d['codigoCorrelativo'] and d['fechaEnvioCocina']) and d['estado']=='ENVIADO'")" "True"
R2=$(api "$MOZO" POST /pedidos "$BODY")
check "Esc.2 reintento con la misma clave devuelve el mismo pedido (200)" "$(echo "$R2" | cut -d' ' -f1)" "200"
check "Esc.2 mismo código de pedido" "$(echo "$R2" | cut -d' ' -f2- | json "d['codigoCorrelativo']")" "$(echo "$R1" | cut -d' ' -f2- | json "d['codigoCorrelativo']")"
check "Esc.2 un solo pedido registrado" "$(contar $CLAVE)" "1"

# Esc.5: doble pulsación (5 envíos simultáneos con la misma clave)
CLAVE2="cmd-doble$(date +%s%N | tail -c 12)"
BODY2="{\"claveIdempotencia\":\"$CLAVE2\",\"canalId\":3,\"items\":[{\"platoId\":$PLATO,\"cantidad\":1}]}"
TMP=$(mktemp -d)
for n in 1 2 3 4 5; do ( api "$MOZO" POST /pedidos "$BODY2" > "$TMP/r$n" ) & done
wait
check "Esc.5 cinco envíos simultáneos registran un solo pedido" "$(contar $CLAVE2)" "1"
check "Esc.5 todas las respuestas son exitosas (201/200)" "$(cut -d' ' -f1 "$TMP"/r* | sort -u | tr '\n' ' ')" "200 201 "
check "Esc.5 todas devuelven el mismo código" "$(for f in "$TMP"/r*; do cut -d' ' -f2- "$f" | json "d['codigoCorrelativo']"; done | sort -u | wc -l | tr -d ' ')" "1"
rm -rf "$TMP"

# Revisión: la clave pertenece a su autor y a su contenido
BODY3="{\"claveIdempotencia\":\"$CLAVE\",\"canalId\":3,\"items\":[{\"platoId\":$PLATO,\"cantidad\":5}]}"
check "Clave reutilizada con otro contenido (409)" "$(api "$MOZO" POST /pedidos "$BODY3" | cut -d' ' -f1)" "409"
check "Clave de otro usuario no revela el pedido (409)" "$(api "$ADM" POST /pedidos "$BODY" | cut -d' ' -f1)" "409"
check "Esc.2 el autor consulta si su envío llegó (200)" "$(api "$MOZO" GET /pedidos/envio/$CLAVE | cut -d' ' -f1)" "200"
check "Esc.2 envío inexistente (404)" "$(api "$MOZO" GET /pedidos/envio/cmd-noexiste123 | cut -d' ' -f1)" "404"
check "Otro usuario no puede consultar el envío (404)" "$(api "$ADM" GET /pedidos/envio/$CLAVE | cut -d' ' -f1)" "404"

check "Esc.3 comanda vacía rechazada (400)" "$(api "$MOZO" POST /pedidos '{"canalId":3,"items":[]}' | cut -d' ' -f1)" "400"
check "Esc.3 mensaje indica agregar un plato" "$(api "$MOZO" POST /pedidos '{"canalId":3,"items":[]}' | cut -d' ' -f2- | json "'al menos un plato' in d['mensaje']")" "True"

# Esc.6: plato agotado después de agregarse
api "$ADM" PATCH /platos/$PLATO/disponibilidad '{"disponible":false}' >/dev/null
R6=$(api "$MOZO" POST /pedidos "{\"canalId\":3,\"items\":[{\"platoId\":$PLATO,\"cantidad\":1}]}")
check "Esc.6 plato agotado rechaza el envío (400)" "$(echo "$R6" | cut -d' ' -f1)" "400"
check "Esc.6 el mensaje indica el plato agotado" "$(echo "$R6" | cut -d' ' -f2- | json "'agotado' in d['mensaje']")" "True"
api "$ADM" PATCH /platos/$PLATO/disponibilidad '{"disponible":true}' >/dev/null

check "Esc.4 no existe edición directa de un pedido enviado (PUT → 405)" "$(api "$MOZO" PUT /pedidos/1 '{}' | cut -d' ' -f1)" "405"
check "Clave con formato inválido (400)" "$(api "$MOZO" POST /pedidos "{\"claveIdempotencia\":\"x y\",\"canalId\":3,\"items\":[{\"platoId\":$PLATO,\"cantidad\":1}]}" | cut -d' ' -f1)" "400"
resumen

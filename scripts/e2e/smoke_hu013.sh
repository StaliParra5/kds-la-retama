#!/usr/bin/env bash
# Smoke HU013 - Ciclo de vida del ítem contra la API real
source "$(dirname "$0")/lib.sh"

MOZO=$(token_mozo); EXP=$(token_expedidor)
# Plato 1 = Causa Limeña (estación Fríos). Se busca un plato de Plancha para el segundo ítem.
PLANCHA_ID=$(curl -s $B/estaciones -H "Authorization: Bearer $MOZO" | json "[e['id'] for e in d if e['codigo']=='PLANCHA'][0]")
FRIOS_ID=$(curl -s $B/estaciones -H "Authorization: Bearer $MOZO" | json "[e['id'] for e in d if e['codigo']=='FRIOS'][0]")
PLATO_PLANCHA=$(curl -s $B/platos -H "Authorization: Bearer $MOZO" | json "[p['id'] for p in d if p['estacionId']==$PLANCHA_ID and p['disponible']][0]")
COC_PLANCHA=$(token_cocinero $PLANCHA_ID); COC_FRIOS=$(token_cocinero $FRIOS_ID)

R=$(api "$MOZO" POST /pedidos "{\"canalId\":3,\"items\":[{\"platoId\":$PLATO_PLANCHA,\"cantidad\":1},{\"platoId\":1,\"cantidad\":1}]}")
read CODE BODY <<<"$R"
check "Esc.3 pedido registrado (201)" "$CODE" "201"
check "Esc.3 pedido queda ENVIADO" "$(echo "$BODY" | json "d['estado']")" "ENVIADO"
check "Esc.3 todos los ítems en RECIBIDO" "$(echo "$BODY" | json "set(i['estadoItem'] for i in d['items'])=={'RECIBIDO'}")" "True"
ITEM=$(echo "$BODY" | json "[i['id'] for i in d['items'] if i['estacionId']==$PLANCHA_ID][0]")
PEDIDO=$(echo "$BODY" | json "d['id']")

check "Esc.2 RECIBIDO→DESPACHADO rechazado (409)" "$(api "$EXP" PATCH /items/$ITEM/estado '{"estadoActual":"RECIBIDO","estadoDestino":"DESPACHADO"}' | cut -d' ' -f1)" "409"
check "D8 cocinero de Fríos no toca ítem de Plancha (403)" "$(api "$COC_FRIOS" PATCH /items/$ITEM/estado '{"estadoActual":"RECIBIDO","estadoDestino":"EN_PREPARACION"}' | cut -d' ' -f1)" "403"

# Esc.6: dos solicitudes simultáneas sobre el mismo ítem
TMP=$(mktemp -d)
for n in 1 2; do
  ( api "$COC_PLANCHA" PATCH /items/$ITEM/estado '{"estadoActual":"RECIBIDO","estadoDestino":"EN_PREPARACION"}' > "$TMP/r$n" ) &
done
wait
CODES=$(cut -d' ' -f1 "$TMP"/r1 "$TMP"/r2 | sort | tr '\n' ' ')
check "Esc.6 solo una de dos solicitudes simultáneas se aplica" "$CODES" "200 409 "
LOSER=$(grep -l '^409' "$TMP"/r1 "$TMP"/r2 | head -1)
check "Esc.6 la segunda recibe el estado vigente" "$(cut -d' ' -f2- "$LOSER" | json "d.get('item',{}).get('estado') or d['mensaje']")" "EN_PREPARACION"

check "Esc.1 EN_PREPARACION→LISTO (200)" "$(api "$COC_PLANCHA" PATCH /items/$ITEM/estado '{"estadoActual":"EN_PREPARACION","estadoDestino":"LISTO"}' | cut -d' ' -f1)" "200"
check "Esc.4 LISTO→EN_PREPARACION rechazado (409)" "$(api "$COC_PLANCHA" PATCH /items/$ITEM/estado '{"estadoActual":"LISTO","estadoDestino":"EN_PREPARACION"}' | cut -d' ' -f1)" "409"
check "D8 cocinero no despacha (403)" "$(api "$COC_PLANCHA" PATCH /items/$ITEM/estado '{"estadoActual":"LISTO","estadoDestino":"DESPACHADO"}' | cut -d' ' -f1)" "403"
check "Esc.1 LISTO→DESPACHADO por expedidor (200)" "$(api "$EXP" PATCH /items/$ITEM/estado '{"estadoActual":"LISTO","estadoDestino":"DESPACHADO"}' | cut -d' ' -f1)" "200"
check "Esc.5 DESPACHADO no admite cambios (409)" "$(api "$(token_admin)" PATCH /items/$ITEM/estado '{"estadoActual":"DESPACHADO","estadoDestino":"LISTO"}' | cut -d' ' -f1)" "409"
check "Pedido con un ítem despachado y otro recibido queda EN_PREPARACION" "$(api "$MOZO" GET /pedidos/$PEDIDO | cut -d' ' -f2- | json "d['estado']")" "EN_PREPARACION"
check "Mozo no puede cambiar estados (403)" "$(api "$MOZO" PATCH /items/$ITEM/estado '{"estadoActual":"DESPACHADO","estadoDestino":"LISTO"}' | cut -d' ' -f1)" "403"
check "Estado inválido en el cuerpo (400)" "$(api "$EXP" PATCH /items/$ITEM/estado '{"estadoActual":"FOO","estadoDestino":"LISTO"}' | cut -d' ' -f1)" "400"

# Revisión #1: despachar a la vez los dos ítems de un pedido debe dejarlo DESPACHADO
R=$(api "$MOZO" POST /pedidos "{\"canalId\":3,\"items\":[{\"platoId\":$PLATO_PLANCHA,\"cantidad\":1},{\"platoId\":$PLATO_PLANCHA,\"cantidad\":2}]}")
P2=$(echo "$R" | cut -d' ' -f2- | json "d['id']")
for I in $(echo "$R" | cut -d' ' -f2- | json "' '.join(str(i['id']) for i in d['items'])"); do
  api "$COC_PLANCHA" PATCH /items/$I/estado '{"estadoActual":"RECIBIDO","estadoDestino":"EN_PREPARACION"}' >/dev/null
  api "$COC_PLANCHA" PATCH /items/$I/estado '{"estadoActual":"EN_PREPARACION","estadoDestino":"LISTO"}' >/dev/null
done
for I in $(echo "$R" | cut -d' ' -f2- | json "' '.join(str(i['id']) for i in d['items'])"); do
  ( api "$EXP" PATCH /items/$I/estado '{"estadoActual":"LISTO","estadoDestino":"DESPACHADO"}' >/dev/null ) &
done
wait
check "Despacho simultáneo de dos ítems deja el pedido DESPACHADO" "$(api "$MOZO" GET /pedidos/$P2 | cut -d' ' -f2- | json "d['estado']")" "DESPACHADO"
check "Cocinero sin estación vinculada no cambia estados (403)" "$(api "$(token_cocinero null)" PATCH /items/$ITEM/estado '{"estadoActual":"DESPACHADO","estadoDestino":"LISTO"}' | cut -d' ' -f1)" "403"
rm -rf "$TMP"
resumen

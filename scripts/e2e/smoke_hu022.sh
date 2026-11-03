#!/usr/bin/env bash
# Smoke HU022 - Trazabilidad de transiciones contra la API y la base real
source "$(dirname "$0")/lib.sh"

MOZO=$(token_mozo); EXP=$(token_expedidor); ADM=$(token_admin)
PLANCHA_ID=$(curl -s $B/estaciones -H "Authorization: Bearer $MOZO" | json "[e['id'] for e in d if e['codigo']=='PLANCHA'][0]")
PLATO=$(curl -s $B/platos -H "Authorization: Bearer $MOZO" | json "[p['id'] for p in d if p['estacionId']==$PLANCHA_ID and p['disponible']][0]")
COC=$(token_cocinero $PLANCHA_ID)

R=$(api "$MOZO" POST /pedidos "{\"canalId\":3,\"items\":[{\"platoId\":$PLATO,\"cantidad\":1}]}")
PEDIDO=$(echo "$R" | cut -d' ' -f2- | json "d['id']"); ITEM=$(echo "$R" | cut -d' ' -f2- | json "d['items'][0]['id']")
api "$COC" PATCH /items/$ITEM/estado '{"estadoActual":"RECIBIDO","estadoDestino":"EN_PREPARACION"}' >/dev/null
api "$COC" PATCH /items/$ITEM/estado '{"estadoActual":"EN_PREPARACION","estadoDestino":"LISTO"}' >/dev/null
api "$EXP" PATCH /items/$ITEM/estado '{"estadoActual":"LISTO","estadoDestino":"DESPACHADO"}' >/dev/null

H=$(api "$ADM" GET /items/$ITEM/historial)
check "Esc.2 admin consulta historial del ítem (200)" "$(echo "$H" | cut -d' ' -f1)" "200"
check "Esc.2 transiciones en orden" "$(echo "$H" | cut -d' ' -f2- | json "'>'.join(t['estadoDestino'] for t in d)")" "RECIBIDO>EN_PREPARACION>LISTO>DESPACHADO"
check "Esc.1 cada transición tiene responsable y hora" "$(echo "$H" | cut -d' ' -f2- | json "all(t['responsable'] and t['fechaHora'] for t in d)")" "True"
check "Esc.1 responsables correctos" "$(echo "$H" | cut -d' ' -f2- | json "','.join(t['rolResponsable'] for t in d)")" "MOZO,COCINERO,COCINERO,EXPEDIDOR"
HORA_LIMA=$(python -c "import datetime as d;print((d.datetime.now(d.timezone.utc)-d.timedelta(hours=5)).strftime(\"%Y-%m-%dT%H\"))")  # Perú: UTC-5 sin horario de verano
check "Esc.6 hora registrada en la zona del restaurante (servidor)" "$(echo "$H" | cut -d' ' -f2- | json "d[-1]['fechaHora'][:13]")" "$HORA_LIMA"
check "Esc.2 historial del pedido incluye pedido e ítems" "$(api "$ADM" GET /pedidos/$PEDIDO/historial | cut -d' ' -f2- | json "len(d)>=6")" "True"
check "Historial solo para admin (cocinero 403)" "$(api "$COC" GET /items/$ITEM/historial | cut -d' ' -f1)" "403"
check "Historial de ítem inexistente (404)" "$(api "$ADM" GET /items/999999/historial | cut -d' ' -f1)" "404"

# Esc.5: ni siquiera con acceso directo a la base se puede alterar el historial
UPD=$(docker exec kds-postgres psql -U kds_user -d kds_db -tAc "UPDATE transiciones_estado SET estado_destino='X' WHERE detalle_pedido_id=$ITEM" 2>&1)
check "Esc.5 UPDATE del historial bloqueado en BD" "$(echo "$UPD" | grep -c 'inalterable')" "1"
DEL=$(docker exec kds-postgres psql -U kds_user -d kds_db -tAc "DELETE FROM transiciones_estado WHERE detalle_pedido_id=$ITEM" 2>&1)
check "Esc.5 DELETE del historial bloqueado en BD" "$(echo "$DEL" | grep -c 'inalterable')" "1"
TRU=$(docker exec kds-postgres psql -U kds_user -d kds_db -tAc "BEGIN; TRUNCATE transiciones_estado CASCADE; ROLLBACK;" 2>&1)
check "Esc.5 TRUNCATE del historial bloqueado en BD" "$(echo "$TRU" | grep -c 'inalterable')" "1"
check "Esc.5 historial intacto tras los intentos" "$(api "$ADM" GET /items/$ITEM/historial | cut -d' ' -f2- | json "len(d)")" "4"
resumen

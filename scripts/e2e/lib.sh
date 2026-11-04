# Utilidades comunes para pruebas de humo contra la API del KDS
B=http://localhost:8080/api/v1
export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"

json() { python -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

token_admin()     { curl -s -X POST $B/auth/login-admin -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | json "d['token']"; }
token_expedidor() { curl -s -X POST $B/auth/login-admin -H 'Content-Type: application/json' -d '{"username":"expedidor1","password":"1234"}' | json "d['token']"; }
token_mozo()      { curl -s -X POST $B/auth/login-pin -H 'Content-Type: application/json' -d '{"username":"angie","pin":"1234"}' | json "d['token']"; }
# $1 = estacionId vinculada a la terminal
token_cocinero()  { curl -s -X POST $B/auth/login-pin -H 'Content-Type: application/json' -d "{\"username\":\"cocinero1\",\"pin\":\"5678\",\"estacionId\":$1}" | json "d['token']"; }

# $1 token, $2 método, $3 ruta, $4 cuerpo -> imprime "HTTP_CODE BODY"
api() { curl -s -w '\n%{http_code}' -X "$2" "$B$3" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' ${4:+-d "$4"} | python -c "import sys;t=sys.stdin.read().rsplit('\n',1);print(t[1], t[0])"; }

esperar_backend() {
  for i in $(seq 1 60); do
    docker logs kds-backend 2>&1 | grep -q "Started KdsApplication" && curl -s -o /dev/null $B/canales && return 0
    sleep 2
  done
  echo "backend no arrancó"; return 1
}

PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then echo "OK   $1"; PASS=$((PASS+1)); else echo "FAIL $1 (esperado '$3', obtenido '$2')"; FAIL=$((FAIL+1)); fi; }
resumen() { echo "---- $PASS OK, $FAIL FAIL"; [ $FAIL -eq 0 ]; }

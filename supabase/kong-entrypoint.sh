#!/bin/sh

# Supabase's self-hosted Kong setup relies on env substitution plus a Lua
# expression that converts the incoming apikey into an Authorization header.
export LUA_AUTH_EXPR="$((headers.authorization ~= nil and headers.authorization:sub(1, 10) ~= 'Bearer sb_' and headers.authorization) or headers.apikey)"

awk '
  {
    result = ""
    rest = $0

    while (match(rest, /\$[A-Za-z_][A-Za-z_0-9]*/)) {
      varname = substr(rest, RSTART + 1, RLENGTH - 1)

      if (varname in ENVIRON) {
        result = result substr(rest, 1, RSTART - 1) ENVIRON[varname]
      } else {
        result = result substr(rest, 1, RSTART + RLENGTH - 1)
      }

      rest = substr(rest, RSTART + RLENGTH)
    }

    print result rest
  }
' /home/kong/temp.yml > "$KONG_DECLARATIVE_CONFIG"

sed -i '/^[[:space:]]*- key:[[:space:]]*$/d' "$KONG_DECLARATIVE_CONFIG"

exec /entrypoint.sh kong docker-start

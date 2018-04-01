#!/bin/bash

# Start up the development HTTP server, start the vault server in development mode 
# and load with a test configuration.

# Use this short password for testing
PW='pw'


function abort {
    echo "$1"
    exit 1
}

# Check for expected files
which vault >/dev/null 2>&1 || abort "Vault executable not found. Please install vault in your path"

[[ -x httpd.py ]] || abort "The test HTTP server appears to be missing. Are you in the top level directory?"

mkdir -p logs

./httpd.py >logs/httpd.log 2>&1 &

vault server -dev >logs/vault.log 2>&1 &
# await full startup
sleep 3

export VAULT_ADDR='http://127.0.0.1:8200'

vault write secret/vpwmgr/user/psparks/network/router userid="admin" password="admin" notes="Don't mess it up." pwChanged="2018-02-11 14:05:51Z" changed="2018-02-11 14:05:51Z"
vault write secret/vpwmgr/user/psparks/web/google userid="user" password="userpw" notes="Check email" pwChanged="2018-03-15 12:08:51Z" changed="2018-03-15 12:08:51Z"
vault write secret/vpwmgr/user/psparks/web/netflix userid="watcher" password="userpw" notes="Watch only your favorites." pwChanged="2018-03-15 12:12:51Z" changed="2018-03-15 12:12:51Z"
vault write 'secret/vpwmgr/user/psparks/Pauls Stuff/$+dream' userid="admin" password="admin" notes="Don't mess it up." pwChanged="2018-02-15 14:07:51Z" changed="2018-03-15 14:07:51Z"

vault write secret/vpwmgr/team/linuxadmin/webservers/extA userid="admin" password="admin" notes="Apache" pwChanged="2018-03-15 12:07:51Z" changed="2018-03-15 12:07:51Z"
vault write secret/vpwmgr/team/linuxadmin/webservers/extB userid="admin" password="admin" notes="Apache" pwChanged="2018-03-15 12:08:51Z" changed="2018-03-15 12:08:51Z"
vault write secret/vpwmgr/team/linuxadmin/webservers/LoadBal userid="admin" password="admin" notes="NGINX Reverse Proxy" pwChanged="2018-03-15 12:09:51Z" changed="2018-03-15 12:09:51Z"

vault write secret/vpwmgr/team/winadmin/DC/DC1 userid="admin" password="admin" notes="2012R2" pwChanged="2018-01-03 11:07:51Z" changed="2018-01-03 11:07:51Z"
vault write secret/vpwmgr/team/winadmin/DC/DC2 userid="admin" password="admin" notes="2012" pwChanged="2018-01-03 11:09:51Z" changed="2018-03-15 12:07:51Z"

# Enable cross origin. TODO lock this down
vault write sys/config/cors enabled=true allowed_origins='*'

vault policy-write user-psparks psparks.hcl
vault auth-enable userpass
vault write auth/userpass/users/psparks password="$PW" policies="user-psparks"

echo
echo
echo "Server output is in logs. Check logs/vault.log for the Vault Root token (if needed)."

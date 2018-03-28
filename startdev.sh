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

mkdir logs

./httpd.py >logs/httpd.log 2>&1 &

vault server -dev >logs/vault.log 2>&1 &

vault auth-enable userpass

# User1
vault policy-write user-user1 tests/data/user1.hcl
vault write auth/userpass/users/user1 password="user1pw" policies="user-user1"

vault write secret/vpwmgr/user/user1/network/router userid="admin" password="admin" notes="Don't mess it up." pwChanged="2018-02-11 14:05:51Z" changed="2018-02-11 14:05:51Z"
vault write secret/vpwmgr/user/user1/web/google userid="user" password="userpw" notes="Check email" pwChanged="2018-03-15 12:08:51Z" changed="2018-03-15 12:08:51Z"
vault write secret/vpwmgr/user/user1/web/netflix userid="watcher" password="userpw" notes="Watch only your favorites." pwChanged="2018-03-15 12:12:51Z" changed="2018-03-15 12:12:51Z"
vault write 'secret/vpwmgr/user/user1/Pauls Stuff/$+dream' userid="admin" password="admin" notes="Don't mess it up." pwChanged="2018-02-15 14:07:51Z" changed="2018-03-15 14:07:51Z"

# User2
vault policy-write user-user2 tests/data/user2.hcl
vault write auth/userpass/users/user2 password="user2pw" policies="user-user2"
vault write secret/vpwmgr/user/user2/welcome/welcome userid="" password="" notes="Welcome to Vault Password Manager. You can delete this entry." pwChanged="1970-01-01 00:00:00Z" changed="1970-01-01 00:00:00Z"

# User3
vault policy-write user-user3 tests/data/user3.hcl
vault write auth/userpass/users/user3 password="user3pw" policies="user-user3"
vault write secret/vpwmgr/user/user3/welcome/welcome userid="" password="" notes="Welcome to Vault Password Manager. You can delete this entry." pwChanged="1970-01-01 00:00:00Z" changed="1970-01-01 00:00:00Z"

# Team shared items
vault write secret/vpwmgr/team/linuxadmin/webservers/extA userid="admin" password="admin" notes="Apache" pwChanged="2018-03-15 12:07:51Z" changed="2018-03-15 12:07:51Z"
vault write secret/vpwmgr/team/linuxadmin/webservers/extB userid="admin" password="admin" notes="Apache" pwChanged="2018-03-15 12:08:51Z" changed="2018-03-15 12:08:51Z"
vault write secret/vpwmgr/team/linuxadmin/webservers/LoadBal userid="admin" password="admin" notes="NGINX Reverse Proxy" pwChanged="2018-03-15 12:09:51Z" changed="2018-03-15 12:09:51Z"

vault write secret/vpwmgr/team/winadmin/DC/DC1 userid="admin" password="admin" notes="2012R2" pwChanged="2018-01-03 11:07:51Z" changed="2018-01-03 11:07:51Z"
vault write secret/vpwmgr/team/winadmin/DC/DC2 userid="admin" password="admin" notes="2012" pwChanged="2018-01-03 11:09:51Z" changed="2018-03-15 12:07:51Z"

# Enable cross origin. TODO lock this down
vault write sys/config/cors enabled=true allowed_origins='*'


echo
echo
echo "Server output is in logs. Check logs/vault.log for the Vault Root token (if needed)."

export VAULT_ADDR='http://127.0.0.1:8200'

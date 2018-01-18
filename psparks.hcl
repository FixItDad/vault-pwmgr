path "secret/vpwmgr/user/psparks/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/vpwmgr/team/linuxadmin/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/vpwmgr/team/" {
  capabilities = ["list"]
}

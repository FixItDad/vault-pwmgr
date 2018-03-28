path "secret/vpwmgr/user/user3/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/vpwmgr/team/winadmin/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/vpwmgr/team/" {
  capabilities = ["list"]
}

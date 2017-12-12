

var TOKEN='e8ee2e1f-515b-535c-93d9-fe43867c97cf'
var BASEURL='http://127.0.0.1:8200'

/* Example demo data 
var pwdata = {
    groups: [
        { id: 0,
          name: 'network',
          entries: [
              { id: 0, name: 'router' },
          ]
        },
        { id: 1,
          name: 'web',
          entries: [
              { id: 0, name: 'google.com' },
              { id: 1, name: 'netflix' }
          ]
        }
    ]
}
*/
var pwdata = {
    groups: []
}



function vaultRequest(relURL) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", BASEURL+"/"+ relURL, false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("X-Vault-Token",TOKEN);
    xhttp.send();
    return JSON.parse(xhttp.responseText);
}

/* list groups response looks siomilar to the following (groups=network, web)
/ {"request_id":"5eec889b-4bd2-e309-a7be-e4a1265e37f4","lease_id":"","renewable":false,"lease_duration":0,"data":{"keys":["network/","web/"]},"wrap_info":null,"warnings":null,"auth":null}
*/
function getGroups(userid) {
    var response = vaultRequest("v1/secret/vpwmgr/user/"+userid+"/?list=true");
    var groupnames = response.data.keys;
    for (i=0; i< groupnames.length; i++) {
        pwdata.groups[i]= new Object();
        pwdata.groups[i].name = groupnames[i];
        pwdata.groups[i].entries = [];
        response = vaultRequest("v1/secret/vpwmgr/user/"+userid+"/"+ groupnames[i] +"?list=true");
        var entrynames = response.data.keys;
        for (j=0; j< entrynames.length; j++) {
            pwdata.groups[i].entries[j] = new Object();
            pwdata.groups[i].entries[j].name = entrynames[j];
        }
    }
}


// define the item component
Vue.component('entry', {
    props: ['model'],
    template: "<li>{{model.name}}</li>"
})

Vue.component('group', {
    template: '#group-template',
    props: {
        model: Object
    },
    data: function () {
        return {
            open: false
        }
    },
    methods: {
        toggle: function () {
            this.open = !this.open
        }
    }
})


// boot up the demo
var demo = new Vue({
    el: '#demo',
    data: pwdata
},
{ created: getGroups('psparks') }
)

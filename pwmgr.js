

window.userToken = ""
window.userid = ""

var BASEURL='http://127.0.0.1:8200/';

var eventHub = new Vue();

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


/* Response looks similar to:
{"request_id":"df406871-9c46-2a4b-265a-e4991e1b3737","lease_id":"","renewable":false,"lease_duration":0,"data":null,"wrap_info":null,"warnings":null,"auth":{"client_token":"7d44048a-60b0-6788-7252-1f81a423387e","accessor":"2cc26537-4873-75e5-c18d-5bc5e0d34434","policies":["default","user-psparks"],"metadata":{"username":"psparks"},"lease_duration":2764800,"renewable":true,"entity_id":"0cf6ec07-3c81-ff05-64f2-d5a835091e92"}}
*/
function passwordAuthenticate(userid, password) {
    console.log("passwordAuth |%s|%s|",userid,password);
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", BASEURL +"v1/auth/userpass/login/"+ userid, false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send('{"password":"'+ password +'"}');
    var response = JSON.parse(xhttp.responseText);
    console.log("Response: token=%s", response.auth.client_token);
    return response.auth.client_token
}

function vaultRequest(relURL) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", BASEURL + relURL, false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("X-Vault-Token",window.userToken);
    xhttp.send();
    console.log("response=%s",xhttp.responseText);
    return JSON.parse(xhttp.responseText);
}

/* list groups response looks similar to the following (groups=network, web)
/ {"request_id":"5eec889b-4bd2-e309-a7be-e4a1265e37f4","lease_id":"","renewable":false,"lease_duration":0,"data":{"keys":["network/","web/"]},"wrap_info":null,"warnings":null,"auth":null}
*/
function getGroups(userid) {
    var eid = 0;
    console.log('getGroups for %s',userid);
    var response = vaultRequest("v1/secret/vpwmgr/user/"+userid+"/?list=true");
    var groupnames = response.data.keys;
    var groups = []
    for (i=0; i< groupnames.length; i++) {
        groups[i]= new Object();
        groups[i].name = groupnames[i];
        groups[i].entries = [];
        response = vaultRequest("v1/secret/vpwmgr/user/"+userid+"/"+ groupnames[i] +"?list=true");
        var entrynames = response.data.keys;
        for (j=0; j< entrynames.length; j++) {
            groups[i].entries[j] = new Object();
            groups[i].entries[j].name = entrynames[j];
	    groups[i].entries[j].id = eid++;
        }
    }
    return groups;
}

// define the authentication component
Vue.component('authentication', {
    data: function () {
	return {
	    userid: "psparks",
	    pass: "!Password01!",
	    error: false
	}
    },
    template: "#login-template",
    methods: {
	login: function () {
	    window.userid = this.userid;
	    window.userToken = passwordAuthenticate(this.userid, this.pass)
	    console.log("window.userToken=%s", window.userToken);
	    if (window.userToken == '') {
		error = true;
	    }
	    else {
		this.$emit('auth-done')
	    }
	}
    }
})

// Post auth PW manger component
Vue.component('pwmgr', {
    template: "#pwmgr-template",
    props: ['groups'],
    data: function () {
	return {
	    groupname: "",
	    title: "",
	    url: "",
	    userid: "",
	    pass: "",
	    notes: "",
	    pwChanged: "1970-01-01",
	    changed: "1970-01-01",
	    error: "",
	}
    },
    created: function () {
	eventHub.$on('displayEntry', this.displayEntry)
    },
    methods: {
	update: function () {
	    console.log("Update the entry");
	}
	showpass: function () {
	    console.log("show the password");
	}
	displayEntry: function (entryId) {
	    
	}
    }
})

// Main app component
Vue.component('application', {
    template: "#app-template",
    data: function () {
	return {
	    flow: "auth",
	    pwgroups: [],
	}
    },
    methods: {
	authComplete: function() {
	    this.pwgroups = getGroups(window.userid);
	    this.flow= 'main';
	    console.log('flow=%s', this.flow);
	    console.log("pwgroups0=%s",this.pwgroups[0])
	}
    }
})



// define the item component
Vue.component('entry', {
    props: ['model'],
    template: '<li>{{model.name}} @click="displayItem(itemid)"</li>',
    methods: {
	displayItem: function (id) {
	    eventHub.$emit('selectEntry', model.id);
	}
    }
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
},
)

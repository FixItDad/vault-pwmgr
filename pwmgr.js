

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
    xhttp.open("GET", BASEURL + encodeURI(relURL), false);
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
    console.log('getGroups for %s',userid);
    var response = vaultRequest("v1/secret/vpwmgr/user/"+userid+"/?list=true");
    var groupnames = response.data.keys;
    var groups = []
    for (i=0; i< groupnames.length; i++) {
        groups[i]= new Object();
        groups[i].name = decodeURI(groupnames[i]);
        groups[i].entries = [];
        response = vaultRequest("v1/secret/vpwmgr/user/"+userid+"/"+ groupnames[i] +"?list=true");
        for (j=0; j< response.data.keys.length; j++)
	    groups[i].entries[j] = decodeURI(response.data.keys[j]);
    }
    return groups;
}

/* Return true is an entry with the same group/title exists */
function entryExists (groups, groupid, title) {
    var gid= groupid +"/";
    for (i=0; i < groups.length; i++) {
	console.log("|%s|%s|", groups[i].name, gid);
	if (groups[i].name !== gid) continue;
	for (j=0; j < groups[i].entries.length; j++) {
	    console.log("|%s|%s|", groups[i].entries[j], title);
	    if (groups[i].entries[j] === title) return true;
	}
    }
    return false;
}

/* Takes group and entry name (e.g. group/entry)
Results similar to: {"request_id":"5a98b00a-24b6-4fc0-eec3-dd26f0118369","lease_id":"","renewable":false,"lease_duration":2764800,"data":{"notes":"Check email","password":"userpw","username":"user"},"wrap_info":null,"warnings":null,"auth":null}
*/
function getDetails(groupentry) {
    console.log('getDetails for %s',groupentry);
    var response = vaultRequest("v1/secret/vpwmgr/user/"+ userid +"/"+ groupentry);
    var retdata = response.data
    var eidparts = groupentry.split("/")
    retdata.groupid = eidparts[0]
    retdata.title = eidparts[1]
    return retdata
}

/* Validate a group name. */ 
function okGroupid(name) {
    var re= new RegExp("^\\w+( \\w+)*$");
    return re.test(name);
}

/* Validate a title. */ 
function okTitle(name) {
    var re=new RegExp("^[0-9A-Za-z$-_.+!*'(),;\/?:@=&]+$");
    return re.test(name);
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
	    if (window.userToken === '') {
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
	    orig_group: "",
	    orig_title: "",
	    groupid: "",
	    title: "",
	    url: "",
	    userid: "",
	    pass: "",
	    notes: "",
	    pwChanged: "",
	    changed: "",
	    error: "",
	    showPW: false,
	}
    },
    created: function () {
	eventHub.$on('displayEntry', this.displayEntry)
    },
    beforeDestroy: function () {
	eventHub.$off('displayEntry', this.displayEntry)
    },
    methods: {
	submit: function () {}, /* Dummy, just ignore submit request */

	// Determine which "update" button to show.
	keystate: function () {
	    if (this.groupid==="" && this.title==="") return "new";
	    if (!entryExists(this.groups, this.groupid, this.title)) return "new";
	    if (!(this.orig_group==this.groupid && this.orig_title==this.title)) return "overwrite";
	    return "update";
	},

	addnew: function () {
	    console.log("Add entry");
	    if (!okGroupid(this.groupid)) {
		this.error='Bad group name';
		return;
	    }
	    if (!okTitle(this.title)) {
		this.error='Bad title';
		return;
	    }
	    if (!(this.orig_group===this.groupid && this.orig_title===this.title)) {
		if (entryExists(this.groups, this.groupid, this.title)) {
		    console.log('Duplicate Entry');
		    this.error= "Duplicate Entry (group/title)"
		}
		else {
		    this.error= "Adding new entry "+ this.groupid +"/"+ this.title;
		}
	    }
	    //writeEntry(this.groupid + this.title, this.userid, this.pass, this.notes)
	},
	update: function () {
	    console.log("Update the entry");
	    if (!okGroupid(this.groupid)) {
		this.error='Bad group name';
		return;
	    }
	    if (!okTitle(this.title)) {
		this.error='Bad title';
		return;
	    }
	    if (!(this.orig_group===this.groupid && this.orig_title===this.title)) {
		console.log('Duplicate Entry');
		this.error= "Adding new entry "+ this.groupid +"/"+ this.title;
	    }
	    //writeEntry(this.groupid + this.title, this.userid, this.pass, this.notes)
	},
	showpass: function () {
	    this.showPW = !this.showPW;
	},
	displayEntry: function (entryId) {
	    console.log("displayEntry %s", entryId)
	    var data = getDetails(entryId)
	    console.log("group=%s title=%s user=%s",data.groupid, data.title, data.username)
	    this.orig_group = data.groupid
	    this.orig_title = data.title
	    this.groupid = data.groupid
	    this.title = data.title
	    this.userid = data.username
	    this.pass = data.password
	    this.notes = data.notes
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
        },
	displayItem: function (entryid) {
	    console.log('Selected entryid=%s', entryid)
	    eventHub.$emit('displayEntry', entryid);
	},
    }
})


// boot up the demo
var demo = new Vue({
    el: '#demo',
},
)

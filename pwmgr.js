/*
Javascript portion of a password manager front end for Hashicorp's Vault product.
This is written as a single page web app with the Vue.js framework.

Each user can have many password entries organized into groups. Password entries are uniquely
identified by a title within each group. Entries can contain an associated URL, userid, 
password, and free form text notes.

Uses the following Vault structure to store individual user passwords.
.../pwmgr/user/<userid>/<groupname>/<title>

Terminology:
vaultid = The Vault user ID
group = group name for password entries (required)
title = name of a password entry (required, unique within a group)
url = URL related to a password entry (optional)
userid = username associated with a password entry (optional)
notes = textual notes associated with a password entry (optional)

*/

window.userToken = ""
window.vaultid = ""

// Base URL for the Vault server
var BASEURL='http://127.0.0.1:8200/';

// A empty Vue instance to act as a event transfer hub.
var eventHub = new Vue();


function currentTime() {
    var d = new Date();
    var ds = d.toISOString()
    return ds.slice(0,10) +" "+ ds.slice(11,19) +"Z"
}


/* Authenticate a user to Vault using a password.
A successful Vault response for a password login looks similar to:
{"request_id":"df406871-9c46-2a4b-265a-e4991e1b3737","lease_id":"","renewable":false,"lease_duration":0,"data":null,"wrap_info":null,"warnings":null,"auth":{"client_token":"7d44048a-60b0-6788-7252-1f81a423387e","accessor":"2cc26537-4873-75e5-c18d-5bc5e0d34434","policies":["default","user-psparks"],"metadata":{"userid":"psparks"},"lease_duration":2764800,"renewable":true,"entity_id":"0cf6ec07-3c81-ff05-64f2-d5a835091e92"}}
*/
function passwordAuthenticate(vaultid, password) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", BASEURL +"v1/auth/userpass/login/"+ vaultid, false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send('{"password":"'+ password +'"}');
    var response = JSON.parse(xhttp.responseText);
    console.log("Response: token=%s", response.auth.client_token);
    return response.auth.client_token
}

/* Make a request to the Vault server. Return the parsed JSON result.
*/
function vaultGetRequest(relURL) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", BASEURL + encodeURI(relURL), false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("X-Vault-Token",window.userToken);
    xhttp.send();
    console.log("response=%s",xhttp.responseText);
    return JSON.parse(xhttp.responseText);
}

/* Make a request to the Vault server. Return the parsed JSON result.
*/
function vaultDeleteRequest(relURL) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("DELETE", BASEURL + encodeURI(relURL), false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("X-Vault-Token",window.userToken);
    xhttp.send();
    console.log("response=%s",xhttp.status);
    return xhttp.status;
}

/* Return an array of password group names (with ending '/') for the given vaultid.
Vault list groups response looks similar to the following (groups=network, web)
/ {"request_id":"5eec889b-4bd2-e309-a7be-e4a1265e37f4","lease_id":"","renewable":false,"lease_duration":0,"data":{"keys":["network/","web/"]},"wrap_info":null,"warnings":null,"auth":null}
*/
function getGroups(vaultid) {
    console.log('getGroups for %s',vaultid);
    var response = vaultGetRequest("v1/secret/vpwmgr/user/"+vaultid+"/?list=true");
    var groupnames = response.data.keys;
    var groups = []
    for (i=0; i< groupnames.length; i++) {
        groups[i]= new Object();
        groups[i].name = decodeURI(groupnames[i]);
        groups[i].entries = [];
        response = vaultGetRequest("v1/secret/vpwmgr/user/"+vaultid+"/"+ groupnames[i] +"?list=true");
        for (j=0; j< response.data.keys.length; j++)
	    groups[i].entries[j] = decodeURI(response.data.keys[j]);
    }
    return groups;
}

/* Takes group and entry name (e.g. group/entry) Returns object with details of a password entry.
Vault returns results similar to: {"request_id":"5a98b00a-24b6-4fc0-eec3-dd26f0118369","lease_id":"","renewable":false,"lease_duration":2764800,"data":{"notes":"Check email","password":"userpw","userid":"user"},"wrap_info":null,"warnings":null,"auth":null}
*/
function getDetails(groupentry) {
    console.log('getDetails for %s',groupentry);
    var response = vaultGetRequest("v1/secret/vpwmgr/user/"+ vaultid +"/"+ groupentry);
    var retdata = response.data
    var eidparts = groupentry.split("/")
    retdata.groupid = eidparts[0]
    retdata.title = eidparts[1]
    return retdata
}

/* Make a request to the Vault server. Return the parsed JSON result.
*/
function vaultPostRequest(relURL, dataobj) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", BASEURL + encodeURI(relURL), false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("X-Vault-Token",window.userToken);
    xhttp.send(JSON.stringify(dataobj));
    console.log("response=%s",xhttp.responseText);
    return
}

function writeEntry(obj) {
    var data = new Object()
    data.url = obj.url
    data.userid = obj.userid
    data.password = obj.password
    data.notes = obj.notes
    data.changed = obj.changed
    data.pwChanged = obj.pwChanged
    var grouptitle = obj.groupid +'/'+ obj.title
    vaultPostRequest("v1/secret/vpwmgr/user/"+ vaultid +"/"+ grouptitle, data)
}

function deleteEntry(groupid,title) {
    console.log('deleteEntry for %s/%s',groupid,title);
    var response = vaultDeleteRequest("v1/secret/vpwmgr/user/"+ vaultid +"/"+ groupid
								  +"/"+ title);
    return response
}


/* Return 'true' if an entry with the same group/title exists */
function entryExists (groups, groupid, title) {
    var gid= groupid +"/";
    for (i=0; i < groups.length; i++) {
	    if (groups[i].name !== gid) continue;
	    for (j=0; j < groups[i].entries.length; j++) {
	        if (groups[i].entries[j] === title) return true;
	    }
    }
    return false;
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

function clearAllFields(obj) {
	console.log("Clear fields");
	obj.orig_group="";
	obj.orig_title="";
	obj.orig_pw="";
	obj.groupid="";
	obj.title="";
	obj.url="";
	obj.userid="";
	obj.password="";
	obj.notes="";
	obj.pwChanged="";
	obj.changed="";
	obj.error="";
	obj.showPW=false;
}


// define the authentication component
Vue.component('authentication', {
    data: function () {
	    return {
	        vaultid: "psparks",
	        pass: "pw",
	        error: false
	    }
    },
    template: "#login-template",
    methods: {
	    login: function () {
	        window.vaultid = this.vaultid;
	        window.userToken = passwordAuthenticate(this.vaultid, this.pass)
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
            orig_pw: "",
	        groupid: "",
	        title: "",
	        url: "",
	        userid: "",
	        password: "",
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
	    if (!(this.orig_group===this.groupid && this.orig_title===this.title)) return "overwrite";
	    return "update";
	},
	// Determine if currently shown entry can be deleted (display delete button)
	isDeleteable: function () {
		return (this.orig_group!=="" && this.orig_title!=="" &&
			   this.groupid!=="" && this.title!=="")
	},

	clearfields: function () {
		clearAllFields(this);
	},
	cancel: function () {
		this.error= "Request cancelled"
	},
	deleteentry: function () {
		var name=this.groupid +"/"+ this.title;
		console.log("Delete entry:"+ name);
		if (entryExists(this.groups, this.groupid, this.title)) {
		    console.log('Deleting Entry');
			deleteEntry(this.groupid, this.title);
			this.groups = getGroups(window.vaultid)
			clearAllFields(this)
		    this.error= "Deleted entry "+ name;
		}
		else {
		    this.error= "Entry does not exist:"+ name;
		}
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
		        this.error= "Added new entry "+ this.groupid +"/"+ this.title;
		    }
	    }
        var d = currentTime()
        this.changed = d
        console.log("orig_pw="+ this.orig_pw +" curPW="+ this.password)
        if (this.orig_pw !== this.password) this.pwChanged = d
	    writeEntry(this)
		this.groups = getGroups(window.vaultid)
		this.orig_group = this.groupid;
		this.orig_title = this.title;
		this.orig_pw = this.password;
		this.showPW = false;
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
        var d = currentTime()
        this.changed = d
        console.log("orig_pw="+ this.orig_pw +" curPW="+ this.password)
        if (this.orig_pw !== this.password) this.pwChanged = d
	    writeEntry(this)
		// TODO Might be able to make this conditional
        this.groups = getGroups(window.vaultid)
		this.orig_group = this.groupid;
		this.orig_title = this.title;
		this.orig_pw = this.password;
		this.showPW = false;
	},
	showpass: function () {
	    this.showPW = !this.showPW;
	},
	displayEntry: function (entryId) {
	    console.log("displayEntry %s", entryId)
	    var data = getDetails(entryId)
	    console.log("group=%s title=%s user=%s",data.groupid, data.title, data.userid)
	    this.orig_group = data.groupid
	    this.orig_title = data.title
        this.orig_pw = data.password
	    this.groupid = data.groupid
	    this.title = data.title
	    this.userid = data.userid
	    this.password = data.password
        this.url = data.url
	    this.notes = data.notes
        this.changed = data.changed
        this.pwChanged = data.pwChanged
        this.showPW = false
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
	    this.pwgroups = getGroups(window.vaultid);
	    this.flow= 'main';
	    console.log('flow=%s', this.flow);
	    console.log("pwgroups0=%s",this.pwgroups[0])
	}
    }
})

Vue.component('confirm', {
	props: ['text'],
	functional: true,
	render(h, context) {
		// check slots
		if (context.children.length !== 1) {
			console.error('confirm must have exactly 1 child element.')
			return null
		}
		const el = context.children[0]
		// add listener to slot vnode if specified
		const {confirm, cancel} = context.listeners
		if (confirm) {
			// create button listener callback
			const text = context.props.text || "Really do this?"
			const wrappedListener = () => {
				const res = window.confirm(text)
				if (res) {
					confirm()
				} else if (cancel) {
					cancel()
				}
			}
			const data = (el.data || {})
			const on = (data.on || (data.on = {}))
			on.click = wrappedListener
			el.data = data
		}
		return el
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

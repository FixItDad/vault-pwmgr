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


/* Authenticate a user to Vault using a password.
A successful Vault response for a password login looks similar to:
{"request_id":"df406871-9c46-2a4b-265a-e4991e1b3737","lease_id":"","renewable":false,"lease_duration":0,"data":null,"wrap_info":null,"warnings":null,"auth":{"client_token":"7d44048a-60b0-6788-7252-1f81a423387e","accessor":"2cc26537-4873-75e5-c18d-5bc5e0d34434","policies":["default","user-psparks"],"metadata":{"userid":"psparks"},"lease_duration":2764800,"renewable":true,"entity_id":"0cf6ec07-3c81-ff05-64f2-d5a835091e92"}}
*/
function passwordAuthenticate(vaultid, password) {
    console.log("passwordAuth |%s|%s|",vaultid,password);
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

function writeEntry(grouptitle, url, userid, passwd, notes, pwChanged) {
    var data = new Object()
    data.url = url
    data.userid = userid
    data.password = passwd
    data.notes = notes
    var d = new Date();
    data.changed = d.toISOString()
    if (pwChanged) data.pwChanged = d.toISOString()
    vaultPostRequest("v1/secret/vpwmgr/user/"+ vaultid +"/"+ grouptitle, data)
}


/* Return 'true' if an entry with the same group/title exists */
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
	        vaultid: "psparks",
	        pass: "!Password01!",
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
	    writeEntry(this.groupid +'/'+ this.title, this.url, this.userid, this.pass, this.notes,
                   true)
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
	    writeEntry(this.groupid +'/'+ this.title, this.url, this.userid, this.pass, this.notes,
                  (this.orig_pw != this.password))
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
	    this.pass = data.password
        this.url = data.url
	    this.notes = data.notes
        this.changed = data.changed
        this.pwChanged = data.pwChanged
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

/*
Javascript portion of a password manager front end for Hashicorp's Vault product.
This is written as a single page web app with the Vue.js framework.

Each user can have many password entries organized into groups. Password entries are uniquely
identified by a title within each group. Entries can contain an associated URL, userid, 
password, and free form text notes.

Uses the following Vault structure to store individual user passwords.
.../pwmgr/user/<vaultid>/<groupname>/<title>

Uses the following Vault structure to store shared team passwords.
.../pwmgr/team/<teamid>/<groupname>/<title>

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

// Special group for historical entries
var HISTGROUP="Archived Entries"

// Vault path prefix for this application
var VPWMGR= "v1/secret/vpwmgr/"

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
    if (! response.auth)
        return ""
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
	if (xhttp.status != 200) return null
    console.log("%s response=%s",xhttp.status, xhttp.responseText);
    return JSON.parse(xhttp.responseText);
}

/* Make a request to the Vault server. Return the status.
*/
function vaultPostRequest(relURL, dataobj) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", BASEURL + encodeURI(relURL), false);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("X-Vault-Token",window.userToken);
    xhttp.send(JSON.stringify(dataobj));
    console.log("response=%s",xhttp.responseText);
    return xhttp.status
}

/* Make a request to the Vault server. Return the status.
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

/* Return an array of objects consisting of names and a collection of groups.
*/
function getCollections(vaultid) {
    console.log('getCollections for %s',vaultid);
	var clist = [ "user/"+ vaultid +"/"]
    var response = vaultGetRequest(VPWMGR +"team/?list=true");
    var teamnames = response.data.keys.sort();
	for (var i=0; i < teamnames.length; i++) clist[i+1] = "team/"+ teamnames[i];
		
	var msg="";	for (i=0; i< clist.length; i++) msg += " "+ clist[i];
	console.log('collection list:%s',msg)

	var collections = []
	var next= 0
    for (var i=0; i< clist.length; i++) {
		var collection = getCollection(clist[i])
		if (! collection) continue
		collections[next] = {}
		collections[next].name = clist[i]
		collections[next].entries = collection
		console.log("Added collection %s", collections[next].name)
		next += 1
    }
    return collections;
}

/* Return an array of password group objects consisting of names (with ending '/') and an array of entry names for the given collection id. A collectionid format is either "user/<vaultid>/" or "team/<teamid>/"
Returns null if a collection cannot be retrieved as in the case for teams which the user does not have access to.

Vault list groups response looks similar to the following (groups=network, web)
/ {"request_id":"5eec889b-4bd2-e309-a7be-e4a1265e37f4","lease_id":"","renewable":false,"lease_duration":0,"data":{"keys":["network/","web/"]},"wrap_info":null,"warnings":null,"auth":null}
*/
function getCollection(collectionid) {
    console.log('getCollection for %s',collectionid);
    var response = vaultGetRequest(VPWMGR +collectionid+"?list=true");
	if (! response) return null
    var groupnames = response.data.keys;
    var groups = []
    for (var i=0; i< groupnames.length; i++) {
        groups[i]= {};
        groups[i].name = decodeURI(groupnames[i]);
        groups[i].entries = [];
        response = vaultGetRequest(VPWMGR +collectionid+ groupnames[i] +"?list=true");
        for (var j=0; j< response.data.keys.length; j++)
	    groups[i].entries[j] = decodeURI(response.data.keys[j]);
    }
    return groups;
}

/* Takes group and entry name (e.g. group/entry) Returns object with details of a password entry.
Vault returns results similar to: {"request_id":"5a98b00a-24b6-4fc0-eec3-dd26f0118369","lease_id":"","renewable":false,"lease_duration":2764800,"data":{"notes":"Check email","password":"userpw","userid":"user"},"wrap_info":null,"warnings":null,"auth":null}
*/
function getDetails(entrypath) {
    console.log('getDetails for %s',entrypath);
    var response = vaultGetRequest(VPWMGR + entrypath);
    var retdata = response.data
    var eidparts = entrypath.split("/")
    retdata.groupid = eidparts[2]
    retdata.title = eidparts[3]
    return retdata
}

function writeEntry(obj) {
    var data = new Object()
    data.url = obj.url
    data.userid = obj.userid
    data.password = obj.password
    data.notes = obj.notes
    data.changed = obj.changed
    data.pwChanged = obj.pwChanged
    var path = obj.collectionid + obj.groupid +'/'+ obj.title
    vaultPostRequest(VPWMGR + path, data)
}

function deleteEntry(entrypath) {
    console.log('deleteEntry for %s',entrypath);
    return vaultDeleteRequest(VPWMGR + entrypath)
}

function archiveOldEntry(obj) {
    var data = {}
    data.url = obj.o_url
    data.userid = obj.o_userid
    data.password = obj.o_password
    data.notes = obj.o_notes
    data.changed = obj.changed
    data.pwChanged = obj.pwChanged
	
    var d = new Date()
    var path = obj.collectionid + HISTGROUP +"/"+ obj.o_groupid +"|"+ obj.o_title +"|"+
		d.getFullYear() + (d.getMonth()+1) + d.getDate() +
		d.getHours() + d.getMinutes() + d.getSeconds()
	console.log("Create archive entry: %s", path)
    vaultPostRequest(VPWMGR + path, data)
}


/* Validate a group name. */ 
function okGroupid(name) {
	if (name === HISTGROUP) return false;
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
	obj.o_groupid="";
	obj.o_title="";
	obj.o_url="";
	obj.o_userid="";
	obj.o_password="";
	obj.o_notes="";
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
	        error: ""
	    }
    },
    template: "#login-template",
    methods: {
	    login: function () {
	        window.vaultid = this.vaultid;
	        window.userToken = passwordAuthenticate(this.vaultid, this.pass)
	        console.log("window.userToken=%s", window.userToken);
	        if (window.userToken === "") {
		        this.error = "Bad Login information";
	        }
	        else {
                this.error=""
		        this.$emit('auth-done')
	        }
	    }
    }
})

// Post auth PW manger component
Vue.component('pwmgr', {
    template: "#pwmgr-template",
    data: function () {
	    return {
			collections: [],
			groups: [],
	        groupid: "",
	        o_groupid: "",
	        title: "",
	        o_title: "",
	        url: "",
	        o_url: "",
	        userid: "",
	        o_userid: "",
	        password: "",
            o_password: "",
	        notes: "",
	        o_notes: "",
	        pwChanged: "",
	        changed: "",
	        error: "",
	        showPW: false,
			updateType: "Update",
	    }
    },
    created: function () {
	    eventHub.$on('displayEntry', this.displayEntry)
		this.collections = getCollections(window.vaultid)
    },
    beforeDestroy: function () {
	    eventHub.$off('displayEntry', this.displayEntry)
    },

    methods: {
	submit: function () {}, /* Dummy, just ignore submit request */

	/* Return 'true' if an entry with the same group/title exists in this collection*/
	entryExists: function () {
		var gid= this.groupid +"/";
		for (i=0; i < this.groups.length; i++) {
			if (this.groups[i].name !== gid) continue;
			for (j=0; j < this.groups[i].entries.length; j++) {
				if (this.groups[i].entries[j] === this.title) return true;
			}
		}
		return false;
	},

	// Determine if currently shown entry can be deleted (display delete button)
	showDelete: function () {
		return (this.o_groupid!=="" && this.o_title!=="" &&
			   this.groupid!=="" && this.title!=="")
	},
	// Determine if "New entry" button should be displayed
	showNew: function () {
	    return (this.groupid!=="" && this.title!=="" &&
				!this.entryExists())
	},

	// Determine if Update button should be displayed.
	showUpdate: function () {
		this.updateType="Update"
		if (this.groupid === HISTGROUP) return false
		if (this.o_groupid!==this.groupid && this.o_title===this.title) {
			this.updateType="Move"
			return true
		}
		if (this.o_groupid===this.groupid && this.o_title!==this.title) {
			this.updateType="Rename"
			return true
		}
		if (this.o_groupid!==this.groupid && this.o_title!==this.title) {
			if (this.entryExists()) {
				this.updateType="Overwrite existing!"
				return true
			}
		}
		return (this.o_url !== this.url || this.o_userid !== this.userid ||
				this.o_password !== this.password || this.o_notes !== this.notes)
	},

	// The "Clear fields" button implementation
	clearfields: function () {
		clearAllFields(this);
	},
	// Do nothing when a confirmation is cancelled
	cancel: function () {
		this.error= "Request cancelled"
	},
	// Delete an entry from the PW Vault (Confirmed delete button functionality)
	deleteentry: function () {
		var entrypath= this.collectionid + this.groupid +"/"+ this.title;
		console.log("Delete entry:"+ entrypath);
		if (this.entryExists()) {
			if (this.groupid !== HISTGROUP) archiveOldEntry(this)
			deleteEntry(entrypath);
			this.collections = getCollections(window.vaultid)
			clearAllFields(this)
		    this.error= "Deleted entry "+ entrypath;
		}
		else {
		    this.error= "Entry does not exist:"+ entrypath;
		}
	},
	// Add a new entry to PW vault
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
	    if (!(this.o_groupid===this.groupid && this.o_title===this.title)) {
		    if (this.entryExists()) {
		        console.log('Duplicate Entry');
		        this.error= "Duplicate Entry (group/title)"
		    }
		    else {
		        this.error= "Added new entry "+ this.groupid +"/"+ this.title;
		    }
	    }
        var d = currentTime()
        this.changed = d
        console.log("o_password="+ this.o_password +" curPW="+ this.password)
        if (this.o_password !== this.password) this.pwChanged = d
	    writeEntry(this)
		this.collections = getCollections(window.vaultid)
		this.o_groupid = this.groupid;
		this.o_title = this.title;
		this.o_url = this.url;
		this.o_userid = this.userid;
		this.o_password = this.password;
		this.o_notes = this.notes;
		this.showPW = false;
	},
	// Update a PW vault entry
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

		archiveOldEntry(this)

		// If either groupid or the title changed, then delete the old entry
		if (this.o_groupid!==this.groupid || this.o_title!==this.title) {
			var entrypath = this.collectionid + this.o_groupid +"/"+ this.o_title
		    console.log('Deleting Old Entry %s',entrypath);
			deleteEntry(entrypath);
		}

		var ename=this.groupid +"/"+ this.title;
		if (this.updateType ==="Move") this.error="Moved entry to "+ename;
		else if (this.updateType ==="Rename") this.error="Renamed entry to "+ename;
		else if (this.updateType ==="Overwrite existing!") this.error="Overwrote entry "+ename;
		else this.error="Updated entry "+ename;

        var d = currentTime()
        this.changed = d
        console.log("o_password="+ this.o_password +" curPW="+ this.password)
        if (this.o_password !== this.password) this.pwChanged = d
	    writeEntry(this)
		// TODO Might be able to make this conditional
        this.collections = getCollections(window.vaultid)
		this.o_groupid = this.groupid;
		this.o_title = this.title;
		this.o_url = this.url;
		this.o_userid = this.userid;
		this.o_password = this.password;
		this.o_notes = this.notes;
		this.showPW = false;
	},
	// Show the plaintext password toggle button (eyeball)
	showpass: function () {
	    this.showPW = !this.showPW;
	},
	// Show PW entry details when a navigation entry is selected
	displayEntry: function (collectionId, entryId) {
	    console.log("displayEntry %s %s", collectionId, entryId)
		this.collectionid = collectionId
		// Make sure the groups field gets set for the current collection
		this.groups = null
		for (var i=0; i < this.collections.length; i++) {
			if (this.collections[i].name === collectionId) {
				this.groups = this.collections[i].entries
				break
			}
		}
	    var data = getDetails(collectionId + entryId)
	    console.log("group=%s title=%s user=%s",data.groupid, data.title, data.userid)
	    this.o_groupid = data.groupid
	    this.o_title = data.title
		this.o_url = data.url;
		this.o_userid = data.userid;
        this.o_password = data.password
		this.o_notes = data.notes;
	    this.groupid = data.groupid
	    this.title = data.title
	    this.userid = data.userid
	    this.password = data.password
        this.url = data.url
	    this.notes = data.notes
        this.changed = data.changed
        this.pwChanged = data.pwChanged
        this.showPW = false
	},
	copyuserid: function() {
	    console.log("copyuserid to clipboard")
		this.$refs.userid.select()
		document.execCommand('copy')
	},
	copypassword: function() {
	    console.log("copypassword to clipboard")
        // TODO: Not sure I like changing the type to text temporarily. Could PW be displayed 
        // for a short time or does it not even get rendered? Without the change the PW does not 
        // get copied (FF ESR 52.6.0)
        if (! this.showPW) {
            this.$refs.password.type = 'text'
		    this.$refs.password.select()
		    document.execCommand('copy')
            this.$refs.password.type = 'password'
        } else {
		    this.$refs.password.select()
		    document.execCommand('copy')
        }
	},
    }
})

// Main app component
Vue.component('application', {
    template: "#app-template",
    data: function () {
	    return {
	        flow: "auth",
	    }
    },
    methods: {
		authComplete: function() {
			this.flow= 'main';
			console.log('flow=%s', this.flow);
		}
    }
})

/* General confirm dialog for destructive operations. Wrap button in <confirm ..></confirm> tags */
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
		collectionid: String,
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
			eventHub.$emit('displayEntry', this.collectionid, entryid);
		},
    }
})

Vue.component('collection', {
    template: '#collection-template',
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
    }
})


// boot up the demo
var demo = new Vue({
    el: '#demo',
},
)

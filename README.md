# vault-pwmgr
A browser based password manager using Hashicorp's [Vault](https://www.vaultproject.io/) product to store passwords. This is written as a single page web app using [vue.js](https://vuejs.org). 

There is a somewhat similar project at [vault-ui](https://github.com/djenriquez/vault-ui). That solution provides more complete access to the Vault functionality and would be better suited to administrators and more tech savvy users. With this project I wanted to provide some easy to use basic password manager functionality with the ability to easily share passwords among teams.

Each user can have many password entries organized into groups. Password entries are uniquely
identified by a title within each group. Entries can contain an associated URL, userid, 
password, and free form text notes.

I'm planning to add functionality for sharing passwords among team members. Each team would have a set of passwords with grouped password entries like an individual. An individual could be a member of multiple teams as needed. An administrator role would be responsible for managing individual accounts and team membership.

Here's a screenshot representing development at the beginning of 2018. I'm sure you can tell that I'm not terribly interested in making it look pretty at this point.

![Screenshot of the UI with a navigation tree of folders and entry title in the left column and a form with password entry details in the right column. There are update timestamps and an update button at the bottom or the right column.](https://github.com/FixItDad/vault-pwmgr/raw/master/images/screenshot1.jpg "Screenshot 1")

**WARNING! Make sure you are seated solidly in your chair before looking at the source code.**
(We don't need any injuries resulting from laughing fits. :-)
This is my first AJAX project. I wanted something to help me learn [vue.js](https://vuejs.org) 

The main action is in pwmgr.js and index.html. The httpd.py is a trivial web server that I use to make cross origin resource sharing a little easier for development. *Don't even think about using httpyd.py in a hostile environment!*

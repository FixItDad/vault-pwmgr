# vault-pwmgr
A browser based password manager using Hashicorp's [Vault](https://www.vaultproject.io/) product to store passwords. This is written as a single page web app using [vue.js](https://vuejs.org). 

There is a somewhat similar project at [vault-ui](https://github.com/djenriquez/vault-ui). That solution provides more complete access to the Vault functionality and would be better suited to administrators and more tech savvy users. With this project I wanted to provide some easy to use basic password manager functionality with the ability to easily share passwords among teams.

Each user can have many password entries organized into groups. Password entries are uniquely
identified by a title within each group. Entries can contain an associated URL, userid, 
password, and free form text notes.

There is also functionality for sharing passwords among team members. Each team has a set of passwords with grouped password entries like an individual. An individual could be a member of multiple teams as needed. An administrator role would be responsible for managing individual accounts and team membership.

Here's a screenshot representing development around April 2018. I'm primarily concerned with functionality rather than looks at this point.

![Screenshot of the UI with a navigation tree of folders and entry title in the left column and a form with password entry details in the right column. There are update timestamps and an update button at the bottom or the right column.](https://github.com/FixItDad/vault-pwmgr/raw/master/doc/screenshot1.jpg "Screenshot 1")

This is my first AJAX / web development project so if you're a web developer looking at the code, try not to laugh too hard. I wanted something to help me learn about front-end web programming and [vue.js](https://vuejs.org) in particular.

The main action is in pwmgr.js and index.html. The httpd.py is a trivial web server that I use to make cross origin resource sharing a little easier for development. *Don't even think about using httpyd.py in a hostile environment!* The vue file is the vue.js library. It's included here so I can host it locally and not suck bandwidth from the Vue folks while testing.

## System requirements
These are expected requirements. There are only developer installations at this point.
* Hashicorp's Vault product as the backend server.
* Web server front end to serve static application files. (e.g. NGINX, Apache) This may also serve as a proxy to the vault back end.
* Modern webbrowser for the clients. (I've been testing with Firefox).

## Additional Developer Requirements
* The included httpd.py server can be used instead of a full web server.
* Python 2.7 for the development web server and test scripts. Other versions may also work.
* pytest, pytest-sourceorder and W3C WebDriver (e.g. geckodriver or chromedriver) are also needed if you want to run the functional tests.

#! /usr/bin/python

# Paul T Sparks 2015-03-04

import BaseHTTPServer
import SocketServer
import socket
import string
import sys
import threading
import time
import urlparse

HOST_NAME = 'localhost'
PORT_NUMBER = 7080


debugFlag = True
def setDebug(flag):
    global debugFlag
    debugFlag= flag

def debug(*args):
    if debugFlag:
        sys.stderr.write(' '.join(map(str,args))+'\n')

def log(*args):
    sys.stderr.write(' '.join(map(str,args))+'\n')



class MyHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    def do_HEAD(s):
        s.send_response(200)
        s.send_header("Content-type", "text/html")
        s.end_headers()


    def do_GET(s):
        """Respond to a GET request."""
        debug('got GET')
        ppath = urlparse.urlparse(s.path)
        params = urlparse.parse_qs(ppath.query)
        debug('GET request ppath:', ppath,' params:', params)
        s.send_response(200)
        s.send_header('Content-type', 'text/html')
        s.send_header('Access-Control-Allow-Origin', '*')
        s.end_headers()
        

        if ppath.path == '/':
            s.wfile.write(open('index.html','r').read())
        else:
            s.wfile.write(open(ppath.path[1:],'r').read())

        
    def do_POST(s):
        """Respond to a POST request."""
        debug('got POST')
        s.send_response(200)
        s.send_header("Content-type", "text/html")
        s.end_headers()
        return 'content'

class ThreadedHTTPServer(SocketServer.ThreadingMixIn, BaseHTTPServer.HTTPServer):
    """ Handle requests in a seperate thread. """


if __name__ == '__main__':
    setDebug(True)
    httpd = ThreadedHTTPServer((HOST_NAME, PORT_NUMBER), MyHandler)
    print time.asctime(), "Server Starts - %s:%s" % (HOST_NAME, PORT_NUMBER)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print time.asctime(), "Server Stops - %s:%s" % (HOST_NAME, PORT_NUMBER)

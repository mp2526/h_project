/**
 * Created by mike on 3/24/17.
 */
'use strict';

var net = require('net');
var util = require('util');
const readline = require('readline');

function Client () {
}

Client.prototype.connect = function (port, host) {
    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });
    this.port = port;
    this.host = host;
    this._login();
};

Client.prototype._login = function () {
    if(!this.user) {
        this.rl.question('Hey, what is your name?> ', function(answer) {
            if(answer && answer.trim() != '') {
                this.user = { "name" : answer };
                this._createConnection();
            } else {
                console.log('That don\'t sound right, Try again.');
                this._login();
            }
        }.bind(this));
    }
};

Client.prototype._createConnection = function () {
    this.socket = net.createConnection(this.port, this.host, function () {
        this.timer = setInterval(this._checkHeartbeat.bind(this), 3000);
        this.socket.write(JSON.stringify(this.user));
    }.bind(this))
        .on('data', this._handleResponse.bind(this))
        .on('end', this._endSession.bind(this));
}


Client.prototype._handleInput = function (line) {
    this.socket.write(line);
}

Client.prototype._handleResponse = function (response) {
    var a = response.toString().split('\n');

    if(a[a.length - 1] == '')
        a.pop();

    a.forEach(function(element) {
        try {
            var data = JSON.parse(element)

            switch (data.type) {
                case 'welcome':
                    console.log(data.msg);
                    this.rl.on('line', this._handleInput.bind(this));
                    console.log('Send me some JSON love.');
                    this.rl.prompt();
                    break;
                case 'heartbeat':
                    console.log('lubdub...');
                    //just in case the server and client machine clocks are off
                    this.lastHeartBeat = Math.floor((new Date).getTime()/1000);
                    break;
                default:
                    console.log(element + '');
            }
        } catch (e) {
            //I only care about non heartbeat JSON errors, because I'll get another heartbeat soon enough, or I'll restart the socket
            if(element.indexOf('"heartbeat"') == -1) {
                console.log('BURP! Pardon me, something weird just happened! - ' + e.message);
                this.rl.prompt();
            }
        }
    }.bind(this));
}

Client.prototype._checkHeartbeat = function () {
    console.log('breath...');
    if(this.lastHeartBeat < (Math.floor((new Date).getTime()/1000) - 2)) {
        console.log('Whoa! Looks like something nodded off. Hold on while I try to reconnect...');
        clearInterval(this.timer);
        this.restart = true;
        this.socket.end();
    }
}

Client.prototype._endSession = function () {
    if(this.restart) {
        this.restart = false;
        this._createConnection();
    } else {
        clearInterval(this.timer);
        this.rl.close();
        console.log('Bye Bye.');
    }
}

module.exports = exports = new Client();
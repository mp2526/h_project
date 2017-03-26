/**
 * Created by mike on 3/24/17.
 */
'use strict';

var net = require('net');
var util = require('util');
const readline = require('readline');

const MSG_LOGIN = 'Hey, what is your name? > ';
const MSG_PROMPT = 'Send me some JSON love.';
const MSG_LOGIN_ERROR = 'That don\'t sound right, Try again.';
const MSG_TIME_RESPONSE = 'The time on deck is %s.';
const MSG_RANDOM_RESPONSE = 'The random number is %s.';
const MSG_COUNT_RESPONSE = 'The count is %s.';
const MSG_HEARTBEAT = 'Whoa! Looks like something nodded off. Hold on while I try to reconnect...';
const MSG_RESTARTING = 'Restarting session...';
const MSG_BYE = 'Bye Bye.';
const MSG_ERROR = 'Woops, something went wrong. - ';

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
        this.rl.question(MSG_LOGIN, function(answer) {
            if(answer && answer.trim() != '') {
                this.user = { "name" : answer };
                this._createConnection();
            } else {
                console.log(MSG_LOGIN_ERROR);
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
};


Client.prototype._handleInput = function (line) {
    try {
        var data = JSON.parse(line);
        data.id = this.user.name;

        this.socket.write(JSON.stringify(data));
    } catch (e) {
        console.log(util.format(MSG_ERROR, e.message));
        this.rl.prompt();
    }
};

Client.prototype._handleResponse = function (response) {
    var a = response.toString().split('\n');

    if(a[a.length - 1] == '')
        a.pop();

    a.forEach(function(element) {
        try {
            var data = JSON.parse(element);

            switch (data.type) {
                case 'welcome':
                    console.log(data.msg);
                    this.rl.on('line', this._handleInput.bind(this));
                    console.log(MSG_PROMPT);
                    this.rl.prompt();
                    break;
                case 'msg':
                    if(data.msg.reply == this.user.name) {
                        if (data.msg.time) {
                            console.log(util.format(MSG_TIME_RESPONSE, data.msg.time));
                            if (data.msg.random && data.msg.random > 30) {
                                console.log(util.format(MSG_RANDOM_RESPONSE, data.msg.random));
                            }
                        } else if (data.msg.count) {
                            console.log(util.format(MSG_COUNT_RESPONSE, data.msg.count));
                        }
                    }
                    this.rl.prompt();
                    break;
                case 'heartbeat':
                    //console.log('lubdub...');
                    //just in case the server and client machine clocks are off
                    this.lastHeartBeat = Math.floor((new Date).getTime()/1000);
                    break;
                case 'error':
                    console.log(util.format(MSG_ERROR, data.reason));
                    this.rl.prompt();
                    break;
                default:
                    console.log(element + '');
            }
        } catch (e) {
            //I only care about non heartbeat JSON errors, because I'll get another heartbeat soon enough, or I'll restart the socket
            if(element.indexOf('"heartbeat"') == -1) {
                console.log(util.format(MSG_ERROR, e.message));
                this.rl.prompt();
            }
        }
    }.bind(this));
};

Client.prototype._checkHeartbeat = function () {
    //console.log('breath...');
    if(this.lastHeartBeat < (Math.floor((new Date).getTime()/1000) - 2)) {
        clearInterval(this.timer);
        this.rl.pause();
        this.socket.end();
        console.log(MSG_HEARTBEAT);
        this.restart = true;
        console.log(MSG_RESTARTING);
    }
};

Client.prototype._endSession = function () {
    if(this.restart) {
        this.restart = false;
        this._createConnection();
    } else {
        clearInterval(this.timer);
        this.rl.close();
        console.log(MSG_BYE);
    }
};

module.exports = exports = new Client();
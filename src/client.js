/**
 * Created by mike on 3/24/17.
 */
'use strict';

var net = require('net');
var util = require('util');
const readline = require('readline');

const ora = require('ora');

const MSG_LOGIN = 'Hey, what is your name? > ';
const MSG_PROMPT = 'Send me some JSON love.';
const MSG_LOGIN_ERROR = 'That don\'t sound right, Try again.';
const MSG_TIME_RESPONSE = 'The time on deck is:';
const MSG_RANDOM_RESPONSE = 'The random number is %s.';
const MSG_COUNT_RESPONSE = 'The count is %s.';
const MSG_HEARTBEAT = 'Whoa! Looks like something nodded off. Hold on while I try to reconnect...';
const MSG_RESTARTING = 'Restarting session...';
const MSG_SPINNER = 'Hold up a sec...'
const MSG_BYE = 'Bye Bye.';
const MSG_ERROR = 'Woops, something went wrong. - ';

function Client () {
}

Client.prototype.connect = function (port, host) {
    this._createReadlineInterface();
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
                this._console_out(MSG_LOGIN_ERROR);
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

Client.prototype._createReadlineInterface = function () {
    this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });
    this.rl.on('line', this._handleInput.bind(this));
};

Client.prototype._handleInput = function (line) {
    //Handle stdin from readline 'line' event
    if(line.trim() != '') {
        if(line == 'quit') {
            this.socket.end();
        } else {
            try {
                var data = JSON.parse(line);
                data.id = this.user.name;

                if(data.request == 'time' || data.request == 'count') {
                    this.spinner = ora(MSG_SPINNER).start();
                }

                this.socket.write(JSON.stringify(data));
            } catch (e) {
                this._console_out(util.format(MSG_ERROR, e.message));
            }
        }
    }
};

Client.prototype._handleResponse = function (response) {
    //Handle response from server
    var a = response.toString().split('\n');

    if(a[a.length - 1] == '')
        a.pop();

    a.forEach(function(element) {
        try {
            var data = JSON.parse(element);

            switch (data.type) {
                case 'welcome':
                    this._console_out(util.format('%s %s', data.msg, MSG_PROMPT));
                    break;
                case 'msg':
                    if(data.msg.reply == this.user.name) {
                        this.spinner.stop();
                        if (data.msg.time && data.msg.random) {
                            this._console_out(this._formatTimeMsg(data.msg.time, data.msg.random));
                        } else if (data.msg.count) {
                            this._console_out(this._formatCountMsg(util.format(MSG_COUNT_RESPONSE, data.msg.count)));
                        }
                    }
                    break;
                case 'heartbeat':
                    //this._console_out('lubdub...');
                    //just in case the server and client machine clocks are off
                    this.lastHeartBeat = Math.floor((new Date).getTime()/1000);
                    break;
                case 'error':
                    if(this.spinner) {
                        this.spinner.stop();
                    }

                    this._console_out(util.format(MSG_ERROR, data.reason));
                    break;
                default:
                    this._console_out(element + '');
            }
        } catch (e) {
            //I only care about non heartbeat JSON errors, because I'll get another heartbeat soon enough, or I'll restart the socket
            if(element.indexOf('"heartbeat"') == -1) {
                this._console_out(util.format(MSG_ERROR, e.message));
            }
        }
    }.bind(this));
};

Client.prototype._checkHeartbeat = function () {
    //this._console_out('breath...');
    if(this.lastHeartBeat < (Math.floor((new Date).getTime()/1000) - 2)) {
        this.restart = true;
        clearInterval(this.timer);
        this.rl.pause();
        this.socket.end();
        if(this.spinner) {
            this.spinner.stop();
        }
        this._console_out(MSG_HEARTBEAT);
        this._console_out(MSG_RESTARTING);
    }
};

Client.prototype._endSession = function () {
    if(this.restart) {
        this.restart = false;
        this._createConnection();
    } else {
        if(this.spinner) {
            this.spinner.stop();
        }
        clearInterval(this.timer);
        this._console_out(MSG_BYE);
        this.rl.close();
        process.exit(0);
    }
};

Client.prototype._console_out = function (msg) {
    //handles some quirkiness between readline and console.log
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    console.log(msg);
    this.rl.prompt(true);
};

Client.prototype._formatTimeMsg = function (time, rnd) {
    var d = new Date(time), rndMsg = '';

    var tzo = (new Date().getTimezoneOffset()/60) * (-1);
    d.setHours(d.getHours() + tzo);

    if (rnd > 30) {
        rndMsg = util.format(MSG_RANDOM_RESPONSE, rnd);
    }

    return util.format(
        `\x1b[37m***************************************************************
        
    %s\x1b[0m
    \x1b[47m\x1b[34m %s \x1b[0m
    \x1b[47m\x1b[34m %s \x1b[0m
    \x1b[37m%s\x1b[0m
    
\x1b[37m***************************************************************\x1b[0m`,
        MSG_TIME_RESPONSE,
        d.toLocaleTimeString(),
        d.toDateString(),
        rndMsg
    );
};

Client.prototype._formatCountMsg = function (msg) {
    return util.format(
        `\x1b[37m***************************************************************
        
    %s
    
***************************************************************\x1b[0m`,
        msg
    );
};

module.exports = exports = new Client();
/**
 * Created by mike on 3/24/17.
 */
var client = require('./src/client');

const HOST = '35.184.58.167';
const PORT = 9432;

client.connect(PORT, HOST);
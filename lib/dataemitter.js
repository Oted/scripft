var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
    console.log('Got a new tasty client');
});

module.exports = {
    "emit" : function(data) {
        console.log('emitting data', data);

        wss.clients.forEach(function each(client) {
            client.send(JSON.stringify(data));
        });
    }
};

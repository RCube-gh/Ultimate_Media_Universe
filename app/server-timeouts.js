const http = require("http");
const https = require("https");

function patchCreateServer(mod) {
  const original = mod.createServer;

  mod.createServer = function patchedCreateServer(...args) {
    const server = original.apply(this, args);

    // Large uploads can legitimately take a long time on Raspberry Pi + LAN.
    server.requestTimeout = 0;
    server.timeout = 0;
    server.keepAliveTimeout = 65000;

    return server;
  };
}

patchCreateServer(http);
patchCreateServer(https);

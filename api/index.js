import server from '../server/server.js';

export default function handler(req, res) {
  server.emit('request', req, res);
}

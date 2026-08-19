import server from '../server/server.js';

export default async function handler(req, res) {
  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    server.emit('request', req, res);
  });
}

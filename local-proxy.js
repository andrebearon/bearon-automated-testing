// Local CONNECT proxy, for one reason only: Chromium launched from this
// VM cannot complete a CONNECT tunnel through the cell egress proxy on
// its own (net::ERR_TUNNEL_CONNECTION_FAILED, even with Playwright's
// proxy option, with --proxy-server, and with --no-proxy-server), while
// curl and Node fetch through the same egress proxy succeed.
// This script does NOT bypass the egress proxy or any access control:
// it forwards Chromium's CONNECT request to that same egress proxy,
// with the same Proxy-Authorization taken from the environment at
// runtime, then pipes the TLS bytes untouched. Chromium then talks
// TLS end-to-end to the target site, exactly as it would directly.
// It never logs credentials or request bodies. Listen on loopback only.
// Usage: node local-proxy.js [port, default 8888]
// Then point Playwright at proxy http://127.0.0.1:8888 (no auth).
const net = require('net');

const port = Number(process.argv[2] || 8888);
const egressUrl = process.env.https_proxy || process.env.HTTPS_PROXY
  || process.env.http_proxy || process.env.HTTP_PROXY;
if (!egressUrl) { console.error('No proxy in environment.'); process.exit(1); }
const egress = new URL(egressUrl);
const egressHost = egress.hostname;
const egressPort = Number(egress.port || 3128);
const auth = egress.username
  ? 'Basic ' + Buffer.from(
      decodeURIComponent(egress.username) + ':' + decodeURIComponent(egress.password || '')
    ).toString('base64')
  : null;

const server = net.createServer((client) => {
  client.once('data', (head) => {
    const line = head.toString().split('\r\n')[0] || '';
    const m = line.match(/^CONNECT ([^ ]+) HTTP/);
    if (!m) { client.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
    const target = m[1];
    const upstream = net.connect(egressPort, egressHost, () => {
      const headers = [
        `CONNECT ${target} HTTP/1.1`,
        `Host: ${target}`,
        ...(auth ? [`Proxy-Authorization: ${auth}`] : []),
        'Proxy-Connection: Keep-Alive',
        '', '',
      ].join('\r\n');
      upstream.write(headers);
    });
    // Accumulate until the CONNECT response headers end. The first chunk
    // may already contain TLS bytes after the headers — those must be
    // forwarded to the client, not discarded, or the handshake corrupts.
    let buf = Buffer.alloc(0);
    const onData = (res) => {
      buf = Buffer.concat([buf, res]);
      const end = buf.indexOf('\r\n\r\n');
      if (end === -1) return;
      const header = buf.slice(0, end).toString();
      const rest = buf.slice(end + 4);
      upstream.removeListener('data', onData);
      if (!/^HTTP\/1\.1 200/.test(header)) {
        client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        upstream.destroy();
        return;
      }
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (rest.length) client.write(rest);
      client.pipe(upstream);
      upstream.pipe(client);
    };
    upstream.on('data', onData);
    upstream.on('error', () => client.destroy());
    client.on('error', () => upstream.destroy());
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local CONNECT proxy listening on 127.0.0.1:${port}, forwarding to the cell egress proxy.`);
});

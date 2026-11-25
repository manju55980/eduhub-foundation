import http from "node:http";

const targetPort = 11434;
const listenPort = Number(process.env.EMBED_PROXY_PORT || 11435);

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/api/embed") {
    response.writeHead(404);
    response.end();
    return;
  }

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: "/api/embed",
      method: "POST",
      headers: {
        ...request.headers,
        host: `127.0.0.1:${targetPort}`,
        origin: `http://127.0.0.1:${targetPort}`,
      },
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(`Embed proxy listening on http://127.0.0.1:${listenPort}`);
});

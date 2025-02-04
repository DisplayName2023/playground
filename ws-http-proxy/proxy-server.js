// 公网服务器代码：proxy-server.js
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const port =  process.env.WS_PORT || 18080;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储内网客户端连接
let client = null;

wss.on('connection', (ws) => {
  client = ws;
  console.log('内网客户端已连接');
  ws.on('close', () => {
    client = null;
    console.log('内网客户端断开');
  });
});

// 代理所有HTTP请求
app.all('*', async (req, res) => {
  if (!client) {
    return res.status(503).send('服务不可用：内网客户端未连接');
  }

  // 构造请求对象
  const requestId = Date.now();
  const requestData = {
    id: requestId,
    method: req.method,
    path: req.url,
    headers: req.headers,
    body: await getRequestBody(req) // 需要读取请求体
  };

  // 发送请求到内网客户端
  client.send(JSON.stringify(requestData));

  // 等待响应
  const timeout = setTimeout(() => {
    res.status(504).send('网关超时');
    client.off('message', responseHandler);
  }, 10000);

  const responseHandler = (message) => {
    try {
      const data = JSON.parse(message);
      if (data.id === requestId) {
        clearTimeout(timeout);
        res.status(data.status).set(data.headers).send(data.body);
        client.off('message', responseHandler);
      }
    } catch (e) {
      console.error('解析响应失败:', e);
    }
  };

  client.on('message', responseHandler);
});

// 读取请求体
function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => resolve(Buffer.concat(body).toString()));
  });
}

server.listen(port, () => {
  console.log(`公网代理服务运行在: http://0.0.0.0:${port}`);
});
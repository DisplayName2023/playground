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

let timeoutMs = 10000;
// API endpoint to set timeout
app.post('/api/timeout', express.json(), (req, res) => {
  const { timeout } = req.body;
  
  // Validate timeout value
  if (!timeout || typeof timeout !== 'number' || timeout < 1000) {
    return res.status(400).json({ 
      error: 'Invalid timeout value. Must be a number >= 1000ms'
    });
  }

  timeoutMs = timeout;
  res.json({ 
    message: 'Timeout updated successfully',
    timeout: timeoutMs 
  });
});


// API endpoint to get current timeout
app.get('/api/timeout', (req, res) => {
  res.json({
    timeout: timeoutMs
  });
});



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

  console.log(`[${new Date().toISOString()}] 收到新请求:`, {
    method: req.method,
    path: req.url
  });

  // 构造请求对象
  const requestId = Date.now();
  const requestData = {
    id: requestId,
    method: req.method,
    path: req.url,
    headers: req.headers,
    body: await getRequestBody(req)
  };

  // 设置流式响应头
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  console.log(`[${new Date().toISOString()}] 发送请求到内网客户端, requestId: ${requestId}`);
  
  // 发送请求到内网客户端
  client.send(JSON.stringify(requestData));

  // 定义并启动超时定时器
  let timeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] 请求超时 requestId: ${requestId}`);
    res.write('\n[Error: 网关超时]');
    res.end();
    client.off('message', responseHandler);
  }, timeoutMs);

  // 响应处理函数：假设内网客户端会多次返回带有 token 的消息
  const responseHandler = (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[${new Date().toISOString()}] 收到内网响应:`, {
        requestId,
        responseId: data.id,
        hasToken: !!data.token,
        done: !!data.done
      });

      if (data.id === requestId) {
        // 每次收到 token 都重置超时（可选）
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          console.log(`[${new Date().toISOString()}] Token间隔超时 requestId: ${requestId}`);
          res.write('\n[Error: 网关超时]');
          res.end();
          client.off('message', responseHandler);
        }, timeoutMs);

        // 如果消息中包含 token，则写入响应流
        if (data.token) {
          res.write(data.token);
        }
        // 如果收到完成标识，则结束响应
        if (data.done) {
          console.log(`[${new Date().toISOString()}] 请求完成 requestId: ${requestId}`);
          res.end();
          client.off('message', responseHandler);
        }
      }
    } catch (e) {
      console.error(`[${new Date().toISOString()}] 解析响应失败:`, e);
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
// 内网客户端代码：client.js
const WebSocket = require('ws');
const http = require('http');

const PUBLIC_SERVER_WS = process.env.PUBLIC_SERVER_WS || 'ws://公网服务器IP:18080'; // WebSocket地址
const LOCAL_API_PORT = 6399;      // 本地API地址

const ws = new WebSocket(PUBLIC_SERVER_WS);

// 连接公网服务器
ws.on('open', () => {
  console.log('已连接到公网服务器');
});

// 处理代理请求
ws.on('message', async (message) => {
  try {
    const { id, method, path, headers, body } = JSON.parse(message);
    
    // 转发到本地API
    const options = {
      hostname: 'localhost',
      port: LOCAL_API_PORT,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        ws.send(JSON.stringify({
          id: id,
          status: res.statusCode,
          headers: res.headers,
          body: responseBody
        }));
      });
    });

    req.on('error', (e) => {
      ws.send(JSON.stringify({
        id: id,
        status: 500,
        body: `请求失败: ${e.message}`
      }));
    });

    if (body) req.write(body);
    req.end();
  } catch (e) {
    console.error('处理请求失败:', e);
  }
});

// 断线重连逻辑
function reconnect() {
  setTimeout(() => {
    console.log('尝试重新连接...');
    const newWs = new WebSocket(PUBLIC_SERVER_WS);
    newWs.on('open', () => {
      ws = newWs;
      console.log('重连成功');
    });
    newWs.on('error', reconnect);
  }, 5000);
}

ws.on('close', reconnect);
ws.on('error', reconnect);


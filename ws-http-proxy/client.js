const WebSocket = require('ws');
const http = require('http');

// 从环境变量读取配置
const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL; // 格式：ws://123.45.67.89:8080
const LOCAL_API_PORT = process.env.LOCAL_API_PORT || 6399; // 本地API端口

if (!PUBLIC_SERVER_URL) {
  console.error('错误：必须设置环境变量 PUBLIC_SERVER_URL');
  process.exit(1);
}

let ws;
let heartbeatInterval;

// 连接公网服务器
function connect() {
  ws = new WebSocket(PUBLIC_SERVER_URL);

  ws.on('open', () => {
    console.log('已连接到公网服务器');
    // 启动心跳机制
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping(); // 发送心跳包
      }
    }, 30000); // 每30秒发送一次心跳
  });

  ws.on('close', () => {
    console.log('连接已关闭，尝试重新连接...');
    clearInterval(heartbeatInterval); // 清除心跳定时器
    reconnect();
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err.message);
    clearInterval(heartbeatInterval); // 清除心跳定时器
    reconnect();
  });

  ws.on('pong', () => {
    console.log('收到服务器的心跳响应');
  });

  // 处理代理请求的逻辑
  ws.on('message', async (message) => {
    try {
      const { id, method, path, headers, body } = JSON.parse(message);

      console.log(`收到代理请求: ${method} ${path}`);

      // 转发到本地API
      const options = {
        hostname: 'localhost',
        port: LOCAL_API_PORT,
        path: path,
        method: method,
        headers: headers,
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {

          console.log(`转发请求: ${method} ${path} ${responseBody}}`);

          ws.send(
            JSON.stringify({
              id: id,
              status: res.statusCode,
              headers: res.headers,
              body: responseBody,
            })
          );
        });
      });

      req.on('error', (e) => {
        ws.send(
          JSON.stringify({
            id: id,
            status: 500,
            body: `请求失败: ${e.message}`,
          })
        );
      });

      if (body) req.write(body);
      req.end();
    } catch (e) {
      console.error('处理请求失败:', e);
    }
  });
}

// 断线重连逻辑
function reconnect() {
  setTimeout(() => {
    console.log('尝试重新连接...');
    connect();
  }, 5000); // 5秒后重试
}

// 初始化连接
connect();
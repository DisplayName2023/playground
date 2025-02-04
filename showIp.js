const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  // 遍历所有网络接口
  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    for (const config of iface) {
      // 筛选IPv4地址且非内部地址
      if (config.family === 'IPv4' && !config.internal) {
        addresses.push(config.address);
      }
    }
  }
  return addresses;
}

console.log('本机IPv4地址:', getLocalIP());
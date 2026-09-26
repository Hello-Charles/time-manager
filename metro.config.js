// metro.config.js — Metro 打包配置
// expo-sqlite 的 Web 端（wa-sqlite）需要打包 .wasm 文件，Metro 默认不识别该扩展名，
// 这里在 Expo 默认配置基础上追加 wasm 到资源扩展名列表。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/lambda/index.ts
var lambda_exports = {};
__export(lambda_exports, {
  ProxyLambda: () => handler
});
module.exports = __toCommonJS(lambda_exports);

// api/config.json
var config_default = {
  prefix: "WAFAPIGateway",
  description: "A VPC Lambda to get request from API Gateway protected by WAF",
  api: {
    handler: "ProxyLambda"
  },
  headers: {
    "Content-Type": "text/plain;charset=utf-8"
  },
  tags: [
    { key: "Key", value: "Value" },
    { key: "Project", value: "APIGatewayWAF" }
  ]
};

// api/lambda/api-handler.ts
var handler = async (event) => {
  return {
    body: `Success path: "${event.path}"`,
    headers: config_default.headers,
    statusCode: 200
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ProxyLambda
});
//# sourceMappingURL=index.js.map

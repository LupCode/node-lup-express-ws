![GitHub package.json version](https://img.shields.io/github/package-json/v/LupCode/node-lup-express-ws)
![npm bundle size](https://img.shields.io/bundlephobia/min/lup-express-ws)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/LupCode/node-lup-express-ws/On%20Push)
![NPM](https://img.shields.io/npm/l/lup-express-ws)

# lup-express-ws
Node module that provides WebSocket server functionality for express while being compatible with other websocket servers like webpack-hot-client or next.js

## How to use
### JavaScript
```javascript
const express = require('express');
const wss = require('lup-express-ws')(express());
const app = wss.app;

app.ws("/", function(ws, req){
    ws.on('message', function(event){
        ws.send("Hello World");
    });
});


// or with routers
const router = express.Router();
router.ws("/", function(ws, req){
    ws.on('message', function(event){
        ws.send("Hello World");
    });
});

app.use(router);

```

### TypeScript
You additionally need to install `npm install --save-dev @types/ws`
```typescript
import express from 'express';
import expressWs from 'lup-express-ws';
import { WebSocket } from 'ws';

const wss = expressWs(express());
const app = wss.app;

app.ws("/", function(ws: WebSocket, req: express.Request){
    ws.on('message', function(event: any){
        ws.send("Hello World");
    });
});


// or with routers
const router = express.Router() as expressWs.Router;
router.ws("/", function(ws: Websocket, req: express.Request){
    ws.on('message', function(event: any){
        ws.send("Hello World");
    });
});

```

## Credits
This module is inspired by the [express-ws](https://github.com/HenningM/express-ws) module! 
However since the [express-ws](https://github.com/HenningM/express-ws) isn't compatible with other websocket server modules, 
this one got created. 

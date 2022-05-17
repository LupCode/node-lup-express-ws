import * as core from "express-serve-static-core";
import * as express from "express";
import * as http from "http";
import * as https from "https";
import * as internal from "stream";
import * as ws from "ws";





/*
declare function expressWs(app: express.Application, server?: http.Server | https.Server, options?: expressWs.Options): expressWs.Instance;
declare namespace expressWs {
  type Application = express.Application & WithWebsocketMethod;
  type Router = express.Router & WithWebsocketMethod;

  interface Options {
      leaveRouterUntouched?: boolean | undefined;
      wsOptions?: ws.ServerOptions | undefined;
  }

  interface RouterLike {
      get: express.IRouterMatcher<this>;
      [key: string]: any;
      [key: number]: any;
  }

  interface Instance {
      app: Application;
      applyTo(target: RouterLike): void;
      getWss(): ws.Server;
  }

  type WebsocketRequestHandler = (ws: ws, req: express.Request, next: express.NextFunction) => void;
  type WebsocketMethod<T> = (route: core.PathParams, ...middlewares: WebsocketRequestHandler[]) => T;

  interface WithWebsocketMethod {
      ws: WebsocketMethod<this>;
  }
}
*/


// Type definitions
declare namespace expressWs {
  export type Application = express.Application & WithWebsocketMethod;
  export type Router = express.Router & WithWebsocketMethod;

  export type WebsocketRequestHandler = (ws: ws.WebSocket, req: express.Request, next: express.NextFunction | undefined) => void;
  type WebsocketMethod<T> = (route: core.PathParams | string, ...middlewares: WebsocketRequestHandler[]) => T;

  interface WithWebsocketMethod {
    ws: WebsocketMethod<this>;
  }

  interface Options {
    leaveRouterUntouched?: boolean | undefined;
    httpServer?: http.Server | https.Server | undefined;
    wss?: ws.Server | undefined;
  }

  interface RouterLike {
    //get: express.IRouterMatcher<this>;
    [key: string]: any;
    [key: number]: any;
  }

  interface Instance {
    app: Application,
    applyTo(target: RouterLike): void;
    getWss(): ws.Server,
    getRouteHandlers(): Map<string, expressWs.WebsocketRequestHandler[]>
  }

  
}


declare module 'express' {
  function Router(options?: express.RouterOptions): expressWs.Router;
}

const getPathFromUrl = (url: string | undefined): string | null => {
  if(!url) return null;
  let idx = url.indexOf("?");
  return url.substring(0, idx<0 ? url.length : idx);
}


const addWsHandler = (app: expressWs.Instance, target: expressWs.RouterLike) => {
  if(target.ws !== null && target.ws !== undefined) return;
  const routes = app.getRouteHandlers();

  target.ws = (route: core.PathParams, ...middlewares: expressWs.WebsocketRequestHandler[]) => {
    const routeStr = route.toString();
    let list: expressWs.WebsocketRequestHandler[] = routes.get(routeStr) || [];
    middlewares.forEach((middleware) => list.push(middleware));
    routes.set(routeStr, list);
  };
}


export default function expressWs(app: express.Application, options: expressWs.Options = {}): expressWs.Instance{

  const server: http.Server | https.Server = options.httpServer || http.createServer(app);
  if(!options.httpServer){
    app.listen = (...args: any) => {
      return server.listen(...args);
    };
  }

  const wss = options.wss || new ws.Server({noServer: true});
  const routes = new Map<string, expressWs.WebsocketRequestHandler[]>();

  const appWs = {
    app: app,
    applyTo: (target: expressWs.RouterLike) => addWsHandler(appWs, target),
    getWss: () => wss,
    getRouteHandlers: () => routes
  } as expressWs.Instance;


  addWsHandler(appWs, app);
  if(!options.leaveRouterUntouched) addWsHandler(appWs, express.Router);

  server.on('upgrade', (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => {
    const path = getPathFromUrl(req.url);
    if(path){
      const middlewares = routes.get(path);
      if(!middlewares) return;
      wss.handleUpgrade(req, socket, head, (client: ws.WebSocket, request: http.IncomingMessage) => {
        wss.emit('connection', client, request);

        let i = 0;
        const next = function(){
          if(i < middlewares.length) middlewares[i++](client, express.request, next);
        };
        next();
      });
    }
  });

  return appWs;
}
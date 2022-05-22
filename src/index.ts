import * as core from 'express-serve-static-core';
import * as express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as internal from 'stream';
import * as ws from 'ws';

// Define types
declare namespace expressWs {
  export type Application = express.Application & WithWebsocketMethod;
  export type Router = express.Router & WithWebsocketMethod;

  export type WebsocketRequestHandler = (
    socket: ws.WebSocket,
    req: express.Request,
    next: express.NextFunction | undefined,
  ) => void;
  type WebsocketMethod<T> = (route: core.PathParams | string, ...middlewares: WebsocketRequestHandler[]) => T;

  interface WithWebsocketMethod {
    ws: WebsocketMethod<this>;
  }

  export interface Options {
    leaveRouterUntouched?: boolean | undefined;
    httpServer?: http.Server | https.Server | undefined;
    wss?: ws.Server | undefined;
  }

  export interface RouterLike {
    // get: express.IRouterMatcher<this>;
    [key: string]: any;
    [key: number]: any;
  }

  export interface Instance {
    app: Application;
    applyTo(target: RouterLike): void;
    getWss(): ws.Server;
  }
}

declare module 'express' {
  function Router(options?: express.RouterOptions): expressWs.Router;
}

const toWebsocketPath = (url: string | undefined, includeQuery: boolean): string | null => {
  if (!url) return null;
  const idx = url.indexOf('?');
  const out = url.substring(0, idx < 0 ? url.length : idx);
  return out+(out.endsWith("/") ? "" : "/")+".websocket"+((!includeQuery || idx < 0) ? "" : url.substring(idx));
};

const addWsHandler = <T extends expressWs.RouterLike>(app: expressWs.Instance, target: T): void => {
  if (target.ws !== null && target.ws !== undefined) return;
  
  (target as any).ws = function addWsRoute(this, route: core.PathParams, ...middlewares: expressWs.WebsocketRequestHandler[]): T {
    const specialGetUrl = toWebsocketPath(route.toString(), false);

    this.get(specialGetUrl, (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if((req as any).wsHandlers) middlewares.forEach((middleware) => (req as any).wsHandlers.push(middleware));
      next();
    });

    return target as T;
  };
};

const expressWs = (app: express.Application, options: expressWs.Options = {}): expressWs.Instance => {
  const server: http.Server | https.Server = options.httpServer || http.createServer(app);
  if (!options.httpServer) {
    app.listen = (...args: any) => {
      return server.listen(...args);
    };
  }

  const wss = options.wss || new ws.Server({ noServer: true });

  const appWs = {
    app: app as expressWs.Application,
    applyTo: (target: expressWs.RouterLike) => addWsHandler(appWs, target),
    getWss: () => wss,
  } as expressWs.Instance;

  addWsHandler(appWs, app);
  if (!options.leaveRouterUntouched) {
    addWsHandler(appWs, express.Router as any);
  }


  // handle upgrades from simple HTTP request to Websocket
  server.on('upgrade', (req: http.IncomingMessage, duplex: internal.Duplex, head: Buffer) => {
    req.url = toWebsocketPath(req.url, true) || req.url; // TODO add /.websocket at end (append query ? if set)
    (req as any).wsHandlers = [];

    // let express check if there is a handler for this URL
    const res = new http.ServerResponse(req);
    app._router.handle(req, res);


    // if handler was found then accept socket and call handler with accepted socket again
    const wsHandlers = (req as any).wsHandlers;
    if(wsHandlers){

      wss.handleUpgrade(req, duplex, head, (socket: ws.WebSocket, request: http.IncomingMessage) => {
        wss.emit('connection', socket, request);

        let i = -1;
        function handleNext(){
          if(++i < wsHandlers.length){
            wsHandlers[i](socket, req, handleNext);
          }
        }
        handleNext();

      });
    }
  });

  return appWs;
};

export default expressWs;

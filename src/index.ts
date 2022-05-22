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
    getRouteHandlers(): Map<string, WebsocketRequestHandler[]>;
  }
}

declare module 'express' {
  function Router(options?: express.RouterOptions): expressWs.Router;
}

const getPathFromUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  const idx = url.indexOf('?');
  return url.substring(0, idx < 0 ? url.length : idx);
};

const addWsHandler = <T extends expressWs.RouterLike>(app: expressWs.Instance, target: T): void => {
  if (target.ws !== null && target.ws !== undefined) return;
  const routes = app.getRouteHandlers();

  (target as any).ws = (route: core.PathParams, ...middlewares: expressWs.WebsocketRequestHandler[]): T => {
    const routeStr = route.toString();
    const list: expressWs.WebsocketRequestHandler[] = routes.get(routeStr) || [];
    middlewares.forEach((middleware) => list.push(middleware));
    routes.set(routeStr, list);
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
  const routes = new Map<string, expressWs.WebsocketRequestHandler[]>();

  const appWs = {
    app: app as expressWs.Application,
    applyTo: (target: expressWs.RouterLike) => addWsHandler(appWs, target),
    getWss: () => wss,
    getRouteHandlers: () => routes,
  } as expressWs.Instance;

  addWsHandler(appWs, app);
  if (!options.leaveRouterUntouched){
    addWsHandler(appWs, express.Router);
    express.Router.prototype.ws = (route: core.PathParams, ...middlewares: expressWs.WebsocketRequestHandler[]) => {
      const routeStr = route.toString();
      const list: expressWs.WebsocketRequestHandler[] = routes.get(routeStr) || [];
      middlewares.forEach((middleware) => list.push(middleware));
      routes.set(routeStr, list);
    };
  }

  server.on('upgrade', (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => {
    const path = getPathFromUrl(req.url);
    if (path) {
      const middlewares = routes.get(path);
      if (!middlewares) return;
      wss.handleUpgrade(req, socket, head, (socket: ws.WebSocket, request: http.IncomingMessage) => {
        wss.emit('connection', socket, request);

        let i = 0;
        const next = () => {
          if (i < middlewares.length) middlewares[i++](socket, express.request, next);
        };
        next();
      });
    }
  });

  return appWs;
}

export default expressWs;
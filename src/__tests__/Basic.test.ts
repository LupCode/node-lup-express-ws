import express from 'express';
import expressWs from '../../lib/index';
import ws from 'ws';

let app: expressWs.Application, appWs: expressWs.Instance;
let router: expressWs.Router;

beforeAll(() => {
    let expressApp = express();
    appWs = expressWs(expressApp);
    app = appWs.app;
    router = express.Router();
});

test("App has ws method", () => {
    expect(typeof app['ws']).toEqual("function");
});

test("Router has ws method", () => {
    expect(typeof router['ws']).toEqual("function");
});

test("Router ws method is working", () => {
    expect(router.ws("/", (socket: ws.WebSocket, req: express.Request) => {
        
    })).toBeInstanceOf(Function);
})
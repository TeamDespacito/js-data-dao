"use strict";
const express_1 = require("express");
const controllers_1 = require("../controllers");
const base_router_1 = require("./base-router");
class ForgotRouter extends base_router_1.BaseRouter {
    constructor(store, appConfig, mailConfig) {
        super();
        this.controller = new controllers_1.ForgotController(store, mailConfig, appConfig);
        this.store = store;
        this.router = express_1.Router();
        this.routers();
    }
    routers() {
        let ctrl = this;
        this.router.get('/:token', (req, res, next) => this.respond(ctrl.controller.validaToken(req, res, next), res));
        this.router.post('/:token', (req, res, next) => this.respond(ctrl.controller.resetPassword(req, res, next), res));
    }
    getRouter() {
        return this.router;
    }
}
exports.ForgotRouter = ForgotRouter;

//# sourceMappingURL=forgot-router.js.map

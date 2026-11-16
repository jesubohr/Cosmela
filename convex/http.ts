import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { polarWebhook } from "./billing";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
http.route({ path: "/polar/events", method: "POST", handler: polarWebhook });

export default http;

import client from "prom-client";

export const collectDefaultMetrics = client.collectDefaultMetrics;

collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
});
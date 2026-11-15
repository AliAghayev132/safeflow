/**
 * Artillery helpers: every virtual user is a distinct citizen device with its
 * own IP (X-Forwarded-For; the API trusts one proxy hop) somewhere in Baku.
 */
const { randomUUID } = require("node:crypto");

const TYPES = ["collapse", "medical", "fire", "flood", "general"];
const BOUNDS = { latMin: 40.372, latMax: 40.428, lngMin: 49.8, lngMax: 49.9 };

const rnd = (min, max) => min + Math.random() * (max - min);
const ip = () => `10.${Math.floor(rnd(0, 255))}.${Math.floor(rnd(0, 255))}.${Math.floor(rnd(1, 254))}`;

function makeCitizen(context, _events, done) {
  context.vars.clientId = randomUUID();
  context.vars.deviceId = randomUUID();
  context.vars.type = TYPES[Math.floor(Math.random() * TYPES.length)];
  context.vars.lat = rnd(BOUNDS.latMin, BOUNDS.latMax).toFixed(5);
  context.vars.lng = rnd(BOUNDS.lngMin, BOUNDS.lngMax).toFixed(5);
  context.vars.headcount = Math.ceil(rnd(0, 5));
  context.vars.ip = ip();
  return done();
}

module.exports = { makeCitizen };

import { mongoose, ExpressRouter } from "#lib";

const Schema = mongoose.Schema;
const Model = mongoose.model;
const Router = () => ExpressRouter();

// Mean Earth radius in meters (used for $centerSphere and haversine).
const EARTH_RADIUS_METERS = 6378100;

export { Schema, Model, Router, EARTH_RADIUS_METERS };

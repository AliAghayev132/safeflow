// Only AppRouter is exported. CitizenRouter is loaded lazily inside AppRouter;
// re-exporting it statically would merge it back into the main chunk.
export { AppRouter } from './AppRouter'

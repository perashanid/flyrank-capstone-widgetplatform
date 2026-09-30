const app = require("./app");
const config = require("./config");

app.listen(config.port, () => {
  console.log(`Widget platform API listening on ${config.baseUrl} (port ${config.port})`);
  console.log(`GEO_MODE=${config.geoMode}  EMAIL_MODE=${config.emailMode}`);
});

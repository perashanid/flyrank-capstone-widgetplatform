require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "4000", 10),
  baseUrl: process.env.BASE_URL || "http://localhost:4000",
  nodeEnv: process.env.NODE_ENV || "development",

  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  databaseUrl: process.env.DATABASE_URL || "postgres://widget_user:widget_pass@localhost:5432/widgetdb",

  geoMode: process.env.GEO_MODE || "mock", // 'live' | 'mock'
  geoMockProviderADown: process.env.GEO_MOCK_PROVIDER_A_DOWN === "true",
  geoMockProviderBDown: process.env.GEO_MOCK_PROVIDER_B_DOWN === "true",

  emailMode: process.env.EMAIL_MODE || "console", // 'console' | 'smtp'
  smtpHost: process.env.SMTP_HOST || "localhost",
  smtpPort: parseInt(process.env.SMTP_PORT || "1025", 10),
  emailForceFail: process.env.EMAIL_FORCE_FAIL === "true",

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "20", 10),
};

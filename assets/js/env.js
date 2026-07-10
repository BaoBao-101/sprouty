/* ════════════════════════════════════════════════════
   SPROUTY — Environment Config v3.0
   AI keys are now handled exclusively by the backend.
   ════════════════════════════════════════════════════ */
window.ENV = {
  /* API base — /api/v1 routes are proxied by nginx to backend */
  API_BASE: '/api/v1',

  /* App metadata */
  APP_NAME:    'Sprouty',
  APP_VERSION: '6.0',
  APP_ENV:     'production',
};

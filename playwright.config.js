import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 4173;
// Route requests made by the service worker through context.route() as well, so analytics
// stubs and the optional CDN mirror apply once the worker controls the page.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://localhost:${PORT}/CV/`,
        serviceWorkers: 'allow',
        trace: 'retain-on-failure'
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile',  use: { ...devices['Pixel 7'] } }
    ],
    webServer: {
        command: 'node scripts/serve.mjs',
        url: `http://localhost:${PORT}/CV/`,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(PORT) }
    }
});

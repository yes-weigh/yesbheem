const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

        await page.goto('about:blank');

        await page.evaluate(() => {
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    --modal-bg-gradient: #0f172a;
                    --modal-overlay-bg: rgba(0,0,0,0.85);
                    --modal-border: 1px solid rgba(255,255,255,0.08);
                    --modal-h2-color: #f8fafc;
                    --modal-text-secondary: #94a3b8;
                    --text-muted: #94a3b8;
                    --modal-input-text: #f1f5f9;
                    --modal-input-bg: rgba(30, 41, 59, 0.5);
                    --modal-input-border: 1px solid rgba(255, 255, 255, 0.1);
                    --modal-tabs-border: 1px solid rgba(255,255,255,0.05);
                    --modal-tabs-bg: rgba(0,0,0,0.1);
                    --modal-label-color: #64748b;
                    --color-info: #3b82f6;
                    --modal-footer-border: 1px solid rgba(255,255,255,0.05);
                    --modal-footer-bg: rgba(15, 23, 42, 0.5);
                    --modal-table-border: rgba(255,255,255,0.1);
                    --color-success: #10b981;
                }
                body {
                    margin: 0;
                    padding: 0;
                    background: #1e293b;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
            `;
            document.head.appendChild(style);
        });

        // Load testing component code globally
        let rendererCode = fs.readFileSync(path.join(__dirname, 'js/components/b2b-lead-modal.js'), 'utf-8');
        rendererCode = rendererCode.replace(/export function renderB2BLeadModal/, 'window.renderB2BLeadModal = function');

        await page.addScriptTag({ content: rendererCode });

        // Generate HTML
        const html = await page.evaluate(() => {
            const lead = {
                id: '123',
                name: 'Acme Corp',
                business_name: 'Acme Corporation Ltd',
                phone: '+91 9876543210',
                pincode: '682001',
                city: 'Kochi',
                state: 'Kerala',
                district: 'Ernakulam',
                kam: 'John Doe'
            };
            const settings = {
                key_accounts: ['John Doe', 'Jane Smith'],
                lead_statuses: ['New', 'Contacted', 'Converted', 'Lost'],
                log_activities: ['Call', 'Visit', 'Message', 'Followup']
            };
            return window.renderB2BLeadModal(lead, settings);
        });

        await page.evaluate((htmlContent) => {
            document.body.innerHTML = htmlContent;
            // Center modal properly for screenshot
            const overlay = document.querySelector('.dealer-modal-overlay');
            if (overlay) {
                overlay.style.position = 'absolute';
            }
        }, html);

        const outPath = path.join(require('os').homedir(), '.gemini', 'antigravity', 'brain', 'dfa02604-7ff4-45e5-b34d-4f79ac5ef349', 'b2b_leads_chat_ui_redesign.png');
        await page.screenshot({ path: outPath, fullPage: true });
        console.log('Screenshot saved to:', outPath);

        await browser.close();
    } catch (e) {
        console.error('Error taking screenshot:', e);
        process.exit(1);
    }
})();

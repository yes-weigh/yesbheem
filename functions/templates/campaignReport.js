/**
 * Generates the HTML content for the campaign completion report email.
 * @param {string} campaignName - The name of the campaign.
 * @param {object} stats - The statistics object (total, sent, delivered, read, failed).
 * @param {string} campaignId - The ID of the campaign.
 * @returns {string} The HTML string for the email body.
 */
exports.generateCampaignReportHtml = (campaignName, stats, campaignId, campaignData, items = []) => {
    // Format Date helper
    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        return new Date(timestamp.toMillis ? timestamp.toMillis() : timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
        });
    };

    // Rows Generation
    const rowsHtml = items.map((item, index) => {
        const statusColor = item.status === 'sent' ? '#22c55e' : item.status === 'failed' ? '#ef4444' : '#64748b';
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
            <tr style="background-color: ${bg};">
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px;">${item.phone}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                    <span style="background-color: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 99px; font-size: 11px; font-weight: 600;">
                        ${(item.status || 'unknown').toUpperCase()}
                    </span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; text-align: right;">${formatDate(item.sentAt)}</td>
            </tr>
        `;
    }).join('');

    const templateName = campaignData.templateConfig?.name || 'Unknown Template';
    const senderId = campaignData.senderConfig?.name || campaignData.senderConfig?.id || 'Unknown Instance';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
            <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Campaign Report</h1>
                    <p style="color: #e0e7ff; margin-top: 8px; font-size: 16px;">${campaignName}</p>
                </div>

                <div style="padding: 30px;">
                    
                    <!-- Meta Info Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Template</p>
                            <p style="margin: 5px 0 0; color: #1e293b; font-weight: 600;">${templateName}</p>
                        </div>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Sent Via</p>
                            <p style="margin: 5px 0 0; color: #1e293b; font-weight: 600;">${senderId}</p>
                        </div>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Audience</p>
                            <p style="margin: 5px 0 0; color: #1e293b; font-weight: 600;">${campaignData.audienceName || 'Unknown Audience'}</p>
                        </div>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">KAM</p>
                            <p style="margin: 5px 0 0; color: #1e293b; font-weight: 600;">${campaignData.campaignManager || 'Not Assigned'}</p>
                        </div>
                    </div>

                    <!-- Stats Cards -->
                    <div style="display: flex; gap: 10px; margin-bottom: 30px; justify-content: space-between;">
                        <div style="flex: 1; text-align: center; padding: 15px 10px; background: #eff6ff; border-radius: 8px; border: 1px solid #dbeafe;">
                            <div style="color: #3b82f6; font-size: 20px; font-weight: 700;">${stats.total}</div>
                            <div style="color: #60a5fa; font-size: 11px; text-transform: uppercase; margin-top: 4px;">Total</div>
                        </div>
                        <div style="flex: 1; text-align: center; padding: 15px 10px; background: #f0fdf4; border-radius: 8px; border: 1px solid #dcfce7;">
                            <div style="color: #22c55e; font-size: 20px; font-weight: 700;">${stats.sent}</div>
                            <div style="color: #4ade80; font-size: 11px; text-transform: uppercase; margin-top: 4px;">Sent</div>
                        </div>
                        <div style="flex: 1; text-align: center; padding: 15px 10px; background: #fef2f2; border-radius: 8px; border: 1px solid #fee2e2;">
                            <div style="color: #ef4444; font-size: 20px; font-weight: 700;">${stats.failed}</div>
                            <div style="color: #f87171; font-size: 11px; text-transform: uppercase; margin-top: 4px;">Failed</div>
                        </div>
                    </div>

                    <!-- Detailed Log Table -->
                    <h3 style="margin: 0 0 15px; color: #334155; font-size: 16px;">Detailed Delivery Log</h3>
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f1f5f9;">
                                    <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Phone</th>
                                    <th style="padding: 12px; text-align: center; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Status</th>
                                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                        ${items.length === 0 ? '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">No items found in log</div>' : ''}
                    </div>

                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Campaign ID: ${campaignId}</p>
                        <p style="color: #cbd5e1; font-size: 11px; margin: 4px 0 0;">YESGATC Campaign Manager • Auto-Generated Report</p>
                    </div>

                </div>
            </div>
        </body>
        </html>
    `;
};

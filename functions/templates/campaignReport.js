/**
 * Generates the HTML content for the campaign completion report email.
 * @param {string} campaignName - The name of the campaign.
 * @param {object} stats - The statistics object (total, sent, delivered, read, failed).
 * @param {string} campaignId - The ID of the campaign.
 * @returns {string} The HTML string for the email body.
 */
exports.generateCampaignReportHtml = (campaignName, stats, campaignId) => {
    return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #333; margin: 0;">Campaign Completed</h2>
                    <p style="color: #666; margin-top: 5px;">The campaign <strong>${campaignName}</strong> has finished.</p>
                </div>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <h3 style="margin-top: 0; color: #475569; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Performance Summary</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Total Contacts</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #334155;">${stats.total}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Successfully Sent</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #22c55e;">${stats.sent}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Delivered</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #3b82f6;">${stats.delivered}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Read</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10b981;">${stats.read}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Failed</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #ef4444;">${stats.failed}</td>
                        </tr>
                    </table>
                </div>

                <div style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    <p>Campaign ID: ${campaignId}</p>
                    <p>Sent automatically by YESGATC Campaign Manager</p>
                </div>
            </div>
        `;
};

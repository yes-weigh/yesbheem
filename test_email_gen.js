const { generateCampaignReportHtml } = require('./functions/templates/campaignReport');

const mockCampaignData = {
    name: 'Test Campaign',
    status: 'completed',
    audienceName: 'VIP Customers',
    campaignManager: 'John Doe',
    templateConfig: { name: 'Welcome Offer' },
    senderConfig: { name: 'Marketing Inst' }
};

const mockStats = { total: 100, sent: 90, failed: 10 };
const mockItems = [];

const html = generateCampaignReportHtml(
    mockCampaignData.name,
    mockStats,
    'test-campaign-id',
    mockCampaignData,
    mockItems
);

console.log(html);

if (html.includes('VIP Customers') && html.includes('John Doe')) {
    console.log('SUCCESS: KAM and Audience found in HTML');
} else {
    console.error('FAILURE: KAM or Audience missing from HTML');
    process.exit(1);
}

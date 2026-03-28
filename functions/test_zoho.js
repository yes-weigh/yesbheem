const { getAccessToken, fetchAllProducts, ZOHO_ORG_ID } = require('./zoho_service');
const clientId = '1000.QF6JPR5IFOYIHPUUF6Q5ONP90H7KBT';
const clientSecret = 'bd56478cfad01448a829c324fe1b6245dccf9eb4a7';
const refreshToken = '1000.12f61456446269e734cc03521c69bf26.dda7598b7c9d08aea6bbbda51eff387f';

(async () => {
    try {
        console.log('Fetching token...');
        const axios = require('axios');
        const tokenRes = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
            params: {
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: 'http://localhost/callback',
                grant_type: 'refresh_token'
            }
        });
        const token = tokenRes.data.access_token;
        const ZOHO_ORG_ID = '60001225303';
        console.log('Fetching products...');
        const url = `https://www.zohoapis.in/inventory/v1/items`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'X-com-zoho-inventory-organizationid': ZOHO_ORG_ID
            },
            params: {
                organization_id: ZOHO_ORG_ID,
                search_text: 'BPCG - EC',
            }
        });

        const items = response.data.items || [];
        if (items.length > 0) {
            const detailRes = await axios.get(`${url}/${items[0].item_id}`, {
                 headers: {
                    'Authorization': `Zoho-oauthtoken ${token}`,
                    'X-com-zoho-inventory-organizationid': ZOHO_ORG_ID
                },
                params: { organization_id: ZOHO_ORG_ID }
            });
            require('fs').writeFileSync('BPCG-EC.json', JSON.stringify({list_item: items[0], detail_item: detailRes.data.item}, null, 2));
            console.log('Saved to BPCG-EC.json');
            console.log('===========================================');
            console.log('sample JSON snippet:', JSON.stringify(items[0]).substring(0, 300));
        } else {
            console.log('No items found.');
        }
    } catch (e) {
        console.error('Error:', e.response ? JSON.stringify(e.response.data) : e.message);
    }
})();

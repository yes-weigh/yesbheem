/**
 * zoho_service.js
 * Zoho Inventory / Books API service
 * Handles token refresh and API calls with Firestore caching
 */

const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const axios = require('axios');

const ZOHO_TOKEN_URL = 'https://accounts.zoho.in/oauth/v2/token';
const ZOHO_API_BASE = 'https://www.zohoapis.in';
const TOKEN_CACHE_DOC = 'zoho_token_cache';
const PRODUCTS_COLLECTION = 'zoho_products';
// Org ID is not secret — hardcoded to avoid secret CRLF corruption issues
const ZOHO_ORG_ID = '60001225303';

/**
 * Get a valid Zoho access token.
 * Uses Firestore to cache the token and only refreshes when within 5 minutes of expiry.
 */
async function getAccessToken(clientId, clientSecret, refreshToken) {
    const db = admin.firestore();
    const cacheRef = db.collection('_system_cache').doc(TOKEN_CACHE_DOC);
    const cacheDoc = await cacheRef.get();

    if (cacheDoc.exists) {
        const { access_token, expires_at } = cacheDoc.data();
        // Valid if more than 5 minutes remaining
        if (expires_at && expires_at > Date.now() + 300000) {
            console.log('[ZohoService] Using cached access token');
            return access_token;
        }
    }

    console.log('[ZohoService] Refreshing access token...');
    const params = new URLSearchParams({
        refresh_token: refreshToken.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        grant_type: 'refresh_token'
    });

    const response = await axios.post(ZOHO_TOKEN_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, expires_in } = response.data;

    if (!access_token) {
        throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`);
    }

    // Cache for expires_in seconds (typically 3600) — always trim the token to strip any CRLF
    await cacheRef.set({
        access_token: access_token.trim(),
        expires_at: Date.now() + (expires_in * 1000),
        refreshed_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('[ZohoService] Access token refreshed and cached');
    return access_token;
}

/**
 * Build authenticated Zoho API headers
 */
function buildHeaders(accessToken, orgId) {
    return {
        'Authorization': `Zoho-oauthtoken ${accessToken.trim()}`,
        'X-com-zoho-inventory-organizationid': orgId.trim()
    };
}

/**
 * Fetch all items/products from Zoho Inventory with pagination.
 * Returns a normalised array of product objects.
 */
async function fetchAllProducts(accessToken, orgId, page = 1, perPage = 200) {
    const url = `${ZOHO_API_BASE}/inventory/v1/items`;
    const response = await axios.get(url, {
        headers: buildHeaders(accessToken, orgId),
        params: {
            organization_id: orgId.trim(),
            page,
            per_page: perPage,
            sort_column: 'item_name',
            sort_order: 'A'
        }
    });

    if (response.data.code !== 0) {
        throw new Error(`Zoho API error: ${response.data.message}`);
    }

    const items = response.data.items || [];
    const pageContext = response.data.page_context || {};
    const hasMore = pageContext.has_more_page || false;

    const normalised = items.map(normaliseItem);

    if (hasMore) {
        const nextPage = await fetchAllProducts(accessToken, orgId, page + 1, perPage);
        return [...normalised, ...nextPage];
    }

    return normalised;
}

/**
 * Fetch a single product by item_id
 */
async function fetchProductById(accessToken, orgId, itemId) {
    const url = `${ZOHO_API_BASE}/inventory/v1/items/${itemId}`;
    const response = await axios.get(url, {
        headers: buildHeaders(accessToken, orgId),
        params: { organization_id: orgId.trim() }
    });

    if (response.data.code !== 0) {
        throw new Error(`Zoho API error: ${response.data.message}`);
    }

    return normaliseItemDetail(response.data.item);
}

/**
 * Upload an image to a Zoho Inventory item.
 * @param {string} accessToken  - Valid Zoho OAuth access token
 * @param {string} orgId        - Zoho organisation ID
 * @param {string} itemId       - Zoho item_id
 * @param {Buffer} imageBuffer  - Raw image bytes
 * @param {string} mimeType     - e.g. 'image/jpeg', 'image/png'
 * @returns {object}            - Zoho API response data
 */
async function uploadItemImage(accessToken, orgId, itemId, imageBuffer, mimeType) {
    const url = `${ZOHO_API_BASE}/inventory/v1/items/${itemId}/image`;

    const ext = mimeType.split('/')[1] || 'jpg';

    // Use Node 22 built-in FormData + Blob (no external dependency)
    const blob = new Blob([imageBuffer], { type: mimeType });
    const form = new globalThis.FormData();
    form.append('image', blob, `product.${ext}`);

    const authHeaders = buildHeaders(accessToken, orgId);
    // Do NOT set Content-Type manually — let fetch/axios set the multipart boundary
    const response = await axios.post(url, form, {
        headers: {
            'Authorization': authHeaders['Authorization'],
            'X-com-zoho-inventory-organizationid': authHeaders['X-com-zoho-inventory-organizationid']
        },
        params: { organization_id: orgId.trim() }
    });

    if (response.data.code !== 0) {
        throw new Error(`Zoho image upload error: ${response.data.message}`);
    }

    console.log(`[ZohoService] Image uploaded for item ${itemId}`);
    return response.data;
}

/**
 * Download an image from Zoho and save it to Firebase Storage for CDN serving.
 * @returns {string|null} The public Firebase Storage URL, or null on failure.
 */
async function cacheZohoImageToStorage(accessToken, orgId, itemId) {
    try {
        const url = `${ZOHO_API_BASE}/inventory/v1/items/${itemId}/image`;
        const response = await axios({
            method: 'GET',
            url: url,
            params: { organization_id: orgId.trim() },
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` },
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(response.data, 'binary');
        const bucket = getStorage().bucket();
        const file = bucket.file(`products/${itemId}.jpg`);

        await file.save(buffer, {
            metadata: {
                contentType: response.headers['content-type'] || 'image/jpeg',
                cacheControl: 'public, max-age=31536000'
            }
        });
        
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        console.log(`[ZohoService] Cached image for item ${itemId} to Storage`);
        return publicUrl;
    } catch (error) {
        if (error.response && error.response.status === 404) return null;
        console.error(`[ZohoService] Failed to cache image for item ${itemId}:`, error.message);
        return null;
    }
}

/**
 * Update the image URL in the Firestore cache for a given product.
 * Called after a successful Zoho image upload.
 */
async function updateProductImageInFirestore(itemId, orgId, accessToken) {
    const db = admin.firestore();
    // Cache the newly uploaded image to Firebase Storage CDN
    const imageUrl = await cacheZohoImageToStorage(accessToken, orgId, itemId);
    
    if (imageUrl) {
        await db.collection(PRODUCTS_COLLECTION).doc(itemId).update({
            imageUrl,
            syncedAt: Date.now()
        });
        console.log(`[ZohoService] Firestore image URL updated for item ${itemId}`);
    }
    return imageUrl;
}

/**
 * Normalise a Zoho item to a standard shape for product list view
 */
function normaliseItem(item) {
    const stock = parseFloat(item.available_stock || item.actual_available_stock || 0);
    return {
        id: item.item_id,
        name: item.name || item.item_name,
        sku: item.sku || '',
        description: item.description || '',
        unit: item.unit || 'pcs',
        rate: parseFloat(item.rate || 0),
        purchaseRate: parseFloat(item.purchase_rate || 0),
        stock: stock,
        stockStatus: getStockStatus(stock, item.reorder_level),
        // We no longer set imageUrl here blindly — syncProductsToFirestore will handle it
        imageUrl: null, 
        hasImage: !!(item.image_url || item.image_document_id),
        groupId: item.group_id || '',
        groupName: item.group_name || '',
        status: item.status || 'active',
        hsn: item.hsn_or_sac || '',
        taxId: item.tax_id || '',
        taxName: item.tax_name || '',
        taxPercentage: item.tax_percentage || 0,
        unit_id: item.unit_id || '',
        reorderLevel: parseFloat(item.reorder_level || 0),
        syncedAt: Date.now()
    };
}

/**
 * Normalise a single Zoho item detail (includes more fields)
 */
function normaliseItemDetail(item) {
    const base = normaliseItem(item);
    return {
        ...base,
        purchaseDescription: item.purchase_description || '',
        salesDescription: item.description || '',
        preferredVendor: item.preferred_vendors?.[0]?.vendor_name || '',
        warehouses: (item.warehouses || []).map(w => ({
            id: w.warehouse_id,
            name: w.warehouse_name,
            stock: parseFloat(w.warehouse_available_stock || 0)
        })),
        customFields: item.custom_fields || []
    };
}

/**
 * Determine stock status label from available stock
 */
function getStockStatus(available, reorderLevel) {
    if (available <= 0) return 'out_of_stock';
    if (reorderLevel && available <= reorderLevel) return 'low_stock';
    return 'in_stock';
}

/**
 * Sync all products into Firestore zoho_products collection
 * Returns count of products synced
 */
async function syncProductsToFirestore(accessToken, orgId) {
    const db = admin.firestore();
    const products = await fetchAllProducts(accessToken, orgId);

    const BATCH_SIZE = 400;
    let count = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = products.slice(i, i + BATCH_SIZE);

        for (const product of chunk) {
            const ref = db.collection(PRODUCTS_COLLECTION).doc(product.id);
            
            // Check if we need to cache the image
            // We fetch the current doc to see if we already have a valid Storage URL
            const docSnap = await ref.get();
            const existingData = docSnap.exists ? docSnap.data() : {};
            
            let finalImageUrl = existingData.imageUrl || null;
            
            // If the item has an image in Zoho but we don't have a storage URL yet (or we have the old proxy URL), cache it
            if (product.hasImage && (!finalImageUrl || finalImageUrl.includes('zohoGetImage'))) {
                finalImageUrl = await cacheZohoImageToStorage(accessToken, orgId, product.id);
            }

            product.imageUrl = finalImageUrl;
            delete product.hasImage; // Internal flag, no need to store in Firestore

            batch.set(ref, product, { merge: true });
            count++;
        }

        await batch.commit();
    }

    // Update sync metadata
    await db.collection('_system_cache').doc('zoho_sync_meta').set({
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        productCount: products.length,
        status: 'success'
    }, { merge: true });

    console.log(`[ZohoService] Synced ${count} products to Firestore`);
    return count;
}

module.exports = {
    getAccessToken,
    fetchAllProducts,
    fetchProductById,
    syncProductsToFirestore,
    uploadItemImage,
    updateProductImageInFirestore,
    cacheZohoImageToStorage,
    PRODUCTS_COLLECTION,
    ZOHO_ORG_ID
};

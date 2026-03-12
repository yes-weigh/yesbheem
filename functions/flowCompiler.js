const admin = require("firebase-admin");

let cachedCompiledFlows = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000;

/**
 * Validates and compiles flows into O(1) maps
 */
function compileFlows(flowsSnapshot) {
    const triggerCache = { keyword: {}, regex: {}, webhook: {} };
    const compiledFlowsMetadata = {};

    flowsSnapshot.docs.forEach(doc => {
        const flowId = doc.id;
        const flow = doc.data();

        const formatVersion = flow.formatVersion || 'v1_drawflow';
        const engineVersion = flow.engineVersion || 'v1';

        // Initialize metadata block
        compiledFlowsMetadata[flowId] = {
            flowId,
            name: flow.name || 'Untitled',
            formatVersion,
            engineVersion,
            compiledAt: Date.now(),
            valid: true,
            nodeMap: {},
            edgeLookupBySource: {},
            edgeLookupByTarget: {}
        };

        const meta = compiledFlowsMetadata[flowId];

        try {
            if (formatVersion === 'v1_drawflow') {
                const drawflowData = flow.drawflowData?.drawflow?.Home?.data;
                if (!drawflowData) {
                    meta.valid = false;
                    return;
                }

                // NodeMap setup
                meta.nodeMap = drawflowData;

                // Edge lookups and Triggers for v1
                Object.values(drawflowData).forEach(node => {
                    // Triggers
                    if (node.name === 'trigger') {
                        const config = node.data?.config || {};
                        if (config.type === 'keyword' && config.value) {
                            const normalized = config.value.toLowerCase().trim();
                            if (!triggerCache.keyword[normalized]) triggerCache.keyword[normalized] = [];
                            triggerCache.keyword[normalized].push({ flowId, startNodeId: node.id });
                        }
                    }

                    // Edges
                    meta.edgeLookupBySource[node.id] = [];
                    const outputs = node.outputs || {};
                    for (const outKey in outputs) {
                        const conns = outputs[outKey].connections || [];
                        for (const conn of conns) {
                            meta.edgeLookupBySource[node.id].push({ target: conn.node.toString(), handle: outKey });
                            
                            if (!meta.edgeLookupByTarget[conn.node]) meta.edgeLookupByTarget[conn.node] = [];
                            meta.edgeLookupByTarget[conn.node].push({ source: node.id.toString(), handle: outKey });
                        }
                    }
                });

            } else if (formatVersion === 'v2_xyflow') {
                const nodes = flow.nodes || [];
                const edges = flow.edges || [];

                if (!nodes.length) {
                    meta.valid = false;
                    return;
                }

                nodes.forEach(node => {
                    meta.nodeMap[node.id] = node;
                    meta.edgeLookupBySource[node.id] = [];
                    meta.edgeLookupByTarget[node.id] = [];

                    // Triggers
                    if (node.type === 'trigger') {
                        const config = node.data?.config || {};
                        if (config.type === 'keyword' && config.value) {
                            const normalized = config.value.toLowerCase().trim();
                            if (!triggerCache.keyword[normalized]) triggerCache.keyword[normalized] = [];
                            triggerCache.keyword[normalized].push({ flowId, startNodeId: node.id });
                        }
                    }
                });

                edges.forEach(edge => {
                    if (meta.edgeLookupBySource[edge.source]) {
                        meta.edgeLookupBySource[edge.source].push({ target: edge.target, handle: edge.sourceHandle });
                    }
                    if (meta.edgeLookupByTarget[edge.target]) {
                        meta.edgeLookupByTarget[edge.target].push({ source: edge.source, handle: edge.targetHandle });
                    }
                });
            }
        } catch (err) {
            console.error(`[Flow Compiler] Failed to compile flow ${flowId}:`, err);
            meta.valid = false;
        }
    });

    return {
        triggerCache,
        metadata: compiledFlowsMetadata
    };
}

/**
 * Gets compiled flows. Uses 60s TTL in memory caching.
 */
async function getCompiledFlows(db) {
    const now = Date.now();
    if (cachedCompiledFlows && (now - lastFetchTime < CACHE_TTL_MS)) {
        return cachedCompiledFlows;
    }

    console.log(`[Flow Compiler] Cache miss or TTL expired. Fetching fresh flows from Firestore...`);
    const flowsSnapshot = await db.collection('flows').where('enabled', '==', true).get();
    
    cachedCompiledFlows = compileFlows(flowsSnapshot);
    lastFetchTime = Date.now();

    console.log(`[Flow Compiler] Compilation complete.`);
    return cachedCompiledFlows;
}

/**
 * Returns a specific flow's compiled graph metadata by ID
 */
async function getCompiledFlowMeta(db, flowId) {
    const compiled = await getCompiledFlows(db);
    return compiled.metadata[flowId];
}

module.exports = {
    getCompiledFlows,
    getCompiledFlowMeta
};

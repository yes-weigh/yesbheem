const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Evaluate an inbound WhatsApp message against active flows.
 * @returns {Promise<boolean>} True if a flow was triggered and executed, false otherwise.
 */
async function evaluateFlows(messageData, chatId, crmPhone, leadPhone) {
    const msgText = (messageData.text || messageData.content?.text || messageData.content?.caption || messageData.body || '').toLowerCase().trim();
    if (!msgText) return false;

    const db = admin.firestore();

    try {
        console.log(`[Flow Engine] Analyzing inbound message from ${leadPhone} to ${crmPhone}: "${msgText}"`);

        // 1. Fetch all enabled flows
        const flowsSnapshot = await db.collection('flows').where('enabled', '==', true).get();
        if (flowsSnapshot.empty) {
            console.log(`[Flow Engine] No active flows found.`);
            return false;
        }

        // 2. Evaluate Triggers
        for (const flowDoc of flowsSnapshot.docs) {
            const flow = flowDoc.data();
            const drawflowData = flow.drawflowData?.drawflow?.Home?.data;
            if (!drawflowData) continue;

            // Find all trigger nodes in this flow
            const triggerNodes = Object.values(drawflowData).filter(node => node.name === 'trigger');

            for (const triggerNode of triggerNodes) {
                const config = triggerNode.data?.config || {};

                // Evaluate Keyword Match
                if (config.type === 'keyword' && config.value) {
                    const keyword = config.value.toLowerCase().trim();
                    if (msgText.includes(keyword)) {
                        console.log(`[Flow Engine] Flow '${flow.name}' triggered by keyword '${keyword}'`);

                        // Fire the flow execution
                        await executeFlowPath(drawflowData, triggerNode, { crmPhone, leadPhone, messageData, db, chatId });

                        // Return true to indicate a flow handled this message
                        return true;
                    }
                }
            }
        }

        console.log(`[Flow Engine] No flows matched criteria.`);
        return false;

    } catch (error) {
        console.error(`[Flow Engine] Error evaluating flows:`, error);
        return false;
    }
}

/**
 * Execute the nodes connected from the current node in the Drawflow JSON
 */
async function executeFlowPath(drawflowData, currentNode, context) {
    const outputs = currentNode.outputs || {};

    for (const outputKey in outputs) {
        const connections = outputs[outputKey].connections || [];
        for (const conn of connections) {
            const nextNodeId = conn.node;
            const nextNode = drawflowData[nextNodeId];

            if (nextNode) {
                await processNode(drawflowData, nextNode, context);
            }
        }
    }
}

/**
 * Process a specific node action (Action, Condition, AI, Wait)
 */
async function processNode(drawflowData, node, context) {
    const { crmPhone, leadPhone, messageData, db, chatId } = context;
    const config = node.data?.config || {};

    console.log(`[Flow Engine] Processing node: ${node.name} (ID: ${node.id})`);

    try {
        switch (node.name) {
            case 'action':
                if (config.type === 'send_message' && config.value) {
                    let text = config.value;
                    text = text.replace(/\{\{lead\.phone\}\}/g, leadPhone);
                    await sendWhatsAppAPI(crmPhone, leadPhone, text);
                } else if (config.type === 'update_crm') {
                    console.log(`[Flow Engine] CRM Update action:`, config.value);
                }
                break;

            case 'condition':
                // Simple placeholder logic: evaluates to true
                const conditionMet = true;

                if (conditionMet) {
                    const trueConnections = node.outputs?.output_1?.connections || [];
                    for (const conn of trueConnections) {
                        const nextNode = drawflowData[conn.node];
                        if (nextNode) await processNode(drawflowData, nextNode, context);
                    }
                } else {
                    const falseConnections = node.outputs?.output_2?.connections || [];
                    for (const conn of falseConnections) {
                        const nextNode = drawflowData[conn.node];
                        if (nextNode) await processNode(drawflowData, nextNode, context);
                    }
                }
                return; // Branches explicitly handled

            case 'wait':
                console.log(`[Flow Engine] Wait node execution requested. Delaying logic needed.`);
                break;

            case 'ai':
                console.log(`[Flow Engine] Custom AI Node execution requested.`);
                break;

            default:
                console.warn(`[Flow Engine] Unknown node type: ${node.name}`);
        }

        // Continue execution to the next connected nodes
        await executeFlowPath(drawflowData, node, context);

    } catch (error) {
        console.error(`[Flow Engine] Error processing node ${node.id}:`, error);
    }
}

/**
 * Call the YesBheem WhatsApp Backend API
 */
async function sendWhatsAppAPI(crmPhone, leadPhone, text) {
    const apiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3000';
    console.log(`[Flow Engine] Sending WA message to ${leadPhone} via ${apiUrl}`);

    try {
        const db = admin.firestore();
        // Fallback or exact match normalize
        const normalizeDigits = p => String(p || '').replace(/\D/g, '').slice(-10);
        const crmNorm10 = normalizeDigits(crmPhone);

        const instancesSnap = await db.collection('whatsapp_instances').get();
        let sessionId = '';

        instancesSnap.forEach(doc => {
            if (sessionId) return;
            const d = doc.data();
            const candidates = [d.phone, d.phoneNumber, d.additionalData?.phone, d.sessionId, doc.id];
            for (const c of candidates) {
                if (normalizeDigits(c) === crmNorm10) {
                    sessionId = d.sessionId || doc.id;
                    break;
                }
            }
        });

        if (!sessionId) {
            console.error(`[Flow Engine] Could not find session for CRM Phone ${crmPhone}`);
            return;
        }

        const response = await fetch(`${apiUrl}/api/messages/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessionId,
                to: leadPhone,
                text: text
            })
        });

        if (!response.ok) {
            console.error(`[Flow Engine] API request failed with status ${response.status}`);
        } else {
            console.log(`[Flow Engine] Successfully dispatched message via API.`);
        }
    } catch (err) {
        console.error(`[Flow Engine] Failed to dispatch API request:`, err);
    }
}

module.exports = {
    evaluateFlows
};

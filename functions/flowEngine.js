const admin = require("firebase-admin");
const { getCompiledFlows, getCompiledFlowMeta } = require('./flowCompiler');

if (!admin.apps.length) {
    admin.initializeApp();
}

const MAX_STEPS = 50;
const MAX_EXECUTION_MS = 15000;

/**
 * Evaluate an inbound WhatsApp message against active flows.
 * @returns {Promise<boolean>} True if a flow was triggered and executed, false otherwise.
 */
async function evaluateFlows(messageData, chatId, crmPhone, leadPhone) {
    const rawMsgText = messageData.text || messageData.content?.text || messageData.content?.caption || messageData.body || '';
    const msgText = rawMsgText.toLowerCase().trim();
    if (!msgText) return false;

    const db = admin.firestore();

    try {
        console.log(`[Flow Engine] Analyzing inbound message from ${leadPhone} to ${crmPhone}: "${msgText}"`);

        // 1. Fetch from Cache (O(1))
        const { triggerCache, metadata } = await getCompiledFlows(db);

        // 2. O(1) Search via Trigger Lookups
        // Note: For a robust system, we would iterate splits for keywords, but for exact match:
        let matchingTriggers = [];

        // Exact Keyword matching
        for (const [keyword, flows] of Object.entries(triggerCache.keyword)) {
            // "includes" allows substring matching if desired, matching old logic
            if (msgText.includes(keyword)) {
                matchingTriggers.push(...flows);
            }
        }

        if (matchingTriggers.length === 0) {
            console.log(`[Flow Engine] No compiled flows matched trigger criteria.`);
            return false;
        }

        console.log(`[Flow Engine] Found ${matchingTriggers.length} potential triggers.`);

        // 3. Setup Context and Execute First Match
        // Assuming we fire the first matched flow:
        const trigger = matchingTriggers[0];
        const flowMeta = metadata[trigger.flowId];

        if (!flowMeta || !flowMeta.valid) {
            console.warn(`[Flow Engine] Flow ${trigger.flowId} matched but graph metadata was marked invalid.`);
            return false;
        }

        console.log(`[Flow Engine] Initiating Flow '${flowMeta.name}' starting at node '${trigger.startNodeId}'`);

        const context = {
            crmPhone, 
            leadPhone, 
            messageData, 
            db, 
            chatId,
            simulationMode: false,
            executionId: db.collection('flow_executions').doc().id,
            // Protection Framework
            startTime: Date.now(),
            stepCount: 0,
            visitedNodes: new Set(),
            // Trace Data
            executionTrace: [],
            interceptedActions: []
        };

        // Inject the trigger execution mark
        context.executionTrace.push({ nodeId: trigger.startNodeId, type: 'trigger', status: 'executed' });

        await executeFlowPath(flowMeta, trigger.startNodeId, context);

        const durationMs = Date.now() - context.startTime;
        
        // Save execution log
        try {
            await db.collection('flow_executions').doc(context.executionId).set({
                flowId: trigger.flowId,
                status: 'SUCCESS',
                startedAt: new Date(context.startTime),
                durationMs,
                chatId,
                crmPhone,
                leadPhone,
                stepCount: context.stepCount,
                simulationMode: false,
            });

            // Save trace logs in subcollection
            const batch = db.batch();
            context.executionTrace.forEach((traceStep, index) => {
                const stepRef = db.collection('flow_executions').doc(context.executionId).collection('logs').doc(index.toString().padStart(4, '0'));
                batch.set(stepRef, traceStep);
            });
            await batch.commit();
        } catch (logErr) {
            console.error(`[Flow Engine] Failed to save execution log:`, logErr);
        }

        return true;

    } catch (error) {
        console.error(`[Flow Engine] Error evaluating flows:`, error);
        
        // Attempt to log failure if context.executionId exists
        if (msgText) { // just to have something in scope to check, but we need context if initialized
            try {
                // We'd need context accessible outside try block, but we'll leave basic catch for now.
            } catch (e) {}
        }
        return false;
    }
}

/**
 * Execute the nodes connected from the current node recursively or via stack.
 */
async function executeFlowPath(flowMeta, currentNodeId, context) {
    // 1. Runtime Protection Validations
    context.stepCount++;
    if (context.stepCount >= MAX_STEPS) {
        throw new Error(`[Flow Engine] MAX_STEPS exception: Infinite loop suspected.`);
    }

    if (Date.now() - context.startTime > MAX_EXECUTION_MS) {
        throw new Error(`[Flow Engine] MAX_EXECUTION_MS exception: Flow timeout.`);
    }

    // 2. Fetch O(1) Edge lookup resolution (Multiple Outgoing Edges)
    const outEdges = flowMeta.edgeLookupBySource[currentNodeId] || [];

    for (const edge of outEdges) {
        const nextNodeId = edge.target;
        
        // Loop protection
        if (context.visitedNodes.has(nextNodeId)) {
            console.warn(`[Flow Engine] Cyclic loop intercepted at Node ID ${nextNodeId}`);
            continue;
        }

        context.visitedNodes.add(nextNodeId);
        
        const nextNode = flowMeta.nodeMap[nextNodeId];
        if (!nextNode) continue;

        // 3. Process the Node Logic
        const continueBranch = await processNode(flowMeta, nextNode, context, edge.handle);

        // 4. Trace the execution
        const traceEntry = {
            nodeId: nextNodeId, 
            type: nextNode.type || nextNode.name || 'unknown',
            name: flowMeta.formatVersion === 'v1_drawflow' ? nextNode.name : nextNode.type,
            status: 'SUCCESS',
            durationMs: Date.now() - context.startTime // Cumulative or step duration. (Keeping cumulative for now for simplicity, or we can track step start time)
        };
        context.executionTrace.push(traceEntry);

        // Continue execution to the next connected nodes if requested
        if (continueBranch) {
            try {
                await executeFlowPath(flowMeta, nextNodeId, context);
            } catch (pathErr) {
                traceEntry.status = 'FAILED';
                traceEntry.error = pathErr.message;
                throw pathErr; // Re-throw to halt
            }
        }
    }
}

/**
 * Transforms v1 vs v2 definitions into unified variables, handles specific actions
 * @returns {Promise<boolean>} False if path traversal should halt for this branch
 */
async function processNode(flowMeta, node, context, incomingHandleKey) {
    const { crmPhone, leadPhone, simulationMode } = context;
    let config = {};
    let typeName = '';

    // Unified Abstraction Mapping
    if (flowMeta.formatVersion === 'v1_drawflow') {
        config = node.data?.config || {};
        typeName = node.name;
    } else { // v2_xyflow
        config = node.data?.config || {};
        // Use actionType from data, or standard type
        typeName = node.type;
        if (typeName === 'action' && node.data?.actionType) {
            typeName = node.data.actionType;
        } 
        if (typeName === 'condition' && node.data?.conditionType) {
            typeName = node.data.conditionType;
        }
    }

    // Process mapped config types
    try {
        switch (typeName) {
            case 'action':
            case 'send_message': {
                // v1 relies on `config.type === 'send_message'` under `node.name === 'action'`
                // v2 might just pass `typeName === 'send_message'` directly.
                if (config.type === 'send_message' || typeName === 'send_message') {
                    let text = config.value || '';
                    text = text.replace(/\{\{lead\.phone\}\}/g, leadPhone);

                    if (simulationMode) {
                        context.interceptedActions.push({ actionType: 'send_message', payload: { to: leadPhone, text }});
                    } else {
                        await sendWhatsAppAPI(crmPhone, leadPhone, text);
                    }
                }
                return true;
            }

            case 'condition': {
                // Condition nodes usually branch. We return false here and handle explicit next execution for the true/false paths if needed. 
                // Or simply evaluate all edges down true/false handles if edge handles exist.
                // In generic `executeFlowPath`, it loops over ALL outgoing edges. We should ideally only execute edges matching the condition.
                
                // For a proper structure, we return `false` indicating manual branching logic.
                const conditionMet = true; // Hardcoded placeholder true

                // To integrate with executeFlowPath, if this branch evaluation is dynamic, we explicitly execute the chosen branch edges here.
                const handleKeyToFollow = conditionMet ? (flowMeta.formatVersion === 'v1_drawflow' ? 'output_1' : 'true') 
                                                       : (flowMeta.formatVersion === 'v1_drawflow' ? 'output_2' : 'false');
                
                const outEdges = flowMeta.edgeLookupBySource[node.id] || [];
                for (const edge of outEdges) {
                    if (edge.handle === handleKeyToFollow) {
                        const targetNode = flowMeta.nodeMap[edge.target];
                        if (targetNode) {
                            if (!context.visitedNodes.has(targetNode.id)) {
                                context.visitedNodes.add(targetNode.id);
                                await processNode(flowMeta, targetNode, context, edge.handle);
                                await executeFlowPath(flowMeta, targetNode.id, context);
                            }
                        }
                    }
                }

                // Return false so executeFlowPath doesn't double-execute edges
                return false; 
            }

            case 'wait':
                if (simulationMode) {
                    context.interceptedActions.push({ actionType: 'wait', payload: config });
                } else {
                    console.log(`[Flow Engine] Wait logic not integrated with external delays yet.`);
                }
                return true;

            case 'ai':
            case 'crm_update':
                if (simulationMode) {
                    context.interceptedActions.push({ actionType: typeName, payload: config });
                }
                return true;

            default:
                if (!simulationMode) console.warn(`[Flow Engine] Unknown logical path type: ${typeName}`);
                return true;
        }

    } catch (error) {
        console.error(`[Flow Engine] Error processing node ${node.id || 'unknown'}:`, error);
        return false;
    }
}

/**
 * Dispatch API Request
 */
async function sendWhatsAppAPI(crmPhone, leadPhone, text) {
    const apiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3000';
    console.log(`[Flow Engine] Dispatching message to ${leadPhone} via ${apiUrl}`);

    try {
        const db = admin.firestore();
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
            console.error(`[Flow Engine] Dispatch failure. (HTTP ${response.status})`);
        }
    } catch (err) {
        console.error(`[Flow Engine] API dispatch error:`, err);
    }
}

/**
 * Isolated Simulation Entrypoint
 * Called by `/simulateFlow` HTTP cloud function
 */
async function simulateFlowExecution(flowId, messageData, crmPhone, leadPhone) {
    const db = admin.firestore();

    const { getCompiledFlowMeta } = require('./flowCompiler');
    const flowMeta = await getCompiledFlowMeta(db, flowId);

    if (!flowMeta || !flowMeta.valid) {
        return { success: false, error: 'Flow is completely invalid or compilation failed.' };
    }
    
    const executionId = db.collection('flow_executions').doc().id;

    const context = {
        crmPhone: crmPhone || 'simulation_crm',
        leadPhone: leadPhone || 'simulation_lead',
        messageData: messageData || { text: 'simulator trigger' },
        db,
        chatId: 'simulator_chat',
        simulationMode: true,
        executionId: executionId,
        startTime: Date.now(),
        stepCount: 0,
        visitedNodes: new Set(),
        executionTrace: [],
        interceptedActions: []
    };

    try {
        // Find simulation trigger entrypoints
        let triggerNodeId = null;
        for (const [id, node] of Object.entries(flowMeta.nodeMap)) {
            // Unify trigger lookup over varying struct formats
            if ((flowMeta.formatVersion === 'v1_drawflow' && node.name === 'trigger') ||
                (flowMeta.formatVersion !== 'v1_drawflow' && node.type === 'trigger')) {
                triggerNodeId = id;
                break;
            }
        }

        if (!triggerNodeId) {
            return { success: false, error: 'No trigger node present in graph.' };
        }

        context.executionTrace.push({ nodeId: triggerNodeId, type: 'trigger', status: 'SUCCESS', durationMs: 0 });
        
        // Let it run under constraints
        let success = true;
        let finalError = null;
        try {
            await executeFlowPath(flowMeta, triggerNodeId, context);
        } catch (execErr) {
            success = false;
            finalError = execErr.message;
        }

        const durationMs = Date.now() - context.startTime;

        // Save simulation log
        try {
            await db.collection('flow_executions').doc(context.executionId).set({
                flowId,
                status: success ? 'SUCCESS' : 'FAILED',
                startedAt: new Date(context.startTime),
                durationMs,
                stepCount: context.stepCount,
                simulationMode: true,
                error: finalError
            });

            const batch = db.batch();
            context.executionTrace.forEach((traceStep, index) => {
                const stepRef = db.collection('flow_executions').doc(context.executionId).collection('logs').doc(index.toString().padStart(4, '0'));
                batch.set(stepRef, traceStep);
            });
            await batch.commit();
        } catch (logErr) {
            console.error(`[Flow Engine] Failed to save simulation log:`, logErr);
        }

        if (!success) {
            return {
                success: false,
                error: finalError,
                executionTrace: context.executionTrace,
                interceptedActions: context.interceptedActions
            };
        }

        return {
            success: true,
            executionTrace: context.executionTrace,
            interceptedActions: context.interceptedActions,
            meta: {
                steps: context.stepCount,
                durationMs
            }
        };

    } catch (e) {
        return {
            success: false,
            error: e.message,
            executionTrace: context.executionTrace,
            interceptedActions: context.interceptedActions
        };
    }
}

module.exports = {
    evaluateFlows,
    simulateFlowExecution
};

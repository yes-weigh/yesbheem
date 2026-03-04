/**
 * Chatbot Controller
 * Manages the Yes Bheem AI assistant UI and the Gemini Cloud Function integration.
 *
 * Flow:
 *  1. User types a message → sent to `geminiChat` Cloud Function
 *  2. Cloud Function returns { type: 'text', reply } OR { type: 'function_call', name, args }
 *  3. For function_call: execute window.aiChatbotTools[name](args) on the client
 *  4. Send function result back to Gemini → get a natural-language confirmation reply
 */

class ChatbotController {
    constructor() {
        // Conversation history for multi-turn context (Gemini format)
        this._history = [];
        this._isThinking = false;

        // DOM refs (populated on init)
        this._messagesEl = null;
        this._inputEl = null;
        this._sendBtn = null;
        this._welcomeEl = null;

        // Firebase callable
        this._geminiChat = null;
    }

    // ─────────────────────────────────────────────────────────────
    // Initialisation
    // ─────────────────────────────────────────────────────────────

    async init() {
        this._messagesEl = document.getElementById('chatbot-messages');
        this._inputEl = document.getElementById('chatbot-input');
        this._sendBtn = document.getElementById('chatbot-send-btn');
        this._welcomeEl = document.getElementById('chatbot-welcome');

        if (!this._messagesEl || !this._inputEl || !this._sendBtn) {
            console.warn('[ChatbotController] Required DOM elements not found. Aborting init.');
            return;
        }

        // Set up Firebase callable — import app the same way other controllers do
        try {
            const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
            const configPath = `${basePath}js/services/firebase_config.js`.replace('//', '/');
            const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-functions.js');
            const { app } = await import(configPath);
            const functions = getFunctions(app, 'us-central1');
            this._geminiChat = httpsCallable(functions, 'geminiChat');
        } catch (err) {
            console.error('[ChatbotController] Firebase init failed:', err);
            return;
        }

        // Event listeners
        this._sendBtn.addEventListener('click', () => this._handleSend());
        this._inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
        });

        // Auto-resize textarea
        this._inputEl.addEventListener('input', () => {
            this._inputEl.style.height = 'auto';
            this._inputEl.style.height = Math.min(this._inputEl.scrollHeight, 120) + 'px';
        });

        // Clear button
        document.getElementById('chatbot-clear-btn')?.addEventListener('click', () => this._clearConversation());

        // Suggestion chips
        document.querySelectorAll('.chatbot-suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.dataset.prompt;
                if (prompt) {
                    this._inputEl.value = prompt;
                    this._handleSend();
                }
            });
        });

        console.log('[ChatbotController] Initialized.');
    }

    // ─────────────────────────────────────────────────────────────
    // Core Send Logic
    // ─────────────────────────────────────────────────────────────

    async _handleSend() {
        const text = this._inputEl.value.trim();
        if (!text || this._isThinking) return;

        this._hideWelcome();
        this._renderMessage('user', text);
        this._inputEl.value = '';
        this._inputEl.style.height = 'auto';
        this._setThinking(true);

        // Append to history
        this._history.push({ role: 'user', parts: [{ text }] });

        try {
            const result = await this._callGemini(text);
            await this._handleGeminiResult(result, text);
        } catch (err) {
            console.error('[ChatbotController] Error:', err);
            this._renderMessage('ai', `⚠️ Sorry, something went wrong: ${err.message}`, 'error-bubble');
        } finally {
            this._setThinking(false);
        }
    }

    /**
     * Call the Cloud Function.
     * Sends the full history MINUS the last message (already sent as userMessage).
     */
    async _callGemini(userMessage) {
        const historyToSend = this._history.slice(0, -1); // exclude the just-added user turn
        const response = await this._geminiChat({ history: historyToSend, userMessage });
        return response.data;
    }

    /**
     * Handle the Gemini response — either a plain text reply or a function-call intent.
     */
    async _handleGeminiResult(result, originalMessage) {
        if (result.type === 'text') {
            // Push model reply to history and render
            this._history.push({ role: 'model', parts: [{ text: result.reply }] });
            this._renderMessage('ai', result.reply);

        } else if (result.type === 'function_call') {
            await this._executeFunctionCall(result.name, result.args);

        } else {
            this._renderMessage('ai', "I'm not sure how to respond to that. Could you rephrase?");
        }
    }

    /**
     * Execute a tool call requested by Gemini, then send the result back for a natural reply.
     */
    async _executeFunctionCall(toolName, args) {
        // Show "thinking" status in UI
        this._renderFnStatusBubble(`⚙️ Running: ${this._humaniseTool(toolName)}…`);

        let toolResult;
        try {
            const tools = window.aiChatbotTools;
            if (!tools || typeof tools[toolName] !== 'function') {
                throw new Error(`Tool "${toolName}" is not available.`);
            }
            // Pass args as a single named object — tools destructure what they need
            toolResult = await tools[toolName](args || {});
        } catch (toolErr) {
            console.error(`[ChatbotController] Tool ${toolName} failed:`, toolErr);
            toolResult = { error: toolErr.message };
        }

        // Summarise results to avoid sending huge arrays to Gemini
        const summarised = this._summariseToolResult(toolName, toolResult);

        // Build the function-call turn in history (Gemini multi-turn format)
        this._history.push({
            role: 'model',
            parts: [{ functionCall: { name: toolName, args } }]
        });

        // Instead of a functionResponse part (which the Cloud Function doesn't support in its
        // simple text bridge), we add the tool result as a plain user message so Gemini can summarise it.
        const resultText = `Tool "${toolName}" returned: ${JSON.stringify(summarised)}. Please summarise this result for the user in a helpful, concise way.`;

        // Ask Gemini to produce a natural-language reply using the tool result
        this._setThinking(true);
        try {
            const followUp = await this._callGemini(resultText);
            await this._handleGeminiResult(followUp, resultText);
        } catch (err) {
            this._renderMessage('ai', `Done! But I had trouble summarising the result: ${err.message}`, 'error-bubble');
        } finally {
            this._setThinking(false);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers — Summarisation
    // ─────────────────────────────────────────────────────────────

    /**
     * Reduce tool results to a compact form before sending back to Gemini.
     * Prevents token bloat from large arrays.
     */
    _summariseToolResult(toolName, result) {
        if (result && result.error) return result;

        if (Array.isArray(result)) {
            if (result.length === 0) return { count: 0, items: [] };

            // For search results, return key fields only
            const sample = result.slice(0, 20).map(item => {
                if (toolName.includes('Dealer') || toolName === 'searchDealers') {
                    return {
                        id: item.id || item.customer_name,
                        name: item.customer_name || item.first_name,
                        sales: item.sales || item.total_sales || 0,
                        stage: item.dealer_stage,
                        district: item.district,
                        state: item.state,
                        kam: item.key_account_manager,
                        phone: item.mobile_phone
                    };
                }
                if (toolName.includes('Lead') || toolName === 'searchLeads') {
                    return {
                        id: item.id,
                        company: item.Company_Name,
                        contact: item.Contact_Person,
                        phone: item.Phone_Number,
                        status: item.Status,
                        district: item.District
                    };
                }
                if (toolName.includes('Template') || toolName === 'searchTemplates') {
                    return { id: item.id, name: item.name, status: item.status, language: item.language };
                }
                if (toolName.includes('Media') || toolName === 'searchMedia') {
                    return { id: item.id, name: item.name, category: item.category, url: item.url };
                }
                return item;
            });

            return { count: result.length, items: sample };
        }

        // Boolean / string / object — return as-is
        return result;
    }

    /** Make a tool name human-readable for the status bubble. */
    _humaniseTool(name) {
        const map = {
            searchDealers: 'searching dealers',
            getDealerDetails: 'loading dealer details',
            updateDealer: 'updating dealer',
            performBulkDealerAction: 'running bulk dealer action',
            searchLeads: 'searching B2B leads',
            getLeadDetails: 'loading lead details',
            createOrUpdateLead: 'saving lead',
            deleteLead: 'deleting lead',
            addLeadLog: 'adding CRM log',
            searchMedia: 'searching media',
            searchTemplates: 'searching templates',
            sendWhatsAppMessage: 'sending WhatsApp message',
            getChatHistory: 'fetching chat history',
            getDealerSales: 'fetching dealer sales'
        };
        return map[name] || name;
    }

    // ─────────────────────────────────────────────────────────────
    // UI Rendering
    // ─────────────────────────────────────────────────────────────

    _renderMessage(role, text, extraClass = '') {
        const wrapper = document.createElement('div');
        wrapper.className = `chat-message ${role}`;

        const icon = document.createElement('div');
        icon.className = 'msg-icon';
        icon.textContent = role === 'ai' ? '🤖' : '👤';

        const bubble = document.createElement('div');
        bubble.className = `msg-bubble ${extraClass}`.trim();
        bubble.textContent = text;

        wrapper.appendChild(icon);
        wrapper.appendChild(bubble);
        this._messagesEl.appendChild(wrapper);
        this._scrollToBottom();
    }

    _renderFnStatusBubble(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-message ai';
        wrapper.id = 'fn-status-bubble';

        const icon = document.createElement('div');
        icon.className = 'msg-icon';
        icon.textContent = '🤖';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble fn-call';
        bubble.textContent = text;

        wrapper.appendChild(icon);
        wrapper.appendChild(bubble);
        this._messagesEl.appendChild(wrapper);
        this._scrollToBottom();
    }

    _showTypingIndicator() {
        if (document.getElementById('typing-indicator')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-message ai';
        wrapper.id = 'typing-indicator';

        const icon = document.createElement('div');
        icon.className = 'msg-icon';
        icon.textContent = '🤖';

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            indicator.appendChild(dot);
        }

        wrapper.appendChild(icon);
        wrapper.appendChild(indicator);
        this._messagesEl.appendChild(wrapper);
        this._scrollToBottom();
    }

    _removeTypingIndicator() {
        document.getElementById('typing-indicator')?.remove();
    }

    _setThinking(thinking) {
        this._isThinking = thinking;
        this._sendBtn.disabled = thinking;

        if (thinking) {
            this._showTypingIndicator();
        } else {
            this._removeTypingIndicator();
            // Remove any function-call status bubble now that we have a real reply
            document.getElementById('fn-status-bubble')?.remove();
        }
    }

    _hideWelcome() {
        if (this._welcomeEl) {
            this._welcomeEl.style.display = 'none';
        }
    }

    _scrollToBottom() {
        requestAnimationFrame(() => {
            this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
        });
    }

    _clearConversation() {
        this._history = [];
        // Remove all messages except the welcome div
        const messages = this._messagesEl.querySelectorAll('.chat-message');
        messages.forEach(m => m.remove());
        if (this._welcomeEl) this._welcomeEl.style.display = '';
    }
}

// ── Bootstrap ──────────────────────────────────────────────────
// nav_controller calls the exported ChatbotController class and calls .init() on it.
window.ChatbotController = ChatbotController;

// Self-initialize only if we are not in the SPA shell
if (document.getElementById('chatbot-messages') && !window.navController) {
    const ctrl = new ChatbotController();
    ctrl.init();  // async — non-blocking
    window._chatbotCtrl = ctrl;
}

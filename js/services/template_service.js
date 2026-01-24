class TemplateService {
    constructor() {
        this.apiBase = (window.appConfig ? window.appConfig.apiUrl : '') + '/api';
    }

    async getSessions() {
        try {
            // Ensure Firebase is ready
            if (!window.firebaseContext) {
                console.warn('Firebase context missing');
                return [];
            }
            const { db } = window.firebaseContext;

            // Dynamic imports for SDK functions
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            const snapshot = await getDocs(collection(db, 'whatsapp_instances'));
            const sessions = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                sessions.push({
                    id: doc.id,
                    name: data.name || 'Unnamed Instance',
                    platform: 'WA',
                    phoneNumber: data.phoneNumber || data.id?.split(':')[0] || 'Unknown',
                    connected: true
                });
            });

            return sessions;

        } catch (e) {
            console.error('Service: Failed to load sessions from Firestore', e);
            return [];
        }
    }

    async getTemplates() {
        try {
            const res = await fetch(`${this.apiBase}/templates`);
            const data = await res.json();
            return data.data || [];
        } catch (e) {
            console.error('Service: Failed to load templates', e);
            throw e;
        }
    }

    async deleteTemplate(id) {
        await fetch(`${this.apiBase}/templates/${id}`, { method: 'DELETE' });
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${this.apiBase}/messages/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Upload failed');
        return data.url;
    }

    async saveTemplate(templateData, isUpdate = false) {
        const method = isUpdate ? 'PUT' : 'POST';
        const url = `${this.apiBase}/templates` + (isUpdate ? `/${templateData.id}` : '');

        // Ensure we send cleaner payload
        const payload = {
            name: templateData.name,
            type: templateData.type,
            content: templateData.content,
            language: templateData.language || null,
            category: templateData.category || null
        };

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    }

    async sendMessage(payload) {
        let endpoint = payload.type === 'text' ? '/messages/text' : '/messages/interactive';
        // Adjust body structure based on endpoint expectation
        // Text: { sessionId, to, text }
        // Interactive: { sessionId, to, content }

        let body = {
            sessionId: payload.sessionId,
            to: payload.to
        };

        if (payload.type === 'text') {
            body.text = payload.content.text;
        } else {
            body.content = payload.content;
            // Ensure type is allowed if backend needs it, but usually endpoint defines it
            if (payload.type) body.type = payload.type;
        }

        const res = await fetch(`${this.apiBase}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    }

    async translateText(text, targetLanguage) {
        if (!window.firebaseContext || !window.firebaseContext.functions) {
            throw new Error('Firebase Functions not initialized');
        }
        const { functions, httpsCallable } = window.firebaseContext;
        const translateFunc = httpsCallable(functions, 'translateText');

        try {
            const result = await translateFunc({ text, targetLanguage });
            return result.data.translatedText;
        } catch (e) {
            console.error('Translation failed:', e);
            throw e;
        }
    }

    async cloneTemplateToLanguage(templateId, targetLanguage) {
        // 1. Get original template
        // Since we don't have getTemplateById, we fetch all and find (or use existing loaded list if passed, but safer directly)
        // Optimization: If the caller has the object, they can pass it. But let's assume ID for robustness.
        const templates = await this.getTemplates();
        const original = templates.find(t => t.id === templateId);

        if (!original) throw new Error('Original template not found');

        // 2. Translate text content
        console.log('[cloneTemplateToLanguage] Original Content:', original.content);

        let newContent = original.content;
        // Deep copy to avoid mutating original in cache if we were using it there
        if (typeof newContent === 'object' && newContent !== null) {
            newContent = JSON.parse(JSON.stringify(newContent));
        }

        // HEURISTIC FIELD DETECTION
        // 1. Standard text
        if (typeof newContent === 'string') {
            console.log('Translating string content...');
            newContent = await this.translateText(newContent, targetLanguage);
        }
        // 2. Object with 'text'
        else if (newContent.text) {
            console.log('Translating content.text...');
            newContent.text = await this.translateText(newContent.text, targetLanguage);
        }
        // 3. Object with 'body' (Common in some WA templates or interactive)
        else if (newContent.body) {
            if (typeof newContent.body === 'string') {
                console.log('Translating content.body (string)...');
                newContent.body = await this.translateText(newContent.body, targetLanguage);
            } else if (newContent.body.text) {
                console.log('Translating content.body.text...');
                newContent.body.text = await this.translateText(newContent.body.text, targetLanguage);
            }
        }
        // 4. Object with 'caption' (Media templates)
        if (newContent.caption) {
            console.log('Translating content.caption...');
            newContent.caption = await this.translateText(newContent.caption, targetLanguage);
        }

        console.log('[cloneTemplateToLanguage] New Content:', newContent);

        // 3. Create new template payload
        const newTemplate = {
            ...original,
            name: `${original.name} - ${targetLanguage.toUpperCase()}`,
            language: targetLanguage,
            content: newContent,
            id: undefined // Backend should generate ID
        };

        // 4. Save
        return await this.saveTemplate(newTemplate);
    }

    async cloneTemplate(templateId, newName) {
        const templates = await this.getTemplates();
        const original = templates.find(t => t.id === templateId);

        if (!original) throw new Error('Original template not found');

        let newContent = original.content;
        if (typeof newContent === 'object' && newContent !== null) {
            newContent = JSON.parse(JSON.stringify(newContent));
        }

        const newTemplate = {
            ...original,
            name: newName,
            content: newContent,
            id: undefined
        };

        return await this.saveTemplate(newTemplate);
    }
}

window.TemplateService = TemplateService;

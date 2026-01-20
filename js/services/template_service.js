class TemplateService {
    constructor() {
        this.apiBase = (window.appConfig ? window.appConfig.apiUrl : '') + '/api';
    }

    async getSessions() {
        try {
            const res = await fetch(`${this.apiBase}/auth/sessions`);
            const data = await res.json();
            return (data.sessions || []).filter(s => s.connected);
        } catch (e) {
            console.error('Service: Failed to load sessions', e);
            throw e;
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
            content: templateData.content
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
}

window.TemplateService = TemplateService;

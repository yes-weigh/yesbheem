# Yes Bheem AI — Chatbot Upgrade Prompts

Copy and paste each prompt below to Antigravity one at a time.

---

## 🔧 Quick Fixes

```
Make the chatbot render markdown — bold text, bullet lists, and tables inside chat bubbles
```

```
Add a confirmation yes/no UI bubble before the chatbot sends any WhatsApp message or deletes any record
```

```
Fix getChatHistory in ai_chatbot_tools.js to use window.appConfig.apiUrl instead of the hardcoded Cloud Functions URL
```

---

## 🛠️ New Tools

```
Add a getDealerLogs tool to the chatbot so it can read a dealer's full CRM activity timeline and notes from Firestore
```

```
Add a getDistrictSummary tool that returns total sales and dealer count per Kerala district, so the chatbot can answer questions like which district is performing best
```

```
Add a getCampaigns tool so the chatbot can list, search, and show stats for WhatsApp campaigns
```

```
Add a createCampaign tool so the chatbot can build and launch a WhatsApp campaign from a filtered dealer or lead list
```

```
Add a getReports tool so the chatbot can enumerate available financial year reports by name
```

```
Add a navigateTo tool so the chatbot can navigate the SPA to any page (dealers, leads, media, templates, campaigns) when the user asks
```

---

## 🧠 AI & Context

```
Upgrade the chatbot to support parallel tool calls so Gemini can call multiple tools in a single turn, for example search dealers and get their chat history at the same time
```

```
Persist the chatbot conversation summary in localStorage so it remembers context when the user navigates between pages
```

```
Make the chatbot quick-action suggestion chips update dynamically based on which page the user is currently on
```

---

## 🚀 Biggest Upgrade (do this last)

```
Build a compound command system for the chatbot so it can automatically chain multiple tools in sequence. For example the command "Send the product launch template to all Active dealers in Thrissur" should: (1) call searchDealers filtered by stage and district, (2) show a confirmation list to the user, (3) loop sendWhatsAppMessage for each confirmed dealer
```

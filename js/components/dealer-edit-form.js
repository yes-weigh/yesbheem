export function renderDealerEditForm(dealerName, billingZip = '', shippingZip = '', rawData = {}, generalSettings = {}) {
    let fieldsHtml = '';

    // Fields to exclude from generic loop
    const excludeKeys = [
        'customer_name',
        'customer_id',
        'count',
        'sales',
        'sales_with_tax',
        'custom_fields_list',
        'currency_code',
        'branch_name',
        'shipping_state',
        'shipping_zipcode',
        'billing_zipcode',
        'district',
        'billing_state',
        'key_account_manager',
        'dealer_stage'
    ];

    // 1. Top Fields
    const topFieldMap = [
        { label: 'First Name', keys: ['first_name', 'first name', 'First Name'] },
        { label: 'Mobile Phone', keys: ['mobile_phone', 'mobile phone', 'phone', 'Mobile Phone'] },
        { label: 'Zip Code', keys: ['billing_zipcode'] }
    ];

    // 2. Bottom Fields
    const bottomFieldMap = [
        { label: 'District', keys: ['district'] },
        { label: 'State', keys: ['billing_state'] }
    ];

    const priorityFields = [];

    const renderFieldBlock = (map) => {
        let html = '';
        map.forEach(f => {
            let pKey = f.keys.find(k => rawData.hasOwnProperty(k));
            // District always shown if requested
            if (!pKey && f.keys.includes('district')) pKey = 'district';
            // State always shown if requested
            if (!pKey && f.keys.includes('billing_state')) pKey = 'billing_state';


            if (pKey) {
                priorityFields.push(pKey);
                const val = rawData[pKey] || '';
                const label = f.label;

                let inputHtml = `
                            <input type="text" 
                                   class="edit-field-input" 
                                   data-field="${pKey}" 
                                   value="${val}" 
                                   disabled
                                   style="flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding: 4px 0; border-radius: 4px; border: 1px solid transparent; background: transparent; color: white; font-size: 0.8rem; height: 26px; cursor: default;">
                        `;

                const pencilIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
                const loadingIcon = `<svg class="zip-loading-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none; animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path></svg>`;

                const isEditable = label !== 'State' && label !== 'District';
                const isZipCode = label === 'Zip Code';

                const editButton = isEditable ? `
                             <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit" data-field-type="${isZipCode ? 'zipcode' : 'text'}">
                                ${pencilIcon}
                             </button>
                             ${isZipCode ? loadingIcon : ''}` : '';

                html += `
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                 <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                                 ${inputHtml}
                                 ${editButton}
                            </div>
                        `;
            }
        });
        return html;
    };

    // Render Top Fields
    fieldsHtml += renderFieldBlock(topFieldMap);

    // 3. Dropdown Fields (Key Account Manager, Dealer Stage)
    const dropdowns = [
        { label: 'KAM', key: 'key_account_manager', options: generalSettings.key_accounts || [] },
        { label: 'Stage', key: 'dealer_stage', options: generalSettings.dealer_stages || [] }
    ];

    dropdowns.forEach(dd => {
        priorityFields.push(dd.key); // Add dropdown keys to priorityFields
        const val = rawData[dd.key] || '';
        const label = dd.label;

        let optionsHtml = `<option value="" ${val === '' ? 'selected' : ''}>Select...</option>`;
        dd.options.forEach(opt => {
            // Handle both object {name, phone} and string formats
            const optValue = typeof opt === 'object' ? opt.name : opt;
            const isSel = optValue === val ? 'selected' : '';
            optionsHtml += `<option value="${optValue}" ${isSel}>${optValue}</option>`;
        });

        let inputHtml = `
                    <select class="edit-field-input" 
                            data-field="${dd.key}" 
                            disabled
                            style="flex: 1; min-width: 0; padding: 4px 0; border-radius: 4px; border: 1px solid transparent; background: transparent; color: white; font-size: 0.8rem; height: 26px; cursor: default; appearance: none; -webkit-appearance: none;">
                        ${optionsHtml}
                    </select>
                `;

        const pencilIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

        const editButton = `
                     <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit" data-field-type="select">
                        ${pencilIcon}
                     </button>`;

        fieldsHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                         <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                         ${inputHtml}
                         ${editButton}
                    </div>
                `;
    });

    // 4. Generic Fields
    for (const [key, val] of Object.entries(rawData)) {
        if (excludeKeys.includes(key) || priorityFields.includes(key)) continue;

        let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        let value = (val !== null && val !== undefined) ? String(val) : '';
        value = value.replace(/"/g, '&quot;');

        let inputHtml = `
                <input type="text" 
                       class="edit-field-input" 
                       data-field="${key}" 
                       value="${value}" 
                       disabled
                       style="flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding: 4px 0; border-radius: 4px; border: 1px solid transparent; background: transparent; color: white; font-size: 0.8rem; height: 26px; cursor: default;">
            `;

        const pencilIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

        const editButton = `
                         <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit">
                            ${pencilIcon}
                         </button>`;

        fieldsHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                         <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                         ${inputHtml}
                         ${editButton}
                    </div>
                `;
    }

    // 5. Render Bottom Fields
    fieldsHtml += renderFieldBlock(bottomFieldMap);

    return `
            <div class="dealer-edit-form" data-dealer-name="${dealerName.replace(/"/g, '&quot;')}" onclick="event.stopPropagation()" style="background: rgba(15, 23, 42, 0.98); padding: 8px; margin: 4px 0 8px 0; border-radius: 6px; border: 1px solid var(--accent-color); box-shadow: 0 4px 12px rgba(0,0,0,0.4); width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">
                <div style="font-size: 0.8rem; color: var(--text-main); font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; display:flex; justify-content:space-between; align-items:center;">
                    <span>${dealerName}</span>
                    <button onclick="window.viewController.cancelEdit(this)" style="background: none; border: none; padding: 2px; cursor: pointer; color: var(--text-muted); opacity: 0.7; transition: opacity 0.2s;" title="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div style="max-height: 250px; overflow-y: auto; padding-right: 2px; margin-bottom: 8px;">
                    ${fieldsHtml}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button onclick="window.viewController.cancelEdit(this)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">Cancel</button>
                    <button onclick="window.viewController.saveDealerInfo('${dealerName.replace(/'/g, "\\'")}')" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; border: none; background: var(--accent-color); color: white; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s;">Save</button>
                </div>
            </div>
            </div>
            `;
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Auth
    const authContainer = document.getElementById('auth-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const forgotPasswordContainer = document.getElementById('forgot-password-container');
    const resetPasswordContainer = document.getElementById('reset-password-container');
    
    // Auth Toggles
    const toRegisterBtn = document.getElementById('to-register');
    const toLoginBtn = document.getElementById('to-login');
    const toForgotPasswordBtn = document.getElementById('to-forgot-password');
    const toLoginFromForgotBtn = document.getElementById('to-login-from-forgot');
    
    // Auth Forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    
    const logoutBtn = document.getElementById('logout-btn');
    const userNameDisplay = document.getElementById('user-name-display');
    const userAvatar = document.getElementById('user-avatar');
    const profileBtn = document.getElementById('profile-btn');

    // The login/signup screen must always look the same, regardless of any
    // theme/font a previously logged-in user picked. Call this whenever the
    // person is NOT inside the dashboard (initial load with no session, or logout).
    const resetAuthScreenStyling = () => {
        document.body.classList.remove('theme-light', 'theme-solarized', 'theme-midnight', 'theme-forest', 'theme-rose', 'theme-slate', 'theme-highcontrast', 'theme-nord');
        document.body.style.fontFamily = "'Inter', sans-serif";
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = '#f8fafc';
            Chart.defaults.font.family = "'Inter', sans-serif";
        }
    };

    // DOM Elements - Navigation & Views
    const navItems = document.querySelectorAll('#sidebar-nav .nav-item');
    const appViews = document.querySelectorAll('.app-view');
    const viewTitle = document.getElementById('view-title');

    // Dashboard Stats
    const statTotal = document.getElementById('stat-total');
    const statHighRisk = document.getElementById('stat-high-risk');
    const statMediumRisk = document.getElementById('stat-medium-risk');
    const statLowRisk = document.getElementById('stat-low-risk');
    const statCompleted = document.getElementById('stat-completed');
    const emptyState = document.getElementById('empty-state');
    const emptyAddBtn = document.getElementById('empty-add-btn');

    // Vendors View
    const vendorsTbody = document.getElementById('vendors-tbody');
    const searchInput = document.getElementById('search-vendors');
    const filterDropdownBtn = document.getElementById('filter-dropdown-btn');
    const filterDropdownMenu = document.getElementById('filter-dropdown-menu');
    const filterRisk = document.getElementById('filter-risk');
    const sortBy = document.getElementById('sort-by');
    const vendorsAddBtn = document.getElementById('vendors-add-btn');

    // Assessments View
    const assessmentsTbody = document.getElementById('assessments-tbody');

    // Vendor Detail View
    const vendorDetailView = document.getElementById('vendor-detail-view');
    const backToVendorsBtn = document.getElementById('back-to-vendors');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const publishReportBtn = document.getElementById('publish-report-btn');

    // Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelModalBtn = document.getElementById('cancel-modal');
    const vendorForm = document.getElementById('vendor-form');
    const modalTitle = document.getElementById('modal-title');
    const saveVendorBtn = document.getElementById('save-vendor-btn');

    // Profile Modal
    const profileModalOverlay = document.getElementById('profile-modal-overlay');
    const closeProfileModalBtn = document.getElementById('close-profile-modal');
    const cancelProfileModalBtn = document.getElementById('cancel-profile-modal');
    const profileForm = document.getElementById('profile-form');
    const profilePhotoUpload = document.getElementById('profile-photo-upload');
    const profileAvatarPreview = document.getElementById('profile-avatar-preview');
    
    // Custom Chart Builder
    const builderTitle = document.getElementById('builder-title');
    const builderType = document.getElementById('builder-type');
    const builderSource = document.getElementById('builder-source');
    const builderAddBtn = document.getElementById('builder-add-btn');
    const chartsGrid = document.getElementById('charts-grid');
    
    const toast = document.getElementById('toast');

    // State
    let currentUser = null;

    // Standardized TPRM vendor categories (used in the Add/Edit form and the
    // import mapping). Drawn from common third-party risk taxonomies covering
    // technology, professional services, data handling, and critical functions.
    const VENDOR_CATEGORIES = [
        'Software / SaaS',
        'Cloud / Infrastructure (IaaS/PaaS)',
        'Hardware / Equipment',
        'Managed IT Services',
        'Cybersecurity Services',
        'Data Processing / Analytics',
        'Payment Processing / FinTech',
        'Professional Services / Consulting',
        'Legal Services',
        'Financial / Accounting Services',
        'Marketing / Advertising',
        'Human Resources / Staffing',
        'Logistics / Supply Chain',
        'Manufacturing / Production',
        'Facilities / Physical Security',
        'Telecommunications',
        'Healthcare / Medical Services',
        'Research & Development',
        'Outsourcing / BPO',
        'Other'
    ];

    let vendors = [];
    let isEditing = false;
    let currentActiveVendorId = null;
    let vendorSelectMode = false;          // is the multi-select UI active
    let selectedVendorIds = new Set();     // ids of currently-selected vendors
    let getFilteredVendors = () => vendors; // returns current filtered list; reassigned in applyFiltersAndSort
    let selectedAssessmentQIndex = 0;      // which assigned questionnaire is open in the master-detail view
    let expandedScanRows = new Set();      // which scan-result accordions are currently expanded (preserved across re-renders)
    let riskChartInstance = null;
    let statusChartInstance = null;
    let tempPhotoUrl = null;
    let customCharts = [];
    let customChartInstances = {};

    // Helpers
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    };

    // ============================================================
    // Auth Helpers: user registry, hashing, validation
    //
    // NOTE on security: this app has no backend, so passwords cannot be
    // hashed with a real algorithm like bcrypt/Argon2id/scrypt as NIST
    // SP 800-63B recommends. We use a salted SHA-256 hash via the browser's
    // Web Crypto API, which is meaningfully better than storing plaintext,
    // but is NOT production-grade password storage. A real deployment of
    // this app would need a server-side auth system.
    // ============================================================

    const AUTH_SALT = 'tprm-app-static-salt-v1'; // static client-side salt (see note above)

    // Lightweight, non-cryptographic fallback hash for environments where
    // crypto.subtle is unavailable (e.g. opening index.html directly via
    // file:// in Chrome, which is not a secure context). This is weaker than
    // SHA-256 but keeps login/register functional everywhere. Real secure
    // contexts (https://, localhost, or a local server) use SHA-256 below.
    const fallbackHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
        }
        // Run a few extra mixing rounds so it's not a trivial single-pass hash
        let hex = (hash >>> 0).toString(16);
        for (let round = 0; round < 1000; round++) {
            let h2 = 0;
            const mixed = hex + str;
            for (let i = 0; i < mixed.length; i++) {
                h2 = (Math.imul(31, h2) + mixed.charCodeAt(i)) | 0;
            }
            hex = (h2 >>> 0).toString(16);
        }
        return 'fb_' + hex;
    };

    const hashPassword = async (password) => {
        if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
            try {
                const enc = new TextEncoder();
                const data = enc.encode(AUTH_SALT + password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (err) {
                console.warn('crypto.subtle.digest failed, falling back to local hash:', err);
                return fallbackHash(AUTH_SALT + password);
            }
        }
        console.warn('crypto.subtle is unavailable in this context (likely file:// — serve via a local server for stronger password hashing). Using fallback hash.');
        return fallbackHash(AUTH_SALT + password);
    };

    const getUsers = () => {
        try {
            return JSON.parse(localStorage.getItem('tprm_users')) || [];
        } catch {
            return [];
        }
    };

    const saveUsers = (users) => {
        localStorage.setItem('tprm_users', JSON.stringify(users));
    };

    const findUserByEmail = (email) => {
        const normalized = email.trim().toLowerCase();
        return getUsers().find(u => u.email.toLowerCase() === normalized) || null;
    };

    // RFC 5322-ish practical email check (covers the vast majority of real-world cases)
    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    };

    // Small blocklist of extremely common / breached passwords, per NIST's
    // blocklist screening recommendation. Not exhaustive — a real deployment
    // would check against a much larger breached-password database.
    const COMMON_WEAK_PASSWORDS = [
        'password', 'password1', 'password123', '12345678', '123456789',
        'qwerty123', 'letmein', 'welcome1', 'admin123', 'iloveyou',
        'abc12345', '11111111', 'passw0rd', 'monkey123', 'football1'
    ];

    // NIST SP 800-63B Rev.4 aligned: enforce length (8-64), no forced
    // composition rules, screen against common/weak passwords.
    const validatePassword = (password) => {
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long.' };
        }
        if (password.length > 64) {
            return { valid: false, message: 'Password must be 64 characters or fewer.' };
        }
        if (COMMON_WEAK_PASSWORDS.includes(password.toLowerCase())) {
            return { valid: false, message: 'This password is too common and easily guessed. Please choose another.' };
        }
        return { valid: true, message: '' };
    };

    const showFieldError = (inputEl, hintEl, message) => {
        if (inputEl) inputEl.classList.add('input-invalid');
        if (hintEl) {
            hintEl.textContent = message;
            hintEl.classList.remove('hidden', 'hint-success');
            hintEl.classList.add('hint-error');
        }
    };

    const clearFieldError = (inputEl, hintEl) => {
        if (inputEl) inputEl.classList.remove('input-invalid');
        if (hintEl) {
            hintEl.classList.add('hidden');
            hintEl.classList.remove('hint-error', 'hint-success');
        }
    };

    const showAuthError = (errorEl, message) => {
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    };

    const clearAuthError = (errorEl) => {
        if (!errorEl) return;
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
    };

    const getRiskClass = (risk) => {
        if (risk === 'High') return 'high';
        if (risk === 'Medium') return 'medium';
        if (risk === 'Low') return 'low';
        return 'pending';
    };

    const getScoreDisplay = (score, id = null) => {
        const idAttr = id ? `id="${id}"` : '';
        if (score === 'Pending') return `<span ${idAttr} class="score pending">Pending</span>`;
        if (score >= 80) return `<span ${idAttr} class="score good">${score}</span>`;
        if (score >= 60) return `<span ${idAttr} class="score avg">${score}</span>`;
        return `<span ${idAttr} class="score poor">${score}</span>`;
    };

    const getInherentRisk = (type, dataType) => {
        let score = 50; // Base score
        if (type === 'Software') score += 20;
        if (type === 'Hardware') score += 10;
        if (type === 'Consulting') score -= 10;
        
        if (dataType === 'PII' || dataType === 'PHI') score += 30;
        if (dataType === 'Financial') score += 20;
        if (dataType === 'None') score -= 20;
        
        return Math.min(Math.max(score, 0), 100);
    };

    // Navigation Logic
    const switchView = (targetViewId, title) => {
        // Hide all views
        appViews.forEach(view => view.classList.add('hidden'));
        
        // Remove active class from navs
        navItems.forEach(item => item.classList.remove('active'));
        
        // Show target view
        document.getElementById(targetViewId).classList.remove('hidden');
        
        // Update title
        viewTitle.textContent = title;

        // Set active nav
        const activeNav = document.querySelector(`.nav-item[data-view="${targetViewId}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Render specific view logic
        if (targetViewId === 'metrics-view') {
            updateCharts();
        }
        
        // Save state
        localStorage.setItem('tprm_current_view', targetViewId);
        localStorage.setItem('tprm_current_view_title', title);
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            const title = item.textContent.trim();
            switchView(viewId, title);
        });
    });

    backToVendorsBtn.addEventListener('click', () => {
        switchView('vendors-view', 'Vendors');
        currentActiveVendorId = null;
        localStorage.removeItem('tprm_active_vendor_id');
    });

    // Detail Tabs Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => {
                p.classList.add('hidden');
                p.classList.remove('active');
            });
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.remove('hidden');
                targetPane.classList.add('active');
            }
            
            // Save tab state
            localStorage.setItem('tprm_active_tab', targetId);

            if (targetId === 'tab-intake' && currentActiveVendorId) {
                renderAssessmentQuestionnaire(currentActiveVendorId);
            }
            if (targetId === 'tab-assessment' && currentActiveVendorId) {
                renderComplianceScanResults(currentActiveVendorId);
            }
            if (targetId === 'tab-documents' && currentActiveVendorId) {
                renderVendorDocuments();
            }
        });
    });

    // Modal Logic
    // Fills the vendor category dropdown from VENDOR_CATEGORIES. If the vendor
    // being edited has a category not in the standard list (e.g. a legacy
    // "Software" value or an imported custom one), it's added so it stays
    // selectable rather than silently lost.
    const populateCategoryDropdown = (selectedValue) => {
        const sel = document.getElementById('vendor-type');
        if (!sel) return;
        const cats = [...VENDOR_CATEGORIES];
        if (selectedValue && !cats.includes(selectedValue)) cats.unshift(selectedValue);
        sel.innerHTML = `<option value="">Select Category</option>` +
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
        if (selectedValue) sel.value = selectedValue;
    };

    const openModal = (vendorToEdit = null) => {
        isEditing = !!vendorToEdit;
        modalTitle.textContent = isEditing ? 'Edit Vendor' : 'Add Vendor';
        saveVendorBtn.textContent = isEditing ? 'Update Vendor' : 'Create Vendor';
        
        if (isEditing) {
            populateCategoryDropdown(vendorToEdit.type);
            document.getElementById('vendor-id').value = vendorToEdit.id;
            document.getElementById('vendor-name').value = vendorToEdit.name;
            document.getElementById('vendor-type').value = vendorToEdit.type;
            document.getElementById('vendor-data-type').value = vendorToEdit.dataType;
            document.getElementById('vendor-poc').value = vendorToEdit.poc;
            document.getElementById('vendor-assessor').value = vendorToEdit.assessor;
            document.getElementById('vendor-due-date').value = vendorToEdit.nextReview;
            document.getElementById('vendor-desc').value = vendorToEdit.description;
        } else {
            vendorForm.reset();
            populateCategoryDropdown('');
            document.getElementById('vendor-id').value = '';
            document.getElementById('vendor-assessor').value = currentUser.name;
        }
        
        modalOverlay.classList.remove('hidden');
    };

    const closeModal = () => modalOverlay.classList.add('hidden');

    if (vendorsAddBtn) vendorsAddBtn.addEventListener('click', () => openModal());
    emptyAddBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);

    // File Uploads Simulation
    const attachUploadListener = (inputId) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    showToast(`File "${e.target.files[0].name}" uploaded successfully!`);
                    // Reset input so same file can be uploaded again if needed
                    e.target.value = '';
                }
            });
        }
    };
    attachUploadListener('intake-upload');
    attachUploadListener('assessment-upload');

    window.handleIntakeUpload = () => {
        showToast('Intake template uploaded successfully! You can now send it to vendors.');
        localStorage.setItem('tprm_intake_uploaded', 'true');
        document.getElementById('intake-upload-status').style.display = 'block';
    };

    // Filter Dropdown Toggle
    if (filterDropdownBtn) {
        filterDropdownBtn.addEventListener('click', () => {
            filterDropdownMenu.classList.toggle('hidden');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterDropdownBtn.contains(e.target) && !filterDropdownMenu.contains(e.target)) {
                filterDropdownMenu.classList.add('hidden');
            }
        });
    }

    // Data Loaders
    const loadVendors = () => {
        const data = localStorage.getItem(`tprm_vendors_${currentUser.email}`);
        vendors = data ? JSON.parse(data) : [];
        
        // Add timestamp to old records for sorting
        vendors = vendors.map(v => ({
            ...v,
            createdAt: v.createdAt || Date.now()
        }));

        // Clean questionnaire artifacts (banner/header/number rows) that an
        // older import may have baked into a vendor's assigned questionnaires
        // and scan results. If a snapshot changes, drop the stale scan so a
        // re-run regenerates clean per-question analysis.
        vendors.forEach(v => {
            let snapshotChanged = false;
            if (Array.isArray(v.assessmentQuestionnaires)) {
                v.assessmentQuestionnaires.forEach(aq => {
                    if (aq.snapshot && Array.isArray(aq.snapshot.questions)) {
                        const before = aq.snapshot.questions.length;
                        aq.snapshot.questions = sanitizeQuestionnaireQuestions(aq.snapshot.questions);
                        if (aq.snapshot.questions.length !== before) snapshotChanged = true;
                    }
                });
            }
            if (v.activeAssessmentSnapshot && Array.isArray(v.activeAssessmentSnapshot.questions)) {
                const before = v.activeAssessmentSnapshot.questions.length;
                v.activeAssessmentSnapshot.questions = sanitizeQuestionnaireQuestions(v.activeAssessmentSnapshot.questions);
                if (v.activeAssessmentSnapshot.questions.length !== before) snapshotChanged = true;
            }
            // If the assigned questionnaire was cleaned, any prior scan is stale.
            if (snapshotChanged && v.complianceScan) {
                v.complianceScan = null;
            }
        });

        updateAllUI();
    };

    const saveVendors = () => {
        localStorage.setItem(`tprm_vendors_${currentUser.email}`, JSON.stringify(vendors));
        updateAllUI();
    };

    const updateAllUI = () => {
        updateDashboardStats();
        applyFiltersAndSort();
        renderAssessmentsList();
        if(!document.getElementById('metrics-view').classList.contains('hidden')) {
            updateCharts();
        }
    };

    const updateDashboardStats = () => {
        if (vendors.length === 0) {
            emptyState.classList.remove('hidden');
            statTotal.textContent = '0';
            statHighRisk.textContent = '0';
            statMediumRisk.textContent = '0';
            statLowRisk.textContent = '0';
            if (statCompleted) statCompleted.textContent = '0';
        } else {
            emptyState.classList.add('hidden');
            statTotal.textContent = vendors.length;
            statHighRisk.textContent = vendors.filter(v => v.risk === 'High').length;
            statMediumRisk.textContent = vendors.filter(v => v.risk === 'Medium').length;
            statLowRisk.textContent = vendors.filter(v => v.risk === 'Low').length;
            if (statCompleted) {
                statCompleted.textContent = vendors.filter(v => v.score !== 'Pending' && v.score !== undefined).length;
            }
        }
        renderDashboardSummary();
    };

    // Renders the Risk Distribution bar, Completion ring, and Upcoming Reviews
    // widgets on the main dashboard. Safe to call even if vendors is empty.
    const renderDashboardSummary = () => {
        const riskBar = document.getElementById('dashboard-risk-bar');
        const riskLegend = document.getElementById('dashboard-risk-legend');
        const ring = document.getElementById('dashboard-completion-ring');
        const ringPct = document.getElementById('dashboard-completion-pct');
        const completedCountEl = document.getElementById('dashboard-completed-count');
        const pendingCountEl = document.getElementById('dashboard-pending-count');
        const reviewsList = document.getElementById('dashboard-upcoming-reviews');
        if (!riskBar || !ring || !reviewsList) return;

        const total = vendors.length;
        const high = vendors.filter(v => v.risk === 'High').length;
        const medium = vendors.filter(v => v.risk === 'Medium').length;
        const low = vendors.filter(v => v.risk === 'Low').length;
        const pendingRisk = total - high - medium - low; // Pending / not yet rated

        // --- Risk Distribution Bar ---
        if (total === 0) {
            riskBar.innerHTML = `<span style="width:100%; background: rgba(255,255,255,0.08);"></span>`;
            riskLegend.innerHTML = `<p class="empty-mini-state" style="padding:0;">No vendor data yet.</p>`;
        } else {
            const seg = (count, color) => count > 0 ? `<span style="width:${(count/total*100)}%; background:${color};"></span>` : '';
            riskBar.innerHTML =
                seg(high, 'var(--danger)') +
                seg(medium, 'var(--warning)') +
                seg(low, 'var(--success)') +
                seg(pendingRisk, 'var(--neutral)');

            const legendItem = (label, count, color) => `
                <div class="legend-item">
                    <span class="legend-dot" style="background:${color};"></span>
                    ${label}: <strong style="color: var(--text-main);">${count}</strong>
                </div>`;
            riskLegend.innerHTML =
                legendItem('High', high, 'var(--danger)') +
                legendItem('Medium', medium, 'var(--warning)') +
                legendItem('Low', low, 'var(--success)') +
                (pendingRisk > 0 ? legendItem('Unrated', pendingRisk, 'var(--neutral)') : '');
        }

        // --- Completion Ring ---
        const completed = vendors.filter(v => v.score !== 'Pending' && v.score !== undefined).length;
        const pending = total - completed;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        ring.style.setProperty('--pct', `${pct}%`);
        ringPct.textContent = `${pct}%`;
        if (completedCountEl) completedCountEl.textContent = completed;
        if (pendingCountEl) pendingCountEl.textContent = pending;

        // --- Upcoming Reviews (next 5, soonest first, only future or today) ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = vendors
            .filter(v => v.nextReview && !isNaN(new Date(v.nextReview)))
            .map(v => ({ ...v, _date: new Date(v.nextReview) }))
            .filter(v => v._date >= today)
            .sort((a, b) => a._date - b._date)
            .slice(0, 5);

        if (upcoming.length === 0) {
            reviewsList.innerHTML = `<p class="empty-mini-state">No upcoming reviews scheduled.</p>`;
        } else {
            reviewsList.innerHTML = upcoming.map(v => {
                const daysAway = Math.ceil((v._date - today) / 86400000);
                const dayLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`;
                return `
                    <div class="upcoming-review-item">
                        <div>
                            <div class="review-vendor-name">${v.name}</div>
                            <div class="review-date">${v.nextReview}</div>
                        </div>
                        <span class="badge ${getRiskClass(v.risk)}" style="font-size: 0.7rem;">${dayLabel}</span>
                    </div>`;
            }).join('');
        }
    };

    // Vendors Table Logic
    const renderVendors = (vendorList) => {
        vendorsTbody.innerHTML = '';
        if(vendorList.length === 0) {
            vendorsTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No vendors found matching your criteria.</td></tr>`;
            return;
        }

        vendorList.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="vendor-checkbox-col ${vendorSelectMode ? '' : 'hidden'}">
                    <input type="checkbox" class="vendor-select-checkbox" data-id="${v.id}" ${selectedVendorIds.has(v.id) ? 'checked' : ''}>
                </td>
                <td>
                    <div style="font-weight: 600">${v.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">POC: ${v.poc}</div>
                </td>
                <td>
                    <div style="font-size: 0.9rem">${v.type}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">Data: ${v.dataType}</div>
                </td>
                <td><span class="badge ${getRiskClass(v.risk)}">${v.risk}</span></td>
                <td>${v.nextReview}</td>
                <td>${getScoreDisplay(v.score)}</td>
                <td>${v.assessor}</td>
                <td>
                    <button class="action-btn view-btn" data-id="${v.id}" style="margin-right: 0.5rem; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: var(--success);">View</button>
                    <button class="action-btn edit-btn" data-id="${v.id}" style="margin-right: 0.5rem;">Edit</button>
                    <button class="action-btn delete-vendor-btn" data-id="${v.id}" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: var(--danger);">Del</button>
                </td>
            `;
            vendorsTbody.appendChild(tr);
        });
        
        renderPortals(vendorList);
        attachTableEvents();
        attachVendorSelectEvents();
    };

    // Portals Table Logic
    const renderPortals = (vendorList) => {
        const portalsTbody = document.querySelector('#portals-table tbody');
        if (!portalsTbody) return;
        
        portalsTbody.innerHTML = '';
        if(vendorList.length === 0) {
            portalsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No vendors found.</td></tr>`;
            return;
        }

        vendorList.forEach(v => {
            const tr = document.createElement('tr');
            let status = 'Not Sent';
            let riskColor = 'var(--text-muted)';
            
            if (v.risk === 'Pending POC Response') {
                status = 'Pending Response';
                riskColor = 'var(--warning)';
            } else if (v.inherentRisk !== undefined && v.inherentRisk !== null) {
                status = 'Completed';
                riskColor = 'var(--success)';
            }
            
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600">${v.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">POC: ${v.poc}</div>
                </td>
                <td>${v.risk !== 'Pending' ? 'Yes' : 'No'}</td>
                <td><span style="color: ${riskColor}; font-weight: bold;">${status}</span></td>
                <td>${v.inherentRisk !== undefined ? v.inherentRisk : '-'}</td>
                <td>
                    <button class="action-btn portal-access-btn" data-id="${v.id}" style="margin-right: 0.5rem; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: var(--success);">Open Portal</button>
                </td>
            `;
            portalsTbody.appendChild(tr);
        });
    };

    // Assessments Table Logic
    const renderAssessmentsList = () => {
        assessmentsTbody.innerHTML = '';
        if(vendors.length === 0) {
            assessmentsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No assessments active.</td></tr>`;
            return;
        }

        // Sort by due date closest first
        const sorted = [...vendors].sort((a,b) => new Date(a.nextReview) - new Date(b.nextReview));

        sorted.forEach(v => {
            const status = v.score === 'Pending' ? '<span style="color: var(--warning);">Pending Review</span>' : '<span style="color: var(--success);">Completed</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600">${v.name}</td>
                <td>${status}</td>
                <td>${getScoreDisplay(v.score)}</td>
                <td>${v.nextReview}</td>
                <td>${v.assessor}</td>
                <td>
                    <button class="action-btn view-btn" data-id="${v.id}" style="background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); color: var(--primary);">Assess</button>
                </td>
            `;
            assessmentsTbody.appendChild(tr);
        });

        document.querySelectorAll('#assessments-tbody .view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                openVendorDetail(id);
                // Switch tab to Assessment immediately
                tabBtns[1].click(); 
            });
        });
    };

    const applyFiltersAndSort = () => {
        const term = searchInput.value.toLowerCase();
        const riskFilter = filterRisk.value;
        const sortVal = sortBy.value;

        // Filter
        let filtered = vendors.filter(v => {
            const matchesSearch = v.name.toLowerCase().includes(term) || 
                                  v.assessor.toLowerCase().includes(term) ||
                                  v.type.toLowerCase().includes(term);
            const matchesRisk = riskFilter === 'All' || v.risk === riskFilter;
            return matchesSearch && matchesRisk;
        });

        // Sort
        filtered.sort((a, b) => {
            if (sortVal === 'name_asc') return a.name.localeCompare(b.name);
            if (sortVal === 'name_desc') return b.name.localeCompare(a.name);
            if (sortVal === 'date_asc') return new Date(a.nextReview) - new Date(b.nextReview);
            if (sortVal === 'date_desc') return new Date(b.nextReview) - new Date(a.nextReview);
            if (sortVal === 'risk') {
                const riskVal = {'High': 3, 'Medium': 2, 'Low': 1, 'Pending': 0};
                return riskVal[b.risk] - riskVal[a.risk];
            }
            return 0;
        });

        renderVendors(filtered);
        getFilteredVendors = () => filtered;
    };

    searchInput.addEventListener('input', applyFiltersAndSort);
    filterRisk.addEventListener('change', applyFiltersAndSort);
    sortBy.addEventListener('change', applyFiltersAndSort);

    const attachTableEvents = () => {
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const vendor = vendors.find(v => v.id == id);
                if (vendor) openModal(vendor);
            });
        });

        document.querySelectorAll('.delete-vendor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this vendor?')) {
                    vendors = vendors.filter(v => v.id != id);
                    saveVendors();
                    showToast('Vendor deleted successfully');
                }
            });
        });

        document.querySelectorAll('#vendors-tbody .view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                openVendorDetail(id);
            });
        });

        document.querySelectorAll('.portal-access-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const vendor = vendors.find(v => v.id == id);
                if (!vendor) return;
                
                document.getElementById('intake-portal-view').classList.remove('hidden');
                document.getElementById('portal-vendor-name').textContent = vendor.name;
                
                const qs = JSON.parse(localStorage.getItem('tprm_intake_questions') || 'null') || [
                    "1. Does this vendor handle PII, PHI, or highly sensitive financial data?",
                    "2. Is the service cloud-hosted or SaaS?",
                    "3. Does the vendor integrate directly with internal critical systems?",
                    "4. Does the vendor provide a critical business function (high availability required)?"
                ];
                
                const container = document.getElementById('portal-questions-container');
                container.innerHTML = qs.map((q, i) => `
                    <div class="input-group">
                        <label>${q}</label>
                        <select id="portal-q${i+1}" class="select-input" required>
                            <option value="">Select...</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                `).join('');
                
                // Pre-fill answers if already submitted
                if (vendor.intakeAnswers && vendor.intakeAnswers.length > 0) {
                    vendor.intakeAnswers.forEach((ans, i) => {
                        const selectEl = document.getElementById(`portal-q${i+1}`);
                        if (selectEl) selectEl.value = ans;
                    });
                }
                
                document.getElementById('portal-intake-form').setAttribute('data-vendor-id', vendor.id);
            });
        });
    };

    // ===== Vendor multi-select (Select → choose → Delete/Export) =====
    const updateBulkBar = () => {
        const countEl = document.getElementById('vendors-selected-count');
        if (countEl) countEl.textContent = `${selectedVendorIds.size} selected`;
        const selectAll = document.getElementById('vendors-select-all');
        if (selectAll) {
            const visible = getFilteredVendors().map(v => v.id);
            selectAll.checked = visible.length > 0 && visible.every(id => selectedVendorIds.has(id));
        }
    };

    const attachVendorSelectEvents = () => {
        document.querySelectorAll('.vendor-select-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                // ids are numeric in storage; normalize by matching loosely
                const realId = vendors.find(v => v.id == id)?.id;
                if (e.target.checked) selectedVendorIds.add(realId);
                else selectedVendorIds.delete(realId);
                updateBulkBar();
            });
        });
    };

    // Returns the vendors currently visible under the active filter/sort.
    // (Assigned inside applyFiltersAndSort; declared with top-level state.)

    const setVendorSelectMode = (on) => {
        vendorSelectMode = on;
        if (!on) selectedVendorIds.clear();
        document.querySelectorAll('.vendor-checkbox-col').forEach(el => el.classList.toggle('hidden', !on));
        const bar = document.getElementById('vendors-bulk-bar');
        if (bar) bar.classList.toggle('hidden', !on);
        const selBtn = document.getElementById('vendors-select-btn');
        if (selBtn) {
            selBtn.textContent = on ? 'Cancel' : 'Select';
            selBtn.classList.toggle('primary-btn', on);
            selBtn.classList.toggle('secondary-btn', !on);
        }
        applyFiltersAndSort();
        updateBulkBar();
    };

    const vendorsSelectBtn = document.getElementById('vendors-select-btn');
    if (vendorsSelectBtn) vendorsSelectBtn.addEventListener('click', () => setVendorSelectMode(!vendorSelectMode));

    const selectAllCb = document.getElementById('vendors-select-all');
    if (selectAllCb) selectAllCb.addEventListener('change', (e) => {
        const visible = getFilteredVendors();
        if (e.target.checked) visible.forEach(v => selectedVendorIds.add(v.id));
        else visible.forEach(v => selectedVendorIds.delete(v.id));
        applyFiltersAndSort();
        updateBulkBar();
    });

    const bulkDeleteBtn = document.getElementById('vendors-bulk-delete-btn');
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', () => {
        if (selectedVendorIds.size === 0) { showToast('No vendors selected.'); return; }
        if (!confirm(`Delete ${selectedVendorIds.size} selected vendor(s)? This cannot be undone.`)) return;
        vendors = vendors.filter(v => !selectedVendorIds.has(v.id));
        saveVendors();
        showToast(`${selectedVendorIds.size} vendor(s) deleted.`);
        setVendorSelectMode(false);
    });

    const bulkExportBtn = document.getElementById('vendors-bulk-export-btn');
    if (bulkExportBtn) bulkExportBtn.addEventListener('click', () => {
        if (selectedVendorIds.size === 0) { showToast('No vendors selected.'); return; }
        const selected = vendors.filter(v => selectedVendorIds.has(v.id));
        exportVendorsToCsv(selected, 'selected_vendors_export.csv');
        showToast(`Exported ${selected.length} vendor(s).`);
    });

    // Detail View Logic
    const openVendorDetail = (vendorId) => {
        const vendor = vendors.find(v => v.id == vendorId);
        if (!vendor) return;
        currentActiveVendorId = vendorId;
        
        localStorage.setItem('tprm_active_vendor_id', vendorId);
        localStorage.setItem('tprm_current_view', 'vendor-detail-view');

        appViews.forEach(view => view.classList.add('hidden'));
        vendorDetailView.classList.remove('hidden');
        viewTitle.textContent = `Vendor: ${vendor.name}`;

        // Restore tab state
        const savedTab = localStorage.getItem('tprm_active_tab');
        if (savedTab) {
            const btn = document.querySelector(`.tab-btn[data-target="${savedTab}"]`);
            if (btn) btn.click();
        } else {
            const defaultBtn = document.querySelector('.tab-btn[data-target="tab-overview"]');
            if (defaultBtn) defaultBtn.click();
        }

        // Populate Header
        document.getElementById('detail-vendor-name').textContent = vendor.name;
        document.getElementById('detail-risk-badge').className = `badge ${getRiskClass(vendor.risk)}`;
        document.getElementById('detail-risk-badge').textContent = vendor.risk;
        // Detail score will show Residual Risk if assessment is done
        const displayScore = vendor.score === 'Pending' ? 'Pending' : (vendor.residualRisk !== undefined ? vendor.residualRisk : vendor.score);
        document.getElementById('detail-score').outerHTML = getScoreDisplay(displayScore, 'detail-score');

        // Populate Overview
        document.getElementById('ov-type').textContent = vendor.type;
        document.getElementById('ov-data').textContent = vendor.dataType;
        document.getElementById('ov-poc').textContent = vendor.poc;
        document.getElementById('ov-assessor').textContent = vendor.assessor;
        document.getElementById('ov-due').textContent = vendor.nextReview;
        document.getElementById('ov-desc').textContent = vendor.description;
        
        // Intake Tab Setup
        if (!vendor.inherentRisk && vendor.inherentRisk !== 0) {
            document.getElementById('intake-pending-section').classList.remove('hidden');
            document.getElementById('intake-completed-section').classList.add('hidden');
            
            const recallBtn = document.getElementById('recall-email-btn');
            const pText = document.querySelector('#intake-pending-section p');
            
            if (vendor.risk === 'Pending POC Response') {
                if (pText) pText.textContent = 'Intake Questionnaire has been sent to the Business POC. Waiting for response...';
                document.getElementById('send-intake-btn').classList.add('hidden');
                document.getElementById('fill-intake-btn').classList.add('hidden');
                if (recallBtn) recallBtn.classList.remove('hidden');
            } else {
                if (pText) pText.textContent = 'The intake questionnaire must be completed to determine the vendor\'s Inherent Risk.';
                document.getElementById('send-intake-btn').classList.remove('hidden');
                document.getElementById('fill-intake-btn').classList.remove('hidden');
                if (recallBtn) recallBtn.classList.add('hidden');
            }
        } else {
            document.getElementById('intake-pending-section').classList.add('hidden');
            document.getElementById('intake-completed-section').classList.remove('hidden');
            document.getElementById('intake-calculated-score').textContent = vendor.inherentRisk;
            
            const explanationEl = document.getElementById('intake-score-explanation');
            if (explanationEl) {
                explanationEl.textContent = vendor.scoreExplanation || 'Explanation not available for older submissions.';
            }
            
            // Render answers
            const ansDiv = document.getElementById('intake-answers-breakdown');
            ansDiv.innerHTML = '';
            if (vendor.intakeAnswers) {
                let qs = vendor.activeQuestionnaireSnapshot ? vendor.activeQuestionnaireSnapshot.questions : [
                    "1. Does this vendor handle PII, PHI, or highly sensitive financial data?",
                    "2. Is the service cloud-hosted or SaaS?",
                    "3. Does the vendor integrate directly with internal critical systems?",
                    "4. Does the vendor provide a critical business function (high availability required)?"
                ];
                vendor.intakeAnswers.forEach((ans, i) => {
                    ansDiv.innerHTML += `
                        <div class="input-group full-width" style="margin-bottom: 0.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--glass-border);">
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Q${i+1}: ${qs[i]}</p>
                            <p style="color: white; font-weight: 500; font-size: 1rem;">Answer: <span style="color: ${ans==='yes'?'var(--danger)':'var(--success)'}; text-transform: capitalize;">${ans}</span></p>
                        </div>
                    `;
                });
            }
        }

        // Report Tab Setup
        const inherent = vendor.inherentRisk !== undefined ? vendor.inherentRisk : getInherentRisk(vendor.type, vendor.dataType);
        document.getElementById('report-inherent-score').textContent = inherent;
        
        const updateResidual = () => {
            let val = parseInt(document.getElementById('final-score-input').value) || 0;
            if(val > 100) val = 100;
            if(val < 0) val = 0;
            const res = Math.round(inherent * (1 - (val / 100)));
            document.getElementById('report-residual-score').textContent = res;
            return res;
        };
        
        const finalScoreInput = document.getElementById('final-score-input');
        finalScoreInput.value = vendor.score !== 'Pending' ? vendor.score : '';
        updateResidual();
        finalScoreInput.oninput = updateResidual;
        
        tabBtns[0].click();
    };

    publishReportBtn.addEventListener('click', () => {
        if (!currentActiveVendorId) return;
        
        const finalRisk = document.getElementById('final-risk-select').value;
        let finalScore = document.getElementById('final-score-input').value;
        let residualRisk = 'Pending';
        
        if(finalScore === '') {
            finalScore = 'Pending';
        } else {
            finalScore = parseInt(finalScore) || 0;
            if(finalScore > 100) finalScore = 100;
            if(finalScore < 0) finalScore = 0;
            
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            const inherent = vendor.inherentRisk || getInherentRisk(vendor.type, vendor.dataType);
            residualRisk = Math.round(inherent * (1 - (finalScore / 100)));
        }
        
        const index = vendors.findIndex(v => v.id == currentActiveVendorId);
        if (index !== -1) {
            vendors[index].risk = finalRisk;
            vendors[index].score = finalScore;
            vendors[index].residualRisk = residualRisk;
            saveVendors();
            showToast('Assessment Report Published!');
            openVendorDetail(currentActiveVendorId); 
        }
    });

    // Form Submission
    // Duplicate Detection Logic
    let pendingDuplicateVendor = null;
    const dupModalOverlay = document.getElementById('duplicate-modal-overlay');
    const dupVendorName = document.getElementById('duplicate-vendor-name');
    const dupMergeBtn = document.getElementById('dup-merge-btn');
    const dupKeepBtn = document.getElementById('dup-keep-btn');
    const dupCancelBtn = document.getElementById('dup-cancel-btn');

    const handlePendingVendorAction = (action) => {
        if (!pendingDuplicateVendor) return;
        
        if (action === 'merge') {
            const index = vendors.findIndex(v => v.name.toLowerCase() === pendingDuplicateVendor.name.toLowerCase());
            if (index !== -1) {
                // Merge by updating the existing vendor with new fields
                vendors[index] = { ...vendors[index], ...pendingDuplicateVendor, id: vendors[index].id, createdAt: vendors[index].createdAt };
                showToast('Vendor merged successfully');
            }
        } else if (action === 'keep') {
            vendors.push(pendingDuplicateVendor);
            showToast('Duplicate vendor added');
        } else {
            showToast('Vendor creation cancelled');
        }
        
        saveVendors();
        dupModalOverlay.classList.add('hidden');
        closeModal();
        pendingDuplicateVendor = null;
    };

    if(dupMergeBtn) dupMergeBtn.addEventListener('click', () => handlePendingVendorAction('merge'));
    if(dupKeepBtn) dupKeepBtn.addEventListener('click', () => handlePendingVendorAction('keep'));
    if(dupCancelBtn) dupCancelBtn.addEventListener('click', () => handlePendingVendorAction('cancel'));

    vendorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const idInput = document.getElementById('vendor-id').value;
        const name = document.getElementById('vendor-name').value;
        const type = document.getElementById('vendor-type').value;
        const dataType = document.getElementById('vendor-data-type').value;
        const poc = document.getElementById('vendor-poc').value;
        const assessor = document.getElementById('vendor-assessor').value;
        const nextReview = document.getElementById('vendor-due-date').value;
        const description = document.getElementById('vendor-desc').value;
        const inherentRisk = getInherentRisk(type, dataType);

        if (isEditing && idInput) {
            const index = vendors.findIndex(v => v.id == idInput);
            if (index !== -1) {
                vendors[index] = {
                    ...vendors[index],
                    name, type, dataType, poc, assessor, nextReview, description, inherentRisk
                };
                showToast('Vendor updated successfully');
                saveVendors();
                closeModal();
            }
        } else {
            const newVendor = {
                id: Date.now().toString(),
                createdAt: Date.now(),
                name, type, dataType, poc, description, assessor, nextReview,
                risk: 'Pending',
                score: 'Pending'
            };

            const isDuplicate = vendors.some(v => v.name.toLowerCase() === name.toLowerCase());
            if (isDuplicate) {
                pendingDuplicateVendor = newVendor;
                dupVendorName.textContent = name;
                dupModalOverlay.classList.remove('hidden');
                return; // Wait for user decision
            }

            vendors.push(newVendor);
            showToast('Vendor added successfully');
            saveVendors();
            closeModal();
        }
    });

    // Chart.js Logic
    const updateCharts = () => {
        const riskCtx = document.getElementById('riskChart');
        const statusCtx = document.getElementById('statusChart');
        
        if(!riskCtx || !statusCtx) return;

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js failed to load — charts cannot be rendered. Check your internet connection.');
            return;
        }

        // Destroy existing to prevent hover glitch
        if (riskChartInstance) riskChartInstance.destroy();
        if (statusChartInstance) statusChartInstance.destroy();

        const high = vendors.filter(v => v.risk === 'High').length;
        const med = vendors.filter(v => v.risk === 'Medium').length;
        const low = vendors.filter(v => v.risk === 'Low').length;
        const pendingRisk = vendors.filter(v => v.risk === 'Pending').length;

        riskChartInstance = new Chart(riskCtx, {
            type: 'doughnut',
            data: {
                labels: ['High Risk', 'Medium Risk', 'Low Risk', 'Pending'],
                datasets: [{
                    data: [high, med, low, pendingRisk],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#94a3b8'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#f8fafc' } }
                }
            }
        });

        const completed = vendors.filter(v => v.score !== 'Pending').length;
        const pendingStatus = vendors.filter(v => v.score === 'Pending').length;

        statusChartInstance = new Chart(statusCtx, {
            type: 'bar',
            data: {
                labels: ['Completed Assessments', 'Pending Reviews'],
                datasets: [{
                    label: 'Vendors',
                    data: [completed, pendingStatus],
                    backgroundColor: ['#3b82f6', '#94a3b8'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#f8fafc' }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
        
        renderCustomCharts();
    };

    // Custom Metrics Builder Logic
    const loadCustomCharts = () => {
        const stored = localStorage.getItem(`tprm_custom_charts_${currentUser.email}`);
        customCharts = stored ? JSON.parse(stored) : [];
    };

    const saveCustomCharts = () => {
        localStorage.setItem(`tprm_custom_charts_${currentUser.email}`, JSON.stringify(customCharts));
    };

    if (builderAddBtn) {
        builderAddBtn.addEventListener('click', () => {
            const title = builderTitle.value.trim() || 'Custom Chart';
            const type = builderType.value;
            const source = builderSource.value;
            const yAxis = document.getElementById('builder-y-axis') ? document.getElementById('builder-y-axis').value : 'count';
            
            customCharts.push({ id: Date.now().toString(), title, type, source, yAxis });
            saveCustomCharts();
            builderTitle.value = '';
            renderCustomCharts();
            showToast('Custom chart created!');
        });
    }

    // ============================================================
    // Reporting Schema generator (Metrics view)
    //
    // For each TPRM metric category, produces: a copyable data table, the
    // prescribed chart type + rationale, and executive insights — following
    // the strict charting standards:
    //   Component/categorical breakdown -> Stacked Bar
    //   Performance over time          -> Line
    //   Individual vendor comparisons  -> Horizontal Bar
    //   Resource/budget allocation     -> Pie/Donut
    //   Proportional distribution      -> Column
    // ============================================================
    const buildReportingSchema = () => {
        const out = document.getElementById('reporting-schema-output');
        if (!out) return;
        if (!vendors.length) {
            out.innerHTML = `<p class="empty-mini-state" style="padding:1rem 0;">No vendor data yet. Add or import vendors first.</p>`;
            return;
        }

        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
        // Render a 2D array as both an HTML table and a copyable TSV block.
        const tableBlock = (headers, rows) => {
            const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
            const html = `
                <div class="schema-table-wrap">
                    <table class="schema-table">
                        <thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
                        <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                    </table>
                </div>
                <button class="secondary-btn schema-copy-btn" data-tsv="${esc(tsv).replace(/"/g,'&quot;')}" style="padding:0.3rem 0.8rem; font-size:0.8rem; margin-top:0.6rem;">Copy table</button>`;
            return html;
        };

        const card = (title, chartType, rationale, tableHtml, insights) => `
            <div class="schema-card">
                <div class="schema-card-head">
                    <h4>${esc(title)}</h4>
                    <span class="schema-chart-badge">${esc(chartType)}</span>
                </div>
                ${tableHtml}
                <div class="schema-meta">
                    <p><strong>Why this chart:</strong> ${rationale}</p>
                    <p><strong>Executive insight:</strong> ${insights}</p>
                </div>
            </div>`;

        const total = vendors.length;
        const pct = (n) => total ? Math.round(n/total*100) + '%' : '0%';

        // --- 1. Vulnerabilities/Risk by Severity per Category -> STACKED BAR ---
        const cats = [...new Set(vendors.map(v => v.type || 'Other'))];
        const sev = ['High','Medium','Low','Pending'];
        const rows1 = cats.map(c => {
            const inCat = vendors.filter(v => (v.type||'Other') === c);
            return [c, ...sev.map(s => String(inCat.filter(v => (v.risk||'Pending') === s).length))];
        });
        const card1 = card(
            'Risk Severity Breakdown by Vendor Category',
            'Stacked Bar Chart',
            'A component/categorical breakdown: each category bar is segmented by risk severity, so you see both the total per category and its internal composition in one view.',
            tableBlock(['Vendor Category','High','Medium','Low','Pending'], rows1),
            (() => { const worst = rows1.slice().sort((a,b)=>Number(b[1])-Number(a[1]))[0]; return worst && Number(worst[1])>0 ? `<strong>${esc(worst[0])}</strong> carries the most high-severity vendors (${worst[1]}) and should be prioritized for remediation.` : 'No high-severity concentrations detected across categories.'; })()
        );

        // --- 2. Assessment completion over time (by month) -> LINE ---
        const byMonth = {};
        vendors.forEach(v => {
            const t = v.createdAt ? new Date(v.createdAt) : null;
            if (!t) return;
            const key = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
            byMonth[key] = byMonth[key] || { added: 0, completed: 0 };
            byMonth[key].added++;
            if (v.score !== 'Pending' && v.score !== undefined) byMonth[key].completed++;
        });
        const months = Object.keys(byMonth).sort();
        const rows2 = months.length ? months.map(m => [m, String(byMonth[m].added), String(byMonth[m].completed)])
                                    : [['(no dated records)','0','0']];
        const card2 = card(
            'Vendor Onboarding & Assessment Completion Over Time',
            'Line Chart',
            'Performance/volume over time is best shown as a line: it reveals the trend and momentum of onboarding versus completed assessments month over month.',
            tableBlock(['Month','Vendors Added','Assessments Completed'], rows2),
            'Watch for months where additions outpace completions — a widening gap signals a growing assessment backlog.'
        );

        // --- 3. Individual vendor risk-score comparison -> HORIZONTAL BAR ---
        const scored = vendors.map(v => ({ name: v.name, score: (typeof v.score === 'number' || /^\d+$/.test(v.score)) ? Number(v.score) : getInherentRisk(v.type, v.dataType) }))
                              .sort((a,b)=>b.score-a.score).slice(0,10);
        const rows3 = scored.map(s => [s.name, String(s.score)]);
        const card3 = card(
            'Top Vendors by Risk Score',
            'Horizontal Bar Chart',
            'Comparing individual named vendors works best horizontally: long vendor labels stay readable and the ranking from highest to lowest risk is immediately scannable.',
            tableBlock(['Vendor','Risk Score'], rows3.length?rows3:[['(none)','0']]),
            scored.length ? `<strong>${esc(scored[0].name)}</strong> is your highest-risk vendor (score ${scored[0].score}) and warrants the most immediate oversight.` : 'No scored vendors yet.'
        );

        // --- 4. Spend/budget allocation by category -> PIE/DONUT ---
        const spendByCat = {};
        let hasSpend = false;
        vendors.forEach(v => {
            const raw = v.contractValue ? Number(String(v.contractValue).replace(/[^0-9.]/g,'')) : 0;
            if (raw > 0) hasSpend = true;
            spendByCat[v.type||'Other'] = (spendByCat[v.type||'Other']||0) + raw;
        });
        const rows4 = Object.entries(spendByCat).filter(([,v])=>v>0).map(([c,v])=>[c, '$'+v.toLocaleString()]);
        const card4 = card(
            'Contract Spend Allocation by Category',
            'Donut Chart',
            'Budget/resource allocation is proportional data — a donut chart shows each category as a share of total third-party spend at a glance.',
            hasSpend ? tableBlock(['Vendor Category','Total Spend'], rows4) : `<p class="empty-mini-state" style="text-align:left;padding:0.5rem 0;">No contract value data on file. Import a sheet with a "Contract Value"/"Spend" column to populate this.</p>`,
            hasSpend ? 'Concentrated spend in one category increases financial dependency risk — ensure exit/continuity plans exist for the largest slice.' : 'Add spend data to surface concentration risk.'
        );

        // --- 5. Vendor distribution by risk tier -> COLUMN ---
        const tierCounts = sev.map(s => vendors.filter(v => (v.risk||'Pending')===s).length);
        const rows5 = sev.map((s,i)=>[s, String(tierCounts[i]), pct(tierCounts[i])]);
        const card5 = card(
            'Vendor Distribution by Risk Tier',
            'Column Chart',
            'Proportional distribution across a few discrete tiers reads cleanly as vertical columns — the relative heights make the portfolio risk shape obvious.',
            tableBlock(['Risk Tier','Vendor Count','% of Portfolio'], rows5),
            `${pct(tierCounts[0])} of the portfolio sits in the High tier — keep this share trending down as assessments complete.`
        );

        out.innerHTML = card1 + card2 + card3 + card4 + card5;

        // Wire copy buttons
        out.querySelectorAll('.schema-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tsv = btn.getAttribute('data-tsv').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<');
                navigator.clipboard?.writeText(tsv).then(
                    () => showToast('Table copied — paste into Excel or Sheets.'),
                    () => showToast('Copy failed; select and copy manually.')
                );
            });
        });
    };

    const genSchemaBtn = document.getElementById('generate-schema-btn');
    if (genSchemaBtn) genSchemaBtn.addEventListener('click', buildReportingSchema);

    const renderCustomCharts = () => {
        if(!document.getElementById('metrics-view') || document.getElementById('metrics-view').classList.contains('hidden')) return;
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js failed to load — custom charts cannot be rendered.');
            return;
        }
        
        // Remove old custom chart DOM elements
        document.querySelectorAll('.custom-chart-card').forEach(el => el.remove());
        
        // Destroy old instances
        Object.values(customChartInstances).forEach(inst => inst.destroy());
        customChartInstances = {};

        customCharts.forEach(chartConf => {
            const yAxis = chartConf.yAxis || 'count';

            // Group data
            const groups = {};
            vendors.forEach(v => {
                let val = v[chartConf.source];
                if (chartConf.source === 'scoreStatus') val = (v.score === 'Pending') ? 'Pending' : 'Completed';
                if (!val) val = 'Unknown';
                
                if (!groups[val]) groups[val] = [];
                groups[val].push(v);
            });

            const labels = Object.keys(groups);
            const data = labels.map(label => {
                const groupVendors = groups[label];
                if (yAxis === 'count') return groupVendors.length;
                
                let sum = 0;
                let count = 0;
                groupVendors.forEach(v => {
                    let scoreVal = null;
                    if (yAxis === 'avgInherent') scoreVal = v.inherentRisk !== undefined ? v.inherentRisk : getInherentRisk(v.type, v.dataType);
                    else if (yAxis === 'avgAssessment') scoreVal = v.score !== 'Pending' ? v.score : null;
                    else if (yAxis === 'avgResidual') scoreVal = (v.residualRisk !== undefined && v.residualRisk !== 'Pending') ? v.residualRisk : null;
                    
                    if (scoreVal !== null) {
                        sum += parseInt(scoreVal);
                        count++;
                    }
                });
                return count > 0 ? Math.round(sum / count) : 0;
            });

            // Generate colors
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

            const card = document.createElement('div');
            card.className = 'glass-panel custom-chart-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <h3>${chartConf.title}</h3>
                    <button class="delete-chart-btn" data-id="${chartConf.id}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem;">&times;</button>
                </div>
                <div style="position: relative; height: 300px; width: 100%; display: flex; justify-content: center;">
                    <canvas id="custom-canvas-${chartConf.id}"></canvas>
                </div>
            `;
            chartsGrid.appendChild(card);

            // Attach delete listener
            card.querySelector('.delete-chart-btn').addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                customCharts = customCharts.filter(c => c.id !== id);
                saveCustomCharts();
                renderCustomCharts();
                showToast('Chart removed');
            });

            // Initialize Chart
            const ctx = document.getElementById(`custom-canvas-${chartConf.id}`);
            const opts = {
                type: chartConf.type,
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderRadius: chartConf.type === 'bar' ? 6 : 0,
                        borderWidth: 0,
                        hoverOffset: chartConf.type === 'pie' || chartConf.type === 'doughnut' ? 10 : 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            display: chartConf.type !== 'bar',
                            position: 'bottom', 
                            labels: { color: '#f8fafc' } 
                        }
                    }
                }
            };
            
            if (chartConf.type === 'bar') {
                opts.options.scales = {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#f8fafc' }, grid: { display: false } }
                };
            }
            
            customChartInstances[chartConf.id] = new Chart(ctx, opts);
        });
    };

    // Greeting Banner Logic
    let greetingClockInterval = null;

    const getGreetingCopy = (hour) => {
        // working late: very late night hours (after midnight, before early morning) get a distinct tone
        if (hour >= 0 && hour < 5) {
            return { greeting: 'Working late', sub: "I see. Don't burn out — your vendors will still be here in the morning." };
        }
        if (hour >= 5 && hour < 12) {
            return { greeting: 'Good morning', sub: "Let's get started — here's where your risk program stands today." };
        }
        if (hour >= 12 && hour < 17) {
            return { greeting: 'Good afternoon', sub: "Lunch done? Here's a quick look at your vendor risk landscape." };
        }
        if (hour >= 17 && hour < 21) {
            return { greeting: 'Good evening', sub: "Almost there — let's wrap up with a look at today's assessments." };
        }
        // 21:00 - 23:59
        return { greeting: 'Good night', sub: 'Time to logout? Here\'s a final snapshot before you go.' };
    };

    const updateGreetingBanner = () => {
        const greetingMessage = document.getElementById('greeting-message');
        const greetingSubtext = document.getElementById('greeting-subtext');
        const greetingClock = document.getElementById('greeting-clock');
        const greetingDate = document.getElementById('greeting-date');
        if (!greetingMessage || !currentUser) return;

        const now = new Date();
        const hour = now.getHours();
        const { greeting, sub } = getGreetingCopy(hour);
        const firstName = (currentUser.name || '').split(' ')[0] || currentUser.name;

        greetingMessage.textContent = `${greeting}, ${firstName}`;
        greetingSubtext.textContent = sub;

        if (greetingClock) {
            greetingClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (greetingDate) {
            greetingDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        }
    };

    const startGreetingClock = () => {
        updateGreetingBanner();
        if (greetingClockInterval) clearInterval(greetingClockInterval);
        // Refresh every 30s so the clock stays current and the greeting flips
        // automatically if someone is logged in across a time-of-day boundary.
        greetingClockInterval = setInterval(updateGreetingBanner, 30000);
    };

    // Profile Logic
    const updateProfileUI = () => {
        userNameDisplay.textContent = currentUser.name;
        if (currentUser.photoUrl) {
            userAvatar.textContent = '';
            userAvatar.style.backgroundImage = `url(${currentUser.photoUrl})`;
        } else {
            userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
            userAvatar.style.backgroundImage = 'none';
        }
        
        // Theme — data-driven so new themes just need a CSS block + entry here.
        const ALL_THEME_CLASSES = ['theme-light', 'theme-solarized', 'theme-midnight', 'theme-forest', 'theme-rose', 'theme-slate', 'theme-highcontrast', 'theme-nord'];
        document.body.classList.remove(...ALL_THEME_CLASSES);
        const themeChartColors = {
            dark: '#f8fafc', light: '#0f172a', solarized: '#93a1a1',
            midnight: '#e2e8f0', forest: '#d1fae5', rose: '#fce7f3',
            slate: '#e2e8f0', highcontrast: '#ffffff', nord: '#d8dee9'
        };
        let chartColor = themeChartColors[currentUser.theme] || '#f8fafc';
        if (currentUser.theme && currentUser.theme !== 'dark') {
            document.body.classList.add('theme-' + currentUser.theme);
        }
        
        // Font
        const font = currentUser.font || "'Inter', sans-serif";
        document.body.style.fontFamily = font;
        
        // Update global chart defaults
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = chartColor;
            Chart.defaults.font.family = font;
        }
    };

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            if (!currentUser) return; // safety net: shouldn't happen since this button lives inside the dashboard, which is hidden when logged out
            document.getElementById('profile-name').value = currentUser.name;
            document.getElementById('profile-title').value = currentUser.title || '';
            document.getElementById('profile-theme').value = currentUser.theme || 'dark';
            document.getElementById('profile-font').value = currentUser.font || "'Inter', sans-serif";
            tempPhotoUrl = currentUser.photoUrl || null;
            
            if (tempPhotoUrl) {
                profileAvatarPreview.textContent = '';
                profileAvatarPreview.style.backgroundImage = `url(${tempPhotoUrl})`;
            } else {
                profileAvatarPreview.textContent = currentUser.name.charAt(0).toUpperCase();
                profileAvatarPreview.style.backgroundImage = 'none';
            }
            profileModalOverlay.classList.remove('hidden');
        });
    }

    if (profilePhotoUpload) {
        profilePhotoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    tempPhotoUrl = ev.target.result;
                    profileAvatarPreview.textContent = '';
                    profileAvatarPreview.style.backgroundImage = `url(${tempPhotoUrl})`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            currentUser.name = document.getElementById('profile-name').value;
            currentUser.title = document.getElementById('profile-title').value;
            currentUser.theme = document.getElementById('profile-theme').value;
            currentUser.font = document.getElementById('profile-font').value;
            currentUser.photoUrl = tempPhotoUrl;
            
            localStorage.setItem('tprm_current_user', JSON.stringify(currentUser));
            updateProfileUI();
            updateGreetingBanner();
            
            // Repaint charts for new theme/font
            if (vendors.length > 0) {
                updateCharts();
                renderCustomCharts();
            }
            
            showToast('Profile updated!');
            profileModalOverlay.classList.add('hidden');
        });
    }

    if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', () => profileModalOverlay.classList.add('hidden'));
    if (cancelProfileModalBtn) cancelProfileModalBtn.addEventListener('click', () => profileModalOverlay.classList.add('hidden'));

    // Auth Toggles
    const showAuthView = (view) => {
        loginFormContainer.classList.remove('active');
        registerFormContainer.classList.remove('active');
        forgotPasswordContainer.classList.remove('active');
        resetPasswordContainer.classList.remove('active');
        view.classList.add('active');
    };

    toRegisterBtn.addEventListener('click', () => showAuthView(registerFormContainer));
    toLoginBtn.addEventListener('click', () => showAuthView(loginFormContainer));
    toLoginFromForgotBtn.addEventListener('click', () => showAuthView(loginFormContainer));
    toForgotPasswordBtn.addEventListener('click', () => showAuthView(forgotPasswordContainer));

    const checkAuth = () => {
        const user = JSON.parse(localStorage.getItem('tprm_current_user'));
        if (user) {
            currentUser = user;
            authContainer.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');
            
            userNameDisplay.textContent = user.name;
            updateProfileUI();
            startGreetingClock();
            
            if (localStorage.getItem('tprm_intake_uploaded') === 'true' && document.getElementById('intake-upload-status')) {
                document.getElementById('intake-upload-status').style.display = 'block';
            }
            
            loadVendors();
            loadQuestionnaires();
            loadCustomCharts();
            
            const savedView = localStorage.getItem('tprm_current_view') || 'dashboard-view';
            const savedTitle = localStorage.getItem('tprm_current_view_title') || 'Dashboard';
            
            if (savedView === 'vendor-detail-view') {
                const savedVendorId = localStorage.getItem('tprm_active_vendor_id');
                if (savedVendorId) {
                    switchView('vendors-view', 'Vendors');
                    openVendorDetail(savedVendorId);
                } else {
                    switchView('vendors-view', 'Vendors');
                }
            } else {
                switchView(savedView, savedTitle);
            }
        } else {
            currentUser = null;
            authContainer.classList.remove('hidden');
            dashboardContainer.classList.add('hidden');
            resetAuthScreenStyling();
            if (greetingClockInterval) {
                clearInterval(greetingClockInterval);
                greetingClockInterval = null;
            }
        }
    };

    let pendingResetEmail = null; // tracks which account's password is being reset

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const registerErrorEl = document.getElementById('register-error');
        const emailInput = document.getElementById('reg-email');
        const passwordInput = document.getElementById('reg-password');
        const emailHint = document.getElementById('reg-email-hint');
        const passwordHint = document.getElementById('reg-password-hint');

        clearAuthError(registerErrorEl);
        clearFieldError(emailInput, emailHint);
        clearFieldError(passwordInput, passwordHint);

        const name = document.getElementById('reg-name').value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!isValidEmail(email)) {
            showFieldError(emailInput, emailHint, 'Please enter a valid email address (e.g. name@company.com).');
            return;
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            showFieldError(passwordInput, passwordHint, passwordCheck.message);
            return;
        }

        if (findUserByEmail(email)) {
            showAuthError(registerErrorEl, 'An account with this email already exists. Please log in instead.');
            return;
        }

        const passwordHash = await hashPassword(password);
        const users = getUsers();
        users.push({ name, email, passwordHash, createdAt: Date.now() });
        saveUsers(users);

        const user = { name, email };
        localStorage.setItem('tprm_current_user', JSON.stringify(user));
        showToast('Account created successfully!');
        registerForm.reset();
        checkAuth();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginErrorEl = document.getElementById('login-error');
        clearAuthError(loginErrorEl);

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!isValidEmail(email)) {
            showAuthError(loginErrorEl, 'Please enter a valid email address.');
            return;
        }

        const existingUser = findUserByEmail(email);
        if (!existingUser) {
            showAuthError(loginErrorEl, "We couldn't find an account with this email. Please sign up to create one.");
            return;
        }

        const passwordHash = await hashPassword(password);
        if (passwordHash !== existingUser.passwordHash) {
            showAuthError(loginErrorEl, 'Incorrect password. Please try again or use "Forgot password?".');
            return;
        }

        const sessionUser = {
            name: existingUser.name,
            email: existingUser.email,
            theme: existingUser.theme,
            font: existingUser.font,
            title: existingUser.title,
            photoUrl: existingUser.photoUrl
        };
        localStorage.setItem('tprm_current_user', JSON.stringify(sessionUser));
        showToast('Logged in successfully!');
        loginForm.reset();
        checkAuth();
    });

    forgotPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const forgotErrorEl = document.getElementById('forgot-error');
        clearAuthError(forgotErrorEl);

        const email = document.getElementById('forgot-email').value.trim();

        if (!isValidEmail(email)) {
            showAuthError(forgotErrorEl, 'Please enter a valid email address.');
            return;
        }

        const existingUser = findUserByEmail(email);
        if (!existingUser) {
            showAuthError(forgotErrorEl, "We couldn't find an account with this email. Please check the address or sign up.");
            return;
        }

        // Generate a reset token tied to this specific account, with a short expiry.
        // In a real deployment, this token would be emailed via a backend mail service;
        // here we simulate "sending the email" with an in-app clickable link, since
        // there is no backend to actually deliver mail.
        const resetToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const users = getUsers();
        const idx = users.findIndex(u => u.email.toLowerCase() === existingUser.email.toLowerCase());
        users[idx].resetToken = resetToken;
        users[idx].resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        saveUsers(users);

        pendingResetEmail = existingUser.email;

        toast.innerHTML = `Reset link sent to ${existingUser.email}! <br><a href="#" id="simulated-link" style="color: white; text-decoration: underline; font-weight: bold; margin-top: 8px; display: inline-block;">Click here to reset (demo link — no real email server is connected)</a>`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            if(toast.classList.contains('show')) {
                toast.classList.remove('show');
                setTimeout(() => toast.classList.add('hidden'), 300);
            }
        }, 8000);

        document.getElementById('simulated-link').addEventListener('click', (ev) => {
            ev.preventDefault();
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
            document.getElementById('reset-password-subtitle').textContent = `Create a new password for ${existingUser.email}`;
            showAuthView(resetPasswordContainer);
        });
    });

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resetErrorEl = document.getElementById('reset-error');
        clearAuthError(resetErrorEl);

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;

        if (!pendingResetEmail) {
            showAuthError(resetErrorEl, 'Your reset session expired. Please request a new reset link.');
            return;
        }

        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.valid) {
            showAuthError(resetErrorEl, passwordCheck.message);
            return;
        }

        if (newPassword !== confirmPassword) {
            showAuthError(resetErrorEl, 'Passwords do not match.');
            return;
        }

        const users = getUsers();
        const idx = users.findIndex(u => u.email.toLowerCase() === pendingResetEmail.toLowerCase());
        if (idx === -1) {
            showAuthError(resetErrorEl, 'Account not found. Please request a new reset link.');
            return;
        }

        users[idx].passwordHash = await hashPassword(newPassword);
        delete users[idx].resetToken;
        delete users[idx].resetTokenExpires;
        saveUsers(users);

        pendingResetEmail = null;
        showToast('Password updated! Please log in.');
        showAuthView(loginFormContainer);
        resetPasswordForm.reset();
        loginForm.reset();
    });

    logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // logout-btn is nested inside profile-btn; without this,
                              // the click bubbles up and profile-btn's handler runs
                              // next with currentUser already null, causing a crash.
        localStorage.removeItem('tprm_current_user');
        resetAuthScreenStyling();
        checkAuth();
        showToast('Logged out');
    });

    // Questionnaire Management Logic
    let questionnaires = [];
    const qModalOverlay = document.getElementById('questionnaire-modal-overlay');
    const qForm = document.getElementById('questionnaire-form');
    const qIdInput = document.getElementById('q-id');
    const qNameInput = document.getElementById('q-name');
    const qTypeInput = document.getElementById('q-type');
    const qContainer = document.getElementById('dynamic-questions-container');
    const addQBtn = document.getElementById('add-question-btn');
    
    const selectQModal = document.getElementById('select-questionnaire-modal');
    const selectQDropdown = document.getElementById('q-select-dropdown');
    
    const defaultQs = [
        "1. Does this vendor handle PII, PHI, or highly sensitive financial data?",
        "2. Is the service cloud-hosted or SaaS?",
        "3. Does the vendor integrate directly with internal critical systems?",
        "4. Does the vendor provide a critical business function (high availability required)?"
    ];

    // Removes artifacts that an earlier, less robust import may have stored as
    // "questions" — banner/title rows, a stray "Q#"/header label, and bare
    // numbers (the old parser read column 0, which was often the Q# index).
    const sanitizeQuestionnaireQuestions = (qs) => {
        if (!Array.isArray(qs)) return qs;
        const ID_LABEL = /^(q\s*#|q\s*no\.?|no\.?|#|s\.?\s*no\.?|item|id|index|risk\s*domain|risk\s*weight|evaluation\s*criteria.*|vendor\s*response.*)$/i;
        // Distinctive banner/title phrases. These are matched anywhere (any
        // length), since a subtitle like "Comprehensive 50-Question ... Matrix."
        // is long prose but clearly not a real assessment question.
        const BANNER_STRONG = /(master questionnaire|assessment matrix|comprehensive\s+\d+[-\s]*question|questionnaire\s*$)/i;
        const BANNER_SHORT = /(question\s*#|^detailed assessment question$|^question\s*(text|description)?$)/i;
        // A real question is interrogative or instructional; banners are not.
        const looksLikeQuestion = (t) => /\?$/.test(t) || /^(do|does|is|are|has|have|will|can|describe|provide|how|what|when|where|why|list|detail|explain|specify)\b/i.test(t);
        return qs.filter(q => {
            const t = String(q == null ? '' : q).trim();
            if (t === '') return false;
            if (/^\d+$/.test(t)) return false;          // bare numbers
            if (ID_LABEL.test(t)) return false;          // column-header labels
            if (BANNER_SHORT.test(t) && t.length < 70) return false;
            // Strong banner phrase AND it doesn't read like a real question.
            if (BANNER_STRONG.test(t) && !looksLikeQuestion(t)) return false;
            return true;
        });
    };

    const loadQuestionnaires = () => {
        if (!currentUser) return;
        const data = localStorage.getItem(`tprm_questionnaires_${currentUser.email}`);
        if (data) {
            questionnaires = JSON.parse(data);
            // Clean any artifacts left by older imports, and persist if changed.
            let changed = false;
            questionnaires.forEach(q => {
                const before = (q.questions || []).length;
                q.questions = sanitizeQuestionnaireQuestions(q.questions);
                if (q.questions.length !== before) changed = true;
            });
            if (changed) localStorage.setItem(`tprm_questionnaires_${currentUser.email}`, JSON.stringify(questionnaires));
        } else {
            questionnaires = [{
                id: 'q_' + Date.now(),
                name: 'Standard Security Intake',
                type: 'Intake',
                questions: [...defaultQs],
                createdAt: Date.now()
            }];
            saveQuestionnaires();
        }
        renderQuestionnaires();
    };

    const saveQuestionnaires = () => {
        if (!currentUser) return;
        localStorage.setItem(`tprm_questionnaires_${currentUser.email}`, JSON.stringify(questionnaires));
        renderQuestionnaires();
    };

    const renderQuestionnaires = () => {
        const intakeTbody = document.getElementById('questionnaires-intake-tbody');
        const assessmentTbody = document.getElementById('questionnaires-assessment-tbody');
        const auditTbody = document.getElementById('questionnaires-audit-tbody');
        
        if (!intakeTbody || !assessmentTbody || !auditTbody) return;
        
        intakeTbody.innerHTML = '';
        assessmentTbody.innerHTML = '';
        auditTbody.innerHTML = '';
        
        if (questionnaires.length === 0) {
            intakeTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No questionnaires available. Create one to get started.</td></tr>`;
            assessmentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No questionnaires available.</td></tr>`;
            auditTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No questionnaires available.</td></tr>`;
            const intakeCountEl0 = document.getElementById('intake-q-count');
            const assessmentCountEl0 = document.getElementById('assessment-q-count');
            const auditCountEl0 = document.getElementById('audit-q-count');
            if (intakeCountEl0) intakeCountEl0.textContent = '0 questionnaires';
            if (assessmentCountEl0) assessmentCountEl0.textContent = '0 questionnaires';
            if (auditCountEl0) auditCountEl0.textContent = '0 questionnaires';
            return;
        }

        const renderRow = (q, tbody) => {
            const tr = document.createElement('tr');
            const dateStr = new Date(q.createdAt).toLocaleDateString();
            tr.innerHTML = `
                <td style="padding: 1rem; border-bottom: 1px solid var(--glass-border); font-weight: 500;">
                    <span class="q-name-link" onclick="window.editQuestionnaire('${q.id}')" style="color: var(--primary); cursor: pointer; text-decoration: underline;">${q.name}</span>
                </td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--glass-border);">${q.questions.length}</td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--glass-border); color: var(--text-muted);">${dateStr}</td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--glass-border); text-align: right;">
                    <button class="action-btn" onclick="window.editQuestionnaire('${q.id}')">View / Edit</button>
                    <button class="action-btn" onclick="window.deleteQuestionnaire('${q.id}')" style="color: var(--danger); margin-left: 0.5rem;">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        };

        const intakes = questionnaires.filter(q => q.type === 'Intake').sort((a,b) => b.createdAt - a.createdAt);
        const assessments = questionnaires.filter(q => q.type === 'Assessment').sort((a,b) => b.createdAt - a.createdAt);
        const audits = questionnaires.filter(q => q.type === 'Audit').sort((a,b) => b.createdAt - a.createdAt);

        const intakeCountEl = document.getElementById('intake-q-count');
        const assessmentCountEl = document.getElementById('assessment-q-count');
        const auditCountEl = document.getElementById('audit-q-count');
        const pluralize = (n) => `${n} questionnaire${n !== 1 ? 's' : ''}`;
        if (intakeCountEl) intakeCountEl.textContent = pluralize(intakes.length);
        if (assessmentCountEl) assessmentCountEl.textContent = pluralize(assessments.length);
        if (auditCountEl) auditCountEl.textContent = pluralize(audits.length);

        if (intakes.length === 0) intakeTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No Intake questionnaires available.</td></tr>`;
        else intakes.forEach(q => renderRow(q, intakeTbody));

        if (assessments.length === 0) assessmentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No Assessment questionnaires available.</td></tr>`;
        else assessments.forEach(q => renderRow(q, assessmentTbody));

        if (audits.length === 0) auditTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No Audit questionnaires available.</td></tr>`;
        else audits.forEach(q => renderRow(q, auditTbody));
    };

    window.editQuestionnaire = (id) => {
        const q = questionnaires.find(x => x.id === id);
        if (!q) return;
        qIdInput.value = q.id;
        qNameInput.value = q.name;
        qTypeInput.value = q.type;
        qContainer.innerHTML = '';
        q.questions.forEach((text) => addQuestionField(text));
        qModalOverlay.classList.remove('hidden');
    };

    window.deleteQuestionnaire = (id) => {
        if (confirm('Are you sure you want to delete this questionnaire?')) {
            questionnaires = questionnaires.filter(x => x.id !== id);
            saveQuestionnaires();
            showToast('Questionnaire deleted');
        }
    };

    const addQuestionField = (val = '') => {
        const div = document.createElement('div');
        div.className = 'input-group q-item';
        div.style.marginBottom = '1rem';
        div.innerHTML = `
            <div style="display: flex; gap: 0.5rem;">
                <input type="text" class="q-text" value="${val.replace(/"/g, '&quot;')}" required style="flex: 1;" placeholder="Enter question here...">
                <button type="button" class="secondary-btn remove-q-btn" style="padding: 0 0.8rem; color: var(--danger); border-color: rgba(239,68,68,0.3);">X</button>
            </div>
        `;
        div.querySelector('.remove-q-btn').addEventListener('click', () => div.remove());
        qContainer.appendChild(div);
    };

    if (addQBtn) addQBtn.addEventListener('click', () => addQuestionField());

    const createQBtn = document.getElementById('create-questionnaire-btn');
    if (createQBtn) {
        createQBtn.addEventListener('click', () => {
            qIdInput.value = '';
            qNameInput.value = '';
            qTypeInput.value = 'Intake';
            qContainer.innerHTML = '';
            addQuestionField();
            qModalOverlay.classList.remove('hidden');
        });
    }

    const closeQModal = document.getElementById('close-questionnaire-modal');
    const cancelQModal = document.getElementById('cancel-questionnaire-modal');
    if (closeQModal) closeQModal.addEventListener('click', () => qModalOverlay.classList.add('hidden'));
    if (cancelQModal) cancelQModal.addEventListener('click', () => qModalOverlay.classList.add('hidden'));

    if (qForm) {
        qForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const texts = Array.from(qContainer.querySelectorAll('.q-text')).map(inp => inp.value.trim()).filter(v => v);
            if (texts.length === 0) {
                showToast('Please add at least one question.');
                return;
            }
            
            if (qIdInput.value) {
                const q = questionnaires.find(x => x.id === qIdInput.value);
                if (q) {
                    q.name = qNameInput.value;
                    q.type = qTypeInput.value;
                    q.questions = texts;
                }
            } else {
                questionnaires.push({
                    id: 'q_' + Date.now(),
                    name: qNameInput.value,
                    type: qTypeInput.value,
                    questions: texts,
                    createdAt: Date.now()
                });
            }
            saveQuestionnaires();
            qModalOverlay.classList.add('hidden');
            showToast('Questionnaire saved successfully!');
        });
    }

    // Configure pdf.js worker (needed once, safe to call even if pdfjsLib loads late)
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Extracts question-like lines of text from a parsed pdf.js document.
    const extractQuestionsFromPdfText = (pages) => {
        const lines = [];
        pages.forEach(pageText => {
            pageText.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed.length > 3) lines.push(trimmed);
            });
        });
        return lines;
    };

    // Reads a PDF file and resolves with an array of extracted text lines (one per row/question).
    const readPdfAsLines = (file) => {
        return new Promise((resolve, reject) => {
            if (typeof pdfjsLib === 'undefined') {
                reject(new Error('PDF library failed to load. Check your internet connection and try again.'));
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const typedArray = new Uint8Array(ev.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                    const pageTexts = [];
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const text = content.items.map(item => item.str).join(' ');
                        pageTexts.push(text);
                    }
                    resolve(extractQuestionsFromPdfText(pageTexts));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Could not read PDF file.'));
            reader.readAsArrayBuffer(file);
        });
    };

    // Reads an Excel file and resolves with an array of question strings.
    // Expects either a single "Question" column, or falls back to the first column of each row.
    const readExcelAsQuestions = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = ev.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false })
                        .filter(r => Array.isArray(r) && r.some(c => String(c == null ? '' : c).trim() !== ''));

                    resolve(extractQuestionsFromRows(rows));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Could not read Excel file.'));
            reader.readAsBinaryString(file);
        });
    };

    // Intelligently pulls the actual question text out of a sheet's rows,
    // handling real-world questionnaire layouts:
    //  - Title / subtitle banner rows above the table (skipped)
    //  - A header row whose columns are labels like "Q#", "Risk Domain",
    //    "Detailed Assessment Question", "Risk Weight" (detected, not treated
    //    as a question)
    //  - The genuine question text living in a "Question" column that is NOT
    //    column 0 (column 0 is often a number/ID like Q#)
    // Falls back sensibly when there are no recognizable headers.
    const extractQuestionsFromRows = (rows) => {
        if (!rows || rows.length === 0) return [];

        const cell = (r, c) => String((r && r[c] != null) ? r[c] : '').trim();
        const QUESTION_HEADER = /(detailed.*question|assessment.*question|^questions?$|question\s*(text|description)?|control\s*question|inquiry|prompt)/i;
        const ID_HEADER = /^(q\s*#|q\s*no\.?|q\s*num|no\.?|#|s\.?\s*no\.?|sr\.?\s*no\.?|item|id|index)$/i;

        // 1) Find the header row: the first row containing a cell that is a
        //    SHORT label matching a known question-column name. Titles and
        //    subtitles are long prose, so we cap the label length to avoid
        //    matching a banner like "...50-Question ... Assessment Matrix".
        let headerRowIdx = -1;
        let questionCol = -1;
        const scanLimit = Math.min(rows.length, 12);
        const isHeaderLabel = (v) => v.length > 0 && v.length <= 45 && QUESTION_HEADER.test(v);
        for (let i = 0; i < scanLimit; i++) {
            const row = rows[i] || [];
            const populated = row.map((_, c) => cell(row, c)).filter(v => v !== '');
            // A genuine header row has more than one populated cell (label per
            // column). A lone long sentence is a banner, not a header.
            if (populated.length < 2) continue;
            for (let c = 0; c < row.length; c++) {
                if (isHeaderLabel(cell(row, c))) {
                    headerRowIdx = i;
                    questionCol = c;
                    break;
                }
            }
            if (headerRowIdx !== -1) break;
        }

        let dataRows, qCol;
        if (headerRowIdx !== -1) {
            dataRows = rows.slice(headerRowIdx + 1);
            qCol = questionCol;
        } else {
            // 2) No explicit question header. Skip obvious banner rows (single
            //    populated cell that reads like a title), then pick the column
            //    with the most "question-like" text (longest average, ends with
            //    '?', or longest overall) — but never an ID-looking column.
            let start = 0;
            while (start < rows.length) {
                const populated = (rows[start] || []).filter(c => cell(rows[start], (rows[start]).indexOf(c)) !== '');
                const nonEmpty = (rows[start] || []).map((_, c) => cell(rows[start], c)).filter(v => v !== '');
                // A banner row = exactly one populated cell that's long-ish prose.
                if (nonEmpty.length === 1 && nonEmpty[0].length > 12 && !nonEmpty[0].endsWith('?')) { start++; continue; }
                break;
            }
            dataRows = rows.slice(start);

            // Determine best question column by scoring each column.
            const colCount = Math.max(...dataRows.slice(0, 20).map(r => (r || []).length), 1);
            let bestCol = 0, bestScore = -1;
            for (let c = 0; c < colCount; c++) {
                const vals = dataRows.map(r => cell(r, c)).filter(v => v !== '');
                if (vals.length === 0) continue;
                const headerName = cell(rows[Math.max(0, start - 1)], c);
                if (ID_HEADER.test(headerName)) continue; // never pick an ID column
                const numericShare = vals.filter(v => /^\d+(\.\d+)?$/.test(v)).length / vals.length;
                if (numericShare > 0.6) continue; // skip number/ID columns
                const avgLen = vals.reduce((s, v) => s + v.length, 0) / vals.length;
                const qMarkShare = vals.filter(v => v.includes('?')).length / vals.length;
                const score = avgLen + qMarkShare * 50;
                if (score > bestScore) { bestScore = score; bestCol = c; }
            }
            qCol = bestCol;
        }

        // 3) Pull the question text from the chosen column; skip blanks and any
        //    residual header/ID tokens, then run the shared sanitizer so the
        //    same banner/number/header cleanup applies to EVERY upload path.
        const rawPicked = dataRows
            .map(r => cell(r, qCol))
            .filter(q => q.length > 0);

        const questions = sanitizeQuestionnaireQuestions(
            rawPicked
                .filter(q => !/^\d+$/.test(q))                 // bare numbers (stray Q# values)
                .filter(q => !ID_HEADER.test(q))               // stray header tokens
                .filter(q => !QUESTION_HEADER.test(q) || q.length > 25) // header label itself, unless clearly real text
        );

        // Diagnostics so the UI can tell the user what was detected.
        const sourceColumnLabel = (headerRowIdx !== -1)
            ? (cell(rows[headerRowIdx], qCol) || `column ${qCol + 1}`)
            : `column ${qCol + 1}`;
        const skippedRows = rows.length - questions.length;

        // Attach metadata non-enumerably so existing callers that treat the
        // return value as a plain array still work unchanged.
        Object.defineProperty(questions, '_meta', {
            value: { sourceColumnLabel, skippedRows, totalRows: rows.length, headerDetected: headerRowIdx !== -1 },
            enumerable: false
        });
        return questions;
    };

    // Per-category Import: reads an .xlsx/.xls or .pdf file and adds the extracted
    // questions as a new questionnaire under the matching section (Intake / Assessment / Audit).
    window.importQuestionnaire = async (type, inputEl) => {
        const file = inputEl.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        showToast(`Reading ${file.name}...`);

        try {
            let questions = [];
            if (ext === 'xlsx' || ext === 'xls') {
                questions = await readExcelAsQuestions(file);
            } else if (ext === 'pdf') {
                questions = await readPdfAsLines(file);
            } else {
                showToast('Unsupported file type. Please upload an .xlsx, .xls, or .pdf file.');
                inputEl.value = '';
                return;
            }

            if (questions.length === 0) {
                showToast('Import failed: no questions could be extracted from the file.');
                inputEl.value = '';
                return;
            }

            // Persist a clean copy (array spread drops the non-enumerable
            // _meta, leaving plain strings in storage).
            questionnaires.push({
                id: 'q_' + Date.now(),
                name: file.name.replace(/\.(xlsx|xls|pdf)$/i, ''),
                type: type,
                questions: [...questions],
                createdAt: Date.now()
            });

            saveQuestionnaires();

            // Tell the user exactly what the parser detected, so it's clear it
            // read the real questions (and from which column) on every upload.
            const meta = questions._meta;
            if (meta && (ext === 'xlsx' || ext === 'xls')) {
                const colNote = meta.headerDetected
                    ? `from the "${meta.sourceColumnLabel}" column`
                    : `from the most question-like column`;
                showToast(`Imported "${file.name}": detected ${questions.length} questions ${colNote} (skipped ${Math.max(0, meta.totalRows - questions.length)} title/header/blank rows).`);
            } else {
                showToast(`Imported "${file.name}" as a new ${type} questionnaire (${questions.length} questions)!`);
            }
        } catch (err) {
            console.error(err);
            showToast(`Import failed: ${err.message || 'could not parse file.'}`);
        } finally {
            inputEl.value = '';
        }
    };

    // Builds and downloads an Excel workbook of all questionnaires of the given type.
    const exportQuestionnairesAsExcel = (type, matching) => {
        const rows = [];
        matching.forEach(q => {
            rows.push([`Questionnaire: ${q.name}`]);
            q.questions.forEach(question => rows.push([question]));
            rows.push([]); // blank spacer row between questionnaires
        });

        const worksheet = XLSX.utils.aoa_to_sheet([['Questions'], ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, type);
        XLSX.writeFile(workbook, `${type}_questionnaires_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Builds and downloads a PDF of all questionnaires of the given type.
    const exportQuestionnairesAsPdf = (type, matching) => {
        if (typeof jspdf === 'undefined') {
            showToast('PDF library failed to load. Check your internet connection and try again.');
            return;
        }
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        const marginLeft = 14;
        let y = 18;
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(16);
        doc.text(`${type} Questionnaires`, marginLeft, y);
        y += 10;
        doc.setFontSize(11);

        matching.forEach(q => {
            if (y > pageHeight - 20) { doc.addPage(); y = 18; }
            doc.setFont(undefined, 'bold');
            doc.text(q.name, marginLeft, y);
            y += 7;
            doc.setFont(undefined, 'normal');
            q.questions.forEach((question, i) => {
                const wrapped = doc.splitTextToSize(`${i + 1}. ${question}`, 180);
                wrapped.forEach(line => {
                    if (y > pageHeight - 15) { doc.addPage(); y = 18; }
                    doc.text(line, marginLeft, y);
                    y += 6;
                });
            });
            y += 6;
        });

        doc.save(`${type}_questionnaires_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    // Per-category Export: opens a modal to choose Excel or PDF, then generates the file.
    let exportModalPendingType = null;
    const exportFormatModal = document.getElementById('export-format-modal');
    const exportFormatTypeLabel = document.getElementById('export-format-type-label');

    window.exportQuestionnaires = (type) => {
        const matching = questionnaires.filter(q => q.type === type);
        if (matching.length === 0) {
            showToast(`No ${type} questionnaires to export.`);
            return;
        }
        exportModalPendingType = type;
        if (exportFormatTypeLabel) exportFormatTypeLabel.textContent = type;
        if (exportFormatModal) exportFormatModal.classList.remove('hidden');
    };

    const closeExportFormatModal = () => {
        if (exportFormatModal) exportFormatModal.classList.add('hidden');
        exportModalPendingType = null;
    };

    const closeExportFormatBtn = document.getElementById('close-export-format-modal');
    const cancelExportFormatBtn = document.getElementById('cancel-export-format-modal');
    if (closeExportFormatBtn) closeExportFormatBtn.addEventListener('click', closeExportFormatModal);
    if (cancelExportFormatBtn) cancelExportFormatBtn.addEventListener('click', closeExportFormatModal);
    if (exportFormatModal) {
        exportFormatModal.addEventListener('click', (e) => {
            if (e.target === exportFormatModal) closeExportFormatModal();
        });
    }

    const exportFormatExcelBtn = document.getElementById('export-format-excel-btn');
    const exportFormatPdfBtn = document.getElementById('export-format-pdf-btn');

    if (exportFormatExcelBtn) {
        exportFormatExcelBtn.addEventListener('click', () => {
            if (!exportModalPendingType) return;
            const matching = questionnaires.filter(q => q.type === exportModalPendingType);
            exportQuestionnairesAsExcel(exportModalPendingType, matching);
            showToast(`Exported ${matching.length} ${exportModalPendingType} questionnaire${matching.length > 1 ? 's' : ''} as Excel.`);
            closeExportFormatModal();
        });
    }

    if (exportFormatPdfBtn) {
        exportFormatPdfBtn.addEventListener('click', () => {
            if (!exportModalPendingType) return;
            const matching = questionnaires.filter(q => q.type === exportModalPendingType);
            exportQuestionnairesAsPdf(exportModalPendingType, matching);
            showToast(`Exported ${matching.length} ${exportModalPendingType} questionnaire${matching.length > 1 ? 's' : ''} as PDF.`);
            closeExportFormatModal();
        });
    }

    // Email Modal Logic
    const emailModalOverlay = document.getElementById('email-modal-overlay');
    const closeEmailModalBtn = document.getElementById('close-email-modal');
    const cancelEmailModalBtn = document.getElementById('cancel-email-modal');
    const emailForm = document.getElementById('email-form');
    
    const closeEmailModal = () => emailModalOverlay.classList.add('hidden');
    
    if (closeEmailModalBtn) closeEmailModalBtn.addEventListener('click', closeEmailModal);
    if (cancelEmailModalBtn) cancelEmailModalBtn.addEventListener('click', closeEmailModal);
    
    if (emailForm) {
        emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (vendor) {
                vendor.risk = 'Pending POC Response';
                saveVendors();
                closeEmailModal();
                showToast(`Email sent! <br><a href="#" id="simulated-portal-link" style="color: white; text-decoration: underline; font-weight: bold; margin-top: 8px; display: inline-block;">View Vendor Portal</a>`);
                
                setTimeout(() => {
                    const portalLink = document.getElementById('simulated-portal-link');
                    if (portalLink) {
                        portalLink.addEventListener('click', (ev) => {
                            ev.preventDefault();
                            toast.classList.remove('show');
                            setTimeout(() => toast.classList.add('hidden'), 300);
                            
                            document.getElementById('intake-portal-view').classList.remove('hidden');
                            document.getElementById('portal-vendor-name').textContent = vendor.name;
                            
                            const qs = vendor.activeQuestionnaireSnapshot ? vendor.activeQuestionnaireSnapshot.questions : defaultQs;
                            const container = document.getElementById('portal-questions-container');
                            container.innerHTML = qs.map((q, i) => `
                                <div class="input-group">
                                    <label>${q}</label>
                                    <select id="portal-q${i+1}" class="select-input" required>
                                        <option value="">Select...</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>
                            `).join('');
                            
                            document.getElementById('portal-intake-form').setAttribute('data-vendor-id', vendor.id);
                        });
                    }
                }, 50);
                
                openVendorDetail(currentActiveVendorId);
                renderVendors(vendors);
                updateDashboard();
            }
        });
    }

    const recallEmailBtn = document.getElementById('recall-email-btn');
    if (recallEmailBtn) {
        recallEmailBtn.addEventListener('click', () => {
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (vendor) {
                vendor.risk = 'Pending';
                saveVendors();
                openVendorDetail(currentActiveVendorId);
                renderVendors(vendors);
                updateDashboard();
                showToast('Email recalled successfully.');
            }
        });
    }

    // Intake Handlers using Event Delegation
    document.addEventListener('click', (e) => {
        if (e.target.closest('#send-intake-btn')) {
            e.preventDefault();
            if (questionnaires.length === 0) {
                showToast('Please create a Questionnaire first in the Questionnaires tab!');
                return;
            }
            
            // Populate Dropdown
            selectQDropdown.innerHTML = questionnaires.map(q => `<option value="${q.id}">${q.name} (${q.type})</option>`).join('');
            
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (vendor) {
                selectQDropdown.value = vendor.activeQuestionnaireId || questionnaires[0].id;
            }
            
            selectQModal.classList.remove('hidden');
        }

        if (e.target.id === 'close-select-q-modal' || e.target.id === 'cancel-select-q-modal') {
            e.preventDefault();
            selectQModal.removeAttribute('data-mode');
            selectQModal.classList.add('hidden');
        }

        if (e.target.id === 'confirm-send-q-btn') {
            e.preventDefault();
            const selectedQId = selectQDropdown.value;
            const q = questionnaires.find(x => x.id === selectedQId);
            if (!q) return;

            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (!vendor) return;

            // Assessment-tab "Assign Questionnaire" flow: just attach the
            // questionnaire to the vendor's assessment record and re-render
            // the Assessment tab. No email is sent for this — it's an
            // internal questionnaire used for the compliance scan.
            if (selectQModal.getAttribute('data-mode') === 'assessment') {
                if (!vendor.assessmentQuestionnaires) vendor.assessmentQuestionnaires = [];
                // Avoid adding the same questionnaire twice.
                if (vendor.assessmentQuestionnaires.some(aq => aq.id === q.id)) {
                    showToast(`"${q.name}" is already added to this vendor.`);
                    selectQModal.removeAttribute('data-mode');
                    selectQModal.classList.add('hidden');
                    return;
                }
                vendor.assessmentQuestionnaires.push({
                    id: q.id,
                    snapshot: JSON.parse(JSON.stringify(q)),
                    answers: {}
                });
                // Select the newly-added questionnaire and sync the fields the
                // AI scan reads. Existing scan results are preserved.
                selectedAssessmentQIndex = vendor.assessmentQuestionnaires.length - 1;
                syncActiveAssessment(vendor);
                saveVendors();
                selectQModal.removeAttribute('data-mode');
                selectQModal.classList.add('hidden');
                renderAssessmentQuestionnaire(currentActiveVendorId);
                renderComplianceScanResults(currentActiveVendorId);
                showToast(`"${q.name}" added to this vendor's questionnaires.`);
                return;
            }

            // Default flow: Intake questionnaire being sent to the vendor POC via email
            vendor.activeQuestionnaireId = q.id;
            // Save a snapshot in case the original is deleted/modified
            vendor.activeQuestionnaireSnapshot = JSON.parse(JSON.stringify(q));
            saveVendors();
                
                const emailToInput = document.getElementById('email-to');
                if (emailToInput) emailToInput.value = vendor.poc || 'vendor-poc@example.com';
                
                const list = document.getElementById('email-attachments-list');
                if (list) {
                    list.innerHTML = `
                        <div style="display: flex; gap: 0.5rem; align-items: center;" class="email-attachment-item" id="default-attachment">
                            <div style="display: flex; align-items: center; border: 1px solid var(--primary); background: rgba(59, 130, 246, 0.2); border-radius: 4px; padding-right: 0.5rem;">
                                <div id="email-attachment-chip" style="color: var(--primary); padding: 0.5rem 0.5rem 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                    ${q.name}.form
                                </div>
                                <span class="remove-attachment-btn" data-target="default-attachment" style="color: var(--text-muted); cursor: pointer; padding: 0 0.5rem; font-weight: bold; font-size: 1.2rem; line-height: 1;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'" title="Remove attachment">&times;</span>
                            </div>
                        </div>
                    `;
                }
                
                selectQModal.classList.add('hidden');
                const modal = document.getElementById('email-modal-overlay');
                if (modal) modal.classList.remove('hidden');
        }

        if (e.target.closest('#fill-intake-btn')) {
            e.preventDefault();
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (!vendor || !vendor.activeQuestionnaireSnapshot) {
                showToast('No questionnaire has been sent to this vendor yet! Use "Send Intake" first.');
                return;
            }
            
            const container = document.getElementById('internal-intake-questions-container');
            if (container) {
                container.innerHTML = vendor.activeQuestionnaireSnapshot.questions.map((q, i) => `
                    <div class="input-group">
                        <label>${q}</label>
                        <select id="internal-intake-q${i+1}" class="select-input" required>
                            <option value="">Select...</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                `).join('');
            }
            
            const intakeModalOverlay = document.getElementById('intake-modal-overlay');
            if (intakeModalOverlay) intakeModalOverlay.classList.remove('hidden');
            const intakeForm = document.getElementById('intake-form');
            if (intakeForm) intakeForm.reset();
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-attachment-btn')) {
            const targetId = e.target.getAttribute('data-target');
            const item = document.getElementById(targetId);
            if (item) item.remove();
        }

        if (e.target.id === 'portal-cancel-btn') {
            document.getElementById('intake-portal-view').classList.add('hidden');
        }
    });

    document.addEventListener('submit', (e) => {
        if (e.target.id === 'portal-intake-form') {
            e.preventDefault();
            const vendorId = e.target.getAttribute('data-vendor-id');
            const vendor = vendors.find(v => v.id == vendorId);
            if (!vendor || !vendor.activeQuestionnaireSnapshot) return;
            
            const qs = vendor.activeQuestionnaireSnapshot.questions;
            
            // Show AI analyzing loading state inside the portal
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="loading-spinner" style="display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 1s linear infinite; margin-right:8px;"></span> AI Analyzing Responses...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                let score = 0;
                let answers = [];
                let explanations = [];
                
                for(let i=1; i<=qs.length; i++) {
                    const val = document.getElementById(`portal-q${i}`).value;
                    answers.push(val);
                    if (val === 'yes') {
                        // Dynamic AI scoring
                        const weight = Math.floor(Math.random() * 20) + 10;
                        score += weight;
                        explanations.push(`Identified positive risk signal in Q${i} (+${weight})`);
                    } else if (val === 'no') {
                        score += 5;
                    }
                }
                
                // Cap score
                if (score > 100) score = 100;
                
                let risk = 'Low';
                if (score >= 65) risk = 'High';
                else if (score >= 35) risk = 'Medium';
                
                vendor.intakeAnswers = answers;
                vendor.inherentRisk = score;
                vendor.scoreExplanation = `<strong>AI Inherent Risk Analysis:</strong><br><br>The AI model processed ${qs.length} responses. ${explanations.length > 0 ? explanations.join('<br>') : 'No significant positive risk factors identified.'}<br><br><strong>Calculated Inherent Risk Score: ${score}/100.</strong>`;
                
                if (vendor.risk === 'Pending POC Response' || vendor.risk === 'Pending') {
                    vendor.risk = risk;
                    vendor.score = risk;
                }
                
                saveVendors();
                document.getElementById('intake-portal-view').classList.add('hidden');
                
                if (currentActiveVendorId == vendorId) {
                    openVendorDetail(vendorId);
                }
                renderVendors(vendors);
                updateDashboardStats();
                
                showToast('Portal responses analyzed by AI successfully!');
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 1500); // 1.5s simulated AI analysis delay
        }
    });
    
    const emailAttachFile = document.getElementById('email-attach-file');
    if (emailAttachFile) {
        emailAttachFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const list = document.getElementById('email-attachments-list');
                if (list) {
                    Array.from(e.target.files).forEach(file => {
                        const fileId = 'attach-' + Math.random().toString(36).substr(2, 9);
                        const chipHtml = `
                            <div style="display: flex; gap: 0.5rem; align-items: center;" class="email-attachment-item" id="${fileId}">
                                <div style="display: flex; align-items: center; border: 1px solid var(--primary); background: rgba(59, 130, 246, 0.2); border-radius: 4px; padding-right: 0.5rem;">
                                    <div style="color: var(--primary); padding: 0.5rem 0.5rem 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                        ${file.name}
                                    </div>
                                    <span class="remove-attachment-btn" data-target="${fileId}" style="color: var(--text-muted); cursor: pointer; padding: 0 0.5rem; font-weight: bold; font-size: 1.2rem; line-height: 1;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'" title="Remove attachment">&times;</span>
                                </div>
                            </div>
                        `;
                        list.insertAdjacentHTML('beforeend', chipHtml);
                    });
                }
                
                showToast(`${e.target.files.length} file(s) attached successfully!`);
                e.target.value = '';
            }
        });
    }

    const closeIntakeModalBtn = document.getElementById('close-intake-modal');
    const cancelIntakeModalBtn = document.getElementById('cancel-intake-modal');
    const intakeForm = document.getElementById('intake-form');
    const intakeModalOverlay = document.getElementById('intake-modal-overlay');

    const closeIntakeModal = () => intakeModalOverlay.classList.add('hidden');
    if (closeIntakeModalBtn) closeIntakeModalBtn.addEventListener('click', closeIntakeModal);
    if (cancelIntakeModalBtn) cancelIntakeModalBtn.addEventListener('click', closeIntakeModal);

    if (intakeForm) {
        intakeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (!vendor || !vendor.activeQuestionnaireSnapshot) return;
            
            const qs = vendor.activeQuestionnaireSnapshot.questions;
            
            // Show AI analyzing loading state
            const submitBtn = intakeForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="loading-spinner" style="display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 1s linear infinite; margin-right:8px;"></span> AI Analyzing Responses...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                let score = 0;
                let answers = [];
                let explanations = [];
                
                for(let i=1; i<=qs.length; i++) {
                    const selectEl = document.getElementById(`internal-intake-q${i}`);
                    if (!selectEl) continue;
                    const val = selectEl.value;
                    answers.push(val);
                    if (val === 'yes') {
                        const weight = Math.floor(Math.random() * 20) + 10;
                        score += weight;
                        explanations.push(`Identified positive risk signal in Q${i} (+${weight})`);
                    } else if (val === 'no') {
                        score += 5;
                    }
                }
                
                if (score > 100) score = 100;
                
                let risk = 'Low';
                if (score >= 65) risk = 'High';
                else if (score >= 35) risk = 'Medium';
                
                vendor.intakeAnswers = answers;
                vendor.inherentRisk = score;
                vendor.scoreExplanation = `<strong>AI Inherent Risk Analysis:</strong><br><br>The AI model processed ${qs.length} internal responses. ${explanations.length > 0 ? explanations.join('<br>') : 'No significant positive risk factors identified.'}<br><br><strong>Calculated Inherent Risk Score: ${score}/100.</strong>`;
                
                if (vendor.risk === 'Pending POC Response' || vendor.risk === 'Pending') {
                    vendor.risk = risk;
                    vendor.score = risk;
                }
                
                saveVendors();
                closeIntakeModal();
                openVendorDetail(currentActiveVendorId);
                showToast('Internal Intake completed and Inherent Risk updated via AI!');
                renderVendors(vendors); 
                updateDashboardStats();
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 1500);
        });
    }
    // AI Interpret Logic
    const aiInterpretBtn = document.getElementById('ai-interpret-btn');
    const aiSummaryPanel = document.getElementById('ai-summary-panel');
    const aiSummaryLoading = document.getElementById('ai-summary-loading');
    const aiSummaryContent = document.getElementById('ai-summary-content');
    const aiSummaryText = document.getElementById('ai-summary-text');
    const aiSummaryChips = document.getElementById('ai-summary-chips');
    const aiSummaryRecommendations = document.getElementById('ai-summary-recommendations');

    if (aiInterpretBtn) {
        aiInterpretBtn.addEventListener('click', () => {
            if (vendors.length === 0) {
                showToast("No vendor data available to analyze.");
                return;
            }

            // Show panel and loading state
            aiSummaryPanel.classList.remove('hidden');
            aiSummaryLoading.style.display = 'flex';
            aiSummaryContent.classList.add('hidden');
            
            // Disable button during processing
            aiInterpretBtn.disabled = true;
            aiInterpretBtn.style.opacity = '0.7';
            aiInterpretBtn.style.cursor = 'not-allowed';

            // ---- Calculate metrics for AI text generation ----
            const total = vendors.length;
            const highRiskCount = vendors.filter(v => v.risk === 'High').length;
            const mediumRiskCount = vendors.filter(v => v.risk === 'Medium').length;
            const lowRiskCount = vendors.filter(v => v.risk === 'Low').length;
            const pendingCount = vendors.filter(v => v.score === 'Pending').length;
            const completedCount = total - pendingCount;
            const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
            const avgInherent = Math.round(vendors.reduce((acc, v) => acc + (v.inherentRisk || getInherentRisk(v.type, v.dataType) || 0), 0) / total) || 0;

            // Average score among completed assessments only
            const completedVendors = vendors.filter(v => typeof v.score === 'number');
            const avgScore = completedVendors.length > 0
                ? Math.round(completedVendors.reduce((acc, v) => acc + v.score, 0) / completedVendors.length)
                : null;

            // Most common vendor type
            const types = {};
            vendors.forEach(v => { types[v.type] = (types[v.type] || 0) + 1; });
            const topType = Object.keys(types).length > 0 ? Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b) : 'N/A';
            const topTypeCount = types[topType] || 0;

            // Most common sensitive data type among vendors
            const dataTypes = {};
            vendors.forEach(v => { if (v.dataType) dataTypes[v.dataType] = (dataTypes[v.dataType] || 0) + 1; });
            const sensitiveCount = vendors.filter(v => v.dataType === 'PII' || v.dataType === 'PHI' || v.dataType === 'Financial').length;

            // Overdue reviews (nextReview date already in the past)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdueVendors = vendors.filter(v => v.nextReview && !isNaN(new Date(v.nextReview)) && new Date(v.nextReview) < today);

            // High risk vendors still pending assessment — the biggest blind spot
            const highRiskPending = vendors.filter(v => v.risk === 'High' && v.score === 'Pending').length;

            const postureLabel = highRiskCount > total * 0.3 ? 'concerning' : (highRiskCount > total * 0.15 ? 'moderate' : 'relatively stable');

            // ---- Key metric chips ----
            const chips = [
                { label: 'Total Vendors', value: total },
                { label: 'Completion Rate', value: `${completionRate}%` },
                { label: 'Avg Inherent Risk', value: `${avgInherent}/100` },
                { label: 'Avg Assessment Score', value: avgScore !== null ? `${avgScore}/100` : 'N/A' },
                { label: 'Overdue Reviews', value: overdueVendors.length },
            ];
            const chipsHTML = chips.map(c => `
                <div class="ai-summary-chip">
                    <span class="chip-label">${c.label}</span>
                    <span class="chip-value">${c.value}</span>
                </div>`).join('');

            // ---- Generate Detailed AI Summary Narrative ----
            const intro = `Based on a comprehensive AI-driven analysis of your <strong>${total} active vendor${total !== 1 ? 's' : ''}</strong>, your overall third-party risk posture is assessed as <strong>${postureLabel}</strong>. ${completionRate}% of assessments are complete, giving ${completionRate >= 70 ? 'strong' : completionRate >= 40 ? 'partial' : 'limited'} visibility into your actual risk exposure at this time.`;

            const riskDetail = `Currently, <strong>${highRiskCount} vendor${highRiskCount !== 1 ? 's' : ''}</strong> are classified as High Risk (${(highRiskCount/total*100 || 0).toFixed(1)}% of your portfolio), with ${mediumRiskCount} at Medium Risk and ${lowRiskCount} at Low Risk. The average inherent risk score across your supply chain sits at <strong>${avgInherent}/100</strong>${avgScore !== null ? `, while completed assessments average <strong>${avgScore}/100</strong> on actual residual risk` : ''}. ${highRiskPending > 0 ? `Notably, <strong>${highRiskPending} High Risk vendor${highRiskPending !== 1 ? 's' : ''}</strong> still ${highRiskPending !== 1 ? 'have' : 'has'} no completed assessment — this is your most urgent blind spot.` : 'All High Risk vendors currently have a completed assessment on file, which is good assessment hygiene.'}`;

            const composition = `Your vendor ecosystem is predominantly composed of <strong>${topType}</strong> providers (${topTypeCount} of ${total}). ${sensitiveCount > 0 ? `<strong>${sensitiveCount} vendor${sensitiveCount !== 1 ? 's' : ''}</strong> handle sensitive data categories (PII, PHI, or Financial), which inherently raises the impact of any control failure in that subset.` : 'Few or no vendors in your portfolio handle highly sensitive data categories, which moderates overall impact exposure.'} A concentration in a single vendor type or data category presents systemic risk should a sector-wide vulnerability emerge, and warrants contingency planning.`;

            const operational = `Operationally, there are <strong>${pendingCount} assessment${pendingCount !== 1 ? 's' : ''} pending review</strong>${overdueVendors.length > 0 ? `, and <strong>${overdueVendors.length} vendor review${overdueVendors.length !== 1 ? 's are' : ' is'} now overdue</strong> based on the scheduled next review date` : ', though no reviews are currently overdue'}. ${pendingCount > total * 0.4 ? 'This represents a significant compliance bottleneck' : 'This is a manageable backlog'}, and closing it should be prioritized to maintain full visibility into your supply chain risk profile.`;

            const summaryHTML = `<p>${intro}</p><br><p>${riskDetail}</p><br><p>${composition}</p><br><p>${operational}</p>`;

            // ---- Recommendations (concrete, prioritized) ----
            const recommendations = [];
            if (highRiskPending > 0) {
                recommendations.push(`Prioritize completing assessments for the <strong>${highRiskPending}</strong> High Risk vendor${highRiskPending !== 1 ? 's' : ''} with no score on file — this is your largest unmitigated exposure.`);
            }
            if (overdueVendors.length > 0) {
                recommendations.push(`Reschedule and follow up on <strong>${overdueVendors.length}</strong> overdue vendor review${overdueVendors.length !== 1 ? 's' : ''} to keep your assessment cadence current.`);
            }
            if (pendingCount > 0) {
                recommendations.push(`Allocate analyst bandwidth to close out the remaining <strong>${pendingCount}</strong> pending assessment${pendingCount !== 1 ? 's' : ''} and raise your completion rate above ${Math.min(completionRate + 20, 100)}%.`);
            }
            if (sensitiveCount > 0) {
                recommendations.push(`Apply enhanced due diligence (e.g. SOC 2, data handling addenda) to the <strong>${sensitiveCount}</strong> vendor${sensitiveCount !== 1 ? 's' : ''} processing PII, PHI, or financial data.`);
            }
            if (topTypeCount > total * 0.4) {
                recommendations.push(`Diversify or build contingency plans around <strong>${topType}</strong> providers, which represent over ${Math.round(topTypeCount/total*100)}% of your portfolio.`);
            }
            if (recommendations.length === 0) {
                recommendations.push('Your vendor risk program is in good shape — maintain current assessment cadence and continue monitoring for new High Risk vendors as your portfolio grows.');
            }

            const recommendationsHTML = `
                <h4>Recommended Next Steps</h4>
                <ul>
                    ${recommendations.map((r, i) => `<li><span class="rec-bullet">${i + 1}</span><span>${r}</span></li>`).join('')}
                </ul>`;

            // Simulate API delay
            setTimeout(() => {
                aiSummaryLoading.style.display = 'none';
                if (aiSummaryChips) aiSummaryChips.innerHTML = chipsHTML;
                aiSummaryText.innerHTML = summaryHTML;
                if (aiSummaryRecommendations) aiSummaryRecommendations.innerHTML = recommendationsHTML;
                aiSummaryContent.classList.remove('hidden');
                
                // Re-enable button
                aiInterpretBtn.disabled = false;
                aiInterpretBtn.style.opacity = '1';
                aiInterpretBtn.style.cursor = 'pointer';
            }, 2500);
        });
    }


    // Import/Export Logic
    const exportVendorsToCsv = (list, filename) => {
        if (!list || list.length === 0) {
            showToast("No data to export!");
            return;
        }
        const headers = ["Vendor Name", "Type", "Data Type", "Risk", "Score", "POC", "Next Review", "Assessor"];
        const rows = list.map(v => [
            `"${v.name}"`, `"${v.type}"`, `"${v.dataType}"`, `"${v.risk}"`, `"${v.score}"`, `"${v.poc}"`, `"${v.nextReview}"`, `"${v.assessor}"`
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename || "tprm_vendors_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToCSV = () => exportVendorsToCsv(vendors, "tprm_vendors_export.csv");

    // ============================================================
    // Vendor Document Storage
    //
    // Stores extracted, searchable TEXT from uploaded evidence documents
    // against the vendor record (vendor.documents = [{ name, text, uploadedAt }]).
    // We deliberately store extracted text, not raw file bytes, since text
    // is what the compliance scan engine below actually needs to search.
    // ============================================================

    // Generic plain-text extraction from a PDF (joins all pages with separators).
    const extractTextFromPdf = (file) => {
        return new Promise((resolve, reject) => {
            if (typeof pdfjsLib === 'undefined') {
                reject(new Error('PDF library failed to load. Check your internet connection and try again.'));
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const typedArray = new Uint8Array(ev.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                    const pages = [];
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        pages.push({ pageNum: i, text: content.items.map(item => item.str).join(' ') });
                    }
                    resolve({ text: pages.map(p => p.text).join('\n\n'), pages });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Could not read PDF file.'));
            reader.readAsArrayBuffer(file);
        });
    };

    // Splits a flat block of text into synthetic "pages" of roughly maxChars
    // each. Breaks on paragraph boundaries when present, but ALSO falls back to
    // sentence and hard-character splitting when the text has few/no paragraph
    // breaks (very common for text extracted from PDFs/Word, which often comes
    // out as one giant run). Without this fallback everything collapses onto a
    // single "page 1", which is the bug we are fixing.
    const paginateFlatText = (text, maxChars = 1800) => {
        if (!text || !text.trim()) return [{ pageNum: 1, text: '' }];

        // First break into chunks on paragraph boundaries.
        let chunks = text.split(/\n{2,}/).filter(c => c.trim().length);

        // If any single chunk is much larger than maxChars (no paragraph breaks),
        // further split it on sentence boundaries, then hard-split if still huge.
        const splitLarge = (chunk) => {
            if (chunk.length <= maxChars) return [chunk];
            const sentences = chunk.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [chunk];
            const out = [];
            let buf = '';
            for (const s of sentences) {
                if (buf.length + s.length > maxChars && buf.length > 0) {
                    out.push(buf.trim());
                    buf = '';
                }
                if (s.length > maxChars) {
                    // A single sentence longer than a page: hard-split by chars.
                    for (let i = 0; i < s.length; i += maxChars) out.push(s.slice(i, i + maxChars).trim());
                } else {
                    buf += s;
                }
            }
            if (buf.trim()) out.push(buf.trim());
            return out;
        };

        const expanded = [];
        chunks.forEach(c => splitLarge(c).forEach(piece => expanded.push(piece)));

        // Now pack the pieces into pages up to maxChars each.
        const pages = [];
        let current = '';
        let pageNum = 1;
        for (const piece of expanded) {
            if (current.length + piece.length > maxChars && current.length > 0) {
                pages.push({ pageNum, text: current.trim() });
                pageNum++;
                current = '';
            }
            current += piece + '\n\n';
        }
        if (current.trim().length > 0) pages.push({ pageNum, text: current.trim() });
        if (pages.length === 0) pages.push({ pageNum: 1, text: text });
        return pages;
    };

    // Generic plain-text extraction from an Excel/CSV file (flattens all cells).
    // Each sheet becomes its own "page" so evidence can cite the sheet.
    const extractTextFromExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const workbook = XLSX.read(ev.target.result, { type: 'binary' });
                    const pages = workbook.SheetNames.map((sheetName, idx) => {
                        const sheet = workbook.Sheets[sheetName];
                        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
                        return { pageNum: idx + 1, label: sheetName, text: rows.map(row => (row || []).join(' | ')).join('\n') };
                    });
                    resolve({ text: pages.map(p => p.text).join('\n\n'), pages });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Could not read Excel/CSV file.'));
            reader.readAsBinaryString(file);
        });
    };

    // Plain text / markdown files.
    const extractTextFromPlainText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                resolve({ text, pages: paginateFlatText(text) });
            };
            reader.onerror = () => reject(new Error('Could not read text file.'));
            reader.readAsText(file);
        });
    };

    // Word (.docx) extraction: a .docx is a zip archive containing XML.
    // We unzip it with JSZip, pull out word/document.xml, and strip tags
    // to get plain text. This avoids needing a heavier library since we
    // only need searchable text, not formatting.
    const extractTextFromDocx = (file) => {
        return new Promise((resolve, reject) => {
            if (typeof JSZip === 'undefined') {
                reject(new Error('Word document library failed to load. Check your internet connection and try again.'));
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const zip = await JSZip.loadAsync(ev.target.result);
                    const docXmlFile = zip.file('word/document.xml');
                    if (!docXmlFile) {
                        reject(new Error('Could not find document content inside this .docx file.'));
                        return;
                    }
                    const xml = await docXmlFile.async('string');
                    // Word wraps paragraphs in <w:p>; insert a newline at each
                    // paragraph boundary before stripping tags, so text doesn't
                    // all run together into one unreadable block.
                    const withBreaks = xml.replace(/<\/w:p>/g, '\n\n');
                    const text = withBreaks.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
                    resolve({ text, pages: paginateFlatText(text) });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Could not read Word document.'));
            reader.readAsArrayBuffer(file);
        });
    };

    // Link/URL extraction: fetches the page and strips HTML tags to get
    // visible text. IMPORTANT LIMITATION: browsers enforce CORS, so this
    // only works for URLs that explicitly allow cross-origin access. Most
    // websites do not, and there is no backend proxy in this app to work
    // around that. We surface a clear, honest error rather than failing
    // silently or pretending it always works.
    const extractTextFromUrl = async (url) => {
        let response;
        try {
            response = await fetch(url, { mode: 'cors' });
        } catch (err) {
            throw new Error('Could not fetch this URL. Most websites block cross-origin requests from browser-based apps like this one (CORS), so this only works for pages that explicitly allow it. Try downloading the page/document and uploading the file instead.');
        }
        if (!response.ok) {
            throw new Error(`The server responded with status ${response.status}. The page may not exist or may be blocking automated access.`);
        }
        const html = await response.text();
        // Strip script/style blocks first so their contents don't pollute the text,
        // then strip remaining tags and collapse whitespace.
        const withoutScripts = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
        const text = withoutScripts.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) {
            throw new Error('The page loaded, but no readable text content could be extracted from it.');
        }
        return { text, pages: paginateFlatText(text) };
    };

    // Dispatches to the right extractor based on file extension.
    const extractDocumentText = async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') return extractTextFromPdf(file);
        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return extractTextFromExcel(file);
        if (ext === 'docx') return extractTextFromDocx(file);
        if (ext === 'txt' || ext === 'md') return extractTextFromPlainText(file);
        throw new Error(`Unsupported file type ".${ext}". Please upload a PDF, Word, Excel, CSV, or text file.`);
    };

    // Renders the list of uploaded evidence documents for the active vendor.
    const renderVendorDocuments = () => {
        const vendor = vendors.find(v => v.id == currentActiveVendorId);
        const listEl = document.getElementById('vendor-documents-list');
        if (!listEl) return;

        if (!vendor || !vendor.documents || vendor.documents.length === 0) {
            listEl.innerHTML = `<p class="empty-mini-state" style="padding: 0.5rem 0;">No documents uploaded yet.</p>`;
            return;
        }

        listEl.innerHTML = vendor.documents.map((doc, idx) => `
            <div class="uploaded-doc-item">
                <div class="uploaded-doc-info">
                    ${doc.isLink
                        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`
                        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
                    }
                    ${doc.isLink
                        ? `<a href="${doc.name}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${doc.name}</a>`
                        : `<span>${doc.name}</span>`
                    }
                    <span class="uploaded-doc-meta">${new Date(doc.uploadedAt).toLocaleDateString()}</span>
                </div>
                <button class="action-btn remove-doc-btn" data-idx="${idx}" style="color: var(--danger);">Remove</button>
            </div>
        `).join('');

        listEl.querySelectorAll('.remove-doc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = vendors.find(vv => vv.id == currentActiveVendorId);
                if (!v) return;
                v.documents.splice(parseInt(btn.getAttribute('data-idx')), 1);
                saveVendors();
                renderVendorDocuments();
                showToast('Document removed.');
            });
        });
    };

    const docUploadInput = document.getElementById('doc-upload');
    if (docUploadInput) {
        docUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (!vendor) { e.target.value = ''; return; }

            showToast(`Reading ${file.name}...`);
            try {
                const result = await extractDocumentText(file);
                const text = typeof result === 'string' ? result : (result.text || '');
                const pages = (result && result.pages) ? result.pages : [{ pageNum: 1, text }];
                if (!vendor.documents) vendor.documents = [];
                vendor.documents.push({ name: file.name, text, pages, uploadedAt: Date.now() });
                saveVendors();
                renderVendorDocuments();
                showToast(`"${file.name}" uploaded and indexed for compliance scanning.`);
            } catch (err) {
                console.error(err);
                showToast(`Could not process "${file.name}": ${err.message}`);
            }
            e.target.value = '';
        });
    }

    const docLinkInput = document.getElementById('doc-link-input');
    const docLinkAddBtn = document.getElementById('doc-link-add-btn');
    if (docLinkAddBtn && docLinkInput) {
        docLinkAddBtn.addEventListener('click', async () => {
            const url = docLinkInput.value.trim();
            if (!url) {
                showToast('Please enter a URL first.');
                return;
            }
            let parsedUrl;
            try {
                parsedUrl = new URL(url);
                if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('bad protocol');
            } catch {
                showToast('Please enter a valid URL, e.g. https://example.com/security');
                return;
            }

            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (!vendor) return;

            docLinkAddBtn.disabled = true;
            docLinkAddBtn.textContent = 'Fetching...';
            showToast(`Fetching ${parsedUrl.hostname}...`);

            try {
                const result = await extractTextFromUrl(url);
                const text = typeof result === 'string' ? result : (result.text || '');
                const pages = (result && result.pages) ? result.pages : [{ pageNum: 1, text }];
                if (!vendor.documents) vendor.documents = [];
                vendor.documents.push({ name: url, text, pages, uploadedAt: Date.now(), isLink: true });
                saveVendors();
                renderVendorDocuments();
                showToast(`Link added and indexed for compliance scanning.`);
                docLinkInput.value = '';
            } catch (err) {
                console.error(err);
                showToast(err.message);
            } finally {
                docLinkAddBtn.disabled = false;
                docLinkAddBtn.textContent = 'Add Link';
            }
        });

        // Allow pressing Enter in the URL field to trigger the same action
        docLinkInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                docLinkAddBtn.click();
            }
        });
    }

    const runScanBtn = document.getElementById('run-scan-btn');
    if (runScanBtn) {
        runScanBtn.addEventListener('click', () => {
            if (!currentActiveVendorId) return;
            window.runComplianceScan(currentActiveVendorId);
        });
    }

    // ============================================================
    // Compliance Scan Algorithm
    //
    // For each assessment question:
    //   1. Extract topic keywords from the question text.
    //   2. Search all of the vendor's uploaded document text for matches,
    //      scoring and ranking relevant excerpts.
    //   3. Combine evidence strength with the vendor's Yes/No/N/A answer
    //      using the compliance rules below.
    //   4. ALWAYS leave the result open to human review via an editable
    //      compliance dropdown — the AI's rating is a starting suggestion,
    //      never a final, locked answer.
    //
    // Compliance rules (as specified):
    //   - Compliant:            evidence found AND vendor answered Yes
    //   - Partially Compliant:  weak/partial evidence, OR AI is unsure,
    //                           AND vendor answered Yes or N/A
    //   - Not Compliant:        no evidence found, OR vendor answered No
    // ============================================================

    // Stopword list so keyword extraction focuses on the meaningful,
    // distinguishing terms in a question rather than filler words — this
    // includes both ordinary English stopwords AND generic compliance-
    // document words (report, system, process, test, etc.) that appear
    // constantly across unrelated topics and would otherwise create
    // false-positive "evidence found" matches just from coincidental
    // word overlap rather than real topical relevance.
    const STOPWORDS = new Set([
        'the','is','are','a','an','of','to','in','on','for','and','or','does',
        'do','did','has','have','had','this','that','with','by','as','it','its',
        'be','been','being','was','were','will','would','can','could','should',
        'their','they','them','vendor','provide','provides','providing','any',
        'all','what','which','who','whom','at','from','into','about','if','not',
        'report','reports','reported','recent','completed','complete','process',
        'processes','organization','document','documents','documented','policy',
        'policies','system','systems','service','services','data','information',
        'test','tested','testing','tests'
    ]);

    // Pulls out the meaningful keywords/phrases from a question, including
    // common compliance acronyms kept intact (SOC 2, MFA, PII, etc).
    // Maps common compliance concepts to related terms, so a question about
    // one phrasing still matches documents that use a synonym. Bidirectional
    // expansion makes the matcher far more forgiving of vocabulary mismatch.
    const SYNONYM_GROUPS = [
        ['encrypt', 'encrypted', 'encryption', 'aes', 'tls', 'ssl', 'cipher'],
        ['mfa', 'multifactor', 'multi-factor', '2fa', 'two-factor', 'authentication'],
        ['soc', 'soc2', 'soc 2', 'sox', 'iso27001', 'iso 27001', 'attestation', 'certification', 'certified'],
        ['backup', 'backups', 'recovery', 'disaster', 'continuity', 'resilience', 'restore'],
        ['pii', 'phi', 'personal', 'sensitive', 'confidential', 'gdpr', 'hipaa', 'privacy'],
        ['incident', 'breach', 'response', 'notification', 'remediation'],
        ['access', 'authorization', 'rbac', 'privilege', 'permission', 'least-privilege'],
        ['vulnerability', 'patch', 'patching', 'penetration', 'pentest', 'scanning', 'remediate'],
        ['insurance', 'liability', 'coverage', 'cyber', 'indemnity'],
        ['audit', 'auditing', 'logging', 'logs', 'monitoring', 'monitor'],
        ['training', 'awareness', 'education'],
        ['retention', 'disposal', 'deletion', 'destruction'],
        ['vendor', 'subcontractor', 'third-party', 'supplier', 'fourth-party'],
    ];

    // Light stemmer: collapses common English suffixes so "encrypted",
    // "encryption", "encrypting" all reduce to a shared stem for matching.
    const stem = (w) => {
        return w
            .replace(/(ization|isation)$/,'ize')
            .replace(/(ed|ing|ly|es|s|tion|sion|ment|ness|ity)$/,'')
            .replace(/i$/,'y');
    };

    const expandWithSynonyms = (words) => {
        const expanded = new Set(words);
        words.forEach(w => {
            SYNONYM_GROUPS.forEach(group => {
                if (group.includes(w) || group.some(g => stem(g) === stem(w))) {
                    group.forEach(g => expanded.add(g));
                }
            });
        });
        return [...expanded];
    };

    const extractQuestionKeywords = (questionText) => {
        const cleaned = questionText.replace(/^\d+[\.\)]\s*/, ''); // strip leading "1. "
        const rawWords = cleaned
            .toLowerCase()
            .replace(/[^\w\s\-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOPWORDS.has(w));

        const baseWords = [...new Set(rawWords)];
        // Synonym-expanded keyword set used for searching documents.
        const keywords = expandWithSynonyms(baseWords);

        // 2-word phrases (from the ORIGINAL words, not synonyms) for stronger
        // contextual matches like "data encrypted", "incident response".
        const phrases = [];
        for (let i = 0; i < rawWords.length - 1; i++) {
            phrases.push(`${rawWords[i]} ${rawWords[i + 1]}`);
        }

        // baseWords drives the coverage metric (how much of the ACTUAL question
        // is covered); keywords (with synonyms) drives where we look.
        return { keywords: [...new Set(keywords)], phrases: [...new Set(phrases)], baseWords };
    };

    // Searches a document PAGE BY PAGE for the given keywords/phrases. Each
    // returned match knows which page it came from and how many distinct
    // question keywords appear near it — so we can surface the excerpts that
    // match the MOST keywords (the strongest evidence) and cite a page number.
    const searchDocumentForKeywords = (doc, keywords, phrases) => {
        const matches = [];
        // Use stored per-page structure when available. If a document only has
        // a single page (older uploads, or a fallback) but its text is long,
        // re-paginate on the fly so we can still cite distinct page numbers.
        let pages = (doc.pages && doc.pages.length > 1)
            ? doc.pages
            : paginateFlatText((doc.pages && doc.pages[0] && doc.pages[0].text) || doc.text || '');

        pages.forEach(page => {
            const pageText = page.text || '';
            const lowerText = pageText.toLowerCase();

            // Collect every hit position (keyword or phrase) on this page.
            const hits = [];
            phrases.forEach(phrase => {
                let idx = lowerText.indexOf(phrase);
                while (idx !== -1) {
                    hits.push({ idx, term: phrase, isPhrase: true });
                    idx = lowerText.indexOf(phrase, idx + phrase.length);
                }
            });
            keywords.forEach(kw => {
                let idx = lowerText.indexOf(kw);
                while (idx !== -1) {
                    hits.push({ idx, term: kw, isPhrase: false });
                    idx = lowerText.indexOf(kw, idx + kw.length);
                }
            });
            if (hits.length === 0) return;

            hits.sort((a, b) => a.idx - b.idx);

            // Cluster nearby hits (within ~220 chars) into a single excerpt, so
            // one excerpt can credit several keywords that appear close together.
            const WINDOW = 220;
            let cluster = [hits[0]];
            const flushCluster = (c) => {
                const first = c[0].idx;
                const last = c[c.length - 1].idx + c[c.length - 1].term.length;
                // Expand outward to full sentence boundaries so we show the
                // WHOLE sentence the keyword appears in, not a mid-word slice.
                let start = first;
                while (start > 0 && !/[.!?\n]/.test(pageText[start - 1])) start--;
                let end = last;
                while (end < pageText.length && !/[.!?\n]/.test(pageText[end])) end++;
                if (end < pageText.length) end++; // include the terminating punctuation
                // Guard against pathologically long runs with no punctuation.
                if (end - start > 600) {
                    start = Math.max(0, first - 120);
                    end = Math.min(pageText.length, last + 120);
                }
                const distinctTerms = new Set(c.map(h => h.term.split(' ')[0])); // count distinct underlying keywords
                const hasPhrase = c.some(h => h.isPhrase);
                matches.push({
                    docName: doc.name,
                    pageNum: page.pageNum,
                    pageLabel: page.label || null,
                    excerpt: pageText.slice(start, end).trim(),
                    matchCount: distinctTerms.size,           // how many distinct keywords this excerpt covers
                    matchedTerms: [...new Set(c.map(h => h.term))],
                    hasPhrase,
                    // Composite score: keyword breadth dominates, phrase presence is a bonus.
                    score: distinctTerms.size * 2 + (hasPhrase ? 1 : 0)
                });
            };
            for (let i = 1; i < hits.length; i++) {
                if (hits[i].idx - cluster[cluster.length - 1].idx <= WINDOW) {
                    cluster.push(hits[i]);
                } else {
                    flushCluster(cluster);
                    cluster = [hits[i]];
                }
            }
            flushCluster(cluster);
        });

        return matches;
    };

    // Runs the full scan for one question against all of a vendor's documents.
    // Returns ranked evidence (best/most-keyword-matching first) with page
    // numbers, plus a confidence level and the matched-keyword set.
    const scanQuestionAgainstDocuments = (questionText, documents, learnedKeywords = []) => {
        const extracted = extractQuestionKeywords(questionText);
        const baseWords = extracted.baseWords;
        const phrases = extracted.phrases;
        // Merge in keywords learned from assessor feedback corrections. These
        // widen the search (so a previously-missed concept now gets found) but
        // do NOT count toward baseWords coverage, keeping the metric honest.
        const keywords = [...new Set([...extracted.keywords, ...learnedKeywords.map(k => k.toLowerCase())])];

        if (!documents || documents.length === 0 || keywords.length === 0) {
            return { evidence: [], confidence: 'none', keywordCoverage: 0, totalKeywords: baseWords.length, matchedKeywordList: [], documentsSearched: documents ? documents.length : 0, documentsMatched: 0 };
        }

        let allMatches = [];
        documents.forEach(doc => {
            allMatches = allMatches.concat(searchDocumentForKeywords(doc, keywords, phrases));
        });

        if (allMatches.length === 0) {
            return { evidence: [], confidence: 'none', keywordCoverage: 0, totalKeywords: baseWords.length, matchedKeywordList: [], documentsSearched: documents.length, documentsMatched: 0 };
        }

        // Coverage is measured against the ORIGINAL question words (baseWords),
        // not the synonym-expanded set — so "3 of 4 question terms found" is
        // honest, while synonyms still widen WHERE we look.
        const matchedTermStems = new Set();
        allMatches.forEach(m => m.matchedTerms.forEach(t => matchedTermStems.add(stem(t.split(' ')[0]))));
        const coveredBase = baseWords.filter(bw => matchedTermStems.has(stem(bw)) || [...matchedTermStems].some(ms => SYNONYM_GROUPS.some(g => g.map(stem).includes(ms) && g.map(stem).includes(stem(bw)))));
        const keywordCoverage = baseWords.length > 0 ? coveredBase.length / baseWords.length : 0;
        const anyPhrase = allMatches.some(m => m.hasPhrase);

        // Rank by score, then dedupe. To make sure MULTIPLE documents are
        // represented (not just the highest-scoring one), we round-robin the
        // top excerpts across distinct documents before filling remaining slots.
        const deduped = [];
        const seen = new Set();
        allMatches
            .sort((a, b) => b.score - a.score || b.matchCount - a.matchCount)
            .forEach(m => {
                const key = m.docName + ':' + m.pageNum + ':' + m.excerpt.slice(0, 40);
                if (!seen.has(key)) { seen.add(key); deduped.push(m); }
            });

        // Interleave by document so each uploaded doc that matched gets shown.
        const byDoc = {};
        deduped.forEach(m => { (byDoc[m.docName] = byDoc[m.docName] || []).push(m); });
        const docNames = Object.keys(byDoc);
        const rankedEvidence = [];
        let added = true;
        while (rankedEvidence.length < 8 && added) {
            added = false;
            for (const dn of docNames) {
                if (byDoc[dn].length) {
                    rankedEvidence.push(byDoc[dn].shift());
                    added = true;
                    if (rankedEvidence.length >= 8) break;
                }
            }
        }

        let confidence;
        if (keywordCoverage === 0) {
            confidence = 'none';
        } else if (keywordCoverage >= 0.6 || anyPhrase) {
            confidence = 'strong';
        } else {
            confidence = 'weak';
        }

        return {
            evidence: rankedEvidence,
            confidence,
            keywordCoverage,
            totalKeywords: baseWords.length,
            matchedKeywordList: [...new Set(allMatches.flatMap(m => m.matchedTerms))].slice(0, 10),
            documentsSearched: documents.length,
            documentsMatched: docNames.length
        };
    };

    // Applies the specified compliance rules given scan confidence + vendor answer.
    // vendorAnswer is one of 'yes' | 'no' | 'na' (lowercase).
    const determineComplianceRating = (confidence, vendorAnswer) => {
        const answer = (vendorAnswer || '').toLowerCase();

        if (answer === 'no') {
            return 'Not Compliant'; // vendor said no, regardless of any document evidence
        }
        if (confidence === 'none') {
            return 'Not Compliant'; // no information present at all
        }
        if (confidence === 'strong' && answer === 'yes') {
            return 'Compliant'; // information present and vendor answered Yes
        }
        // Remaining cases: weak/uncertain evidence with Yes/N/A, or strong
        // evidence but answer is N/A (still not a confirmed "yes")
        return 'Partially Compliant';
    };

    const getComplianceBadgeClass = (rating) => {
        if (rating === 'Compliant') return 'low';       // reuse existing badge color classes
        if (rating === 'Partially Compliant') return 'medium';
        return 'high'; // Not Compliant
    };

    // Runs the scan across every question in the vendor's active assessment
    // questionnaire and stores results (including human-editable override)
    // on vendor.complianceScan.
    window.runComplianceScan = (vendorId) => {
        const vendor = vendors.find(v => v.id == vendorId);
        if (!vendor) return;

        if (!vendor.activeAssessmentSnapshot || !vendor.activeAssessmentSnapshot.questions || vendor.activeAssessmentSnapshot.questions.length === 0) {
            showToast('No assessment questionnaire is assigned to this vendor yet. Assign one first.');
            return;
        }

        const isRerun = !!(vendor.complianceScan && vendor.complianceScan.results);
        const scanBtn = document.getElementById('run-scan-btn');
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = `<span class="loading-spinner" style="display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 1s linear infinite; margin-right:8px;"></span> ${isRerun ? 'Re-running analysis...' : 'Running analysis...'}`;
        }

        const docs = vendor.documents || [];
        const questions = vendor.activeAssessmentSnapshot.questions;
        const existingAnswers = vendor.assessmentAnswers || {};

        setTimeout(() => {
            const results = questions.map((qText, i) => {
                const vendorAnswer = existingAnswers[i] || '';
                const prior = vendor.complianceScan && vendor.complianceScan.results && vendor.complianceScan.results[i];

                // LEARN FROM FEEDBACK: if the assessor previously thumbed this
                // analysis down and supplied a correction, extract meaningful
                // words from that correction and feed them into the search so
                // the re-scan looks for what the human said was missing.
                let learnedKeywords = [];
                if (prior && prior.feedback === 'down' && prior.feedbackNote) {
                    learnedKeywords = prior.feedbackNote
                        .toLowerCase().replace(/[^\w\s\-]/g, ' ').split(/\s+/)
                        .filter(w => w.length > 2 && !STOPWORDS.has(w));
                }

                const scan = scanQuestionAgainstDocuments(qText, docs, learnedKeywords);
                const aiRating = determineComplianceRating(scan.confidence, vendorAnswer);
                const aiAnalysisBullets = buildAnalysisNote(scan, vendorAnswer, aiRating, qText);
                if (learnedKeywords.length) {
                    aiAnalysisBullets.unshift(`**Refined from your feedback:** this re-scan also searched for ${learnedKeywords.slice(0,6).map(k=>`"${k}"`).join(', ')} based on your earlier correction.`);
                }

                return {
                    question: qText,
                    vendorAnswer,
                    evidence: scan.evidence,
                    confidence: scan.confidence,
                    aiRating,
                    aiAnalysisBullets,
                    // humanRating starts equal to the AI rating; the reviewer can change it
                    humanRating: (prior && prior.humanOverridden) ? prior.humanRating : aiRating,
                    humanOverridden: prior ? prior.humanOverridden : false,
                    // assessorNote is the human's OWN notes (separate from the AI analysis)
                    assessorNote: prior ? (prior.assessorNote || '') : '',
                    // reviewStatus: 'pending' (not yet reviewed), 'accepted', or 'issue'
                    reviewStatus: prior ? prior.reviewStatus : 'pending',
                    // feedback on the AI analysis quality: null | 'up' | 'down'
                    feedback: prior ? (prior.feedback || null) : null,
                    feedbackNote: prior ? (prior.feedbackNote || '') : '',
                    feedbackSubmitted: prior ? (prior.feedbackSubmitted || false) : false,
                    learnedKeywords
                };
            });

            vendor.complianceScan = {
                results,
                scannedAt: Date.now(),
                documentCount: docs.length
            };
            saveVendors();
            renderComplianceScanResults(vendorId);
            showToast(`${isRerun ? 'Re-run' : 'Assessment'} complete: ${results.length} question${results.length !== 1 ? 's' : ''} analyzed against ${docs.length} document${docs.length !== 1 ? 's' : ''}.`);

            if (scanBtn) {
                scanBtn.disabled = false;
                updateRunScanButtonLabel(vendorId);
            }
        }, 1800); // simulated analysis delay, consistent with the AI summary elsewhere in the app
    };

    // Builds a detailed, bullet-pointed AI analysis for a question, citing the
    // specific document and page number for each piece of supporting evidence,
    // and naming the keywords that drove the match. Returns an array of bullet
    // strings (rendered as a list) so the analysis is scannable, not a wall of text.
    const buildAnalysisNote = (scan, vendorAnswer, rating, questionText) => {
        const answerLabel = vendorAnswer ? vendorAnswer.toUpperCase() : 'no answer provided';
        const bullets = [];

        // Opening summary line.
        if (scan.confidence === 'none') {
            bullets.push(`**No supporting evidence found.** A full scan of the uploaded documents returned no content relevant to this question.`);
            bullets.push(`The vendor's response to this control was **${answerLabel}**.`);
            bullets.push(`Because the claim cannot be corroborated by any uploaded evidence, this control is assessed as **${rating}**. Upload supporting documentation (policy, SOC 2, etc.) and re-run, or confirm the rating manually.`);
            return bullets;
        }

        const pageList = [...new Set(scan.evidence.map(e => e.pageLabel ? `${e.pageLabel}` : `page ${e.pageNum}`))];
        const docList = [...new Set(scan.evidence.map(e => e.docName))];
        const kwList = scan.matchedKeywordList.slice(0, 8);

        bullets.push(`**Matched on:** ${kwList.length ? kwList.map(k => `"${k}"`).join(', ') : 'relevant terms'} — ${Math.round(scan.keywordCoverage * 100)}% of the question's key terms were located in the evidence.`);

        bullets.push(`**Evidence found in:** ${docList.join(', ')} (${pageList.slice(0, 6).join(', ')}).`);

        // One bullet per top evidence excerpt, each citing its page.
        scan.evidence.slice(0, 4).forEach(ev => {
            const where = ev.pageLabel ? ev.pageLabel : `Page ${ev.pageNum}`;
            const cleaned = ev.excerpt.replace(/\s+/g, ' ').trim();
            const snippet = cleaned.length > 240 ? cleaned.slice(0, 240) + '…' : cleaned;
            bullets.push(`**${ev.docName} — ${where}** (matches ${ev.matchCount} term${ev.matchCount !== 1 ? 's' : ''}): "${snippet}"`);
        });

        // Closing assessment line tied to the rating logic.
        if (scan.confidence === 'strong') {
            bullets.push(`**Assessment:** the documents contain clear, on-topic evidence and the vendor answered **${answerLabel}**, so this control is rated **${rating}**.`);
        } else {
            bullets.push(`**Assessment:** the documents contain only partial or loosely-related evidence (vendor answered **${answerLabel}**), so this control is rated **${rating}** and warrants manual review of the excerpts above.`);
        }

        return bullets;
    };

    // Updates the Run/Re-run button label + icon based on whether a scan
    // has already been run for this vendor.
    const updateRunScanButtonLabel = (vendorId) => {
        const vendor = vendors.find(v => v.id == vendorId);
        const scanBtn = document.getElementById('run-scan-btn');
        if (!scanBtn) return;
        const hasResults = !!(vendor && vendor.complianceScan && vendor.complianceScan.results);
        scanBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem; vertical-align: -3px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> <span id="run-scan-btn-label">${hasResults ? 'Re-run Assessment' : 'Run Assessment'}</span>`;
    };

    // Renders the dynamic Assessment questionnaire (from the vendor's assigned
    // Assessment-type questionnaire) with Yes/No/N/A dropdowns, and saves
    // answers to vendor.assessmentAnswers as they change.
    // Master-detail Questionnaires view for a vendor:
    //  - left: list of assigned questionnaire "files" (by name)
    //  - right: the selected questionnaire's questions, with editable Yes/No/NA
    //    responses AND the ability to edit/add/remove the questions themselves.
    // Backwards compatible: older vendors with a single activeAssessmentSnapshot
    // are migrated into the assessmentQuestionnaires array on first render.
    const renderAssessmentQuestionnaire = (vendorId) => {
        const vendor = vendors.find(v => v.id == vendorId);
        const emptyState = document.getElementById('assessment-no-questionnaire');
        const masterDetail = document.getElementById('assessment-master-detail');
        const listEl = document.getElementById('assessment-q-list');
        const detailEl = document.getElementById('assessment-q-detail');
        if (!vendor || !emptyState || !masterDetail || !listEl || !detailEl) return;

        // Migrate legacy single-snapshot into the array model.
        if (!vendor.assessmentQuestionnaires) vendor.assessmentQuestionnaires = [];
        if (vendor.assessmentQuestionnaires.length === 0 && vendor.activeAssessmentSnapshot) {
            vendor.assessmentQuestionnaires.push({
                id: vendor.activeAssessmentId || ('q' + Date.now()),
                snapshot: vendor.activeAssessmentSnapshot,
                answers: vendor.assessmentAnswers || {}
            });
        }

        const list = vendor.assessmentQuestionnaires;
        if (list.length === 0) {
            emptyState.classList.remove('hidden');
            masterDetail.classList.add('hidden');
            return;
        }
        emptyState.classList.add('hidden');
        masterDetail.classList.remove('hidden');

        if (selectedAssessmentQIndex >= list.length) selectedAssessmentQIndex = 0;

        // Left: file-name list
        listEl.innerHTML = list.map((q, idx) => `
            <div class="q-list-item ${idx === selectedAssessmentQIndex ? 'active' : ''}" data-idx="${idx}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span class="q-list-name">${q.snapshot.name || 'Untitled questionnaire'}</span>
                <span class="q-list-count">${(q.snapshot.questions || []).length}</span>
                <button class="q-list-remove" data-remove="${idx}" title="Remove">&times;</button>
            </div>
        `).join('');

        // Right: selected questionnaire detail
        const sel = list[selectedAssessmentQIndex];
        if (!sel.answers) sel.answers = {};
        detailEl.innerHTML = `
            <div class="q-detail-head">
                <h4>${sel.snapshot.name || 'Untitled'}</h4>
                <span class="q-detail-sub">${(sel.snapshot.questions || []).length} question${(sel.snapshot.questions || []).length !== 1 ? 's' : ''} • record the vendor's response to each</span>
            </div>
            <div class="q-detail-questions">
                ${(sel.snapshot.questions || []).map((q, i) => `
                    <div class="q-detail-q">
                        <textarea class="textarea-input q-edit-text" data-qi="${i}" rows="2">${q}</textarea>
                        <div class="q-detail-q-controls">
                            <select class="select-input q-answer" data-qi="${i}" style="max-width: 160px;">
                                <option value="" ${(sel.answers[i]||'')===''?'selected':''}>Select...</option>
                                <option value="yes" ${sel.answers[i]==='yes'?'selected':''}>Yes</option>
                                <option value="no" ${sel.answers[i]==='no'?'selected':''}>No</option>
                                <option value="na" ${sel.answers[i]==='na'?'selected':''}>N/A</option>
                            </select>
                            <button class="action-btn q-remove-question" data-qi="${i}" style="color: var(--danger);">Remove</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="q-detail-actions">
                <button class="secondary-btn" id="q-add-question" style="padding: 0.35rem 0.9rem; font-size: 0.85rem;">+ Add Question</button>
                <button class="primary-btn" id="q-save-questionnaire" style="padding: 0.35rem 0.9rem; font-size: 0.85rem;">Save Changes</button>
            </div>
        `;

        // --- wire left list ---
        listEl.querySelectorAll('.q-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.q-list-remove')) return;
                selectedAssessmentQIndex = parseInt(item.getAttribute('data-idx'));
                syncActiveAssessment(vendor);
                renderAssessmentQuestionnaire(vendorId);
            });
        });
        listEl.querySelectorAll('.q-list-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-remove'));
                if (!confirm(`Remove "${list[idx].snapshot.name}" from this vendor?`)) return;
                list.splice(idx, 1);
                if (selectedAssessmentQIndex >= list.length) selectedAssessmentQIndex = Math.max(0, list.length - 1);
                syncActiveAssessment(vendor);
                saveVendors();
                renderAssessmentQuestionnaire(vendorId);
                showToast('Questionnaire removed.');
            });
        });

        // --- wire right detail ---
        detailEl.querySelectorAll('.q-answer').forEach(s => {
            s.addEventListener('change', () => {
                sel.answers[s.getAttribute('data-qi')] = s.value;
                syncActiveAssessment(vendor);
                saveVendors();
            });
        });
        detailEl.querySelectorAll('.q-remove-question').forEach(b => {
            b.addEventListener('click', () => {
                const qi = parseInt(b.getAttribute('data-qi'));
                sel.snapshot.questions.splice(qi, 1);
                // reindex answers
                const newAns = {};
                Object.keys(sel.answers).forEach(k => {
                    const ki = parseInt(k);
                    if (ki < qi) newAns[ki] = sel.answers[k];
                    else if (ki > qi) newAns[ki - 1] = sel.answers[k];
                });
                sel.answers = newAns;
                syncActiveAssessment(vendor);
                saveVendors();
                renderAssessmentQuestionnaire(vendorId);
            });
        });
        const addQ = document.getElementById('q-add-question');
        if (addQ) addQ.addEventListener('click', () => {
            sel.snapshot.questions.push('New question');
            syncActiveAssessment(vendor);
            saveVendors();
            renderAssessmentQuestionnaire(vendorId);
        });
        const saveQ = document.getElementById('q-save-questionnaire');
        if (saveQ) saveQ.addEventListener('click', () => {
            detailEl.querySelectorAll('.q-edit-text').forEach(t => {
                sel.snapshot.questions[parseInt(t.getAttribute('data-qi'))] = t.value.trim();
            });
            syncActiveAssessment(vendor);
            saveVendors();
            renderAssessmentQuestionnaire(vendorId);
            showToast('Questionnaire saved.');
        });
    };

    // Keeps the legacy fields the AI scan reads (activeAssessmentSnapshot /
    // assessmentAnswers) pointed at the currently-selected questionnaire.
    const syncActiveAssessment = (vendor) => {
        const list = vendor.assessmentQuestionnaires || [];
        const sel = list[selectedAssessmentQIndex];
        if (sel) {
            vendor.activeAssessmentSnapshot = sel.snapshot;
            vendor.activeAssessmentId = sel.id;
            vendor.assessmentAnswers = sel.answers;
        } else {
            vendor.activeAssessmentSnapshot = null;
            vendor.assessmentAnswers = {};
        }
    };

    // "Assign Questionnaire" button: reuses the existing select-questionnaire
    // modal, but filtered to Assessment-type templates and saved into a
    // separate snapshot field so it doesn't clash with the Intake snapshot.
    const assignAssessmentQBtn = document.getElementById('assign-assessment-q-btn');
    if (assignAssessmentQBtn) {
        assignAssessmentQBtn.addEventListener('click', () => {
            const assessmentQs = questionnaires.filter(q => q.type === 'Assessment');
            if (assessmentQs.length === 0) {
                showToast('No Assessment questionnaires exist yet. Create one in the Questionnaires tab first.');
                return;
            }
            selectQDropdown.innerHTML = assessmentQs.map(q => `<option value="${q.id}">${q.name}</option>`).join('');
            const vendor = vendors.find(v => v.id == currentActiveVendorId);
            if (vendor && vendor.activeAssessmentId) {
                selectQDropdown.value = vendor.activeAssessmentId;
            }
            selectQModal.setAttribute('data-mode', 'assessment');
            selectQModal.classList.remove('hidden');
        });
    }

    // Tiny helper: render **bold** markers as <strong> (analysis bullets use them).
    const renderBold = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Renders the AI compliance analysis as a collapsible accordion, one
    // entry per question. Collapsed by default. Expanding shows, in order:
    // the full question, the vendor's response, then a two-column area with
    // the AI analysis (bulleted, with document + page citations) on one side
    // and the assessor's own notes (with a Save button) on the other, plus
    // the editable compliance rating and Accept / Flag-as-Issue actions.
    const renderComplianceScanResults = (vendorId) => {
        const vendor = vendors.find(v => v.id == vendorId);
        const container = document.getElementById('compliance-scan-results');
        if (!container) return;

        updateRunScanButtonLabel(vendorId);

        if (!vendor || !vendor.complianceScan || !vendor.complianceScan.results) {
            container.innerHTML = `<p class="empty-mini-state" style="padding: 1rem 0;">Run the assessment to see AI analysis for each question here, backed by evidence and page numbers from uploaded documents.</p>`;
            return;
        }

        const confidenceLabel = { strong: 'High confidence', weak: 'Low confidence', none: 'No evidence found' };
        const reviewStatusLabel = { pending: 'Awaiting review', accepted: 'Accepted', issue: 'Flagged as issue' };
        const reviewStatusClass = { pending: 'pending', accepted: 'low', issue: 'high' };
        const vendorAnswerLabel = { yes: 'Yes', no: 'No', na: 'N/A', '': 'Not answered' };

        // Builds the inner detail markup for one question result. Shared by the
        // inline accordion body and the full-screen Expand modal, so both views
        // stay perfectly in sync. `ctx` is 'inline' or 'modal' to namespace ids.
        const buildQuestionDetailHtml = (r, i, ctx) => `
            <div class="scan-question-detail">
                <label>Control Question</label>
                <p>${i + 1}. ${r.question}</p>
            </div>

            <div class="scan-vendor-response">
                <label>Vendor Response</label>
                <span class="vendor-response-pill vr-${r.vendorAnswer || 'none'}">${vendorAnswerLabel[r.vendorAnswer] || 'Not answered'}</span>
                <span class="scan-confidence-tag">${confidenceLabel[r.confidence]}</span>
            </div>

            <div class="scan-two-col">
                <div class="scan-ai-col">
                    <label>AI Analysis</label>
                    ${r.aiAnalysisBullets && r.aiAnalysisBullets.length ? `
                        <ul class="scan-ai-bullets">
                            ${r.aiAnalysisBullets.map(b => `<li>${renderBold(b)}</li>`).join('')}
                        </ul>
                    ` : `<p class="empty-mini-state" style="text-align:left;">No analysis generated.</p>`}

                    <!-- Feedback on the AI analysis -->
                    <div class="scan-feedback" data-q-index="${i}">
                        <span class="scan-feedback-label">Was this analysis helpful?</span>
                        <div class="scan-feedback-btns">
                            <button class="feedback-btn feedback-up ${r.feedback === 'up' ? 'active-up' : ''}" data-q-index="${i}" data-ctx="${ctx}" title="Good analysis">👍</button>
                            <button class="feedback-btn feedback-down ${r.feedback === 'down' ? 'active-down' : ''}" data-q-index="${i}" data-ctx="${ctx}" title="Needs correction">👎</button>
                        </div>
                        <div class="scan-feedback-correction ${r.feedback === 'down' ? '' : 'hidden'}" data-q-index="${i}">
                            <textarea class="textarea-input scan-feedback-note" data-q-index="${i}" rows="2" placeholder="Optional: what should the analysis have said? (not required)">${r.feedbackNote || ''}</textarea>
                            <button class="primary-btn scan-feedback-submit" data-q-index="${i}" data-ctx="${ctx}" style="width:auto; margin-top:0.5rem; padding:0.35rem 0.9rem; font-size:0.82rem;">Submit Feedback</button>
                        </div>
                        ${r.feedbackSubmitted ? `<span class="scan-feedback-thanks">✓ Feedback submitted</span>` : ''}
                    </div>
                </div>

                <div class="scan-notes-col">
                    <label>Assessor Notes</label>
                    <textarea class="textarea-input scan-assessor-note" data-q-index="${i}" rows="6" placeholder="Add your own notes, rationale, or follow-up actions...">${r.assessorNote || ''}</textarea>
                    <button class="primary-btn scan-save-note-btn" data-q-index="${i}" style="width: auto; margin-top: 0.6rem; padding: 0.4rem 1rem; font-size: 0.85rem;">Save Notes</button>
                </div>
            </div>

            <div class="scan-result-override">
                <div>
                    <label>Compliance Rating (editable)</label>
                    <select class="select-input scan-rating-select" data-q-index="${i}" style="max-width: 220px;">
                        <option value="Compliant" ${r.humanRating === 'Compliant' ? 'selected' : ''}>Compliant</option>
                        <option value="Partially Compliant" ${r.humanRating === 'Partially Compliant' ? 'selected' : ''}>Partially Compliant</option>
                        <option value="Not Compliant" ${r.humanRating === 'Not Compliant' ? 'selected' : ''}>Not Compliant</option>
                    </select>
                </div>
                <div class="scan-review-actions">
                    <button class="secondary-btn scan-accept-btn" data-q-index="${i}" style="padding: 0.4rem 0.9rem; font-size: 0.85rem; ${r.reviewStatus === 'accepted' ? 'border-color: var(--success); color: var(--success);' : ''}">
                        ✓ Accept
                    </button>
                    <button class="secondary-btn scan-issue-btn" data-q-index="${i}" style="padding: 0.4rem 0.9rem; font-size: 0.85rem; ${r.reviewStatus === 'issue' ? 'border-color: var(--danger); color: var(--danger);' : ''}">
                        ⚠ Flag as Issue
                    </button>
                </div>
            </div>
        `;
        // Expose for the modal renderer.
        renderComplianceScanResults._buildDetail = buildQuestionDetailHtml;
        renderComplianceScanResults._labels = { confidenceLabel, reviewStatusLabel, reviewStatusClass, vendorAnswerLabel };

        container.innerHTML = `
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 1.25rem;">
                Last run ${new Date(vendor.complianceScan.scannedAt).toLocaleString()} against ${vendor.complianceScan.documentCount} document${vendor.complianceScan.documentCount !== 1 ? 's' : ''}.
                Click a question to review the AI's analysis (with page references), or use Expand for a focused view with previous/next navigation.
            </p>
        ` + vendor.complianceScan.results.map((r, i) => `
            <div class="scan-result-card" data-q-index="${i}">
                <div class="scan-result-header" data-q-index="${i}">
                    <div class="scan-accordion-toggle" data-q-index="${i}" style="cursor: pointer; display:flex; align-items:flex-start; gap:0.75rem; flex:1; min-width:0;">
                        <svg class="scan-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top: 0.15rem; transition: transform 0.2s; ${expandedScanRows.has(i) ? 'transform: rotate(90deg);' : ''}"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        <p class="scan-result-question">${i + 1}. ${r.question}</p>
                    </div>
                    <span class="badge ${reviewStatusClass[r.reviewStatus]}" style="margin-right: 0.5rem;">${reviewStatusLabel[r.reviewStatus]}</span>
                    <span class="badge ${getComplianceBadgeClass(r.humanRating)}" style="margin-right: 0.5rem;">${r.humanRating}</span>
                    <button class="secondary-btn scan-expand-btn" data-q-index="${i}" style="padding: 0.3rem 0.7rem; font-size: 0.78rem; flex-shrink:0;" title="Open in focused view">⤢ Expand</button>
                </div>

                <div class="scan-result-body ${expandedScanRows.has(i) ? '' : 'hidden'}" id="scan-body-${i}">
                    ${buildQuestionDetailHtml(r, i, 'inline')}
                </div>
            </div>
        `).join('');

        // Accordion expand/collapse
        container.querySelectorAll('.scan-accordion-toggle').forEach(header => {
            header.addEventListener('click', () => {
                const idx = parseInt(header.getAttribute('data-q-index'));
                const body = document.getElementById(`scan-body-${idx}`);
                const chevron = header.querySelector('.scan-chevron');
                if (!body) return;
                const isHidden = body.classList.contains('hidden');
                body.classList.toggle('hidden');
                if (isHidden) expandedScanRows.add(idx); else expandedScanRows.delete(idx);
                if (chevron) chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
            });
        });

        // Expand button -> open focused modal at this question
        container.querySelectorAll('.scan-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openQuestionModal(vendorId, parseInt(btn.getAttribute('data-q-index')));
            });
        });

        // Wire up the interactive controls (shared between inline + modal).
        wireQuestionDetailHandlers(container, vendorId, () => renderComplianceScanResults(vendorId));
    };

    // Attaches all the per-question control handlers (notes, rating, accept,
    // flag, feedback) within a given root element. Used for both the inline
    // accordion and the Expand modal. `refresh` re-renders the relevant view.
    const wireQuestionDetailHandlers = (root, vendorId, refresh) => {
        const getResult = (idx) => {
            const v = vendors.find(vv => vv.id == vendorId);
            return (v && v.complianceScan && v.complianceScan.results) ? v.complianceScan.results[idx] : null;
        };

        root.querySelectorAll('.scan-save-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qIndex = parseInt(btn.getAttribute('data-q-index'));
                const textarea = root.querySelector(`.scan-assessor-note[data-q-index="${qIndex}"]`);
                const result = getResult(qIndex);
                if (!result || !textarea) return;
                result.assessorNote = textarea.value;
                saveVendors();
                showToast('Assessor notes saved.');
            });
        });

        root.querySelectorAll('.scan-rating-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const qIndex = parseInt(sel.getAttribute('data-q-index'));
                const result = getResult(qIndex);
                if (!result) return;
                result.humanRating = sel.value;
                result.humanOverridden = (sel.value !== result.aiRating);
                saveVendors();
                refresh();
                showToast('Compliance rating updated.');
            });
        });

        root.querySelectorAll('.scan-accept-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qIndex = parseInt(btn.getAttribute('data-q-index'));
                const result = getResult(qIndex);
                if (!result) return;
                result.reviewStatus = 'accepted';
                saveVendors();
                refresh();
                showToast('Marked as accepted.');
            });
        });

        root.querySelectorAll('.scan-issue-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qIndex = parseInt(btn.getAttribute('data-q-index'));
                const result = getResult(qIndex);
                if (!result) return;
                result.reviewStatus = 'issue';
                saveVendors();
                refresh();
                showToast('Flagged as an issue for follow-up.');
            });
        });

        // Feedback thumbs up/down
        root.querySelectorAll('.feedback-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qIndex = parseInt(btn.getAttribute('data-q-index'));
                const result = getResult(qIndex);
                if (!result) return;
                const isUp = btn.classList.contains('feedback-up');
                result.feedback = isUp ? 'up' : 'down';
                result.feedbackSubmitted = false; // require explicit submit after picking
                if (isUp) result.feedbackNote = '';
                saveVendors();
                refresh();
            });
        });

        // Submit feedback (with optional correction note)
        root.querySelectorAll('.scan-feedback-submit').forEach(btn => {
            btn.addEventListener('click', () => {
                const qIndex = parseInt(btn.getAttribute('data-q-index'));
                const note = root.querySelector(`.scan-feedback-note[data-q-index="${qIndex}"]`);
                const result = getResult(qIndex);
                if (!result) return;
                if (note) result.feedbackNote = note.value;
                result.feedbackSubmitted = true;
                saveVendors();
                refresh();
                showToast('Thank you — feedback submitted.');
            });
        });
    };

    // Opens a focused, full-screen modal for a single question's AI analysis,
    // with Previous/Next navigation through all questions. All the same
    // controls (notes, rating, accept/flag, feedback) work inside it.
    let currentModalQIndex = 0;
    let currentModalVendorId = null;
    const openQuestionModal = (vendorId, qIndex) => {
        currentModalVendorId = vendorId;
        currentModalQIndex = qIndex;
        const overlay = document.getElementById('question-modal-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        renderQuestionModal();
    };

    const renderQuestionModal = () => {
        const vendor = vendors.find(v => v.id == currentModalVendorId);
        const overlay = document.getElementById('question-modal-overlay');
        const bodyEl = document.getElementById('question-modal-body');
        const titleEl = document.getElementById('question-modal-title');
        const prevBtn = document.getElementById('question-modal-prev');
        const nextBtn = document.getElementById('question-modal-next');
        if (!vendor || !vendor.complianceScan || !bodyEl) return;

        const results = vendor.complianceScan.results;
        const total = results.length;
        const i = currentModalQIndex;
        const r = results[i];
        if (!r) return;

        if (titleEl) titleEl.textContent = `Question ${i + 1} of ${total}`;
        // Reuse the exact same detail builder used inline.
        const builder = renderComplianceScanResults._buildDetail;
        bodyEl.innerHTML = builder ? builder(r, i, 'modal') : '';

        // Wire the controls inside the modal; refresh re-renders BOTH the modal
        // and the inline list so they stay in sync.
        wireQuestionDetailHandlers(bodyEl, currentModalVendorId, () => {
            renderQuestionModal();
            renderComplianceScanResults(currentModalVendorId);
        });

        if (prevBtn) prevBtn.disabled = (i === 0);
        if (nextBtn) nextBtn.disabled = (i === total - 1);
    };

    const closeQuestionModal = () => {
        const overlay = document.getElementById('question-modal-overlay');
        if (overlay) overlay.classList.add('hidden');
    };

    // Wire modal nav/close once at startup.
    (function wireQuestionModalChrome() {
        const prevBtn = document.getElementById('question-modal-prev');
        const nextBtn = document.getElementById('question-modal-next');
        const closeBtn = document.getElementById('question-modal-close');
        const overlay = document.getElementById('question-modal-overlay');
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (currentModalQIndex > 0) { currentModalQIndex--; renderQuestionModal(); }
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            const vendor = vendors.find(v => v.id == currentModalVendorId);
            const total = vendor && vendor.complianceScan ? vendor.complianceScan.results.length : 0;
            if (currentModalQIndex < total - 1) { currentModalQIndex++; renderQuestionModal(); }
        });
        if (closeBtn) closeBtn.addEventListener('click', closeQuestionModal);
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeQuestionModal(); });
    })();

    // Semantic header matcher: given a row object and a list of candidate
    // header names, finds the first column whose normalized name matches any
    // candidate (substring match, punctuation/case-insensitive).
    const findColumnValue = (row, candidates) => {
        const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const cand of candidates) {
            const nc = norm(cand);
            for (const rowKey in row) {
                const nk = norm(rowKey);
                if (nk === nc || nk.includes(nc) || nc.includes(nk)) {
                    const val = row[rowKey];
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        return String(val).trim();
                    }
                }
            }
        }
        return null;
    };

    // Maps a free-text category string onto the closest standardized
    // VENDOR_CATEGORIES entry using keyword heuristics; falls back to keeping
    // the original text (so nothing is lost) or 'Other'.
    const normalizeCategory = (raw) => {
        if (!raw) return null;
        const r = raw.toLowerCase();
        const rules = [
            [/saas|software|application|app\b/, 'Software / SaaS'],
            [/cloud|infrastructure|hosting|iaas|paas|aws|azure|gcp/, 'Cloud / Infrastructure (IaaS/PaaS)'],
            [/hardware|equipment|device/, 'Hardware / Equipment'],
            [/managed it|it service|helpdesk|msp/, 'Managed IT Services'],
            [/security|cyber|infosec|soc\b|pentest/, 'Cybersecurity Services'],
            [/data|analytics|processing|warehouse/, 'Data Processing / Analytics'],
            [/payment|fintech|billing|merchant/, 'Payment Processing / FinTech'],
            [/consult|advisory|professional service/, 'Professional Services / Consulting'],
            [/legal|law|counsel/, 'Legal Services'],
            [/account|audit|financial|tax|bookkeep/, 'Financial / Accounting Services'],
            [/marketing|advertis|seo|media|pr\b/, 'Marketing / Advertising'],
            [/\bhr\b|human resource|staffing|recruit|payroll/, 'Human Resources / Staffing'],
            [/logistic|supply chain|shipping|freight|warehouse/, 'Logistics / Supply Chain'],
            [/manufactur|production|assembly|factory/, 'Manufacturing / Production'],
            [/facilit|physical security|janitor|maintenance/, 'Facilities / Physical Security'],
            [/telecom|network|isp|connectivity/, 'Telecommunications'],
            [/health|medical|clinical|pharma/, 'Healthcare / Medical Services'],
            [/research|r&d|laboratory/, 'Research & Development'],
            [/outsourc|bpo|offshore/, 'Outsourcing / BPO'],
        ];
        for (const [re, cat] of rules) { if (re.test(r)) return cat; }
        // Keep the user's original label if it doesn't map cleanly.
        return raw;
    };

    // Detects commercial business suffixes — used to guess vendor names when a
    // file has no usable headers.
    const looksLikeCompany = (s) => /\b(corp|corporation|llc|ltd|inc|incorporated|gmbh|plc|co|company|solutions|systems|technologies|services|group|partners|associates)\b/i.test(s);

    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') {
            showToast('PDF is not supported for vendor import. Please use a .csv or .xlsx file.');
            e.target.value = '';
            return;
        }

        showToast(`Reading ${file.name}...`);

        // Native CSV parser — used for .csv files and as a fallback if SheetJS
        // (loaded from CDN) is unavailable. Handles quoted fields and commas.
        const parseCsvToRows = (text) => {
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            if (!lines.length) return [];
            const splitLine = (line) => {
                const out = []; let cur = ''; let inQ = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
                    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
                    else cur += ch;
                }
                out.push(cur);
                return out.map(c => c.trim());
            };
            const headers = splitLine(lines[0]);
            return lines.slice(1).map(line => {
                const cells = splitLine(line);
                const obj = {};
                headers.forEach((h, i) => { if (h) obj[h] = cells[i] !== undefined ? cells[i] : ''; });
                return obj;
            });
        };

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const ext2 = file.name.split('.').pop().toLowerCase();
                let parsedData;

                if (ext2 === 'csv' || typeof XLSX === 'undefined') {
                    // Plain-text CSV path (no library dependency).
                    const text = typeof evt.target.result === 'string'
                        ? evt.target.result
                        : new TextDecoder().decode(evt.target.result);
                    parsedData = parseCsvToRows(text);
                } else {
                    const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    parsedData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
                    // If that yields nothing useful (e.g. title banner rows pushed the
                    // real header down), retry by scanning for the most likely header row.
                    if (parsedData.length === 0) {
                        const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
                        const headerRowIdx = matrix.findIndex(row =>
                            row && row.some(c => /vendor|supplier|company|name|poc|contact|category/i.test(String(c || '')))
                        );
                        if (headerRowIdx !== -1) {
                            const headers = matrix[headerRowIdx];
                            parsedData = matrix.slice(headerRowIdx + 1)
                                .filter(r => r && r.some(c => String(c || '').trim() !== ''))
                                .map(r => {
                                    const obj = {};
                                    headers.forEach((h, ci) => { if (h) obj[h] = r[ci]; });
                                    return obj;
                                });
                        }
                    }
                }

                if (parsedData.length === 0) {
                    showToast('File is empty or no recognizable vendor data was found.');
                    e.target.value = '';
                    return;
                }

                const today = new Date().toISOString().split('T')[0];
                const defaultNextReview = new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0];

                const newVendors = parsedData.map((row, index) => {
                    // Dynamic semantic mapping per the ingestion spec.
                    let name = findColumnValue(row, ['Vendor Name', 'Vendor', 'Supplier', 'Company', 'Partner', 'Third-Party', 'Third Party', 'Provider', 'Account Name', 'Entity', 'Contractor', 'Name']);
                    // Fallback: scan any cell that looks like a company name.
                    if (!name) {
                        for (const k in row) { if (looksLikeCompany(String(row[k] || ''))) { name = String(row[k]).trim(); break; } }
                    }

                    const vendorId = findColumnValue(row, ['Vendor ID', 'VendorID', 'ID', 'Supplier ID', 'Account Number', 'Vendor No', 'Vendor Number']);
                    const pocName = findColumnValue(row, ['POC Full Name', 'POC Name', 'Contact Person', 'Contact Name', 'Representative', 'Account Manager', 'Owner', 'Attention', 'Full Name', 'Lead', 'POC', 'Contact']);
                    const pocContact = findColumnValue(row, ['POC Contact Info', 'Email', 'E-mail', 'Mail', 'Phone', 'Mobile', 'Contact Info', 'Communication', 'Vendor POC']);
                    const rawCategory = findColumnValue(row, ['Category', 'Business Category', 'Scope', 'Type', 'Service', 'Industry', 'Vertical', 'Classification', 'Domain', 'Department', 'Service Provided']);
                    const contractValue = findColumnValue(row, ['Contract Value', 'Spend', 'Annual Spend', 'Contract Spend', 'Value', 'Budget', 'Cost']);
                    const status = findColumnValue(row, ['Status', 'Tier', 'Operational Tier', 'Risk Tier', 'State']);
                    const reviewDate = findColumnValue(row, ['Review Date', 'Last Review', 'Assessment Date', 'Last Assessed']);
                    const nextReview = findColumnValue(row, ['Next Review Date', 'Next Review', 'Next Assessment', 'Review Due', 'Due Date']);
                    const assessor = findColumnValue(row, ['Assessor', 'Reviewer', 'Analyst']);

                    // Skip rows that are clearly not vendors (no name AND no contact AND no category).
                    if (!name && !pocName && !pocContact && !rawCategory) return null;

                    // Combine a POC name + contact into the single poc display field,
                    // but also keep them separate for the normalized schema.
                    const pocDisplay = [pocName, pocContact].filter(Boolean).join(' — ') || '[NOT FOUND]';

                    return {
                        id: vendorId || (Date.now().toString() + '-' + index),
                        importedId: vendorId || null,
                        name: name || '[NOT FOUND]',
                        type: normalizeCategory(rawCategory) || 'Other',
                        risk: 'Pending',
                        score: 'Pending',
                        poc: pocDisplay,
                        pocName: pocName || '[NOT FOUND]',
                        pocContact: pocContact || '[NOT FOUND]',
                        contractValue: contractValue || null,
                        status: status || null,
                        dataType: 'Unknown',
                        reviewDate: reviewDate || null,
                        nextReview: nextReview || defaultNextReview,
                        assessor: assessor || currentUser.name,
                        description: 'Imported from ' + file.name,
                        createdAt: Date.now() + index
                    };
                }).filter(Boolean);

                if (newVendors.length === 0) {
                    showToast('No vendor rows could be extracted from this file.');
                    e.target.value = '';
                    return;
                }

                let addedCount = 0, mergedCount = 0;
                newVendors.forEach(nv => {
                    const existingIndex = vendors.findIndex(v => v.name.toLowerCase() === nv.name.toLowerCase() && nv.name !== '[NOT FOUND]');
                    if (existingIndex !== -1) {
                        vendors[existingIndex] = { ...vendors[existingIndex], ...nv, id: vendors[existingIndex].id, createdAt: vendors[existingIndex].createdAt };
                        mergedCount++;
                    } else {
                        vendors.push(nv);
                        addedCount++;
                    }
                });

                saveVendors();
                if (searchInput) searchInput.value = '';
                if (filterRisk) filterRisk.value = 'All';
                applyFiltersAndSort();
                switchView('vendors-view', 'Vendors');
                showToast(`Imported ${addedCount} added, ${mergedCount} merged from ${file.name}.`);
            } catch (error) {
                console.error("Error parsing file:", error);
                showToast("Failed to parse file. Please ensure it's a valid Excel or CSV.");
            }
            e.target.value = '';
        };

        reader.onerror = function() {
            showToast("Failed to read file.");
            e.target.value = '';
        };

        reader.readAsBinaryString(file);
    };

    const btnExportVendors = document.getElementById('vendors-export-btn');
    const btnExportAssessments = document.getElementById('assessments-export-btn');
    const inputImportVendors = document.getElementById('vendor-import-file');
    const inputImportAssessments = document.getElementById('assessment-import-file');

    if (btnExportVendors) btnExportVendors.addEventListener('click', exportToCSV);

    const btnTemplateVendors = document.getElementById('vendors-template-btn');
    if (btnTemplateVendors) btnTemplateVendors.addEventListener('click', () => {
        const headers = ['Vendor ID', 'Vendor Name', 'Category', 'Vendor POC', 'Review Date', 'Next Review Date'];
        const example = [
            ['V-001', 'Acme Solutions LLC', 'Software / SaaS', 'Jane Doe — jane@acme.com', '2026-01-15', '2027-01-15'],
            ['V-002', 'Globex Cloud Services', 'Cloud / Infrastructure (IaaS/PaaS)', 'john@globex.com', '', '2026-09-30']
        ];
        const csv = [headers.join(','), ...example.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'vendor_import_template.csv');
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showToast('Template downloaded.');
    });
    if (btnExportAssessments) btnExportAssessments.addEventListener('click', exportToCSV);
    if (inputImportVendors) inputImportVendors.addEventListener('change', handleImportFile);
    if (inputImportAssessments) inputImportAssessments.addEventListener('change', handleImportFile);



    // Configuration Logic
    const themeSelector = document.getElementById('theme-selector');
    const fontSelector = document.getElementById('font-selector');
    const saveConfigBtn = document.getElementById('save-config-btn');
    
    if (themeSelector) themeSelector.value = currentUser?.theme || 'dark';
    if (fontSelector) fontSelector.value = currentUser?.font || "'Inter', sans-serif";

    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            const selectedTheme = themeSelector.value;
            const selectedFont = fontSelector.value;
            
            if (currentUser) {
                currentUser.theme = selectedTheme;
                currentUser.font = selectedFont;
                localStorage.setItem('tprm_current_user', JSON.stringify(currentUser));
                updateProfileUI(); // Apply theme and font dynamically
                showToast("Preferences saved successfully!");
            }
        });
    }

    // Init
    checkAuth();
});

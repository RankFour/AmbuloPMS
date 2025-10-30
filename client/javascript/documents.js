import fetchCompanyDetails from "../api/loadCompanyInfo.js";

const API_DOCS = "/api/v1/documents";

let docListing = { folders: [], files: [] };

function pathJoin(base, name) {
    if (!base) return name || "";
    if (!name) return base || "";
    return `${base.replace(/\/+$/,'')}/${String(name).replace(/^\/+/, '')}`;
}

async function fetchDocuments(path = "") {
    const url = new URL(API_DOCS, window.location.origin);
    if (path) url.searchParams.set("path", path);
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load documents");
    const data = await res.json();
    docListing = {
        folders: Array.isArray(data.folders) ? data.folders : [],
        files: Array.isArray(data.files) ? data.files : [],
    };

    // Rebuild the lightweight in-memory index used by the UI (backed by server data)
    // Only index items under the current path for rendering and actions.
    fileSystem = {};
    const parentPath = path || "";
    // Folders
    docListing.folders.forEach((f) => {
        const p = pathJoin(parentPath, f.name);
        fileSystem[p] = {
            type: "folder",
            name: f.name,
            created: new Date(),
            path: p,
            parentPath,
        };
    });
    // Files
    docListing.files.forEach((r) => {
        const name = r.filename || r.public_id.split("/").pop();
        const p = pathJoin(parentPath, name);
        fileSystem[p] = {
            type: "file",
            name,
            size: r.bytes || 0,
            lastModified: r.created_at ? new Date(r.created_at) : new Date(),
            created: r.created_at ? new Date(r.created_at) : new Date(),
            path: p,
            parentPath,
            secure_url: r.secure_url,
            public_id: r.public_id,
            resource_type: r.resource_type,
            format: r.format,
        };
    });
}

let currentView = 'list';
let currentPath = '';
let fileSystem = {};
let searchTerm = '';
let selectedType = 'All Types';
let selectedModified = 'Any time';
let contextItem = null;
let selectedFiles = [];
let selectedAttachments = [];

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('itemsContainer')) {
        setupDocumentManagement();
    }
    setDynamicInfo();
});

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Documents - ${company.company_name}`
    : "Ambulo Properties Admin Dashboard";
}

function setupDocumentManagement() {
    setupEventListeners();
    renderItems();
    addSampleData();
}

function addSampleData() {
    fileSystem['BIR 2025'] = {
        type: 'folder',
        name: 'BIR 2025',
        created: new Date('2024-01-15'),
        path: 'BIR 2025',
        parentPath: ''
    };

    fileSystem['Certificate'] = {
        type: 'folder',
        name: 'Certificate',
        created: new Date('2024-02-10'),
        path: 'Certificate',
        parentPath: ''
    };

    fileSystem['Tax'] = {
        type: 'folder',
        name: 'Tax',
        created: new Date('2024-03-05'),
        path: 'Tax',
        parentPath: ''
    };

    renderItems();
}

        function switchTab(tabName) {
            currentTab = tabName;
            
            
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName + 'Content').classList.add('active');
            
            
            currentPath = '';
            renderBreadcrumb();
            renderItems();
        }

    function setupEventListeners() {
            
            const fileInput = document.getElementById('fileInput');
            const attachmentInput = document.getElementById('attachmentInput');
            
            if (fileInput) fileInput.addEventListener('change', handleFileSelect);
            if (attachmentInput) attachmentInput.addEventListener('change', handleAttachmentSelect);

            
            const dropZone = document.getElementById('dropZone');
            if (dropZone) {
                dropZone.addEventListener('dragover', handleDragOver);
                dropZone.addEventListener('dragleave', handleDragLeave);
                dropZone.addEventListener('drop', handleDrop);
            }

            const attachmentDropZone = document.getElementById('attachmentDropZone');
            if (attachmentDropZone) {
                attachmentDropZone.addEventListener('dragover', handleAttachmentDragOver);
                attachmentDropZone.addEventListener('dragleave', handleAttachmentDragLeave);
                attachmentDropZone.addEventListener('drop', handleAttachmentDrop);
            }

            
            const folderNameInput = document.getElementById('folderName');
            
            if (folderNameInput) {
                folderNameInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') createFolder();
                });
            }

            
            // Search input
            const searchEl = document.getElementById('searchInput');
            if (searchEl) {
                searchEl.addEventListener('input', function(e){
                    searchTerm = (e.target.value || '').trim();
                    renderItems();
                });
            }

            window.addEventListener('click', function(e) {
                if (e.target.classList.contains('modal')) {
                    closeModal(e.target.id);
                }
                
                if (!e.target.closest('.dropdown') && !e.target.closest('.btn-add')) {
                    document.querySelectorAll('.dropdown-content, .add-dropdown-content').forEach(dropdown => {
                        dropdown.style.display = 'none';
                    });
                }
            });
        }

function toggleAddMenu() {
    const menu = document.getElementById('addMenu');
    if (!menu) return;
    
    const isVisible = menu.style.display === 'block';
    
    
    document.querySelectorAll('.dropdown-content, .add-dropdown-content').forEach(d => {
        d.style.display = 'none';
    });
    
    if (!isVisible) {
        menu.style.display = 'block';
    }
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const isVisible = dropdown.style.display === 'block';
    
    
    document.querySelectorAll('.dropdown-content, .add-dropdown-content').forEach(d => {
        d.style.display = 'none';
    });
    
    if (!isVisible) {
        dropdown.style.display = 'block';
    }
}

function selectType(type) {
    selectedType = type;
    const button = document.querySelector('#typeDropdown').parentElement.querySelector('.dropdown-button span');
    if (button) button.textContent = '📋 ' + type;
    document.getElementById('typeDropdown').style.display = 'none';
    renderItems();
}

function selectModified(modified) {
    selectedModified = modified;
    const button = document.querySelector('#modifiedDropdown').parentElement.querySelector('.dropdown-button span');
    if (button) button.textContent = '📅 ' + modified;
    document.getElementById('modifiedDropdown').style.display = 'none';
    renderItems();
}

function switchView(view) {
    currentView = view;
    
    const listBtn = document.getElementById('listBtn');
    const gridBtn = document.getElementById('gridBtn');
    
    if (listBtn) listBtn.classList.remove('active');
    if (gridBtn) gridBtn.classList.remove('active');
    
    const activeBtn = document.getElementById(view + 'Btn');
    if (activeBtn) activeBtn.classList.add('active');

    const container = document.getElementById('itemsContainer');
    if (container) {
        container.className = view === 'list' ? 'items-container list-view' : 'items-container grid-view';
    }
    
    renderItems();
}

function clearFilters() {
    // Reset search
    const searchEl = document.getElementById('searchInput');
    if (searchEl) searchEl.value = '';
    searchTerm = '';

    // Reset type filter
    selectedType = 'All Types';
    const typeBtn = document.querySelector('#typeDropdown')?.parentElement?.querySelector('.dropdown-button span');
    if (typeBtn) typeBtn.textContent = '📋 ' + selectedType;
    const typeDrop = document.getElementById('typeDropdown');
    if (typeDrop) typeDrop.style.display = 'none';

    // Reset modified filter
    selectedModified = 'Any time';
    const modBtn = document.querySelector('#modifiedDropdown')?.parentElement?.querySelector('.dropdown-button span');
    if (modBtn) modBtn.textContent = '📅 ' + selectedModified;
    const modDrop = document.getElementById('modifiedDropdown');
    if (modDrop) modDrop.style.display = 'none';

    // Shake effect optional via CSS class if present
    renderItems();
}

function renameItem() {
    if (!contextItem) return;
    
    const item = fileSystem[contextItem];
    if (!item) return;
    
    const newNameInput = document.getElementById('newName');
    const renameModal = document.getElementById('renameModal');
    const contextMenu = document.getElementById('contextMenu');
    
    if (newNameInput) newNameInput.value = item.name;
    if (renameModal) {
        renameModal.style.display = 'block';
        setTimeout(() => {
            renameModal.classList.add('show');
            newNameInput.focus();
            newNameInput.select();
        }, 10);
    }
    if (contextMenu) contextMenu.style.display = 'none';
}

function updateChildrenPaths(oldParentPath, newParentPath) {
    Object.keys(fileSystem).forEach(path => {
        const item = fileSystem[path];
        if (item.parentPath === oldParentPath) {
            const newPath = `${newParentPath}/${item.name}`;
            item.parentPath = newParentPath;
            item.path = newPath;
            
            
            if (path !== newPath) {
                fileSystem[newPath] = item;
                delete fileSystem[path];
                
                
                if (item.type === 'folder') {
                    updateChildrenPaths(path, newPath);
                }
            }
        }
    });
}


function deleteItem() {
    if (!contextItem) return;
    
    const item = fileSystem[contextItem];
    if (!item) return;
    
    const deleteItemName = document.getElementById('deleteItemName');
    const deleteModal = document.getElementById('deleteModal');
    const contextMenu = document.getElementById('contextMenu');
    const deleteWarning = document.getElementById('deleteWarning');
    
    if (deleteItemName) deleteItemName.textContent = item.name;
    
    
    if (item.type === 'folder') {
        const childrenCount = Object.values(fileSystem).filter(i => i.parentPath === contextItem).length;
        if (deleteWarning) {
            if (childrenCount > 0) {
                deleteWarning.style.display = 'block';
                deleteWarning.innerHTML = `<span>⚠️</span> This folder contains ${childrenCount} item${childrenCount > 1 ? 's' : ''}. All contents will be permanently deleted.`;
            } else {
                deleteWarning.style.display = 'none';
            }
        }
    } else {
        if (deleteWarning) deleteWarning.style.display = 'none';
    }
    
    if (deleteModal) {
        deleteModal.style.display = 'block';
        setTimeout(() => deleteModal.classList.add('show'), 10);
    }
    if (contextMenu) contextMenu.style.display = 'none';
}

function deleteChildren(folderPath) {
    let deletedCount = 0;
    const childrenToDelete = [];
    
    
    Object.keys(fileSystem).forEach(path => {
        const item = fileSystem[path];
        if (item.parentPath === folderPath) {
            childrenToDelete.push(path);
        }
    });
    
    
    childrenToDelete.forEach(childPath => {
        const childItem = fileSystem[childPath];
        if (childItem) {
            
            if (childItem.type === 'folder') {
                deletedCount += deleteChildren(childPath);
            }
            delete fileSystem[childPath];
            deletedCount++;
        }
    });
    
    return deletedCount;
}


function showInputError(input, message) {
    
    input.classList.add('error');
    
    
    const existingError = input.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
    
    
    input.focus();
    
    
    const clearError = () => {
        clearInputError(input);
        input.removeEventListener('input', clearError);
    };
    input.addEventListener('input', clearError);
}


function clearInputError(input) {
    input.classList.remove('error');
    const errorMessage = input.parentNode.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}


function showContextMenu(event, itemPath) {
    event.preventDefault();
    event.stopPropagation();
    
    contextItem = itemPath;
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;
    
    
    const x = event.pageX;
    const y = event.pageY;
    const menuWidth = 150;
    const menuHeight = 120;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    
    let left = x;
    let top = y;
    
    if (x + menuWidth > windowWidth) {
        left = x - menuWidth;
    }
    
    if (y + menuHeight > windowHeight) {
        top = y - menuHeight;
    }
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    
    
    setTimeout(() => {
        contextMenu.style.opacity = '1';
    }, 10);
}


function openItem() {
    if (!contextItem) return;
    
    const item = fileSystem[contextItem];
    if (!item) return;
    
    if (item.type === 'folder') {
        navigateToFolder(item.path);
    } else {
        openFile(item.path);
    }
    
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) contextMenu.style.display = 'none';
    contextItem = null;
}


document.addEventListener('keydown', function(e) {
    
    if (document.getElementById('renameModal').classList.contains('show')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmRename();
        }
    }
    
    
    if (document.getElementById('deleteModal').classList.contains('show')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmDelete();
        }
    }
    
    
    const hasOpenModal = document.querySelector('.modal.show');
    if (!hasOpenModal) {
        
        if (e.key === 'Delete' && contextItem) {
            e.preventDefault();
            deleteItem();
        }
        
        
        if (e.key === 'F2' && contextItem) {
            e.preventDefault();
            renameItem();
        }
    }
});


document.addEventListener('click', function(e) {
    if (!e.target.closest('.context-menu') && !e.target.closest('.more-icon')) {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
            contextMenu.style.opacity = '0';
            contextItem = null;
        }
    }
});


const errorStyles = `
.input-group input.error {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

.error-message {
    color: #ef4444;
    font-size: 12px;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.error-message::before {
    content: "⚠️";
    font-size: 12px;
}

.context-menu {
    opacity: 0;
    transition: opacity 0.2s ease;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 8px;
}

.notification-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 18px;
    margin-left: auto;
    opacity: 0.7;
    transition: opacity 0.2s ease;
}

.notification-close:hover {
    opacity: 1;
}
`;

if (!document.getElementById('error-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'error-styles';
    styleSheet.textContent = errorStyles;
    document.head.appendChild(styleSheet);
}

function getFileType(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
        case 'pdf':
            return { iconClass: 'fa-solid fa-file-pdf', class: 'pdf-icon', type: 'document' };
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
            return { iconClass: 'fa-solid fa-image', class: 'image-icon', type: 'image' };
        case 'doc':
        case 'docx':
            return { iconClass: 'fa-solid fa-file-word', class: 'doc-icon', type: 'document' };
        case 'xls':
        case 'xlsx':
            return { iconClass: 'fa-solid fa-file-excel', class: 'doc-icon', type: 'document' };
        case 'txt':
            return { iconClass: 'fa-solid fa-file-lines', class: 'file-icon', type: 'document' };
        default:
            return { iconClass: 'fa-solid fa-file', class: 'file-icon', type: 'other' };
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = [...selectedFiles, ...files];
    updateSelectedFilesDisplay();
}

function handleAttachmentSelect(event) {
    const files = Array.from(event.target.files);
    selectedAttachments = [...selectedAttachments, ...files];
    updateSelectedAttachmentsDisplay();
}

function updateSelectedFilesDisplay() {
    const container = document.getElementById('selectedFiles');
    if (!container) return;
    
    if (selectedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    selectedFiles.forEach((file, index) => {
        html += `
            <div class="selected-file">
                <span>${file.name} (${formatFileSize(file.size)})</span>
                <button class="remove-file" onclick="removeFile(${index})">✕</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

function updateSelectedAttachmentsDisplay() {
    const container = document.getElementById('selectedAttachments');
    if (!container) return;
    
    if (selectedAttachments.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    selectedAttachments.forEach((file, index) => {
        html += `
            <div class="selected-file">
                <span>${file.name} (${formatFileSize(file.size)})</span>
                <button class="remove-file" onclick="removeAttachment(${index})">✕</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateSelectedFilesDisplay();
}

function removeAttachment(index) {
    selectedAttachments.splice(index, 1);
    updateSelectedAttachmentsDisplay();
}


function handleDragOver(event) {
    event.preventDefault();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.classList.remove('drag-over');
    const files = Array.from(event.dataTransfer.files);
    selectedFiles = [...selectedFiles, ...files];
    updateSelectedFilesDisplay();
}

function handleAttachmentDragOver(event) {
    event.preventDefault();
    const attachmentDropZone = document.getElementById('attachmentDropZone');
    if (attachmentDropZone) attachmentDropZone.classList.add('drag-over');
}

function handleAttachmentDragLeave(event) {
    event.preventDefault();
    const attachmentDropZone = document.getElementById('attachmentDropZone');
    if (attachmentDropZone) attachmentDropZone.classList.remove('drag-over');
}

function handleAttachmentDrop(event) {
    event.preventDefault();
    const attachmentDropZone = document.getElementById('attachmentDropZone');
    if (attachmentDropZone) attachmentDropZone.classList.remove('drag-over');
    const files = Array.from(event.dataTransfer.files);
    selectedAttachments = [...selectedAttachments, ...files];
    updateSelectedAttachmentsDisplay();
}

function navigateToFolder(path) {
    currentPath = path;
    renderBreadcrumb();
    renderItems();
}

function renderBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    let html = '<span class="breadcrumb-item" onclick="navigateToFolder(\'\')">Documents</span>';
    
    if (currentPath) {
        const pathParts = currentPath.split('/');
        let buildPath = '';
        
        pathParts.forEach((part, index) => {
            buildPath += (index > 0 ? '/' : '') + part;
            html += ` <span>→</span> <span class="breadcrumb-item" onclick="navigateToFolder('${buildPath}')">${part}</span>`;
        });
    }
    
    breadcrumb.innerHTML = html;
}

async function renderItems() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    try { await fetchDocuments(currentPath); } catch (e) { /* ignore, render empty */ }

    let items = Object.values(fileSystem).filter(item => {
        if (item.parentPath !== currentPath) return false;
        // Type filter
        if (selectedType !== 'All Types') {
            if (selectedType === 'Folders' && item.type !== 'folder') return false;
            if (selectedType === 'Documents' && (item.type !== 'file' || !['pdf','doc','docx','txt','xls','xlsx'].includes(item.name.toLowerCase().split('.').pop()))) return false;
            if (selectedType === 'Images' && (item.type !== 'file' || !['jpg','jpeg','png','gif','svg'].includes(item.name.toLowerCase().split('.').pop()))) return false;
        }
        // Search filter
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            if (!String(item.name || '').toLowerCase().includes(q)) return false;
        }
        // Modified filter
        if (selectedModified && selectedModified !== 'Any time') {
            const dt = item.lastModified || item.created || null;
            if (dt) {
                const d = new Date(dt);
                const now = new Date();
                const ms = now - d;
                if (selectedModified === 'Today') {
                    const sameDay = d.toDateString() === now.toDateString();
                    if (!sameDay) return false;
                } else if (selectedModified === 'This week') {
                    if (ms > 7 * 24 * 60 * 60 * 1000) return false;
                } else if (selectedModified === 'This month') {
                    if (ms > 30 * 24 * 60 * 60 * 1000) return false;
                }
            }
        }
        return true;
    });

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fa-solid fa-folder"></i></div>
                <h3>No files or folders yet</h3>
                <p>Create a folder or upload some files to get started</p>
            </div>`;
        return;
    }

    items.sort((a,b)=> (a.type!==b.type) ? (a.type==='folder'?-1:1) : a.name.localeCompare(b.name));

    let html = '';
    items.forEach(item => {
        const isFolder = item.type === 'folder';
        const fileType = isFolder ? { iconClass: 'fa-solid fa-folder', class: 'folder-icon', type: 'folder' } : getFileType(item.name);
        const dateStr = item.created ? new Date(item.created).toLocaleDateString() : '';
        const sizeStr = isFolder ? '—' : formatFileSize(item.size || 0);
        const clickAction = isFolder ? `navigateToFolder('${item.path}')` : (item.secure_url ? `openFile('${item.path}')` : `openFile('${item.path}')`);
        const attachmentIndicator = item.isAttachment ? ' <i class="fa-solid fa-paperclip"></i>' : '';

        if (currentView === 'list') {
            html += `
                <div class="list-item" onclick="${clickAction}">
                    <div class="item-icon ${fileType.class}"><i class="${fileType.iconClass}"></i></div>
                    <div class="item-info">
                        <div class="item-name">${item.name}${attachmentIndicator}</div>
                        <div class="item-meta">${dateStr ? `Modified: ${dateStr}` : ''}</div>
                    </div>
                    <div class="item-size">${sizeStr}</div>
                    <div class="item-actions">
                        <button class="action-btn" onclick="event.stopPropagation(); renameItemDirect('${item.path}')" title="Rename"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="action-btn danger" onclick="event.stopPropagation(); deleteItemDirect('${item.path}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        } else {
            const previewClass = isFolder ? 'folder' : fileType.type;
            const previewIconHtml = isFolder ? '<i class="fa-solid fa-folder"></i>' : `<i class="${fileType.iconClass}"></i>`;
            html += `
                <div class="grid-item" onclick="${clickAction}">
                    <div class="item-preview ${previewClass}"><div class="preview-icon">${previewIconHtml}</div></div>
                    <div class="more-icon" onclick="event.stopPropagation(); showContextMenu(event, '${item.path}')"><i class="fa-solid fa-ellipsis-vertical"></i></div>
                    <div class="item-info">
                        <div class="item-name">${item.name}${attachmentIndicator}</div>
                        <div class="item-meta">${sizeStr}</div>
                    </div>
                </div>`;
        }
    });
    container.innerHTML = html;
}

function renameItemDirect(itemPath) {
    contextItem = itemPath;
    renameItem();
}

function deleteItemDirect(itemPath) {
    contextItem = itemPath;
    deleteItem();
}

function openFile(filePath) {
    const file = fileSystem[filePath];
    if (file && file.secure_url) {
        const url = file.secure_url;
        const name = file.name || '';
        const ext = name.toLowerCase().split('.').pop();
        const type = (file.resource_type || '').toLowerCase();

        const isImg = type === 'image' || ['jpg','jpeg','png','gif','svg','webp','bmp','heic'].includes(ext);
        const isVid = type === 'video' || ['mp4','mov','avi','webm','mkv'].includes(ext);

        if (isImg) {
            showPreviewModal({ kind: 'image', url, name });
            return;
        }
        if (isVid) {
            showPreviewModal({ kind: 'video', url, name });
            return;
        }
        window.open(url, '_blank');
        return;
    }
    if (file && file.file) {
        const url = URL.createObjectURL(file.file);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
    }
    const alertFn = (typeof window !== 'undefined' && typeof window.showAlert === 'function')
        ? ((msg, t) => window.showAlert(msg, t))
        : ((msg) => alert(String(msg)));
    alertFn('File cannot be opened', 'error');
}

// Lightweight in-app preview for images and videos
function ensurePreviewModal() {
    let modal = document.getElementById('previewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'previewModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; max-height: 90vh;">
                <span class="close" style="position:absolute;top:8px;right:12px;cursor:pointer;font-size:22px;" onclick="closeModal('previewModal')">&times;</span>
                <div id="previewBody" style="display:flex;align-items:center;justify-content:center;max-height:80vh;overflow:auto;padding:16px;"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    return modal;
}

function showPreviewModal({ kind, url, name }) {
    const modal = ensurePreviewModal();
    const body = modal.querySelector('#previewBody');
    if (body) {
        if (kind === 'image') {
            body.innerHTML = `<img src="${url}" alt="${name || ''}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;" />`;
        } else if (kind === 'video') {
            body.innerHTML = `<video src="${url}" controls style="max-width:100%;max-height:80vh;border-radius:8px;background:#000"></video>`;
        } else {
            body.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">Open in new tab</a>`;
        }
    }
    showModal('previewModal');
}


document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('breadcrumb')) {
        renderBreadcrumb();
    }
});





document.addEventListener('DOMContentLoaded', function() {
    const profileBtn = document.getElementById('profileBtnIcon');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (profileBtn && dropdownMenu) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        
        document.addEventListener('click', function(e) {
            if (!profileBtn.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    
    if (document.getElementById('itemsContainer')) {
        setupDocumentManagement();
    }
});



function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'block';
    
    modal.offsetHeight;
    modal.classList.add('show');
    
    
    const firstInput = modal.querySelector('input, button');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
    
    
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('show');
    
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    
    
    resetModalData(modalId);
}

function resetModalData(modalId) {
    switch(modalId) {
        case 'folderModal':
            const folderNameInput = document.getElementById('folderName');
            if (folderNameInput) {
                folderNameInput.value = '';
                folderNameInput.classList.remove('error');
            }
            break;
            
        case 'uploadModal':
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';
            selectedFiles = [];
            updateSelectedFilesDisplay();
            resetDropZone('dropZone');
            break;
            
        case 'attachmentModal':
            const attachmentInput = document.getElementById('attachmentInput');
            if (attachmentInput) attachmentInput.value = '';
            selectedAttachments = [];
            updateSelectedAttachmentsDisplay();
            resetDropZone('attachmentDropZone');
            break;
            
        case 'renameModal':
            const newNameInput = document.getElementById('newName');
            if (newNameInput) {
                newNameInput.value = '';
                newNameInput.classList.remove('error');
            }
            contextItem = null;
            break;
            
        case 'deleteModal':
            contextItem = null;
            break;
    }
}

function resetDropZone(dropZoneId) {
    const dropZone = document.getElementById(dropZoneId);
    if (dropZone) {
        dropZone.classList.remove('drag-over');
    }
}


function showNewFolderModal() {
    const addMenu = document.getElementById('addMenu');
    if (addMenu) addMenu.style.display = 'none';
    showModal('folderModal');
}

function showUploadModal() {
    const addMenu = document.getElementById('addMenu');
    if (addMenu) addMenu.style.display = 'none';
    showModal('uploadModal');
}

function showAttachmentModal() {
    const addMenu = document.getElementById('addMenu');
    if (addMenu) addMenu.style.display = 'none';
    showModal('attachmentModal');
}


async function createFolder() {
    const folderNameInput = document.getElementById('folderName');
    if (!folderNameInput) return;
    
    const folderName = folderNameInput.value.trim();
    
    
    if (!folderName) {
        showInputError(folderNameInput, 'Folder name is required');
        return;
    }
    
    if (folderName.length > 100) {
        showInputError(folderNameInput, 'Folder name is too long (max 100 characters)');
        return;
    }
    
    
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(folderName)) {
        showInputError(folderNameInput, 'Folder name contains invalid characters');
        return;
    }

    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    
    if (fileSystem[folderPath]) {
        showInputError(folderNameInput, 'A folder with this name already exists');
        return;
    }

    
        const createBtn = document.querySelector('#folderModal .btn-primary');
        if (createBtn) {
                createBtn.classList.add('loading');
                createBtn.disabled = true;
        }

        try {
            const res = await fetch(`${API_DOCS}/folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ path: currentPath, name: folderName }),
            });
            if (!res.ok) {
                const j = await res.json().catch(()=>({}));
                throw new Error(j.message || 'Failed to create folder');
            }
            closeModal('folderModal');
            await renderItems();
            showNotification(`Folder "${folderName}" created successfully`, 'success');
        } catch (e) {
            showNotification(e.message || 'Failed to create folder', 'error');
        } finally {
            if (createBtn) {
                createBtn.classList.remove('loading');
                createBtn.disabled = false;
            }
        }
}


async function confirmRename() {
    const newNameInput = document.getElementById('newName');
    if (!newNameInput || !contextItem) return;
    
    const newName = newNameInput.value.trim();
    
    
    if (!newName) {
        showInputError(newNameInput, 'Name is required');
        return;
    }
    
    if (newName.length > 100) {
        showInputError(newNameInput, 'Name is too long (max 100 characters)');
        return;
    }
    
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(newName)) {
        showInputError(newNameInput, 'Name contains invalid characters');
        return;
    }
    
        const item = fileSystem[contextItem];
        if (!item) return;

        const parentPath = item.parentPath;
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        if (newPath !== contextItem && fileSystem[newPath]) {
            showInputError(newNameInput, 'An item with this name already exists');
            return;
        }

        const renameBtn = document.querySelector('#renameModal .btn-primary');
        if (renameBtn) { renameBtn.classList.add('loading'); renameBtn.disabled = true; }

        try {
            if (item.type === 'folder') {
                // Not supported quickly via Cloudinary API without moving all resources.
                throw new Error('Folder rename is not supported yet');
            } else {
                const baseFolderPublic = (item.public_id.includes('/') ? item.public_id.split('/').slice(0, -1).join('/') : '').trim();
                const nameNoExt = newName.replace(/\.[^.]+$/,'');
                const newPublicId = baseFolderPublic ? `${baseFolderPublic}/${nameNoExt}` : nameNoExt;
                const res = await fetch(`${API_DOCS}/rename`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ public_id: item.public_id, new_public_id: newPublicId, resource_type: item.resource_type || 'image' }),
                });
                if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Failed to rename file');
            }
            closeModal('renameModal');
            await renderItems();
            showNotification(`Renamed to "${newName}"`, 'success');
        } catch (e) {
            showNotification(e.message || 'Rename failed', 'error');
        } finally {
            if (renameBtn) { renameBtn.classList.remove('loading'); renameBtn.disabled = false; }
        }
}


async function confirmDelete() {
    if (!contextItem) return;
    const item = fileSystem[contextItem];
    if (!item) return;

    const deleteBtn = document.querySelector('#deleteModal .btn-danger');
    if (deleteBtn) { deleteBtn.classList.add('loading'); deleteBtn.disabled = true; }

    try {
        if (item.type === 'folder') {
            const res = await fetch(`${API_DOCS}/folder`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ path: item.path }),
            });
            if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Failed to delete folder');
        } else {
            const res = await fetch(`${API_DOCS}/file`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ public_id: item.public_id, resource_type: item.resource_type || 'image' }),
            });
            if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Failed to delete file');
        }
        closeModal('deleteModal');
        await renderItems();
        showNotification(`"${item.name}" deleted successfully`, 'success');
    } catch (e) {
        showNotification(e.message || 'Delete failed', 'error');
    } finally {
        if (deleteBtn) { deleteBtn.classList.remove('loading'); deleteBtn.disabled = false; }
    }
}


async function uploadFiles() {
    if (selectedFiles.length === 0) {
        showNotification('Please select files to upload', 'error');
        return;
    }

    const uploadBtn = document.querySelector('#uploadModal .btn-primary');
    if (uploadBtn) {
        uploadBtn.classList.add('loading');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
    }

    try {
        const form = new FormData();
        form.append('path', currentPath || '');
        selectedFiles.forEach(f => form.append('files', f));
        const res = await fetch(`${API_DOCS}/upload`, {
            method: 'POST',
            credentials: 'include',
            body: form,
        });
        if (!res.ok) {
            const j = await res.json().catch(()=>({}));
            throw new Error(j.message || 'Upload failed');
        }
        // Refresh listing
        await renderItems();
        finishUpload(uploadBtn);
    } catch (e) {
        if (uploadBtn) {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
        showNotification(e.message || 'Upload failed', 'error');
    }
}

function finishUpload(uploadBtn) {
    setTimeout(() => {
        if (uploadBtn) {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
        
        const fileCount = selectedFiles.length;
        closeModal('uploadModal');
        renderItems();
        
        showNotification(`${fileCount} file${fileCount > 1 ? 's' : ''} uploaded successfully`, 'success');
    }, 300);
}


function attachFiles() {
    if (selectedAttachments.length === 0) {
        showNotification('Please select files to attach', 'error');
        return;
    }

    const attachBtn = document.querySelector('#attachmentModal .btn-secondary');
    if (attachBtn) {
        attachBtn.classList.add('loading');
        attachBtn.disabled = true;
    }

    setTimeout(() => {
        selectedAttachments.forEach(file => {
            const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
            const attachmentName = `attachment_${timestamp}_${file.name}`;
            const filePath = currentPath ? `${currentPath}/${attachmentName}` : attachmentName;
            
            fileSystem[filePath] = {
                type: 'file',
                name: attachmentName,
                size: file.size,
                lastModified: new Date(file.lastModified),
                created: new Date(),
                path: filePath,
                parentPath: currentPath,
                file: file,
                isAttachment: true
            };
        });

        if (attachBtn) {
            attachBtn.classList.remove('loading');
            attachBtn.disabled = false;
        }

        const fileCount = selectedAttachments.length;
        closeModal('attachmentModal');
        renderItems();
        
        showNotification(`${fileCount} attachment${fileCount > 1 ? 's' : ''} added successfully`, 'success');
    }, 800);
}


function showNotification(message, type = 'info') {
    
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 2000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return '<i class="fa-solid fa-circle-check"></i>';
        case 'error': return '<i class="fa-solid fa-circle-xmark"></i>';
        case 'warning': return '<i class="fa-solid fa-triangle-exclamation"></i>';
        default: return '<i class="fa-solid fa-circle-info"></i>';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#10b981';
        case 'error': return '#ef4444';
        case 'warning': return '#f59e0b';
        default: return '#3b82f6';
    }
}


document.addEventListener('keydown', function(e) {
    
    if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal.show');
        if (visibleModal) {
            closeModal(visibleModal.id);
        }
    }
    
    
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        showNewFolderModal();
    }
    
    
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        showUploadModal();
    }
});


function enhanceDragDrop() {
    const dropZones = document.querySelectorAll('.file-drop-zone');
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragenter', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        zone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            if (!this.contains(e.relatedTarget)) {
                this.classList.remove('drag-over');
            }
        });
        
        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                if (this.id === 'dropZone') {
                    selectedFiles = [...selectedFiles, ...files];
                    updateSelectedFilesDisplay();
                } else if (this.id === 'attachmentDropZone') {
                    selectedAttachments = [...selectedAttachments, ...files];
                    updateSelectedAttachmentsDisplay();
                }
                
                
                this.style.borderColor = '#10b981';
                this.style.background = '#dcfce7';
                setTimeout(() => {
                    this.style.borderColor = '';
                    this.style.background = '';
                }, 1000);
            }
        });
    });
}


document.addEventListener('DOMContentLoaded', function() {
    enhanceDragDrop();
});

// Expose functions for inline handlers and external access
if (typeof window !== 'undefined') {
    window.toggleAddMenu = toggleAddMenu;
    window.toggleDropdown = toggleDropdown;
    window.selectType = selectType;
    window.selectModified = selectModified;
    window.switchView = switchView;
    window.navigateToFolder = navigateToFolder;
    window.openItem = openItem;
    window.openFile = openFile;
    window.renameItem = renameItem;
    window.renameItemDirect = renameItemDirect;
    window.deleteItem = deleteItem;
    window.deleteItemDirect = deleteItemDirect;
    window.showContextMenu = showContextMenu;
    window.showNewFolderModal = showNewFolderModal;
    window.showUploadModal = showUploadModal;
    window.showAttachmentModal = showAttachmentModal;
    window.closeModal = closeModal;
    window.createFolder = createFolder;
    window.confirmRename = confirmRename;
    window.confirmDelete = confirmDelete;
    window.uploadFiles = uploadFiles;
    window.attachFiles = attachFiles;
    window.clearFilters = clearFilters;
    window.removeFile = removeFile;
    window.removeAttachment = removeAttachment;
}
